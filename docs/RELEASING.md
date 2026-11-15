# Distribution and release checks

The public repository is [Layfate/StyleDNA](https://github.com/Layfate/StyleDNA). StyleDNA creates reusable style skills from images. Installers bundle the Python service; end users do not install Node, Python, Rust, or uv.

## Downloads

Use the files attached to the [latest GitHub release](https://github.com/Layfate/StyleDNA/releases/latest), rather than the source-code ZIP, to install the app. Version [0.1.2](https://github.com/Layfate/StyleDNA/releases/tag/v0.1.2) publishes the same verified packages as the original [0.1.2 preview](https://github.com/Layfate/StyleDNA/releases/tag/v0.1.2-preview.1); no application code or binaries changed during this documentation and release update. Both tags target binary source commit `d4f675769688e3d15b79954f1178c6a423fccf8f`. The README improvements are published separately on `main`.

Installers are **unsigned**. The maintainer currently has no Windows signing certificate or Apple Developer account; no trusted signing or Apple notarization is claimed.

- Windows x64: choose `-setup.exe` for a per-user install or `.msi` for a managed machine install. WebView2 is required; the installers can bootstrap it when missing. Review the release checksums before installing.
- macOS Apple Silicon: choose the ARM64 archive/DMG. Intel Mac installers are not included. Applications have no Developer ID signature or notarization and may be blocked by Gatekeeper. Do not disable Gatekeeper globally. Source builds are an alternative for developers.
- Linux x64: choose the Debian, RPM, or AppImage package appropriate for your distribution. Ubuntu 24.04 is the CI build baseline; compatible WebKitGTK 4.1 system libraries are required.

The repository's [build record](BUILD_ARTIFACTS.json) includes each installer's SHA-256 hash for optional integrity checks. On Windows, use `Get-FileHash <download> -Algorithm SHA256`; on macOS use `shasum -a 256 <download>`; on Linux use `sha256sum <download>`. Compare the result with the matching file's `sha256` value in the record. Hashes verify file integrity, not publisher identity. Release downloads contain the seven platform packages; no separate verification file is needed to install or run StyleDNA.

## Repeatable verification

1. Push the intended commit and wait for **Checks** to pass.
2. Run **Desktop build candidates** against that same commit/branch.
3. Each platform builds its own bundled service and native application. Its standalone smoke runs real reference import, numerical analysis, package import, and parent-pipe shutdown, with the working directory outside the checkout.
4. Windows installs both MSI and NSIS on a disposable Windows Server 2022 hosted runner. Each installed app exercises the real desktop workflow, native export, clipboard, sizing, and unsaved-close recovery. It then uninstalls and checks the default library and references against their pre-uninstall hashes. Both roaming/local application-data sentinels must survive. Self-hosted runners and existing default StyleDNA data directories are rejected.
5. macOS checks the service embedded inside the `.app`. Linux installs the `.deb`, runs the installed service, and removes the package. DMG, RPM, and AppImage builds are also required to succeed.
6. Download artifacts only from successful jobs for the exact intended commit. Record SHA-256 checksums and build provenance in `docs/BUILD_ARTIFACTS.json`, create a release targeting that commit, and upload the platform packages. Mark experimental releases as prereleases. A documentation-only promotion may reuse the exact verified binaries and source tag; disclose that reuse in the release notes and preserve their build provenance. Do not relabel an unsigned build as signed.

For unchanged packages already attached to a published release, create the target draft and update `docs/BUILD_ARTIFACTS.json` with its tag while retaining the original build provenance. Manually run **Stage verified release assets** with the source release tag. It verifies the source tag and package sizes/hashes against the repository build record, plus the source release manifest when present, then transfers only the seven platform packages to the draft from a hosted runner. It refuses mismatched existing assets and does not publish the draft. Verify the resulting downloads and release notes before explicitly publishing.

Hosted runners are fresh CI environments with preinstalled system components. These checks do not establish behavior on every retail Windows/macOS/Linux installation. Windows installer bootstrapping without an existing WebView2 runtime and macOS/Linux UI behavior require separate machine testing.

`scripts/smoke-sidecar.py --binary <path>` can verify a deployed service. `STYLEDNA_SMOKE_APP` and `STYLEDNA_SMOKE_DATA_DIR` configure the Windows desktop smoke. Installer automation refuses to run outside a disposable GitHub Actions runner.

To repeat the optional live-model check, install a local vision model yourself, build the service, then run `uv run python scripts/smoke-ollama.py --model gemma3:4b`. An optional `--url` chooses another loopback Ollama endpoint; `--report <file>` writes synthetic test evidence. This exercises discovery, actual single-reference interpretation and multi-reference synthesis, explicit saving, and ZIP export with retained provenance. It does not download models or touch your normal StyleDNA library.

## Trusted signing remains an external prerequisite

Windows public publisher signing requires an appropriate CA-issued code-signing identity or an eligible Microsoft signing service. macOS Developer ID signing and notarization require an Apple Developer identity and notarization credentials. Store those in protected CI secrets or a hardware-backed signing service; never commit certificates, passwords, private keys, or Apple credentials.

When identities are available, follow Tauri's official [Windows signing](https://v2.tauri.app/distribute/sign/windows/) and [macOS signing/notarization](https://v2.tauri.app/distribute/sign/macos/) instructions. Configure the real publisher identity, sign all nested executables including the packaged service, sign installers, notarize/staple macOS bundles, and verify the resulting signatures on the target OS before publishing a signed release. An updater key or self-signed certificate does not replace trusted publisher signing.
