---
name: Read and Watch resources
slug: read-watch
status: planned
frozen: true
created: 2026-05-17
---

# Read and Watch resources

## Pattern summary

A **RESOURCES** section appears in the left sidebar below PEOPLE, containing two fixed entries: "To Read" (bookmark icon) and "To Watch" (play circle icon). These are always visible regardless of whether any tasks carry resource tags. Tasks are tagged with `>read` or `>watch` via the command bar using the `>` sigil — e.g., `/add The Design of Everyday Things >read` or `/add Watch WWDC Session >watch`. Clicking a resource entry filters the main view to show only tasks with that tag; the header updates to "To Read" or "To Watch". The `>` sigil also triggers the tag autocomplete dropdown (same as `#` and `@`), suggesting `>read` and `>watch`. `/goto >read` and `/goto >watch` navigate via the command bar. Resource tags never appear in the PROJECTS section of the sidebar.

**In scope:** sidebar RESOURCES section (two fixed entries, always shown); `>` sigil in `parseAddCommand` (stored as `>read`/`>watch` in the `tags` array); `filterLabel` returning "To Read"/"To Watch"; `uniqueTags` excluding `>` tags from projects; `>` trigger in autocomplete (suggests `>read`, `>watch`); resource entries in the `/goto ` fuzzy-search pool; `/goto >read` and `/goto >watch` in `parseGotoCommand`.

**Out of scope:** per-row resource icons on task cards (follow-on visual polish); "READING LIST" group header within the task list (requires list grouping logic — separate feature); custom resource types beyond `>read` and `>watch`; settings toggle for RESOURCES visibility.

## Acceptance criteria

1. Given the app is mounted with no tasks, when the sidebar renders, then `[data-section="resources"]` is present and contains both `[data-sidebar-entry=">read"]` and `[data-sidebar-entry=">watch"]`.
2. Given a task tagged `>read` exists in the vault, when the user clicks the To Read sidebar entry, then `[data-main-header] h1` shows "To Read" and the task is visible in the main list.
3. Given a task tagged `>watch` exists in the vault, when the user clicks the To Watch sidebar entry, then `[data-main-header] h1` shows "To Watch" and the task is visible.
4. Given the command bar input, when the user types `>` in the command bar, then the autocomplete dropdown shows both `>read` and `>watch`.
5. Given the command bar input, when the user types `/goto >read` and presses Enter, then `[data-main-header] h1` shows "To Read".

## Step-definition file

`test/step_defs/read-watch.steps.ts` — new steps only; all other steps reused from existing files.

**Given:**
- `Given("the command bar input is empty")` (REUSE — `command-bar-fixes.steps.ts`)
- `Given("the vault contains tasks tagged {string}")` (REUSE — `tag-autocomplete.steps.ts`)

**When:**
- `When("the user clicks sidebar entry {string}")` (NEW) — queries `[data-sidebar-entry="{value}"]` and calls `.click()`
- `When("the user types {string} in the command bar")` (REUSE — `chat-interface.steps.ts`)
- `When("the user types {string} in the command bar and presses Enter")` (REUSE — `chat-interface.steps.ts`)

**Then:**
- `Then("the sidebar has a resources section")` (NEW) — asserts `[data-section="resources"]` is present and contains `[data-sidebar-entry=">read"]` and `[data-sidebar-entry=">watch"]`
- `Then("the main header title is {string}")` (REUSE — `goto-command.steps.ts`)
- `Then("the autocomplete dropdown is shown")` (REUSE — `tag-autocomplete.steps.ts`)
- `Then("the dropdown shows {string}")` (REUSE — `tag-autocomplete.steps.ts`)

## BDD test list

[file: test/view/readWatch.spec.ts]
- `describe("Read and Watch resources")` > `it("renders [data-section='resources'] in the sidebar on mount")`
- `describe("Read and Watch resources")` > `it("resources section contains To Read and To Watch entries")`
- `describe("Read and Watch resources")` > `it("clicking To Read sets the main header to To Read")`
- `describe("Read and Watch resources")` > `it("clicking To Watch sets the main header to To Watch")`
- `describe("Read and Watch resources")` > `it("resource tags do not appear in the PROJECTS section")`
- `describe("Read and Watch resources")` > `it("filterLabel returns To Read for the >read tag filter")`
- `describe("Read and Watch resources")` > `it("filterLabel returns To Watch for the >watch tag filter")`

[file: test/data/parseAddCommand.spec.ts] (extend existing file)
- `describe("parseAddCommand")` > `it("parses >read token as a resource tag stored with > prefix")`
- `describe("parseAddCommand")` > `it("parses >watch token as a resource tag stored with > prefix")`
- `describe("parseAddCommand")` > `it("strips > token from the title word list")`

[file: test/data/autocompleteSuggestions.spec.ts] (extend existing file)
- `describe("getSuggestions")` > `it("returns >read and >watch suggestions for a > trigger word")`
- `describe("getSuggestions")` > `it("filters resource suggestions by query after >")`
- `describe("getGotoSuggestions")` > `it("includes >read and >watch in the /goto suggestion pool")`

[file: test/data/parseGotoCommand.spec.ts] (extend existing file)
- `describe("parseGotoCommand")` > `it("returns { kind: 'tag', value: '>read' } for /goto >read")`
- `describe("parseGotoCommand")` > `it("returns { kind: 'tag', value: '>watch' } for /goto >watch")`

## File map

