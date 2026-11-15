"""Render StyleDNA's code-native DNA mark into desktop icon formats."""

import math
from pathlib import Path

from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent / "src-tauri" / "icons"
root.mkdir(exist_ok=True)
image = Image.new("RGBA", (1024, 1024))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((20, 20, 1004, 1004), radius=230, fill="#171a15")
draw.rounded_rectangle((45, 45, 979, 979), radius=210, outline="#5c523a", width=7)
curves = [[], []]
for y in range(225, 801):
    phase = (y - 225) / 575 * 2 * math.pi
    x = 512 + 170 * math.sin(phase)
    curves[0].append((x, y))
    curves[1].append((1024 - x, y))
for i in range(35, 550, 70):
    draw.line((curves[0][i], curves[1][i]), fill="#857854", width=14)
for curve in curves:
    draw.line(curve, fill="#ddbc7d", width=33)
for size, name in ((32, "32x32.png"), (128, "128x128.png"), (256, "128x128@2x.png")):
    image.resize((size, size), Image.Resampling.LANCZOS).save(root / name)
image.save(
    root / "icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
)
image.save(root / "icon.icns", sizes=[(128, 128), (256, 256), (512, 512), (1024, 1024)])
print("Created desktop DNA icons.")
