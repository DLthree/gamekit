"""qwen_image.py through its public functions, with kie.ai's HTTP layer faked (no credits spent)."""

import io
import json
import urllib.error
import urllib.request
from pathlib import Path

import pytest
import qwen_image as q

PNG = b"\x89PNG fake image bytes"


class FakeKie:
    """Answers urlopen like kie.ai: upload, createTask, recordInfo, then the result download.

    `create` and `record` are lists of replies served in order (the last one repeats); a reply is
    a payload dict, or an exception to raise.
    """

    def __init__(self, create=None, record=None):
        self.create = create or [{"code": 200, "data": {"taskId": "t1"}}]
        self.record = record or [
            {
                "code": 200,
                "data": {
                    "state": "success",
                    "resultJson": json.dumps({"resultUrls": ["https://files.example/out.png"]}),
                    "creditsConsumed": 4.0,
                    "costTime": 31,
                },
            }
        ]
        self.calls: list[tuple[str, dict | None]] = []

    @staticmethod
    def _serve(replies: list):
        reply = replies.pop(0) if len(replies) > 1 else replies[0]
        if isinstance(reply, Exception):
            raise reply
        return io.BytesIO(json.dumps(reply).encode())

    def urlopen(self, req, timeout=None):
        url = req if isinstance(req, str) else req.full_url
        body = None
        if not isinstance(req, str) and req.data and "json" in req.headers.get("Content-type", ""):
            body = json.loads(req.data)
        self.calls.append((url, body))
        if url.endswith("/createTask"):
            return self._serve(self.create)
        if "/recordInfo" in url:
            return self._serve(self.record)
        if url == q.KIE_UPLOAD:
            return io.BytesIO(json.dumps({"code": 200, "data": {"downloadUrl": "https://tmp/ref.png"}}).encode())
        if url == "https://files.example/out.png":
            return io.BytesIO(PNG)
        raise AssertionError(f"unexpected request {url}")

    def created(self) -> list[dict]:
        return [b for u, b in self.calls if u.endswith("/createTask")]


@pytest.fixture
def kie(monkeypatch):
    fake = FakeKie()
    monkeypatch.setattr(urllib.request, "urlopen", fake.urlopen)
    monkeypatch.setattr(q, "BACKOFF_S", 0)
    monkeypatch.setattr(q, "POLL_S", 0)
    monkeypatch.setenv("KIE_API_KEY", "test-key")
    q.kie_upload.cache_clear()
    return fake


def test_sprite_preset_wraps_the_subject_in_the_house_style_with_the_anchor(kie, tmp_path):
    out = tmp_path / "bat.png"
    assert q.main(["a bat in flight", "-o", str(out), "--preset", "sprite", "--seed", "7"]) == 0
    style = q.presets()["sprite"]
    (sent,) = kie.created()
    assert sent["model"] == q.KIE_I2I
    assert sent["input"]["prompt"] == f"{style['pre']} a bat in flight {style['post']}"
    assert sent["input"]["background"] == "transparent"
    assert sent["input"]["enhance_prompt"] is False
    assert sent["input"]["seed"] == 7
    assert sent["input"]["image_urls"] == ["https://tmp/ref.png"]
    assert out.read_bytes() == PNG
    side = json.loads(out.with_suffix(".json").read_text())
    assert side["subject"] == "a bat in flight"
    assert side["preset"] == "sprite"
    assert side["seed"] == 7
    assert side["references"] == ["assets/style/anchor.png"]
    assert side["cost_credits"] == 4.0
    assert side["cost_usd"] == 0.02
    assert side["task_id"] == "t1"
    assert "image_urls" not in side["inputs"]


def test_image_replaces_the_preset_references(kie, tmp_path):
    q.main(["x", "-o", str(tmp_path / "a.png"), "--preset", "sprite", "--image", "https://ref/a.png"])
    assert kie.created()[0]["input"]["image_urls"] == ["https://ref/a.png"]
    assert not any(u == q.KIE_UPLOAD for u, _ in kie.calls)


def test_no_preset_and_no_reference_is_text_to_image_with_the_given_switches(kie, tmp_path):
    q.main(["a whole prompt", "-o", str(tmp_path / "a.png"), "--aspect", "16:9"])
    (sent,) = kie.created()
    assert sent["model"] == q.KIE_T2I
    assert sent["input"]["prompt"] == "a whole prompt"
    assert sent["input"]["aspect_ratio"] == "16:9"
    assert sent["input"]["background"] == "opaque"
    assert "seed" not in sent["input"]


