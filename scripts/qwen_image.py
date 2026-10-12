# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Generate images with Qwen Image 2.1 via the kie.ai job API, one or a batch.

  uv run scripts/qwen_image.py "SUBJECT" -o out.png [--preset sprite|fx|concept] [--seed N]
      [--image ref.png ...] [--aspect 16:9] [--resolution 1K|2K] [--transparent] [--no-enhance]
  uv run scripts/qwen_image.py --batch jobs.json

--preset wraps SUBJECT in a house style from assets/style/presets.json (the game owns that file:
a new game edits its style there). A preset sets the reference images (the style anchor),
aspect, transparency and prompt rewriting; --image replaces its references. Without a preset
SUBJECT is the whole prompt and the switches apply as given.

References make it image-to-image (up to 10; local files are uploaded to kie.ai temp storage,
http(s) URLs pass through), none make it text-to-image.

Every image gets a sidecar out.json: subject, full prompt, preset, seed, model, references,
inputs, seconds, task id and cost. scripts/install_art.py reads it.

--batch takes a JSON list of jobs, each {"subject", "output", "preset"?, "seed"?, "image"?: [...],
"aspect"?, "resolution"?, "transparent"?, "enhance"?}; paths are relative to the batch file.
Jobs whose image and sidecar exist are skipped, so re-running resumes. Four run at once; each
retries transient failures (network, 5xx, kie.ai "Internal Error", timeouts).

Reads KIE_API_KEY from the environment or the repo-root .env (gitignored).
"""

import argparse
import functools
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PRESETS = REPO / "assets" / "style" / "presets.json"
CONCURRENCY = 4
ATTEMPTS = 3
BACKOFF_S = 20.0
POLL_S = 3.0
TIMEOUT_S = 300.0


class Transient(Exception):
    """A failure worth retrying: network, server-side, or a task that never finished."""


class Failed(Exception):
    """A failure retrying won't fix: bad key, bad request, a refused prompt."""


@dataclass(frozen=True)
class Job:
    subject: str
    output: Path
    prompt: str
    preset: str | None
    references: tuple[str, ...]
    seed: int | None
    aspect: str | None
    resolution: str
    transparent: bool
    enhance: bool


@dataclass(frozen=True)
class Generated:
    png: bytes
    model: str
    inputs: dict
    task_id: str
    credits: float | None
    provider_seconds: float | None


def presets() -> dict:
    return json.loads(PRESETS.read_text())["presets"]


def make_job(
    subject: str,
    output: Path,
    preset: str | None = None,
    seed: int | None = None,
    images: list[str] | None = None,
    aspect: str | None = None,
    resolution: str = "1K",
    transparent: bool = False,
    enhance: bool = True,
) -> Job:
    """A job from a subject and switches; a preset fills the prompt, references and inputs."""
    refs = list(images or [])
    prompt = subject
    if preset is not None:
        all_presets = presets()
        if preset not in all_presets:
            raise Failed(f"no preset {preset!r} in {rel(PRESETS)}; have {', '.join(all_presets)}")
        p = all_presets[preset]
        prompt = " ".join(part for part in (p["pre"], subject, p["post"]) if part)
        refs = refs or [str(REPO / r) for r in p["references"]]
        aspect = aspect or p["aspect"]
        transparent, enhance = p["transparent"], p["enhance"]
    if len(refs) > 10:
        raise Failed("at most 10 reference images")
    return Job(subject, output, prompt, preset, tuple(refs), seed, aspect, resolution, transparent, enhance)


def rel(path: str | Path) -> str:
    """A repo-relative path when it is inside the repo, else as given (URLs, outside files)."""
    s = str(path)
    if s.startswith(("http://", "https://")):
        return s
    try:
        return str(Path(s).resolve().relative_to(REPO))
    except ValueError:
        return s


# --- The provider seam. Everything kie.ai-specific is generate() and the kie_* helpers under it;
# --- to use another provider, replace generate() with one that returns a Generated.

