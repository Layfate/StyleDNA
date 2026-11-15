"""Smoke-test a packaged sidecar without using the development Python environment."""

import json
import queue
import subprocess
import tempfile
import threading
import time
from pathlib import Path

import httpx

root = Path(__file__).resolve().parent.parent
binary = next((root / "src-tauri" / "binaries").glob("styledna-service-*.exe"), None)
if not binary:
    raise SystemExit("Build the Windows sidecar first")
with tempfile.TemporaryDirectory(prefix="styledna-sidecar-") as temporary:
    process = subprocess.Popen(
        [str(binary), "--data-dir", temporary],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    try:
        token = "test-only-" + "a" * 48
        process.stdin.write(json.dumps({"token": token}) + "\n")
        process.stdin.flush()
        lines = queue.Queue()
        threading.Thread(target=lambda: lines.put(process.stdout.readline()), daemon=True).start()
        line = lines.get(timeout=40)
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
            "Packaged Windows sidecar: startup, image import, real measurements, package import, and shutdown PASS"
        )
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
