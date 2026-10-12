"""install_art.py's install functions on synthetic candidates in a temporary assets folder."""

import json
from pathlib import Path

import install_art as ia
import pytest
from PIL import Image


def candidate(tmp: Path, name: str, body: tuple[int, int, int, int], seed: int = 5,
              feet: tuple[int, int] | None = None) -> Path:
    """A transparent png with an opaque box `body` (l, t, r, b) and its sidecar."""
    im = Image.new("RGBA", (200, 200) if feet is None else (1000, 1000), (0, 0, 0, 0))
    im.paste((10, 10, 10, 255), body)
    if feet is not None:  # a narrow foot under the body, its columns given
        im.paste((10, 10, 10, 255), (feet[0], body[3], feet[1], body[3] + 100))
    im.putpixel((2, 2), (0, 0, 0, 20))  # generation fringe, under the alpha cut
    path = tmp / f"{name}.png"
    im.save(path)
    path.with_suffix(".json").write_text(json.dumps({"seed": seed, "prompt": "p", "preset": "sprite"}))
    return path


def test_sprite_is_trimmed_with_padding_and_pivoted_at_the_feet(tmp_path):
    cand = candidate(tmp_path, "c", (200, 200, 800, 800), feet=(300, 400))
    side = ia.install_sprite(tmp_path / "assets", "imp", cand, "fodder", 30)
    out = Image.open(tmp_path / "assets" / "creatures" / "imp.png")
    assert out.size == (600 + 2 * ia.PAD, 700 + 2 * ia.PAD)
    # the feet run x 300..400 of the original, so 108..208 of the trimmed 616 px.
    assert side["pivot"] == [round((108 + 208) / 2 / 616, 3), 0.99]
    written = json.loads((tmp_path / "assets" / "creatures" / "imp.json").read_text())
    assert written == side
    assert written["candidate"] == 5
    assert written["generation"]["preset"] == "sprite"
    assert "source" not in written


def test_sprite_keeps_given_pivot_grip_and_note(tmp_path):
    cand = candidate(tmp_path, "c", (0, 0, 200, 200))
    side = ia.install_sprite(tmp_path, "staff", cand, "prop", 20, pivot_x=0.3, grip=[0.4, 0.6],
                             note="held")
    assert side["pivot"] == [0.3, 0.99]
    assert side["grip"] == [0.4, 0.6]
    assert side["generation"]["note"] == "held"
    assert Image.open(tmp_path / "creatures" / "staff.png").size == (200, 200)  # pad clamps


def test_needs_the_generation_sidecar(tmp_path):
    cand = candidate(tmp_path, "c", (10, 10, 20, 20))
    cand.with_suffix(".json").unlink()
    with pytest.raises(SystemExit, match="no generation sidecar"):
        ia.install_sprite(tmp_path, "x", cand, "fodder", 10)


def test_rejects_a_fully_transparent_candidate(tmp_path):
    cand = candidate(tmp_path, "c", (0, 0, 0, 0))
    with pytest.raises(SystemExit, match="fully transparent"):
        ia.install_sprite(tmp_path, "x", cand, "fodder", 10)


def test_fx_writes_one_frame_per_candidate_and_drops_stale_frames(tmp_path):
    a = candidate(tmp_path, "a", (20, 20, 60, 60), seed=1)
    b = candidate(tmp_path, "b", (0, 0, 100, 50), seed=2)
    c = candidate(tmp_path, "c", (0, 0, 10, 10), seed=3)
    ia.install_fx(tmp_path, "spark", [a, b, c], 8, 72)
    side = ia.install_fx(tmp_path, "spark", [a, b], 8, 72, tintable=True, note="n")
    folder = tmp_path / "fx" / "spark"
    assert sorted(p.name for p in folder.iterdir()) == ["0.png", "1.png"]
    assert Image.open(folder / "0.png").size == (40 + 2 * ia.PAD, 40 + 2 * ia.PAD)
    assert side["frames"] == ["0.png", "1.png"]
    assert side["candidates"] == [1, 2]
    assert side["pivot"] == [0.5, 0.5]
    assert side["tintable"] is True
    assert json.loads((tmp_path / "fx" / "spark.json").read_text()) == side


def test_installed_sidecars_point_inside_the_repo():
    """The shipped sidecars' provenance: no out-of-repo paths, references that exist."""
    for side in sorted((ia.REPO / "assets").glob("*/*.json")):
        text = side.read_text()
        assert "/Users/" not in text and "prototypes/" not in text, side
        meta = json.loads(text)
        gens = meta.get("generation")
        for g in gens if isinstance(gens, list) else [gens]:
            for ref in (g or {}).get("references", []):
                assert (ia.REPO / ref).is_file(), f"{side}: {ref}"
