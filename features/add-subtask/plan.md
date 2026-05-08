---
name: Add subtask
slug: add-subtask
status: planned
frozen: true
created: 2026-05-08
---

# Add subtask

## Pattern summary

The `+ Add subtask` affordance is an inline text button — `body-md` Inter at `outline` color, indented to align with subtask titles — rendered in the body-region of every task row whose body region is currently visible. For **combined + expanded** task rows it sits immediately below the last subtask. For **simple** task rows it sits directly below the task row in the same indented position (the simple row's body-region is always "visible" since there's no list to hide). For **combined + collapsed** rows it is not rendered (the body region is hidden). Clicking it replaces the affordance in place with an inline `<input type="text">` (4px radius, 1px `outline-variant` border, 14px Inter) which takes focus immediately. Pressing **Enter** with non-empty trimmed content appends `- [ ] <text>\n` after the last top-level body bullet of the parent file via a new pure helper `writeTodo.addSubtask(raw, text)`, calls `window.todoz.writeFile`, updates the in-memory model, marks the parent expanded if it was simple (so the just-added subtask renders as part of the now-combined row), and re-renders the parent with the new row appended and the affordance restored beneath it. Pressing **Esc** or pressing **Enter** on empty/whitespace input tears the input down and restores the affordance — no file write occurs. Click-elsewhere does not cancel; the input remains until Esc or Enter.

**In scope:** the add affordance on simple rows and on combined+expanded rows, inline text input, Enter-to-submit, Esc-to-cancel, empty-Enter-to-cancel, append-to-end of top-level body bullets, automatic conversion of a simple task to combined+expanded after the first successful add, re-render of the affected row.

**Out of scope:** nested subtasks deeper than top-level; priority, due, or tags on subtasks; validation messages or duplicate detection; bulk add / paste-multiple-lines; keyboard shortcut to focus the input from elsewhere; auto-scroll into view; reordering existing subtasks; blur-to-cancel (the input persists until Esc or Enter).

## Acceptance criteria

1. Given a simple task is rendered, when the initial render completes, then a `+ Add subtask` affordance is present directly beneath that task row, indented to subtask alignment.
2. Given a combined task is expanded, when the initial render completes, then a `+ Add subtask` affordance is present immediately beneath the last subtask row.
3. Given a combined task is collapsed, when the initial render completes, then no `+ Add subtask` affordance is rendered for that task.
4. Given a `+ Add subtask` affordance is rendered, when the user clicks it, then the affordance is replaced in the same position by a focused `<input type="text">`.
5. Given the input is open on a combined task with text `"draft outline"`, when the user presses Enter, then the parent file's body has `- [ ] draft outline` appended after the existing top-level bullets, a new subtask row with that title appears at the end of the parent's subtask list, and the affordance is restored beneath it.
6. Given the input is open on a simple task with text `"buy stamps"`, when the user presses Enter, then the task is rendered as combined+expanded with one subtask row `"buy stamps"` and a `+ Add subtask` affordance below it.
7. Given the input is open, when the user presses Esc, then the input tears down, the affordance is restored, and no file write occurs.
8. Given the input is open with whitespace-only text, when the user presses Enter, then the input tears down, the affordance is restored, and no file write occurs.

## Step-definition file

`test/step_defs/add-subtask.steps.ts` — steps:

NEW:

