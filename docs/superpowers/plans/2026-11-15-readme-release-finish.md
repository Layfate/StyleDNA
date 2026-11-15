# README branding and release completion

> **For agentic workers:** Use superpowers:executing-plans to perform this user-authorized documentation and publication follow-up.

**Goal:** Make the supplied logo readable in the README and finish the requested GitHub release publication.

**Architecture:** Preserve the existing application, supplied artwork, feature workspace, and validated build artifacts. Improve the GitHub-rendered README header and release downloads. Reuse binaries only after checking their SHA-256 hashes against the successful exact-source build record; retain unsigned status and platform verification limits.

**Tech stack:** Markdown/HTML, existing Python/React checks, GitHub CLI and releases.

**Spec:** The user's request to finish StyleDNA, fix its README logo, and publish releases; `PRODUCT_SCOPE.md`; the completed public release plan.

## Tasks

- [x] Center and enlarge the original transparent logo, title, tagline, checks badge, and navigation in the README. Verify the rendered HTML and image URL.
- [x] Confirm the existing package provenance, hashes, successful build jobs, and current application checks. No application changes or replacement artwork are needed.
- [x] Update release documentation and notes consistently with the chosen release status. Preserve the original preview and the exact binary source record if a main release is created.
- [ ] Review the documentation and publication changes, push the README, and wait for the exact documentation commit's GitHub checks.
- [ ] Publish/update the release requested by the user and verify public downloads, manifests, release status, and repository state.

## Transfer adjustment

The local upload progressed too slowly to complete promptly and was stopped with the empty draft retained. Stage the existing verified preview assets from a GitHub-hosted runner instead. The manual staging workflow must check the source tag, complete manifest, package sizes/hashes, and resulting draft assets; it must not publish or overwrite mismatched content.

## Review focus

- GitHub supports the header markup, the image remains relative to the repository, and the original bitmap is unchanged.
- Download links resolve to the published platform and architecture assets.
- Published hashes, source commits, and build provenance match the actual binaries. A documentation-only change does not imply rebuilt binaries.
- Unsigned installers and unverified macOS/Linux desktop UI behavior remain disclosed.
- Release preference was offered as optional clarification. After allowing time for a reply, proceed with the stated main-release choice under the user's publication authorization; preserve the preview and verification limits.
