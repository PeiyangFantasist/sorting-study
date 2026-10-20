from pathlib import Path
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parent / "assets" / "sorting.ico"
out.parent.mkdir(parents=True, exist_ok=True)
image = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((8, 8, 248, 248), radius=63, fill="#246a55")
for x, y in [(66, 139), (117, 101), (168, 61)]:
    draw.rounded_rectangle((x, y, x + 23, 194), radius=11, fill="#f0f5dc")
image.save(out, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("App icon created")
