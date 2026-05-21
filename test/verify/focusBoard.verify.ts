// Verify script for the `focus-board` feature.
//
// Launches Electron with NODE_ENV=test (the standard fixture vault is used).
// The fixture vault has a focuses.json file with two focuses (Work, Personal).
// This script:
//   1. Opens the app and verifies the Focus sidebar entry is present.
//   2. Clicks the Focus sidebar entry and checks [data-focus-board] is rendered.
//   3. Checks that focus cards are rendered.
//   4. Captures a screenshot to tmp/focus-board.png.

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

    // ----- Verify Focus sidebar entry -----
    const focusEntry = window.locator('[data-sidebar-entry="focus"]')
    const focusEntryCount = await focusEntry.count()
    record(
      'Focus sidebar entry is present',
      focusEntryCount > 0,
      focusEntryCount > 0
        ? 'found [data-sidebar-entry="focus"]'
        : '[data-sidebar-entry="focus"] not found'
    )

    if (focusEntryCount > 0) {
      await focusEntry.click()
      await window.waitForTimeout(500)

      // ----- Verify focus board rendered -----
      const boardCount = await window.locator('[data-focus-board]').count()
      record(
        'Focus board is rendered after clicking Focus sidebar entry',
        boardCount > 0,
        boardCount > 0
          ? '[data-focus-board] is in the DOM'
          : '[data-focus-board] not found after clicking Focus entry'
      )

      // ----- Check for focus cards (if focuses.json has fixtures) -----
      const focusesPath = path.join(REPO_ROOT, 'test', 'fixtures', 'vault', 'focuses.json')
      const hasFixtureFocuses = fs.existsSync(focusesPath)
      if (hasFixtureFocuses) {
        const cardCount = await window.locator('[data-focus-card]').count()
        record(
          'Focus cards are rendered from fixture focuses.json',
          cardCount > 0,
          cardCount > 0
            ? `found ${cardCount} [data-focus-card] element(s)`
            : 'no [data-focus-card] elements found despite fixture focuses.json existing'
        )
      } else {
        const emptyCount = await window.locator('[data-focus-empty]').count()
        record(
          'Focus board shows empty state when no focuses exist',
          emptyCount > 0,
          emptyCount > 0
            ? 'found [data-focus-empty]'
            : '[data-focus-empty] not found'
        )
      }

      // Screenshot
      const shot = path.join(SHOT_DIR, 'focus-board.png')
      await window.screenshot({ path: shot, fullPage: false })
      console.log(`\nScreenshot written to ${shot}`)
    }
  } catch (err) {
    record(
      'Electron app launched without error',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close()
  }

  const failCount = results.filter((r) => !r.pass).length
  console.log(
    `\n${results.length} checks: ${results.length - failCount} passed, ${failCount} failed`
  )
  process.exit(failCount > 0 ? 1 : 0)
}

void run()
