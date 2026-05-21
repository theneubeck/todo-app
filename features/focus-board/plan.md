---
name: Focus Board
slug: focus-board
status: planned
frozen: true
created: 2026-05-20
---

# Focus Board

## Pattern summary

A new "Focus" sidebar entry (icon: `hub`) navigates to the Focus Board — a flex-wrapped grid of square cards, one per saved focus. Each card is a named grouping of tags: the name is shown in bold at the top and the attached tag chips are listed below. Clicking a card navigates to a filtered task list showing all incomplete tasks that carry any of the focus's tags, rendered with the full task row (checkbox, subtask expand, remove). From there, clicking "Focus" in the sidebar returns to the board. New focuses are created via the command bar: `/focus Work #work #q2` — any non-tag tokens form the name, `#` tokens become the tag list. Focuses are persisted in `vault/focuses.json` and read via `window.todoz.readFocuses()`.

**In scope:** Focus sidebar entry; focus board with named cards and tag chips; click card → filtered task list; click sidebar to return to board; `/focus <name> #tag…` command bar creation; empty state on board; `readFocuses`/`writeFocuses` IPC.  
**Out of scope:** editing or deleting existing focuses; reordering cards; task count badge on cards; focus-specific icons or colours; drag-to-assign tags.

## Acceptance criteria

1. Given focuses exist in the vault, when the Focus board loads, then each focus appears as a card displaying its name.
2. Given a focus has tags, when the Focus board loads, then the tag chips for that focus appear on its card.
3. Given no focuses exist, when the Focus board loads, then an empty state message is visible.
4. Given a focus card exists, when the user clicks it, then a task list appears showing only tasks whose tags overlap with the focus's tags.
5. Given the user is viewing a focus task list, when the user clicks the Focus sidebar entry, then the board view is restored.
6. Given the command `/focus Work #work #q2` is submitted via the command bar, then a new focus card named "Work" appears on the board.

## Step-definition file

`test/step_defs/focus-board.steps.ts` — steps:

**Given:**
- `Given('the vault contains the standard fixture todos', ...)` (REUSE — `todoList.steps.ts`)
- `Given('the vault contains focus fixtures', ...)` (NEW)
- `Given('the vault contains no focuses', ...)` (NEW)

**When:**
- `When('the todo list view loads', ...)` (REUSE — `todoList.steps.ts`)
- `When('the user clicks sidebar entry {string}', ...)` (REUSE — `read-watch.steps.ts`)
- `When('the user clicks the focus card {string}', ...)` (NEW)
- `When('the user submits the command {string}', ...)` (REUSE — `set-due-date.steps.ts`)

**Then:**
- `Then('the focus board shows {int} focus cards', ...)` (NEW)
- `Then('the focus card {string} shows tag {string}', ...)` (NEW)
- `Then('an empty state message appears on the focus board', ...)` (NEW)
- `Then('the task list shows tasks matching the focus tags', ...)` (NEW)
- `Then('the focus board is visible', ...)` (NEW)
- `Then('a focus card named {string} appears on the board', ...)` (NEW)

## BDD test list

[file: test/view/focusBoard.spec.ts]
- `describe("Focus Board")` > `it("renders focus cards for each saved focus")`
- `describe("Focus Board")` > `it("renders tag chips on each focus card")`
- `describe("Focus Board")` > `it("shows the empty state when no focuses exist")`
- `describe("Focus Board")` > `it("navigates to the task list when a focus card is clicked")`
- `describe("Focus Board")` > `it("shows only tasks whose tags overlap with the focus tags")`
- `describe("Focus Board")` > `it("returns to the board when the Focus sidebar entry is clicked")`
- `describe("Focus Board")` > `it("creates a new focus card via the /focus command")`

[file: test/data/parseFocusCommand.spec.ts]
- `describe("parseFocusCommand")` > `it("parses a name and hash tags from the command")`
- `describe("parseFocusCommand")` > `it("treats non-tag tokens anywhere as the name")`
- `describe("parseFocusCommand")` > `it("returns null when the title is empty")`
- `describe("parseFocusCommand")` > `it("returns null when the input does not start with /focus")`

## File map

