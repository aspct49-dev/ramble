"""Placeholder brand assets, so the site renders complete before the real art lands.

Everything is drawn on a small unit grid and upscaled with NEAREST, which is
what makes it genuine pixel art rather than a smooth shape pretending to be one.
Each of these is meant to be replaced by a generated asset of the same name.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DST = ROOT / "public"

SKY = (0x71, 0xB8, 0xF7)
PALE = (0xCF, 0xE7, 0xFA)
WHITE = (0xFF, 0xFF, 0xFF)
INK = (0x00, 0x01, 0x35)
NAVY = (0x25, 0x48, 0x8E)
RED = (0xF3, 0x19, 0x04)
DEEP_RED = (0xA1, 0x06, 0x02)
GOLD = (0xF2, 0xC7, 0x5C)
SILVER = (0xC9, 0xD6, 0xE4)
BRONZE = (0xC8, 0x7B, 0x3C)

FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    " ": ["00000"] * 7,
}


class Grid:
    """RGBA canvas addressed in whole units."""

    def __init__(self, w: int, h: int):
        self.a = np.zeros((h, w, 4), dtype=np.uint8)

    @property
    def shape(self):
        return self.a.shape[1], self.a.shape[0]

    def set(self, mask: np.ndarray, colour):
        self.a[mask] = (*colour, 255)

    def rect(self, x, y, w, h, colour):
        self.a[y:y + h, x:x + w] = (*colour, 255)

    def image(self, scale: int) -> Image.Image:
        im = Image.fromarray(self.a, "RGBA")
        return im.resize((im.width * scale, im.height * scale), Image.NEAREST)


def text_mask(word: str, spacing: int = 1) -> np.ndarray:
    glyphs = [FONT[c] for c in word]
    width = sum(len(g[0]) for g in glyphs) + spacing * (len(glyphs) - 1)
    mask = np.zeros((7, width), dtype=bool)
    x = 0
    for g in glyphs:
        for r, row in enumerate(g):
            for c, ch in enumerate(row):
                if ch == "1":
                    mask[r, x + c] = True
        x += len(g[0]) + spacing
    return mask


def dilate(mask: np.ndarray, n: int = 1) -> np.ndarray:
    out = mask.copy()
    for _ in range(n):
        acc = out.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            acc |= np.roll(np.roll(out, dy, 0), dx, 1)
        out = acc
    return out


def fill_holes(mask: np.ndarray) -> np.ndarray:
    """Solid silhouette of `mask` — enclosed counters filled in.

    Flood the background inward from the border; whatever the flood can't
    reach is a hole.
    """
    outside = np.zeros_like(mask)
    outside[0, :] = outside[-1, :] = True
    outside[:, 0] = outside[:, -1] = True
    outside &= ~mask
    while True:
        grown = outside.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            grown |= np.roll(np.roll(outside, dy, 0), dx, 1)
        grown &= ~mask
        if (grown == outside).all():
            return ~grown
        outside = grown


def disc(h: int, w: int, cy: float, cx: float, r: float) -> np.ndarray:
    yy, xx = np.ogrid[:h, :w]
    return (yy - cy) ** 2 + (xx - cx) ** 2 <= r * r


def place(mask: np.ndarray, target_h: int, target_w: int, top: int, left: int) -> np.ndarray:
    out = np.zeros((target_h, target_w), dtype=bool)
    h, w = mask.shape
    out[top:top + h, left:left + w] = mask
    return out


# --------------------------------------------------------------------------
# Wordmark
# --------------------------------------------------------------------------

def wordmark(path: Path, word: str, scale: int, pad: int = 3, accent_from: int | None = None):
    face = text_mask(word, spacing=3)
    h, w = face.shape
    gh, gw = h + pad * 2 + 5, w + pad * 2 + 4

    # No offset shadow: dilating a 5x7 glyph already closes its counters, and
    # any offset wide enough to read floods the notches in R and A. The
    # vermillion goes into a deliberate rule under the word instead.
    face_p = place(face, gh, gw, pad + 1, pad + 1)
    outline = dilate(face_p)

    g = Grid(gw, gh)
    g.set(outline, INK)
    g.set(face_p, WHITE)

    # A single long word is hard to parse, so the second half takes the accent
    # colour: it still reads as one word, but the eye finds the break.
    if accent_from is not None:
        tail = place(text_mask(word[:accent_from], spacing=3), gh, gw, pad + 1, pad + 1)
        g.set(face_p & ~dilate(tail, 2), RED)

    rule_y = pad + 1 + h + 2
    g.rect(pad + 1, rule_y, w, 1, RED)
    g.rect(pad + 1, rule_y + 1, w, 1, DEEP_RED)
    g.image(scale).save(path, optimize=True)
    return g.image(scale).size


# --------------------------------------------------------------------------
# Koi
# --------------------------------------------------------------------------

def koi_face(size_units: int = 22) -> Grid:
    n = size_units
    g = Grid(n, n)
    head = disc(n, n, n * 0.52, n / 2, n * 0.42)
    g.set(dilate(head), INK)
    g.set(head, WHITE)

    # Two red patches on the crown, the classic kohaku marking.
    for cx in (n * 0.33, n * 0.67):
        g.set(disc(n, n, n * 0.3, cx, n * 0.14) & head, RED)
    g.set(disc(n, n, n * 0.2, n / 2, n * 0.1) & head, RED)

    eye = round(n * 0.09)
    for cx in (n * 0.34, n * 0.66):
        g.rect(round(cx - eye / 2), round(n * 0.52), max(2, eye), max(2, eye), INK)

    g.rect(round(n * 0.44), round(n * 0.72), max(2, round(n * 0.12)), 1, DEEP_RED)
    # Barbels
    for x in (round(n * 0.24), round(n * 0.74)):
        g.rect(x, round(n * 0.66), 1, max(2, round(n * 0.14)), INK)
    return g


def koi_mascot(w_units: int = 44, h_units: int = 30) -> Grid:
    g = Grid(w_units, h_units)
    yy, xx = np.ogrid[:h_units, :w_units]

    # Body: an ellipse bowed by a sine so it reads as mid-swim.
    bow = (np.sin(np.linspace(0, np.pi, w_units)) * h_units * 0.10)[None, :]
    cy = h_units * 0.52 - bow
    body = ((yy - cy) / (h_units * 0.24)) ** 2 + ((xx - w_units * 0.42) / (w_units * 0.34)) ** 2 <= 1

    tail = np.zeros((h_units, w_units), dtype=bool)
    for i in range(round(w_units * 0.22)):
        x = w_units - 1 - i
        spread = round(h_units * 0.10 + i * 0.55)
        top = max(0, round(h_units * 0.46 - spread))
        tail[top:min(h_units, top + spread * 2), x] = True

    fin = np.zeros((h_units, w_units), dtype=bool)
    for i in range(round(w_units * 0.14)):
        x = round(w_units * 0.34) + i
        fin[round(h_units * 0.66):round(h_units * 0.66 + 5 - i * 0.5), x] = True

    shape = body | tail | fin
    g.set(dilate(shape), INK)
    g.set(shape, WHITE)

    # Kohaku patches: a white fish wearing red, not a red fish.
    for cx, cy, r in ((0.26, 0.36, 0.085), (0.47, 0.33, 0.10), (0.64, 0.38, 0.07)):
        g.set(disc(h_units, w_units, h_units * cy, w_units * cx, w_units * r) & body, RED)
    g.set(tail & (np.arange(w_units)[None, :] > w_units * 0.88), RED)

    g.rect(round(w_units * 0.16), round(h_units * 0.46), 2, 2, INK)
    return g


# --------------------------------------------------------------------------
# Podium frames + medals
# --------------------------------------------------------------------------

def frame(path: Path, crowned: bool, scale: int):
    w, h = 31, (66 if crowned else 60)
    g = Grid(w, h)
    top = 8 if crowned else 1

    if crowned:
        # Stepped pagoda roof cap.
        for i in range(5):
            span = 9 + i * 4
            x = (w - span) // 2
            g.rect(x, 3 + i, span, 1, NAVY)
        g.rect(w // 2, 0, 1, 3, GOLD)
        g.rect(w // 2 - 3, 7, 7, 1, RED)

    g.rect(0, top, w, h - top, RED)
    g.rect(1, top + 1, w - 2, h - top - 2, GOLD)
    g.rect(2, top + 2, w - 4, h - top - 4, INK)
    g.rect(3, top + 3, w - 6, h - top - 12, NAVY)
    g.rect(3, h - 8, w - 6, 5, RED)  # prize banner
    g.image(scale).save(path, optimize=True)


def scroll_frame(path: Path, crowned: bool, scale: int):
    """Hanging-scroll (kakejiku) card for the leaderboard podium.

    Distinct from the plaque used on the home promo, and a natural fit for the
    tall aspect: the lower roller bar becomes the prize banner for free.
    """
    w, h = 31, (66 if crowned else 60)
    g = Grid(w, h)
    top = 6 if crowned else 3

    # Hanging cord + finial
    g.rect(w // 2, 0, 1, top, GOLD if crowned else NAVY)
    if crowned:
        g.rect(w // 2 - 2, 2, 5, 1, GOLD)

    # Upper roller bar
    g.rect(0, top, w, 3, INK)
    g.rect(1, top + 1, w - 2, 1, GOLD if crowned else NAVY)
    for x in (0, w - 2):  # roller end caps
        g.rect(x, top, 2, 3, GOLD if crowned else NAVY)

    # Paper panel, bordered
    body_top, body_bot = top + 3, h - 6
    g.rect(0, body_top, w, body_bot - body_top, RED if crowned else NAVY)
    g.rect(1, body_top, w - 2, body_bot - body_top, INK)
    g.rect(2, body_top + 1, w - 4, body_bot - body_top - 2, NAVY if crowned else (0x14, 0x27, 0x48))

    # Lower roller bar = the prize banner
    g.rect(0, body_bot, w, 6, INK)
    g.rect(1, body_bot + 1, w - 2, 4, RED)
    for x in (0, w - 2):
        g.rect(x, body_bot, 2, 6, GOLD if crowned else NAVY)

    g.image(scale).save(path, optimize=True)


def medal(path: Path, rank: int, scale: int):
    colour = (GOLD, SILVER, BRONZE)[rank - 1]
    n = 23
    g = Grid(n, n + 4)
    for x, lean in ((n // 2 - 5, -1), (n // 2 + 4, 1)):
        for i in range(6):
            g.rect(x + lean * (i // 2), i, 2, 1, RED if rank == 1 else DEEP_RED)

    disc_mask = place(disc(n, n, n * 0.6, n / 2, n * 0.36), n + 4, n, 4, 0)
    g.set(dilate(disc_mask), INK)
    g.set(disc_mask, colour)
    inner = place(disc(n, n, n * 0.6, n / 2, n * 0.22), n + 4, n, 4, 0)
    g.set(inner, tuple(max(0, c - 40) for c in colour))
    g.rect(n // 2 - 1, round(n * 0.55), 2, round(n * 0.2), INK)
    g.image(scale).save(path, optimize=True)


# --------------------------------------------------------------------------
# Partner placeholders, icons, OG
# --------------------------------------------------------------------------

def partner(path: Path, word: str, scale: int):
    label = text_mask(word)
    lh, lw = label.shape
    gw, gh = lw + 16, 15
    g = Grid(gw, gh)
    mark = disc(gh, gw, gh / 2, 7, 4.5)
    g.set(dilate(mark), WHITE)
    g.set(mark, (0, 0, 0, 0)[:3])
    g.set(mark & ~disc(gh, gw, gh / 2, 7, 2.2), WHITE)
    g.set(place(label, gh, gw, (gh - lh) // 2, 15), WHITE)
    g.image(scale).save(path, optimize=True)


def icons():
    face = koi_face(22)
    n = 30
    pad = (n - 22) // 2
    g = Grid(n, n)
    g.rect(0, 0, n, n, SKY)
    src = face.a
    region = g.a[pad:pad + 22, pad:pad + 22]
    alpha = src[..., 3:4] / 255.0
    g.a[pad:pad + 22, pad:pad + 22, :3] = (
        src[..., :3] * alpha + region[..., :3] * (1 - alpha)
    ).astype(np.uint8)

    base = g.image(18).convert("RGB")  # 540px
    for size, name in ((512, "icon-512.png"), (192, "icon-192.png"),
                       (180, "apple-touch-icon.png"), (32, "icon-32.png")):
        base.resize((size, size), Image.NEAREST).save(DST / name, optimize=True)
    base.resize((64, 64), Image.NEAREST).save(
        DST / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
    )


def og():
    bg = Image.open(DST / "hero-backdrop.webp").convert("RGB")
    scale = max(1200 / bg.width, 630 / bg.height)
    bg = bg.resize((round(bg.width * scale), round(bg.height * scale)), Image.LANCZOS)
    left = (bg.width - 1200) // 2
    top = (bg.height - 630) // 2
    card = bg.crop((left, top, left + 1200, top + 630))

    mark = Image.open(DST / "wordmark.png").convert("RGBA")
    mw = 820
    mark = mark.resize((mw, round(mark.height * mw / mark.width)), Image.NEAREST)
    card.paste(mark, ((1200 - mw) // 2, (630 - mark.height) // 2 - 30), mark)
    card.save(DST / "og.png", optimize=True)


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)

    wordmark(DST / "wordmark.png", "RAMBLEGAMBLE", scale=16, accent_from=6)
    koi_mascot().image(16).save(DST / "koi-mascot.png", optimize=True)
    koi_face().image(30).save(DST / "koi-face.png", optimize=True)
    koi_face().image(30).save(DST / "koi-avatar.png", optimize=True)
    frame(DST / "frame-crown.png", crowned=True, scale=15)
    frame(DST / "frame-plain.png", crowned=False, scale=15)
    scroll_frame(DST / "lb-frame-crown.png", crowned=True, scale=15)
    scroll_frame(DST / "lb-frame-plain.png", crowned=False, scale=15)
    for r in (1, 2, 3):
        medal(DST / f"medal-{r}.png", r, scale=10)
    # Stand-in until Dicey supply real brand art.
    partner(DST / "partner-dicey.png", "DICEY", scale=14)
    icons()
    og()

    for f in sorted(DST.iterdir()):
        if f.suffix in {".png", ".ico"} and f.stat().st_mtime > 0:
            pass
    made = ["lb-frame-crown.png", "lb-frame-plain.png", "wordmark.png", "koi-mascot.png", "koi-face.png", "koi-avatar.png",
            "frame-crown.png", "frame-plain.png", "medal-1.png", "medal-2.png",
            "medal-3.png", "dicey_logo.webp", "icon-512.png",
            "icon-192.png", "icon-32.png", "apple-touch-icon.png", "favicon.ico",
            "og.png"]
    for name in made:
        p = DST / name
        try:
            with Image.open(p) as im:
                print(f"{name:<24} {im.width:>4}x{im.height:<4} {p.stat().st_size/1024:>7.1f}KB")
        except Exception as exc:  # pragma: no cover
            print(f"{name:<24} FAILED {exc}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
