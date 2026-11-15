# Security policy

StyleDNA 0.1 is an initial local-first implementation. Security fixes target the latest development version; no long-term support branches are promised.

## Reporting

Do not publish vulnerabilities containing exploit packages, private images, local paths, or credentials in a public issue. If the hosted repository has GitHub private vulnerability reporting enabled, use **Security → Report a vulnerability**. Otherwise contact a repository maintainer privately through their listed contact channel. This local repository does not invent a support email or claim a reporting service has been enabled.

Include the affected version, OS, minimal reproduction, impact, and whether the flaw crosses the webview, loopback API, package, or image boundary. Redact user data.

## Boundaries

- The backend binds only loopback, uses a random per-launch bearer secret, checks origin/host, caps request sizes, and disables interactive API documentation.
- The desktop owns the service and kills it on exit; the service also watches its parent stdin pipe. The development proxy checks origin/host before injecting authorization.
- Images are decoded under byte/pixel limits with bounded concurrency. Originals are untouched. Managed copies and portable references strip metadata.
- ZIP entries are never extracted to attacker-chosen paths. Imports validate schemas, checksums, manifest membership, duplicate paths, link flags, file counts, compression ratios, and expanded sizes before saving a skill. Failed imports remove newly created assets.
- Markdown is displayed as inert text; generated/imported content is never executed. Exported Markdown is recompiled from the validated profile on import.
- Ollama URLs are pinned to loopback IPs, ignore environment proxies, and do not follow redirects. Cloud-routing metadata and cloud model tags are rejected. A trusted local Ollama installation and correctly reported model metadata are part of the trust boundary; StyleDNA cannot police independent local services.

The service token is not an OS user boundary: software running as the same user may inspect process memory or alter local files. App data is not encrypted at rest. Operating-system protections and full-disk encryption remain relevant. No general-purpose shell/filesystem access is granted to the webview. Phase 1 stores no external provider credentials.