KIE_JOBS = "https://api.kie.ai/api/v1/jobs"
# Docs (https://docs.kie.ai/file-upload-api/upload-file-stream) say api.kie.ai; that host 404s.
KIE_UPLOAD = "https://kieai.redpandaai.co/api/file-stream-upload"
KIE_T2I = "qwen2-1/text-to-image"
KIE_I2I = "qwen2-1/image-to-image"
KIE_USD_PER_CREDIT = 0.005


def generate(job: Job, key: str) -> Generated:
    """One image from kie.ai's Qwen Image 2.1: create the task, poll it, download the result."""
    model = KIE_I2I if job.references else KIE_T2I
    inputs: dict = {
        "aspect_ratio": job.aspect or ("auto" if job.references else "1:1"),
        "resolution": job.resolution,
        "background": "transparent" if job.transparent else "opaque",
        "output_format": "png",
        "enhance_prompt": job.enhance,
    }
    if job.seed is not None:
        inputs["seed"] = job.seed
    body = {"prompt": job.prompt, **inputs}
    if job.references:
        body["image_urls"] = [
            r if r.startswith(("http://", "https://")) else kie_upload(r, key) for r in job.references
        ]
    task = kie_call("POST", f"{KIE_JOBS}/createTask", key, {"model": model, "input": body})["taskId"]
    deadline = time.monotonic() + TIMEOUT_S
    while time.monotonic() < deadline:
        data = kie_call("GET", f"{KIE_JOBS}/recordInfo?taskId={task}", key)
        state = data.get("state")
        if state == "success":
            url = json.loads(data["resultJson"])["resultUrls"][0]
            with urllib.request.urlopen(url, timeout=120) as resp:
                png = resp.read()
            return Generated(png, model, inputs, task, data.get("creditsConsumed"), data.get("costTime"))
        if state == "fail":
            msg = data.get("failMsg") or json.dumps(data)
            raise (Transient if "Internal Error" in msg else Failed)(f"task {task} failed: {msg}")
        time.sleep(POLL_S)
    raise Transient(f"task {task} unfinished after {TIMEOUT_S:.0f} s")



def kie_call(method: str, url: str, key: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        url,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    return kie_send(req, 60)


def kie_send(req: urllib.request.Request, timeout: float) -> dict:
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as e:
        raise (Transient if e.code >= 500 else Failed)(f"HTTP {e.code} from {req.full_url}") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise Transient(f"{req.full_url}: {e}") from e
    code = payload.get("code")
    if code != 200:
        text = json.dumps(payload)
        transient = isinstance(code, int) and code >= 500 or "Internal Error" in text
        raise (Transient if transient else Failed)(f"kie.ai error: {text}")
    return payload["data"]


@functools.cache
def kie_upload(path: str, key: str) -> str:
    """Upload a local file (once per run); return its temporary download URL."""
    file = Path(path)
    boundary = uuid.uuid4().hex
    mime = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
    name = f"{uuid.uuid4().hex[:8]}-{file.name}"
    parts = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="uploadPath"\r\n\r\nqwen-refs\r\n',
        f'--{boundary}\r\nContent-Disposition: form-data; name="fileName"\r\n\r\n{name}\r\n',
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
        f"Content-Type: {mime}\r\n\r\n",
    ]
    body = "".join(parts).encode() + file.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        KIE_UPLOAD,
        method="POST",
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    return kie_send(req, 120)["downloadUrl"]


# --- End of the provider seam.


