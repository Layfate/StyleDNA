# StyleDNA — implementation brief

Build **StyleDNA**, an open-source, local-first desktop tool for turning reference images into editable, reusable AI style skills and `SKILL.md` files.

**Tagline:** Turn Images Into Reusable AI Style Skills.

## Outcome and scope

Start with a complete Phase 1 vertical slice: import images → analyze → edit a style profile → preview a generated `SKILL.md` → save to a persistent library → export a portable package → import that package again.

The primary user is a creator who wants to reuse a visual language across different subjects. Separate reusable style traits from the content of an individual reference. Never promise exact reproduction, present prompt guidance as training, or substitute simulated AI results when a provider fails.

Deliver the complete image-to-skill workflow. The product generates reusable skills and style profiles; in-app image synthesis, generation-provider integrations, generated-image history, and model training are outside scope. This follows the user's clarified intent in `docs/PRODUCT_SCOPE.md` and supersedes earlier image-generator plans.

## Required stack

- Tauri 2 desktop shell; React, TypeScript, Vite, pnpm.
- Tailwind CSS, accessible shadcn/ui components, Lucide icons, restrained Motion animations.
- Python 3.12+ FastAPI service; Pillow and headless OpenCV for image processing.
- SQLite with explicit schema migrations and indexed library queries.
- Pluggable analysis providers, starting with Ollama for local vision inference.

At implementation time, verify stable compatible dependencies against official documentation, pin resolved versions, and commit lockfiles. Prefer a small, readable architecture over speculative frameworks.

## Phase 1: required behavior

### Import and local processing

Accept PNG, JPEG, and WebP through file selection and drag-and-drop. Support several references per skill. Validate decoded content rather than trusting extensions; enforce configurable limits for bytes, pixels, reference count, and total workspace storage. Reject unsupported animation and corrupt images with actionable errors.

Create bounded previews and thumbnails, normalize orientation and color handling, strip metadata from exported reference copies, and keep user originals untouched. Use application-managed asset IDs rather than user paths in API requests. Store all data in the operating system's application data directory.

### Two explicit analysis modes

1. **Local measurements:** real palette, dimensions, contrast, saturation, luminance, and edge/texture measurements. These work without an AI model. Leave semantic fields unassessed until edited; do not invent art styles, materials, or composition labels from simple statistics.
2. **Ollama vision:** discover the local service and available models; use capability checks where available. Send reference previews only after the user selects this mode and starts analysis. Request schema-constrained output, validate it, and return clear errors for unavailable models, malformed responses, or unsupported capabilities. Never silently switch modes.

For multiple references, retain per-image findings and synthesize recurring traits separately from subject-specific details. The current implementation uses equal reference influence. Clearly identify measurements, model interpretations, and user edits. Model interpretations are suggestions, not calibrated confidence scores.

### Editable style profile

Define versioned validated Python models and corresponding strict TypeScript types. Include name, description, tags, category, palette, visual identity, lighting/shadows, linework, textures/materials, shapes/proportions, composition/perspective, backgrounds, rendering/shading, reusable positive rules, negative constraints, subject-specific exclusions, reference IDs, analysis provenance, and timestamps.

Users must be able to correct analysis before saving. Preserve saved revisions and distinguish unsaved edits. Saving creates a consistent snapshot of the profile and its generated Markdown.

### Skill compilation and library

Generate deterministic, readable `SKILL.md` content with safe frontmatter, purpose, when-to-use guidance, reusable visual rules, subject separation, prompt recipe, negative constraints, reference asset links, and limitations. Treat imported/model-generated text as inert data. Export instructions must not grant tool access, execute commands, or claim universal coding-agent compatibility.

The library supports persisted create/read/update/delete, duplicate, search, tags, category, favorites, thumbnails, and revision browsing/restoration. Include empty, loading, validation, failure, and retry states. Deletion requires a clear confirmation describing what is removed.

Export Markdown, JSON, and ZIP packages containing `SKILL.md`, `style.json`, a versioned manifest, and reference assets. Import ZIP packages with schema checks, expanded-size limits, safe path handling, no symlinks, and transactional writes. Reimport into a new skill ID. Reject invalid packages without leaving partial entries.

