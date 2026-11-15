# StyleDNA UI Redesign Implementation Plan

Historical implementation record. `docs/PRODUCT_SCOPE.md` supersedes planned image-generation/history destinations; current navigation is Dashboard, Studio, Library, and Settings.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver the user-requested calm, readable, adjustable desktop UI while preserving real Phase 1 features.

**Architecture:** Keep the FastAPI/SQLite engine and API contracts; replace the visual system and restructure the studio into spacious resizable panels. Preserve editor ownership with snapshot-aware save reconciliation.

**Tech Stack:** Existing React/TypeScript/Tauri; Radix tooltip/menu primitives; CSS tokens; Playwright and existing Python/Vitest tests.

**Spec:** `docs/superpowers/specs/2026-11-15-ui-redesign.md`

## Global Constraints

- Base type 15 px, form labels/buttons 14 px, supporting text at least 12 px, code preview at least 13 px.
- Buttons and inputs at least 42 px in ordinary layouts; useful visible focus, keyboard support and reduced motion.
- Default two-panel studio; collapsible bottom code preview; no fake analysis/generation or lost existing workflows.
- Verify normal zoom at 1440, 1280, 1100, and 900 pixel window widths.

## Review Focus

- Save completion must preserve edits made while the request was pending.
- Typing tags then using Ctrl/Cmd+S must persist those tags without requiring blur.
- Panel resizing must work with pointer and keyboard and keep essential controls reachable.
- Narrow windows must not introduce horizontal overflow or hide actions.
- Closing the native window must preserve the unsaved-change guard and stop its owned service.

### Task 1: Editor safety and layout behavior
**Files:** `src/lib/editor.ts`, `tests/editor.test.ts`, `e2e/workflow.spec.ts`, `e2e/redesign.spec.ts`, `src/components/ResizableWorkspace.tsx`.
- [x] Run existing failing snapshot/tag regression tests; implement `acceptSave(current, submitted, saved)` and immediate tag updates.
- [x] Define behavioral browser tests for resizers, preview, sidebar, readability, resizing, and actual saved data.
- [x] Implement keyboard/pointer split controls with bounded persisted UI preferences; verify tests against real layout.

### Task 2: Studio and shared visual system
**Files:** `src/styles.css`, `src/components/ui/`, `src/pages/Studio.tsx`, studio subcomponents.
- [x] Introduce neutral theme tokens, comfortable type/spacing, accessible tooltips and export menu.
- [x] Build visible workflow steps, large reference board, readable review editor with advanced disclosures, and collapsible code panel.
- [x] Preserve analysis/apply/cancel, manual editing, preview/copy, revisions, all exports, and reference preview.

### Task 3: Whole-app consistency
**Files:** `src/App.tsx`, `src/pages/{Dashboard,Library,Settings,Planned}.tsx`.
- [x] Group and simplify sidebar, add compact/drawer behavior, keep active page obvious.
- [x] Restyle every page and its loading/empty/error states; make headings and controls readable.
- [x] Run backend/editor/browser suites, typecheck/build and accessibility checks; inspect screenshots at normal zoom.

### Task 4: Native delivery
**Files:** native config/host as needed, `scripts/smoke-desktop.mjs`, `docs/VERIFICATION.md`, README.
- [x] Rebuild and test the actual Tauri/WebView2 UI, scrolling, resizing, saving, exporting boundary and exit lifecycle.
- [x] Rebuild `.exe`/`.msi` artifacts, run final checks, document results and unverified platforms, commit changes locally.

Execution is explicitly authorized; do not introduce a further approval handoff. Prior code review reproduced the two data-loss bugs before its agent hit a usage limit. Fix those verified findings; do not claim a completed independent whole-branch review.