def run(job: Job, key: str) -> Path:
    """Generate with retries, then write the image and its sidecar."""
    started = time.monotonic()
    for attempt in range(1, ATTEMPTS + 1):
        try:
            out = generate(job, key)
            break
        except Transient as e:
            if attempt == ATTEMPTS:
                raise Failed(f"{e} (gave up after {ATTEMPTS} attempts)") from e
            print(f"retry {attempt}/{ATTEMPTS - 1} {rel(job.output)}: {e}", file=sys.stderr)
            time.sleep(BACKOFF_S * attempt)
    job.output.parent.mkdir(parents=True, exist_ok=True)
    job.output.write_bytes(out.png)
    meta = {
        "subject": job.subject,
        "prompt": job.prompt,
        "preset": job.preset,
        "seed": job.seed,
        "model": out.model,
        "references": [rel(r) for r in job.references],
        "inputs": out.inputs,
        "seconds": round(time.monotonic() - started, 1),
        "task_id": out.task_id,
        "cost_credits": out.credits,
        "cost_usd": round(out.credits * KIE_USD_PER_CREDIT, 4) if out.credits else None,
        "provider_seconds": out.provider_seconds,
    }
    job.output.with_suffix(".json").write_text(json.dumps(meta, indent=2) + "\n")
    return job.output


def api_key() -> str:
    key = os.environ.get("KIE_API_KEY")
    if key:
        return key
    env_file = REPO / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("KIE_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise Failed("KIE_API_KEY not set (environment or repo-root .env)")


def batch_jobs(path: Path) -> list[Job]:
    base = path.resolve().parent
    jobs = []
    for i, j in enumerate(json.loads(path.read_text())):
        if not isinstance(j, dict) or "subject" not in j or "output" not in j:
            raise Failed(f"{path} job {i}: needs subject and output")
        jobs.append(
            make_job(
                j["subject"],
                base / j["output"],
                preset=j.get("preset"),
                seed=j.get("seed"),
                images=[r if r.startswith(("http://", "https://")) else str(base / r) for r in j.get("image", [])],
                aspect=j.get("aspect"),
                resolution=j.get("resolution", "1K"),
                transparent=j.get("transparent", False),
                enhance=j.get("enhance", True),
            )
        )
    return jobs


def run_batch(jobs: list[Job], key: str) -> int:
    """Run the jobs not yet done, CONCURRENCY at a time; return how many failed."""
    todo = [j for j in jobs if not (j.output.exists() and j.output.with_suffix(".json").exists())]
    print(f"{len(todo)} of {len(jobs)} job(s) to run", flush=True)

    def one(job: Job) -> str:
        try:
            return f"ok {rel(run(job, key))}"
        except Failed as e:
            return f"FAIL {rel(job.output)}: {e}"

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        lines = list(pool.map(one, todo))
    for line in lines:
        print(line, flush=True)
    return sum(line.startswith("FAIL") for line in lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("subject", nargs="?", help="the prompt, or with --preset the subject only")
    p.add_argument("-o", "--output")
    p.add_argument("--batch", type=Path, help="a JSON list of jobs (see the module doc)")
    p.add_argument("--preset", help="a house style from assets/style/presets.json")
    p.add_argument("--aspect", help="default: the preset's, else 1:1 (t2i) / auto (i2i)")
    p.add_argument("--resolution", default="1K", choices=["1K", "2K"])
    p.add_argument("--transparent", action="store_true")
    p.add_argument("--seed", type=int)
    p.add_argument("--image", action="append", default=[], help="reference image path or URL")
    p.add_argument("--no-enhance", action="store_true", help="disable kie.ai prompt rewriting")
    args = p.parse_args(argv)
    try:
        if args.batch is not None:
            if args.subject or args.output:
                p.error("--batch takes no subject or -o")
            return 1 if run_batch(batch_jobs(args.batch), api_key()) else 0
        if not args.subject or not args.output:
            p.error("SUBJECT and -o are required without --batch")
        job = make_job(
            args.subject,
            Path(args.output).resolve(),
            preset=args.preset,
            seed=args.seed,
            images=args.image,
            aspect=args.aspect,
            resolution=args.resolution,
            transparent=args.transparent,
            enhance=not args.no_enhance,
        )
        print(rel(run(job, api_key())))
        return 0
    except Failed as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
