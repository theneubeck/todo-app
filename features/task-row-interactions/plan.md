---
name: Task row interactions
slug: task-row-interactions
status: planned
frozen: true
created: 2026-05-08
---

# Task row interactions

## Pattern summary

This plan supersedes two test cases of `features/design-and-structure/plan.md` — under the new contract a task row's chrome depends on whether the task has subtasks: combined rows get a chevron and **no** parent checkbox (the row body is the click target that toggles expanded), simple rows get a parent checkbox and **no** chevron. The two affected cases in `test/view/designAndStructure.spec.ts` are:

1. `renders a chevron, a checkbox, a title, a chip on every task row` (lines 173–183). All `STANDARD_FIXTURES` tasks in that test are combined (each has at least one top-level subtask), so the existing assertion that every row carries `input[type="checkbox"]` is no longer true. The Implement agent rewrites this test to assert the **combined-row** shape only — chevron present, **no** `[data-checkbox-wrapper]`, title present, chip present — since every fixture in the existing build is combined. The simple-row shape is asserted in the new `taskRowInteractions.spec.ts` against the task-row-interactions fixture set.
2. `writes status:done to file when a parent checkbox in the chrome is clicked` (lines 224–250). Its premise (clicking a combined task's parent checkbox flips frontmatter `status: done`) no longer applies — combined rows have no parent checkbox at all. The Implement agent rewrites this test to assert that combined task rows have **no** `[data-checkbox-wrapper]` descendant in the parent row (the simple-row checkbox-toggle behavior is covered end-to-end in `taskRowInteractions.spec.ts`). The legacy assertion that subtask checkboxes flip subtask body lines stays untouched in the existing test below it (`writes back the toggled subtask line when a subtask checkbox is clicked`).

The remaining `designAndStructure.spec.ts` cases — including `expands a collapsed task row when its row is clicked` and `collapses an expanded task row when its row is clicked again` — already align with the combined-row "row body is click target" contract and stay green as-is.

Each task in the rendered list responds to three interactions on its row, and the row's structure depends on whether the task has subtasks. **Simple tasks** (zero top-level `- [ ]` lines in the body) render without a chevron — just a checkbox, title, optional priority chip, optional due date, and a subtle remove icon at the right edge. Clicking the checkbox toggles the task's frontmatter `status` between `todo` and `done` via `writeTodo.toggleParent` and writes the file back through `window.todoz.writeFile`; per `DESIGN.md` the title gets a strikethrough and `on-surface-variant` gray, and the checkbox fills with a success green. Unchecking reverses both. **Combined tasks** (one or more top-level `- [ ]` lines in the body) render with a chevron at the row's left and **no checkbox** — the row itself is the click target, and clicking anywhere on it (except the remove icon) toggles expanded / collapsed, rotating the chevron 90°. When expanded, subtask rows render indented below the parent; each subtask row has its own checkbox and its own remove icon. Clicking a subtask checkbox flips that subtask's `[ ]` ↔ `[x]` in the parent's body via `writeTodo.toggleSubtask` and writes the parent file back; subtask completion does **not** bubble to the parent's status. The **remove icon** is a subtle ever-present icon at the right edge of every row (top-level and subtask). Clicking it opens an inline confirm prompt that swaps the row's right-side metadata to "Remove? Yes / No". Confirming on a top-level task (simple or combined) moves the entire `.md` file to `vault/archive/todos/` via a new `window.todoz.archiveFile` IPC; confirming on a subtask rewrites the parent file with that subtask's line (and any contiguous indented child lines) deleted from the body, via a new `writeTodo.removeSubtask` pure function. Clicking "No" tears down the confirm prompt and leaves the row unchanged. **In scope:** the three interactions above on the already-rendered task list, the chevron-only-when-needed change, and the `status: done` visual style per `DESIGN.md`. **Out of scope:** keyboard shortcuts, multi-select / bulk ops, undo, the live remaining-count update under the h1, drag-to-reorder, end-of-week auto-archive, any sidebar changes, and any rendering of nested (deeper than top-level) subtasks.

## Acceptance criteria

1. Given the rendered list contains both simple tasks and a combined task, when the initial render completes, then only combined-task rows display a chevron — simple-task rows have no chevron icon.
2. Given a simple task with frontmatter `status: todo` is rendered, when the user clicks its checkbox, then the file's frontmatter becomes `status: done`, the checkbox shows the checked success state, and the title is strikethrough with `on-surface-variant` color.
3. Given a simple task with frontmatter `status: done` is rendered, when the user clicks its checkbox, then the file's frontmatter becomes `status: todo` and the row's checked styling is removed.
4. Given a combined task is rendered collapsed, when the user clicks anywhere on its row except the remove icon, then the row expands, the chevron rotates, and one indented subtask row appears for each top-level body bullet.
5. Given a combined task is rendered expanded, when the user clicks a subtask's checkbox, then the subtask's `[ ]` flips to `[x]` in the parent file's body, the subtask row's checked styling appears, and the parent's frontmatter `status` is unchanged.
6. Given any task row is rendered, when the user clicks its remove icon and clicks "No" on the confirm prompt, then no file change occurs and the row returns to its previous appearance.
7. Given any top-level task (simple or combined) is rendered, when the user clicks its remove icon and clicks "Yes" on the confirm prompt, then the task's `.md` file is moved from `vault/todos/` to `vault/archive/todos/` and the row no longer appears in the list.
8. Given a combined task is rendered expanded, when the user clicks a subtask's remove icon and clicks "Yes" on the confirm prompt, then that subtask's line (with any contiguous indented child lines) is removed from the parent file's body and the subtask row no longer appears under the parent.

## Step-definition file

`test/step_defs/task-row-interactions.steps.ts` — steps:

NEW:

- `Given("the vault contains task-row-interactions fixtures")` — wires the four-fixture set into a mocked `window.todoz.readTodos` (and `window.todoz.readFile` for any direct reads), then mounts the app via `mountApp(this.document.body)`. Does **not** extend `STANDARD_FIXTURES`.
- `Given("the combined task {string} is rendered collapsed")` — asserts the matching `[data-task]` element does not carry `data-expanded="true"` after initial render.
- `Given("the combined task {string} is expanded")` — clicks the parent row body to expand; asserts `[data-task][data-expanded="true"]` exists for the matching task.
- `When("the user clicks the checkbox of the {string} row")` — clicks `[data-task="<slug>"] [data-task-row] [data-checkbox-wrapper] input[type="checkbox"]`.
- `When("the user clicks the body of the {string} row")` — clicks the title region of `[data-task="<slug>"] [data-task-row]` (target descends from neither `[data-checkbox-wrapper]` nor `[data-remove]`).
- `When("the user clicks the checkbox of the {string} subtask under {string}")` — finds the subtask row by visible label under the parent's `[data-subtask-list]`, then clicks its `[data-checkbox-wrapper] input[type="checkbox"]`.
- `When("the user clicks the remove icon of the {string} row")` — clicks `[data-task="<slug>"] [data-task-row] [data-remove]`.
- `When("the user clicks the remove icon of the {string} subtask under {string}")` — clicks the matching subtask row's `[data-remove]` under the parent's `[data-subtask-list]`.
- `When("the user clicks {string} on the confirm prompt")` — `"Yes"` clicks `[data-confirm-yes]`; `"No"` clicks `[data-confirm-no]`. The active confirm element is unique in the document.
- `Then("only combined-task rows display a chevron")` — asserts every `[data-task][data-kind="combined"]` contains a `[data-chevron]`, and every `[data-task][data-kind="simple"]` contains no `[data-chevron]`.
- `Then("the {string} file's frontmatter status is {string}")` — finds the most recent `writeFile` call whose path ends in the slug-derived filename, parses the content with `parseTodo`, asserts `.status` equals the expected value.
- `Then("the {string} row shows the checked success state")` — asserts `[data-task="<slug>"] [data-checkbox-wrapper][data-checked="true"]` exists.
- `Then("the {string} row's title is strikethrough with on-surface-variant color")` — asserts `[data-task="<slug>"] [data-task-title][data-completed="true"]` exists. The CSS rule on that attribute applies the strikethrough + `on-surface-variant` color (defined in `src/renderer/index.html` `<style>`).
- `Then("the {string} row's checked styling is removed")` — asserts `[data-task="<slug>"] [data-task-title][data-completed="true"]` does **not** exist.
- `Then("the {string} row is expanded")` — asserts `[data-task="<slug>"][data-expanded="true"]` exists.
- `Then("one subtask row appears for each subtask line in the {string} file body")` — asserts the count of `[data-subtask]` descendants under `[data-task="<slug>"] [data-subtask-list]` equals the number of top-level `- [ ]` / `- [x]` lines in the parent's body string (sourced from `this.fixtures`).
- `Then("the {string} file body shows {string}")` — asserts the most-recent `writeFile` content for that file's path includes the exact string.
- `Then("the {string} row's frontmatter status is unchanged")` — asserts the most recent `writeFile` for that file's path either did not occur, or its parsed `.status` equals the pre-action snapshot the world captured.
- `Then("the {string} subtask row shows the checked success state")` — asserts the matching subtask row contains `[data-checkbox-wrapper][data-checked="true"]`.
- `Then("no task file is changed")` — asserts both `world.lastWriteFilePath` and `world.lastArchiveFilePath` are `undefined` (the world clears them at scenario start; the When block is asserted not to have set either).
- `Then("the {string} row appears unchanged")` — asserts the `[data-task="<slug>"]` outer-HTML hash equals the pre-action snapshot the world recorded at the moment the user clicked the remove icon.
- `Then("the {string} file no longer exists in vault todos")` — asserts `world.lastArchiveFilePath` ends with the matching filename. The `archiveFile` IPC contract is "move from `vault/todos/` to `vault/archive/todos/`"; the unit test of the IPC handler covers the actual fs move.
- `Then("the {string} file exists in vault archive todos")` — same source; asserts the archive call recorded.
- `Then("the {string} row no longer appears in the list")` — asserts the document contains no `[data-task="<slug>"]` after the action.
- `Then("the {string} file body no longer contains {string}")` — asserts the most-recent `writeFile` content for that file's path does not include the substring.
- `Then("the {string} file still exists in vault todos")` — asserts `world.lastArchiveFilePath` is `undefined` for that file's name (no archive call occurred).
- `Then("the {string} subtask row no longer appears under {string}")` — asserts the parent's `[data-subtask-list]` contains no descendant `[data-subtask]` whose visible label text matches the string.

REUSED (Cucumber loads steps globally; do not redefine):

- `When("the initial render completes")` — defined in `test/step_defs/design-and-structure.steps.ts`. Mounts the app against `this.fixtures`.

## BDD test list

```
[file: test/view/taskRowInteractions.spec.ts]
- describe("TaskRowInteractions") > it("renders no chevron on a simple task row")
- describe("TaskRowInteractions") > it("renders a chevron on a combined task row")
- describe("TaskRowInteractions") > it("renders a checkbox on a simple task row")
- describe("TaskRowInteractions") > it("renders no checkbox on a combined task row")
- describe("TaskRowInteractions") > it("renders a remove icon on every top-level row")
- describe("TaskRowInteractions") > it("renders a remove icon on every subtask row when expanded")
- describe("TaskRowInteractions") > it("calls writeFile with toggleParent output when a simple todo task's checkbox is clicked")
- describe("TaskRowInteractions") > it("calls writeFile with toggleParent output when a simple done task's checkbox is clicked")
- describe("TaskRowInteractions") > it("sets data-checked=true on the checkbox wrapper after a check")
- describe("TaskRowInteractions") > it("sets data-completed=true on the title after a check")
- describe("TaskRowInteractions") > it("removes data-completed from the title after an uncheck")
- describe("TaskRowInteractions") > it("expands a collapsed combined task on row body click")
- describe("TaskRowInteractions") > it("collapses an expanded combined task on row body click")
- describe("TaskRowInteractions") > it("sets data-expanded=true on the row when expanded")
- describe("TaskRowInteractions") > it("renders one subtask row per top-level body bullet when expanded")
- describe("TaskRowInteractions") > it("does not toggle expanded state when the remove icon is clicked")
- describe("TaskRowInteractions") > it("calls writeFile with toggleSubtask output when a subtask checkbox is clicked")
- describe("TaskRowInteractions") > it("does not change parent frontmatter status when a subtask is toggled")
- describe("TaskRowInteractions") > it("opens the confirm prompt when a remove icon is clicked")
- describe("TaskRowInteractions") > it("does not call archiveFile or writeFile when the confirm is dismissed via No")
- describe("TaskRowInteractions") > it("calls archiveFile with the matching filename on Yes for a top-level simple task")
- describe("TaskRowInteractions") > it("calls archiveFile with the matching filename on Yes for a top-level combined task")
- describe("TaskRowInteractions") > it("removes the row from the rendered list after a confirmed top-level remove")
- describe("TaskRowInteractions") > it("calls writeFile with removeSubtask output on Yes for a subtask remove")
- describe("TaskRowInteractions") > it("removes the subtask row from the parent's expanded list after a confirmed subtask remove")
- describe("TaskRowInteractions") > it("does not call archiveFile when a subtask remove is confirmed")

[file: test/data/writeTodo.spec.ts] (EXTEND)
- describe("writeTodo.removeSubtask") > it("removes the top-level body bullet at the given index")
- describe("writeTodo.removeSubtask") > it("preserves the order of remaining top-level bullets")
- describe("writeTodo.removeSubtask") > it("removes contiguous indented child lines beneath the removed bullet")
- describe("writeTodo.removeSubtask") > it("leaves frontmatter unchanged")
```

The existing `writeTodo.toggleParent` and `writeTodo.toggleSubtask` tests in `test/data/writeTodo.spec.ts` are reused as-is — the renderer's checkbox handlers call those exact functions, so their existing coverage carries over.

## Concrete DOM contract

Tests query exclusively through these `data-*` attributes — no class-name selectors, no tag-name fallback. New attributes for this feature are marked `(NEW)`; reused attributes from prior renders are marked `(REUSED)`.

```
[data-task-card] [data-task-list]                      (REUSED)
  [data-task="<slug>"]                                 (REUSED, with NEW attributes layered on)
    [data-kind="simple|combined"]                      (NEW — disambiguates which interactions apply)
    [data-expanded="true"]                             (NEW — combined tasks only; toggled by row body click)
    [data-task-row]                                    (REUSED)
      [data-chevron]                                   (NEW on simple rows — currently always emitted; under this plan
                                                        it is emitted iff combined; rotates via [data-expanded] CSS)
      [data-checkbox-wrapper]                          (REUSED — currently always emitted on the parent row; under this
                                                        plan it is emitted iff simple. Wraps an `input[type="checkbox"]`
                                                        that the test clicks.)
        [data-checked="true|false"]                    (NEW — visual state matching frontmatter status; styled on
                                                        the wrapper)
      [data-task-title]                                (REUSED — text of the task title)
        [data-completed="true"]                        (NEW — present iff simple task with status="done")
      …                                                (REUSED — chip, due unchanged)
      [data-remove]                                    (NEW — subtle icon at right edge; ever-present)
    [data-subtask-list]                                (NEW — combined tasks only; rendered iff [data-expanded="true"])
      [data-subtask="<index>"]                         (NEW — one per top-level body bullet; index is 0-based)
        [data-checkbox-wrapper]                        (NEW on subtasks — same attribute name as the parent simple-row
                                                        wrapper, but the existing renderer does not emit a wrapper
                                                        on subtasks today. Wraps an `input[type="checkbox"]`.)
          [data-checked="true|false"]                  (NEW — mirrors `[ ]` / `[x]` of the body line)
        [data-subtask-title]                           (NEW — visible label text from the subtask body line)
          [data-completed="true"]                      (NEW — present iff body line is `[x]`)
        [data-remove]                                  (NEW — subtle icon at right edge of subtask row)

[data-confirm]                                         (NEW — at most one in the document at any time)
                                                       (mounted as a child of either a `[data-task]` row's right-edge
                                                        region OR a `[data-subtask]`; the ancestor disambiguates which
                                                        entity Yes/No applies to)
  [data-confirm-yes]                                   (NEW)
  [data-confirm-no]                                    (NEW)
```

Notes for Implement:

- A task is **simple** iff `parseTopLevelSubtasks(parseTodo(raw).body).length === 0`. Otherwise **combined**. Set `[data-kind]` accordingly so the renderer can branch on a single attribute.
- The chevron's rotation is purely CSS: `transform: rotate(90deg)` on `[data-task][data-expanded="true"] [data-chevron]`. Default unrotated state points right (collapsed); rotated state points down (expanded).
- The completion style on simple tasks: a CSS rule on `[data-task-title][data-completed="true"]` applies `text-decoration: line-through` and `color: var(--color-on-surface-variant)`. The checkbox's success state on `[data-checkbox-wrapper][data-checked="true"]` uses background `#16a34a` (the success green referenced in `DESIGN.md` prose; no `success` token is declared in the frontmatter, so the value is hard-coded in the renderer's `<style>` for now).
- Click-to-expand binds to `[data-task][data-kind="combined"] [data-task-row]` with a guard that ignores clicks whose target descends from `[data-remove]` or `[data-confirm]`.
- Click-to-toggle on simple tasks binds to `[data-task][data-kind="simple"] [data-checkbox-wrapper] input[type="checkbox"]`.
- Click-to-toggle on subtasks binds to `[data-subtask] [data-checkbox-wrapper] input[type="checkbox"]`.
- Remove flow: clicking `[data-remove]` (top-level or subtask) replaces that row's right-edge region with a `[data-confirm]` element. The element is a small inline pill containing the literal text `Remove?` followed by `[data-confirm-no]` ("No") and `[data-confirm-yes]` ("Yes") buttons. Only one `[data-confirm]` lives in the document at a time; opening a second cancels the first. Clicking `[data-confirm-no]` (or clicking another row's remove icon) tears down the confirm and restores the original right-edge content. Clicking `[data-confirm-yes]` triggers the corresponding action (top-level → `archiveFile`; subtask → `removeSubtask` + `writeFile`), then re-renders the affected row(s).
- After a top-level archive: the renderer drops that task from its in-memory model and re-renders the task list (no read-back from disk required for the test).
- After a subtask remove: the renderer rewrites the parent's content via `removeSubtask`, calls `writeFile`, updates its in-memory model, and re-renders the parent's expanded subtask list with the line absent.
- Click handlers must be added to `[data-task-row]`, `[data-checkbox-wrapper] input[type="checkbox"]` (parent simple), `[data-subtask] [data-checkbox-wrapper] input[type="checkbox"]`, `[data-remove]`, `[data-confirm-yes]`, `[data-confirm-no]` once per render — the renderer already re-renders idempotently, so binding inside `mountApp`'s render path is fine.

