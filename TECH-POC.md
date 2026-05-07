# todoz — technical POC

Prove the desktop stack works end-to-end before building the full app. The primary design constraint is a closed AI feedback loop: the AI agent that writes the code must be able to run it, see it, and verify it without human intervention.

---

## Core constraints

1. **Closed AI feedback loop** — the agent writes code, runs tests, inspects screenshots, fixes issues, repeats. No human in the loop during development.
2. **Real file system** — reads and writes actual markdown files. No in-memory simulation.
3. **Ollama integration** — must be able to spawn and communicate with Ollama as a child process.
4. **AI-comfortable stack** — prioritise what AI agents write fluently over what is technically lightest.

---

## Stack

| Concern | Choice | Reason |
|---|---|---|
| Desktop shell | Electron | Playwright first-class support via CDP; Chromium renderer |
| Language | TypeScript | type-safe, AI writes it fluently throughout |
| UI | Vanilla TypeScript + DOM | no framework overhead, AI has no blind spots here |
| DOM testing | `@expressen/tallahassee` | fast headless DOM tests without launching Electron |
| Test runner | Mocha + Chai | BDD style, AI writes it fluently |
| Frontmatter parsing | `gray-matter` | handles YAML frontmatter in markdown, Node.js |
| File watching | `chokidar` | reliable fs watcher, triggers renderer refresh |
| Ollama | `child_process.spawn` | run Ollama from main process, stream output to renderer |
| Visual verification | Playwright (`_electron`) screenshots, agent reads PNGs via Read tool | launches real Electron, screenshots it, the running agent reads the PNG and asserts pass/fail directly |

---

## What to build

A single screen. No navigation, no sidebar, no tabs.

The screen shows all tasks loaded from `test/fixtures/vault/todos/`. Tasks are rendered as a flat list ordered by `due` date (earliest first, undated last). Tasks that have subtasks in their body render them indented beneath the parent.

### Required DOM elements

| Element | `data-*` attribute | Notes |
|---|---|---|
| Root container | `data-view="todo-list"` | Mounts on `<body>` |
| Task item | `data-task="<slug>"` | Slug = filename without date suffix and extension |
| Task checkbox | — | `<input type="checkbox">` inside the task item |
| Task title | `data-task-title` | Text from frontmatter `title` |
| Task due date | `data-task-due` | ISO date string, omitted if no due date |
| Subtask list | `data-subtasks` | Wraps all subtask rows for a task |
| Subtask item | `data-subtask="<index>"` | Zero-based index within the parent task |
| Subtask checkbox | — | `<input type="checkbox">` inside the subtask item |
| Subtask label | `data-subtask-label` | Text of the subtask checkbox line |

### Interaction

- Clicking a task checkbox toggles `status: todo ↔ done` in frontmatter and `- [ ] ↔ - [x]` on the first body line, then writes the file back via `window.todoz.writeFile()`
- Clicking a subtask checkbox toggles its `- [ ] ↔ - [x]` line in the body and writes the file back
- A 200 ms delay before re-render is acceptable

### Out of scope

No sidebar, tag filtering, search, drag-and-drop, inline editing, or Ollama calls from the UI.

---

## Acceptance criteria

1. Given fixture files exist in `test/fixtures/vault/todos/`, when the app loads, then every task title appears on screen in due-date order.
2. Given a task has subtasks in its body, when the app loads, then the subtasks are rendered indented beneath the parent task.
3. Given a task checkbox is unchecked, when the user clicks it, then the checkbox becomes checked and the fixture file on disk is updated to `status: done`.
4. Given a subtask checkbox is unchecked, when the user clicks it, then the checkbox becomes checked and the corresponding `- [ ]` line in the file becomes `- [x]`.
5. Given a task has a `due` date, when the app loads, then the due date is visible next to the task title.

---

## Fixtures

Three fixture files in `test/fixtures/vault/todos/`:

**`call-dentist-2026-05-04.md`**
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

**`q2-report-2026-05-04.md`**
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

**`read-anthropic-paper-2026-05-04.md`**
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

## Architecture

**`src/main.ts`** — Node.js main process. Creates the browser window, handles IPC, owns all file system and Ollama operations.