### New files
- `src/renderer/data/parseFocusCommand.ts` — pure parser for `/focus` command; exports `Focus` type and `parseFocusCommand(input): { name: string; tags: string[] } | null`
- `test/features/focus-board.feature` — Gherkin scenarios (frozen)
- `test/step_defs/focus-board.steps.ts` — Cucumber step definitions for new steps
- `test/view/focusBoard.spec.ts` — Tallahassee DOM specs for the Focus Board
- `test/data/parseFocusCommand.spec.ts` — unit tests for the command parser
- `test/fixtures/vault/focuses.json` — two fixture focuses for use in Cucumber bootstrap

### Files to update
- `src/main.ts` — add `read-focuses` IPC handler (reads `vault/focuses.json`, returns `[]` if absent) and `write-focuses` handler (writes the JSON file); both resolve the active vault path the same way as existing handlers
- `src/renderer/index.ts` — (a) extend `window.todoz` declaration with `readFocuses?: () => Promise<Focus[]>` and `writeFocuses?: (focuses: Focus[]) => Promise<void>`; (b) import/define `Focus` type from `parseFocusCommand.ts`; (c) add `{ kind: 'focus-board' }` and `{ kind: 'focus'; id: string; tags: string[] }` to `Filter` type; (d) add `{ key: 'focus', label: 'Focus', icon: 'hub' }` to `PRIMARY_ENTRIES`; (e) implement `filterMatchesTask` for `focus` (task has at least one tag in `filter.tags`, status not done); (f) update `filterLabel`, `entryKeyForFilter`, `filterFromEntryKey` for `focus-board` and `focus`; (g) add `renderFocusBoard(doc, focuses, onCardClick)` function rendering `[data-focus-board]`; (h) add `renderFocusTaskList(doc, tasks, filter)` rendering `[data-focus-task-list]` with task rows; (i) load focuses in `mountApp` via `readFocuses()` and store in a `focuses` variable alongside `tasks`; (j) dispatch rendering in `fullRender()` on `focus-board` and `focus` filter kinds; (k) handle `/focus` command in `handleCommandEnter` — parse with `parseFocusCommand`, create `Focus` with `crypto.randomUUID()`, call `writeFocuses`, update in-memory `focuses`, `fullRender()`
- `src/renderer/index.html` — add CSS block for `[data-focus-board]`, `[data-focus-card]`, `[data-focus-name]`, `[data-focus-tag]`, `[data-focus-empty]`, `[data-focus-task-list]`

### DOM contract
- `[data-sidebar-entry="focus"]` — sidebar navigation entry
- `[data-focus-board]` — container for the card grid
- `[data-focus-card]` — individual card; carries `data-focus-id="{id}"`
- `[data-focus-name]` — name span inside a card
- `[data-focus-tag]` — tag chip span inside a card (one per tag)
- `[data-focus-empty]` — empty state element shown when no focuses exist
- `[data-focus-task-list]` — container for the task list when viewing a focus
- `[data-task-row]` — individual task rows inside `[data-focus-task-list]` (reuse existing attribute)

### Visual treatment
- `[data-focus-board]`: `display: flex; flex-wrap: wrap; gap: 16px; padding: 16px 0`
- `[data-focus-card]`: `width: 160px; min-height: 160px; display: flex; flex-direction: column; padding: 16px; background: var(--surface-container-low); border: 1px solid var(--outline-variant); border-radius: 8px; cursor: pointer`
- `[data-focus-card]:hover`: `background: var(--surface-container); border-color: var(--outline)`
- `[data-focus-name]`: `font-size: 14px; font-weight: 600; color: var(--on-surface); margin-bottom: 8px`
- `[data-focus-tag]`: `display: inline-block; font-size: 11px; background: var(--surface-container); color: var(--on-surface-variant); padding: 2px 6px; border-radius: 4px; margin: 2px 2px 0 0`
- `[data-focus-empty]`: `color: var(--on-surface-variant); font-size: 14px; padding: 24px 0`
- `[data-focus-task-list]`: `display: flex; flex-direction: column`

## Data fixtures

`test/fixtures/vault/focuses.json` — two focus objects used by the Cucumber bootstrap. Not a `vault/todos` file; schema is a JSON array of `Focus` objects:

```json
[
  { "id": "focus-work-001", "name": "Work", "tags": ["work", "q2"] },
  { "id": "focus-personal-001", "name": "Personal", "tags": ["personal", "errands"] }
]
```

The Tallahassee tests define focuses inline (same pattern as task fixtures in other specs). The Cucumber step `Given('the vault contains focus fixtures')` mounts the app with `window.todoz.readFocuses` returning the two objects above.
