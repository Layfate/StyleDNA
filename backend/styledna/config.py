from pathlib import Path

from platformdirs import user_data_dir

MAX_IMAGE_BYTES = 20 * 1024 * 1024
MAX_PIXELS = 40_000_000
MAX_REFERENCES = 20
MAX_UPLOAD_BYTES = 200 * 1024 * 1024
MAX_PACKAGE_BYTES = 250 * 1024 * 1024
MAX_STORAGE_BYTES = 5 * 1024**3
PREVIEW_SIZE = 2048
THUMBNAIL_SIZE = 320


def default_data_dir() -> Path:
    return Path(user_data_dir("StyleDNA", appauthor=False))
