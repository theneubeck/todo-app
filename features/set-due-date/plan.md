---
name: Set Due Date
slug: set-due-date
status: planned
frozen: true
created: 2026-05-19
---

# Set Due Date

## Pattern summary

Due dates can be set in two ways. First, the `/add` command accepts a `due:YYYY-MM-DD` token anywhere after the title — e.g. `/add finish report due:2026-06-15` — and writes the date into the task file's frontmatter on creation. Second, every task row shows a `calendar_month` icon that is hidden by default and revealed on hover (matching the existing hover-reveal pattern for the remove icon). Clicking the icon opens an inline `<input type="date">` directly in the task row, pre-filled with the existing due date if one is set. Pressing Enter (or blurring) writes the updated date to the task file and re-renders. Pressing Escape closes the input without saving.

**In scope:** `due:` token in `/add` command; calendar-icon affordance on task rows; inline date input (open, pre-fill, save on Enter/blur, cancel on Escape)  
**Out of scope:** clearing a due date via the icon; relative-date syntax (e.g. `due:tomorrow`); due-date editing from the Upcoming view rows; date validation beyond ISO format

## Acceptance criteria

1. Given a `/add` command containing `due:2026-06-15`, when submitted, then the created task file contains `due: 2026-06-15` in its frontmatter.
2. Given a task row is rendered, when the user hovers over it, then the calendar icon (`[data-set-due]`) becomes visible.
3. Given a task without a due date, when the user clicks the calendar icon, then an empty `[data-due-input]` date input appears in the row.
4. Given the date input is open and the user enters a date, when the user presses Enter, then the task file is updated with the new due date.
5. Given the date input is open, when the user presses Escape, then the input is removed and the task file is not written.
6. Given a task that already has a due date, when the user clicks the calendar icon, then the date input pre-fills with that existing date.

## Step-definition file

`test/step_defs/set-due-date.steps.ts` — steps:

**Given:**
- `Given('the vault contains the standard fixture todos', ...)` (REUSE — `todoList.steps.ts`)
- `Given('a task with due date {string} is loaded', ...)` (NEW)

**When:**
- `When('the todo list view loads', ...)` (REUSE — `todoList.steps.ts`)
- `When('the user submits the command {string}', ...)` (NEW)
- `When('the user clicks the set-due icon on the first task row', ...)` (NEW)
- `When('the user types {string} into the due input and presses Enter', ...)` (NEW)
- `When('the user presses Escape on the due input', ...)` (NEW)

**Then:**
- `Then('the written file contains due {string}', ...)` (NEW)
- `Then('a date input is visible in the first task row', ...)` (NEW)
- `Then('the date input is pre-filled with {string}', ...)` (NEW)
- `Then('the date input is not present', ...)` (NEW)
- `Then('the task file is not written', ...)` (NEW)

## BDD test list

[file: test/view/setDueDate.spec.ts]
- `describe("Set Due Date — row icon")` > `it("renders the calendar icon on each task row")`
- `describe("Set Due Date — row icon")` > `it("shows a date input when the icon is clicked")`
- `describe("Set Due Date — row icon")` > `it("pre-fills the input with an existing due date")`
- `describe("Set Due Date — row icon")` > `it("calls writeFile with updated due date on Enter")`
- `describe("Set Due Date — row icon")` > `it("removes the input without writing on Escape")`

[file: test/data/parseAddCommand.spec.ts] (extend existing)
- `describe("parseAddCommand")` > `it("parses a due: token into the due field")`
- `describe("parseAddCommand")` > `it("ignores a malformed due: token and keeps it in the title")`

[file: test/data/buildTaskFile.spec.ts] (extend existing)
- `describe("buildTaskFile")` > `it("includes due in frontmatter when provided")`
- `describe("buildTaskFile")` > `it("omits due line when not provided")`

## File map

### New files
- `test/features/set-due-date.feature` — Gherkin acceptance scenarios (frozen)
- `test/step_defs/set-due-date.steps.ts` — Cucumber step definitions for new steps
- `test/view/setDueDate.spec.ts` — Tallahassee DOM specs for the calendar-icon interaction

### Files to update
- `src/renderer/data/parseAddCommand.ts` — add `due?: string` to `AddCommand`; parse `due:YYYY-MM-DD` token (token matches `/^due:\d{4}-\d{2}-\d{2}$/i`); set `due` on result
- `src/renderer/data/buildTaskFile.ts` — add optional `due?: string` to `BuildTaskInput`; insert `due: YYYY-MM-DD` line in frontmatter between `status` and `tags` when present
- `src/renderer/index.ts` — pass `command.due` to `buildTaskFile` and set `due` on `newTask`; add `[data-set-due]` icon button to task rows (reuse `icon(doc, 'calendar_month')`); click handler: insert `<input type="date" data-due-input>` into row, pre-fill with `task.due`; keydown handler: Enter → update raw frontmatter (insert or replace `due:` line), call `writeFile`, `fullRender()`; Escape → remove input
- `src/renderer/index.html` — add CSS for `[data-set-due]` (hover-reveal, same pattern as `[data-remove]`) and `[data-due-input]`
- `test/data/parseAddCommand.spec.ts` — add two tests for `due:` token parsing
- `test/data/buildTaskFile.spec.ts` — add two tests for `due` in frontmatter output

### DOM contract
- `[data-set-due]` — calendar icon button on each task row; hidden by default, visible on `[data-task-row]:hover`
- `[data-due-input]` — `<input type="date">` inserted into the task row when editing; removed on save or cancel

### Visual treatment
- `[data-set-due]`: same hover-reveal pattern as `[data-remove]` — `opacity: 0` default, `0.5` on row hover, `1` on self-hover; `display: inline-flex; padding: 2px; border-radius: 3px; color: var(--outline); cursor: pointer`
- `[data-set-due] .material-symbols-outlined`: `font-size: 18px`
- `[data-due-input]`: `font-size: 12px; border: 1px solid var(--outline-variant); border-radius: 4px; padding: 2px 6px; background: var(--surface-container-low); color: var(--on-surface); margin-left: 8px`

## Data fixtures

The standard fixture todos (from `todoList.steps.ts`) cover rows with and without due dates. The `set-due-date.steps.ts` file mounts tasks inline. No new `test/fixtures/vault/todos/*.md` files are required.
