---
name: Today Flow
slug: today-flow
status: planned
frozen: true
created: 2026-05-18
---

# Today Flow

## Pattern summary

Today Flow is the primary daily focus view. It displays a curated, user-assembled list of tasks for the current day, stored as `vault/todos/today.md` — a special markdown file with `type: today` in its frontmatter, containing wikilinks (e.g. `- [[buy-milk-2026-05-17]]`) that reference task files in the same directory. Regular task loading excludes `today.md` (filtered by `type: today`). The renderer reads today's ordered slug list via a new `window.todoz.readToday()` IPC call and joins those slugs against the full task list to render task rows. Writes use a matching `window.todoz.writeToday(slugs: string[])` call.

The Today view is accessible from the sidebar. It renders task rows with a checkbox, title, and a remove-from-today icon (`[data-remove-from-today]`). Checking a row's checkbox writes `status: done` to the original task file and removes its slug from `today.md`. The remove-from-today icon only removes the slug from `today.md` — the original task file is untouched. A "Clear all" thin link (`[data-today-clear-all]`) below the task list wipes `today.md`; the `/today-clear` command bar command does the same. From any non-Today view, every task row gains an "add to today" icon (`[data-add-to-today]`, `wb_sunny`) on hover; clicking it appends the task's slug to `today.md`. When the user adds a task via the command bar while the Today view is active, the new task file is created and its slug is also appended to `today.md`.

**In scope:** sidebar Today navigation to Today view, hover add-to-today icon on non-Today task rows, `today.md` wikilink storage, checkbox completion propagating to original task + removing from Today, remove-from-today icon, "Clear all" link, `/today-clear` command, auto-appending new tasks to Today when created from the Today view.

**Out of scope:** `/today-add` command, drag-to-reorder within Today, retaining completed tasks in the Today list after they are done.

## Acceptance criteria

1. Given `today.md` exists with task wikilinks, when the Today view loads, then the linked tasks appear as rows in the correct order.
2. Given tasks exist in a non-Today view, when the todo list view loads, then each task row shows an add-to-today icon on hover.
3. Given the user clicks the add-to-today icon on a task row, when the action completes, then the task appears in the Today list and its wikilink is appended to `today.md`.
4. Given the Today view is active, when the user clicks the remove-from-today icon on a task row, then the task disappears from Today and `today.md` is updated — the original task file is not modified.
5. Given the Today view is active, when the user checks a task's checkbox, then `status: done` is written to the original task file and the task is removed from `today.md`.
6. Given the Today view has tasks, when the user clicks "Clear all", then the Today list is emptied and `today.md` is cleared.
7. Given the user types `/today-clear` and presses Enter, when in any view, then the Today list is cleared and `today.md` is emptied.
8. Given the Today view is active, when the user adds a task via the command bar, then the new task file is created and its wikilink is appended to `today.md`.

## Step-definition file

`test/step_defs/today-flow.steps.ts` — steps:

**Given:**
- `Given('the vault contains today-flow fixtures')` (NEW)
- `Given('the vault contains today-flow fixtures with tasks in Today')` (NEW)
- `Given('the command bar reads {string}')` (REUSE — `command-bar-fixes.steps.ts`)

**When:**
- `When('the Today view loads')` (NEW)
- `When('the todo list view loads')` (REUSE — `todoList.steps.ts`)
- `When('the user clicks the add-to-today icon on the first task row')` (NEW)
- `When('the user clicks the remove-from-today icon on a task row')` (NEW)
- `When('the user clicks {string}')` (REUSE — `add-task.steps.ts`)
- `When('the user toggles the parent checkbox')` (REUSE — `task-row-interactions.steps.ts`)
- `When('the user adds a task via the command bar')` (NEW)
- `When('the user presses Enter')` (REUSE — `add-task.steps.ts`)

**Then:**
- `Then('the Today task list shows the linked tasks in order')` (NEW)
- `Then('each task row shows an add-to-today icon on hover')` (NEW)
- `Then('the task appears in the Today list')` (NEW)
- `Then('today.md is updated with the task wikilink')` (NEW)
- `Then('the task is removed from the Today list')` (NEW)
- `Then('the original task file is unchanged')` (NEW)
- `Then('the original task file has status done')` (NEW)
- `Then('the Today list is empty')` (NEW)
- `Then('today.md is empty')` (NEW)
- `Then('the new task appears in the Today list')` (NEW)
- `Then('today.md is updated with the new task wikilink')` (NEW)

