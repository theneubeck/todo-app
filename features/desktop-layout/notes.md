---
slug: desktop-layout
frozen: false
---

# Notes — Desktop layout

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run a plan skill.

## Problems

(none yet)

## Verify findings

### Verify — desktop-layout — 2026-05-13

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — 0 errors / 0 warnings |
| Type check (`npm run typecheck`) | PASS — exits 0 |
| Coverage (`npm run test:coverage`) | PASS — 98.57% stmts / 91.12% branches (>=90% gate) |
| `npm test` (Mocha) | PASS — 321 passing |
| Gherkin (`npm run test:bdd`) | PASS — 73 scenarios / 303 steps |
| Full verify chain (`npm run verify`) | PASS — all 15 Playwright scripts green |
| Screenshot: default-1280x800 | PASS — sidebar 240px left, main pane fills ~1040px, top bar full-width, no centered narrow column, no card border |
| Screenshot: wide-3000x2000 | PASS — layout fills wide window cleanly, sidebar still 240px, main pane ~2760px, no horizontal scrollbar, command bar spans main pane |
| Screenshot: min-800x600 | PASS — sidebar 240px + main pane 560px both visible, top app bar + command bar visible, no overflow |
| Supersession audit | PASS — only authorized lines touched in DESIGN.md (Layout & Spacing paragraph), design-and-structure.feature (one scenario), designAndStructure.spec.ts (one `it` rewritten in place), design-and-structure.steps.ts (matching Then step). No frozen plan files edited. |

**Per-AC verdict:**
- AC 1 (default 1280x800): PASS — buildWindowOptions returns width 1280 / height 800 (unit test + verify script viewport).
- AC 2 (minWidth >= 800, minHeight >= 600): PASS — unit tests assert at least 800/600; values are 800/600 in source.
- AC 3 (grid: app bar full-width + sidebar + main pane sibling row): PASS — verify script confirms `[data-sidebar]` direct child of `[data-app-body]`, computed width 240px, `[data-main-view]` is its sibling and fills remaining width at all three viewports.
- AC 4 (no max-width: 768px applied to main pane or children): PASS — index.html removes the `max-width: 1024px` centering on `[data-app-shell]` and `[data-app-body]`; `[data-task-card]` and `[data-command-bar]` set `max-width: none`. No 768px constraint anywhere.
- AC 5 (no visible 1px outline-variant border on `[data-task-card]`): PASS — computed border widths all 0px at every viewport per verify script; spec asserts `border === 'none'`.
- AC 6 (3000x2000 fills, no horizontal scrollbar): PASS — body.scrollWidth=3000 <= innerWidth=3000; screenshot confirms.
- AC 7 (800x600 still works, no overflow, all four regions visible): PASS — body.scrollWidth=800 <= innerWidth=800; screenshot confirms top bar, sidebar, main pane, command bar all rendered.

**Overall**: All 7 acceptance criteria pass. Supersession scope respected. Verify complete.

## Background

User on 2026-05-13: "Now lets plan for a bigger size. I usally work most of the screen. Id like the app to have the same feel as slack or Obsidian in full screen. Its currently bound to a certain size."

The app today opens at 900×720 with the main content area constrained to `container-max: 768px` (per DESIGN.md) inside a `outline-variant` bordered card (per the design-and-structure plan). At typical productivity-screen sizes this looks dated — narrow centered column with broad empty margins on either side. This plan widens the default window, replaces the centered card with a sidebar-plus-main grid that fills the window, and drops the bordered card in favor of the existing row separators.

The change touches two frozen artifacts on the design-and-structure plan side (the .feature file and the DOM spec); both supersessions are authorized in this plan's File map and follow the same precedent as the `bug-fixes-1` brand rename and the `chat-interface` hint-text change. Implement is allowed to touch only the relevant lines in those files.
