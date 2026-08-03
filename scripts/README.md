# Asset pipeline

Raw generated art goes in the repo root; these turn it into web-ready sprites
in `public/`. Originals are never modified. Requires `pillow` and `numpy`.

Run in this order after dropping new art into the repo root:

```bash
python scripts/condition-assets.py    # crop, kill bloom halos, hard edges, resize
python scripts/quantize-assets.py     # flatten each sprite to a tight palette
```

`condition-assets.py` is the important one. Image generators return sprites on
a huge canvas with a soft glow baked into the "transparent" background and
anti-aliased edges — all three fight pixel art and inflate the payload. It
hard-thresholds alpha, bleeds opaque colour outward so resizing can't drag grey
matte into the edges, crops to the bounding box, and downscales. On the first
batch this took 16 MB down to 360 KB.

Filenames are mapped explicitly in the `SPRITES` / `BACKDROPS` tables at the
bottom of the script — edit those when asset names change.

## The other two

- `gen-tiles.py` — builds the seamlessly-looping SVGs (`water-back`,
  `water-front`, `ridge-divider`). They're generated rather than drawn because
  a tile whose right edge doesn't meet its left edge produces a seam that
  visibly scrolls across the hero. Sine periods divide the tile width exactly,
  so continuity is guaranteed.
- `gen-placeholder-brand.py` — stand-in wordmark, koi, podium frames, medals,
  partner logos, icons and OG image, drawn on a unit grid and upscaled
  nearest-neighbour. **Delete these outputs as real art arrives**; every file
  it writes is meant to be replaced.
