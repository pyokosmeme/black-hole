"""Convert the extracted CHOMP camouflage to a smaller browser texture.

Run after extract-chomp-assets.cjs with Python and Pillow. The PNG here is a
generated intermediate; the original remains in CHOMP/CHOMP_cic.zip.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "models/chomp/chomp_camo.png"
target = root / "models/chomp/chomp_camo.webp"
if not source.is_file():
    raise SystemExit(f"Missing generated intermediate: {source}")
with Image.open(source) as image:
    image = image.convert("RGB")
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    image.save(target, "WEBP", quality=88, method=6)
    print(f"CHOMP texture: {image.width}x{image.height}, {target.stat().st_size} bytes")
source.unlink()
