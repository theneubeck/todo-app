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

### 2. iPhone Reminders (grouped flat list)
Dead simple. Lists on the left, tasks on the right. Tap to complete, swipe to reschedule. Groups by list/tag, no nesting beyond one level. The model works because it never fights you — capture is instant and completion feels satisfying.

Key traits: flat list, one-level grouping, large tap targets, badge counts per list.

### 3. Todoist (priority + natural language)
Tasks have priority levels (P1–P4) rendered as colour-coded flags. The input bar parses natural language — "call dentist tomorrow #personal p2" — directly into structured data. Today/Upcoming/Filters are the main views. No deep nesting but very fast to add.

Key traits: priority flags, NLP capture, today view, project sidebar.

### 4. Things 3 (areas → projects → tasks)
The cleanest Mac todo app. Three levels: Areas (life domains) → Projects → Tasks. "Today" and "Upcoming" are calendar-aware views that surface the right tasks at the right time. Headings inside projects create visual grouping without true nesting.

Key traits: three-tier hierarchy, Today/Upcoming/Anytime/Someday buckets, headings as visual separators.

### 5. Outline / Workflowy style
Everything is a node. Any node can be a task or a container. Zoom into any node to focus. Infinite nesting, no imposed hierarchy. Works well for thinking and planning but can get unwieldy for execution.

Key traits: infinite nesting, zoom/focus mode, bullet = everything, collapse/expand.

### 6. Linear (developer issue tracker style)
Issues live in cycles (sprints). Status columns (backlog / todo / in progress / done). Triage view for unsorted items. Very keyboard-driven, designed for rapid status changes. Feels like a project management tool more than a personal one.

Key traits: status-column model, cycle containers, triage/inbox, keyboard shortcuts for everything.

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
