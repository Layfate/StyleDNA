# StyleDNA Phase One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved desktop image-to-skill workflow with durable storage and safe portable packages.

**Architecture:** React consumes a typed authenticated FastAPI API. Python owns assets, jobs, analysis, SQLite revisions, compilation, and ZIPs. Tauri owns backend process lifecycle and gives its webview per-launch connection information.

**Tech Stack:** Tauri 2, React, TypeScript, Vite, Tailwind, Radix/shadcn UI, Lucide, Motion, pnpm; Python 3.12, FastAPI, Pydantic, Pillow, OpenCV, SQLite, httpx, PyInstaller.

**Spec:** `docs/superpowers/specs/2026-11-15-styledna-design.md`

## Global Constraints

- Phase 1 only; no simulated inference or generation, no telemetry, local loopback inference only.
- 20 references per skill, 20 MiB per input, 40 megapixels, 2,048-pixel inference previews, 320-pixel thumbnails.
- 200 MiB total upload and 250 MiB expanded package limits. Originals untouched.
- Immutable revisions, staged asset writes, explicit analysis modes, no silent fallback.
- Restricted local API, no credentials in browser bundles, generated content is inert.
- Document unrun platforms and live model tests accurately; do not publish releases.

## Review Focus

- Malformed images and ZIP path tricks must leave no partial library entries (Tasks 1–2).
- Model errors or cancellation must never overwrite saved work (Task 3).
- Stale editor state and navigation must not silently lose user edits (Task 4).
- Browser requests from unexpected origins/hosts must not reach local data (Tasks 3, 5).
- Desktop service startup failures and exit must not leave owned processes running (Task 5).

### Task 1: Domain, safe image assets, measurements, deterministic compilation

**Files:** `pyproject.toml`, `backend/styledna/{models,assets,analysis,compiler,config}.py`, `backend/tests/test_core.py`.

**Interfaces:** `StyleProfile`; `AssetStore.import_image(data: bytes, filename: str) -> Reference`; `measure(path: Path) -> Measurements`; `compile_skill(profile: StyleProfile) -> str`.

- [ ] Write failing tests for valid image content with misleading extensions, corrupt/animated input, actual red-image measurements, semantic fields remaining empty, and frontmatter/Markdown escaping.
- [ ] Run `uv run pytest backend/tests/test_core.py -q`; observe missing implementation, then implement bounded decoding, normalization, measurement, schema, compiler.
- [ ] Repeat tests until all pass, then commit the tested domain.

### Task 2: SQLite library, revisions, and safe portable packages

**Files:** `backend/styledna/{database,packages}.py`, `backend/tests/test_library.py`.

**Interfaces:** `Library.save(profile, expected_revision)`, `get/list/delete/duplicate/revisions/restore`; `export_package(library, assets, skill_id) -> bytes`; `import_package(library, assets, data) -> dict`.

- [ ] Write tests for restart persistence, revision conflict protection, restore-as-new-revision, literal substring search, favorites, shared asset lifetime, and new-ID package roundtrip.
- [ ] Add traversal, absolute/backslash/symlink/duplicate ZIP, bad hash, excessive size, and failed-import atomicity tests.
- [ ] Run `uv run pytest backend/tests/test_library.py -q` RED, implement, run full `uv run pytest -q` GREEN, commit.

### Task 3: Real API, bounded jobs, and Ollama adapter

**Files:** `backend/styledna/{app,jobs,ollama,__main__}.py`, `backend/tests/{test_api,test_ollama}.py`.

**Interfaces:** `/api/assets`, `/api/skills`, revision/action/export routes, `/api/jobs`, `/api/providers/ollama`, `/api/settings`; `create_app(data_dir, token, ...) -> FastAPI`.

- [ ] Write HTTP integration tests for unauthorized/unexpected-origin access, real import/analyze/save/reload/export/reimport, multipart limits, failed/cancelled jobs, startup interruption, and clean provider errors.
- [ ] Write HTTP-fixture tests for model vision capability, schema validation, and local-only endpoint enforcement; do not substitute these for live inference verification.
- [ ] Run RED, implement and verify `uv run pytest -q`, commit.

### Task 4: Accessible creative workspace and real-data pages

**Files:** root frontend config, `src/{App,main,styles}`, `src/lib/{api,types,editor}`, `src/components/`, `src/pages/`, `tests/editor.test.ts`, `e2e/workflow.spec.ts`.

**Interfaces:** strict types matching Pydantic, authenticated blob API client, explicit editor draft and saved revision, reusable accessible buttons/dialogs.

- [ ] Write failing editor tests for persisted/unsaved distinction, subject-independent profile changes, and stale analysis results. Define browser workflow test for import/edit/save/reload/export/reimport.
- [ ] Implement lazy pages, sidebar, real empty state, drag/drop reference tray, modes, profile editing, live text Markdown preview, library filters/actions/revisions, provider/theme settings, honest planned pages.
- [ ] Wire all actions to the API, bounded blob thumbnail caching, progress/cancel/errors, discard confirmation, shortcuts, focus/reduced motion.
- [ ] Run unit tests, `pnpm build`, and real-backend Playwright workflow. Commit.

### Task 5: Desktop ownership, development launcher, and packaging

**Files:** `src-tauri/`, `scripts/{dev,build-sidecar}.mjs`, `scripts/sidecar-entry.py`, `backend/tests/test_lifecycle.py`.

**Interfaces:** Tauri `backend_connection` command returns `{url,token}` after service readiness; host shuts owned child down. Vite dev proxy adds token server-side.

- [ ] Write lifecycle tests for backend readiness and shutdown, assert origin/host boundaries in integration suite.
- [ ] Implement target-named PyInstaller executable, Tauri externalBin setup, restrictive CSP/capabilities, random secret passed via stdin, loopback ephemeral port announced via stdout, host cleanup on startup failure/exit.
- [ ] Verify `cargo check`, packaged sidecar launch, frontend desktop connection, available Windows build. Record missing platform tools rather than claim unverified artifacts. Commit.

### Task 6: Repository readiness and final verification

**Files:** `README.md`, `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CHANGELOG.md`, `docs/{DEVELOPMENT,ARCHITECTURE}.md`, `examples/`, `.github/workflows/`.

- [ ] Add accurate setup, offline/model distinctions, format/security docs, data/backup locations, MIT synthetic example generator and portable package, CI and manually triggered cross-platform build matrix.
- [ ] Run all backend/frontend/e2e/build/native checks available; inspect outputs and check for accidental tracked artifacts/secrets.
- [ ] Obtain the executing-plans whole-branch review; fix important findings with regression tests, rerun affected/full checks, and commit.
- [ ] Report working features, exact checks, and remaining generation/live-inference/platform limitations. Leave local work ready to use; do not push/publish.

## Execution notes

User explicitly requested immediate implementation after design approval; execute inline without another approval handoff. A fresh repository has no baseline tests or existing application branch to protect; initialize directly on `feat/phase-one`. Use a Windows-native progress ledger in place of POSIX bookkeeping scripts if necessary, preserving evidence and rulings.