def test_unknown_preset_names_the_known_ones(kie, tmp_path, capsys):
    assert q.main(["x", "-o", str(tmp_path / "a.png"), "--preset", "nope"]) == 1
    err = capsys.readouterr().err
    assert "no preset 'nope'" in err and "sprite" in err
    assert kie.calls == []


def test_retries_a_transient_failure_then_succeeds(kie, tmp_path):
    kie.create = [{"code": 500, "msg": "Internal Error"}, urllib.error.URLError("reset"), kie.create[0]]
    assert q.main(["x", "-o", str(tmp_path / "a.png")]) == 0
    assert len(kie.created()) == 3


def test_gives_up_after_the_attempts(kie, tmp_path, capsys):
    kie.create = [{"code": 500, "msg": "Internal Error"}]
    assert q.main(["x", "-o", str(tmp_path / "a.png")]) == 1
    assert len(kie.created()) == q.ATTEMPTS
    assert "gave up" in capsys.readouterr().err
    assert not (tmp_path / "a.png").exists()


def test_a_refused_request_is_not_retried(kie, tmp_path, capsys):
    kie.create = [{"code": 401, "msg": "bad key"}]
    assert q.main(["x", "-o", str(tmp_path / "a.png")]) == 1
    assert len(kie.created()) == 1
    assert "bad key" in capsys.readouterr().err


def test_a_failed_task_is_retried_only_on_internal_error(kie, tmp_path):
    ok = kie.record[0]
    kie.record = [{"code": 200, "data": {"state": "fail", "failMsg": "Internal Error"}}, ok]
    assert q.main(["x", "-o", str(tmp_path / "a.png")]) == 0
    kie.record = [{"code": 200, "data": {"state": "fail", "failMsg": "content policy"}}]
    assert q.main(["x", "-o", str(tmp_path / "b.png")]) == 1


def test_polls_until_the_task_finishes(kie, tmp_path):
    kie.record = [{"code": 200, "data": {"state": "generating"}}] * 2 + kie.record
    assert q.main(["x", "-o", str(tmp_path / "a.png")]) == 0
    assert sum("/recordInfo" in u for u, _ in kie.calls) == 3


def test_batch_skips_done_jobs_and_resolves_paths_from_its_file(kie, tmp_path):
    (tmp_path / "done.png").write_bytes(b"old")
    (tmp_path / "done.json").write_text("{}")
    jobs = [
        {"subject": "a", "output": "done.png", "preset": "fx"},
        {"subject": "b", "output": "new/b.png", "preset": "fx", "seed": 3},
        {"subject": "c", "output": "c.png"},
    ]
    batch = tmp_path / "jobs.json"
    batch.write_text(json.dumps(jobs))
    assert q.main(["--batch", str(batch)]) == 0
    assert len(kie.created()) == 2
    assert (tmp_path / "done.png").read_bytes() == b"old"
    assert json.loads((tmp_path / "new" / "b.json").read_text())["seed"] == 3
    assert (tmp_path / "c.png").read_bytes() == PNG
    assert sum(u == q.KIE_UPLOAD for u, _ in kie.calls) == 1  # the anchor, uploaded once
    assert q.main(["--batch", str(batch)]) == 0
    assert len(kie.created()) == 2


def test_batch_reports_failures_and_runs_the_rest(kie, tmp_path, capsys):
    kie.create = [{"code": 422, "msg": "bad prompt"}, {"code": 200, "data": {"taskId": "t2"}}]
    batch = tmp_path / "jobs.json"
    batch.write_text(json.dumps([{"subject": "a", "output": "a.png"}, {"subject": "b", "output": "b.png"}]))
    assert q.main(["--batch", str(batch)]) == 1
    out = capsys.readouterr().out
    assert out.count("FAIL") == 1 and out.count("ok ") == 1


def test_missing_key_fails_before_any_request(kie, tmp_path, monkeypatch, capsys):
    monkeypatch.delenv("KIE_API_KEY")
    monkeypatch.setattr(q, "REPO", tmp_path)
    assert q.main(["x", "-o", str(tmp_path / "a.png")]) == 1
    assert "KIE_API_KEY" in capsys.readouterr().err
    assert kie.calls == []


def test_presets_file_has_the_fields_each_preset_needs():
    for name, p in q.presets().items():
        assert set(p) >= {"pre", "post", "references", "aspect", "transparent", "enhance"}, name
        for r in p["references"]:
            assert (q.REPO / r).is_file(), f"{name}: {r}"


def test_rel_keeps_urls_and_outside_paths():
    assert q.rel(q.REPO / "assets" / "x.png") == "assets/x.png"
    assert q.rel("https://a/b.png") == "https://a/b.png"
    assert q.rel(Path("/elsewhere/x.png")) == "/elsewhere/x.png"