## File map

```
EXTEND src/renderer/data/writeTodo.ts                  — export `removeSubtask(raw, index)`. Pure: walks the body
                                                         using the existing `splitFrontmatter` helper, finds the
                                                         `index`-th top-level `- [ ]/- [x]` line, removes that
                                                         line plus any immediately-following lines whose first
                                                         non-whitespace character is preceded by indentation
                                                         (children of the removed bullet). Frontmatter unchanged.

EXTEND src/renderer/index.ts                           — extend `mountApp` and the row renderer to:
                                                         (a) classify each task as simple | combined and emit
                                                             `[data-kind]`,
                                                         (b) render a chevron only when combined (today the renderer
                                                             always emits `[data-chevron]`; gate the emission on
                                                             `task.subtasks.length > 0`),
                                                         (c) render `[data-checkbox-wrapper]` on the parent row only
                                                             when simple (today the renderer always emits it on the
                                                             parent row; gate the emission on
                                                             `task.subtasks.length === 0`),
                                                         (d) set `data-checked="true|false"` on the parent
                                                             `[data-checkbox-wrapper]` matching frontmatter status,
                                                         (e) render `[data-completed="true"]` on `[data-task-title]`
                                                             iff simple task with status === "done",
                                                         (f) render a `[data-remove]` icon on every top-level row,
                                                         (g) when a combined task is expanded, render `[data-subtask-list]`
                                                             with one `[data-subtask="<index>"]` per top-level body
                                                             bullet, each wrapping its `<input type="checkbox">` in a
                                                             `[data-checkbox-wrapper][data-checked="true|false"]`
                                                             (the existing subtask renderer puts the checkbox
                                                             directly under `[data-subtask]` with no wrapper —
                                                             this plan adds the wrapper),
                                                             a `[data-subtask-title]` (with `[data-completed="true"]`
                                                             when the body line is `[x]`), and a `[data-remove]`,
                                                         (h) bind click handlers for: simple checkbox toggle
                                                             (calls `toggleParent` then `writeFile`),
                                                             combined row body expand/collapse (toggles
                                                             `[data-expanded="true"]` and re-renders),
                                                             subtask checkbox toggle (calls `toggleSubtask`
                                                             then `writeFile`),
                                                             remove icon (mounts `[data-confirm]`; tearing down
                                                             any existing `[data-confirm]` first),
                                                             confirm Yes (calls `archiveFile` for top-level,
                                                             `removeSubtask`+`writeFile` for subtask, then
                                                             re-renders the affected row(s)),
                                                             confirm No (tears down `[data-confirm]`, restores
                                                             original right-edge content).

EXTEND src/renderer/index.html                         — add CSS rules for:
                                                         `[data-task-title][data-completed="true"]`
                                                           → text-decoration: line-through; color: var(--color-on-surface-variant);
                                                         `[data-subtask-title][data-completed="true"]`
                                                           → same;
                                                         `[data-checkbox][data-checked="true"]`
                                                           → background-color: #16a34a; (DESIGN.md success color)
                                                         `[data-task][data-expanded="true"] [data-chevron]`
                                                           → transform: rotate(90deg);
                                                         and chrome for `[data-confirm]`
                                                           → inline pill, `secondary-container` background,
                                                           `outline-variant` border, 4px radius, padding 4px 8px,
                                                           buttons styled as small text actions; `[data-confirm-yes]`
                                                           uses `error-container` background to signal destructive intent.
                                                         and chrome for `[data-remove]`
                                                           → small × glyph (Unicode `×` or `✕`) at 12px,
                                                           color `outline`, padding 4px, opacity 0.6 default,
                                                           opacity 1 on hover.

EXTEND src/preload/preload.ts (or the equivalent preload bridge file)
                                                       — expose `archiveFile(filename: string): Promise<void>` on
                                                         `window.todoz`. The new IPC channel name follows the
                                                         existing `writeFile` channel's naming convention; the
                                                         Implement agent confirms the exact preload file and
                                                         channel string by reading existing preload code.

EXTEND src/main/<existing IPC handler file>            — implement the `archiveFile` handler: ensure
                                                         `vault/archive/todos/` exists (mkdir -p), then
                                                         `fs.rename(vault/todos/<filename>, vault/archive/todos/<filename>)`.
                                                         If the source file is missing, throw — the renderer
                                                         only calls this for tasks it knows are in the list.

NEW    test/view/taskRowInteractions.spec.ts           — Tallahassee/JSDOM specs per `## BDD test list`. Mocks
                                                         `window.todoz.readTodos`, `readFile`, `writeFile`,
                                                         and `archiveFile` against the four task-row-interactions
                                                         fixtures.
