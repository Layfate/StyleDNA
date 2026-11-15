import io
import json
import zipfile

import pytest
from test_core import image_bytes


def test_persistence_revision_conflict_and_restore(tmp_path):
    from styledna.assets import AssetStore
    from styledna.database import ConflictError, Library
    from styledna.models import StyleProfile

    store = AssetStore(tmp_path)
    lib = Library(tmp_path, store)
    profile = StyleProfile(name="First style")
    first = lib.save(profile, 0)
    changed = profile.model_copy(update={"name": "Changed"})
    second = lib.save(changed, 1)
    assert first["revision"] == 1 and second["revision"] == 2
    with pytest.raises(ConflictError):
        lib.save(profile, 1)
    reopened = Library(tmp_path, store)
    assert reopened.get(profile.id)["profile"]["name"] == "Changed"
    restored = reopened.restore(profile.id, 1, 2)
    assert restored["revision"] == 3
    assert restored["profile"]["name"] == "First style"
    assert len(reopened.revisions(profile.id)) == 3


def test_search_filters_and_shared_asset_lifetime(tmp_path):
    from styledna.assets import AssetStore
    from styledna.database import Library
    from styledna.models import StyleProfile

    store = AssetStore(tmp_path)
    ref = store.import_image(image_bytes(), "red.png")
    lib = Library(tmp_path, store)
    p = StyleProfile(
        name="100% red",
        tags=["warm"],
        category="Illustration",
        favorite=True,
        reference_ids=[ref.id],
    )
    lib.save(p, 0)
    lib.save(StyleProfile(name="Unrelated"), 0)
    assert lib.list(query="%")["total"] == 1
    assert lib.list(query="warm", favorite=True, category="Illustration")["total"] == 1
    duplicate = lib.duplicate(p.id)
    lib.delete(p.id)
    assert store.path(ref.id).exists()
    lib.delete(duplicate["profile"]["id"])
    assert not store.path(ref.id).exists()


def test_reference_removed_from_current_revision_survives_history(tmp_path):
    from styledna.assets import AssetStore
    from styledna.database import Library
    from styledna.models import StyleProfile

    store = AssetStore(tmp_path)
    ref = store.import_image(image_bytes(), "red.png")
    lib = Library(tmp_path, store)
    p = StyleProfile(reference_ids=[ref.id])
    lib.save(p, 0)
    lib.save(p.model_copy(update={"reference_ids": []}), 1)
    assert store.path(ref.id).exists()
    restored = lib.restore(p.id, 1, 2)
    assert restored["profile"]["reference_ids"] == [ref.id]


def test_package_roundtrip_preserves_content_with_new_identity(tmp_path):
    from styledna.assets import AssetStore
    from styledna.database import Library
    from styledna.models import StyleProfile
    from styledna.packages import export_package, import_package

    assets = AssetStore(tmp_path)
    lib = Library(tmp_path, assets)
    ref = assets.import_image(image_bytes("blue"), "reference.png")
    p = StyleProfile(name="Blue ink", reference_ids=[ref.id], tags=["ink"])
    original = lib.save(p, 0)
    data = export_package(lib, assets, p.id)
    imported = import_package(lib, assets, data)
    assert imported["profile"]["id"] != p.id
    assert imported["profile"]["name"] == "Blue ink"
    new_ref = imported["profile"]["reference_ids"][0]
    assert assets.get(new_ref).sha256 == ref.sha256
    assert f"references/{new_ref}.png" in imported["markdown"]
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert z.read("SKILL.md").decode() == original["markdown"]


@pytest.mark.parametrize(
    "name", ["../evil.png", "/evil.png", "C:/evil.png", "references\\evil.png"]
)
def test_package_rejects_unsafe_paths_and_leaves_no_skill(tmp_path, name):
    from styledna.assets import AssetStore
    from styledna.database import Library
    from styledna.packages import PackageError, import_package

    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as z:
        z.writestr(name, b"bad")
    assets = AssetStore(tmp_path)
    lib = Library(tmp_path, assets)
    with pytest.raises(PackageError):
        import_package(lib, assets, out.getvalue())
    assert lib.list()["total"] == 0
    assert list(assets.root.iterdir()) == []


def test_package_bad_hash_and_extra_entries_are_atomic(tmp_path):
    from styledna.assets import AssetStore
    from styledna.database import Library
    from styledna.models import StyleProfile
    from styledna.packages import PackageError, export_package, import_package

    assets = AssetStore(tmp_path)
    lib = Library(tmp_path, assets)
    ref = assets.import_image(image_bytes(), "ref.png")
    p = StyleProfile(reference_ids=[ref.id])
    lib.save(p, 0)
    data = export_package(lib, assets, p.id)
    for extra in (False, True):
        out = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(data)) as original, zipfile.ZipFile(out, "w") as z:
            for item in original.infolist():
                payload = original.read(item.filename)
                if item.filename.endswith(".png") and not extra:
                    payload = image_bytes("green")
                z.writestr(item.filename, payload)
            if extra:
                z.writestr("surprise.txt", "no")
        with pytest.raises(PackageError):
            import_package(lib, assets, out.getvalue())
        assert lib.list()["total"] == 1
        assert len(list(assets.root.iterdir())) == 1


def test_package_rejects_duplicate_symlink_and_unknown_schema(tmp_path):
    from styledna.assets import AssetStore
    from styledna.database import Library
    from styledna.packages import PackageError, import_package

    assets = AssetStore(tmp_path)
    lib = Library(tmp_path, assets)
    for kind in ("symlink", "schema"):
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w") as z:
            if kind == "symlink":
                entry = zipfile.ZipInfo("manifest.json")
                entry.create_system = 3
                entry.external_attr = 0o120777 << 16
                z.writestr(entry, "target")
            else:
                z.writestr("manifest.json", json.dumps({"package_version": 999}))
                z.writestr("style.json", "{}")
                z.writestr("SKILL.md", "ignored")
        with pytest.raises(PackageError):
            import_package(lib, assets, out.getvalue())
