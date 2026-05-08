---
name: Add task
slug: add-task
status: planned
frozen: true
created: 2026-05-07
---

# Add task

## Pattern summary

Users add new tasks via the floating command bar pinned to the bottom of the main area. Pressing `cmd + i` focuses the input and prefills `/add ` (with trailing space); typing a title and optional tag tokens then pressing Enter writes a single markdown file to `vault/todos/`. The `/add` slash is required — bare text is a no-op for this feature. Each whitespace-delimited token starting with `#` or `@` becomes a tag, lowercased: `#Errands` stores as `errands`, `@Mike` stores as `@mike`. The remaining tokens form the title. Plain `/add buy milk` writes a file with empty tags. Empty input (`/add` alone or with only whitespace) does nothing — no file written, no pulse, the input retains its value, focus stays. Each new file's frontmatter sets `type: task`, `title`, `status: todo`, `tags`, `created: <today>`; the body is empty. Filename is `<slugified-title>-<created-date>.md`; on collision the writer appends `-2`, `-3`, …. The left sidebar is now populated from real task data: each unique `#`-prefixed tag value renders as an entry under the **PROJECTS** section header, each `@`-prefixed tag value renders under **PEOPLE**, and **Inbox** is a static "all tasks" entry that is initially active (`<h1>Inbox</h1>`). After `/add` writes a file, every sidebar entry the new task belongs to pulses simultaneously via a `data-pulsing="true"` attribute (~600ms `secondary-container` flash, then attribute removed); a no-tag add pulses only Inbox. The active sidebar entry does not change after add. Clicking Inbox or any tag/person entry filters the main list to that set, swaps `<h1>` to the entry's name (`Inbox`, `#errands`, `@mike`), and updates the remaining-count line; the bordered card and row shape stay unchanged. Today and Upcoming remain visually present but inert in this feature; due-date syntax in `/add` and sub-task creation are out of scope.

This plan supersedes one acceptance criterion of `features/design-and-structure/plan.md` — the initial active sidebar entry is now **Inbox**, not Today, and the initial `<h1>` is **Inbox**, not Today. The existing `DesignAndStructure` test cases `marks the Today sidebar entry as active`, `renders an h1 reading Today in the main header`, and `renders a remaining-count line below the h1` (which expects "3 tasks remaining" against the 3-fixture set) will need to be revised by the Implement agent to reflect the new initial state and the 5-fixture set. See `## File map` for the exact tests to update.

## Acceptance criteria

1. Given the command bar is empty, when the user presses `cmd + i`, then the command bar input shows `/add ` with focus.
2. Given the command bar reads `/add buy milk`, when the user presses Enter, then a new task file `buy-milk-2026-05-07.md` appears in the vault todos folder.
3. Given the command bar reads `/add buy milk #urgent @sara`, when the user presses Enter, then a `#urgent` entry appears under PROJECTS and a `@sara` entry appears under PEOPLE in the sidebar.
4. Given the command bar reads `/add buy milk #urgent @sara`, when the user presses Enter, then the `#urgent` and `@sara` sidebar entries both have `data-pulsing="true"`.
5. Given the command bar reads `/add buy milk` (no tags), when the user presses Enter, then only the Inbox sidebar entry has `data-pulsing="true"`.
6. Given the vault contains the standard fixture todos and the initial render has completed, when the user clicks the `#errands` sidebar entry, then the main list shows only tasks tagged `errands` and the main `<h1>` reads `#errands`.
7. Given the vault contains the standard fixture todos, when the initial render completes, then the Inbox sidebar entry is visually active and the main `<h1>` reads `Inbox`.
8. Given the command bar reads `/add` (or `/add` plus whitespace only), when the user presses Enter, then no new task file is written, no sidebar entry pulses, and the command bar input still reads what was typed.

## Step-definition file

`test/step_defs/add-task.steps.ts` — steps:

- `Given("the command bar is empty")` (NEW) — mounts the app via `mountApp(this.document.body)` against an empty fixture set, then clears `[data-command-bar] input[type="text"]`.
- `Given("the command bar reads {string}")` (NEW) — mounts the app via `mountApp(this.document.body)` against the current `this.fixtures` (defaults to empty), then sets `[data-command-bar] input[type="text"]` value to the string.
- `When("the user presses cmd+i")` (NEW) — fires a `keydown` event with `metaKey: true, key: "i"` on `this.document` (bubbles, cancelable). Implementation must listen on `document`, not on the input.
- `When("the user presses Enter")` (NEW) — fires a `keydown` event with `key: "Enter"` on the `[data-command-bar] input[type="text"]` element.
- `When("the user clicks the {string} sidebar entry")` (NEW) — clicks the `[data-sidebar-entry]` whose visible label text equals the string (after trim). Inbox label is `"Inbox"`; tag labels carry the `#` or `@` prefix in their visible text (e.g., `"#errands"`, `"@mike"`).
- `Then("the command bar shows {string} with focus")` (NEW) — asserts `[data-command-bar] input[type="text"].value` equals the string and that input owns `this.document.activeElement`.
- `Then("a new task file {string} appears in the vault todos folder")` (NEW) — asserts `this.lastWriteFilePath` ends with the given filename (the renderer calls `window.todoz.writeFile(path, content)`; `world.ts` already records the most recent call into `lastWriteFilePath`/`lastWriteFileContent`).
- `Then("a {string} entry appears under PROJECTS in the sidebar")` (NEW) — asserts a `[data-sidebar-entry]` with that visible label exists inside `[data-sidebar] [data-section="projects"]`.
- `Then("a {string} entry appears under PEOPLE in the sidebar")` (NEW) — same as above for `[data-section="people"]`.
- `Then("the {string} sidebar entry pulses")` (NEW) — asserts the matching `[data-sidebar-entry]` has `data-pulsing="true"`. Match by visible label text.
- `Then("the Inbox sidebar entry pulses")` (NEW) — asserts `[data-sidebar-entry="inbox"][data-pulsing="true"]` exists.
- `Then("no other sidebar entry pulses")` (NEW) — asserts every `[data-sidebar-entry]` whose `data-sidebar-entry` attribute is **not** `"inbox"` lacks `data-pulsing="true"`.
- `Then("no sidebar entry pulses")` (NEW) — asserts no `[data-sidebar-entry]` element in the document has `data-pulsing="true"`.
- `Then("the main list shows only tasks tagged {string}")` (NEW) — asserts every visible `[data-task-row]` is for a task whose `tags` include the string, and no other rows are rendered. Cross-reference by walking each `[data-task]` ancestor and matching its `data-task` slug to the active filter's expected slugs.
- `Then("the main h1 reads {string}")` (NEW) — asserts `[data-main-header] h1` text equals the string.
- `Then("the Inbox sidebar entry is visually active")` (NEW) — asserts `[data-sidebar-entry="inbox"][data-nav-active]` exists.
- `Then("no new task file is written")` (NEW) — asserts `this.lastWriteFilePath === undefined` after the When step (the world resets state per scenario via Cucumber's default lifecycle; assert no write occurred during the When).
- `Then("the command bar still reads {string}")` (NEW) — asserts `[data-command-bar] input[type="text"].value` equals the string.

Reused steps (Cucumber loads all `test/step_defs/*.steps.ts` globally; do not redefine):

- `Given("the vault contains the standard fixture todos")` — defined in `test/step_defs/todoList.steps.ts`. The Implement agent must extend its `STANDARD_FIXTURES` array from 3 to 5 entries (see `## Data fixtures`). The existing `test/step_defs/todoList.steps.ts` `Then("every task title appears in due-date order")` assertion will need its expected title list updated to reflect the new 5-fixture set, sorted by due date, in the same edit. See `## File map`.
- `When("the initial render completes")` — defined in `test/step_defs/design-and-structure.steps.ts`. Reused as-is — it already calls `mountApp(this.document.body)` after wiring the fixtures into the mocked `window.todoz.readTodos`.

## BDD test list

[file: test/view/addTask.spec.ts]
- describe("AddTask") > it("focuses the command bar input on cmd+i")
- describe("AddTask") > it("prefills the command bar input with /add on cmd+i")
- describe("AddTask") > it("writes one task file when /add submits with a title")
- describe("AddTask") > it("clears the command bar input after a successful submit")
- describe("AddTask") > it("does not write a file when the input is /add only")
- describe("AddTask") > it("retains the input value when the input is /add only")
- describe("AddTask") > it("renders the Inbox sidebar entry as initially active")
- describe("AddTask") > it("renders an h1 reading Inbox on initial load")
- describe("AddTask") > it("renders one PROJECTS entry per unique non-@ tag")
- describe("AddTask") > it("renders one PEOPLE entry per unique @-prefixed tag")
- describe("AddTask") > it("creates a new sidebar entry the first time a tag is used")
- describe("AddTask") > it("sets data-pulsing on each matching sidebar entry after a tagged add")
- describe("AddTask") > it("sets data-pulsing only on Inbox after a no-tag add")
- describe("AddTask") > it("removes data-pulsing after the pulse duration")
- describe("AddTask") > it("filters the task list to matching tasks when a tag entry is clicked")
- describe("AddTask") > it("swaps the h1 to the active filter label")
- describe("AddTask") > it("keeps the active filter unchanged after submit")

[file: test/data/parseAddCommand.spec.ts]
- describe("parseAddCommand") > it("extracts the title from non-tag tokens")
- describe("parseAddCommand") > it("extracts #-prefixed tokens as tag values without the #")
- describe("parseAddCommand") > it("preserves the @ prefix on @-prefixed tokens")
- describe("parseAddCommand") > it("lowercases tag values")
- describe("parseAddCommand") > it("returns null when the title is empty")
- describe("parseAddCommand") > it("returns null when the input lacks the /add prefix")

[file: test/data/buildTaskFile.spec.ts]
- describe("buildTaskFile") > it("produces a slugified-title-date filename")
- describe("buildTaskFile") > it("appends -2 when the filename already exists")
- describe("buildTaskFile") > it("writes type, title, status, tags, created in frontmatter")
- describe("buildTaskFile") > it("writes an empty body")

## Concrete DOM contract

These are the data-attribute hooks the Implement agent must emit. Tests query exclusively through these — no class-name selectors, no tag-name fall-back. New attributes for this feature are marked `(NEW)`; reused attributes from the design-and-structure render are marked `(REUSED)`.

```
[data-region="sidebar"] / [data-sidebar]               (REUSED — `[data-sidebar]` already in chrome)
  [data-sidebar-entry="inbox"]                         (NEW — replaces today's Inbox `[data-nav-entry]`)
    [data-nav-active]                                  (REUSED — present iff this entry is the active filter; default on Inbox)
    [data-pulsing="true"]                              (NEW — present for ~600ms after a matching add)
    [data-nav-label]                                   (REUSED — visible "Inbox" text)
  [data-sidebar-entry="today"]                         (NEW — Today entry, inert in this feature)
  [data-sidebar-entry="upcoming"]                      (NEW — Upcoming entry, inert in this feature)
  [data-sidebar-entry="chat"]                          (NEW — Chat entry, inert in this feature)

  [data-section="projects"]                            (NEW — replaces unkeyed `[data-section]` for the Projects group)
    [data-section-header]                              (REUSED — "PROJECTS" text)
    [data-sidebar-entry="<tag>"]                       (NEW — one per unique non-@ tag across the vault)
      [data-nav-active]                                (NEW — present iff this is the current filter)
      [data-pulsing="true"]                            (NEW — present briefly after a matching add)
      [data-nav-label]                                 (REUSED — visible label, prefixed `#<tag>`)

  [data-section="people"]                              (NEW — replaces unkeyed `[data-section]` for the People group)
    [data-section-header]                              (REUSED — "PEOPLE" text)
    [data-sidebar-entry="<@tag>"]                      (NEW — one per unique @-prefixed tag; the attribute value
                                                              keeps the leading `@`, e.g. `data-sidebar-entry="@mike"`)
      [data-nav-active]                                (NEW)
      [data-pulsing="true"]                            (NEW)
      [data-nav-label]                                 (REUSED — visible label with leading `@`)

[data-main-header]                                     (REUSED)
  h1                                                   (REUSED — text mirrors the active filter: "Inbox", "#errands", "@mike")
  [data-remaining-count]                               (REUSED — count reflects the currently filtered list)

[data-task-card] [data-task-list]                      (REUSED)
  [data-task="<slug>"]                                 (REUSED — present iff its tags match the active filter)
    [data-task-row]                                    (REUSED)
    …                                                  (REUSED — chevron, checkbox, title, chip, due, subtasks unchanged)

[data-command-bar]                                     (REUSED)
  input[type="text"]                                   (REUSED — focused on cmd+i; value cleared after a successful submit;
                                                              value preserved on a no-op submit)
  [data-shortcut-hint]                                 (REUSED — text remains "CMD + K" for this feature)
```

Notes for Implement:

- `data-sidebar-entry` value is the slugified key used to find the row from a step. For Inbox it is the literal `"inbox"`. For tag entries it is the lowercased tag value, with the `@` retained for people tags (e.g. `"errands"`, `"@mike"`). The visible label inside `[data-nav-label]` is human-facing and includes the `#` for project tags (e.g. `"#errands"`).
- The pulse mechanism: set `data-pulsing="true"` synchronously on each matching entry, then schedule a single `setTimeout(..., 600)` to remove it on every entry that has it. A CSS rule on `[data-sidebar-entry][data-pulsing="true"]` provides the `secondary-container` flash; the rule is added in `src/renderer/index.html` `<style>`.
- Click-to-filter binds to every `[data-sidebar-entry]` (including Inbox). Clicking sets `data-nav-active` on the clicked entry, removes it from every other `[data-sidebar-entry]`, updates `<h1>` text to the visible label (Inbox uses literal `"Inbox"`; tag entries use the visible `#<tag>` / `@<tag>` form), and re-renders the task list filtered by the entry's filter key (Inbox = no filter; tag entry = require the tag to be present in `task.tags`).
- After a successful `/add`, the active filter does not change; the renderer re-reads the vault (or appends in-memory), regenerates the sidebar entries, then briefly sets `data-pulsing` on each entry the new task belongs to (Inbox always; matching `#`/`@` entries when tagged).
- Empty `/add` (after stripping whitespace, no tokens left) is a no-op: do not call `writeFile`, do not pulse, do not clear the input.

## File map

```
NEW    src/renderer/data/parseAddCommand.ts            — pure: (input: string) => { title: string; tags: string[] } | null
NEW    src/renderer/data/buildTaskFile.ts              — pure: ({ title, tags, today, existingFilenames }) => { filename: string; content: string }
EXTEND src/renderer/index.ts                           — extend renderSidebar to consume tasks (group by tag),
                                                         add Inbox+filter active state, add cmd+i listener,
                                                         add Enter handler on command bar, switch initial active
                                                         from Today to Inbox, switch initial h1 from "Today" to "Inbox",
                                                         emit `data-sidebar-entry`, `data-section="projects|people"`,
                                                         and `data-pulsing` per the DOM contract.
EXTEND src/renderer/index.html                         — add CSS rule for `[data-sidebar-entry][data-pulsing="true"]`
                                                         (~600ms `secondary-container` background) so the visual
                                                         pulse is verifiable in the Playwright pass.

NEW    test/view/addTask.spec.ts                       — Tallahassee/JSDOM specs per `## BDD test list`
NEW    test/data/parseAddCommand.spec.ts               — pure parser specs
NEW    test/data/buildTaskFile.spec.ts                 — pure file-builder specs
NEW    test/step_defs/add-task.steps.ts                — Cucumber steps per `## Step-definition file`

EXTEND test/step_defs/todoList.steps.ts                — extend STANDARD_FIXTURES from 3 to 5 entries
                                                         (add `pickup-package` and `sync-with-mike` per
                                                         `## Data fixtures`); update the
                                                         `Then("every task title appears in due-date order")`
                                                         expected-title list to match the new 5-fixture
                                                         due-ascending sort.
EXTEND test/view/designAndStructure.spec.ts            — supersede the legacy initial-state assertions:
                                                         (a) rename / rewrite `marks the Today sidebar entry as active`
                                                         to assert `[data-sidebar-entry="inbox"][data-nav-active]`,
                                                         (b) rewrite `renders an h1 reading Today in the main header`
                                                         to expect "Inbox",
                                                         (c) keep `renders a remaining-count line below the h1`
                                                         green by switching the expected text to whatever the new
                                                         5-fixture Inbox view shows ("5 tasks remaining" or whichever
                                                         non-`done` count results from the fixture set —
                                                         note `call-dentist` already has `status: done` on disk).
                                                         The renderSidebar nav-entry test
                                                         (`renders the primary sidebar navigation entries`) still
                                                         expects the same four labels Chat / Inbox / Today / Upcoming
                                                         in the same order — keep it green.
```

No file under `src/main/` or the Electron preload changes — `window.todoz.writeFile(path, content)` already exists and is what the new writer must call. The Implement agent must NOT add a `writeTodo` IPC method; the existing `writeFile` is the contract.

## Data fixtures

The three existing fixtures cover scenarios that depend on standard fixture todos (sort order, expanded subtasks, etc.) but lack the `errands` and `@mike` tags this feature needs to seed PROJECTS and PEOPLE sidebar entries. Two new fixtures are added; the standard fixture set becomes five files. Both new fixture files already exist on disk and match the `vault/AGENTS.md` schema — the Implement agent only needs to extend the in-memory `STANDARD_FIXTURES` constant in `test/step_defs/todoList.steps.ts` to mirror them.

- `test/fixtures/vault/todos/call-dentist-2026-05-04.md` (EXISTING — reuse)
- `test/fixtures/vault/todos/q2-report-2026-05-04.md` (EXISTING — reuse)
- `test/fixtures/vault/todos/read-anthropic-paper-2026-05-04.md` (EXISTING — reuse)
- `test/fixtures/vault/todos/pickup-package-2026-05-04.md` (EXISTING — reuse) — frontmatter:
  `type: task / title: "Pickup package" / status: todo / due: 2026-05-09 / tags: [errands] / created: 2026-05-04`;
  body: `- [ ] Bring tracking number\n`. Seeds the `#errands` PROJECTS sidebar entry for the click-to-filter scenario.
- `test/fixtures/vault/todos/sync-with-mike-2026-05-04.md` (EXISTING — reuse) — frontmatter:
  `type: task / title: "Sync with Mike" / status: todo / due: 2026-05-12 / tags: ["@mike"] / created: 2026-05-04`;
  body: `- [ ] Walk through Q2 plan\n`. Seeds the `@mike` PEOPLE sidebar entry, exercising the `@`-prefixed grouping rule.

## Trace table

| Criterion | Scenario (test/features/add-task.feature) | Tests |
|---|---|---|
| 1. cmd+i prefills `/add ` with focus | "cmd+i prefills the command bar with /add" | `addTask.spec.ts` > "focuses the command bar input on cmd+i", "prefills the command bar input with /add on cmd+i" |
| 2. `/add buy milk` writes one file | "/add writes a new task file" | `addTask.spec.ts` > "writes one task file when /add submits with a title", "clears the command bar input after a successful submit"; `buildTaskFile.spec.ts` > all four; `parseAddCommand.spec.ts` > "extracts the title from non-tag tokens" |
| 3. Tagged `/add` creates new sidebar entries | "tagged /add creates new sidebar entries" | `addTask.spec.ts` > "renders one PROJECTS entry per unique non-@ tag", "renders one PEOPLE entry per unique @-prefixed tag", "creates a new sidebar entry the first time a tag is used"; `parseAddCommand.spec.ts` > "extracts #-prefixed tokens as tag values without the #", "preserves the @ prefix on @-prefixed tokens", "lowercases tag values" |
| 4. Tagged `/add` pulses matching entries | "tagged /add pulses matching sidebar entries" | `addTask.spec.ts` > "sets data-pulsing on each matching sidebar entry after a tagged add", "removes data-pulsing after the pulse duration" |
| 5. No-tag `/add` pulses only Inbox | "untagged /add pulses only the Inbox entry" | `addTask.spec.ts` > "sets data-pulsing only on Inbox after a no-tag add" |
| 6. Click `#errands` filters list + h1 | "clicking a tag entry filters the list" | `addTask.spec.ts` > "filters the task list to matching tasks when a tag entry is clicked", "swaps the h1 to the active filter label", "keeps the active filter unchanged after submit" |
| 7. Initial render shows Inbox active | "initial render shows Inbox active" | `addTask.spec.ts` > "renders the Inbox sidebar entry as initially active", "renders an h1 reading Inbox on initial load" |
| 8. Empty `/add` is a no-op | "empty /add does nothing" | `addTask.spec.ts` > "does not write a file when the input is /add only", "retains the input value when the input is /add only"; `parseAddCommand.spec.ts` > "returns null when the title is empty", "returns null when the input lacks the /add prefix" |

## Test-tree audit

**Reusable** (already on disk; the Implement agent should pull these in, not duplicate them):

- `test/step_defs/world.ts` — `TodozWorld` exposes `mountWindow()`, `lastWriteFilePath`, `lastWriteFileContent`, `fixtures`, `document`. The new step file imports `TodozWorld` for typed `this`.
- `test/step_defs/todoList.steps.ts` — defines and exports `STANDARD_FIXTURES` (extend in place) and the `Given("the vault contains the standard fixture todos")` step. Reused; do not redefine.
- `test/step_defs/design-and-structure.steps.ts` — defines `When("the initial render completes")` and the `fixtureToTask` helper that wires `this.fixtures` into the JSDOM `window.todoz.readTodos`. Reused as-is.
- `test/view/designAndStructure.spec.ts` — pattern for setting up JSDOM + `window.todoz` mock + invoking `mountApp`. New `addTask.spec.ts` follows the same `setupDom` / `buildTasks` shape.
- `test/fixtures/vault/todos/pickup-package-2026-05-04.md`, `sync-with-mike-2026-05-04.md` — already on disk per `## Data fixtures`.
- `src/renderer/data/parseTodo.ts` — `Task` type and `parseTopLevelSubtasks` helper. New `buildTaskFile.ts` produces a string that `parseTodo` can round-trip; specs MAY assert that round-trip property.
- `src/renderer/index.ts` — `mountApp` is the existing mount entry. Extend it; do not introduce a parallel mount.
- `window.todoz.writeFile(path, content)` — the existing write IPC. The new writer module composes `path` and `content` and delegates to this single call.

**To add** (every file in `## File map` marked NEW or EXTEND that does not yet exist):

- `src/renderer/data/parseAddCommand.ts` (NEW)
- `src/renderer/data/buildTaskFile.ts` (NEW)
- `test/view/addTask.spec.ts` (NEW)
- `test/data/parseAddCommand.spec.ts` (NEW)
- `test/data/buildTaskFile.spec.ts` (NEW)
- `test/step_defs/add-task.steps.ts` (NEW)
- `src/renderer/index.ts` (EXTEND per `## File map`)
- `src/renderer/index.html` (EXTEND — pulse CSS only)
- `test/step_defs/todoList.steps.ts` (EXTEND — fixture array + sort assertion)
- `test/view/designAndStructure.spec.ts` (EXTEND — initial-state assertion supersession)

**Gaps** (none — every requirement in this plan maps to a file in the File map and a test in the BDD test list):

- The plan does not claim a Playwright/Electron verify scenario for this feature beyond what already runs; the visual pulse is captured in the next `npm run verify` screenshot pass and read by the Verify agent. No new verify driver script is required.
- The current state of `test/fixtures/vault/todos/call-dentist-2026-05-04.md` on disk has `status: done` and both subtasks checked. This is **outside the scope of add-task** and is not addressed by this plan; it surfaces as a pre-existing issue with the design-and-structure / writeTodo round-trip restore step. If extending `STANDARD_FIXTURES` reveals related test failures, the Implement agent appends a `## Problem` block to `features/add-task/notes.md` and stops.

## Gate check

- [x] Every acceptance criterion has exactly one Gherkin scenario (8 → 8)
- [x] Every Gherkin step is listed under step definitions, marked NEW or REUSE
- [x] Every Tallahassee/unit test traces to a Gherkin step or step dependency (see `## Trace table`)
- [x] No scenario or test name contains "and"
- [x] DOM contract covers every assertion the tests will make
- [x] File map lists every file Implement will touch
- [x] Every fixture matches `vault/AGENTS.md` schema
- [x] No invented requirements — every change traces to source plan or assets
- [x] Zero lines of TypeScript or JavaScript written by the Plan agent

---

Plan complete. Ready for Implement.