EXTEND test/data/writeTodo.spec.ts                     — add the four `writeTodo.removeSubtask` describes per
                                                         `## BDD test list`.
NEW    test/step_defs/task-row-interactions.steps.ts   — Cucumber steps per `## Step-definition file`. Imports
                                                         `TodozWorld` and uses `world.lastWriteFilePath` /
                                                         `lastWriteFileContent` (existing) plus a new
                                                         `world.lastArchiveFilePath` field (see EXTEND below).
EXTEND test/step_defs/world.ts                         — add `lastArchiveFilePath?: string` to `TodozWorld`,
                                                         and have `mountWindow()` (or the equivalent
                                                         `window.todoz` mock setup) record the most recent
                                                         `archiveFile(path)` call into that field. Existing
                                                         `lastWriteFilePath`/`lastWriteFileContent` recording
                                                         remains unchanged.

EXTEND test/view/designAndStructure.spec.ts            — supersede the two legacy assertions that contradict the
                                                         new combined-row contract (see `## Pattern summary`):
                                                         (a) rewrite `renders a chevron, a checkbox, a title, a
                                                             chip on every task row` (lines 173–183) to assert
                                                             only what is true on the combined-only `STANDARD_FIXTURES`
                                                             set: every row carries `[data-chevron]`,
                                                             `[data-task-title]`, and `[data-chip]`, **and** none
                                                             of the rows carries a parent `[data-checkbox-wrapper]`
                                                             (combined rows are not checkable at the parent level
                                                             under the new contract). The simple-row chrome
                                                             (`[data-checkbox-wrapper]` present, `[data-chevron]`
                                                             absent) is asserted in the new
                                                             `taskRowInteractions.spec.ts` against a simple-task
                                                             fixture.
                                                         (b) rewrite `writes status:done to file when a parent
                                                             checkbox in the chrome is clicked` (lines 224–250)
                                                             into a structural assertion: under the new contract
                                                             combined rows have **no** parent `[data-checkbox-wrapper]`,
                                                             so the test asserts that `[data-task="call-dentist"]
                                                             [data-task-row] [data-checkbox-wrapper]` does not exist.
                                                             The simple-task `todo → done` write-back behavior
                                                             (which the legacy test was actually exercising on a
                                                             combined task by accident) is covered end-to-end in
                                                             `taskRowInteractions.spec.ts` against `buy-milk`.
                                                         All other tests in the file stay untouched, including
                                                         `writes back the toggled subtask line when a subtask
                                                         checkbox is clicked` (subtask checkbox plumbing is
                                                         unchanged at the `input[type="checkbox"]` level — the
                                                         new `[data-checkbox-wrapper]` is added around the input
                                                         on subtasks but the `input` selector in the legacy test
                                                         still matches), `expands a collapsed task row when its
                                                         row is clicked`, and `collapses an expanded task row
                                                         when its row is clicked again`.

