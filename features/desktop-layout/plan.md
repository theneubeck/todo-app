---
name: Desktop layout
slug: desktop-layout
status: planned
frozen: true
created: 2026-05-13
---

# Desktop layout

## Pattern summary

The app currently opens in a 900×720 window with the main content area constrained by `container-max: 768px` (per DESIGN.md) and wrapped in a heavy `outline-variant` bordered card (per the `design-and-structure` plan). On a typical productivity-sized window — 1440×900 and up — the layout looks dated: a narrow centered column with broad empty margins, more like a settings dialog than a workspace. This plan reshapes the chrome to feel like Slack or Obsidian: a wider default window that uses most of the laptop screen, a fixed-width left sidebar (240px) for navigation, a full-width main pane to the right of it that fills whatever horizontal space remains, and a flat task list without the heavy card border. The top app bar still spans the full window width as today. Inside the main pane, the existing structure stays — `h1` header, remaining-count line, task list, command bar pinned at the bottom — but each of those elements stretches to the pane's width instead of being constrained to 768px. Row content (chevron + checkbox + title + chip) still left-aligns to maintain the "line of sight" rhythm DESIGN.md prescribes; the right side of each row simply has more room for the priority/category chip to sit at the row's right edge. The window remains resizable in both directions; below ~800px wide the layout still works but is not optimized (sidebar visibility on narrow widths is out of scope — same as Obsidian's narrow-window behavior).

**In scope:** new default window dimensions (1280×800, min 800×600); CSS layout switch from centered + max-width to a two-column grid (sidebar `240px` | main `1fr`); removing the `outline-variant` 1px border + `rounded.md` corners from `[data-task-card]` and any wrapping container; adjusting the command bar so it spans the main pane's width; updating the design-and-structure DOM spec assertion that checks for the card border (authorized supersession); a verify script that captures the layout at both default (1280×800) and maximized (3000×2000 — Playwright's "maximized" via setViewportSize) and asserts no horizontal scrolling and the sidebar/main aspect ratio at each size.

**Out of scope:** persisting window size across launches (Electron has a small library for this, but a fixed default suits v1); collapsible sidebar (Obsidian's left-pane toggle button — separate plan); a right-side "details" pane like Slack threads; reading-width cap inside the main pane (the entire main pane fills horizontally — if the user wants a narrower reading column, that's a separate setting); dark mode or any color change (palette per DESIGN.md is unchanged); the bottom command bar's typography or position (still pinned at the bottom of the main pane); narrow-window (<800px) behavior beyond "the layout still renders, just with less breathing room"; updating any non-design-and-structure plan that mentions specific pixel widths (none currently do).

## Acceptance criteria

