# todoz — TODO-POC

The single UI to build for the technical POC: a nested todo list on the start page.

The goal is not to evaluate UI patterns. The goal is to prove the full stack works end-to-end — Electron boots, reads real markdown files, renders tasks, toggles write back to disk, and the AI agent can verify all of it from a screenshot without human help.

---

## What to build

A single screen. No navigation, no sidebar, no tabs.

The screen shows all tasks loaded from `test/fixtures/vault/todos/`. Tasks are rendered as a flat list ordered by `due` date (earliest first, undated last). Each task that has subtasks in its body renders them indented beneath it.

### Elements required

| Element | `data-*` attribute | Notes |
|---|---|---|
| Root container | `data-view="todo-list"` | Mounts on `<body>` |
| Task item | `data-task="<slug>"` | Slug is the filename without date and extension |
| Task checkbox | — | `<input type="checkbox">` inside the task item |
| Task title | `data-task-title` | Text from frontmatter `title` |
| Task due date | `data-task-due` | ISO date string, omitted if no due date |
| Subtask list | `data-subtasks` | Wraps all subtask rows for a task |
| Subtask item | `data-subtask="<index>"` | Zero-based index within the parent task |
| Subtask checkbox | — | `<input type="checkbox">` inside the subtask item |
| Subtask label | `data-subtask-label` | Text of the subtask checkbox line |

### Interaction

- Clicking a task checkbox toggles `status: todo ↔ done` in the frontmatter and `- [ ] ↔ - [x]` on the first body line, then writes the file back to disk via `window.todoz.writeFile()`
- Clicking a subtask checkbox toggles its `- [ ] ↔ - [x]` line in the body and writes the file back
- No optimistic UI required — a 200 ms delay before re-render is acceptable

### What it does not do

- No sidebar
- No tag filtering
- No search
- No drag-and-drop
- No inline editing
- No Ollama calls (that is wired up in the IPC bridge but not exercised by this screen)

---

## Acceptance criteria

1. Given fixture files exist in `test/fixtures/vault/todos/`, when the app loads, then every task title appears on screen in due-date order.
2. Given a task has subtasks in its body, when the app loads, then the subtasks are rendered indented beneath the parent task.
3. Given a task checkbox is unchecked, when the user clicks it, then the checkbox becomes checked and the fixture file on disk is updated to `status: done`.
4. Given a subtask checkbox is unchecked, when the user clicks it, then the checkbox becomes checked and the corresponding `- [ ]` line in the file becomes `- [x]`.
5. Given a task has a `due` date, when the app loads, then the due date is visible next to the task title.

---

## Fixtures required

Three fixture files covering the acceptance criteria:

**`test/fixtures/vault/todos/call-dentist-2026-05-04.md`**
```markdown
---
type: task
title: "Call dentist"
status: todo
due: 2026-05-10
tags: [personal]
created: 2026-05-04
---
- [ ] Book appointment
- [ ] Check insurance coverage
```

**`test/fixtures/vault/todos/q2-report-2026-05-04.md`**
```markdown
---
type: task
title: "Q2 report"
status: todo
due: 2026-06-01
tags: [work, q2]
created: 2026-05-04
---
- [ ] Collect numbers from analytics
  - [ ] Page views
  - [ ] Conversion rate
- [ ] Write executive summary
```

**`test/fixtures/vault/todos/read-anthropic-paper-2026-05-04.md`**
```markdown
---
type: task
title: "Read Anthropic paper"
status: todo
tags: [reading]
created: 2026-05-04
---
- [ ] Read and take notes
```

---

## Verify findings

_Filled in by the Verify agent after the pattern is confirmed green._
