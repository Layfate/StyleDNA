"""Smoke-test a packaged sidecar without using the development Python environment."""

import argparse
import json
import os
import queue
import subprocess
import tempfile
import threading
import time
from pathlib import Path

import httpx

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--binary", type=Path, help="Test an installed/bundled service executable")
args = parser.parse_args()
suffix = ".exe" if os.name == "nt" else ""
binary = args.binary or root / "build" / "sidecar" / f"styledna-service{suffix}"
if not binary.is_file():
    raise SystemExit("Build the sidecar first, or pass --binary")
environment = {
    k: v for k, v in os.environ.items() if k not in {"PYTHONHOME", "PYTHONPATH", "VIRTUAL_ENV"}
}
with tempfile.TemporaryDirectory(prefix="styledna-sidecar-") as temporary:
    process = subprocess.Popen(
        [str(binary.resolve()), "--data-dir", temporary],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=environment,
        cwd=temporary,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    try:
        token = "test-only-" + "a" * 48
        process.stdin.write(json.dumps({"token": token}) + "\n")
        process.stdin.flush()
        lines = queue.Queue()
        threading.Thread(target=lambda: lines.put(process.stdout.readline()), daemon=True).start()
        line = lines.get(timeout=90)
        if not line:
            raise RuntimeError(process.stderr.read()[-3000:])
        ready = json.loads(line)
        with httpx.Client(
            base_url=ready["url"],
            headers={"Authorization": f"Bearer {token}"},
            trust_env=False,
            timeout=30,
        ) as client:
            assert client.get("/health").status_code == 200
            upload = client.post(
                "/api/assets",
                files={"files": ("study.png", (root / "examples/amber-study.png").read_bytes())},
            )
            upload.raise_for_status()
            ref_id = upload.json()[0]["id"]
            started = client.post(
                "/api/jobs", json={"reference_ids": [ref_id], "mode": "measurements"}
            )
            started.raise_for_status()
            for _ in range(100):
                job = client.get(f"/api/jobs/{started.json()['id']}").json()
                if job["state"] not in ("queued", "running"):
                    break
                time.sleep(0.1)
            assert job["state"] == "completed", job
            result = client.post(
                "/api/import",
                files={"file": ("example.zip", (root / "examples/amber-study.zip").read_bytes())},
            )
            result.raise_for_status()
            assert result.json()["profile"]["name"] == "Amber botanical study"
            assert client.get("/api/skills").json()["total"] == 1
        process.stdin.close()
        assert process.wait(timeout=15) == 0
        print(
            "Packaged sidecar: startup, image import, real measurements, package import, and shutdown PASS"
        )
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
