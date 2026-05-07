# todoz — technical POC

Validate the right desktop stack and UI pattern before building the full app. The primary design constraint is a closed AI feedback loop: the AI agent that writes the code must be able to run it, see it, and verify it without human intervention.

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
| Frontmatter parsing | `gray-matter` | handles YAML frontmatter in markdown, Node.js |
| File watching | `chokidar` | reliable fs watcher, triggers renderer refresh |
| Ollama | `child_process.spawn` | run Ollama from main process, stream output to renderer |
| Test driver | Playwright (`_electron`) | launches real Electron app, drives it, screenshots it |
| Visual assertion | Claude vision API | inspects screenshots, returns structured pass/fail |

---

## Architecture

Three TypeScript files form the Electron skeleton:

**`src/main.ts`** — Node.js main process. Creates the browser window, handles IPC calls from the renderer, owns all file system and Ollama operations.

**`src/preload.ts`** — bridge. Uses `contextBridge` to expose a safe `window.todoz` API to the renderer. The renderer never touches Node.js APIs directly.

**`src/renderer/index.ts`** — browser context. Reads tasks via `window.todoz.readTodos()`, renders the active UI pattern, calls `window.todoz.writeFile()` on toggle.

```
src/
  main.ts              Node.js — window, IPC handlers, fs, Ollama
  preload.ts           contextBridge — exposes todoz API to renderer
  renderer/
    index.html
    index.ts           pattern picker, mounts active pattern
    patterns/
      reminders.ts
      things.ts
      todoist.ts
      acunote.ts
      outline.ts
      linear.ts
    data/
      parseTodo.ts      gray-matter + checkbox parser → Task[]
      writeTodo.ts      toggle checkbox in raw markdown string
test/
  fixtures/
    vault/
      todos/            hand-written .md files matching AGENTS.md schema
  screenshots/          written by Playwright during test runs
  patterns/
    reminders.spec.ts
    things.spec.ts
    ...
  vision.ts             shared helper — screenshot → Claude API → pass/fail
playwright.config.ts
tsconfig.json
package.json
```

---

## The feedback loop

```
Claude Code writes/edits source files
       ↓
npx playwright test
       ↓
Playwright launches Electron via electron.launch()
       ↓
Playwright drives the app — clicks, navigates, triggers actions
       ↓
Playwright screenshots the window → test/screenshots/<pattern>.png
       ↓
vision.ts sends screenshot to Claude API:
  "Does this show a Reminders-style todo list with a left sidebar
   showing lists with badge counts, and tasks grouped by date on the right?"
       ↓
Claude API returns { pass: true/false, reason: "..." }
       ↓
Playwright asserts pass === true
       ↓
Claude Code reads test output, fixes failures, repeats
```

---

## Vision assertion helper

```ts
// test/vision.ts
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'

const client = new Anthropic()

export async function assertScreenshot(
  screenshotPath: string,
  assertion: string
): Promise<{ pass: boolean; reason: string }> {
  const image = fs.readFileSync(screenshotPath).toString('base64')

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } },
        { type: 'text', text: `${assertion}\n\nReply with JSON only: {"pass": true/false, "reason": "one sentence"}` }
      ]
    }]
  })

  return JSON.parse((response.content[0] as { text: string }).text)
}
```

---

## Playwright + Electron setup

```ts
// test/patterns/reminders.spec.ts
import { test, expect, _electron as electron } from '@playwright/test'
import { assertScreenshot } from '../vision'
import fs from 'fs'
import path from 'path'

test('renders tasks grouped by tag with badge counts', async () => {
  const app = await electron.launch({ args: ['.'] })
  const window = await app.firstWindow()

  await window.waitForSelector('[data-pattern="reminders"]')
  const shot = 'test/screenshots/reminders-tasks.png'
  await window.screenshot({ path: shot })

  const result = await assertScreenshot(shot,
    'Does this show a sidebar with lists and badge counts on the left, ' +
    'and a flat task list grouped by date on the right?'
  )
  expect(result.pass, result.reason).toBe(true)
  await app.close()
})

test('toggles a task and writes to disk', async () => {
  const fixturePath = 'test/fixtures/vault/todos/call-dentist-2026-05-04.md'
  const before = fs.readFileSync(fixturePath, 'utf-8')
  expect(before).toContain('- [ ]')

  const app = await electron.launch({ args: ['.'] })
  const window = await app.firstWindow()
  await window.click('[data-task="call-dentist"] input[type="checkbox"]')
  await window.waitForTimeout(200) // allow write-back

  const after = fs.readFileSync(fixturePath, 'utf-8')
  expect(after).toContain('- [x]')

  // restore fixture
  fs.writeFileSync(fixturePath, before)
  await app.close()
})
```

---

## IPC bridge

```ts
// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('todoz', {
  readTodos:  ()           => ipcRenderer.invoke('read-todos'),
  writeFile:  (p, content) => ipcRenderer.invoke('write-file', p, content),
  runOllama:  (prompt)     => ipcRenderer.invoke('run-ollama', prompt),
})
```

```ts
// src/main.ts (IPC handlers)
import { ipcMain } from 'electron'
import fs from 'fs'
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
    const proc = spawn('ollama', ['run', 'gemma4:e2b', `${agentsMd}\n\n---\n\n${prompt}`])
    let out = ''
    proc.stdout.on('data', d => out += d)
    proc.on('close', () => resolve(out))
  })
})
```

---

## Build sequence

1. Scaffold Electron + TypeScript — `npm start` opens a window, Playwright can connect
2. Implement IPC bridge — `read-todos`, `write-file`, `run-ollama` all pass a manual smoke test
3. Wire up `parseTodo.ts` — Playwright loads fixture files, vision asserts task titles appear on screen
4. Build Reminders pattern — vision asserts sidebar + grouped list render correctly, toggle test passes
5. Build remaining patterns in `TODO-POC.md` order — each pattern green before the next starts
6. Evaluate manually — pick the winner, note it in `TODO-POC.md`

---

## Out of scope

- Code signing, packaging, Mac App Store
- Google Drive sync (vault path hardcoded to fixture folder)
- Bookmarks, goals, notes, editor
- Semantic search, embeddings
- Browser extension
- Styling beyond what is needed to evaluate the interaction model
