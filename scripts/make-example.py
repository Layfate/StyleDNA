"""Create a deterministic, manually authored MIT-licensed example, not AI output."""

import io
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw
from styledna.analysis import analyze_measurements
from styledna.assets import AssetStore
from styledna.database import Library
from styledna.models import StyleProfile, Trait
from styledna.packages import export_package

output = Path(__file__).resolve().parent.parent / "examples"
output.mkdir(exist_ok=True)
image = Image.new("RGB", (800, 1000), "#DCD0B8")
draw = ImageDraw.Draw(image)
draw.ellipse((570, 90, 680, 200), fill="#F1E8D7")
draw.rounded_rectangle((95, 220, 610, 1080), radius=255, fill="#A76540")
draw.rounded_rectangle((225, 340, 555, 1120), radius=165, fill="#DEB477")
draw.ellipse((-200, 800, 1100, 1250), fill="#505442")
draw.line((400, 950, 400, 485), fill="#2D4033", width=14)
draw.ellipse((255, 475, 400, 655), fill="#2D4033")
draw.ellipse((400, 600, 550, 785), fill="#2D4033")
draw.ellipse((275, 700, 400, 860), fill="#2D4033")
image.save(output / "amber-study.png")
buffer = io.BytesIO()
image.save(buffer, "PNG")
with tempfile.TemporaryDirectory() as root:
    assets = AssetStore(Path(root))
    library = Library(Path(root), assets)
    ref = assets.import_image(buffer.getvalue(), "amber-study.png")
    analysis = analyze_measurements(assets, [ref.id])
    profile = StyleProfile(
        name="Amber botanical study",
        description="A manually authored study of flat organic forms and a restrained earth palette.",
        category="Illustration",
        tags=["organic", "earth tones", "flat"],
        reference_ids=[ref.id],
        palette=analysis.palette,
        analysis=analysis,
        positive_rules=["Use broad, simplified organic forms", "Keep generous negative space"],
        negative_constraints=["Avoid glossy materials", "Avoid photographic detail"],
        subject_exclusions=["The new subject does not need arches, leaves, or a sun"],
    )
    profile.traits["lighting"] = Trait(
        value="Flat ambient illumination without directional shadows"
    )
    profile.traits["shapes"] = Trait(
        value="Rounded architectural masses balanced with simple organic forms"
    )
    profile.traits["rendering"] = Trait(value="Matte, flat color fields with clean silhouettes")
    saved = library.save(profile, 0)
    (output / "amber-study.zip").write_bytes(export_package(library, assets, profile.id))
    (output / "SKILL.md").write_text(saved["markdown"], encoding="utf-8")
    (output / "style.json").write_text(profile.model_dump_json(indent=2), encoding="utf-8")
print("Created the MIT-licensed synthetic amber study and portable package.")
