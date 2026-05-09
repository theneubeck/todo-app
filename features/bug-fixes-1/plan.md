---
name: Bug fixes 1
slug: bug-fixes-1
status: planned
frozen: true
created: 2026-05-09
---

# Bug fixes 1

## Pattern summary

A bundled batch of three small UI fixes plus one deferred bug. **In scope:** (a) a minimal app-settings dropdown anchored to the existing `[data-icon=settings]` in the top app bar, with three checkboxes that hide or show the inert primary sidebar entries Chat, Today, and Upcoming (state persisted to `app-settings.json` in `userData`); (b) auto-hiding the PROJECTS and PEOPLE sidebar sections when the active vault has zero `#`- or `@`-prefixed tags respectively (the entire `[data-section]` element disappears, not just the header); (c) renaming the top app bar brand from "TaskStream" to "TODO" everywhere it appears in `src/` and `test/`. **Deferred:** the "subtask-after-complete" bug — adding a subtask to a `status: done` simple task produces a contradictory render — is held until the expected behavior is decided (see Conflicts & Decisions Q1 in the hand-off review). This plan **supersedes** the brand-name string ("TaskStream" → "TODO") in `features/design-and-structure/plan.md` acceptance criterion 1, following the precedent set by `features/add-task/plan.md` superseding part of the same design-and-structure plan.

**In scope:** clickable settings icon and dropdown with three sidebar-visibility checkboxes, immediate sidebar re-render on toggle, persistence via `app-settings.json` in `userData`, outside-click panel close, conditional rendering of `[data-section="projects"]` and `[data-section="people"]` based on tag counts, brand text rename to "TODO" in renderer + design-and-structure feature/spec.

**Out of scope:** subtask-after-complete bug (deferred — see Q1); animation when entries / sections appear or disappear; Escape-key close of the settings panel; keyboard navigation inside the panel; a "Save" button (toggles write immediately); themes; vault-level settings; renaming any selectors, modules, classes, types, files, or the npm package; `bookmarks/`, `goals/`, `notes/` section visibility (only PROJECTS/PEOPLE are covered).

## Acceptance criteria

1. Given the vault has zero tags of any kind and no `app-settings.json` exists, when the app loads, then the sidebar shows the Chat, Inbox, Today, and Upcoming entries.
2. Given the app loads, when the top app bar renders, then `[data-brand]` text content equals "TODO".
3. Given the sidebar is shown, when the user clicks the settings icon in the top app bar, then a settings panel appears anchored to the icon with three checkboxes labelled "Show Chat", "Show Today", and "Show Upcoming", all checked.
4. Given the settings panel is open with all checkboxes checked, when the user unchecks "Show Chat", then the Chat sidebar entry is removed from the DOM.
5. Given the persisted settings have "Show Chat" unchecked, when the user re-opens the app via a fresh mount, then the Chat sidebar entry is absent.
6. Given the settings panel is open, when the user clicks outside the panel and outside the settings icon, then the panel is closed.
7. Given the vault has zero tasks with `#`-prefixed tags, when the sidebar renders, then `[data-section="projects"]` is absent from the DOM.
8. Given the vault has zero tasks with `@`-prefixed tags, when the sidebar renders, then `[data-section="people"]` is absent from the DOM.

## Step-definition file

`test/step_defs/bug-fixes-1.steps.ts` — steps:

**Given:**
- `Given("the vault has zero tags of any kind and no app-settings file exists")` (NEW) — sets `this.fixtures` to a tag-free fixture set; sets `this.appSettingsPath` to a tmp path that does not exist; mounts the app.
- `Given("the sidebar is shown")` (NEW) — mounts the app with default settings (all-on); asserts `[data-sidebar]` is present.
- `Given("the settings panel is open with all checkboxes checked")` (NEW) — mounts the app with default settings; clicks `[data-app-bar-settings]`; asserts all three `[data-setting-toggle]` inputs are `:checked`.
- `Given("the persisted settings have {string} unchecked")` (NEW) — writes a JSON `app-settings.json` at `this.appSettingsPath` with the matching key set to `false`.
- `Given("the settings panel is open")` (NEW) — mounts the app and clicks `[data-app-bar-settings]` once.
- `Given("the vault has zero tasks with {string}-prefixed tags")` (NEW) — sets `this.fixtures` to a fixture set whose tasks contain no tags matching the prefix; mounts the app.
- `Given("the app loads")` (REUSE — `vault-picker.steps.ts`) — mounts the app via `mountApp(this.document.body)`.

