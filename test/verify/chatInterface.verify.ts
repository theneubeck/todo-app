// Verify script for the `chat-interface` feature.
//
// Launches Electron with NODE_ENV=test (window stays hidden), clicks the
// Chat sidebar entry, types "hello" in the command bar, and presses Enter.
// Asserts:
//   1. After clicking Chat, [data-chat-view] is present and [data-task-card]
//      is absent.
//   2. After pressing Enter, [data-message="user"] contains "hello".
//   3. A pending bubble [data-message="assistant"][data-pending] appears.
//   4. data-command-mode flips between "chat" (empty) and "command" (slash).
// Captures tmp/chatInterface-after-send.png at the pending state.
//
// Ollama may or may not be installed on the host; the pending state is the
// observable contract this feature owns. The actual Ollama response is out
// of scope for this verify — the renderer-side state is independent of the
// main-process spawn.
//
// Per the frozen plan in features/chat-interface/plan.md.

import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SHOT_DIR = path.join(REPO_ROOT, 'tmp')
const MAIN_ENTRY = path.join(REPO_ROOT, 'dist', 'main.js')

type Result = { name: string; pass: boolean; reason: string }
const results: Result[] = []
function record(name: string, pass: boolean, reason: string): void {
  results.push({ name, pass, reason })
  const tag = pass ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${name}: ${reason}`)
}

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  if (!fs.existsSync(MAIN_ENTRY)) {
    console.error(`dist/main.js missing — did you run \`npm run build\`?`)
    process.exit(1)
  }

  // Use a tmp userData dir + tmp vault to avoid contaminating committed state.
  const tmpUserData = fs.mkdtempSync(
    path.join(os.tmpdir(), 'todoz-chat-userdata-')
  )
  const tmpVault = path.join(tmpUserData, 'vault')
  fs.mkdirSync(path.join(tmpVault, 'todos'), { recursive: true })
  fs.writeFileSync(
    path.join(tmpUserData, 'vault-config.json'),
    JSON.stringify({ lastOpened: tmpVault, recents: [tmpVault] }),
    'utf-8'
  )

  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      args: [MAIN_ENTRY, `--user-data-dir=${tmpUserData}`],
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('[data-command-bar]', { timeout: 10_000 })

    // ---- (1) Click the Chat sidebar entry ----
    await window.locator('[data-sidebar-entry="chat"]').click()
    await window.waitForSelector('[data-chat-view]', {
      state: 'attached',
      timeout: 5_000,
    })

    const chatView = await window.locator('[data-chat-view]').count()
    record(
      'AC1: [data-chat-view] is present after clicking Chat',
      chatView === 1,
      `count = ${chatView}`
    )

    const taskCard = await window.locator('[data-task-card]').count()
    record(
      'AC1: [data-task-card] is hidden / absent in chat view',
      taskCard === 0,
      `count = ${taskCard}`
    )

    // ---- (2) Mode detection ----
    const inputSelector = '[data-command-bar] input[type="text"]'
    const inputLocator = window.locator(inputSelector)
    await inputLocator.click()
    await inputLocator.type('hello', { delay: 5 })

    const modeChat = await window
      .locator('[data-command-bar]')
      .getAttribute('data-command-mode')
    record(
      'AC5: data-command-mode === "chat" when input does not start with /',
      modeChat === 'chat',
      `mode = ${modeChat}`
    )

    // Now type a leading / and check mode flips to command — clear and retype.
    await inputLocator.fill('')
    await inputLocator.type('/add x', { delay: 5 })
    const modeCmd = await window
      .locator('[data-command-bar]')
      .getAttribute('data-command-mode')
    record(
      'AC6: data-command-mode === "command" when input starts with /',
      modeCmd === 'command',
      `mode = ${modeCmd}`
    )

    // Restore "hello" and press Enter to send a chat message.
    await inputLocator.fill('')
    await inputLocator.type('hello', { delay: 5 })
    await inputLocator.press('Enter')

    // Wait for the user bubble to appear.
    await window.waitForSelector('[data-message="user"] [data-message-text]', {
      state: 'attached',
      timeout: 5_000,
    })

    const userText = await window
      .locator('[data-message="user"] [data-message-text]')
      .textContent()
    record(
      'AC2: user bubble shows the submitted text',
      userText?.trim() === 'hello',
      `user bubble text = "${userText ?? '(null)'}"`
    )

    const pending = await window
      .locator('[data-message="assistant"][data-pending]')
      .count()
    record(
      'AC2: pending assistant bubble appears below the user bubble',
      pending >= 1,
      `pending bubble count = ${pending}`
    )

    const shot = path.join(SHOT_DIR, 'chatInterface-after-send.png')
    await window.screenshot({ path: shot, fullPage: true })
    console.log(`Screenshot captured at ${shot}`)
  } catch (err) {
    record(
      'chat-interface verify scenario',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  }

  console.log('\n=== chat-interface verify summary ===')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.reason}`)
  }
  const failed = results.filter((r) => !r.pass)
  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('chat-interface verify crashed:', err)
  process.exit(1)
})