- `When("the user clicks the add-subtask affordance for {string}")` — finds the task by visible title, then clicks `[data-task="<slug>"] [data-add-subtask]`.
- `When("the user types {string} into the subtask input")` — sets `value` of the unique `[data-add-subtask-input]` in the document and dispatches an `input` event.
- `When("the user presses Enter in the subtask input")` — dispatches a `keydown` event with `key="Enter"` on the unique `[data-add-subtask-input]` (which is `document.activeElement` when freshly mounted).
- `When("the user presses Esc in the subtask input")` — dispatches a `keydown` event with `key="Escape"` on the unique `[data-add-subtask-input]`.
- `Then("the {string} row shows an add-subtask affordance")` — asserts `[data-task="<slug>"] [data-add-subtask]` exists in the document.
- `Then("the {string} row shows no add-subtask affordance")` — asserts `[data-task="<slug>"] [data-add-subtask]` does not exist.
- `Then("a focused subtask input replaces the affordance for {string}")` — asserts `[data-task="<slug>"] [data-add-subtask-input]` exists, equals `document.activeElement`, and `[data-task="<slug>"] [data-add-subtask]` does not exist.
- `Then("the {string} file body ends with {string}")` — finds the most recent `writeFile` call whose path ends in the slug-derived filename, parses it with `parseTodo`, asserts the body string with trailing newlines stripped ends with the expected substring.
- `Then("the {string} subtask list ends with a row labeled {string}")` — asserts the last `[data-subtask]` under `[data-task="<slug>"] [data-subtask-list]` has a `[data-subtask-title]` whose text content equals the string.
- `Then("the {string} subtask list contains exactly one row labeled {string}")` — asserts exactly one `[data-subtask]` exists under `[data-task="<slug>"] [data-subtask-list]` and its `[data-subtask-title]` text equals the string.
- `Then("the {string} row is rendered as expanded combined")` — asserts `[data-task="<slug>"][data-kind="combined"][data-expanded="true"]` exists.
- `Then("the subtask input is torn down")` — asserts no `[data-add-subtask-input]` exists in the document.

REUSED (Cucumber loads steps globally; do not redefine):

- `Given("the vault contains task-row-interactions fixtures")` — defined in `test/step_defs/task-row-interactions.steps.ts`. Wires the four task-row-interactions fixtures into a mocked `window.todoz`, then mounts the app via `mountApp(this.document.body)`.
- `Given("the combined task {string} is expanded")` — defined in `test/step_defs/task-row-interactions.steps.ts`. Clicks the parent row body to expand and asserts `[data-task="<slug>"][data-expanded="true"]` exists.
- `When("the initial render completes")` — defined in `test/step_defs/design-and-structure.steps.ts`. Mounts the app against `this.fixtures`.
- `Then("no task file is changed")` — defined in `test/step_defs/task-row-interactions.steps.ts`. Asserts `world.lastWriteFilePath` and `world.lastArchiveFilePath` are both `undefined`.

## BDD test list

```
[file: test/view/addSubtask.spec.ts]                                          (NEW)
- describe("AddSubtask") > it("renders an add-subtask affordance on a simple task row")
- describe("AddSubtask") > it("renders no add-subtask affordance on a collapsed combined task row")
- describe("AddSubtask") > it("renders an add-subtask affordance after the last subtask of an expanded combined task row")
- describe("AddSubtask") > it("replaces the affordance with an input on click")
- describe("AddSubtask") > it("focuses the input when it appears")
- describe("AddSubtask") > it("calls writeFile with addSubtask output on Enter for a combined task")
- describe("AddSubtask") > it("renders the new subtask as the last child of the parent's subtask list after a successful add")
- describe("AddSubtask") > it("restores the affordance after a successful add")
- describe("AddSubtask") > it("marks a simple task as combined after first successful add")
- describe("AddSubtask") > it("marks a simple task as expanded after first successful add")
- describe("AddSubtask") > it("renders the affordance below the new subtask after a simple task is converted")
- describe("AddSubtask") > it("does not call writeFile on Esc")
- describe("AddSubtask") > it("tears down the input on Esc")
- describe("AddSubtask") > it("does not call writeFile on whitespace-only Enter")
- describe("AddSubtask") > it("tears down the input on whitespace-only Enter")

[file: test/data/writeTodo.spec.ts]                                           (EXTEND)
- describe("writeTodo.addSubtask") > it("appends a new bullet to a body with existing top-level bullets")
- describe("writeTodo.addSubtask") > it("creates the first bullet on an empty body")
- describe("writeTodo.addSubtask") > it("creates the first bullet on a whitespace-only body")
- describe("writeTodo.addSubtask") > it("trims surrounding whitespace from the input text")
- describe("writeTodo.addSubtask") > it("leaves frontmatter unchanged")
- describe("writeTodo.addSubtask") > it("preserves existing top-level bullet order")
```

The existing `writeTodo.toggleParent`, `writeTodo.toggleSubtask`, and `writeTodo.removeSubtask` tests in `test/data/writeTodo.spec.ts` stay untouched. The existing `parseTodo` / `parseTopLevelSubtasks` tests stay untouched — no parsing changes required.

## Concrete DOM contract

Tests query exclusively through these `data-*` attributes — no class-name selectors. New attributes for this feature are marked `(NEW)`; reused attributes from prior renders are marked `(REUSED)`.

