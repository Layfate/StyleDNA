import argparse
import json
import socket
import sys
import threading
from pathlib import Path

import uvicorn

from .app import create_app
from .config import default_data_dir


def main():
    parser = argparse.ArgumentParser(description="StyleDNA application-owned local service")
    parser.add_argument("--data-dir", type=Path, default=default_data_dir())
    args = parser.parse_args()
    try:
        config = json.loads(sys.stdin.readline())
        token = config["token"]
        if not isinstance(token, str) or len(token) < 32 or len(token) > 256:
            raise ValueError()
    except (KeyError, ValueError, TypeError):
        print("StyleDNA requires a per-launch session secret over stdin.", file=sys.stderr)
        return 2
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    url = f"http://127.0.0.1:{sock.getsockname()[1]}"

    class ReadyServer(uvicorn.Server):
        async def startup(self, sockets=None):
            await super().startup(sockets=sockets)
            if self.started:
                print(json.dumps({"event": "ready", "url": url}), flush=True)

    server = ReadyServer(
        uvicorn.Config(
            create_app(args.data_dir.resolve(), token),
            log_level="warning",
            access_log=False,
            server_header=False,
            timeout_graceful_shutdown=5,
        )
    )

    def parent_watchdog():
        # stdin stays open for the owned process lifetime. EOF means parent exit.
        sys.stdin.read()
        server.should_exit = True

    threading.Thread(target=parent_watchdog, daemon=True).start()
    try:
        server.run(sockets=[sock])
    finally:
        sock.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
