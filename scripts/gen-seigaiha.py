"""Seamless seigaiha (青海波) wave tile, in the site's pixel-art idiom.

The classic Japanese overlapping-wave motif: rows of concentric fans, each row
offset half a fan and overlapping the one above. The lattice has period R in
both axes, so cropping any R x R region yields a tile that repeats seamlessly —
no edge matching needed.

White on transparency, so CSS can tint it over any surface.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DST = ROOT / "public"

R = 24          # fan radius, in grid units — also the tile period
RINGS = 8       # thin alternating bands — only the fan's outer
                # third is ever visible, so thick rings read as flat wedges
SCALE = 4       # nearest-neighbour upscale


def build(light=200, dark=64) -> Image.Image:
    span = 3 * R
    canvas = np.zeros((span, span), dtype=np.uint8)
    yy, xx = np.mgrid[0:span, 0:span]

    # Rows run top to bottom so lower fans overlap the ones above, which is
    # what gives seigaiha its layered, scale-like read.
    row = 0
    cy = -R
    while cy <= span + R:
        offset = (row % 2) * (R / 2)
        cx = -R + offset
        while cx <= span + R:
            d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
            fan = (d <= R) & (yy <= cy)
            if fan.any():
                band = np.clip((d / (R / RINGS)).astype(int), 0, RINGS - 1)
                canvas[fan & (band % 2 == 0)] = light
                canvas[fan & (band % 2 == 1)] = dark
            cx += R
        cy += R / 2
        row += 1

    # Any R x R window tiles; take one from the middle, clear of the edges.
    tile = canvas[R:2 * R, R:2 * R]
    rgba = np.zeros((R, R, 4), dtype=np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = tile
    im = Image.fromarray(rgba, "RGBA")
    return im.resize((R * SCALE, R * SCALE), Image.NEAREST)


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    im = build()
    out = DST / "seigaiha.png"
    im.save(out, optimize=True)
    print(f"seigaiha.png  {im.width}x{im.height}  {out.stat().st_size / 1024:.1f}KB")

    # Prove the repeat exactly, by construction rather than by eye: the
    # lattice has period R in both axes, so a shifted crop must be
    # bit-identical. A luminance heuristic gives false positives here, because
    # the motif is all hard arc edges and any single join looks "steep"
    # against an average that includes flat interior rows.
    span = 3 * R
    canvas = np.zeros((span, span), dtype=np.uint8)
    yy, xx = np.mgrid[0:span, 0:span]
    row, cy = 0, -R
    while cy <= span + R:
        cx = -R + (row % 2) * (R / 2)
        while cx <= span + R:
            d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
            fan = (d <= R) & (yy <= cy)
            if fan.any():
                band = np.clip((d / (R / RINGS)).astype(int), 0, RINGS - 1)
                canvas[fan & (band % 2 == 0)] = 200
                canvas[fan & (band % 2 == 1)] = 64
            cx += R
        cy += R / 2
        row += 1
    base = canvas[R:2 * R, R:2 * R]
    across = np.array_equal(base, canvas[R:2 * R, 2 * R:3 * R])
    down = np.array_equal(base, canvas[2 * R:3 * R, R:2 * R])
    print(f"tiles seamlessly: horizontally={across}  vertically={down}")
    return 0 if (across and down) else 1


if __name__ == "__main__":
    sys.exit(main())
