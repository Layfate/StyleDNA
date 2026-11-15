# Distribution and release checks

The public repository is [Layfate/StyleDNA](https://github.com/Layfate/StyleDNA). StyleDNA creates reusable style skills from images. Installers bundle the Python service; end users do not install Node, Python, Rust, or uv.

## Preview downloads

Use the files attached to a [GitHub release](https://github.com/Layfate/StyleDNA/releases), rather than the source-code ZIP, to install the app. Preview installers are **unsigned**. The maintainer currently has no Windows signing certificate or Apple Developer account; no trusted signing or Apple notarization is claimed.

- Windows x64: choose `-setup.exe` for a per-user install or `.msi` for a managed machine install. WebView2 is required; the installers can bootstrap it when missing. Review the release checksums before installing.
- macOS: choose the archive/DMG matching your processor. Preview applications have no Developer ID signature or notarization and may be blocked by Gatekeeper. Do not disable Gatekeeper globally. Source builds are an alternative for developers.
- Linux x64: choose the Debian, RPM, or AppImage package appropriate for your distribution. Ubuntu 24.04 is the CI build baseline; compatible WebKitGTK 4.1 system libraries are required.

The release's `SHA256SUMS.txt` verifies file integrity, not publisher identity. On Windows, use `Get-FileHash <download> -Algorithm SHA256`; on macOS use `shasum -a 256 <download>`; on Linux use `sha256sum -c SHA256SUMS.txt` beside all downloaded files.

## Repeatable verification

1. Push the intended commit and wait for **Checks** to pass.
2. Run **Desktop build candidates** against that same commit/branch.
3. Each platform builds its own bundled service and native application. Its standalone smoke runs real reference import, numerical analysis, package import, and parent-pipe shutdown, with the working directory outside the checkout.
4. Windows installs both MSI and NSIS on a disposable hosted runner. Each installed app exercises the real desktop workflow, native export, clipboard, sizing, and unsaved-close recovery. It then uninstalls and verifies the test library survives.
5. macOS checks the service embedded inside the `.app`. Linux installs the `.deb`, runs the installed service, and removes the package. DMG, RPM, and AppImage builds are also required to succeed.
6. Download artifacts only from successful jobs for the exact intended commit. Compute SHA-256 checksums, create a preview release targeting that commit, and upload the packages plus manifest. Do not relabel an unsigned build as signed.

Hosted runners are fresh CI environments with preinstalled system components. These checks do not establish behavior on every retail Windows/macOS/Linux installation. Windows installer bootstrapping without an existing WebView2 runtime and macOS/Linux UI behavior require separate machine testing.

`scripts/smoke-sidecar.py --binary <path>` can verify a deployed service. `STYLEDNA_SMOKE_APP` and `STYLEDNA_SMOKE_DATA_DIR` configure the Windows desktop smoke. Installer automation refuses to run outside a disposable GitHub Actions runner.

## Trusted signing remains an external prerequisite

Windows public publisher signing requires an appropriate CA-issued code-signing identity or an eligible Microsoft signing service. macOS Developer ID signing and notarization require an Apple Developer identity and notarization credentials. Store those in protected CI secrets or a hardware-backed signing service; never commit certificates, passwords, private keys, or Apple credentials.

When identities are available, follow Tauri's official [Windows signing](https://v2.tauri.app/distribute/sign/windows/) and [macOS signing/notarization](https://v2.tauri.app/distribute/sign/macos/) instructions. Configure the real publisher identity, sign all nested executables including the packaged service, sign installers, notarize/staple macOS bundles, and verify the resulting signatures on the target OS before publishing a signed release. An updater key or self-signed certificate does not replace trusted publisher signing.
