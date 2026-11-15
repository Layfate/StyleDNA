import io

import pytest
import yaml
from PIL import Image
from pydantic import ValidationError


def image_bytes(color="red", size=(64, 32), fmt="PNG"):
    out = io.BytesIO()
    Image.new("RGB", size, color).save(out, fmt)
    return out.getvalue()


def test_import_uses_decoded_content_not_filename(tmp_path):
    from styledna.assets import AssetStore

    store = AssetStore(tmp_path)
    ref = store.import_image(image_bytes(), "misleading.exe")
    assert (ref.width, ref.height, ref.format) == (64, 32, "PNG")
    assert store.path(ref.id).is_file()
    assert store.path(ref.id, "thumbnail").is_file()
    assert ref.filename == "misleading.exe"
    assert "exif" not in Image.open(store.path(ref.id)).info


def test_corrupt_image_leaves_no_asset(tmp_path):
    from styledna.assets import AssetStore, ImageError

    store = AssetStore(tmp_path)
    with pytest.raises(ImageError, match="valid|supported"):
        store.import_image(b"not an image", "pretty.png")
    assert list((tmp_path / "assets").glob("*")) == []


def test_animated_webp_is_rejected(tmp_path):
    from styledna.assets import AssetStore, ImageError

    data = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(
        data, "WEBP", save_all=True, append_images=[Image.new("RGB", (8, 8), "blue")]
    )
    with pytest.raises(ImageError, match="[Aa]nimated"):
        AssetStore(tmp_path).import_image(data.getvalue(), "animated.webp")


def test_pixel_limit_is_enforced_before_decoding(tmp_path, monkeypatch):
    import styledna.assets as assets

    monkeypatch.setattr(assets, "MAX_PIXELS", 100)
    with pytest.raises(assets.ImageError, match="pixel"):
        assets.AssetStore(tmp_path).import_image(image_bytes(size=(11, 10)), "big.png")


def test_asset_id_cannot_escape_root(tmp_path):
    from styledna.assets import AssetStore, ImageError

    with pytest.raises(ImageError):
        AssetStore(tmp_path).path("../../outside")


def test_measurement_is_real_and_does_not_invent_semantics(tmp_path):
    from styledna.analysis import analyze_measurements
    from styledna.assets import AssetStore

    store = AssetStore(tmp_path)
    ref = store.import_image(image_bytes(), "red.png")
    result = analyze_measurements(store, [ref.id])
    assert result.palette[0].hex == "#FF0000"
    assert result.palette[0].share == pytest.approx(1.0)
    assert result.observations[0].measurements.saturation == pytest.approx(1.0)
    assert result.observations[0].measurements.contrast == pytest.approx(0.0)
    assert all(not trait.value for trait in result.traits.values())
    assert result.mode == "measurements"


def test_multi_reference_palette_is_equal_weighted(tmp_path):
    from styledna.analysis import analyze_measurements
    from styledna.assets import AssetStore

    store = AssetStore(tmp_path)
    a = store.import_image(image_bytes("red", (10, 10)), "a.png")
    b = store.import_image(image_bytes("blue", (100, 100)), "b.png")
    result = analyze_measurements(store, [a.id, b.id])
    colors = {c.hex: c.share for c in result.palette}
    assert colors["#FF0000"] == pytest.approx(0.5)
    assert colors["#0000FF"] == pytest.approx(0.5)


def test_profile_rejects_untrusted_fields_and_invalid_palette():
    from styledna.models import StyleProfile

    with pytest.raises(ValidationError):
        StyleProfile.model_validate({"name": "test", "run_command": "echo pwned"})
    with pytest.raises(ValidationError):
        StyleProfile.model_validate({"palette": [{"hex": "javascript:bad", "share": 1}]})


def test_compiler_escapes_frontmatter_and_separates_subject_rules():
    from styledna.compiler import compile_skill
    from styledna.models import StyleProfile

    profile = StyleProfile(
        name='Night: "Garden"\nnew: key',
        description="A style\n---\n<script>alert(1)</script>",
        positive_rules=["Use soft light"],
        subject_exclusions=["Do not require the original flower subject"],
    )
    content = compile_skill(profile)
    header = yaml.safe_load(content.split("\n---\n", 1)[0].removeprefix("---\n"))
    assert header["name"] == "night-garden-new-key"
    assert header["description"] == profile.description
    assert "## Subject independence" in content
    assert "Do not require the original flower subject" in content
    assert "<script>" not in content
    assert "exact reproduction" in content
    assert compile_skill(profile) == content
