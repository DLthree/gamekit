"""icon.py: a 1024 px tile with the sprite fitted inside; a blank sprite fails."""

import sys

import icon
import pytest
from PIL import Image


def test_icon_is_square_with_the_sprite_inside(monkeypatch, tmp_path):
    sprite = tmp_path / "s.png"
    im = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    im.paste((200, 0, 0, 255), (100, 50, 200, 250))
    im.save(sprite)
    out = tmp_path / "icon.png"
    monkeypatch.setattr(sys, "argv", ["icon.py", str(sprite), "-o", str(out)])
    icon.main()
    got = Image.open(out)
    assert got.size == (icon.SIZE, icon.SIZE)
    assert got.getpixel((icon.SIZE // 2, icon.SIZE // 2 + 20)) == (200, 0, 0, 255)
    assert got.getpixel((0, 0))[3] == 0


def test_blank_sprite_fails():
    with pytest.raises(SystemExit):
        icon.icon(Image.new("RGBA", (10, 10), (0, 0, 0, 0)))