**When:**
- `When("the app loads")` (REUSE — `vault-picker.steps.ts`).
- `When("the top app bar renders")` (NEW) — no-op alias asserting `[data-app-bar]` is present (the matching `Given` already triggered render).
- `When("the user clicks the settings icon in the top app bar")` (NEW) — clicks `[data-app-bar-settings]`.
- `When("the user unchecks {string}")` (NEW) — clicks the `[data-setting-toggle]` input whose visible label equals the string.
- `When("the user re-opens the app via a fresh mount")` (NEW) — calls `mountApp(this.document.body)` again with `getAppSettings` resolving the previously persisted file.
- `When("the user clicks outside the panel and outside the settings icon")` (NEW) — fires `mousedown` on `document.body` at coordinates outside both `[data-settings-panel]` and `[data-app-bar-settings]` bounding rects.
- `When("the sidebar renders")` (NEW) — no-op alias asserting `[data-sidebar]` is present.

**Then:**
- `Then("the sidebar shows the Chat, Inbox, Today, and Upcoming entries")` (NEW) — asserts `[data-sidebar-entry="chat"]`, `[data-sidebar-entry="inbox"]`, `[data-sidebar-entry="today"]`, and `[data-sidebar-entry="upcoming"]` all exist.
- `Then("[data-brand] text content equals {string}")` (NEW) — asserts the visible text of `[data-brand]` equals the string.
- `Then("a settings panel appears anchored to the icon")` (NEW) — asserts `[data-settings-panel]` exists and its bounding rect is below or aligned with `[data-app-bar-settings]`.
- `Then("the settings panel shows three checkboxes labelled {string}, {string}, and {string}")` (NEW) — asserts three `[data-setting-toggle]` inputs with the given labels exist; all are `:checked`.
- `Then("the {string} sidebar entry is removed from the DOM")` (NEW) — asserts `[data-sidebar-entry="<key>"]` is absent (key derived from string by lowercasing).
- `Then("the {string} sidebar entry is absent")` (NEW) — same assertion as above.
- `Then("the panel is closed")` (NEW) — asserts `[data-settings-panel]` is absent.
- `Then("[data-section=\"projects\"] is absent from the DOM")` (NEW) — asserts `[data-section="projects"]` is absent.
- `Then("[data-section=\"people\"] is absent from the DOM")` (NEW) — asserts `[data-section="people"]` is absent.

## BDD test list

[file: test/patterns/bug-fixes-1.spec.ts]
- `describe("SettingsPanel view")` > `it("renders three checkboxes when opened")`
- `describe("SettingsPanel view")` > `it("reflects persisted state by initialising checkboxes")`
- `describe("SettingsPanel view")` > `it("calls window.todoz.setAppSetting when a checkbox is toggled")`
- `describe("SettingsPanel view")` > `it("closes when the user clicks outside")`
- `describe("SettingsPanel view")` > `it("closes when the settings icon is clicked a second time")`
- `describe("Sidebar with toggles")` > `it("omits the Chat entry when showChat is false")`
- `describe("Sidebar with toggles")` > `it("omits the Today entry when showToday is false")`
- `describe("Sidebar with toggles")` > `it("omits the Upcoming entry when showUpcoming is false")`
- `describe("Sidebar with toggles")` > `it("never omits the Inbox entry regardless of settings")`
- `describe("Sidebar section visibility")` > `it("hides the PROJECTS section when there are no #-tags")`
- `describe("Sidebar section visibility")` > `it("hides the PEOPLE section when there are no @-tags")`
- `describe("Sidebar section visibility")` > `it("shows the PROJECTS section when at least one #-tag exists")`
- `describe("Sidebar section visibility")` > `it("shows the PEOPLE section when at least one @-tag exists")`
- `describe("Brand label")` > `it("renders TODO as the [data-brand] text")`

[file: test/data/appSettings.spec.ts]
- `describe("readAppSettings")` > `it("returns defaults when the file does not exist")`
- `describe("readAppSettings")` > `it("parses an existing JSON settings file")`
- `describe("writeAppSetting")` > `it("merges the change into the existing file")`
- `describe("writeAppSetting")` > `it("creates the file when it does not yet exist")`

## File map

### New files
- `src/main/appSettings.ts` — JSON read/write over `app.getPath('userData') + '/app-settings.json'`. Exports `readAppSettings()`, `writeAppSetting(key, value)`. Defaults: `{ showChat: true, showToday: true, showUpcoming: true }`.
- `src/renderer/views/SettingsPanel.ts` — exports `mountSettingsPanel(anchor, deps)` returning a teardown function. `deps` shape: `{ getAppSettings, setAppSetting, onChange }`.
- `test/step_defs/bug-fixes-1.steps.ts`
- `test/patterns/bug-fixes-1.spec.ts`
- `test/data/appSettings.spec.ts`
- `test/verify/bugFixes1.verify.ts` — Playwright script that captures: (1) initial render with the brand reading "TODO", (2) settings panel open with all three checkboxes, (3) sidebar after Show Chat is unchecked, (4) sidebar with a tag-free vault (no PROJECTS / PEOPLE sections).

