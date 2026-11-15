# StyleDNA Phase 1 design

Status: approved by the user on 2026-11-15. Phase 1 implementation authorized.

## Intent

StyleDNA turns reference images into reusable image-generation style instructions. A creator collects references, reviews their shared visual traits, corrects the interpretation, and exports a portable skill to guide future work across different subjects. It is a local-first desktop tool, not a promise of exact style reproduction or a model-training system.

The user's requested stack and Phase 1 priority are retained. The expanded implementation brief is in `docs/STYLE_DNA_BUILD_PROMPT.md`; this design fixes the choices necessary to plan that phase.

## Goals and boundaries

Deliver the complete import → analyze → edit → save → export → reimport workflow with durable local storage and a usable Tauri shell. Support several equally weighted references, local measurements without model installation, and optional local Ollama vision analysis. Include library management, revision history, dark/light themes, and open-source repository basics.

Generation adapters, generated-image history, adjustable reference weights, similarity scoring, LoRA training, cloud inference, and signed cross-platform releases are subsequent phases. Generator/history destinations disclose this status. No fake analysis, fake generation, automatically downloaded models, arbitrary remote requests, or decorative metrics.

Anti-goals: subject details leaking into every style prompt; claiming numerical image measurements identify semantic style; silent fallback after inference failure; a desktop release that secretly depends on an end-user Python install; broad filesystem access from the webview.

## Approaches

1. **Phase 1 vertical slice, selected recommendation:** complete the core workflow with real measurements and optional local vision before generation. Gives a useful offline workflow and independently testable analysis and packaging.
2. **Analysis and generation together:** useful for immediate visual feedback but introduces model provisioning, GPU requirements, generation adapters, and job persistence before the core skill format is stable.
3. **All phases together:** maximizes initial breadth but makes honest end-to-end verification and installer validation significantly harder. The user's request explicitly prioritizes Phase 1, so this is unsuitable for the initial implementation.

The recommendation follows the requested implementation order. Approval of this design confirms this scope; the later phases remain on the roadmap.

## Technical structure

Suggested repository layout:

```text
src/                       React application and lazy-loaded pages
src/components/            Accessible shared UI primitives
src/lib/                   Typed API client, models, utilities
src-tauri/                 Restricted desktop host and lifecycle
backend/styledna/           FastAPI entry point and configuration
backend/styledna/models/    Versioned Pydantic contracts
backend/styledna/services/  Assets, analysis, compilation, packages, tasks
backend/styledna/providers/ Ollama and explicit measurement mode
backend/styledna/storage/   SQLite migrations and repositories
backend/tests/             Core and API integration tests
examples/                  Licensed synthetic reference skill
scripts/                   Development and sidecar build launchers
docs/                      Setup, architecture, security, roadmap
.github/workflows/         Checks and platform build configuration
```

Use FastAPI, SQLite, Pillow, headless OpenCV, and an asynchronous HTTP client for Ollama. Prefer Python's SQLite APIs plus explicit SQL migrations over adding an ORM. Use strict TypeScript, Tailwind, shadcn/ui patterns, Lucide, and restrained Motion. Exact compatible dependency versions and lockfiles are implementation choices verified against official sources before installation.

### Runtime and transport

The Rust host creates a per-launch secret, starts its Python sidecar bound to `127.0.0.1` on an available port, waits for authenticated readiness, and gives connection details to its local webview through a narrow command. The backend requires authorization for all user data and mutation routes, validates origins/hosts, rejects unexpected content types, and accepts no wildcard credentialed origins. Health responses expose no paths or project data. No token appears in URLs, frontend build variables, or logs.

Desktop production bundles a target-specific Python executable built with PyInstaller; development uses a project virtual environment. Tauri embeds the sidecar using its documented external-binary mechanism. The host tracks the owned process and terminates it on exit, including failed startup. Startup errors provide actionable details without leaving an orphan service.

Browser development uses a launcher that starts the same service and Vite. A narrowly scoped Vite development proxy attaches the backend secret from server-side memory; the secret is not in the browser bundle. Production uses authenticated direct loopback requests. Test origin/host rejection, including the development proxy's allowed host boundary.

