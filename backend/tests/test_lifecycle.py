import json
import os
import queue
import subprocess
import sys
import threading

import httpx


def test_owned_service_announces_readiness_and_exits_on_parent_pipe_close(tmp_path):
    env = {**os.environ, "PYTHONPATH": "backend"}
    process = subprocess.Popen(
        [sys.executable, "-m", "styledna", "--data-dir", str(tmp_path)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
    )
    try:
        process.stdin.write(json.dumps({"token": "a" * 48}) + "\n")
        process.stdin.flush()
        lines = queue.Queue()
        threading.Thread(target=lambda: lines.put(process.stdout.readline()), daemon=True).start()
        line = lines.get(timeout=20)
        ready = json.loads(line)
        assert ready["event"] == "ready"
        assert ready["url"].startswith("http://127.0.0.1:")
        assert "a" * 48 not in line
        with httpx.Client(trust_env=False) as client:
            assert client.get(ready["url"] + "/health").status_code == 200
            assert client.get(ready["url"] + "/api/skills").status_code == 401
        process.stdin.close()
        assert process.wait(timeout=10) == 0
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
