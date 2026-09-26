#!/usr/bin/env python3
"""Derive the browser icon set from the photographic favicon master.

The master (src/assets/favicon/john-cowin-favicon-master.png) is a square portrait with the
subject inside an inscribed circle. Everything outside that circle becomes
transparent, so the icon reads as a circular portrait on any tab color and
never sits in a colored box.

The master lives outside public/ so the full-resolution file is not shipped to
visitors; only the derived icons are.

Small sizes crop tighter than large ones. At 16 and 32 pixels a full head and
shoulders turns to mush, so those sizes zoom to the head and are lightly
sharpened after resampling. The circular crop is preserved at every size.

Usage:  python3 scripts/icons.py
Requires Pillow. favicon.ico is packed from the 16 / 32 / 48 results.
"""

import pathlib
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
MASTER = ROOT / "src" / "assets" / "favicon" / "john-cowin-favicon-master.png"
OUT = ROOT / "public"

# Geometry of the circle inside the master, measured from the source.
CENTER = (623, 623)
RADIUS = 619
# The head sits slightly above the circle's center, so tight crops recenter here.
FOCUS = (627, 560)

# name, pixel size, crop factor (share of the circle's diameter kept), sharpen
TARGETS = [
    ("icon-512.png", 512, 1.0, False),
    ("icon-192.png", 192, 1.0, False),
    ("apple-touch-icon.png", 180, 1.0, False),
    ("favicon-48.png", 48, 0.80, True),
    ("favicon-32.png", 32, 0.70, True),
    ("favicon-16.png", 16, 0.60, True),
]

SS = 8  # supersampling factor for the circular mask edge


def circular(src: Image.Image, size: int, factor: float, sharpen: bool) -> Image.Image:
    diameter = RADIUS * 2
    side = round(diameter * factor)
    if factor >= 1.0:
        cx, cy = CENTER
    else:
        cx, cy = FOCUS
    box = (
        round(cx - side / 2),
        round(cy - side / 2),
        round(cx + side / 2),
        round(cy + side / 2),
    )
    crop = src.crop(box)

    big = size * SS
    crop = crop.resize((big, big), Image.LANCZOS)

    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)

    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    out.paste(crop.convert("RGB"), (0, 0), mask)
    out = out.resize((size, size), Image.LANCZOS)

    if sharpen:
        rgb = out.convert("RGB").filter(ImageFilter.UnsharpMask(radius=0.7, percent=110, threshold=2))
        out = Image.merge("RGBA", (*rgb.split(), out.getchannel("A")))
    return out



if __name__ == "__main__":
    src = Image.open(MASTER).convert("RGB")
    made = {}
    for name, size, factor, sharpen in TARGETS:
        img = circular(src, size, factor, sharpen)
        img.save(OUT / name, optimize=True)
        made[size] = img
        print("icon", name, f"{size}x{size}")

    ico = [made[48], made[32], made[16]]
    ico[0].save(OUT / "favicon.ico", format="ICO", sizes=[(48, 48), (32, 32), (16, 16)])
    print("icon favicon.ico 48/32/16")
