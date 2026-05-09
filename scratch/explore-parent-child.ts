/**
 * Exploration: drive every parent/child mutation path through the live
 * Electron app and capture screenshots + on-disk state at each step.
 * Reports any disagreement between parent state and child state.
 */

import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import path from 'path'

const REPO_ROOT = '/Users/jens.carlen/code/testing/vibing/todoz'
const FIX_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'vault', 'todos')
const SHOT_DIR = path.join(REPO_ROOT, 'test', 'screenshots', 'parent-child-bug')

const SLUG = 'bug-explore'
const TODAY = new Date().toISOString().slice(0, 10)
const FILE_NAME = `${SLUG}-${TODAY}.md`
const FILE_PATH = path.join(FIX_DIR, FILE_NAME)

type StateReport = {
  step: number
  label: string
  // Disk
  fileExists: boolean
  frontmatterStatus: string | null
  bodyLines: string[]
  // DOM
  parentCheckedAttr: string | null
  parentCompletedAttr: string | null
  subtasks: { index: number; title: string; checked: string | null; struck: boolean }[]
  // Diagnosis
  parentSaysComplete: boolean
  allSubtasksComplete: boolean | null
  match: 'agree' | 'disagree' | 'n/a'
  notes: string
}

const reports: StateReport[] = []