## BDD test list

[file: test/view/todayFlow.spec.ts]
- `describe("TodayFlow")` > `it("renders task rows from today.md wikilinks")`
- `describe("TodayFlow")` > `it("renders tasks in the order they appear in today.md")`
- `describe("TodayFlow")` > `it("renders an empty state when today.md has no links")`
- `describe("TodayFlow")` > `it("renders a Clear all link when the Today list has tasks")`
- `describe("TodayFlow")` > `it("does not render a Clear all link when the Today list is empty")`
- `describe("TodayFlow")` > `it("renders an add-to-today icon on task rows in the inbox view")`
- `describe("TodayFlow")` > `it("clicking add-to-today calls writeToday with the slug appended")`
- `describe("TodayFlow")` > `it("clicking remove-from-today calls writeToday without that slug")`
- `describe("TodayFlow")` > `it("clicking remove-from-today does not call writeFile on the original task")`
- `describe("TodayFlow")` > `it("checking a Today task checkbox calls writeFile with status done on the original")`
- `describe("TodayFlow")` > `it("checking a Today task checkbox calls writeToday without that slug")`
- `describe("TodayFlow")` > `it("clicking Clear all calls writeToday with an empty list")`
- `describe("TodayFlow")` > `it("submitting /today-clear calls writeToday with an empty list")`
- `describe("TodayFlow")` > `it("adding a task from the Today view calls writeToday with the new slug")`

## File map

### New files
- `src/renderer/data/parseTodayFile.ts` — parses `today.md` wikilinks into an ordered slug list
- `src/main/todayFile.ts` — `readTodayFile` / `writeTodayFile` helpers operating on `vault/todos/today.md`
- `test/view/todayFlow.spec.ts` — Tallahassee DOM specs
- `test/step_defs/today-flow.steps.ts` — Cucumber step definitions
- `test/verify/todayFlow.verify.ts` — Playwright screenshot verification
- `test/fixtures/vault/todos/today-flow-task-a-2026-05-18.md` — fixture task A
- `test/fixtures/vault/todos/today-flow-task-b-2026-05-18.md` — fixture task B
- `test/fixtures/vault/todos/today.md` — fixture today list referencing both tasks

### Files to update
- `src/main.ts` — add `read-today` and `write-today` IPC handlers; filter `type: today` files from `read-todos`
- `src/preload.ts` — expose `readToday()` and `writeToday(slugs)` on `window.todoz`
- `src/renderer/index.ts` — render Today view from readToday slugs; add-to-today icon on task rows; /today-clear command; auto-append on add from Today view
- `src/renderer/data/parseTodo.ts` — exclude files with `type: today` from standard task parsing (or handle in IPC layer)

### DOM contract
- `[data-today-list]` — container for the Today task list
- `[data-today-row]` — individual row in the Today list
- `[data-today-row][data-slug="<slug>"]` — Today row identified by slug
- `[data-add-to-today]` — hover icon on non-Today task rows (icon: `wb_sunny`)
- `[data-remove-from-today]` — remove icon on Today rows (icon: `close`)
- `[data-today-clear-all]` — "Clear all" thin link below the Today list
- `[data-today-empty]` — empty-state element shown when Today list has no tasks

### Visual treatment
- Today task rows: same height and structure as inbox rows
- Add-to-today icon: `on-surface-variant` (`#4c4546`), visible only on row hover, `wb_sunny` Material icon, same size as existing remove icon
- Remove-from-today icon: `on-surface-variant`, hover only, `close` icon
- "Clear all": `label-md` (12px, Inter 500), `on-surface-variant` color, rendered as a plain `<button>` styled as a thin underlined link, 8px top margin below the list
- Empty state: `body-md` (14px) muted text, centered in the main pane

## Data fixtures

- `test/fixtures/vault/todos/today-flow-task-a-2026-05-18.md` — task with due date, tagged `work`, referenced in today.md
- `test/fixtures/vault/todos/today-flow-task-b-2026-05-18.md` — task without due date, tagged `work`, referenced second in today.md
- `test/fixtures/vault/todos/today.md` — `type: today`, links to both tasks above in order
