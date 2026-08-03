"""Generate the seamlessly-tiling SVG water tiles the hero needs.

Image generators can't be trusted to produce a tile whose right edge meets its
left edge, and a visible seam scrolling past every 20s is the sort of thing you
only notice after launch. These are built from sine sums whose periods divide
the tile width exactly, so continuity is guaranteed by construction, then
quantised into blocks to keep the pixel-art read.
"""

import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DST = ROOT / "public"


def ridge_path(width: int, height: int, block: int, waves, base: float) -> str:
    """Stepped silhouette filled to the bottom edge. Periodic by construction."""
    cols = width // block
    pts = []
    for c in range(cols + 1):
        x = c * block
        y = base
        for amp, periods, phase in waves:
            y += amp * math.sin(2 * math.pi * periods * (x / width) + phase)
        y = max(0, min(height, round(y / block) * block))
        pts.append((x, y))

    d = [f"M0,{height}", f"L0,{pts[0][1]}"]
    for i, (x, y) in enumerate(pts):
        if i > 0:
            d.append(f"L{x},{pts[i - 1][1]}")
        d.append(f"L{x},{y}")
    d.append(f"L{width},{height}")
    d.append("Z")
    return " ".join(d)


def write_ridge(name: str, width: int, height: int, block: int, waves, base, fill: str):
    path = ridge_path(width, height, block, waves, base)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" preserveAspectRatio="none" '
        f'shape-rendering="crispEdges">'
        f'<path d="{path}" fill="{fill}"/></svg>'
    )
    (DST / name).write_text(svg, encoding="utf-8")
    return len(svg)


def write_water(name: str, width: int, height: int, block: int, rows, seed: int):
    """Horizontal glint dashes. Every dash sits wholly inside the tile, so the
    repeat is seamless without needing wrap-around halves."""
    rng = random.Random(seed)
    parts = []
    for row_y, count, colour, opacity, wmin, wmax in rows:
        y = round(row_y / block) * block
        used = []
        for _ in range(count):
            w = rng.randint(wmin, wmax) * block
            for _ in range(24):  # retry until it lands in a free slot
                x = rng.randrange(0, (width - w) // block + 1) * block
                if all(x + w + block <= a or x >= b + block for a, b in used):
                    used.append((x, x + w))
                    parts.append(
                        f'<rect x="{x}" y="{y}" width="{w}" height="{block}" '
                        f'fill="{colour}" opacity="{opacity}"/>'
                    )
                    break
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" shape-rendering="crispEdges">'
        + "".join(parts)
        + "</svg>"
    )
    (DST / name).write_text(svg, encoding="utf-8")
    return len(svg)


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    out = []

    # Water shimmer, overlaid on the backdrop's own waterline. Back is a dark
    # ripple, front is bright glints; they scroll opposite ways.
    out.append(("water-back.svg", write_water(
        "water-back.svg", 1400, 120, 4,
        rows=[
            (12, 26, "#15498C", "0.55", 3, 11),
            (32, 22, "#15498C", "0.45", 4, 14),
            (56, 20, "#15498C", "0.38", 5, 16),
            (84, 16, "#15498C", "0.30", 6, 18),
        ],
        seed=7,
    )))
    out.append(("water-front.svg", write_water(
        "water-front.svg", 1100, 96, 4,
        rows=[
            (8, 20, "#CFE7FA", "0.75", 2, 8),
            (28, 18, "#FFFFFF", "0.65", 2, 7),
            (52, 15, "#CFE7FA", "0.50", 3, 10),
            (76, 12, "#FFFFFF", "0.40", 2, 9),
        ],
        seed=19,
    )))

    for name, size in out:
        print(f"{name:<26} {size:>6} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
