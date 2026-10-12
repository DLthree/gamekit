# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow==12.3.0"]
# ///
"""The app icon: a sprite on a rounded page-coloured tile, 1024 px square.

  uv run scripts/icon.py assets/creatures/wizard.png [-o ship/icon.png]

The sprite is trimmed to its alpha box and fitted into 760 px, centred a little low.
"""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
FIT = 760
PAGE = (239, 230, 210, 255)
INK = (27, 23, 18, 255)


def icon(sprite: Image.Image) -> Image.Image:
    src = sprite.convert("RGBA")
    box = src.getbbox()
    if box is None:
        raise SystemExit("icon.py: the sprite is fully transparent")
    src = src.crop(box)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(out).rounded_rectangle(
        (40, 40, SIZE - 40, SIZE - 40), radius=180, fill=PAGE, outline=INK, width=24
    )
    k = FIT / max(src.size)
    w, h = int(src.width * k), int(src.height * k)
    out.alpha_composite(src.resize((w, h), Image.LANCZOS), ((SIZE - w) // 2, (SIZE - h) // 2 + 20))
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sprite", type=Path)
    ap.add_argument("-o", "--out", type=Path, default=Path("ship/icon.png"))
    a = ap.parse_args()
    icon(Image.open(a.sprite)).save(a.out)
    print(a.out)


if __name__ == "__main__":
    main()
