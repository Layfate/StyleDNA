import hashlib
import io
import re
import stat
import zipfile
from pathlib import PurePosixPath
from typing import Literal
from uuid import uuid4

from pydantic import Field, ValidationError

from .assets import AssetStore, ImageError
from .config import MAX_IMAGE_BYTES, MAX_PACKAGE_BYTES
from .database import Library
from .models import AssetId, StrictModel, StyleProfile


class PackageError(ValueError):
    pass


class PackageAsset(StrictModel):
    id: AssetId
    path: str = Field(max_length=100)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    filename: str = Field(max_length=255)


class Manifest(StrictModel):
    package_version: Literal[1] = 1
    profile_version: Literal[1] = 1
    assets: list[PackageAsset] = Field(default_factory=list, max_length=20)


def export_package(
    library: Library, assets: AssetStore, skill_id: str, revision: int | None = None
) -> bytes:
    saved = library.get(skill_id, revision)
    p = StyleProfile.model_validate(saved["profile"])
    manifest = Manifest(
        assets=[
            PackageAsset(
                id=ref_id,
                path=f"references/{ref_id}.png",
                sha256=assets.get(ref_id).sha256,
                filename=assets.get(ref_id).filename,
            )
            for ref_id in p.reference_ids
        ]
    )
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", manifest.model_dump_json(indent=2))
        z.writestr("style.json", p.model_dump_json(indent=2))
        z.writestr("SKILL.md", saved["markdown"])
        for ref in manifest.assets:
            z.write(assets.path(ref.id), ref.path)
    return out.getvalue()


def import_package(library: Library, assets: AssetStore, data: bytes) -> dict:
    if len(data) > MAX_PACKAGE_BYTES:
        raise PackageError("Package exceeds 250 MiB")
    created: list[str] = []
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            infos = z.infolist()
            names = [item.filename for item in infos]
            if len(infos) > 23 or len(names) != len(set(names)):
                raise PackageError("Package has excessive or duplicate entries")
            if sum(item.file_size for item in infos) > MAX_PACKAGE_BYTES:
                raise PackageError("Expanded package exceeds 250 MiB")
            for item in infos:
                path = PurePosixPath(item.filename)
                if (
                    path.is_absolute()
                    or ".." in path.parts
                    or "\\" in item.filename
                    or ":" in item.filename
                    or not re.fullmatch(r"[A-Za-z0-9_./-]+", item.filename)
                    or item.is_dir()
                    or stat.S_ISLNK(item.external_attr >> 16)
                    or item.flag_bits & 1
                    or item.file_size > MAX_IMAGE_BYTES
                    or item.file_size > max(item.compress_size, 1) * 2000
                ):
                    raise PackageError("Package contains an unsafe or oversized entry")
            if not {"manifest.json", "style.json", "SKILL.md"}.issubset(names):
                raise PackageError("Package requires manifest.json, style.json, and SKILL.md")
            if (
                z.getinfo("manifest.json").file_size > 64_000
                or z.getinfo("style.json").file_size > 2_000_000
            ):
                raise PackageError("Package metadata is too large")
            manifest = Manifest.model_validate_json(z.read("manifest.json"))
            p = StyleProfile.model_validate_json(z.read("style.json"))
            expected = {"manifest.json", "style.json", "SKILL.md"} | {
                a.path for a in manifest.assets
            }
            if set(names) != expected or len(manifest.assets) != len(p.reference_ids):
                raise PackageError("Package contains unlisted files or missing references")
            if {a.id for a in manifest.assets} != set(p.reference_ids):
                raise PackageError("Manifest references do not match profile")
            payloads = []
            for item in manifest.assets:
                if item.path != f"references/{item.id}.png":
                    raise PackageError("Reference path does not match its ID")
                content = z.read(item.path)
                if hashlib.sha256(content).hexdigest() != item.sha256:
                    raise PackageError("Reference checksum mismatch")
                payloads.append((item, content))

        # Do not extract attacker paths. Every asset goes through normal validation.
        with library.lock:
            mapping = {}
            for item, content in payloads:
                imported = assets.import_image(content, item.filename)
                created.append(imported.id)
                mapping[item.id] = imported.id
            p.id = uuid4().hex
            p.reference_ids = [mapping[ref] for ref in p.reference_ids]
            if p.analysis:
                for observation in p.analysis.observations:
                    if observation.reference_id not in mapping:
                        raise PackageError("Analysis references an unlisted asset")
                    observation.reference_id = mapping[observation.reference_id]
            return library.save(p, 0)
    except (
        zipfile.BadZipFile,
        KeyError,
        ValidationError,
        ImageError,
        OSError,
        RuntimeError,
        ValueError,
    ) as exc:
        for ref_id in created:
            assets.remove(ref_id)
        if isinstance(exc, PackageError):
            raise
        raise PackageError(
            "Invalid style package: check its format, schema, and reference images"
        ) from exc
