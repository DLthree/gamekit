# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow==12.3.0"]
# ///
"""Install picked generated candidates into assets/, then rebuild the atlas and check content.

  uv run scripts/install_art.py sprite ID CAND.png --role boss --height 120 [--flying]
      [--pivot feet|center|X,Y] [--grip X,Y] [--own] [--note TEXT]
  uv run scripts/install_art.py fx ID CAND.png [CAND.png ...] --world-size 40 --atlas-px 192
      [--tintable] [--pivot X,Y] [--note TEXT]

Each CAND.png needs its generation sidecar CAND.json (scripts/qwen_image.py writes it), unless
--own: hand-made art, recorded as such (generation: subject ID, model "own", --note).

sprite -> assets/creatures/ID.png, cropped to its alpha box plus 8 px, pivot at the feet (the
middle of the opaque columns in the bottom 6%: a side view standing on the ground), or --pivot
center (a top-down object turning about its middle) or X,Y, and assets/creatures/ID.json:
placement, the candidate's seed and its generation sidecar (the provenance: subject, prompt,
preset, references). --role is the sprite's ArtRole (player, prop, or a role in
src/game/vocab.ts); --height its height in world units.

fx -> assets/fx/ID/<n>.png, one frame per candidate in order, each cropped the same way, and
assets/fx/ID.json. Effects are black ink on white, so --tintable lets the game colour them.

Then it runs scripts/build_atlas.py (pnpm atlas) and pnpm content:check, which fails on a role
the schema doesn't know or a sprite frame missing from the atlas.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_atlas  # noqa: E402  (a sibling script, not a package)

REPO = Path(__file__).resolve().parent.parent
ALPHA = 24  # alpha at or under this is empty margin (generation fringe)
PAD = 8
FEET_BAND = 0.06


def generation(cand: Path, own: bool = False, subject: str = "") -> dict:
    """The candidate's generation sidecar, or for hand-made art (`own`) a record saying so."""
    if own:
        return {"subject": subject, "seed": None, "model": "own"}
    side = cand.with_suffix(".json")
    if not side.exists():
        raise SystemExit(f"{side}: no generation sidecar (scripts/qwen_image.py writes it; "
                         "--own for hand-made art)")
    return json.loads(side.read_text())


def opaque(im: Image.Image) -> Image.Image:
    return im.getchannel("A").point(lambda v: 255 if v > ALPHA else 0)


def trimmed(cand: Path) -> Image.Image:
    """The candidate cropped to its opaque box plus PAD px (clamped to the image)."""
    im = Image.open(cand).convert("RGBA")
    box = opaque(im).getbbox()
    if box is None:
        raise SystemExit(f"{cand}: fully transparent")
    l, t, r, b = box
    return im.crop((max(0, l - PAD), max(0, t - PAD), min(im.width, r + PAD), min(im.height, b + PAD)))


def feet_x(im: Image.Image) -> float:
    """The middle of the opaque columns in the bottom FEET_BAND of the image, 0..1."""
    w, h = im.size
    feet = opaque(im).crop((0, int(h * (1 - FEET_BAND)), w, h)).getbbox()
    return (feet[0] + feet[2]) / 2 / w if feet else 0.5


def pair(text: str) -> list[float]:
    x, y = (float(n) for n in text.split(","))
    return [x, y]


def pivot_arg(text: str) -> str | list[float]:
    """--pivot: "feet", "center" or X,Y."""
    return text if text in ("feet", "center") else pair(text)


def install_sprite(assets: Path, id: str, cand: Path, role: str, height: int, flying: bool = False,
                   pivot: str | list[float] = "feet", grip: list[float] | None = None,
                   note: str | None = None, own: bool = False) -> dict:
    gen = generation(cand, own, id)
    if note:
        gen["note"] = note
    im = trimmed(cand)
    at = {"feet": [feet_x(im), 0.99], "center": [0.5, 0.5]}[pivot] if isinstance(pivot, str) else pivot
    out = assets / "creatures" / f"{id}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    side = {
        "id": id,
        "role": role,
        "pivot": [round(at[0], 3), round(at[1], 3)],
        "heightWorld": height,
        "flying": flying,
        "grip": grip,
        "owner": None,
        "facing": "right",
        "candidate": gen.get("seed"),
        "generation": gen,
    }
    out.with_suffix(".json").write_text(json.dumps(side, indent=2) + "\n")
    print(out, im.size, side["pivot"])
    return side


def install_fx(assets: Path, id: str, cands: list[Path], world_size: float, atlas_px: int,
               tintable: bool = False, pivot: list[float] | None = None,
               note: str | None = None) -> dict:
    gens = [generation(c) for c in cands]  # every sidecar before writing anything
    folder = assets / "fx" / id
    folder.mkdir(parents=True, exist_ok=True)
    frames = []
    for n, cand in enumerate(cands):
        trimmed(cand).save(folder / f"{n}.png")
        frames.append(f"{n}.png")
    for stale in folder.glob("*.png"):
        if stale.name not in frames:
            stale.unlink()  # a frame from a longer earlier install
    side = {
        "id": id,
        "frames": frames,
        "pivot": pivot or [0.5, 0.5],
        "tintable": tintable,
        "worldSize": world_size,
        "atlasPx": atlas_px,
        "note": note,
        "candidates": [g.get("seed") for g in gens],
        "generation": gens,
    }
    (assets / "fx" / f"{id}.json").write_text(json.dumps(side, indent=2) + "\n")
    print(folder, len(frames), "frame(s)")
    return side


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = p.add_subparsers(dest="kind", required=True)
    s = sub.add_parser("sprite")
    s.add_argument("id", help="assets/creatures/<id>.png")
    s.add_argument("cand", type=Path, help="the candidate png (its .json sidecar beside it)")
    s.add_argument("--role", required=True)
    s.add_argument("--height", type=int, required=True, help="heightWorld")
    s.add_argument("--flying", action="store_true")
    s.add_argument("--pivot", type=pivot_arg, default="feet",
                   help="feet (default: a side view on the ground), center (top-down), or X,Y (0..1)")
    s.add_argument("--grip", type=pair, help="a prop's grip point X,Y (0..1)")
    s.add_argument("--own", action="store_true", help="hand-made art: no generation sidecar")
    s.add_argument("--note", help="generation.note")
    f = sub.add_parser("fx")
    f.add_argument("id", help="assets/fx/<id>/<n>.png")
    f.add_argument("cands", type=Path, nargs="+", help="candidate pngs, one per frame")
    f.add_argument("--world-size", type=float, required=True)
    f.add_argument("--atlas-px", type=int, required=True, help="longest side in the atlas")
    f.add_argument("--tintable", action="store_true")
    f.add_argument("--pivot", type=pair, help="X,Y (0..1); default 0.5,0.5")
    f.add_argument("--note")
    args = p.parse_args()
    assets = REPO / "assets"
    if args.kind == "sprite":
        install_sprite(assets, args.id, args.cand, args.role, args.height, args.flying, args.pivot,
                       args.grip, args.note, args.own)
    else:
        install_fx(assets, args.id, args.cands, args.world_size, args.atlas_px, args.tintable,
                   args.pivot, args.note)
    build_atlas.main()
    sys.exit(subprocess.run(["pnpm", "content:check"], cwd=REPO).returncode)


if __name__ == "__main__":
    main()
