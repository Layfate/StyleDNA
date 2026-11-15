from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from .assets import AssetStore
from .models import AnalysisResult, Measurements, PaletteColor, ReferenceObservation

cv2.setNumThreads(1)


def measure(path: Path) -> Measurements:
    with Image.open(path) as source:
        rgba = source.convert("RGBA")
        # A fixed white matte makes transparency measurements reproducible.
        rgb = Image.new("RGBA", rgba.size, "white")
        rgb.alpha_composite(rgba)
        rgb = rgb.convert("RGB")
        rgb.thumbnail((256, 256))
        quantized = rgb.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
        counts = sorted(quantized.getcolors() or [], reverse=True)
        raw_palette = quantized.getpalette()
        total = rgb.width * rgb.height
        palette = [
            PaletteColor(
                hex="#" + "".join(f"{v:02X}" for v in raw_palette[index * 3 : index * 3 + 3]),
                share=count / total,
            )
            for count, index in counts
        ]
        pixels = np.asarray(rgb)
    gray = cv2.cvtColor(pixels, cv2.COLOR_RGB2GRAY)
    hsv = cv2.cvtColor(pixels, cv2.COLOR_RGB2HSV)
    return Measurements(
        palette=palette,
        luminance=float(np.mean(gray) / 255),
        saturation=float(np.mean(hsv[:, :, 1]) / 255),
        contrast=float(np.std(gray) / 255),
        edge_density=float(np.count_nonzero(cv2.Canny(gray, 80, 160)) / gray.size),
        texture=float(cv2.Laplacian(gray, cv2.CV_64F).var()),
    )


def analyze_measurements(store: AssetStore, reference_ids: list[str]) -> AnalysisResult:
    if not reference_ids:
        raise ValueError("Add at least one reference image")
    observations = [
        ReferenceObservation(
            reference_id=ref_id, measurements=measure(store.path(ref_id, "preview"))
        )
        for ref_id in reference_ids
    ]
    colors: dict[str, float] = {}
    for observation in observations:
        for color in observation.measurements.palette:
            colors[color.hex] = colors.get(color.hex, 0) + color.share / len(observations)
    top = sorted(colors.items(), key=lambda item: (-item[1], item[0]))[:12]
    total = sum(share for _, share in top)
    return AnalysisResult(
        mode="measurements",
        observations=observations,
        palette=[PaletteColor(hex=color, share=share / total) for color, share in top],
    )
