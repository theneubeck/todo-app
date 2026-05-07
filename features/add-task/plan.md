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

This plan supersedes one acceptance criterion of `features/design-and-structure/plan.md` — the initial active sidebar entry is now **Inbox**, not Today.

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

- `Given("the command bar is empty")` — clears the command bar input value
- `Given("the command bar reads {string}")` — sets the command bar input value
- `When("the user presses cmd+i")` — fires keydown with `metaKey: true, key: "i"` on the document
- `When("the user presses Enter")` — fires keydown `Enter` on the command bar input
- `When("the user clicks the {string} sidebar entry")` — clicks the sidebar entry whose label text matches the string
- `Then("the command bar shows {string} with focus")` — asserts the command bar input value equals the string and the input owns `document.activeElement`
- `Then("a new task file {string} appears in the vault todos folder")` — asserts the mocked `window.todoz.writeTodo` adapter received that filename
- `Then("a {string} entry appears under PROJECTS in the sidebar")` — asserts a `[data-sidebar-entry]` with that label exists inside `[data-section="projects"]`
- `Then("a {string} entry appears under PEOPLE in the sidebar")` — asserts the same inside `[data-section="people"]`
- `Then("the {string} sidebar entry pulses")` — asserts the matching `[data-sidebar-entry]` has `data-pulsing="true"`
- `Then("the Inbox sidebar entry pulses")` — asserts `[data-sidebar-entry="inbox"][data-pulsing="true"]`
- `Then("no other sidebar entry pulses")` — asserts every `[data-sidebar-entry]` except Inbox lacks `data-pulsing`
- `Then("no sidebar entry pulses")` — asserts no `[data-sidebar-entry]` has `data-pulsing`
- `Then("the main list shows only tasks tagged {string}")` — asserts every visible `[data-task-row]` is for a task whose `tags` include the string, and no other rows are rendered
- `Then("the main h1 reads {string}")` — asserts `<h1>` text equals the string
- `Then("the Inbox sidebar entry is visually active")` — asserts `[data-sidebar-entry="inbox"][data-nav-active]`
- `Then("no new task file is written")` — asserts the mocked `writeTodo` adapter received zero calls during the When
- `Then("the command bar still reads {string}")` — asserts the command bar input value equals the string

Reused steps (Cucumber loads all `test/step_defs/*.steps.ts` globally; do not redefine):

- `Given("the vault contains the standard fixture todos")` — from `test/step_defs/todoList.steps.ts`
- `When("the initial render completes")` — from `test/step_defs/design-and-structure.steps.ts`

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

## Data fixtures

The three existing fixtures cover scenarios that depend on standard fixture todos (sort order, expanded subtasks, etc.) but lack the `errands` and `@mike` tags this feature needs to seed PROJECTS and PEOPLE sidebar entries. Two new fixtures are added; the standard fixture set becomes five files.

- `test/fixtures/vault/todos/call-dentist-2026-05-04.md` — existing, no change
- `test/fixtures/vault/todos/q2-report-2026-05-04.md` — existing, no change
- `test/fixtures/vault/todos/read-anthropic-paper-2026-05-04.md` — existing, no change
- `test/fixtures/vault/todos/pickup-package-2026-05-04.md` — new — task tagged `errands` to seed a `#errands` PROJECTS sidebar entry for the click-to-filter scenario
- `test/fixtures/vault/todos/sync-with-mike-2026-05-04.md` — new — task tagged `@mike` to seed a `@mike` PEOPLE sidebar entry, exercising the `@`-prefixed grouping rule

---

Plan complete. Ready for Implement.
