---
name: Design and structure
slug: design-and-structure
status: planned
frozen: true
created: 2026-05-07
---

# Design and structure

## Pattern summary

The application chrome that wraps the todo list. When the Electron app starts the user sees a fixed top app bar branded "TaskStream" on the left with action icons (add, settings, avatar) on the right; a left sidebar with primary navigation entries Chat, Inbox, Today (active, highlighted), Upcoming, plus PROJECTS and PEOPLE section headers with sample entries; and a main content area to the right of the sidebar. The main area shows an h1 "Today", a body-md remaining-count line ("N tasks remaining"), and a single bordered card holding the task list. The task list groups rows under uppercase label headings ("HIGH PRIORITY", "OTHER TASKS"); each row shows a chevron, a square checkbox, the task title, and a small priority/category chip on the right. The first task is expanded by default to reveal its subtasks indented under a vertical guide line, with completed subtasks shown struck through. A floating command bar pinned to the bottom of the main area contains a bolt icon, two demo chips ("@name", "#design"), a placeholder input ("Type a command or add a task..."), and a "CMD + K" hint on the right. All visuals follow the Focus & Utility design system in `DESIGN.md`: Inter font, 4px/8px spacing rhythm, off-white background, 1px outline-variant borders, rounded-sm/md radii, no drop shadows on surfaces.

## Acceptance criteria

1. Given the app loads, when the initial render completes, then the top app bar shows the brand "TaskStream" on the left with add, settings, and avatar icons on the right.
2. Given the app loads, when the initial render completes, then the left sidebar shows the navigation entries Chat, Inbox, Today, Upcoming with the Today entry visually marked active.
3. Given the app loads, when the initial render completes, then the main content header shows an h1 reading "Today" above a body-md line stating the remaining task count.
4. Given the vault contains the standard fixture todos, when the main view loads, then the task list renders inside a single bordered card with rows grouped under uppercase priority headings.
5. Given a task has subtasks, when its row is expanded, then the subtasks render indented beneath the parent with a vertical guide line and completed subtasks shown struck through.
6. Given the app loads, when the initial render completes, then a command bar pinned to the bottom of the main area shows the placeholder "Type a command or add a task..." with a "CMD + K" hint on the right.

## Step-definition file

`test/step_defs/design-and-structure.steps.ts` — steps:
- Given("the app loads") — mounts the Tallahassee window with no specific fixture state
- When("the initial render completes") — runs the app's bootstrap render and resolves
- Then("the top app bar shows the brand {string} with action icons") — asserts brand text and presence of `[data-icon=add]`, `[data-icon=settings]`, `[data-icon=person]`
- Then("the left sidebar shows the navigation entries {string} with {string} marked active") — asserts entries present and active state via `[data-nav-active]`
- Then("the main content header shows the h1 {string} above the remaining-count line") — asserts `<h1>` text and `[data-remaining-count]` text
- Then("the task list renders inside a bordered card grouped under uppercase priority headings") — asserts `[data-task-list]` container plus group headings
- Given("a task has subtasks") — provided by reuse of existing `the vault contains the standard fixture todos` step (Q2 report has subtasks)
- When("its row is expanded") — toggles `[data-expanded]` on the matching task row
- Then("the subtasks render indented with a guide line and done items struck through") — asserts subtask DOM structure and strike-through class on done items
- Then("a command bar pinned to the bottom shows the placeholder {string} with the {string} hint") — asserts `[data-command-bar]` placeholder and shortcut hint text

The step `Given("the vault contains the standard fixture todos")` is reused from `test/step_defs/todoList.steps.ts` (Cucumber loads all step files globally; no new common.steps.ts is introduced for two features).

## BDD test list

[file: test/view/designAndStructure.spec.ts]
- describe("DesignAndStructure") > it("renders the TaskStream brand in the top app bar")
- describe("DesignAndStructure") > it("renders add, settings, avatar action icons in the top app bar")
- describe("DesignAndStructure") > it("renders the primary sidebar navigation entries")
- describe("DesignAndStructure") > it("marks the Today sidebar entry as active")
- describe("DesignAndStructure") > it("renders the PROJECTS section header in the sidebar")
- describe("DesignAndStructure") > it("renders the PEOPLE section header in the sidebar")
- describe("DesignAndStructure") > it("renders an h1 reading Today in the main header")
- describe("DesignAndStructure") > it("renders a remaining-count line below the h1")
- describe("DesignAndStructure") > it("wraps the task list in a single bordered card")
- describe("DesignAndStructure") > it("groups task rows under uppercase priority headings")
- describe("DesignAndStructure") > it("renders a chevron, a checkbox, a title, a chip on every task row")
- describe("DesignAndStructure") > it("indents subtasks beneath an expanded parent task")
- describe("DesignAndStructure") > it("strikes through subtasks marked done")
- describe("DesignAndStructure") > it("renders a command bar pinned to the bottom of the main area")
- describe("DesignAndStructure") > it("shows the placeholder text in the command bar input")
- describe("DesignAndStructure") > it("shows the CMD + K hint on the right of the command bar")

(No new `parseTodo` or `writeTodo` tests — the existing parser already returns `subtasks: { index, label, done }[]`, which is everything the renderer needs to draw indentation and strike-through. The renderer consumes `subtask.done` directly; no new parsing behavior is introduced.)

## Data fixtures

The three existing fixtures already cover every scenario above and follow the `vault/AGENTS.md` schema. No new fixture files are required.

- `test/fixtures/vault/todos/call-dentist-2026-05-04.md` — task with near-future due date, two flat subtasks (one done, one open) — exercises checkbox row + strike-through
- `test/fixtures/vault/todos/q2-report-2026-05-04.md` — task with later due date, parent subtask plus indented sub-subtasks, mixed done states — exercises expanded row + nested guide line
- `test/fixtures/vault/todos/read-anthropic-paper-2026-05-04.md` — task with no due date, one done subtask — exercises sort-last + strike-through path

---

Plan complete. Ready for Implement.
