# Verification record

Host: Windows x64, 2026-11-15 (Asia/Manila). Node 24.21.0, Python 3.12.10, Rust 1.100.0, pnpm 12.21.0, uv 0.12.19.

## README and main release follow-up

Version [0.1.2](https://github.com/Layfate/StyleDNA/releases/tag/v0.1.2) promotes the seven previously verified preview packages without changing their bytes or application source. Both release tags target `d4f675769688e3d15b79954f1178c6a423fccf8f`; the original preview remains available. `BUILD_ARTIFACTS.json` and the new release manifest identify the main release and retain the original source commit, successful platform run, package sizes, and SHA-256 hashes. Documentation and the README header are updated separately on `main`.

The original logo bitmap is unchanged; GitHub's Markdown renderer retained its new centered 200 × 200 display and centered heading, and a headless-browser check confirmed the logo dimensions and alignment. Fresh local checks passed 40 backend tests, five editor tests, Ruff lint, the TypeScript/Vite production build, and Prettier formatting. All seven existing local packages were rehashed against the tracked CI build manifest before publication. A fresh read-only review found no blocking defects; its CI-link attribution correction was applied to the release notes. The platform and signing limits recorded below remain in effect.

The README and download-documentation commit `0b60bfe` passed the [complete GitHub Checks workflow](https://github.com/Layfate/StyleDNA/actions/runs/43715538064), including the real-backend browser suite. A slow local asset transfer was stopped before any files completed; the draft was retained. The manually dispatched staging workflow transfers the already verified packages between releases on a hosted runner, preserving their bytes and original build provenance.

The [hosted staging run](https://github.com/Layfate/StyleDNA/actions/runs/43716111237) and its [exact-commit Checks run](https://github.com/Layfate/StyleDNA/actions/runs/43716109325) both passed for `7a34e59`. Final publication verification confirmed `v0.1.2` is public, is not a prerelease, and is GitHub's latest release; the original preview is retained. All nine uploaded file sizes and SHA-256 digests matched the expected files. Anonymous requests verified the release/latest pages, all seven installer downloads, both manifests, and the unchanged logo at the exact binary source commit.

The standalone `SHA256SUMS.txt` and `release-manifest.json` attachments were subsequently removed from `v0.1.2` at the user's request. The release now contains only the seven platform packages. Package hashes and build provenance remain in the repository's `BUILD_ARTIFACTS.json`. The installer files are unchanged; the earlier nine-file verification records the original publication state.

## Public preview release validation

The repository is now public at [Layfate/StyleDNA](https://github.com/Layfate/StyleDNA). [GitHub Checks](https://github.com/Layfate/StyleDNA/actions/runs/43696211835) and [all three platform jobs](https://github.com/Layfate/StyleDNA/actions/runs/43696212373) passed for release source commit `d4f6757`. Release hardening changes affect verification scripts and documentation; the application remains version 0.1.2.

| Release platform | Successful hosted-runner checks |
| --- | --- |
| Windows x64 / Server 2022 | Built MSI/NSIS; installed each; ran deployed Python service and actual Tauri/WebView2 workflow (upload, analysis, edit, save, native ZIP dialog/export, clipboard, 900/1100/1280/1440 resizing at normal zoom, themes, service-failure/unsaved-close recovery); uninstalled each; default database/reference hashes and roaming/local sentinels retained |
| macOS ARM64 / macOS 15 | Built app/DMG; standalone and app-embedded Python service passed image import, real measurements, package import, and parent-pipe shutdown |
| Linux x64 / Ubuntu 24.04 | Built AppImage/DEB/RPM; standalone service passed; installed DEB, verified deployed service with real import/measurements/package/shutdown, then removed the package |

The release uses the exact-commit CI artifacts, not the earlier locally built Windows installers. `BUILD_ARTIFACTS.json` records their public filenames, sizes, SHA-256 hashes, source artifact names, source commit, and successful run. The old local build hashes are preserved separately in `LOCAL_WINDOWS_BUILD_ARTIFACTS.json`. Release tag: [`v0.1.2-preview.1`](https://github.com/Layfate/StyleDNA/releases/tag/v0.1.2-preview.1); seven platform packages plus checksum/JSON manifests, explicitly unsigned. Installed Windows screenshots at normal zoom were inspected for readability, spacing, and image/editor balance; the README image comes from the successful hosted native run.

Actual local Ollama vision inference passed using **Ollama 0.40.16, gemma3:4b (Q4_K_M), NVIDIA RTX 4060 8 GiB**. The packaged service discovered the installed vision model, analyzed the supplied synthetic Amber reference, and then analyzed the reference plus its mirrored variant and synthesized their shared traits. The cases took 76.92 s (cold first request) and 28.05 s (two observations plus synthesis). These are individual smoke-run durations, not benchmark claims. All four real `/api/chat` requests returned HTTP 200; model layers were offloaded to CUDA.

Both cases returned schema-valid nonempty style traits with Ollama provenance, retained numeric measurements, did not auto-save, and passed explicit save and portable ZIP verification. The ZIP's profile retained the complete analysis and its `SKILL.md` matched the saved compilation. The model described the synthetic reference as minimalist/geometric with earthy tones. This establishes working inference and export, not calibrated semantic accuracy or compatibility with every model. Repeat with `scripts/smoke-ollama.py`; tools/models were staged only under ignored verification directories, and the owned Ollama server was stopped after testing.

[Platform run 43695436864](https://github.com/Layfate/StyleDNA/actions/runs/43695436864) successfully built Linux x64 AppImage/DEB/RPM and macOS ARM64 app/DMG. The installed Debian service and embedded macOS service passed real import/measurement/package/shutdown checks. Its Windows MSI installed and its bundled service passed; the hosted UI check failed to establish WebView2 CDP, so that Windows job is **not** counted as a successful installer workflow. The following run pins Windows Server 2022 after investigating the documented upstream [runner/WebView2 issue](https://github.com/actions/runner-images/issues/14738).

A fresh release review found that the initial Windows retention check used a custom data folder and therefore could not detect default-data cleanup. The updated test exercises the actual default roaming directory, verifies database/reference hashes, checks roaming/local sentinels, and refuses self-hosted runners or preexisting StyleDNA data. Successful installation evidence must come from that updated test.

One local native recheck stopped at the Save As foreground guard before sending keyboard input. Dialog enumeration and targeted-control probes did not yield a successful export; this attempt is recorded as a failed automation run. The same native workflow subsequently passed twice from installed packages on the hosted Windows runner, including actual save dialogs. Browser/package verification and release-platform gates are recorded separately.

## Image-to-skill scope correction 0.1.2

The user clarified that StyleDNA generates reusable image-style skills. AI Generator, generated-image History, their planned screens, and their future roadmap entries were removed. Navigation now exposes Dashboard, Studio, Library, and Settings only. Saved skill revision history remains supported. `PRODUCT_SCOPE.md` is the current scope authority and overrides older design references.

The browser scope regression first failed on the old generator entry, then passed after removal. The full browser suite passes 11 tests, backend suite 40, editor suite 5, and native unit suite 2. Production frontend compilation, lint, formatting, and Windows installer builds passed. The actual Tauri/WebView2 smoke confirmed generator/history destinations are absent and exercised import, analysis, skill saving/export, clipboard, resizing, themes, and close recovery. Current installer filenames/hashes and the screenshot were refreshed for 0.1.2.

## Branding update 0.1.1

The supplied transparent blue helix/photo-frame logo is used unchanged in the sidebar and README. Desktop PNG/ICO/ICNS assets and the favicon are size/format conversions preserving transparency. The imported original's SHA-256 matches the supplied file. Version 0.1.1 identifies this branding update.

After this update, the backend suite passed 40 tests, editor suite passed 5, complete browser suite passed 11, and native unit suite passed 2. TypeScript/Vite, formatting, lint, packaged-service smoke, and the actual branded Tauri/WebView2 workflow passed. The new logo was inspected in the desktop app; all six ICO image variants were confirmed embedded in the Windows executable. Updated `.exe` and `.msi` installers were built; filenames and hashes are in `BUILD_ARTIFACTS.json`.

One initial browser run encountered a Windows access-denied error while publishing a staged upload; its isolated rerun and subsequent full suite passed. No image-import behavior was changed as part of this branding update.

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

## Remaining limits

- Generalized semantic model quality, unrelated reference sets, and all Ollama model families are not certified; the real inference smoke above covers the supplied synthetic study and a mirrored variant.
- macOS/Linux full desktop UI behavior and installation across retail OS configurations remain unverified. Their native packages and embedded/installed services have been checked on hosted platform runners.
- Trusted installer signing and Apple notarization are unavailable: the maintainer has no signing identities. Preview downloads must be labeled unsigned.
- Hosted CI runners include system dependencies. They do not prove installer bootstrapping on a retail Windows machine without WebView2 or test every Windows version.
- Image synthesis, generated-image history, and model training are outside the clarified product scope. Further work focuses on skill extraction/authoring quality, compatibility, reliability, and platform validation.

No benchmark results or universal coding-agent compatibility are claimed. Tests use synthetic references and isolated development data; installer data checks run only on fresh hosted runners. The local working branch is `feat/phase-one` and publishes to the public remote's `main` branch. See [release procedure and limitations](RELEASING.md).