NEW    test/features/task-row-interactions.feature     — frozen Gherkin from Section 4. Cucumber loads from
                                                         `test/features/**/*.feature`.

NEW    test/fixtures/vault/todos/buy-milk-2026-05-08.md
NEW    test/fixtures/vault/todos/send-invoice-2026-05-08.md
NEW    test/fixtures/vault/todos/prep-deck-2026-05-08.md
NEW    test/fixtures/vault/todos/weekly-shop-2026-05-08.md
```

No changes to `STANDARD_FIXTURES`, `test/step_defs/todoList.steps.ts`, `test/step_defs/design-and-structure.steps.ts`, or `test/step_defs/add-task.steps.ts`. The only existing view spec affected is `test/view/designAndStructure.spec.ts`, scoped to the two test cases listed above; the other ~20 cases in that file remain green.

## Data fixtures

A dedicated set of four files under `test/fixtures/vault/todos/`. Loaded by `Given("the vault contains task-row-interactions fixtures")`. Already on disk — written by the plan-feature skill alongside this plan.

- `test/fixtures/vault/todos/buy-milk-2026-05-08.md` (REUSE — written by skill) — simple task, status `todo`, empty body. Frontmatter:
  `type: task / title: "Buy milk" / status: todo / tags: [errands] / created: 2026-05-08`. Used by criteria 1 (simple-row chevron absence), 2 (todo→done toggle), 6 + 7 (remove cancel + confirm flow).
- `test/fixtures/vault/todos/send-invoice-2026-05-08.md` (REUSE — written by skill) — simple task, status `done`, empty body. Frontmatter:
  `type: task / title: "Send invoice" / status: done / tags: [work] / created: 2026-05-08`. Used by criterion 3 (done→todo toggle).
- `test/fixtures/vault/todos/prep-deck-2026-05-08.md` (REUSE — written by skill) — combined task, status `todo`. Body: `- [ ] draft section 1\n- [ ] review numbers\n`. Frontmatter:
  `type: task / title: "Prep deck" / status: todo / tags: [work] / created: 2026-05-08`. Used by criteria 1, 4, 5, 8.
- `test/fixtures/vault/todos/weekly-shop-2026-05-08.md` (REUSE — written by skill) — combined task with one already-checked subtask. Body: `- [x] paper towels\n- [ ] coffee\n`. Frontmatter:
  `type: task / title: "Weekly shop" / status: todo / tags: [errands] / created: 2026-05-08`. Used by Tallahassee tests for subtask uncheck (no Gherkin scenario covers uncheck, but the inner test layer asserts `toggleSubtask` round-trips both directions).

## Trace table

| Criterion | Scenario (test/features/task-row-interactions.feature) | Tests |
|---|---|---|
| 1. Chevron only on combined rows | "simple-task rows render without a chevron" | `taskRowInteractions.spec.ts` > "renders no chevron on a simple task row", "renders a chevron on a combined task row", "renders a checkbox on a simple task row", "renders no checkbox on a combined task row"; `designAndStructure.spec.ts` (REWRITTEN) > "renders a chevron, a title, a chip on every task row" (asserts no parent checkbox wrapper on combined-only fixture set) |
| 2. todo→done toggle on simple | "clicking a todo task's checkbox marks it done" | `taskRowInteractions.spec.ts` > "calls writeFile with toggleParent output when a simple todo task's checkbox is clicked", "sets data-checked=true on the checkbox wrapper after a check", "sets data-completed=true on the title after a check"; `writeTodo.spec.ts` > existing `toggleParent` describes (REUSED) |
| 3. done→todo toggle on simple | "clicking a done task's checkbox marks it todo" | `taskRowInteractions.spec.ts` > "calls writeFile with toggleParent output when a simple done task's checkbox is clicked", "removes data-completed from the title after an uncheck"; `writeTodo.spec.ts` > existing `toggleParent` describes (REUSED); `designAndStructure.spec.ts` (REWRITTEN) > the rewritten `writes status:done…` test asserts the inverse — combined rows have **no** parent checkbox wrapper to click, removing the legacy contradictory assertion |
| 4. Combined-row click toggles expand | "clicking a combined-task row toggles expanded state" | `taskRowInteractions.spec.ts` > "expands a collapsed combined task on row body click", "collapses an expanded combined task on row body click", "sets data-expanded=true on the row when expanded", "renders one subtask row per top-level body bullet when expanded" |
| 5. Subtask check writes to body | "clicking a subtask checkbox flips its bullet in the parent body" | `taskRowInteractions.spec.ts` > "calls writeFile with toggleSubtask output when a subtask checkbox is clicked", "does not change parent frontmatter status when a subtask is toggled"; `writeTodo.spec.ts` > existing `toggleSubtask` describes (REUSED) |
| 6. Cancel remove is a no-op | "cancelling a remove leaves the row untouched" | `taskRowInteractions.spec.ts` > "opens the confirm prompt when a remove icon is clicked", "does not call archiveFile or writeFile when the confirm is dismissed via No" |
| 7. Top-level confirm archives | "confirming remove on a top-level task moves the file to archive" | `taskRowInteractions.spec.ts` > "calls archiveFile with the matching filename on Yes for a top-level simple task", "calls archiveFile with the matching filename on Yes for a top-level combined task", "removes the row from the rendered list after a confirmed top-level remove" |
| 8. Subtask confirm edits parent | "confirming remove on a subtask deletes the line from the parent body" | `taskRowInteractions.spec.ts` > "calls writeFile with removeSubtask output on Yes for a subtask remove", "removes the subtask row from the parent's expanded list after a confirmed subtask remove", "does not call archiveFile when a subtask remove is confirmed"; `writeTodo.spec.ts` > all four `removeSubtask` describes |

## Test-tree audit

**Reusable** (already on disk; the Implement agent should pull these in, not duplicate them):

- `test/step_defs/world.ts` — `TodozWorld` with `mountWindow()`, `lastWriteFilePath`, `lastWriteFileContent`, `fixtures`, `document`. Extend with `lastArchiveFilePath`.
- `test/step_defs/design-and-structure.steps.ts` — `When("the initial render completes")` and the `fixtureToTask` helper. Reused as-is.
- `src/renderer/data/writeTodo.ts` — `toggleParent`, `toggleSubtask`. Reused; extend with `removeSubtask`.
- `src/renderer/data/parseTodo.ts` — `parseTodo`, `parseTopLevelSubtasks`. Reused for classifying simple vs combined and for asserting frontmatter status in step defs.
- `src/renderer/index.ts` — `mountApp`. Extend; do not introduce a parallel mount.
- `[data-checkbox-wrapper]` attribute on the parent task row — already emitted by the existing `renderTaskRow` (see `src/renderer/index.ts:276`); the plan reuses this attribute name verbatim and gates its emission on `task.subtasks.length === 0`. The same attribute name is added (NEW) around subtask checkboxes to keep the contract consistent.
- `window.todoz.writeFile(path, content)` — existing IPC. Reused unchanged.

**To add** (every NEW or EXTEND in `## File map`):

