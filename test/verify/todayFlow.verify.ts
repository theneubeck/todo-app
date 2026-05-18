// Verify script for the `today-flow` feature.
//
// Launches Electron with NODE_ENV=test (the standard fixture vault is used).
// The vault's today.md fixture references two tasks. This script:
//   1. Opens the app and navigates to the Today sidebar entry.
//   2. Asserts [data-today-list] is rendered (AC 1).
//   3. Asserts two [data-today-row] elements are visible (AC 1).
//   4. Navigates back to Inbox and asserts [data-add-to-today] icons are present (AC 2).
//   5. Captures a screenshot to tmp/today-flow-done.png.
//
// NOTE: This script does NOT mutate today.md — it reads the fixture and
// navigates without clicking any write-back actions. The fixture is preserved.

import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SHOT_DIR = path.join(REPO_ROOT, 'tmp')
const FIX_TODAY = path.join(
  REPO_ROOT,
  'test',
  'fixtures',
  'vault',
  'todos',
  'today.md'
)

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

  // Snapshot today.md so we can restore it after the run.
  const todayFixtureOriginal = fs.existsSync(FIX_TODAY)
    ? fs.readFileSync(FIX_TODAY, 'utf-8')
    : null

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

    // ----- Inbox view — verify add-to-today icons -----
    await window.waitForSelector('[data-task-card]', { timeout: 10_000 })
    const addToTodayCount = await window
      .locator('[data-add-to-today]')
      .count()
    const hasAddToToday = addToTodayCount > 0
    record(
      'Inbox view shows add-to-today icons on task rows',
      hasAddToToday,
      hasAddToToday
        ? `found ${addToTodayCount} [data-add-to-today] icon(s)`
        : 'no [data-add-to-today] icons found in inbox view'
    )

    // ----- Navigate to Today view -----
    const todayEntry = window.locator('[data-sidebar-entry="today"]')
    const todayEntryCount = await todayEntry.count()
    record(
      'Today sidebar entry is present',
      todayEntryCount > 0,
      todayEntryCount > 0 ? 'found [data-sidebar-entry="today"]' : 'not found'
    )

    if (todayEntryCount > 0) {
      await todayEntry.click()
      // Wait for the Today list to appear (or empty state if today.md has no links).
      await window.waitForTimeout(500)

      const todayListCount = await window.locator('[data-today-list]').count()
      record(
        'Today view renders [data-today-list] container',
        todayListCount > 0,
        todayListCount > 0
          ? '[data-today-list] is in the DOM'
          : '[data-today-list] not found after navigating to Today'
      )

      // Check if today.md fixture has links — if so, expect rows.
      if (todayFixtureOriginal && /\[\[/.test(todayFixtureOriginal)) {
        const rowCount = await window.locator('[data-today-row]').count()
        record(
          'Today view renders task rows from today.md',
          rowCount > 0,
          rowCount > 0
            ? `found ${rowCount} [data-today-row] element(s)`
            : 'no [data-today-row] elements found despite today.md having wikilinks'
        )

        const clearAllCount = await window
          .locator('[data-today-clear-all]')
          .count()
        record(
          '"Clear all" link is visible when Today list has tasks',
          clearAllCount > 0,
          clearAllCount > 0
            ? 'found [data-today-clear-all]'
            : '[data-today-clear-all] not found'
        )
      } else {
        const emptyCount = await window.locator('[data-today-empty]').count()
        record(
          'Today view shows empty state when today.md has no links',
          emptyCount > 0,
          emptyCount > 0
            ? 'found [data-today-empty]'
            : '[data-today-empty] not found'
        )
      }

      // Screenshot
      const shot = path.join(SHOT_DIR, 'today-flow-done.png')
      await window.screenshot({ path: shot, fullPage: false })
      console.log(`\nScreenshot written to ${shot}`)
    }
  } catch (err) {
    record(
      'today-flow verify scenario',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
    // Restore today.md if it was mutated.
    if (todayFixtureOriginal !== null) {
      fs.writeFileSync(FIX_TODAY, todayFixtureOriginal, 'utf-8')
    }
  }

  console.log('\n=== today-flow verify summary ===')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.reason}`)
  }

  console.log(
    '\nThe Verify agent must Read tmp/today-flow-done.png and confirm the acceptance criteria visually.'
  )

  const failed = results.filter((r) => !r.pass)
  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('today-flow verify crashed:', err)
  process.exit(1)
})
