---
name: art
description: Make or replace game art. Use when a creature, prop, effect, icon or concept image is needed, when setting the house style, or when comparing candidates. Covers qwen_image.py (style presets), sheet.py, install_art.py, pnpm atlas and icon.py.
---

# Art

`qwen_image.py` and `sheet.py` (grid) are core; installing sprites and effects into the atlas
(`install_art.py`, `pnpm atlas`, `sheet.py --game`) is the real-time layer's, where each creature
is one still image that code animates (docs/layout.md, "Creature art"). Python scripts carry
their own deps: run them with `uv run`. Generation needs `KIE_API_KEY` (env or `.env`).

## Style

`assets/style/presets.json` (game-owned) holds the prompt wrappers (`pre`, `post`, `references`).
A new game writes its own presets first: generate concepts without a preset, pick the look, then
write the presets around it, one of two ways:

- **Text-to-image, the style in words** (`references: []`): describe the line, fill, palette and
  camera in `pre`/`post`. The safe default; it matched a house style well in trial 2.
- **Image-to-image from a style swatch**: the anchor is a *non-subject* swatch, a texture, a
  pattern, a strip of line work or an object far from anything you will draw. Never a creature or
  character: image-to-image treats the reference as the picture to edit, whatever the prompt says,
  so a subject anchor comes back in every image with the new subject pasted in front (12 of 14
  sprites in trial 2). The example's anchor (`assets/style/anchor.png`, a snail) is such a subject;
  don't copy that choice.

Before any batch, generate **one test image per preset** and look at it (`sheet.py`); only batch a
preset that has produced a usable image.

## Steps

```sh
# 1. candidates (writes cand.json beside each: prompt, preset, seed, cost)
uv run scripts/qwen_image.py "a fat toad, olive and mustard" -o scratchpad/art/toad-1.png --preset sprite --seed 1
uv run scripts/qwen_image.py --batch scratchpad/art/jobs.json      # resumable, 4 at a time

# 2. compare
uv run scripts/sheet.py scratchpad/art/sheet.png scratchpad/art/toad-*.png --trim
uv run scripts/sheet.py scratchpad/art/game.png scratchpad/art/toad-2.png --game --height 28

# 3. install the pick (trims, pivots at the feet, writes the sidecar, packs, checks)
uv run scripts/install_art.py sprite toad scratchpad/art/toad-2.png --role fodder --height 28
uv run scripts/install_art.py fx spark a.png b.png --world-size 40 --atlas-px 192 --tintable
# hand-made art (no generation sidecar), top-down: pivot at the middle
uv run scripts/install_art.py sprite ship scratchpad/art/ship.png --role player --height 30 --own --pivot center --note "drawn in draw.py"

# app icon from a sprite
uv run scripts/icon.py assets/creatures/<hero>.png
```

`--batch` jobs: a JSON list of `{"subject", "output", "preset"?, "seed"?, "image"?: [...]}`.
`pnpm atlas` repacks `assets/` into `public/atlas/` and `content/look/generated/sprites.json`;
install runs it for you.

## Reading output

- `sheet.py --game` shows each image alone, beside the player at game scale, and at phone size.
  Judge at phone size: detail that vanishes there is wasted.
- Then `pnpm shot` a stage with the new creature to see it moving in the game.

## Pitfalls

- `--role` is a role from `src/game/vocab.ts` (or `player`, `prop`); `--height` is world units.
- Generations cost money; batch candidates with a few seeds rather than one at a time, and only
  after the preset's test image came back right.
- A reference that is a subject leaks into every image (see Style); a swatch or words don't.
- A creature also needs its `content/look/creatures.json` entry (sprite, gait, mesh, prop,
  optional `scale`). `scale` draws one sprite at several sizes (a rock large, medium, small); gait
  kind `rigid` is for objects (a ship, a rock): no gait, breath or bend.