### New files
- `test/step_defs/read-watch.steps.ts` — 2 new step definitions (see above)
- `test/view/readWatch.spec.ts` — 7 Tallahassee DOM tests
- `test/verify/readWatch.verify.ts` — Playwright E2E verify; screenshots to `tmp/readWatch-*.png`

### Files to update
- `src/renderer/data/parseAddCommand.ts`:
  - Add `>` token branch in the token loop: if `token.startsWith('>')`, extract `token.toLowerCase()` (keep the `>` prefix, e.g., `>read`), push to `tags` if length > 1. Exclude `>` tokens from `titleTokens`.
- `src/renderer/data/autocompleteSuggestions.ts`:
  - Extend `AllTags` interface with `resources: string[]`.
  - Add `>` branch in `getSuggestions`: `pool = allTags.resources`, `toLabel = (tag) => tag`, `toInsert = (tag) => tag`. Substring-filter by characters after `>` in the trigger word.
  - Update `getGotoSuggestions` to include `allTags.resources` in the merged pool (formatted as `{ label: tag, insert: tag }` — the `>` prefix is already in the stored value).
- `src/renderer/data/parseGotoCommand.ts`:
  - Add `>` prefix branch: `if (dest.startsWith('>') && dest.length > 1) return { kind: 'tag', value: dest }`.
- `src/renderer/index.ts`:
  - `uniqueTags`: add `resources` to return type. Tags starting with `>` go into a fixed `['>read', '>watch']` array (always included, never pushed to projects). Exclude `>` tags from the `projects` set.
  - `filterLabel`: add `if (filter.value === '>read') return 'To Read'` and `if (filter.value === '>watch') return 'To Watch'` before the `#` fallback.
  - `renderSidebar`: add a RESOURCES section below the PEOPLE section — two fixed entries rendered with `renderTagEntry`. "To Read" uses `data-sidebar-entry=">read"` and icon `bookmark`. "To Watch" uses `data-sidebar-entry=">watch"` and icon `play_circle`.
  - `getAllTags` call sites (in `mountAutocompleteDropdown` deps): pass `resources: ['>read', '>watch']` from the updated `uniqueTags` return value.
  - `bindSidebarClicks`: no change needed — `>read` and `>watch` keys fall through to the default `filterFromEntryKey` path, which already returns `{ kind: 'tag', value: '>read' }`.
- `test/data/parseAddCommand.spec.ts` — add 3 tests for `>` token handling.
- `test/data/autocompleteSuggestions.spec.ts` — add 3 tests for `>` trigger and goto pool.
- `test/data/parseGotoCommand.spec.ts` — add 2 tests for `/goto >read`/`>watch`.

### DOM contract
- `[data-section="resources"]` (NEW) — RESOURCES section container in sidebar; always present when the app is mounted
- `[data-sidebar-entry=">read"]` (NEW) — "To Read" sidebar entry inside `[data-section="resources"]`
- `[data-sidebar-entry=">watch"]` (NEW) — "To Watch" sidebar entry inside `[data-section="resources"]`
- All existing selectors (`[data-section="projects"]`, `[data-section="people"]`, `[data-main-header] h1`, `[data-nav-active]`, `[data-autocomplete]`, etc.) unchanged.

### Visual treatment
- RESOURCES section header: same style as PROJECTS/PEOPLE — `label-md` (Inter 12px 500, `on-surface-variant` #4c4546), uppercase text "RESOURCES", 16px (md) top padding.
- "To Read" row: `bookmark` Material Symbol icon + "To Read" label; same row layout as PEOPLE/PROJECTS entries.
- "To Watch" row: `play_circle` Material Symbol icon + "To Watch" label; same row layout.
- Active state: `[data-nav-active]` class — same highlight as other sidebar entries (already defined in CSS).
- No new CSS tokens required.

## Data fixtures

No new committed fixture files. Cucumber scenarios use `Given("the vault contains tasks tagged {string}")` (from `tag-autocomplete.steps.ts`) passing `">read"` or `">watch"` — `fixturesFromTagList` does not strip the `>` prefix, so tags are stored correctly as `>read`/`>watch` in the fixture frontmatter and parsed task objects.

## Conflicts & Decisions

**Conflicts:** none. Resource tags (`>`) are a new namespace that does not collide with `#` (projects) or `@` (people).

**Decisions:**
- **`>` as the resource sigil** — user proposed this; it's visually distinct, unused in the existing tag grammar, and easy to type. Stored with the `>` prefix (like `@` for people) so the sigil survives in frontmatter without ambiguity.
- **Two fixed resource types only** — `>read` and `>watch` match the mockup exactly. Extensible later without a schema change (any `>` tag could become a resource type).
- **RESOURCES section always shown** — the mockup shows them as fixed nav entries (like Inbox), not dynamic like PROJECTS/PEOPLE. Avoids a chicken-and-egg problem where you can't navigate to an empty resource list to add tasks.
- **Row icons out of scope** — the bookmark/play icons on task rows in the mockup require injecting icon elements into the existing task row renderer, which is a separate concern. Kept clean for now.
- **READING LIST group header out of scope** — the mockup shows grouped sections (HIGH PRIORITY, OTHER TASKS, READING LIST) within the main view; implementing list grouping is a larger feature. The resource filter simply shows all `>read`/`>watch` tasks in a flat list.
- **`AllTags.resources` always returns `['>read', '>watch']`** — rather than deriving from actual task tags, the fixed set is always provided. This ensures autocomplete and goto suggestions always include both resource types, matching the "always shown" sidebar decision.