### Files to update
- `src/main.ts` — register IPC handlers `settings:getAll` and `settings:set`. Wire to `readAppSettings`/`writeAppSetting`.
- `src/preload.ts` — expose `getAppSettings()` and `setAppSetting(key, value)` on `window.todoz`.
- `src/renderer/index.ts`:
  - **Brand rename:** line 67 — change the literal `'TaskStream'` to `'TODO'`. No other change to that function.
  - **Sidebar toggles:** at boot, fetch `window.todoz.getAppSettings()` and pass into `renderSidebar`. Update `renderSidebar` to filter `PRIMARY_ENTRIES` (chat, today, upcoming) by the matching `show*` flag. Inbox is always included regardless of settings.
  - **Settings panel:** wrap the existing `[data-icon=settings]` in `<button data-app-bar-settings aria-label="Settings">` if it is not already a button; wire a click handler that mounts `SettingsPanel`; teardown on close.
  - **Auto-hide sections:** in `renderSidebar()` (around line 183), after computing `uniqueTags(tasks)`, only create and append `[data-section="projects"]` if `projects.length > 0`, and only create and append `[data-section="people"]` if `people.length > 0`. The `[data-section-header]` text content remains `"PROJECTS"` and `"PEOPLE"`.
- `src/renderer/index.html` — add CSS for `[data-app-bar-settings]` (cursor pointer, hover state — match the "Open another vault" icon button from vault-picker for consistency), `[data-settings-panel]` (positioned absolute dropdown anchored below the settings icon, `surface-container-lowest` background, 1px `outline-variant` border, `rounded.md` (0.375rem) corners, 16px md padding, 8px sm gap between rows), and `[data-setting-toggle]` (label rows, `body-md` Inter 14px, native checkbox, 8px sm gap between checkbox and label).
- `test/view/designAndStructure.spec.ts:93,96` — update the `it("renders the TaskStream brand …")` test description to `it("renders the TODO brand in the top app bar")` and update its expectation from `"TaskStream"` to `"TODO"`.
- `test/features/design-and-structure.feature:6` — update the `Then` step's expected brand string from `"TaskStream"` to `"TODO"`. **Frozen-artifact override:** this rename plan supersedes the brand string in design-and-structure per the precedent in `features/add-task/plan.md`. No other line in the design-and-structure feature is touched.
- `test/step_defs/world.ts` — extend with an `appSettingsPath: string` per-scenario tmp file (mirror of the existing `vaultConfigPath` lifecycle from vault-picker).
- `package.json` — append `&& ts-node test/verify/bugFixes1.verify.ts` to the `verify:playwright` script.

### DOM contract
- `[data-brand]` (existing) — text changes from "TaskStream" to "TODO". Element shape, attributes, and styling unchanged.
- `[data-app-bar-settings]` (NEW or wraps existing `[data-icon=settings]`) — button anchor for the settings panel. `aria-label="Settings"`.
- `[data-settings-panel]` (NEW) — `role="menu"`, anchored absolute below `[data-app-bar-settings]`.
- `[data-setting-toggle="<key>"]` (NEW) — three labels with `key` ∈ `show-chat`, `show-today`, `show-upcoming`. Each contains an `<input type="checkbox">` and a label `<span>` with text "Show Chat" / "Show Today" / "Show Upcoming".
- `[data-sidebar-entry="<key>"]` (existing) — presence/absence depends on settings; `inbox` is always present.
- `[data-section="projects"]` and `[data-section="people"]` (existing) — entire element absent when its tag set is empty (not present-but-empty, not `display: none`).

### Visual treatment
- Brand: keeps existing typography, weight, color, and position. Only the rendered text changes.
- Settings icon button: 32×32 click target, transparent background by default, 1px `outline` border on hover, `rounded.DEFAULT` (0.25rem) corners. Match the "Open another vault" icon button from vault-picker for visual consistency.
- Settings panel: anchored absolute below the icon, right-aligned with the icon's right edge, 8px (sm) gap between icon and panel, 240px min width, `surface-container-lowest` background, 1px `outline-variant` border, `rounded.md` (0.375rem) corners, 16px (md) padding, 8px (sm) gap between rows.
- Toggle rows: `body-md` (Inter 14px 400) label, native checkbox, 8px (sm) gap between checkbox and label, full-row click target.
- No new styling for the auto-hide sections — the only change is conditional presence in the DOM.

## Data fixtures

No new `vault/todos/*.md` fixture files are expected to be required. The cucumber world's existing fixture-selection helpers should be sufficient to cover:

- A fixture set with **zero tags** (no `#` and no `@`). Likely satisfied by trimming the existing fixture set; otherwise Implement may add a single tagless fixture (e.g., `solo-task-2026-05-09.md`) and note it in `features/bug-fixes-1/notes.md`.
- A fixture set with **only `#`-tags** and a fixture set with **only `@`-tags** for the auto-hide assertions — likely satisfied by selection from the existing fixtures.

The cucumber world is also extended with a per-scenario `appSettingsPath: string` tmp file (mirroring the existing `vaultConfigPath` lifecycle from vault-picker). The world creates the path on `Before` and removes it on `After`. No `app-settings.json` content is committed; the Given steps write it at runtime when needed.