- `src/renderer/data/writeTodo.ts` (EXTEND — add `removeSubtask`)
- `src/renderer/index.ts` (EXTEND — see file map for full list)
- `src/renderer/index.html` (EXTEND — CSS rules for completion, expand, confirm pill, remove icon)
- `src/preload/preload.ts` and `src/main/<ipc>.ts` (EXTEND — `archiveFile` IPC; Implement confirms exact files)
- `test/view/taskRowInteractions.spec.ts` (NEW)
- `test/view/designAndStructure.spec.ts` (EXTEND — rewrite the two superseded cases per `## File map`; all other cases stay)
- `test/data/writeTodo.spec.ts` (EXTEND — `removeSubtask` describes)
- `test/step_defs/task-row-interactions.steps.ts` (NEW)
- `test/step_defs/world.ts` (EXTEND — `lastArchiveFilePath`)
- `test/features/task-row-interactions.feature` (already on disk via skill)
- 4 fixture files (already on disk via skill)

**Gaps** (every requirement maps to a file in the File map and a test in the BDD test list):

- The `success` color is not declared as a token in `DESIGN.md` frontmatter (only described in prose). The renderer hard-codes `#16a34a` in its `<style>`; if the design system later canonicalizes a `--color-success` token, swap then.
- The exact preload bridge file and main-process IPC handler file are not pinned by this plan — Implement confirms them by reading the existing `writeFile` IPC plumbing before extending.
- This plan does not claim a Playwright/Electron verify scenario beyond what already runs; the visual completion style, chevron rotation, and confirm pill are captured in the next `npm run verify` screenshot pass and read by the Verify agent.

## Gate check

Re-run on the 2026-05-08 plan revision (after the supersession resolution):

- [x] 8 criteria, 8 Gherkin scenarios — 1:1 (Section 4 unchanged)
- [x] Every Gherkin step is listed under step definitions, marked NEW or REUSED, using the chosen `[data-checkbox-wrapper]` attribute name consistently
- [x] Every Tallahassee/unit test traces to a Gherkin step or step dependency (see `## Trace table`); the trace table now also lists the rewritten `designAndStructure.spec.ts` cases under criteria 1 and 3
- [x] No scenario or test name contains "and"
- [x] DOM contract covers every assertion the tests will make; `[data-checkbox]` references replaced with `[data-checkbox-wrapper]`
- [x] File map lists every file Implement will touch; `EXTEND test/view/designAndStructure.spec.ts` added with the two superseded cases spelled out
- [x] Every fixture matches `vault/AGENTS.md` schema (4 fixtures already on disk)
- [x] No invented requirements — the supersession is documented in `## Pattern summary` and traces to the user-locked path (a)
- [x] Zero lines of TypeScript or JavaScript written by the plan-feature skill or by this revision

---

Plan complete. Ready for Implement.