```
[data-task="<slug>"]                                   (REUSED)
  [data-kind="simple|combined"]                        (REUSED — set by task-row-interactions)
  [data-expanded="true|false"]                         (REUSED — combined tasks only)
  [data-task-row]                                      (REUSED)
    …                                                  (REUSED — chevron, checkbox, title, chip, due, remove)

  // Simple-row body region:
  [data-add-subtask]                                   (NEW — sibling of [data-task-row], child of [data-task];
                                                         rendered iff [data-kind="simple"]. The visible label
                                                         is exactly "+ Add subtask".)

  // Combined-expanded body region:
  [data-subtask-list]                                  (REUSED — combined tasks only; rendered iff [data-expanded="true"])
    [data-subtask="<index>"]                           (REUSED — one per top-level body bullet)
      …                                                (REUSED — checkbox, title, remove)
    [data-add-subtask]                                 (NEW — last child of [data-subtask-list])

[data-add-subtask-input]                               (NEW — at most one in the document at any time;
                                                         mounted in place of the [data-add-subtask] node it
                                                         was opened from. Implemented as an
                                                         `<input type="text">` with this attribute set.)
```

Notes for Implement:

- A task is **simple** iff `parseTopLevelSubtasks(parseTodo(raw).body).length === 0`. Already the convention from task-row-interactions; reuse the existing `[data-kind]` setting.
- The affordance's visible text is exactly the literal string `+ Add subtask`. CSS may render the `+` as part of the same text node, an icon glyph, or a `::before`; the test only asserts presence of the `[data-add-subtask]` element, not the inner text — but the element's text content must include "Add subtask" so that screenshots and humans can locate it.
- Clicking `[data-add-subtask]` swaps that node for an `<input data-add-subtask-input type="text">` mounted at the same position in the DOM tree. The renderer focuses the input synchronously after mounting (via `input.focus()` immediately after `parent.replaceChild` / equivalent).
- `keydown` handlers on the input:
  - `key === "Enter"` → read `input.value`, trim it; if empty, tear down (replace input with a fresh `[data-add-subtask]` node); else call `addSubtask(raw, trimmed)`, call `window.todoz.writeFile(path, newRaw)`, update the in-memory task's content (so the next render's `parseTopLevelSubtasks` reflects the new bullet), if the parent was simple add the slug to `expandedTasks`, then re-render via the existing full-render path.
  - `key === "Escape"` → tear down (replace input with a fresh `[data-add-subtask]` node); no file write.
