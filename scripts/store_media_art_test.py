"""store_media_art.py's capsule and card on a synthetic shot."""

import json
import sys

import pytest
import store_media_art
from PIL import Image


def test_capsule_is_its_size_with_the_title_band():
    shot = Image.new("RGB", (1920, 1080), (40, 120, 40))
    img = store_media_art.capsule(shot, (920, 430), "A Game")
    assert img.size == (920, 430)
    assert img.getpixel((5, 5)) == (40, 120, 40)
    assert img.getpixel((5, 425)) != (40, 120, 40)


def test_card_centres_its_lines():
    img = store_media_art.card(["One line", "Two"])
    assert img.size == (1920, 1080)
    assert img.getbbox() is not None
    assert img.getpixel((0, 0)) == store_media_art.GROUND


def test_a_missing_screenshot_names_the_step(monkeypatch, tmp_path):
    manifest = tmp_path / "media.json"
    manifest.write_text(
        json.dumps(
            {
                "title": "A Game",
                "capsules": [{"name": "c", "size": [10, 10], "shot": "nope"}],
                "trailer": {"beats": []},
            }
        )
    )
    monkeypatch.setattr(sys, "argv", ["x", str(manifest), str(tmp_path)])
    with pytest.raises(SystemExit, match="run pnpm store-media shots"):
        store_media_art.main()
