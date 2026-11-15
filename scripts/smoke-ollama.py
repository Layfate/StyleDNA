"""Opt-in live vision check through the packaged service; never downloads a model."""

import argparse
import hashlib
import io
import json
import os
import queue
import secrets
import subprocess
import tempfile
import threading
import time
import zipfile
from pathlib import Path

import httpx
from PIL import Image, ImageOps

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--model", required=True, help="An already installed local vision model")
parser.add_argument("--url", default="http://127.0.0.1:11434")
parser.add_argument("--binary", type=Path)
parser.add_argument(
    "--report", type=Path, help="Optional JSON evidence containing synthetic test data"
)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
binary = args.binary or root / "build/sidecar" / (
    "styledna-service.exe" if os.name == "nt" else "styledna-service"
)
assert binary.is_file(), "Build the packaged service first"
reference = (root / "examples/amber-study.png").read_bytes()
with Image.open(io.BytesIO(reference)) as image:
    transformed = io.BytesIO()
    ImageOps.mirror(image).save(transformed, format="PNG")
report = {
    "model": args.model,
    "reference_sha256": hashlib.sha256(reference).hexdigest(),
    "cases": [],
}
with tempfile.TemporaryDirectory(prefix="styledna-live-vision-") as temporary:
    process = subprocess.Popen(
        [str(binary.resolve()), "--data-dir", temporary],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=temporary,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    try:
        token = secrets.token_urlsafe(48)
        process.stdin.write(json.dumps({"token": token}) + "\n")
        process.stdin.flush()
        lines = queue.Queue()
        threading.Thread(target=lambda: lines.put(process.stdout.readline()), daemon=True).start()
        ready = json.loads(lines.get(timeout=90))
        with httpx.Client(
            base_url=ready["url"],
            headers={"Authorization": f"Bearer {token}"},
            trust_env=False,
            timeout=30,
        ) as client:

            def checked(method, path, **kwargs):
                response = client.request(method, path, **kwargs)
                response.raise_for_status()
                return response

            checked("PUT", "/api/settings", json={"ollama_url": args.url})
            available = checked("GET", "/api/providers/ollama").json()
            assert available["available"], available
            assert any(m["name"] == args.model and m["vision"] for m in available["models"])
            refs = checked(
                "POST",
                "/api/assets",
                files=[
                    ("files", ("amber-study.png", reference, "image/png")),
                    ("files", ("amber-study-mirrored.png", transformed.getvalue(), "image/png")),
                ],
            ).json()
            for count in (1, 2):
                reference_ids = [r["id"] for r in refs[:count]]
                started = time.monotonic()
                job = checked(
                    "POST",
                    "/api/jobs",
                    json={"reference_ids": reference_ids, "mode": "ollama", "model": args.model},
                ).json()
                print(f"Running real Ollama analysis: {count} reference(s)", flush=True)
                deadline = time.monotonic() + 900
                while job["state"] in ("queued", "running") and time.monotonic() < deadline:
                    time.sleep(0.5)
                    job = checked("GET", f"/api/jobs/{job['id']}").json()
                assert job["state"] == "completed", job
                result = job["result"]
                assert result["mode"] == "ollama" and result["model"] == args.model
                assert len(result["observations"]) == count and result["palette"]
                assert any(
                    t["value"] and t["source"] == "ollama" for t in result["traits"].values()
                )
                assert checked("GET", "/api/skills").json()["total"] == count - 1
                profile = {
                    "name": f"Live vision check {count}",
                    "reference_ids": reference_ids,
                    "analysis": result,
                    **{
                        k: result[k]
                        for k in (
                            "palette",
                            "traits",
                            "positive_rules",
                            "negative_constraints",
                            "subject_exclusions",
                        )
                    },
                }
                saved = checked(
                    "POST", "/api/skills", json={"profile": profile, "expected_revision": 0}
                ).json()
                exported = checked("GET", f"/api/skills/{saved['profile']['id']}/export?format=zip")
                with zipfile.ZipFile(io.BytesIO(exported.content)) as bundle:
                    exported_profile = json.loads(bundle.read("style.json"))
                    assert exported_profile["analysis"] == result
                    assert bundle.read("SKILL.md").decode() == saved["markdown"]
                    assert sum(n.startswith("references/") for n in bundle.namelist()) == count
                report["cases"].append(
                    {
                        "reference_count": count,
                        "seconds": round(time.monotonic() - started, 2),
                        "result": result,
                        "saved_revision": saved["revision"],
                        "package_sha256": hashlib.sha256(exported.content).hexdigest(),
                    }
                )
                print(
                    f"Live vision: {count} reference(s), validated traits, save and ZIP export PASS",
                    flush=True,
                )
        process.stdin.close()
        assert process.wait(timeout=20) == 0
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
if args.report:
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
