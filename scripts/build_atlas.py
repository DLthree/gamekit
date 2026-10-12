# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow==12.3.0"]
# ///
"""Pack assets/ into one atlas so creatures and effects batch together on iOS.

  pnpm atlas            (uv run scripts/build_atlas.py)

Inputs:  assets/creatures/<id>.png|json, assets/fx/<id>/<n>.png + assets/fx/<id>.json
Outputs: public/atlas/game.png + game.json (Phaser JSON hash)
         content/look/generated/sprites.json (validated by pnpm content:check)

Creatures are scaled to PX_PER_UNIT px per world unit of their height. Effects are scaled so
their longest side is the sidecar's atlasPx. Downscaling is premultiplied (no dark alpha fringes).
"""

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CREATURES = ROOT / "assets" / "creatures"
FX = ROOT / "assets" / "fx"
OUT_PNG = ROOT / "public" / "atlas" / "game.png"
OUT_JSON = ROOT / "public" / "atlas" / "game.json"
OUT_SPRITES = ROOT / "content" / "look" / "generated" / "sprites.json"

PX_PER_UNIT = 4.5
ATLAS_W = 2048
PAD = 4


def resize(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    if img.size == size:
        return img
    return img.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")


def load_creatures() -> tuple[list[tuple[str, Image.Image]], list[dict]]:
    images, defs = [], []
    for sidecar in sorted(CREATURES.glob("*.json")):
        meta = json.loads(sidecar.read_text())
        img = Image.open(sidecar.with_suffix(".png")).convert("RGBA")
        h = round(meta["heightWorld"] * PX_PER_UNIT)
        w = round(img.width * h / img.height)
        frame = f"creature/{meta['id']}"
        images.append((frame, resize(img, (w, h))))
        defs.append(
            {
                "id": meta["id"],
                "role": meta["role"],
                "frame": frame,
                "px": [w, h],
                "world": [round(w / PX_PER_UNIT, 2), round(h / PX_PER_UNIT, 2)],
                "pivot": meta["pivot"],
                "flying": meta["flying"],
                "grip": meta["grip"],
                "owner": meta["owner"],
            }
        )
    return images, defs


def load_fx() -> tuple[list[tuple[str, Image.Image]], list[dict]]:
    images, defs = [], []
    for sidecar in sorted(FX.glob("*.json")):
        meta = json.loads(sidecar.read_text())
        frames, px = [], []
        for n, name in enumerate(meta["frames"]):
            img = Image.open(FX / meta["id"] / name).convert("RGBA")
            k = min(1.0, meta["atlasPx"] / max(img.size))
            size = (max(1, round(img.width * k)), max(1, round(img.height * k)))
            frame = f"fx/{meta['id']}/{n}"
            images.append((frame, resize(img, size)))
            frames.append(frame)
            px.append(list(size))
        defs.append(
            {
                "id": meta["id"],
                "frames": frames,
                "px": px,
                "pivot": meta["pivot"],
                "worldSize": meta["worldSize"],
                "tintable": meta["tintable"],
            }
        )
    return images, defs


def pack(images: list[tuple[str, Image.Image]]) -> tuple[dict[str, tuple[int, int]], int]:
    """Shelf packing, tallest first: fills rows left to right, returns positions and used height."""
    order = sorted(images, key=lambda item: (-item[1].height, item[0]))
    pos: dict[str, tuple[int, int]] = {}
    x, y, row = PAD, PAD, 0
    for name, img in order:
        if img.width + 2 * PAD > ATLAS_W:
            raise SystemExit(f"{name} is wider than the atlas")
        if x + img.width + PAD > ATLAS_W:
            x, y, row = PAD, y + row + PAD, 0
        pos[name] = (x, y)
        x += img.width + PAD
        row = max(row, img.height)
    return pos, y + row + PAD


def main() -> None:
    c_images, sprites = load_creatures()
    f_images, fx = load_fx()
    images = c_images + f_images
    pos, used = pack(images)
    height = 1
    while height < used:
        height *= 2
    atlas = Image.new("RGBA", (ATLAS_W, height), (0, 0, 0, 0))
    frames = {}
    for name, img in images:
        x, y = pos[name]
        atlas.paste(img, (x, y))
        w, h = img.size
        frames[name] = {
            "frame": {"x": x, "y": y, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT_PNG, optimize=True)
    meta = {"image": "game.png", "format": "RGBA8888", "size": {"w": ATLAS_W, "h": height}, "scale": "1"}
    OUT_JSON.write_text(json.dumps({"frames": frames, "meta": meta}, indent=2) + "\n")
    OUT_SPRITES.parent.mkdir(parents=True, exist_ok=True)
    manifest = {
        "$schema": "../../schema/look-generated-sprites.schema.json",
        "atlas": {"png": "atlas/game.png", "json": "atlas/game.json"},
        "pxPerWorldUnit": PX_PER_UNIT,
        "sprites": sprites,
        "fx": fx,
    }
    OUT_SPRITES.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"atlas {ATLAS_W}x{height}: {len(sprites)} sprites, {len(fx)} effects, {len(images)} frames")


if __name__ == "__main__":
    main()