- Only one `[data-add-subtask-input]` can be open at a time. Opening a second affordance while one is already open is **out of scope** for this feature — the click handler for `[data-add-subtask]` does not need to handle this case (the input either has focus, in which case clicking elsewhere doesn't trigger a second open, or has been torn down already).
- After a successful add: the renderer drops the old in-memory raw content and replaces it with `addSubtask`'s output, then runs the existing full-render path. The new `[data-subtask]` for the appended bullet appears at the end of `[data-subtask-list]`, with the freshly-rendered `[data-add-subtask]` below it.
- Click handlers must be added to `[data-add-subtask]` and the keydown handlers to `[data-add-subtask-input]` once per render — bind them inside the existing `mountApp` render path.

## File map

```
EXTEND src/renderer/data/writeTodo.ts                  — export `addSubtask(raw: string, text: string): string`.
                                                         Sits alongside the existing `toggleParent` (line 43),
                                                         `toggleSubtask` (line 57), and `removeSubtask`
                                                         (line 74) exports; reuses the module-private
                                                         `splitFrontmatter` helper (line 25) and the
                                                         `classifyLine` helper (line 16) for top-level bullet
                                                         detection. Pure: trims `text`; if trimmed is empty,
                                                         returns `raw` unchanged (defense-in-depth — callers
                                                         must also guard); otherwise calls `splitFrontmatter`,
                                                         splits the body on `\r?\n`, finds the last index `i`
                                                         where `classifyLine(lines[i]) === 'topCheckbox'`,
                                                         inserts `- [ ] <trimmed>` after that index, and
                                                         re-joins with `\n`. If no top-level bullets exist
                                                         (empty / whitespace-only body), the new body is
                                                         exactly `- [ ] <trimmed>\n`. Frontmatter is preserved
                                                         byte-for-byte (return value is `${fm}${newBody}`).

EXTEND src/renderer/index.ts                           — extend the existing row renderer to mount the
                                                         affordance and handle the click→input lifecycle.
                                                         Concrete touch-points (line numbers from current HEAD;
                                                         drift OK as long as the named symbols match):

                                                         - `import { … } from './data/writeTodo'` (line 2):
                                                           add `addSubtask` to the import list.
                                                         - `renderTaskRow` (line 360 onward):
                                                           - For simple rows (after `item.appendChild(row)` at
                                                             line 447 and before the `if (expanded && isCombined)`
                                                             branch at line 449), append a `[data-add-subtask]`
                                                             span as a child of `item`.
                                                           - The combined+expanded body is rendered by
                                                             `renderSubtasks` (line 348). Append the
                                                             `[data-add-subtask]` span as the last child of
                                                             the `<ul data-subtask-list>` it creates, after
                                                             the `task.subtasks.forEach(...)` loop.
                                                         - The click handler on `[data-add-subtask]` replaces
                                                           the span with an `<input data-add-subtask-input
                                                           type="text">` via `parent.replaceChild(input, span)`,
                                                           then calls `input.focus()` synchronously.
                                                         - The keydown handler on the input:
                                                           - `key === "Enter"` → trim `input.value`; if empty,
                                                             call the same teardown helper used for Escape;
                                                             else compute `next = addSubtask(task.raw, trimmed)`,
                                                             `await window.todoz.writeFile(task.filePath, next)`,
                                                             then mirror the in-memory pattern already used by
                                                             `onSubtaskToggle` / `onSubtaskRemove` (line 618 /
                                                             638): `updateTask(task.slug, t => ({ ...t, raw: next,
                                                             subtasks: rebuildSubtasksFromRaw(next) }))`. Then
                                                             `expandedSlugs.add(task.slug)` (idempotent — covers
                                                             the simple→combined case and is a no-op for
                                                             combined-already-expanded). Then call
                                                             `fullRender()` (line 652).
                                                           - `key === "Escape"` → teardown only; no file write,
                                                             no in-memory mutation, no re-render. Replace the
                                                             input with a fresh `[data-add-subtask]` span via
                                                             `parent.replaceChild(span, input)` so the
                                                             affordance returns in place.
                                                         - The two new in-row event hooks live alongside the
                                                           existing `RenderContext` callbacks (line 239). Add
                                                           one new callback on `RenderContext`, e.g.
                                                           `onAddSubtaskSubmit(task: Task, text: string):
                                                           Promise<void>`, and wire it in the `mountApp`
                                                           closure (line 545) the same way `onSubtaskToggle`
                                                           is wired at line 618. The `Escape` / empty-Enter
                                                           teardown is purely DOM-local and does not need a
                                                           callback.

EXTEND src/renderer/index.html                         — additions to the existing `<style>` block at the top
                                                         of the file. Two parts:

                                                         (1) Add the missing `--outline` token to the `:root`
                                                             block (around lines 15–33; sits alongside
                                                             `--outline-variant`, `--on-surface`, etc.). Value
                                                             from `DESIGN.md`:
                                                               `--outline: #7e7576;`
                                                             The other tokens this feature uses
                                                             (`--outline-variant`, `--on-surface`,
                                                             `--surface-container-lowest`) are already declared
                                                             — do not redefine them and do not introduce a
                                                             `--color-` prefix; the renderer's existing
                                                             convention is bare names (`var(--outline-variant)`,
                                                             not `var(--color-outline-variant)`).

                                                         (2) Append CSS rules for:
                                                         `[data-add-subtask]`
                                                           → font: 14px Inter; color: var(--outline);
                                                           padding: 4px 8px; cursor: pointer; user-select: none;
                                                           indent matching `[data-subtask-title]`.
                                                         `[data-add-subtask]:hover`
                                                           → color: var(--on-surface);
                                                         `[data-add-subtask-input]`
                                                           → font: 14px Inter; padding: 4px 8px; border: 1px
                                                           solid var(--outline-variant); border-radius: 4px;
                                                           background: var(--surface-container-lowest);
                                                           outline: none; same indent as `[data-add-subtask]`.

NEW    test/view/addSubtask.spec.ts                    — Tallahassee/JSDOM specs per `## BDD test list`. Mocks
                                                         `window.todoz.readTodos`, `readFile`, `writeFile`,
                                                         and `archiveFile` against the existing
                                                         task-row-interactions fixtures. Asserts via the DOM
                                                         contract above.
EXTEND test/data/writeTodo.spec.ts                     — add the six `writeTodo.addSubtask` describes per
                                                         `## BDD test list`.
NEW    test/step_defs/add-subtask.steps.ts             — Cucumber steps per `## Step-definition file`. Imports
                                                         `TodozWorld`. Uses the existing `world.lastWriteFilePath`
                                                         and `world.lastWriteFileContent` recording from
                                                         task-row-interactions; no new world fields.
NEW    test/features/add-subtask.feature               — frozen Gherkin from Section 4. Cucumber loads from
                                                         `test/features/**/*.feature`. Plan agent moves it
                                                         here from `features/add-subtask/add-subtask.feature`.
```

No changes to existing view specs (`test/view/designAndStructure.spec.ts`, `test/view/taskRowInteractions.spec.ts`, `test/view/addTask.spec.ts` if it exists). No changes to `STANDARD_FIXTURES`. No new fixture files.

## Data fixtures

A dedicated set is **not** required — this feature reuses the existing task-row-interactions fixtures already on disk:

- `test/fixtures/vault/todos/buy-milk-2026-05-08.md` (REUSE) — simple task, status `todo`, empty body. Used by criteria 1, 4, 6, 7, 8.
- `test/fixtures/vault/todos/prep-deck-2026-05-08.md` (REUSE) — combined task with two top-level subtasks. Used by criteria 2, 3, 5.

The remaining task-row-interactions fixtures (`send-invoice`, `weekly-shop`) load alongside but are not specifically asserted by this feature's scenarios; their presence does not interfere.

The `writeTodo.addSubtask` unit tests use inline raw strings (no fixture files).

## Trace table

| Criterion | Scenario (test/features/add-subtask.feature) | Tests |
|---|---|---|
| 1. Simple shows affordance | "Simple task rows show the add-subtask affordance" | `addSubtask.spec.ts` > "renders an add-subtask affordance on a simple task row" |
| 2. Expanded combined shows affordance | "Expanded combined task rows show the add-subtask affordance" | `addSubtask.spec.ts` > "renders an add-subtask affordance after the last subtask of an expanded combined task row" |
| 3. Collapsed combined hides affordance | "Collapsed combined task rows hide the add-subtask affordance" | `addSubtask.spec.ts` > "renders no add-subtask affordance on a collapsed combined task row" |
| 4. Click opens focused input | "Clicking the affordance opens a focused subtask input" | `addSubtask.spec.ts` > "replaces the affordance with an input on click", "focuses the input when it appears" |
| 5. Combined add appends to body and DOM | "Submitting non-empty text on a combined task appends a subtask" | `addSubtask.spec.ts` > "calls writeFile with addSubtask output on Enter for a combined task", "renders the new subtask as the last child of the parent's subtask list after a successful add", "restores the affordance after a successful add"; `writeTodo.spec.ts` > "appends a new bullet to a body with existing top-level bullets", "preserves existing top-level bullet order", "leaves frontmatter unchanged" |
| 6. Simple add converts to combined+expanded | "Submitting non-empty text on a simple task converts it to combined" | `addSubtask.spec.ts` > "marks a simple task as combined after first successful add", "marks a simple task as expanded after first successful add", "renders the affordance below the new subtask after a simple task is converted"; `writeTodo.spec.ts` > "creates the first bullet on an empty body", "creates the first bullet on a whitespace-only body" |
| 7. Esc cancels without writing | "Pressing Esc cancels the input without writing" | `addSubtask.spec.ts` > "does not call writeFile on Esc", "tears down the input on Esc" |
| 8. Whitespace Enter cancels without writing | "Submitting whitespace-only text cancels the input without writing" | `addSubtask.spec.ts` > "does not call writeFile on whitespace-only Enter", "tears down the input on whitespace-only Enter"; `writeTodo.spec.ts` > "trims surrounding whitespace from the input text" |

## Test-tree audit

**Reusable** (already on disk; the Implement agent should pull these in, not duplicate them):

- `test/step_defs/world.ts` — `TodozWorld` with `mountWindow()`, `lastWriteFilePath`, `lastWriteFileContent`, `lastArchiveFilePath`, `fixtures`, `document`. Reused unchanged.
- `test/step_defs/task-row-interactions.steps.ts` — `Given("the vault contains task-row-interactions fixtures")`, `Given("the combined task {string} is expanded")`, `Then("no task file is changed")`. Reused as-is.
- `test/step_defs/design-and-structure.steps.ts` — `When("the initial render completes")`. Reused as-is.
- `src/renderer/data/writeTodo.ts` — module-private `splitFrontmatter` (line 25) and `classifyLine` (line 16); exported `toggleParent` (line 43), `toggleSubtask` (line 57), `removeSubtask` (line 74). `addSubtask` is added to the same module so the helpers stay private — do not export `splitFrontmatter` / `classifyLine`.
- `src/renderer/data/parseTodo.ts` — `parseTodo`, `parseTopLevelSubtasks`. Reused unchanged.
- `src/renderer/index.ts` — `mountApp` and the row renderer. Extended in place; no parallel mount.
- The `[data-task]`, `[data-task-row]`, `[data-subtask-list]`, `[data-subtask]`, `[data-kind]`, `[data-expanded]` attributes from the task-row-interactions render. Reused verbatim.
- `window.todoz.writeFile(path, content)` IPC. Reused unchanged. No new IPC channels needed.
- The four task-row-interactions fixtures. Reused as the loader set; only `buy-milk` and `prep-deck` are asserted.

**To add** (every NEW or EXTEND in `## File map`):

- `src/renderer/data/writeTodo.ts` (EXTEND — add `addSubtask`)
- `src/renderer/index.ts` (EXTEND — render affordance + input mount + handlers)
- `src/renderer/index.html` (EXTEND — CSS rules for affordance and input)
- `test/view/addSubtask.spec.ts` (NEW)
- `test/data/writeTodo.spec.ts` (EXTEND — `addSubtask` describes)
- `test/step_defs/add-subtask.steps.ts` (NEW)
- `test/features/add-subtask.feature` (NEW — moved here by the plan agent from `features/add-subtask/`)

**Gaps** (every requirement maps to a file in the File map and a test in the BDD test list):

- The renderer's `<style>` block in `src/renderer/index.html` already declares `--outline-variant`, `--on-surface`, and `--surface-container-lowest` (lines 26, 24, 18) — naming convention is **bare tokens, no `--color-` prefix**. The `--outline` token from `DESIGN.md` (`outline: #7e7576`) is **not yet** in `:root` and must be added by Implement as part of the `index.html` extension. The plan's CSS rules above use `var(--outline)`, `var(--on-surface)`, `var(--outline-variant)`, `var(--surface-container-lowest)` to match this convention.
- Blur-cancel is explicitly out of scope; the input persists until Esc or Enter. If user feedback later wants blur-cancel, it lands as a follow-up feature with its own scenario.
- The "what if a second add affordance is clicked while one input is open" interaction is out of scope. Only one `[data-add-subtask-input]` is expected at a time; the renderer does not need to coalesce or migrate state.
- The combined-row click handler at `src/renderer/index.ts` line 421 is bound to `[data-task-row]` (the `row` element) only, not to `[data-task]`, so clicks on `[data-add-subtask]` (which is a sibling of `[data-task-row]` for simple rows, or inside `[data-subtask-list]` for combined+expanded rows) do not bubble through that handler — no expand/collapse interference with the affordance click. Likewise the input's keydown does not collide with the row body's expand toggle.

## Gate check

- [x] 8 criteria, 8 Gherkin scenarios — 1:1
- [x] Every Gherkin step is listed under step definitions, marked NEW or REUSED
- [x] Every Tallahassee/unit test traces to a Gherkin step or step dependency (see `## Trace table`)
- [x] No scenario or test name contains "and"
- [x] Layer order: Gherkin first, Tallahassee second, data last
- [x] DOM contract covers every assertion the tests will make
- [x] File map lists every file Implement will touch
- [x] Every fixture matches `vault/AGENTS.md` schema (reusing existing on-disk fixtures)
- [x] Locked scope from Section 2 is respected throughout — affordance only on simple + combined+expanded, no blur-cancel, no nested subtasks, no validation messages
- [x] Zero lines of TypeScript or JavaScript written by the plan-feature skill
