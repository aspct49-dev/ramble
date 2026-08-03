"""Flatten each sprite to a tight palette.

The generator baked soft gradients into fills that should be flat, which both
bloats the PNGs and softens the pixel-art read. Quantising the colour channel
while leaving the (already hard) alpha alone fixes both.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DST = ROOT / "public"

# Colour budget per sprite, chosen from how much real detail each one carries.
BUDGET = {
    "petal-1.png": 6,
    "petal-2.png": 6,
    "drift-1.png": 8,
    "drift-2.png": 8,
    "drift-3.png": 8,
    "drift-4.png": 8,
    "pine-left.png": 10,
    "pine-right.png": 10,
    "pagoda.png": 20,
    "lb-frame-crown.png": 24,
    "lb-frame-plain.png": 20,
    "splash-torii.png": 14,
    "splash-lantern.png": 14,
}


def flatten(path: Path, colors: int) -> tuple[int, int, int]:
    before = path.stat().st_size
    a = np.array(Image.open(path).convert("RGBA"))
    rgb, alpha = a[..., :3], a[..., 3]
    opaque = alpha > 0

    # Quantise only the visible pixels, so transparent filler can't win a slot
    # in the palette.
    flat = Image.fromarray(rgb).quantize(
        colors=colors, method=Image.MEDIANCUT, dither=Image.NONE
    ).convert("RGB")
    out_rgb = np.array(flat)
    out_rgb[~opaque] = 0

    out = Image.fromarray(np.dstack([out_rgb, alpha]), "RGBA")
    out.save(path, optimize=True)

    n = len(np.unique(np.array(out)[opaque].reshape(-1, 4), axis=0))
    return before, path.stat().st_size, n


def main() -> int:
    tb = ta = 0
    for name, colors in BUDGET.items():
        p = DST / name
        if not p.exists():
            print(f"{name:<22} MISSING")
            continue
        before, after, n = flatten(p, colors)
        tb += before
        ta += after
        print(f"{name:<22} {before/1024:>7.1f}KB -> {after/1024:>6.1f}KB   {n:>3} colors")
    print(f"\nsprites {tb/1024:.0f}KB -> {ta/1024:.0f}KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
