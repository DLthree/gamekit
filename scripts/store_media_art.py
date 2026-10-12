# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow==12.3.0"]
# ///
"""The store's still art for `pnpm store-media` (scripts/store-media.ts): capsules and cards.

  uv run scripts/store_media_art.py ship/media.json release/store

Reads the manifest (ship/media.json) and writes:
  capsules/<name>.png  each capsule: its screenshot (screenshots/<shot>.png, from the `shots`
                       step) cut to the capsule's size around the centre, a dark band at the
                       foot, and the title on it.
  build/cards/<name>.png  each trailer card, 1920x1080: its lines centred on dark ground.
The face is Pillow's built-in one; a game swaps in its own font here.
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
INK = (239, 230, 210)
GROUND = (27, 23, 18)


def cover(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """`img` scaled to cover `size`, cut around the centre."""
    w, h = size
    k = max(w / img.width, h / img.height)
    big = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    x, y = (big.width - w) // 2, (big.height - h) // 2
    return big.crop((x, y, x + w, y + h))


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_w: int, max_h: int) -> ImageFont.FreeTypeFont:
    """The biggest built-in face size at which `text` fits in max_w x max_h."""
    size = max_h
    while size > 8:
        font = ImageFont.load_default(size)
        l, t, r, b = draw.textbbox((0, 0), text, font=font)
        if r - l <= max_w and b - t <= max_h:
            return font
        size -= 2
    raise ValueError(f"{text!r} doesn't fit in {max_w}x{max_h}")


def capsule(shot: Image.Image, size: tuple[int, int], title: str) -> Image.Image:
    """A capsule: the shot cut to `size`, a band at the foot, the title centred on it."""
    w, h = size
    img = cover(shot.convert("RGB"), size)
    band = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(band)
    top = round(h * 0.68)
    d.rectangle((0, top, w, h), fill=(*GROUND, 210))
    img = Image.alpha_composite(img.convert("RGBA"), band)
    d = ImageDraw.Draw(img)
    font = fit_font(d, title, round(w * 0.9), round((h - top) * 0.6))
    d.text((w / 2, (top + h) / 2), title, font=font, fill=INK, anchor="mm")
    return img.convert("RGB")


def card(lines: list[str]) -> Image.Image:
    """A 1920x1080 trailer card: the lines centred, one under another."""
    img = Image.new("RGB", (W, H), GROUND)
    d = ImageDraw.Draw(img)
    font = fit_font(d, max(lines, key=len), round(W * 0.8), 96)
    step = font.size * 1.4
    y0 = H / 2 - step * (len(lines) - 1) / 2
    for i, line in enumerate(lines):
        d.text((W / 2, y0 + i * step), line, font=font, fill=INK, anchor="mm")
    return img


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("usage: uv run scripts/store_media_art.py ship/media.json release/store")
    manifest = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[2])
    (out / "capsules").mkdir(parents=True, exist_ok=True)
    for c in manifest["capsules"]:
        shot = out / "screenshots" / f"{c['shot']}.png"
        if not shot.exists():
            sys.exit(f"{shot} missing: run pnpm store-media shots")
        path = out / "capsules" / f"{c['name']}.png"
        capsule(Image.open(shot), tuple(c["size"]), manifest["title"]).save(path)
        print(path)
    (out / "build" / "cards").mkdir(parents=True, exist_ok=True)
    for b in manifest["trailer"]["beats"]:
        if b["kind"] == "card":
            path = out / "build" / "cards" / f"{b['name']}.png"
            card(b["lines"]).save(path)
            print(path)


if __name__ == "__main__":
    main()