### Desktop interface

Use a dark, image-first creative workspace with warm neutral surfaces, restrained accent color, compact sidebar navigation, readable typography, accessible contrast, keyboard focus, reduced-motion support, and an optional light theme. Avoid oversized dashboard cards and decorative gradients.

Pages: Dashboard, Image-to-Skill Studio, Skill Library, Settings & AI Providers. Keep navigation focused on reference analysis, skill creation, library management, and exports. Retain skill revision history.

Studio layout: adjustable reference and profile panels, with a collapsible bottom Markdown preview. Stack panels sensibly on smaller windows. Provide progress, cancellation, recovery, and a clear indication of whether images stay local or go to an analysis provider.

## Architecture and security requirements

- Separate UI, API contracts, persistence, asset processing, analysis providers, task orchestration, skill compilation, and package import/export.
- Keep inference and image processing off the UI thread; bound background concurrency and image decode sizes.
- Launch the FastAPI service as an application-owned process on loopback, with a per-launch authentication secret, restricted origins, startup readiness checks, and shutdown cleanup. Do not expose an unauthenticated local API.
- Provide a browser development mode using the same real backend, with explicit development configuration. Never embed backend secrets into the frontend bundle.
- Use Tauri capability restrictions and a content security policy. Expose only the desktop operations needed for the implemented workflows.
- Local Ollama is the only inference connection in Phase 1. Do not allow arbitrary remote provider URLs in this phase. No API key fields are needed until a supported authenticated provider exists; then use OS credential storage, never SQLite or browser storage.
- Do not fetch URLs embedded in images, profiles, Markdown, or packages. Do not execute generated skills. Render Markdown as text or sanitized content without raw HTML.
- SQLite writes and filesystem changes must remain consistent across validation failures, cancellation, interrupted tasks, and imports. Use staged assets and startup cleanup for abandoned work.
- No telemetry by default. Redact credentials, image payloads, and sensitive local paths from logs.

## Further development

**Analysis quality:** improve recurring-style extraction, reference synthesis, uncertainty handling, and human review while keeping measurement evidence distinct from model interpretations.

**Skill authoring and compatibility:** improve structured editing, reusable instruction quality, reference organization, and portable-package support. Document target-agent conventions only after verifying them.

**Release hardening:** performance profiling, security review, accessibility checks, installer validation, platform-specific CI, signing guidance, and versioned release artifacts. Target Windows `.exe`/`.msi`, macOS `.dmg`/`.app` archive, and Linux `.AppImage`/`.deb`/`.rpm` only where actually built successfully. Configure workflows without claiming that configuration proves support.

## Repository deliverables

Include source, lockfiles, migrations, a development launcher, automated tests, an MIT license as an explicit project default, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, architecture and provider documentation, a synthetic example skill package with clear licensing, CI, and build configuration.

Document browser development, Tauri development, backend setup, Ollama setup, app data locations, backup/export, known limitations, and platform prerequisites. Package the Python service for desktop distribution rather than requiring end users to install Python. Keep development-run verification and installer verification separate.

## Acceptance checks

1. A clean documented setup starts the real frontend and backend; the desktop shell connects to its owned service.
2. Without Ollama, a user can import valid references, run explicitly labeled local measurements, edit a complete profile, save it, restart, and retrieve it.
3. Exported ZIP packages reimport with the same profile and reference content under a new identity; Markdown and JSON match the saved revision.
4. Invalid images, excessive pixels, unsafe ZIP entries, oversize packages, invalid schemas, and unavailable providers return clear errors without corrupting library state.
5. Search, edit, favorite, duplicate, delete, revision restore, theme persistence, and keyboard navigation work against real local data.
6. Core unit/integration tests, TypeScript checks, production frontend build, and available native checks pass. Report any unavailable tooling or unrun platform tests accurately.
7. If a real Ollama vision model is available, test inference end to end; otherwise report that live inference remains unverified and use fixtures only in automated adapter tests.

Report exact commands run and outcomes, what works, what remains unverified, and which roadmap features are not implemented. Never invent test results, benchmarks, installer artifacts, or platform support.
