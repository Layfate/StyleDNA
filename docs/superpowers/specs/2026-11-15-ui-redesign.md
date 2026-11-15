# StyleDNA UI redesign

Authorized for implementation by the user's explicit redesign-and-implement request on 2026-11-15. This extends the approved Phase 1 design and preserves its real backend workflows.

The current interface uses 7–12 px secondary text, cramped three-column forms, cropped reference thumbnails, and too many small bordered sections. Replace that density with a calm neutral workspace: 15 px base text, 14 px controls/labels, 12–13 px supporting text, 42 px buttons, generous spacing, and restrained warm gold accents.

## Chosen approach

Use a spacious two-panel studio with an adjustable reference/editor split. Keep the Markdown preview closed by default and open it as an adjustable bottom panel; this preserves room for images and review at ordinary desktop widths. A permanent third column would recreate the cramped layout the user rejected. A single-page wizard would obscure useful side-by-side reference review, so retain a visible four-step progress guide without forcing navigation between steps.

Group sidebar destinations into Workspace, Coming later, and Settings; support a compact rail and a small-window drawer. Use consistent accessible tooltip and export-menu primitives. Essential analysis/save/export controls remain visible. Put model options, secondary visual traits, measured evidence, and collection metadata in disclosures. Give reference previews a large contain-fit image area and enlarge the reference dialog.

Apply the same typography, spacing, neutral surfaces, inputs, buttons, cards, notices, focus, and empty/loading/error states to Dashboard, Library, Settings, and planned destinations. Keep dark/light theme behavior. Preserve current routes and action names where appropriate.

Fix confirmed edit-loss bugs: keyboard save must include tags before blur; a late save response must not replace edits made after the submitted snapshot. Keep model failure/cancellation, revision conflicts, and package safety behavior unchanged.

## Verification

Run existing backend/editor/browser tests plus regression tests for both edit-loss bugs. Exercise pointer and keyboard panel resizing, preview copy/collapse, sidebar expansion, normal-zoom readability, absence of horizontal overflow, and interactions at 1440, 1280, 1100, and 900 pixel widths. Inspect browser screenshots and run the actual Tauri/WebView2 workflow after rebuilding the production frontend/native binary. Rebuild Windows installers after the final UI changes. Record unverified platforms accurately.
