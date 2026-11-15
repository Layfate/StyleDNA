import io
import random

import pytest
from PIL import Image


def noisy_reference(store, seed):
    data = io.BytesIO()
    Image.frombytes("RGB", (64, 64), random.Random(seed).randbytes(64 * 64 * 3)).save(data, "PNG")
    return store.import_image(data.getvalue(), "noise.png")


def test_save_rejects_unexportable_reference_collection_without_changing_revision(
    tmp_path, monkeypatch
):
    import styledna.database as module
    from styledna.assets import AssetStore
    from styledna.models import StyleProfile

    store = AssetStore(tmp_path)
    library = module.Library(tmp_path, store)
    refs = [noisy_reference(store, i) for i in range(3)]
    profile = StyleProfile(name="Within budget", reference_ids=[r.id for r in refs[:2]])
    monkeypatch.setattr(module, "MAX_PACKAGE_BYTES", 100_000, raising=False)
    library.save(profile, 0)
    with pytest.raises(ValueError, match="package|budget"):
        library.save(profile.model_copy(update={"reference_ids": [r.id for r in refs]}), 1)
    assert library.get(profile.id)["revision"] == 1
    assert len(library.get(profile.id)["profile"]["reference_ids"]) == 2


def test_export_checks_aggregate_expanded_budget_for_existing_skills(tmp_path, monkeypatch):
    import styledna.packages as module
    from styledna.assets import AssetStore
    from styledna.database import Library
    from styledna.models import StyleProfile

    store = AssetStore(tmp_path)
    library = Library(tmp_path, store)
    refs = [noisy_reference(store, i) for i in range(3)]
    profile = StyleProfile(reference_ids=[r.id for r in refs])
    library.save(profile, 0)
    monkeypatch.setattr(module, "MAX_PACKAGE_BYTES", 30_000)
    with pytest.raises(module.PackageError, match="package|budget"):
        module.export_package(library, store, profile.id)
