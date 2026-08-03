"""Condition raw generated pixel-art assets into web-ready sprites.

Reads originals from SRC (never modifies them) and writes to DST.

Per sprite: hard-threshold the alpha to kill the generator's bloom halo,
bleed opaque colour outward so resizing can't drag grey matte into the
edges, crop to the alpha bounding box, then downscale.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "design"
DST = ROOT / "public"

ALPHA_CUTOFF = 150  # below this the pixel is bloom, not art


def bleed(rgb: np.ndarray, solid: np.ndarray, rounds: int = 4) -> np.ndarray:
    """Push opaque colour into transparent pixels so a resize can't sample grey."""
    out = rgb.copy()
    known = solid.copy()
    for _ in range(rounds):
        if known.all():
            break
        acc = np.zeros_like(out, dtype=np.float32)
        hits = np.zeros(known.shape, dtype=np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(out, dy, 0), dx, 1).astype(np.float32)
            sk = np.roll(np.roll(known, dy, 0), dx, 1)
            acc += sh * sk[..., None]
            hits += sk
        fill = (~known) & (hits > 0)
        safe = np.where(hits[..., None] == 0, 1.0, hits[..., None])
        out[fill] = (acc / safe)[fill].astype(np.uint8)
        known |= fill
    return out


def condition(img: Image.Image, box, cutoff=ALPHA_CUTOFF) -> Image.Image:
    a = np.array(img.convert("RGBA"))
    rgb, alpha = a[..., :3], a[..., 3]

    solid = alpha >= cutoff
    if not solid.any():
        raise ValueError("nothing survived the alpha cutoff")

    rgb = bleed(rgb, solid)

    ys, xs = np.where(solid)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb = rgb[y0:y1, x0:x1]
    mask = solid[y0:y1, x0:x1]

    h, w = mask.shape
    tw, th = box
    scale = min(tw / w, th / h, 1.0)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))

    # Colour resamples smoothly; alpha is re-thresholded so edges stay hard.
    rgb_im = Image.fromarray(rgb).resize((nw, nh), Image.LANCZOS)
    a_im = Image.fromarray((mask * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)
    a_hard = (np.array(a_im) >= 128).astype(np.uint8) * 255

    out = np.dstack([np.array(rgb_im), a_hard])
    return Image.fromarray(out, "RGBA")


def split_columns(img: Image.Image, cutoff=ALPHA_CUTOFF):
    """Split a sheet into sprites on fully-empty column runs."""
    a = np.array(img.convert("RGBA"))
    occupied = (a[..., 3] >= cutoff).any(axis=0)
    spans, start = [], None
    for x, on in enumerate(occupied):
        if on and start is None:
            start = x
        elif not on and start is not None:
            spans.append((start, x))
            start = None
    if start is not None:
        spans.append((start, len(occupied)))
    return [img.crop((x0, 0, x1, img.height)) for x0, x1 in spans]


SPRITES = [
    # Leaderboard scroll cards. Width-led: the CSS sets width:100% and
    # height:auto, so the art's own aspect is what matters, not a fixed box.
    ("lb_scroll1.png", "lb-frame-crown.png", (520, 2000)),
    ("lb_scroll2.png", "lb-frame-plain.png", (520, 2000)),
    ("petal-1.png", "petal-1.png", (64, 64)),
    ("petal-2.png", "petal-2.png", (64, 64)),
    ("tree-1.png", "pine-left.png", (520, 900)),
    ("tree-2.png", "pine-right.png", (520, 900)),
    ("pagoda.png", "pagoda.png", (420, 620)),
    ("tori_gate.png", "splash-torii.png", (260, 260)),
    ("paper_lantern.png", "splash-lantern.png", (260, 260)),
]

BACKDROPS = [
    ("hero-backdrop.png", "hero-backdrop.webp", 1920),
    ("site-backdrop.png", "site-backdrop.webp", 1920),
]


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    total_in = total_out = 0

    for src_name, dst_name, box in SPRITES:
        src = SRC / src_name
        out = condition(Image.open(src), box)
        dst = DST / dst_name
        out.save(dst, optimize=True)
        a, b = src.stat().st_size, dst.stat().st_size
        total_in += a
        total_out += b
        print(f"{src_name:<20} -> {dst_name:<20} {out.width:>4}x{out.height:<4} "
              f"{a/1024:>7.0f}KB -> {b/1024:>6.1f}KB")

    sheet = SRC / "clouds.png"
    parts = split_columns(Image.open(sheet))
    total_in += sheet.stat().st_size
    print(f"{'clouds.png':<20} -> split into {len(parts)}")
    for i, part in enumerate(parts, 1):
        out = condition(part, (220, 120))
        dst = DST / f"drift-{i}.png"
        out.save(dst, optimize=True)
        b = dst.stat().st_size
        total_out += b
        print(f"{'':<20} -> {f'drift-{i}.png':<20} {out.width:>4}x{out.height:<4} "
              f"{'':>7}   {b/1024:>6.1f}KB")

    for src_name, dst_name, width in BACKDROPS:
        src = SRC / src_name
        im = Image.open(src).convert("RGB")
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        dst = DST / dst_name
        im.save(dst, quality=88, method=6)
        a, b = src.stat().st_size, dst.stat().st_size
        total_in += a
        total_out += b
        print(f"{src_name:<20} -> {dst_name:<20} {im.width:>4}x{im.height:<4} "
              f"{a/1024:>7.0f}KB -> {b/1024:>6.1f}KB")

    print(f"\ntotal {total_in/1024/1024:.1f}MB -> {total_out/1024:.0f}KB "
          f"({total_in/max(total_out,1):.0f}x smaller)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
