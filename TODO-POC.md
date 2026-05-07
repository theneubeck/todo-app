# Todo interface POC

Explore different todo UI paradigms to find the right interaction model for todoz. Rather than committing to one approach upfront, this POC builds each pattern as a standalone React component against the same underlying markdown file structure, then evaluates them side by side.

---

## What we're solving

Todos are deceptively hard to get right. The data model is simple — a checkbox and some text — but the interaction model determines whether you actually use the app. The goal of this POC is to find the pattern that feels most natural for deep-focus work with nested, project-linked tasks.

---

## UI patterns to explore

### 1. Acunote (sprint/burndown style)
Tasks live in a sprint. The view shows a flat prioritised list for the current sprint with a simple burndown. Clicking a task expands inline subtasks. Good for structured delivery work with a defined horizon. Keyboard-heavy, no drag needed.

Key traits: sprint container, story points or weight, inline subtask expansion, burndown sidebar.

**POC eval**:
- Capture speed: not implemented; depends on whether assigning sprint/weight is one keystroke or a form. For personal use the sprint commitment ritual itself is friction.
- Find-next: remaining-weight number is a strong daily signal but assumes the user grooms a sprint regularly.
- Nesting: handles parent-child via expand-on-click. Two levels visible at once. Good for the q3-strategy fixture.
- Vault note: `sprint:<id>` and `w:<n>` encoded as tags. Workable but verbose; would benefit from dedicated frontmatter fields if pattern wins.

### 2. iPhone Reminders (grouped flat list)
Dead simple. Lists on the left, tasks on the right. Tap to complete, swipe to reschedule. Groups by list/tag, no nesting beyond one level. The model works because it never fights you — capture is instant and completion feels satisfying.

Key traits: flat list, one-level grouping, large tap targets, badge counts per list.

**POC eval**:
- Capture speed: not yet implemented (no input form). Plain title-only entry would be fastest of all six patterns.
- Find-next: groups + per-group incomplete badge make scanning fast, but no priority/date — relies on user picking a list mentally.
- Nesting: shows children of a top-level item as a flat sub-list, but does not surface deeper nesting. Acceptable for shopping/errand lists, weak for project work like the q3-strategy fixture.

### 3. Todoist (priority + natural language)
Tasks have priority levels (P1–P4) rendered as colour-coded flags. The input bar parses natural language — "call dentist tomorrow #personal p2" — directly into structured data. Today/Upcoming/Filters are the main views. No deep nesting but very fast to add.

Key traits: priority flags, NLP capture, today view, project sidebar.

**POC eval**:
- Capture speed: fastest of all six. Single-line NLP parses title + tags + priority + due in one keystroke run.
- Find-next: P1→P4 sort + Today filter combined gives a strong "do this next" signal.
- Nesting: shallowest. Top-level item children render flat. Unsuitable for the q3-strategy fixture's three-level structure.
- Vault note: priority encoded as a `pN` tag in the existing schema — no new field needed.

### 4. Things 3 (areas → projects → tasks)
The cleanest Mac todo app. Three levels: Areas (life domains) → Projects → Tasks. "Today" and "Upcoming" are calendar-aware views that surface the right tasks at the right time. Headings inside projects create visual grouping without true nesting.

Key traits: three-tier hierarchy, Today/Upcoming/Anytime/Someday buckets, headings as visual separators.

**POC eval**:
- Capture speed: not yet implemented; would need a 3-level pick (area → project → task) which adds friction vs Reminders.
- Find-next: Today bucket gives the strongest "what now" answer of all six patterns when due dates are populated.
- Nesting: top-level item children render as a flat list under each task — same limitation as Reminders. Three-tier grouping in the vault is enforced via tags (area) + project field, which is a synthetic mapping but holds up.

### 5. Outline / Workflowy style
Everything is a node. Any node can be a task or a container. Zoom into any node to focus. Infinite nesting, no imposed hierarchy. Works well for thinking and planning but can get unwieldy for execution.

Key traits: infinite nesting, zoom/focus mode, bullet = everything, collapse/expand.

**POC eval**:
- Capture speed: not implemented; would be fast since adding a child is trivial. No metadata friction.
- Find-next: weakest signal. No priority, no due, no status filter — relies entirely on user navigating the tree.
- Nesting: handles arbitrary depth natively. Best fit for the q3-strategy fixture's three-level structure.
- Vault note: maps cleanly to existing nested checkbox markdown — no schema change needed.

### 6. Linear (developer issue tracker style)
Issues live in cycles (sprints). Status columns (backlog / todo / in progress / done). Triage view for unsorted items. Very keyboard-driven, designed for rapid status changes. Feels like a project management tool more than a personal one.

Key traits: status-column model, cycle containers, triage/inbox, keyboard shortcuts for everything.

**POC eval**:
- Capture speed: not implemented; Linear's strength is rapid keyboard-driven status changes after capture, not capture itself.
- Find-next: Doing column is the answer — limited WIP makes "what now" obvious. Triage surfaces inbox items that need a decision.
- Nesting: not modeled in the POC. Linear treats sub-issues as separate issues with parent links — would require schema work to map cleanly.
- Vault note: status enum maps directly. Cycle encoded as `cycle:<id>` tag. Keyboard shortcuts deliberately deferred — not evaluable without focused time.

---

## Key decisions each pattern handles differently

**Nesting** — flat, one level, three levels, or unlimited. Deeply nested tasks are powerful but easy to lose.

**Status model** — binary done/not-done vs. multi-state (todo / doing / blocked / done). Multi-state adds power but also friction.

**Capture speed** — how many keystrokes to add a task? NLP parsing (Todoist) vs. structured form vs. plain typing.

**Completion UX** — check in place and task fades, or task moves to a "done" section, or task disappears entirely.

**Grouping** — by project, by date, by tag, by context (@home, @computer). Grouping defines the mental model.

**Ordering** — manual drag-and-drop, auto-sort by due date, smart priority ordering, or fixed sprint order.

---

## POC approach

Build each pattern as a self-contained React component that reads from the same `vault/todos/` folder. The underlying data never changes — only the view does. This keeps the comparison honest.

Sequence:

1. iPhone Reminders style — simplest, establish the baseline
2. Things 3 style — add hierarchy and the Today/Upcoming buckets
3. Todoist style — add priority flags and NLP capture input
4. Acunote style — add sprint container and burndown
5. Outline style — replace task model with node model
6. Linear style — add status columns and triage view

Evaluate each against: speed of capture, ease of finding what to work on next, and how well it handles the nested project-linked tasks todoz needs.

---

## Success criteria

The right pattern makes it obvious — without thinking — what to work on right now.

---

## POC status

Build: 6 patterns + shared data layer + pattern picker, all test-first. `npm test` → 69 tests pass. `npx tsc -b` clean. `npm run dev` serves on http://localhost:5173 (Vite HMR, fixtures loaded via `import.meta.glob` from `test/fixtures/vault/todos/`).

**Browser smoke not visually verified** — HTML and JS bundle serve without errors, but the agent cannot open the page in a real browser. Open `npm run dev` in a browser and click each pattern tab to evaluate the interaction model.

Known POC gaps:
- Toggle/status/create operations mutate in-memory `Task[]`, not the source markdown. `toggleTask` (markdown serializer, fully tested) is wired up only in unit tests; the browser app skips disk persistence.
- No drag-and-drop, no keyboard shortcuts, no Today auto-detect on Acunote, no animation when checking items.
- Capture input only implemented for Todoist. Other patterns evaluate the *display/find-next* axis only.
- Sprint id and "today" are hard-coded in `main.tsx` (`2026-w19`, current date).
