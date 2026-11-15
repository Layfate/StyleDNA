# Changelog

## 0.1.2 — 2026-11-15

- Clarified the product as an image-to-skill generator. Removed AI Generator, generated-image History, and their planned screens from navigation and the active roadmap. Kept saved skill revision history.
- Focused the build brief and product documentation on reference analysis, editable style profiles, reusable `SKILL.md` files, the skill library, and portable exports.

## 0.1.1 — 2026-11-15

- Applied the supplied blue DNA helix/photo-frame logo to the sidebar, desktop application and installer icons, browser favicon, and repository branding. The original artwork and transparency are preserved.

## 0.1.0 — 2026-11-15

Initial Phase 1 implementation: Tauri/React shell, authenticated FastAPI service, validated image ingestion, real local measurements, optional Ollama vision adapter, editable profiles, deterministic skill compilation, SQLite revisioned library, safe portable package roundtrip, themes and provider settings, core/browser tests, and build workflows.

The initial roadmap mentioned image generation and image history; the 0.1.2 scope clarification supersedes those plans. Signed public releases and other-platform runtime verification are not included.

The interface was redesigned with a neutral dark theme, comfortable typography and controls, grouped navigation, adjustable reference/editor panels, large image previews, expandable advanced sections, and a collapsible Markdown panel. Regression fixes preserve focused tag edits and concurrent edits during save, reject stale opening responses, recover from deleted/offline drafts, enforce portable-package budgets, and retain native unsaved-close protection after service failure.
