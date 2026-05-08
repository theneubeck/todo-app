import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const FIX_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'vault', 'todos')
const SHOT_DIR = path.join(REPO_ROOT, 'test', 'screenshots')

const FIXTURE_NAMES = [
  'call-dentist-2026-05-04.md',
  'pickup-package-2026-05-04.md',
  'q2-report-2026-05-04.md',
  'read-anthropic-paper-2026-05-04.md',
  'sync-with-mike-2026-05-04.md',
  'buy-milk-2026-05-08.md',
  'send-invoice-2026-05-08.md',
  'prep-deck-2026-05-08.md',
  'weekly-shop-2026-05-08.md',
] as const

function snapshotFixtures(): Map<string, string> {
  const map = new Map<string, string>()
  for (const name of FIXTURE_NAMES) {
    const p = path.join(FIX_DIR, name)
    if (fs.existsSync(p)) {
      map.set(p, fs.readFileSync(p, 'utf-8'))
    }
  }
  return map
}

function restoreFixtures(snap: Map<string, string>): void {
  for (const [p, content] of snap) {
    fs.writeFileSync(p, content, 'utf-8')
  }
}

type Result = { name: string; pass: boolean; reason: string }
const results: Result[] = []
function record(name: string, pass: boolean, reason: string): void {
  results.push({ name, pass, reason })
  const tag = pass ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${name}: ${reason}`)
}

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const fixtureSnap = snapshotFixtures()

  const screenshots: string[] = []

  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      args: [path.join(REPO_ROOT, 'dist', 'main.js')],
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    await window.waitForSelector('[data-view="todo-list"]', { timeout: 10_000 })
    await window.waitForSelector('[data-task]', { timeout: 5_000 })

    // ==========================================================
    // Criteria 1, 2, 3: initial render — affordance visible
    // beneath simple rows and after last subtask of expanded
    // combined rows; not visible on collapsed combined rows.
    // ==========================================================
    const shotInitial = path.join(SHOT_DIR, 'addSubtask-initial.png')
    await window.screenshot({ path: shotInitial, fullPage: true })
    screenshots.push(shotInitial)

    // Make sure prep-deck is visible — expand it for criterion 2/5.
    const prepDeckRowSel = '[data-task="prep-deck"]'
    await window.waitForSelector(prepDeckRowSel, { timeout: 5_000 })

    // Capture the collapsed-combined state (criterion 3).
    const prepDeckCollapsedAffordance = await window.$(`${prepDeckRowSel} [data-add-subtask]`)
    record(
      'criterion 3: collapsed combined task hides affordance',
      prepDeckCollapsedAffordance === null,
      prepDeckCollapsedAffordance === null
        ? 'no [data-add-subtask] under collapsed prep-deck'
        : 'an affordance was rendered on collapsed prep-deck'
    )

    // Click to expand — criterion 2.
    await window.click(`${prepDeckRowSel} [data-task-row]`)
    await window.waitForSelector(`${prepDeckRowSel}[data-expanded="true"]`, { timeout: 5_000 })
    await window.waitForSelector(`${prepDeckRowSel} [data-subtask-list] [data-add-subtask]`, {
      timeout: 5_000,
    })

    const shotExpanded = path.join(SHOT_DIR, 'addSubtask-prep-deck-expanded.png')
    await window.screenshot({ path: shotExpanded, fullPage: true })
    screenshots.push(shotExpanded)

    // ==========================================================
    // Criterion 4: Click → input replaces affordance, focused.
    // ==========================================================
    const buyMilkSel = '[data-task="buy-milk"]'
    await window.waitForSelector(`${buyMilkSel} [data-add-subtask]`, { timeout: 5_000 })
    await window.click(`${buyMilkSel} [data-add-subtask]`)
    await window.waitForSelector(`${buyMilkSel} [data-add-subtask-input]`, { timeout: 5_000 })

    const buyMilkAffordanceGone = await window.$(`${buyMilkSel} [data-add-subtask]`)
    const inputIsFocused = await window.evaluate(() => {
      const input = document.querySelector('[data-task="buy-milk"] [data-add-subtask-input]')
      return input !== null && document.activeElement === input
    })
    record(
      'criterion 4: click replaces affordance with input',
      buyMilkAffordanceGone === null,
      buyMilkAffordanceGone === null
        ? '[data-add-subtask] removed from buy-milk after click'
        : 'affordance still present alongside input'
    )
    record(
      'criterion 4: input is focused on mount',
      inputIsFocused,
      inputIsFocused ? 'document.activeElement === input' : 'input not focused'
    )

    const shotInputOpen = path.join(SHOT_DIR, 'addSubtask-buy-milk-input-open.png')
    await window.screenshot({ path: shotInputOpen, fullPage: true })
    screenshots.push(shotInputOpen)

    // ==========================================================
    // Criterion 7: Esc tears down, no file write
    // ==========================================================
    const milkFile = path.join(FIX_DIR, 'buy-milk-2026-05-08.md')
    const beforeEsc = fs.readFileSync(milkFile, 'utf-8')
    await window.keyboard.press('Escape')
    await window.waitForSelector(`${buyMilkSel} [data-add-subtask]`, { timeout: 5_000 })
    const inputAfterEsc = await window.$(`${buyMilkSel} [data-add-subtask-input]`)
    const afterEsc = fs.readFileSync(milkFile, 'utf-8')
    record(
      'criterion 7: Esc tears down input and restores affordance',
      inputAfterEsc === null,
      inputAfterEsc === null ? 'input removed; affordance restored' : 'input still present after Esc'
    )
    record(
      'criterion 7: Esc does not write to file',
      beforeEsc === afterEsc,
      beforeEsc === afterEsc ? 'file unchanged' : 'file content changed after Esc'
    )

    const shotAfterEsc = path.join(SHOT_DIR, 'addSubtask-after-esc.png')
    await window.screenshot({ path: shotAfterEsc, fullPage: true })
    screenshots.push(shotAfterEsc)

    // ==========================================================
    // Criterion 8: whitespace-only Enter cancels without write
    // ==========================================================
    const beforeWs = fs.readFileSync(milkFile, 'utf-8')
    await window.click(`${buyMilkSel} [data-add-subtask]`)
    await window.waitForSelector(`${buyMilkSel} [data-add-subtask-input]`, { timeout: 5_000 })
    await window.fill(`${buyMilkSel} [data-add-subtask-input]`, '   ')
    await window.keyboard.press('Enter')
    await window.waitForSelector(`${buyMilkSel} [data-add-subtask]`, { timeout: 5_000 })
    const inputAfterWs = await window.$(`${buyMilkSel} [data-add-subtask-input]`)
    const afterWs = fs.readFileSync(milkFile, 'utf-8')
    record(
      'criterion 8: whitespace-only Enter tears down input',
      inputAfterWs === null,
      inputAfterWs === null ? 'input removed; affordance restored' : 'input still present after ws-Enter'
    )
    record(
      'criterion 8: whitespace-only Enter does not write to file',
      beforeWs === afterWs,
      beforeWs === afterWs ? 'file unchanged' : 'file content changed after ws-Enter'
    )

    // ==========================================================
    // Criterion 5: Enter on combined task with text appends a
    // subtask line, renders new row, restores affordance.
    // ==========================================================
    const prepDeckFile = path.join(FIX_DIR, 'prep-deck-2026-05-08.md')
    const beforeAddCombined = fs.readFileSync(prepDeckFile, 'utf-8')
    // Scroll prep-deck into view; click affordance.
    await window.waitForSelector(
      `${prepDeckRowSel}[data-expanded="true"] [data-subtask-list] [data-add-subtask]`,
      { timeout: 5_000 }
    )
    await window.click(`${prepDeckRowSel} [data-subtask-list] [data-add-subtask]`)
    await window.waitForSelector(`${prepDeckRowSel} [data-add-subtask-input]`, { timeout: 5_000 })
    await window.fill(`${prepDeckRowSel} [data-add-subtask-input]`, 'draft outline')
    await window.keyboard.press('Enter')
    await window.waitForTimeout(300)
    // After Enter, render path runs again — wait for restored affordance plus new subtask.
    await window.waitForSelector(`${prepDeckRowSel} [data-subtask-list] [data-add-subtask]`, {
      timeout: 5_000,
    })

    const afterAddCombined = fs.readFileSync(prepDeckFile, 'utf-8')
    const combinedHasNewBullet = /- \[ \] draft outline/.test(afterAddCombined)
    record(
      'criterion 5: combined add appends "- [ ] draft outline" to file body',
      combinedHasNewBullet,
      combinedHasNewBullet
        ? 'file body now contains - [ ] draft outline'
        : `file body unchanged or wrong append:\n${afterAddCombined}`
    )

    const lastSubtaskTitle = await window.evaluate(() => {
      const list = document.querySelector('[data-task="prep-deck"] [data-subtask-list]')
      if (!list) return null
      const items = list.querySelectorAll('[data-subtask]')
      const last = items[items.length - 1]
      const title = last?.querySelector('[data-subtask-title]')
      return title?.textContent ?? null
    })
    record(
      'criterion 5: new subtask row appears at end of prep-deck list',
      lastSubtaskTitle === 'draft outline',
      lastSubtaskTitle === 'draft outline'
        ? `last subtask title === "draft outline"`
        : `last subtask title was "${lastSubtaskTitle}"`
    )

    const combinedAffordanceRestored = await window.$(`${prepDeckRowSel} [data-subtask-list] [data-add-subtask]`)
    record(
      'criterion 5: affordance restored beneath new subtask',
      combinedAffordanceRestored !== null,
      combinedAffordanceRestored !== null ? '[data-add-subtask] present after add' : 'affordance not restored'
    )

    const shotCombinedAfter = path.join(SHOT_DIR, 'addSubtask-prep-deck-after-add.png')
    await window.screenshot({ path: shotCombinedAfter, fullPage: true })
    screenshots.push(shotCombinedAfter)

    // Restore prep-deck before continuing.
    fs.writeFileSync(prepDeckFile, beforeAddCombined, 'utf-8')

    // ==========================================================
    // Criterion 6: Enter on simple task converts it to combined+expanded
    //   with one subtask and the affordance below it.
    // ==========================================================
    const beforeAddSimple = fs.readFileSync(milkFile, 'utf-8')
    await window.reload()
    await window.waitForSelector('[data-view="todo-list"]', { timeout: 10_000 })
    await window.waitForSelector(`${buyMilkSel} [data-add-subtask]`, { timeout: 5_000 })

    await window.click(`${buyMilkSel} [data-add-subtask]`)
    await window.waitForSelector(`${buyMilkSel} [data-add-subtask-input]`, { timeout: 5_000 })
    await window.fill(`${buyMilkSel} [data-add-subtask-input]`, 'buy stamps')
    await window.keyboard.press('Enter')
    await window.waitForTimeout(300)
    await window.waitForSelector(`${buyMilkSel}[data-kind="combined"][data-expanded="true"]`, {
      timeout: 5_000,
    })

    const milkAfterAdd = fs.readFileSync(milkFile, 'utf-8')
    const milkHasNewBullet = /- \[ \] buy stamps/.test(milkAfterAdd)
    record(
      'criterion 6: simple add appends "- [ ] buy stamps" to file body',
      milkHasNewBullet,
      milkHasNewBullet
        ? 'file body now contains - [ ] buy stamps'
        : `file body unchanged or wrong append:\n${milkAfterAdd}`
    )

    const milkBecameCombinedExpanded = await window.evaluate(() => {
      const node = document.querySelector(
        '[data-task="buy-milk"][data-kind="combined"][data-expanded="true"]'
      )
      return node !== null
    })
    record(
      'criterion 6: simple buy-milk row is now combined+expanded',
      milkBecameCombinedExpanded,
      milkBecameCombinedExpanded
        ? '[data-task="buy-milk"][data-kind="combined"][data-expanded="true"] exists'
        : 'buy-milk did not become combined+expanded'
    )

    const milkSubtasks = await window.evaluate(() => {
      const list = document.querySelector('[data-task="buy-milk"] [data-subtask-list]')
      if (!list) return null
      const items = Array.from(list.querySelectorAll('[data-subtask]'))
      const titles = items.map(
        (n) => n.querySelector('[data-subtask-title]')?.textContent ?? ''
      )
      return titles
    })
    record(
      'criterion 6: buy-milk subtask list contains exactly one row "buy stamps"',
      Array.isArray(milkSubtasks) && milkSubtasks.length === 1 && milkSubtasks[0] === 'buy stamps',
      Array.isArray(milkSubtasks)
        ? `subtasks: ${JSON.stringify(milkSubtasks)}`
        : 'no subtask list found'
    )

    const milkAffordanceBelow = await window.$(`${buyMilkSel} [data-subtask-list] [data-add-subtask]`)
    record(
      'criterion 6: affordance present beneath the new subtask',
      milkAffordanceBelow !== null,
      milkAffordanceBelow !== null ? 'affordance present at end of subtask list' : 'affordance missing'
    )

    const shotSimpleAfter = path.join(SHOT_DIR, 'addSubtask-buy-milk-converted.png')
    await window.screenshot({ path: shotSimpleAfter, fullPage: true })
    screenshots.push(shotSimpleAfter)

    // Restore buy-milk
    fs.writeFileSync(milkFile, beforeAddSimple, 'utf-8')
  } finally {
    if (app) await app.close().catch(() => undefined)
    restoreFixtures(fixtureSnap)
  }

  console.log('\n=== addSubtask verify summary ===')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.reason}`)
  }
  console.log('\nscreenshots written:')
  for (const s of screenshots) console.log(`  ${s}`)

  const failed = results.filter((r) => !r.pass)
  if (failed.length > 0) {
    console.error(`\n${failed.length} add-subtask check(s) failed`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('addSubtask verify script crashed:', err)
  process.exit(1)
})
