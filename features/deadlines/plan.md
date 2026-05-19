---
name: Deadlines
slug: deadlines
status: planned
frozen: true
created: 2026-05-19
---

# Deadlines

## Pattern summary

The Upcoming sidebar entry becomes a functional deadline view. When the user navigates to Upcoming, the main pane renders an ordered list of all incomplete tasks that carry a `due` field, sorted ascending by due date. Each row has a two-line layout: the task title on the first line and a secondary line directly below it showing a `calendar_month` icon, the due-date string, and an optional tag chip — all rendered in `var(--on-surface-variant)` at 12 px (label-md). Tasks without a `due` field are hidden from this view. Completed (`status: done`) tasks are excluded. An empty state message appears when no incomplete due-dated tasks exist.

**In scope:** functional Upcoming view (filter to due-dated incomplete tasks, ascending due-date sort, two-line row layout, tag chip on secondary line, empty state, correct header label)  
**Out of scope:** inline due-date display changes on Inbox/Today rows; overdue red highlighting; click-to-edit due date; date range filters; checkbox / remove actions from this view

## Acceptance criteria

1. Given tasks with due dates and tasks without due dates exist, when the Upcoming view loads, then only tasks with a `due` field appear in the list.
2. Given multiple tasks with due dates exist, when the Upcoming view loads, then tasks appear in ascending due-date order (earliest first).
3. Given a task has a due date, when the Upcoming view renders, then a secondary line below the task title shows a calendar icon and the due-date text.
4. Given a task has a due date and tags, when the Upcoming view renders, then a tag chip appears on the secondary line alongside the due date.
5. Given no incomplete tasks have a due date, when the Upcoming view loads, then an empty state message is visible.
6. Given the user navigates to Upcoming, when the view loads, then the main header title reads "Upcoming".

## Step-definition file

`test/step_defs/deadlines.steps.ts` — steps:

**Given:**
- `Given('the vault contains the standard fixture todos', ...)` (REUSE — `todoList.steps.ts`)
- `Given('the vault contains only tasks without due dates', ...)` (NEW)

**When:**
- `When('the todo list view loads', ...)` (REUSE — `todoList.steps.ts`)
- `When('the user clicks sidebar entry {string}', ...)` (REUSE — `read-watch.steps.ts`)

**Then:**
- `Then('only tasks with a due date appear in the Upcoming list', ...)` (NEW)
- `Then('the tasks in the Upcoming list appear in ascending due-date order', ...)` (NEW)
- `Then('each task row in the Upcoming list shows a due-date line below the title', ...)` (NEW)
- `Then('the first task row in the Upcoming list shows a tag chip on the due-date line', ...)` (NEW)
- `Then('an empty state message appears in the Upcoming view', ...)` (NEW)
- `Then('the main header title is {string}', ...)` (NEW)

## BDD test list

[file: test/view/deadlines.spec.ts]
- `describe("Deadlines — Upcoming view")` > `it("shows only tasks that have a due field")`
- `describe("Deadlines — Upcoming view")` > `it("orders tasks by ascending due date")`
- `describe("Deadlines — Upcoming view")` > `it("renders a due-date row below each task title")`
- `describe("Deadlines — Upcoming view")` > `it("renders a tag chip inside the due-date row")`
- `describe("Deadlines — Upcoming view")` > `it("shows the empty state when no tasks have due dates")`
- `describe("Deadlines — Upcoming view")` > `it("sets the main header title to Upcoming")`

## File map

### New files
- `test/features/deadlines.feature` — Gherkin acceptance scenarios (frozen)
- `test/step_defs/deadlines.steps.ts` — Cucumber step definitions for this feature
- `test/view/deadlines.spec.ts` — Tallahassee DOM specs for the Upcoming view

### Files to update
- `src/renderer/index.ts` — add `{ kind: 'upcoming' }` to `Filter` type union; add `'upcoming'` case to `filterMatchesTask` (return `task.due !== undefined && task.status !== 'done'`); add `'upcoming'` case to `filterLabel` (return `'Upcoming'`); wire up `entryKeyForFilter` and `filterFromEntryKey` for `'upcoming'`; remove the `if (key === 'upcoming') return` inert guard (~line 1257); add `renderUpcomingList(doc, tasks, filter)` function that renders `[data-upcoming-list]` with `[data-upcoming-row]` elements each containing a title line and a `[data-due-row]` secondary line; call `renderUpcomingList` when active filter is `upcoming`
- `src/renderer/index.html` — add CSS block for `[data-upcoming-list]`, `[data-upcoming-row]`, `[data-due-row]`, `[data-due-date]`, `[data-tag-chip]` in due-row context, `[data-upcoming-empty]`

### DOM contract
- `[data-sidebar-entry="upcoming"]` — existing sidebar navigation entry
- `[data-upcoming-list]` — container wrapping all upcoming task rows
- `[data-upcoming-row]` — individual task row; carries `data-slug="{slug}"`
- `[data-task-title]` — task title text span (reuse existing attribute)
- `[data-due-row]` — secondary line below title, child of `[data-upcoming-row]`
- `[data-due-date]` — due-date text span inside `[data-due-row]`
- `[data-tag-chip]` — tag chip span inside `[data-due-row]` (only when task has tags; first tag only)
- `[data-upcoming-empty]` — empty state message element

### Visual treatment
- `[data-upcoming-list]`: `display: flex; flex-direction: column`
- `[data-upcoming-row]`: `display: flex; flex-direction: column; padding: 8px 0; border-bottom: 1px solid var(--outline-variant)`
- `[data-due-row]`: `display: flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 12px; color: var(--on-surface-variant)`
- `[data-due-row] .material-symbols-outlined`: `font-size: 14px; line-height: 1; color: inherit`
- `[data-due-date]`: inherits 12 px / `var(--on-surface-variant)` from `[data-due-row]`
- `[data-tag-chip]` in `[data-due-row]`: `font-size: 11px; background: var(--surface-container); color: var(--on-surface-variant); padding: 1px 6px; border-radius: 4px`
- `[data-upcoming-empty]`: `color: var(--on-surface-variant); font-size: 14px; padding: 24px 0`

## Data fixtures

The standard fixture todos (defined inline in `test/step_defs/todoList.steps.ts` as `STANDARD_FIXTURES`) cover all due-date scenarios:

- Tasks with `due`: call-dentist (2026-05-10), pickup-package (2026-05-09), sync-with-mike (2026-05-12), q2-report (2026-06-01)
- Task without `due`: read-anthropic-paper

The empty-state scenario uses a no-due-dates fixture defined inline in `deadlines.steps.ts` (same pattern as `today-flow.steps.ts`). No new `test/fixtures/vault/todos/*.md` files are required.
