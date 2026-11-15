# Public preview release implementation plan

> **For agentic workers:** Use superpowers:executing-plans to execute this already-authorized release work.

**Goal:** Publish StyleDNA's image-to-skill application publicly with verified platform builds and honest release limits.

**Architecture:** Keep the working desktop app unchanged. Add repeatable packaged-runtime and Windows installer checks to the existing platform build workflow, run those builds on GitHub, and publish only successful artifacts with checksums. Verify the optional Ollama path using a real local vision model and record the evidence.

**Tech stack:** Existing Tauri / React / Python application, GitHub Actions, GitHub CLI, Ollama.

**Spec:** `docs/PRODUCT_SCOPE.md` and the user's explicit approval to perform remaining release checks and publish a public GitHub repository.

## Constraints

- StyleDNA generates style skills; image synthesis remains outside scope.
- Do not publish credentials, user libraries, private references, or development data.
- Public repository: authenticated account Layfate, repository StyleDNA.
- The user has no signing certificates or Apple Developer account. Publish explicitly unsigned preview artifacts; do not claim trusted signing or notarization.
- Hosted CI installation tests are fresh-runner checks, not proof of every clean retail OS configuration.
- Preserve the existing feature workspace and build cache; release work starts from commit 9122a8e on feat/phase-one.

## Tasks

- [x] Audit source/history for accidental credentials or large build/data objects; create public repository and run existing CI.
- [x] Make packaged-sidecar smoke platform independent; verify installer install/launch/uninstall on a fresh Windows runner and package startup on other platform runners.
- [x] Test actual single- and multi-reference Ollama vision analysis without simulated responses; verify saved/exported skill output.
- [x] Fix CI failures from evidence, then publish passing unsigned installers and SHA-256 checksums as a preview release.
- [x] Update installation, verification, and signing documentation; perform an independent release review and verify public URLs/assets.

## Review focus

- Hosted runners must exercise bundled Python, rather than silently using development dependencies.
- Windows install/uninstall must target an isolated path and preserve user data.
- Artifacts must match the published commit and their checksum manifest.
- No failed-platform artifacts or unsigned macOS notarization claims.
- Ollama results must be actual validated style analysis with provenance and human-review guidance.