async function snapshotState(
  window: Page,
  step: number,
  label: string,
  notes: string = ''
): Promise<StateReport> {
  // Disk
  const fileExists = fs.existsSync(FILE_PATH)
  let frontmatterStatus: string | null = null
  let bodyLines: string[] = []
  if (fileExists) {
    const raw = fs.readFileSync(FILE_PATH, 'utf-8')
    const m = raw.match(/^status:\s*(\S+)/m)
    frontmatterStatus = m ? m[1] : null
    const fmEnd = raw.indexOf('\n---', 4)
    if (fmEnd >= 0) {
      const body = raw.slice(raw.indexOf('\n---', 4) + 4).trim()
      bodyLines = body
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
    }
  }

  // DOM (only if file exists and the row is rendered)
  const dom = await window.evaluate((slug: string) => {
    const row = document.querySelector(`[data-task="${slug}"]`)
    if (!row) return null
    const parentCheckedAttr =
      row.querySelector('[data-checked]')?.getAttribute('data-checked') ?? null
    const parentTitle = row.querySelector('[data-task-title], [data-title]')
    const parentCompletedAttr = parentTitle?.getAttribute('data-completed') ?? null
    const subItems = Array.from(row.querySelectorAll('[data-subtask]'))
    const subtasks = subItems.map((el) => {
      const idx = Number(el.getAttribute('data-subtask') ?? -1)
      const titleEl = el.querySelector('[data-subtask-title]')
      const title = titleEl?.textContent?.trim() ?? ''
      const cb = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null
      const checked = cb ? String(cb.checked) : null
      const struck = !!el.querySelector('[data-completed]')
      return { index: idx, title, checked, struck }
    })
    return { parentCheckedAttr, parentCompletedAttr, subtasks }
  }, SLUG)

  const parentSaysComplete =
    dom?.parentCheckedAttr === 'true' ||
    dom?.parentCompletedAttr === 'true' ||
    frontmatterStatus === 'done'

  let allSubtasksComplete: boolean | null = null
  if (dom && dom.subtasks.length > 0) {
    allSubtasksComplete = dom.subtasks.every((s) => s.checked === 'true')
  }

  let match: 'agree' | 'disagree' | 'n/a' = 'n/a'
  if (allSubtasksComplete !== null) {
    if (parentSaysComplete && !allSubtasksComplete) match = 'disagree'
    else if (!parentSaysComplete && allSubtasksComplete) match = 'disagree'
    else match = 'agree'
  }

  const report: StateReport = {
    step,
    label,
    fileExists,
    frontmatterStatus,
    bodyLines,
    parentCheckedAttr: dom?.parentCheckedAttr ?? null,
    parentCompletedAttr: dom?.parentCompletedAttr ?? null,
    subtasks: dom?.subtasks ?? [],
    parentSaysComplete,
    allSubtasksComplete,
    match,
    notes,
  }
  reports.push(report)

  // Screenshot
  const shot = path.join(SHOT_DIR, `${String(step).padStart(2, '0')}-${slugify(label)}.png`)
  await window.screenshot({ path: shot, fullPage: true })

  // Console log
  console.log(`\n=== Step ${step}: ${label} ===`)
  console.log(`  file: ${fileExists ? 'present' : 'absent'}`)
  console.log(`  frontmatter status: ${frontmatterStatus ?? '(n/a)'}`)
  console.log(`  body lines: ${JSON.stringify(bodyLines)}`)
  console.log(`  parent data-checked: ${dom?.parentCheckedAttr}`)
  console.log(`  parent data-completed: ${dom?.parentCompletedAttr}`)
  console.log(`  subtasks (DOM): ${JSON.stringify(dom?.subtasks)}`)
  console.log(`  parentSaysComplete: ${parentSaysComplete}`)
  console.log(`  allSubtasksComplete: ${allSubtasksComplete}`)
  console.log(`  → MATCH: ${match}`)
  if (match === 'disagree') {
    console.log(`  ⚠️  DISCREPANCY at step ${step}`)
  }

  return report
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function commandBarAdd(window: Page, text: string): Promise<void> {
  const input = '[data-command-bar] input[type="text"]'
  await window.click(input)
  await window.fill(input, text)
  await window.keyboard.press('Enter')
  await window.waitForTimeout(400)
}

async function clickAddSubtaskAffordance(window: Page, slug: string): Promise<void> {
  // Simple-task affordance lives directly under the row; combined-task lives
  // inside the subtask list. Try whichever is present.
  const rowSel = `[data-task="${slug}"]`
  await window.click(`${rowSel} [data-add-subtask]`)
  await window.waitForSelector(`${rowSel} [data-add-subtask-input]`, { timeout: 5_000 })
}

async function submitSubtaskInput(window: Page, slug: string, text: string): Promise<void> {
  const rowSel = `[data-task="${slug}"]`
  await window.fill(`${rowSel} [data-add-subtask-input]`, text)
  await window.keyboard.press('Enter')
  await window.waitForTimeout(400)
}

async function clickParentCheckbox(window: Page, slug: string): Promise<void> {
  const rowSel = `[data-task="${slug}"]`
  // The first checkbox under the row is the parent.
  const cbs = await window.$$(`${rowSel} input[type="checkbox"]`)
  if (cbs.length === 0) throw new Error(`no checkbox in ${rowSel}`)
  await cbs[0].click()
  await window.waitForTimeout(300)
}

async function clickSubtaskCheckbox(window: Page, slug: string, index: number): Promise<void> {
  const sel = `[data-task="${slug}"] [data-subtask="${index}"] input[type="checkbox"]`
  await window.click(sel)
  await window.waitForTimeout(300)
}

async function removeSubtaskByIndex(window: Page, slug: string, index: number): Promise<void> {
  const rowSel = `[data-task="${slug}"]`
  const subSel = `${rowSel} [data-subtask="${index}"]`
  // The subtask row may have a remove control. Try common selectors.
  const removeSel = `${subSel} [data-remove-subtask], ${subSel} [data-remove]`
  const removeBtn = await window.$(removeSel)
  if (!removeBtn) {
    // Fallback: click the row to surface its remove affordance, if there is one
    await window.click(subSel)
    await window.waitForTimeout(200)
    const removeBtn2 = await window.$(removeSel)
    if (!removeBtn2) {
      console.log(`  (no remove affordance on subtask ${index} — skipping)`)
      return
    }
    await removeBtn2.click()
  } else {
    await removeBtn.click()
  }
  // Some flows show a confirm prompt — answer "Yes" if present.
  const yesBtn = await window.$('[data-confirm-yes]')
  if (yesBtn) {
    await yesBtn.click()
  }
  await window.waitForTimeout(400)
}

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  // Clean any stale fixture from prior runs
  if (fs.existsSync(FILE_PATH)) {
    fs.unlinkSync(FILE_PATH)
  }
  // Also remove any other dated bug-explore variants
  for (const name of fs.readdirSync(FIX_DIR)) {
    if (name.startsWith(`${SLUG}-`)) {
      fs.unlinkSync(path.join(FIX_DIR, name))
    }
  }

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

    let step = 0

    // 1. Create a simple task
    step++
    await commandBarAdd(window, `/add ${SLUG}`)
    await window.waitForSelector(`[data-task="${SLUG}"]`, { timeout: 5_000 })
    await snapshotState(window, step, 'after /add (simple task created)')

    // 2. Add subtask "step 1"
    step++
    await clickAddSubtaskAffordance(window, SLUG)
    await submitSubtaskInput(window, SLUG, 'step 1')
    await snapshotState(window, step, 'after add subtask "step 1"')

    // 3. Add subtask "step 2"
    step++
    // After the previous add, the row converted to combined+expanded; the affordance
    // moves into the subtask list.
    await window.click(`[data-task="${SLUG}"] [data-subtask-list] [data-add-subtask]`)
    await window.waitForSelector(`[data-task="${SLUG}"] [data-add-subtask-input]`, { timeout: 5_000 })
    await submitSubtaskInput(window, SLUG, 'step 2')
    await snapshotState(window, step, 'after add subtask "step 2"')

    // 4. Check subtask 0 ("step 1")
    step++
    await clickSubtaskCheckbox(window, SLUG, 0)
    await snapshotState(window, step, 'after check subtask "step 1"')

    // 5. Check subtask 1 ("step 2") — now ALL subtasks complete; does parent agree?
    step++
    await clickSubtaskCheckbox(window, SLUG, 1)
    await snapshotState(window, step, 'after check subtask "step 2" (all children done)')

    // 6. Uncheck subtask 0 ("step 1") — does parent recover?
    step++
    await clickSubtaskCheckbox(window, SLUG, 0)
    await snapshotState(window, step, 'after uncheck subtask "step 1"')

    // 7. Toggle parent complete (manually)
    step++
    await clickParentCheckbox(window, SLUG)
    await snapshotState(window, step, 'after click parent checkbox (manual)')

    // 8. Try to remove subtask 0 ("step 1")
    step++
    await removeSubtaskByIndex(window, SLUG, 0)
    await snapshotState(window, step, 'after remove subtask "step 1"')

    // 9. Remove last remaining subtask
    step++
    await removeSubtaskByIndex(window, SLUG, 0) // index re-anchors after a delete
    await snapshotState(window, step, 'after remove last subtask')

    // 10. Now the task should be back to simple. Toggle parent complete.
    step++
    await clickParentCheckbox(window, SLUG)
    await snapshotState(window, step, 'after toggle parent of simple task')

    // 11. THE DEFERRED BUG: while parent is done, add a subtask
    step++
    await clickAddSubtaskAffordance(window, SLUG)
    await submitSubtaskInput(window, SLUG, 'after-done subtask')
    await snapshotState(
      window,
      step,
      'after add subtask while parent was done (deferred bug)',
      'subtask added to a task whose status was done — does the file/DOM reconcile?'
    )

    // 12. Toggle parent off and back on (final sanity)
    step++
    await clickParentCheckbox(window, SLUG)
    await snapshotState(window, step, 'after toggle parent off')

    step++
    await clickParentCheckbox(window, SLUG)
    await snapshotState(window, step, 'after toggle parent on with one undone subtask')
  } finally {
    if (app) await app.close()
  }

  // Final report
  console.log('\n\n========== SUMMARY ==========')
  let disagreeCount = 0
  for (const r of reports) {
    const tag = r.match === 'disagree' ? '⚠️  DISAGREE' : r.match === 'agree' ? '   agree  ' : '    n/a   '
    console.log(`  step ${String(r.step).padStart(2)} [${tag}] ${r.label}`)
    if (r.match === 'disagree') {
      disagreeCount++
      console.log(
        `        parent: ${r.parentCheckedAttr}/${r.parentCompletedAttr}; status=${r.frontmatterStatus}; subs=${r.subtasks
          .map((s) => `${s.title}=${s.checked}`)
          .join(', ')}`
      )
    }
  }
  console.log(`\nTotal disagreements: ${disagreeCount} / ${reports.length} steps`)

  // Cleanup the fixture file we created
  if (fs.existsSync(FILE_PATH)) fs.unlinkSync(FILE_PATH)
  for (const name of fs.readdirSync(FIX_DIR)) {
    if (name.startsWith(`${SLUG}-`)) fs.unlinkSync(path.join(FIX_DIR, name))
  }

  // Write a JSON report alongside the screenshots
  fs.writeFileSync(
    path.join(SHOT_DIR, 'report.json'),
    JSON.stringify(reports, null, 2),
    'utf-8'
  )
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
