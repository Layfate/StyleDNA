# Contributing to StyleDNA

Read [development setup](docs/DEVELOPMENT.md) and the [architecture](docs/ARCHITECTURE.md). Keep changes focused and explain the user-visible behavior, privacy implications, and validation in the pull request.

Use strict TypeScript and validated Python models. Add regression tests for real failure cases, especially package/image parsing, revisions, cancellation, and local API boundaries. Use fixtures for external-provider tests; mark live inference checks separately. Never add a simulated fallback or upload images without an explicit user action.

Run the Python tests and Ruff checks, frontend tests/build, and affected browser/native checks before submitting. State unrun checks and missing platform prerequisites. Preserve pnpm, uv, and Cargo lockfiles. Do not commit user assets, `.styledna-dev/`, credentials, binaries, or build outputs.

Bug reports should include OS, app version, analysis mode, reproduction steps, and redacted error text. Share reference images only if you have permission and are comfortable doing so. Report vulnerabilities through the process in [SECURITY.md](SECURITY.md), not a public issue.