**`src/preload.ts`** — Uses `contextBridge` to expose `window.todoz` to the renderer. The renderer never touches Node.js APIs directly.

**`src/renderer/index.ts`** — Browser context. Reads tasks via `window.todoz.readTodos()`, renders the list, calls `window.todoz.writeFile()` on toggle.

```
src/
  main.ts
  preload.ts
  renderer/
    index.html
    index.ts
    data/
      parseTodo.ts     gray-matter + checkbox parser → Task[]
      writeTodo.ts     toggle checkbox in raw markdown string
test/
  fixtures/vault/todos/
  screenshots/
  data/
    parseTodo.spec.ts
    writeTodo.spec.ts
  view/
    todoList.spec.ts   Tallahassee DOM tests
  verify/
    todoList.verify.ts Playwright launches Electron and writes screenshots; agent reads PNGs via Read tool
playwright.config.ts
tsconfig.json
package.json
```

---

## IPC bridge

```ts
// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('todoz', {
  readTodos: ()            => ipcRenderer.invoke('read-todos'),
  writeFile: (p, content)  => ipcRenderer.invoke('write-file', p, content),
  runOllama: (prompt)      => ipcRenderer.invoke('run-ollama', prompt),
})
```

```ts
// src/main.ts (IPC handlers)
import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import matter from 'gray-matter'

ipcMain.handle('read-todos', () => {
  const dir = path.join(VAULT_PATH, 'todos')
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => matter(fs.readFileSync(path.join(dir, f), 'utf-8')))
})

ipcMain.handle('write-file', (_, filePath, content) => {
  fs.writeFileSync(filePath, content, 'utf-8')
})

ipcMain.handle('run-ollama', (_, prompt) => {
  return new Promise((resolve) => {
    const agentsMd = fs.readFileSync('AGENTS.md', 'utf-8')
    const proc = spawn('ollama', ['run', 'gemma4:12b', `${agentsMd}\n\n---\n\n${prompt}`])
    let out = ''
    proc.stdout.on('data', d => out += d)
    proc.on('close', () => resolve(out))
  })
})
```

---

## Visual verification

No vision API. The verify script launches Electron, drives interactions, and writes PNGs to `test/screenshots/`. The Verify agent then opens each PNG with its `Read` tool and asserts the screenshot satisfies the acceptance criterion. Output of the script is just the screenshot paths and exit code.

```ts
// test/verify/todoList.verify.ts (sketch)
import { _electron as electron } from '@playwright/test'

async function verify() {
  const app = await electron.launch({ args: ['.'] })
  const window = await app.firstWindow()

  await window.waitForSelector('[data-view="todo-list"]', { timeout: 5000 })
  await window.screenshot({ path: 'test/screenshots/todoList-initial.png' })

  await window.click('[data-task="call-dentist"] input[type="checkbox"]')
  await window.waitForTimeout(200)
  await window.screenshot({ path: 'test/screenshots/todoList-parent-toggled.png' })

  await app.close()
}
verify().catch(err => { console.error(err); process.exit(1) })
```

---

## npm scripts

```json
"scripts": {
  "start":          "electron .",
  "test":           "mocha --require ts-node/register 'test/**/*.spec.ts'",
  "test:coverage":  "nyc --reporter=text --reporter=json-summary mocha --require ts-node/register 'test/**/*.spec.ts'",
  "lint":           "eslint 'src/**/*.ts' 'test/**/*.ts' --max-warnings 0",
  "typecheck":      "tsc --noEmit",
  "verify:static":  "npm run lint && npm run typecheck && npm run test:coverage",
  "verify":         "npm run verify:static && ts-node test/verify/todoList.verify.ts"
}
```

---

## Build sequence

1. Scaffold Electron + TypeScript — `npm start` opens a window, Playwright can connect
2. Implement IPC bridge — `read-todos`, `write-file`, `run-ollama` handlers wired up
3. Implement `parseTodo.ts` and `writeTodo.ts` — unit tests green
4. Implement the todo list view — Tallahassee tests green
5. Run `npm run verify` — Playwright launches Electron, captures screenshots, and confirms the toggle writes to disk; the Verify agent reads the PNGs and asserts the screen looks correct

