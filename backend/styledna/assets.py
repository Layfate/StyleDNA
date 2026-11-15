import hashlib
import io
import json
import re
import shutil
import threading
import warnings
from pathlib import Path
from uuid import uuid4

from PIL import Image, ImageCms, ImageOps, UnidentifiedImageError

from .config import (
    MAX_IMAGE_BYTES,
    MAX_PIXELS,
    MAX_STORAGE_BYTES,
    PREVIEW_SIZE,
    THUMBNAIL_SIZE,
)
from .models import Reference


class ImageError(ValueError):
    pass


class AssetStore:
    def __init__(self, root: Path):
        self.root = root / "assets"
        self.staging = root / "staging"
        self.root.mkdir(parents=True, exist_ok=True)
        self.staging.mkdir(parents=True, exist_ok=True)
        self.decode_slots = threading.Semaphore(2)

    def path(self, asset_id: str, variant: str = "reference") -> Path:
        if not re.fullmatch(r"[a-f0-9]{32}", asset_id):
            raise ImageError("Invalid asset identifier")
        names = {
            "reference": "reference.png",
            "preview": "preview.png",
            "thumbnail": "thumbnail.webp",
            "metadata": "metadata.json",
        }
        if variant not in names:
            raise ImageError("Invalid image variant")
        return self.root / asset_id / names[variant]

    def get(self, asset_id: str) -> Reference:
        try:
            return Reference.model_validate_json(self.path(asset_id, "metadata").read_bytes())
        except FileNotFoundError as exc:
            raise ImageError("Reference no longer exists. Import it again.") from exc

    def remove(self, asset_id: str) -> None:
        path = self.path(asset_id).parent
        shutil.rmtree(path, ignore_errors=True)

    def import_image(self, data: bytes, filename: str) -> Reference:
        with self.decode_slots:
            return self._import_image(data, filename)

    def _import_image(self, data: bytes, filename: str) -> Reference:
        if not data or len(data) > MAX_IMAGE_BYTES:
            raise ImageError("Each image must be nonempty and at most 20 MiB")
        if sum(p.stat().st_size for p in self.root.rglob("*") if p.is_file()) > MAX_STORAGE_BYTES:
            raise ImageError("Local asset storage limit reached. Delete unused skills first.")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                image = Image.open(io.BytesIO(data))
                fmt = image.format
                if fmt not in ("PNG", "JPEG", "WEBP"):
                    raise ImageError("Only PNG, JPEG, and WebP content is supported")
                if getattr(image, "n_frames", 1) != 1:
                    raise ImageError("Animated images are not supported")
                if image.width * image.height > MAX_PIXELS:
                    raise ImageError("Image exceeds the decoded pixel limit (40 megapixels)")
                image.load()
                image = ImageOps.exif_transpose(image)
                # Convert embedded ICC colors to sRGB before discarding metadata.
                icc = image.info.get("icc_profile")
                alpha = image.convert("RGBA").getchannel("A") if "A" in image.getbands() else None
                if icc:
                    image = ImageCms.profileToProfile(
                        image.convert("RGB"),
                        ImageCms.ImageCmsProfile(io.BytesIO(icc)),
                        ImageCms.createProfile("sRGB"),
                        outputMode="RGB",
                    )
                    if alpha is not None:
                        image.putalpha(alpha)
                else:
                    image = image.convert("RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB")
                image.info.clear()
        except ImageError:
            raise
        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
            ImageCms.PyCMSError,
        ) as exc:
            raise ImageError("Not a valid supported image, or unsafe decoded image size") from exc

        asset_id = uuid4().hex
        staged = self.staging / asset_id
        staged.mkdir()
        try:
            image.save(staged / "reference.png", "PNG")
            preview = image.copy()
            preview.thumbnail((PREVIEW_SIZE, PREVIEW_SIZE))
            preview.save(staged / "preview.png", "PNG")
            preview.thumbnail((THUMBNAIL_SIZE, THUMBNAIL_SIZE))
            preview.save(staged / "thumbnail.webp", "WEBP", quality=85)
            content = (staged / "reference.png").read_bytes()
            if len(content) > MAX_IMAGE_BYTES:
                raise ImageError(
                    "The normalized reference exceeds 20 MiB. Resize the image and retry."
                )
            ref = Reference(
                id=asset_id,
                filename=re.split(r"[/\\]", filename)[-1][:255] or "reference.png",
                width=image.width,
                height=image.height,
                format=fmt,
                bytes=len(content),
                sha256=hashlib.sha256(content).hexdigest(),
            )
            (staged / "metadata.json").write_text(json.dumps(ref.model_dump()), encoding="utf-8")
            staged.rename(self.root / asset_id)
            return ref
        finally:
            image.close()
            shutil.rmtree(staged, ignore_errors=True)
