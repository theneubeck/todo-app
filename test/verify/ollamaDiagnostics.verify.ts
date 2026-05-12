// Verify script for the `ollama-diagnostics` feature.
//
// Launches Electron with NODE_ENV=test (window stays hidden), monkey-patches
// window.todoz.runOllama in the renderer context to resolve with a failure
// result, drives a chat send via the command bar, and asserts:
//   1. The pending assistant bubble is gone after the failed resolve.
//   2. An [data-message="assistant"][data-error] bubble is present.
//   3. The error bubble's [data-message-text] equals the injected error string.
// Captures tmp/ollamaDiagnostics-error-bubble.png at the rendered failure state.
//
// Per the frozen plan in features/ollama-diagnostics/plan.md.

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

const ERROR_TEXT = 'Error: model "gemma4:12b" not found, try pulling it first'

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  if (!fs.existsSync(MAIN_ENTRY)) {
    console.error(`dist/main.js missing — did you run \`npm run build\`?`)
    process.exit(1)
  }

  // Use a tmp userData dir + tmp vault to avoid contaminating committed state.
  const tmpUserData = fs.mkdtempSync(
    path.join(os.tmpdir(), 'todoz-ollama-userdata-')
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

    // Override the `run-ollama` IPC handler in the main process so the
    // renderer's `await window.todoz.runOllama(...)` resolves with a
    // structured failure. The renderer's exposed `todoz` is a frozen
    // contextBridge proxy and cannot be monkey-patched from the renderer
    // side; substituting the handler in main is the supported seam.
    await app.evaluate(({ ipcMain }, errText: string) => {
      ipcMain.removeHandler('run-ollama')
      ipcMain.handle('run-ollama', async () => ({
        ok: false,
        error: errText,
        exitCode: 1,
      }))
    }, ERROR_TEXT)

    // Drive a chat send.
    const input = window.locator('[data-command-bar] input[type="text"]')
    await input.click()
    await input.type('what should I do', { delay: 5 })
    await input.press('Enter')

    // Wait for the error bubble to appear.
    await window.waitForSelector(
      '[data-message="assistant"][data-error] [data-message-text]',
      { state: 'attached', timeout: 5_000 }
    )

    const pendingCount = await window
      .locator('[data-message="assistant"][data-pending]')
      .count()
    record(
      'AC5: no pending assistant bubble remains after a failed resolve',
      pendingCount === 0,
      `pending count = ${pendingCount}`
    )

    const errorCount = await window
      .locator('[data-message="assistant"][data-error]')
      .count()
    record(
      'AC5: an [data-message="assistant"][data-error] bubble exists',
      errorCount === 1,
      `error bubble count = ${errorCount}`
    )

    const errorText = await window
      .locator('[data-message="assistant"][data-error] [data-message-text]')
      .textContent()
    record(
      'AC5: error bubble text equals the injected error string',
      errorText?.trim() === ERROR_TEXT,
      `text = "${errorText ?? '(null)'}"`
    )

    const shot = path.join(SHOT_DIR, 'ollamaDiagnostics-error-bubble.png')
    await window.screenshot({ path: shot, fullPage: true })
    console.log(`Screenshot captured at ${shot}`)
  } catch (err) {
    record(
      'ollama-diagnostics verify scenario',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  }

  console.log('\n=== ollama-diagnostics verify summary ===')
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
  console.error('ollama-diagnostics verify crashed:', err)
  process.exit(1)
})
