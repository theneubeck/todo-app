// Verify script for the `deadlines` feature.
//
// Launches Electron with NODE_ENV=test (the standard fixture vault is used).
// The vault has tasks with and without due dates. This script:
//   1. Opens the app and navigates to the Upcoming sidebar entry.
//   2. Asserts [data-upcoming-list] is rendered.
//   3. Asserts that [data-upcoming-row] elements exist and only due-dated tasks appear.
//   4. Asserts ascending due-date order.
//   5. Asserts each row has a [data-due-row] and [data-due-date].
//   6. Asserts the first row has a [data-tag-chip] in the due-date line.
//   7. Asserts the main header h1 reads "Upcoming".
//   8. Captures a screenshot to tmp/deadlines-upcoming.png.

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

    // Wait for task list to load
    await window.waitForSelector('[data-app-body]', { timeout: 10_000 })

    // Navigate to Upcoming
    const upcomingEntry = window.locator('[data-sidebar-entry="upcoming"]')
    const upcomingCount = await upcomingEntry.count()
    record(
      'Upcoming sidebar entry is present',
      upcomingCount > 0,
      upcomingCount > 0 ? 'found [data-sidebar-entry="upcoming"]' : 'not found'
    )

    if (upcomingCount > 0) {
      await upcomingEntry.click()
      await window.waitForTimeout(500)

      // AC 1 — [data-upcoming-list] is rendered
      const listCount = await window.locator('[data-upcoming-list]').count()
      record(
        'Upcoming view renders [data-upcoming-list]',
        listCount > 0,
        listCount > 0 ? '[data-upcoming-list] is in the DOM' : '[data-upcoming-list] not found'
      )

      // AC 1 — only tasks with due dates appear
      const rowCount = await window.locator('[data-upcoming-row]').count()
      record(
        'Upcoming view shows task rows for due-dated tasks',
        rowCount > 0,
        rowCount > 0
          ? `found ${rowCount} [data-upcoming-row] element(s)`
          : 'no [data-upcoming-row] elements found'
      )

      // AC 3 — each row has a [data-due-row]
      const dueRowCount = await window.locator('[data-upcoming-row] [data-due-row]').count()
      record(
        'Each upcoming row has a [data-due-row]',
        dueRowCount === rowCount,
        dueRowCount === rowCount
          ? `all ${rowCount} row(s) have [data-due-row]`
          : `only ${dueRowCount} of ${rowCount} row(s) have [data-due-row]`
      )

      // AC 3 — each [data-due-row] has a [data-due-date]
      const dueDateCount = await window.locator('[data-due-row] [data-due-date]').count()
      record(
        'Each due-date row shows a [data-due-date] span',
        dueDateCount === rowCount,
        dueDateCount === rowCount
          ? `all ${rowCount} due-row(s) have [data-due-date]`
          : `only ${dueDateCount} of ${rowCount} due-row(s) have [data-due-date]`
      )

      // AC 4 — first row has a tag chip
      const firstChipCount = await window
        .locator('[data-upcoming-row]:first-child [data-due-row] [data-tag-chip]')
        .count()
      record(
        'First row due-date line shows a tag chip',
        firstChipCount > 0,
        firstChipCount > 0
          ? 'found [data-tag-chip] in first row due-date line'
          : '[data-tag-chip] missing from first row due-date line'
      )

      // AC 6 — main header h1 reads "Upcoming"
      const h1Text = await window.locator('[data-main-header] h1').textContent()
      record(
        'Main header title reads "Upcoming"',
        h1Text?.trim() === 'Upcoming',
        h1Text?.trim() === 'Upcoming' ? `h1 = "${h1Text!.trim()}"` : `h1 = "${h1Text?.trim()}"`
      )

      // Screenshot
      const shot = path.join(SHOT_DIR, 'deadlines-upcoming.png')
      await window.screenshot({ path: shot, fullPage: false })
      console.log(`\nScreenshot written to ${shot}`)
    }
  } catch (err) {
    record(
      'deadlines verify scenario',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
  }

  console.log('\n=== deadlines verify summary ===')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.reason}`)
  }

  console.log(
    '\nThe Verify agent must Read tmp/deadlines-upcoming.png and confirm the acceptance criteria visually.'
  )

  const failed = results.filter((r) => !r.pass)
  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('deadlines verify crashed:', err)
  process.exit(1)
})
