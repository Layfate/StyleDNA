# Verification record

Host: Windows x64, 2026-11-15 (Asia/Manila). Node 24.21.0, Python 3.12.10, Rust 1.100.0, pnpm 12.21.0, uv 0.12.19.

| Check | Verified result |
| --- | --- |
| `uv run pytest -q` | 40 passed, including safe image/package handling, persistence/revisions, authorization, jobs, Ollama fixtures, and portable-package budgets |
| `uv run ruff check backend scripts` | Passed |
| `uv run ruff format --check backend scripts` | Passed |
| `corepack pnpm test` | 5 editor tests passed, including pending-save reconciliation and offline discard |
| `corepack pnpm build` | Strict TypeScript check and production Vite build passed |
| `corepack pnpm format:check` | Passed |
| `corepack pnpm test:e2e` | 11 real-backend Chromium tests passed |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Passed after the required sidecar was packaged |
| `cargo test --manifest-path src-tauri/Cargo.toml --release` | 2 passed: restricted export route and close protection independent of service availability |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | Passed |
| `corepack pnpm build:sidecar` | Standalone Windows Python service built with PyInstaller |
| `uv run python scripts/smoke-sidecar.py` | Packaged startup, real image import/measurements, package import, and parent-pipe shutdown passed |
| `node scripts/smoke-desktop.mjs` | Actual Tauri/WebView2 upload/analyze/edit/save, native ZIP save dialog, preview/copy, OS-window resizing, and unsaved-close recovery after service failure passed |
| `corepack pnpm tauri build --bundles nsis,msi` | Final NSIS `.exe` and WiX `.msi` release installers built successfully after all review fixes |

## UI verification

Checked the actual application at normal zoom (`visualViewport.scale === 1`) using OS windows sized 1440, 1280, 1100, and 900 pixels wide. Browser checks additionally verify readable form text, control heights, no horizontal document overflow, visible focus, pointer/keyboard split resizing, preview copy/collapse, sidebar controls, and theme persistence. A dedicated 1100 × 700 check verifies analysis/apply/save remain reachable with advanced options and the preview open.

Axe WCAG A/AA scans report zero violations on the studio and settings screens. Screenshots were inspected at normal zoom; this is implementation evidence, not a claim of exhaustive assistive-technology certification.

Browser workflows cover real import → measurements → apply/edit → save → reload → export → reimport; revision restore, favorite, duplicate, delete, themes, focused-tag keyboard saving, stale Open response ownership, deleted-draft recovery, and hostile-origin rejection. Native automation controls only its owned test process and saves beneath workspace `test-results/`.

## Review fixes

The completed read-only whole-branch review reported no Critical issues, four Important issues, and no deferred Minor issues. Each Important issue received a regression:

- Delayed Open responses cannot replace later navigation or a new draft.
- Discard restores an in-memory saved snapshot; deleting the retained skill invalidates the draft. Recovery does not depend on a working service.
- Saves/exports enforce aggregate package budgets, including metadata and archive overhead.
- Native close-handler readiness is independent of backend connectivity. A smoke deliberately stops the owned service and verifies the unsaved dialog still works.

The review's short-window recommendation reproduced clipped analysis controls. The final UI bounds and scrolls the options/progress area while keeping Analyze visible; its browser regression passes. Earlier focused-tag and pending-save edit loss also have RED→GREEN regressions.

## Unverified or not performed

- Live Ollama vision inference: HTTP fixtures pass; no model was downloaded or live inference claimed.
- macOS/Linux runtime/installers: workflows configured but not run on this Windows host.
- GitHub Actions: configured locally, not executed on GitHub.
- Clean-machine installer installation/uninstallation, signing, notarization, public releases, and GitHub publishing: not performed.
- Generation, generated-image history, adjustable reference weighting, similarity scoring, and LoRA workflows remain later phases.

No benchmark results or universal coding-agent compatibility are claimed. Tests use isolated data. The repository stays local on `feat/phase-one`; there is no remote or separate base branch to merge into.
