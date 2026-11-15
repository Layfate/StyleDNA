import asyncio
import io
import json
import warnings
import zipfile

import httpx
import pytest
from test_api import client_for


def test_normalized_reference_size_is_bounded_and_atomic(tmp_path, monkeypatch):
    import random

    import styledna.assets as module
    from PIL import Image

    encoded = io.BytesIO()
    Image.frombytes("RGB", (64, 64), random.Random(1).randbytes(64 * 64 * 3)).save(
        encoded, "JPEG", quality=20
    )
    monkeypatch.setattr(module, "MAX_IMAGE_BYTES", len(encoded.getvalue()) + 1)
    with pytest.raises(module.ImageError, match="normalized|20 MiB"):
        module.AssetStore(tmp_path).import_image(encoded.getvalue(), "reference.jpg")
    assert list((tmp_path / "assets").iterdir()) == []


def test_palette_input_does_not_create_unbounded_compiler_output():
    from pydantic import ValidationError
    from styledna.models import StyleProfile

    with pytest.raises(ValidationError):
        StyleProfile(name="large", positive_rules=["x" * 501])


def test_duplicate_zip_entries_rejected(tmp_path):
    from styledna.assets import AssetStore
    from styledna.database import Library
    from styledna.packages import PackageError, import_package

    out = io.BytesIO()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        with zipfile.ZipFile(out, "w") as z:
            z.writestr("manifest.json", "{}")
            z.writestr("manifest.json", "{}")
    assets = AssetStore(tmp_path)
    library = Library(tmp_path, assets)
    with pytest.raises(PackageError, match="duplicate"):
        import_package(library, assets, out.getvalue())
    assert library.list()["total"] == 0


def test_expanded_zip_limit_enforced_before_asset_writes(tmp_path, monkeypatch):
    import styledna.packages as module
    from styledna.assets import AssetStore
    from styledna.database import Library

    monkeypatch.setattr(module, "MAX_PACKAGE_BYTES", 1024)
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", "x" * 2000)
    assets = AssetStore(tmp_path)
    with pytest.raises(module.PackageError, match="Expanded"):
        module.import_package(Library(tmp_path, assets), assets, out.getvalue())


def test_cloud_routed_ollama_model_is_never_sent_an_image(tmp_path):
    from styledna.assets import AssetStore
    from styledna.ollama import OllamaProvider, ProviderError

    paths = []

    def handler(request):
        paths.append(request.url.path)
        if request.url.path == "/api/tags":
            return httpx.Response(
                200, json={"models": [{"name": "proxy-model", "remote_host": "cloud"}]}
            )
        if request.url.path == "/api/show":
            return httpx.Response(200, json={"capabilities": ["vision"], "remote_host": "cloud"})
        raise AssertionError("No inference request is allowed")

    provider = OllamaProvider(transport=httpx.MockTransport(handler))
    with pytest.raises(ProviderError, match="Cloud"):
        asyncio.run(provider.analyze(AssetStore(tmp_path), [], "proxy-model"))
    assert paths == ["/api/show"]


def test_request_json_limit_is_lower_than_image_upload_limit(tmp_path):
    with client_for(tmp_path) as client:
        result = client.post(
            "/api/preview",
            content=json.dumps({"name": "x"}),
            headers={"Content-Type": "application/json", "Content-Length": str(3 * 1024**2)},
        )
        assert result.status_code == 413


def test_stale_analysis_references_are_rejected_before_saving(tmp_path):
    from styledna.models import StyleProfile

    with client_for(tmp_path) as client:
        profile = StyleProfile().model_dump()
        profile["analysis"] = {
            "mode": "measurements",
            "observations": [
                {
                    "reference_id": "a" * 32,
                    "measurements": {
                        "palette": [],
                        "luminance": 0,
                        "saturation": 0,
                        "contrast": 0,
                        "edge_density": 0,
                        "texture": 0,
                    },
                }
            ],
        }
        result = client.post("/api/skills", json={"profile": profile, "expected_revision": 0})
        assert result.status_code == 422
        assert client.get("/api/skills").json()["total"] == 0
