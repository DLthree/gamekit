# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow==12.3.0"]
# ///
"""Contact sheet: images in a labelled grid, or each one alone, in game and at phone size.

  uv run scripts/sheet.py out.png IMAGE... [--cols 5] [--tile 220] [--trim]
  uv run scripts/sheet.py out.png IMAGE... --game [--height H]

Grid (default): each image fitted into a square --tile px cell on parchment, labelled with its
folder and name. --trim crops each to its alpha box first (a sprite with a wide empty margin then
fills its tile). Use it to compare candidates or shots.

--game: one row per image (trimmed to its alpha box) with three panels:
  alone    the image fitted into a --tile px cell;
  in game  at the size it draws on a 1080 px tall screen, on the floor colour, beside the player
           sprite, both standing on one line;
  phone    the same at a phone's size in points (390 pt short side), about as small as a player
           sees it on a phone held in the hand.
The size in world units comes from the image's sidecar (assets/creatures/<id>.json heightWorld,
or an effect frame's assets/fx/<id>.json worldSize, its longest side), else --height (a
candidate's planned height, the --height install_art.py will get). The screen's world span is
look/camera.json shortSideSpan, the floor colour look/palette.json's camera background.
"""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
LOOK = REPO / "content" / "look"
PARCHMENT = "#efe4c8"
INK = "#231d17"
LABEL_H = 18
GAME_SHORT_PX = 1080
PHONE_SHORT_PT = 390
GAP = 12


def label(im: Image.Image, text: str) -> Image.Image:
    out = Image.new("RGB", (max(im.width, 8 * len(text)), im.height + LABEL_H), PARCHMENT)
    out.paste(im, (0, 0), im if im.mode == "RGBA" else None)
    ImageDraw.Draw(out).text((4, im.height + 2), text, fill=INK)
    return out


def fitted(im: Image.Image, tile: int) -> Image.Image:
    cell = Image.new("RGBA", (tile, tile), PARCHMENT)
    im = im.copy()
    im.thumbnail((tile - 10, tile - 10))
    cell.paste(im, ((tile - im.width) // 2, (tile - im.height) // 2), im)
    return cell


def trim(im: Image.Image, path: str) -> Image.Image:
    box = im.getchannel("A").getbbox()
    if box is None:
        raise SystemExit(f"{path}: fully transparent, nothing to trim to")
    return im.crop(box)


def grid(paths: list[str], cols: int, tile: int, do_trim: bool) -> Image.Image:
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tile, rows * (tile + LABEL_H)), PARCHMENT)
    for k, path in enumerate(paths):
        im = Image.open(path).convert("RGBA")
        if do_trim:
            im = trim(im, path)
        cell = label(fitted(im, tile), f"{Path(path).parent.name[-12:]}/{Path(path).stem}")
        sheet.paste(cell, ((k % cols) * tile, (k // cols) * (tile + LABEL_H)))
    return sheet


def world_height(path: Path, im: Image.Image, given: float | None) -> float:
    """The image's drawn height in world units, from its sidecar or --height."""
    side = path.with_suffix(".json")
    if side.exists() and "heightWorld" in (meta := json.loads(side.read_text())):
        return meta["heightWorld"]
    fx = path.parent.with_suffix(".json")
    if fx.exists() and "worldSize" in (meta := json.loads(fx.read_text())):
        return meta["worldSize"] * im.height / max(im.size)
    if given is None:
        raise SystemExit(f"{path}: no heightWorld or worldSize sidecar; pass --height")
    return given


def player() -> tuple[Image.Image, float]:
    for side in sorted((REPO / "assets" / "creatures").glob("*.json")):
        meta = json.loads(side.read_text())
        if meta["role"] == "player":
            return Image.open(side.with_suffix(".png")).convert("RGBA"), meta["heightWorld"]
    raise SystemExit("no player sprite in assets/creatures/ to compare with")


def scaled(im: Image.Image, height_px: float) -> Image.Image:
    h = max(1, round(height_px))
    w = max(1, round(im.width * h / im.height))
    return im.convert("RGBa").resize((w, h), Image.Resampling.LANCZOS).convert("RGBA")


def in_game(im: Image.Image, height: float, hero: tuple[Image.Image, float], px_per_unit: float,
            floor: str) -> Image.Image:
    """The image beside the player at px_per_unit, bottoms on one line, on the floor colour."""
    a = scaled(hero[0], hero[1] * px_per_unit)
    b = scaled(im, height * px_per_unit)
    margin = max(4, round(4 * px_per_unit))
    h = max(a.height, b.height) + 2 * margin
    out = Image.new("RGBA", (a.width + b.width + 3 * margin, h), floor)
    out.paste(a, (margin, h - margin - a.height), a)
    out.paste(b, (2 * margin + a.width, h - margin - b.height), b)
    return out


def game_rows(paths: list[str], tile: int, given: float | None) -> Image.Image:
    camera = json.loads((LOOK / "camera.json").read_text())
    palette = json.loads((LOOK / "palette.json").read_text())["colors"]
    floor = palette[camera["background"]]
    span = camera["shortSideSpan"]
    hero = player()
    rows = []
    for path in paths:
        im = trim(Image.open(path).convert("RGBA"), path)  # a candidate's margin isn't its height
        height = world_height(Path(path), im, given)
        name = f"{Path(path).parent.name[-12:]}/{Path(path).stem}"
        panels = [
            label(fitted(im, tile), f"alone: {name}"),
            label(in_game(im, height, hero, GAME_SHORT_PX / span, floor), f"in game ({GAME_SHORT_PX} px)"),
            label(in_game(im, height, hero, PHONE_SHORT_PT / span, floor), "phone"),
        ]
        row = Image.new("RGB", (sum(p.width for p in panels) + GAP * (len(panels) - 1),
                                max(p.height for p in panels)), PARCHMENT)
        x = 0
        for p in panels:
            row.paste(p, (x, row.height - p.height))
            x += p.width + GAP
        rows.append(row)
    sheet = Image.new("RGB", (max(r.width for r in rows), sum(r.height for r in rows) + GAP * len(rows)),
                      PARCHMENT)
    y = 0
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height + GAP
    return sheet


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("out")
    p.add_argument("images", nargs="+")
    p.add_argument("--cols", type=int, default=5)
    p.add_argument("--tile", type=int, default=220)
    p.add_argument("--trim", action="store_true", help="crop each image to its alpha box")
    p.add_argument("--game", action="store_true", help="alone, in game and phone panels per image")
    p.add_argument("--height", type=float, help="world height for images without a sidecar")
    args = p.parse_args()
    if args.game:
        sheet = game_rows(args.images, args.tile, args.height)
    else:
        sheet = grid(args.images, args.cols, args.tile, args.trim)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.out)
    print(args.out, sheet.size)


if __name__ == "__main__":
    main()