1. Given the Electron app launches with no persisted window state and no env-var overrides, when the window first appears, then its dimensions are 1280 wide × 800 tall (or larger if the user has maximized the previous instance — outside this plan's control).
2. Given the BrowserWindow constructor options, when read, then `minWidth` is at least 800 and `minHeight` is at least 600 so the user cannot drag the window to a size that breaks the layout.
3. Given the main shell renders at 1280×800, when inspected, then `[data-app-shell]` lays out as a grid with the top app bar full-width on top and a `[data-sidebar]` + `[data-app-body]` (containing `[data-main-view]` or the chat view) row below; the sidebar has a computed width of approximately 240px and the main pane fills the remaining horizontal space.
4. Given the task list renders at 1280×800, when inspected, then no element in the workspace has a `max-width: 768px` rule applied (the `container-max` token may still exist in DESIGN.md but it must not be applied to the main pane or its children).
5. Given the task card renders at any window size, when inspected, then `[data-task-card]` (or whatever container wraps the task list today) has no visible 1px `outline-variant` border around the list — rows are still separated by their existing internal separators per DESIGN.md, but the outer card border is gone.
6. Given the window is resized to 3000×2000 (maximized on a typical large display), when the layout settles, then the workspace expands to fill the width (no remaining centered column) and the page has no horizontal scrollbar.
7. Given the window is resized to 800×600 (the new minimum), when the layout renders, then the page has no horizontal scrollbar and all of: top app bar, sidebar, main pane, and command bar are visible without overflow.

## Step-definition file

**Not applicable.** This plan has no Gherkin scenarios — same skill deviation as `headless-test-mode`, `package`, `ollama-http`. The acceptance criteria are visual/structural (window size + DOM layout + lack of overflow) and are exercised by the verify script at known viewport sizes plus a small unit test on the new `buildWindowOptions` defaults. Existing chat-interface and add-task Gherkin suites continue to cover the user-flow paths against the world's mocked window setup; they don't assert on the bordered card or the 768px constraint.

## BDD test list

[file: test/data/windowOptions.spec.ts]  ← extend the existing file
- `describe("buildWindowOptions")` > `it("returns width 1280 by default")`
- `describe("buildWindowOptions")` > `it("returns height 800 by default")`
- `describe("buildWindowOptions")` > `it("returns minWidth at least 800")`
- `describe("buildWindowOptions")` > `it("returns minHeight at least 600")`
- *(The existing `show: false` test under NODE_ENV=test stays green — only width/height/min* assertions are added.)*

[file: test/view/desktopLayout.spec.ts]  ← new pattern-spec file (Tallahassee)
- `describe("Desktop layout")` > `it("renders [data-app-shell] without a max-width on the main pane")`
- `describe("Desktop layout")` > `it("renders [data-sidebar] with a fixed computed width")`
- `describe("Desktop layout")` > `it("renders [data-task-card] without the outline-variant border")`
- `describe("Desktop layout")` > `it("renders the command bar inside the main pane, not at root")`

## File map

### New files
- `test/view/desktopLayout.spec.ts` — Tallahassee tests covering the DOM-structural and computed-style assertions for ACs 3, 4, 5 (verify-script covers visual + viewport-size variations).
- `test/verify/desktopLayout.verify.ts` — Playwright verify. Launches Electron with the new defaults. Captures three screenshots at three viewport sizes:
  1. `tmp/desktopLayout-default-1280x800.png` (the default launch size — AC 1, 3)
  2. `tmp/desktopLayout-wide-3000x2000.png` (large display — AC 6)
  3. `tmp/desktopLayout-min-800x600.png` (the new minimum — AC 7)
  Asserts at each size: no horizontal scrollbar (`document.body.scrollWidth <= window.innerWidth`), the sidebar width is `~240px`, the main pane fills `(window.innerWidth - 240px)`, and `[data-task-card]` has no `border` (or `border-width: 0`).

### Files to update
- `src/main/windowOptions.ts`:
  - Replace `width: 900` with `width: 1280` and `height: 720` with `height: 800`.
  - Add `minWidth: 800` and `minHeight: 600`.
  - Existing `show: process.env.NODE_ENV !== 'test'` stays as is.
- `src/renderer/index.html`:
  - Replace the centering/max-width CSS on the main shell with a CSS Grid layout:
    ```css
    [data-app-shell] {
      display: grid;
      grid-template-rows: auto 1fr;
      height: 100vh;
      width: 100vw;
    }
    [data-app-body] {
      display: grid;
      grid-template-columns: 240px 1fr;
      overflow: hidden;
    }
    [data-sidebar] {
      width: 240px;
      overflow-y: auto;
      border-right: 1px solid var(--outline-variant);
    }
    [data-main-view] {
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 24px 32px;
    }
    [data-chat-view] {
      /* matches main-view shape; the chat view occupies the same slot */
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 24px 32px;
    }
    [data-task-card] {
      /* Border + rounded corners removed; rely on row separators per DESIGN.md */
      border: none;
      border-radius: 0;
      background: transparent;
      padding: 0;
      max-width: none;
    }
    [data-command-bar] {
      /* still pinned at the bottom of the main pane */
      width: 100%;
      max-width: none;
    }
    ```
  - Remove or override the existing `container-max: 768px` application — search for `max-width: 768` in the stylesheet and rewrite each occurrence (the design-token can stay in DESIGN.md as a reference for narrow components, but it must no longer apply to the main workspace).
- `src/renderer/index.ts`:
  - `mountMainShell` already creates `[data-app-shell]` and `[data-app-body]` containers — confirm they exist and adjust if any inline styles fight the new CSS. The chat view (mounted at `[data-chat-view]`) should occupy the same slot as `[data-main-view]` in the grid (sibling to `[data-sidebar]`, not nested inside the main pane).
- `test/data/windowOptions.spec.ts` (existing — extend, do not replace):
  - Add the four new `describe("buildWindowOptions")` tests listed in the BDD list.
  - Existing test "returns show false when NODE_ENV is test" stays green.
- `test/view/designAndStructure.spec.ts`:
  - **Authorized supersession.** The existing test that asserts on the bordered card (any assertion checking for an `outline-variant` border on `[data-task-card]` or a centered max-width container) is updated to assert the new shape: no border, full-width container, sidebar+main grid. If a specific test references the 768px constraint or the bordered look, rewrite that test in place — do not delete the test. Implement is authorized to touch only the lines that reference the card border, the centered column, or the 768px max — leave every other line alone.
- `test/features/design-and-structure.feature`:
  - **Authorized supersession.** Same scope as the spec — if any `Then` step asserts the bordered card or the centered column, update those steps; leave every other line alone.
- `DESIGN.md`:
  - **No mandatory edit.** The `container-max: 768px` token may remain documented as a possible narrow-component constraint, but the prose section "Layout & Spacing" that currently says "The main content container is centered and constrained to a maximum width of 768px" must be rewritten to reflect the new layout. Implement is authorized to update that section only; the rest of DESIGN.md stays intact.
- `package.json` — append `&& ts-node test/verify/desktopLayout.verify.ts` to the `verify:playwright` script.

### DOM contract

- `[data-app-shell]` (REUSED) — CSS Grid root, two rows (top app bar + body).
- `[data-app-body]` (REUSED) — CSS Grid row, two columns (sidebar + main).
- `[data-sidebar]` (REUSED) — fixed-width left column, ~240px, with a thin right border.
- `[data-main-view]` and `[data-chat-view]` (REUSED) — occupy the same grid slot (sibling to sidebar); only one is visible at a time. The chat view is no longer nested inside `[data-main-view]` for this layout to work — confirm during implementation and adjust if needed.
- `[data-task-card]` (REUSED) — wrapping container of the task list. Border + rounded corners removed; otherwise unchanged.
- `[data-command-bar]` (REUSED) — pinned at the bottom of `[data-main-view]` via flex layout. No change to its internal structure.

### Visual treatment

Keeps DESIGN.md's "Focus & Utility" palette and 4/8px rhythm. Specific applications:
- Sidebar: `surface` background (`#f7f9fb`), thin `outline-variant` 1px border on the right edge as a separator.
- Main pane: `surface` background, 24px (lg) vertical padding, 32px (xl) horizontal padding for breathing room at wide widths.
- Task list: no card outline; row separators per DESIGN.md "Separators: Use 1px borders (#F1F5F9) to divide list items".
- Command bar: spans the main pane's width, retains its existing typography and chip styling (mode-aware hint per `chat-interface`).
- No new colors, fonts, or radii.

## Skill deviations (recorded)

Same shape as `headless-test-mode` / `package`: a UI feature without a Gherkin acceptance suite. The acceptance criteria are visually verifiable from screenshots at three viewport sizes plus a small unit test on `buildWindowOptions`. The existing `chat-interface`, `add-task`, `task-row-interactions`, and similar Gherkin suites continue to cover user-flow behavior, none of which assert on the bordered card or the 768px constraint.

## Conflicts & decisions

**Conflicts:**
- **Supersedes** the `design-and-structure` plan's Pattern summary on two points: (a) "a single bordered card holding the task list" → no border in the new layout; (b) "The main content container is centered and constrained to a maximum width of 768px" → no centering, no max. The supersession is acknowledged in this plan and follows the same precedent as the `bug-fixes-1` brand rename and the `chat-interface` hint-text change.
- `DESIGN.md` says "The main content container is centered and constrained to a maximum width of 768px" — this plan's File map authorizes updating only that prose section. The `container-max: 768px` design token itself may remain (some narrow components in future plans could still use it).

**Decisions:**
- **Default window 1280×800.** *Reason: standard MacBook Air 13" native resolution; fits even older laptops; clearly larger than today's 900×720 so the difference is visible on first launch.*
- **Sidebar fixed at 240px.** *Reason: matches Obsidian's default left-pane width; wide enough for tag labels like `#go-to-store` to read comfortably without truncation.*
- **No window-state persistence.** *Reason: scope discipline; the user can drag/maximize as they prefer, and Electron's default behavior preserves the size within a single launch.*
- **No reading-width cap inside the main pane.** *Reason: matches Slack's full-width feel (the user's primary reference); Obsidian's "readable line length" is a known setting but is a follow-up plan.*
- **Drop the task-card border entirely, not just thin it.** *Reason: at large widths the card-on-card pattern looks heavy. Row separators per DESIGN.md provide enough structure on their own.*
- **No collapsible sidebar.** *Reason: separate feature with its own UX questions (button placement, animation, keyboard shortcut). Out of scope here.*
- **Chat view occupies the same grid slot as main view, not nested.** *Reason: simplifies the grid; the sidebar stays adjacent to whichever pane is active.*

**Open questions:** none.

## Data fixtures

No fixture changes. The verify script uses the existing fixture-vault setup; the layout work is purely chrome.
