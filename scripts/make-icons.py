"""Convert the supplied StyleDNA logo into desktop and browser icon sizes."""

from pathlib import Path

from PIL import Image

project = Path(__file__).resolve().parent.parent
source = project / "assets/branding/styledna-logo.png"
output = project / "src-tauri/icons"
public = project / "public"
output.mkdir(exist_ok=True)
public.mkdir(exist_ok=True)

with Image.open(source) as original:
    image = original.convert("RGBA")
    if image.width != image.height:
        raise ValueError("The source logo must be square; do not stretch or crop the artwork")
    for size, name in ((32, "32x32.png"), (128, "128x128.png"), (256, "128x128@2x.png")):
        image.resize((size, size), Image.Resampling.LANCZOS).save(output / name)
    image.save(
        output / "icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    image.save(output / "icon.icns", sizes=[(128, 128), (256, 256), (512, 512), (1024, 1024)])
    image.resize((32, 32), Image.Resampling.LANCZOS).save(public / "favicon.png")
print("Generated desktop icons and favicon from the supplied logo, preserving transparency.")