Official implementation references: [Tauri external binaries](https://v2.tauri.app/develop/sidecar/), [Tauri security](https://v2.tauri.app/security/), and [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs).

### Data ownership

Resolve OS application data paths; allow an explicit temporary data directory in tests. Store SQLite, managed source assets, normalized export/reference copies, bounded thumbnails, and staged imports in separate directories. User originals remain untouched. Asset lookup uses generated IDs and verified paths beneath the app root, never client-provided absolute paths.

SQLite entities: skills, references, skill-reference links, immutable skill revisions, tags/links, settings, and analysis jobs. Use foreign keys and migrations, index normalized name/search fields and timestamps, and support paginated library queries. Skill deletion removes its revisions/links transactionally and garbage-collects only unreferenced managed assets. Duplication shares immutable assets with reference-aware cleanup.

Persist pending task states. On restart, classify unfinished inference as interrupted, clean abandoned staging directories, and offer retry rather than pretending jobs completed. Stage filesystem writes before database commits; compensate and clean on failure. Back up through portable packages in Phase 1, with no database import of arbitrary SQL.

## Import and analysis

Initial limits, chosen defaults: 20 references per skill, 20 MiB per input, 40 megapixels per decoded image, 2,048-pixel inference previews, and 320-pixel thumbnails. Bound total import size to 200 MiB and expanded package size to 250 MiB. Make these explicit configuration constants. Decode at bounded concurrency, respect Pillow decompression warnings as failures at the hard limit, and reject animated formats rather than quietly choosing frames. Normalize EXIF orientation and convert to a consistent RGB/sRGB representation; preserve transparency in reference assets as appropriate and define the analysis compositing background.

Measurements use bounded, deterministic sampling for palette clustering and numeric statistics. Give each field a source (`measurement`, `ollama`, or `user`) and retain reference associations. Display real measurements as numbers/swatches and unassessed semantic fields as editable empty fields. User-facing descriptions explain the difference without turning the workspace into implementation documentation.

Ollama defaults to `http://127.0.0.1:11434`, with local loopback destinations only, redirects disabled, finite timeouts, and an explicit installed-model selection. Discover models and inspect reported capabilities. Do not automatically choose a text-only model, download a model, or infer success from availability alone. Structured output is validated with Pydantic; reject extra fields, excessive strings, and invalid palettes. The service passes reference content as image data and instructs the model to describe visual evidence, not follow text embedded in an image.

Analyze each reference, retain its observations, and ask the vision model for a bounded synthesis of shared traits while excluding subjects. Equal influence applies in Phase 1. A failed reference or synthesis leaves prior saved revisions unchanged; show the failure and allow retry. The user may explicitly choose measurement mode for a separate new job.

Jobs have `queued`, `running`, `completed`, `failed`, `cancelled`, and `interrupted` states plus stage progress. Poll job status initially; no need for streaming infrastructure. A bounded worker pool handles image work and awaits inference outside request/UI threads. Cancellation closes local inference requests where possible, suppresses stale writes, and is labeled as cancellation of StyleDNA's work; remote engine resource cleanup cannot be guaranteed.

## Profile, skills, and packages

`StyleProfile` schema v1 contains identity, human description, tags/category, palette, named style dimensions, positive rules, negative constraints, subject exclusions, references, provenance, and timestamps. Validation limits counts and lengths. An editable draft is separate from saved revisions; navigating away from unsaved work prompts to save or discard.

The compiler deterministically produces `SKILL.md` from the profile. It includes a YAML-escaped slug/name and description, usage guidance, recurring style rules, content exclusions, prompt recipe, negative constraints, relative reference links, and limitations. Blank/unassessed dimensions are omitted. All user/model text is escaped appropriately and treated as data. Markdown preview is a plain code/text preview initially, avoiding raw-HTML rendering. Agent-specific compatibility is documented only for formats verified during implementation; generic exports are not represented as universally installable skills.

ZIP contract:

```text
manifest.json     Package and profile schema versions; asset listing
SKILL.md          Compiler output for this revision
style.json        Canonical editable profile
references/      Metadata-stripped copies with generated safe names
```

Import allows only manifest-listed supported files, validates schemas and referenced asset hashes, caps file count and aggregate expanded bytes, and rejects traversal, absolute/drive paths, backslashes, symlinks, duplicates, unknown format versions, encrypted entries, and excessive compression. Extract into a fresh staging directory using containment checks; validate everything before committing. Recompile Markdown from `style.json` rather than trusting imported instructions. A successful import creates a new identity and records its source; a failed import leaves no visible skill.

Saving creates a revision containing profile, compiled Markdown, and reference mappings in one logical operation. Restore creates a new revision, retaining the audit history. Export uses a chosen saved revision. JSON/Markdown export is available independently. Bundled examples are synthetic and expressly licensed; nothing is auto-added as if it were user-created work.

## Interface and behavior

Desktop minimum target: 1,100 × 720, with collapsible panels for narrower windows. Dark warm-gray surfaces, a modest amber accent, thin borders, compact controls, image thumbnails, and deliberate spacing. Optional light theme persists locally. Use system/native typography unless a bundled permissively licensed font adds clear value.

```text
StyleDNA       Studio / Untitled style                   Save skill
───────────┬────────────────┬────────────────────┬──────────────────
Dashboard  │ References     │ Style profile      │ SKILL.md preview
Studio     │ [image] [image]│ Name + description │ ---
Library    │ Add references │ Palette swatches   │ name: ...
Generator* │                │ Visual traits      │ ...
History*   │ Analysis mode  │ Rules / exclusions │ Export revision
Settings   │ Analyze / Stop │ Source indicators  │
───────────┴────────────────┴────────────────────┴──────────────────
* Planned, disclosed on destination page
```

Dashboard shows actual recent skills and a clear create action; first run is an honest empty state. Library has debounced search, category/tag/favorite filters, paginated or virtualized cards, duplication, deletion confirmation, and revision access. Settings manages theme, local data information, and Ollama connection/model validation. Avoid an API-key form until a key-based provider exists.

Studio exposes references → explicit analysis mode → analysis → editable fields → save → export. A saved profile can always be edited manually, including without Ollama. Display stages and actionable errors inline. `Ctrl/Cmd+N`, `Ctrl/Cmd+S`, sidebar navigation, visible focus, labels, live status announcements, and reduced-motion support are initial accessibility requirements. No command intercept should break typing or native editing.

## Verification and delivery

Backend tests cover content validation, safe assets, deterministic measurements, profile schemas, compiler escaping, SQLite persistence/revisions, cancellation/stale writes, API authorization/origins, package roundtrip, and malicious ZIP rejection. Test Ollama adapters with controlled HTTP fixtures; report live inference separately. Frontend tests cover core editor transitions and actionable error states; browser integration verifies import/edit/save/reload/export/reimport through the real backend. Type-check and build the production frontend, run Python checks/tests, and run available Rust checks.

Verify native startup/shutdown and a Windows packaging attempt on this host if prerequisites permit. Configure matrix build jobs for the desired OS families, bundling a correctly targeted service. Do not call unrun macOS/Linux jobs verified or represent unsigned artifacts as signed releases. State missing tools and failed checks exactly.

Deliver README, MIT license (proposed default), contributor/security/community documents, changelog, development setup, architecture notes, example package, CI, and build scripts alongside Phase 1 source. Release publishing, repository creation on GitHub, signing accounts, and model downloads are outside the initial local implementation.

## Builder decisions and approval

Developer-selected defaults: Phase 1 scope, equal weighting, loopback-only Ollama, explicit local measurement mode, MIT license, warm-neutral/amber UI, input limits above, schema v1, polling for jobs, raw Markdown preview, and PyInstaller sidecar distribution. The builder may select exact dependencies, component boundaries, SQL indexes, and internal helper APIs within these constraints.

Implementation begins after approval of this document, followed by a detailed implementation plan. Any significant scope change should be reflected here before it is represented as delivered.
