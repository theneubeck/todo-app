// Verify script for the `headless-test-mode` feature.
//
// Exercises the NODE_ENV-driven window-visibility branch end-to-end:
//   1. Launch Electron with NODE_ENV=test.
//      - Assert BrowserWindow.isVisible() === false (queried on the main process via app.evaluate).
//      - Assert [data-brand] reads "TODO" (offscreen render still produces correct DOM).
//      - Capture tmp/headlessTestMode-rendered.png.
//   2. Re-launch Electron with NODE_ENV unset (inverse case).
//      - Assert BrowserWindow.isVisible() === true.
//      - Close immediately (no screenshot — the inverse is "the window pops").
//
// Per the frozen plan in features/headless-test-mode/plan.md.

import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
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

async function readIsVisible(app: ElectronApplication): Promise<boolean> {
  return app.evaluate(({ BrowserWindow }) => {
    const wins = BrowserWindow.getAllWindows()
    if (wins.length === 0) return false
    return wins[0].isVisible()
  })
}

async function runHiddenCase(): Promise<void> {
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      args: [MAIN_ENTRY],
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('[data-brand]', { timeout: 8_000 })

    const visible = await readIsVisible(app)
    record(
      'AC1: BrowserWindow.isVisible() === false when NODE_ENV=test',
      visible === false,
      `got ${visible}`
    )

    const brand = (await window.textContent('[data-brand]'))?.trim()
    record(
      'AC3: offscreen renderer emits [data-brand] === "TODO" under NODE_ENV=test',
      brand === 'TODO',
      `got "${brand ?? '(null)'}"`
    )

    const shot = path.join(SHOT_DIR, 'headlessTestMode-rendered.png')
    await window.screenshot({ path: shot, fullPage: true })
    console.log(`Captured offscreen render screenshot at ${shot}`)
  } catch (err) {
    record(
      'AC1/AC3: NODE_ENV=test launch succeeds',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
  }
}

async function runVisibleCase(): Promise<void> {
  let app: ElectronApplication | undefined
  try {
    // Strip NODE_ENV from the inherited env so the main process boots in the
    // "production-like" branch. This sub-launch intentionally pops a real
    // window — that is the inverse assertion we are making — so we keep its
    // lifetime as short as possible to limit the visible flicker / dock bounce.
    const childEnv: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) {
      if (k === 'NODE_ENV') continue
      if (typeof v === 'string') childEnv[k] = v
    }

    app = await electron.launch({
      args: [MAIN_ENTRY],
      cwd: REPO_ROOT,
      env: childEnv,
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    const visible = await readIsVisible(app)
    record(
      'AC2: BrowserWindow.isVisible() === true when NODE_ENV is unset',
      visible === true,
      `got ${visible}`
    )
  } catch (err) {
    record(
      'AC2: NODE_ENV-unset launch succeeds',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
  }
}

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  if (!fs.existsSync(MAIN_ENTRY)) {
    console.error(
      `dist/main.js missing at ${MAIN_ENTRY} — did you run \`npm run build\`?`
    )
    process.exit(1)
  }

  await runHiddenCase()
  await runVisibleCase()

  console.log('\n=== headless-test-mode verify summary ===')
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
  console.error('headlessTestMode.verify script crashed:', err)
  process.exit(1)
})