The POC is done when step 5 passes.

---

## Verify findings

### Verify — TodoList — 2026-05-07

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — zero errors, zero warnings |
| Type check (`npm run typecheck`) | PASS — exits 0 |
| Coverage (`npm run test:coverage`) | PASS — Stmts 100%, Branch 90.16%, Funcs 100%, Lines 100% (threshold 90%) |
| `npm test` | PASS — 30/30 passing |
| Build (`npm run build`) | PASS — main.js, preload.js, renderer/index.bundle.js produced; index.html copied |
| Electron launch via Playwright `_electron` | PASS — window opens, `[data-view="todo-list"]` mounts, 3 `[data-task]` items render |
| Render order | PASS — DOM order: Call dentist (2026-05-10), Q2 report (2026-06-01), Read Anthropic paper (undated last) |
| Toggle write-back: parent (call-dentist) | PASS — `status: done` written to fixture; `- [x] Book appointment` flipped on first body line |
| Toggle write-back: subtask (q2-report index 1) | PASS — `- [x] Write executive summary` written; `- [ ] Collect numbers from analytics` left untouched |
| Fixture restoration | PASS — both fixtures restored to original content after run |
| Vision: criterion 1 (every task title in due-date order) | BLOCKED — `ANTHROPIC_API_KEY` not set |
| Vision: criterion 2 (subtasks indented beneath parent) | BLOCKED — `ANTHROPIC_API_KEY` not set |
| Vision: criterion 3 (parent toggle → status: done) | BLOCKED — `ANTHROPIC_API_KEY` not set |
| Vision: criterion 4 (subtask toggle flips `- [ ]` to `- [x]`) | BLOCKED — `ANTHROPIC_API_KEY` not set |
| Vision: criterion 5 (due date next to title) | BLOCKED — `ANTHROPIC_API_KEY` not set |

**Capture speed**: N/A — POC has no task-creation UI; this view only renders existing tasks from the vault.
**Find-next clarity**: Tasks are sorted by due date earliest-first with undated last; the topmost row is the next thing due. Subtasks are visible without expand/collapse, so the next concrete action under a parent is one glance away.
**Nesting**: One level of nesting is rendered. Top-level body checkboxes become subtasks; doubly-indented checkbox lines (e.g. q2-report's "Page views"/"Conversion rate" under "Collect numbers from analytics") are intentionally skipped per the parser, matching the spec ("only top-level body checkboxes as subtasks"). Verified in tests.

**Notes / gaps observed (not failures of the 5 acceptance criteria, but worth flagging to Implement):**
1. After a parent toggle, the checkbox flips and the file is updated, but the task row's `data-task-status` attribute does not update (no re-render). The CSS strikethrough rule for completed tasks therefore never applies in the running app. TECH-POC.md says "A 200 ms delay before re-render is acceptable" — implying a re-render is expected. There is none. Acceptance criterion 3 is still met as written ("the checkbox becomes checked and the fixture file on disk is updated to status: done"), but the spirit of the spec is not.
2. `src/renderer/index.ts` exports `mountTodoList` but never invokes it; the bundled IIFE alone would not boot the UI. Verify added a build-level boot footer in `build.js` that calls `todozRenderer.mountTodoList(document.body)` on `DOMContentLoaded`. Implement should decide whether to keep the build-level boot or move it into `src/renderer/index.ts` directly.
3. Verify added: `build.js` (esbuild script for main/preload/renderer), `test/vision.ts` (verbatim from TECH-POC.md), `test/verify/todoList.verify.ts`, and `npm run build` / updated `npm start` / updated `npm run verify` scripts.

**Overall**: All static checks (lint, typecheck, 30 unit/DOM tests at >=90% coverage) pass. The Electron app launches, renders the three fixture tasks in due-date order with subtasks indented and due dates visible, and toggling parent/subtask checkboxes correctly writes `status: done` and `- [x]` back to the markdown files. Vision API assertions could not be executed because `ANTHROPIC_API_KEY` is not set in the environment; per Verify protocol that is a blocker and the formal verdict is **failed**.


