"""sheet.py's two layouts on synthetic images and, for --game, the game's installed creatures."""

import sys

import pytest
import sheet
from PIL import Image


def run(monkeypatch, *args: str) -> None:
    monkeypatch.setattr(sys, "argv", ["sheet.py", *args])
    sheet.main()


CREATURES = sorted((sheet.REPO / "assets" / "creatures").glob("*.png"))


def test_grid_lays_tiles_in_columns(monkeypatch, tmp_path):
    out = tmp_path / "grid.png"
    imgs = []
    for i in range(3):
        img = tmp_path / f"{i}.png"
        Image.new("RGBA", (40 + 10 * i, 30), (0, 0, 0, 255)).save(img)
        imgs.append(str(img))
    run(monkeypatch, str(out), *imgs, "--cols", "2", "--tile", "100", "--trim")
    assert Image.open(out).size == (200, 2 * (100 + sheet.LABEL_H))


@pytest.mark.skipif(not CREATURES, reason="the game has no installed creature art")
def test_game_rows_size_a_candidate_by_height_and_installed_art_by_sidecar(monkeypatch, tmp_path):
    cand = tmp_path / "cand.png"
    im = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    im.paste((0, 0, 0, 255), (100, 100, 300, 300))
    im.save(cand)
    out = tmp_path / "game.png"
    installed = str(CREATURES[0])
    run(monkeypatch, str(out), installed, str(cand), "--game", "--height", "30")
    assert Image.open(out).height > 2 * 220


def test_game_rows_need_a_height_for_a_bare_candidate(monkeypatch, tmp_path):
    cand = tmp_path / "cand.png"
    Image.new("RGBA", (10, 10), (0, 0, 0, 255)).save(cand)
    with pytest.raises(SystemExit, match="pass --height"):
        run(monkeypatch, str(tmp_path / "o.png"), str(cand), "--game")
