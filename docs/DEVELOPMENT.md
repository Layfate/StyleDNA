# Development

Use Node 24 LTS, corepack/pnpm 12.21.0, uv, and Python 3.12 (`.python-version`). Native builds use Rust 1.90+ and Tauri 2 platform prerequisites. Install with `corepack pnpm install --frozen-lockfile` and `uv sync --locked`.

## Browser workflow

`corepack pnpm dev` runs `scripts/dev.mjs`: generate a session secret, spawn the Python service with the secret over stdin, wait for its readiness event, and start Vite at `127.0.0.1:1420`. The Vite proxy attaches authorization from server-side environment variables after host/origin validation. The browser receives no development backend secret.

`STYLEDNA_DATA_DIR` selects a different development data directory; defaults to `.styledna-dev/`. Do not put user data under version control. The backend exposes no unauthenticated data routes. A directly started service needs its launch JSON on stdin; use the launcher rather than a persistent token in shell history.

Browser tests use `.styledna-dev/e2e/` and real HTTP/SQLite/image processing. Tests create their own skill identities and can run repeatedly without deleting data. `corepack pnpm exec playwright install chromium` installs the test browser. `corepack pnpm test:e2e` owns and stops its development server.

## Desktop workflow

Run `corepack pnpm build:sidecar`, then `corepack pnpm desktop`. The PyInstaller build outputs a target-named standalone Python service into `src-tauri/binaries/`. Tauri starts and authenticates this binary, not the development service. Python changes require rebuilding it; React changes use Vite hot reload.

`corepack pnpm build:desktop` rebuilds the sidecar and produces native bundles. To restrict formats use `corepack pnpm build:sidecar` followed by `corepack pnpm tauri build --bundles nsis,msi` on Windows, `--bundles app,dmg` on macOS, or `--bundles appimage,deb,rpm` on Linux. Build on the target OS/architecture. No cross-compiling the Python service is attempted.

The package identifier determines the native app-data path. The Rust host passes it explicitly to Python. The bare Python module's default path is named `StyleDNA`; launchers pass their own paths. Settings shows the active directory so users can distinguish development and installed data.

## Checks and failures

Run `uv run pytest -q`, `uv run ruff check backend scripts`, `uv run ruff format --check backend scripts`, `corepack pnpm test`, `corepack pnpm build`, and `corepack pnpm test:e2e`. After building a sidecar, run `cargo check` / `cargo test` with `--manifest-path src-tauri/Cargo.toml`. `cargo fmt --manifest-path src-tauri/Cargo.toml --check` checks native formatting.

A missing sidecar is an actionable build prerequisite, not a model failure. If an image is valid but its normalized PNG exceeds 20 MiB, resize it and retry so its exported package remains reimportable. If Ollama output fails schema validation, retry with a supported vision model or explicitly choose local measurements; no fallback is automatic.

The HTTP adapter has fixture tests. A live inference test requires a real user-installed model and is recorded separately. CI does not download model weights. The backend never writes analysis directly into a saved skill: the editor applies results and the user saves them.

## Releases

The manual build matrix uploads version-named build artifacts only from successful jobs. It does not create releases or claim signing/notarization. Public releases require target-platform installation testing, code signing/notarization where appropriate, and a reviewed release decision. Keep platform claims in `VERIFICATION.md` aligned with actual evidence.
