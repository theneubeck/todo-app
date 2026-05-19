// Verify script for the `set-due-date` feature.
//
// Launches Electron with NODE_ENV=test (the standard fixture vault is used).
// This script:
//   1. Boots Electron and waits for [data-task-row] to be visible.
//   2. Checks that [data-set-due] is present on a task row.
//   3. Hovers a task row to reveal [data-set-due].
//   4. Clicks [data-set-due].
//   5. Takes a screenshot to tmp/set-due-date-icon.png.

import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SHOT_DIR = path.join(REPO_ROOT, 'tmp')

type Result = { name: string; pass: boolean; reason: string }
const results: Result[] = []

function record(name: string, pass: boolean, reason: string): void {
  results.push({ name, pass, reason })
  const tag = pass ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${name}: ${reason}`)
}

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  const mainEntry = path.join(REPO_ROOT, 'dist', 'main.js')
  if (!fs.existsSync(mainEntry)) {
    console.error(`dist/main.js missing — did you run \`npm run build\`?`)
    process.exit(1)
  }

  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      args: [mainEntry],
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('[data-app-shell]', { timeout: 10_000 })

    // Wait for task rows to load
    await window.waitForSelector('[data-task-row]', { timeout: 10_000 })

    // AC 2 — [data-set-due] is present on task rows
    const setDueCount = await window.locator('[data-set-due]').count()
    record(
      '[data-set-due] is present on task rows',
      setDueCount > 0,
      setDueCount > 0
        ? `found ${setDueCount} [data-set-due] element(s)`
        : '[data-set-due] not found in DOM'
    )

    // Hover the first task row to reveal the calendar icon
    const firstRow = window.locator('[data-task-row]').first()
    await firstRow.hover()
    await window.waitForTimeout(200)

    // Click the set-due button on the first task row
    const setDueBtn = window.locator('[data-set-due]').first()
    const btnCount = await setDueBtn.count()
    record(
      '[data-set-due] is clickable on first row',
      btnCount > 0,
      btnCount > 0 ? 'found [data-set-due] button' : '[data-set-due] not found'
    )

    if (btnCount > 0) {
      await setDueBtn.click()
      await window.waitForTimeout(300)

      // AC 3 — date input appears after click
      const inputCount = await window.locator('[data-due-input]').count()
      record(
        '[data-due-input] appears after clicking calendar icon',
        inputCount > 0,
        inputCount > 0 ? '[data-due-input] is present' : '[data-due-input] not found after click'
      )

      // Screenshot after clicking icon (input visible)
      const shot = path.join(SHOT_DIR, 'set-due-date-icon.png')
      await window.screenshot({ path: shot, fullPage: false })
      console.log(`\nScreenshot written to ${shot}`)
    }
  } catch (err) {
    record(
      'set-due-date verify scenario',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
  }

  console.log('\n=== set-due-date verify summary ===')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.reason}`)
  }

  console.log(
    '\nThe Verify agent must Read tmp/set-due-date-icon.png and confirm the acceptance criteria visually.'
  )

  const failed = results.filter((r) => !r.pass)
  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('set-due-date verify crashed:', err)
  process.exit(1)
})
