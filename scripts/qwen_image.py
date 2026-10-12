#!/usr/bin/env python3
"""Generate an image with Qwen Image 2.1 via the kie.ai job API.

Usage:
  scripts/qwen_image.py "prompt" -o out.png [--aspect 16:9] [--resolution 2K] [--transparent]
      [--seed N] [--image ref.png ...] [--no-enhance] [--sidecar]

Text-to-image by default (model qwen2-1/text-to-image). One or more --image switches to
qwen2-1/image-to-image (up to 10 references; local paths are uploaded to kie.ai temp storage,
http(s) URLs are passed through). Docs: https://docs.kie.ai/market/qwen2-1/image-to-image

--sidecar writes out.json next to the image: prompt, seed, model, references, inputs, seconds,
task id, and cost (kie.ai creditsConsumed; 1 credit = USD_PER_CREDIT).

Reads KIE_API_KEY from the environment or the repo-root .env.
"""

import argparse
import json
import mimetypes
import os
import sys
import time
import urllib.request
import uuid
from pathlib import Path

API = "https://api.kie.ai/api/v1/jobs"
# Docs (https://docs.kie.ai/file-upload-api/upload-file-stream) say api.kie.ai; that host 404s.
UPLOAD = "https://kieai.redpandaai.co/api/file-stream-upload"
CREDIT = "https://api.kie.ai/api/v1/chat/credit"
T2I = "qwen2-1/text-to-image"
I2I = "qwen2-1/image-to-image"
USD_PER_CREDIT = 0.005
REPO_ROOT = Path(__file__).resolve().parent.parent


def api_key() -> str:
    key = os.environ.get("KIE_API_KEY")
    if key:
        return key
    env_file = REPO_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("KIE_API_KEY="):
                return line.split("=", 1)[1].strip()
    sys.exit("KIE_API_KEY not set (env or .env)")


def call(method: str, url: str, key: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        url,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.load(resp)
    if payload.get("code") != 200:
        sys.exit(f"API error: {json.dumps(payload)}")
    return payload["data"]


def upload(path: Path, key: str) -> str:
    """Upload a local file via multipart stream upload; return its temporary download URL."""
    boundary = uuid.uuid4().hex
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    name = f"{uuid.uuid4().hex[:8]}-{path.name}"
    parts = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="uploadPath"\r\n\r\nqwen-refs\r\n',
        f'--{boundary}\r\nContent-Disposition: form-data; name="fileName"\r\n\r\n{name}\r\n',
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
        f"Content-Type: {mime}\r\n\r\n",
    ]
    body = "".join(parts).encode() + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        UPLOAD,
        method="POST",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        payload = json.load(resp)
    if payload.get("code") != 200:
        sys.exit(f"upload error: {json.dumps(payload)}")
    return payload["data"]["downloadUrl"]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("prompt")
    p.add_argument("-o", "--output", required=True)
    p.add_argument("--aspect", default=None, help="default 1:1 (t2i) / auto (i2i)")
    p.add_argument("--resolution", default="1K", choices=["1K", "2K"])
    p.add_argument("--transparent", action="store_true")
    p.add_argument("--seed", type=int)
    p.add_argument("--image", action="append", default=[], help="reference image path or URL")
    p.add_argument("--no-enhance", action="store_true", help="disable kie.ai prompt rewriting")
    p.add_argument("--sidecar", action="store_true", help="write <output>.json metadata")
    p.add_argument("--timeout", type=int, default=300)
    args = p.parse_args()
    if len(args.image) > 10:
        sys.exit("at most 10 reference images")

    key = api_key()
    started = time.time()
    model = I2I if args.image else T2I
    inputs: dict = {
        "prompt": args.prompt,
        "aspect_ratio": args.aspect or ("auto" if args.image else "1:1"),
        "resolution": args.resolution,
        "background": "transparent" if args.transparent else "opaque",
        "output_format": "png",
        "enhance_prompt": not args.no_enhance,
    }
    if args.seed is not None:
        inputs["seed"] = args.seed
    if args.image:
        inputs["image_urls"] = [
            ref if ref.startswith(("http://", "https://")) else upload(Path(ref), key)
            for ref in args.image
        ]

    task_id = call("POST", f"{API}/createTask", key, {"model": model, "input": inputs})["taskId"]
    print(f"task {task_id}", file=sys.stderr)

    deadline = time.time() + args.timeout
    while time.time() < deadline:
        data = call("GET", f"{API}/recordInfo?taskId={task_id}", key)
        state = data.get("state")
        if state == "success":
            urls = json.loads(data["resultJson"])["resultUrls"]
            out = Path(args.output)
            out.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(urls[0], out)
            if args.sidecar:
                credits = data.get("creditsConsumed")
                meta = {
                    "prompt": args.prompt,
                    "seed": args.seed,
                    "model": model,
                    "references": args.image,
                    "inputs": {
                        k: v for k, v in inputs.items() if k not in ("prompt", "image_urls")
                    },
                    "seconds": round(time.time() - started, 1),
                    "task_id": task_id,
                    "cost_credits": credits,
                    "cost_usd": round(credits * USD_PER_CREDIT, 4) if credits else None,
                    "kie_cost_seconds": data.get("costTime"),
                }
                out.with_suffix(".json").write_text(json.dumps(meta, indent=2) + "\n")
            print(out)
            return
        if state == "fail":
            sys.exit(f"generation failed: {data.get('failMsg') or json.dumps(data)}")
        time.sleep(3)
    sys.exit(f"timed out waiting for task {task_id}")


if __name__ == "__main__":
    main()
