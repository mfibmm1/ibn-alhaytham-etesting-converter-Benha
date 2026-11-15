#!/usr/bin/env python3
"""Cut the white logo box out of the "Designed by" screenshot.
Usage: python3 tools/crop_logo.py path/to/screenshot.png
"""
import sys
from pathlib import Path
from PIL import Image

im = Image.open(sys.argv[1]).convert("RGBA")
px = im.load()
W, H = im.size
# bright pixels in the left part of the image = the white logo box
pts = [(x, y) for x in range(min(85, W)) for y in range(H) if sum(px[x, y][:3]) > 600]
xs, ys = [p[0] for p in pts], [p[1] for p in pts]
out = Path(__file__).resolve().parent.parent / "assets" / "benha_logo.png"
im.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1)).save(out)
print("wrote", out)
