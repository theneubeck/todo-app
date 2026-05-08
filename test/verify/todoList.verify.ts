import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const FIX_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'vault', 'todos')
const SHOT_DIR = path.join(REPO_ROOT, 'test', 'screenshots')

const FIXTURE_NAMES = [
  'call-dentist-2026-05-04.md',
  'q2-report-2026-05-04.md',
  'read-anthropic-paper-2026-05-04.md',
  'buy-milk-2026-05-08.md',
  'send-invoice-2026-05-08.md',
  'prep-deck-2026-05-08.md',
  'weekly-shop-2026-05-08.md',
] as const

function snapshotFixtures(): Map<string, string> {
  const map = new Map<string, string>()
  for (const name of FIXTURE_NAMES) {
    const p = path.join(FIX_DIR, name)
    map.set(p, fs.readFileSync(p, 'utf-8'))
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

    const shotInitial = path.join(SHOT_DIR, 'todoList-initial.png')
    await window.screenshot({ path: shotInitial, fullPage: true })
    screenshots.push(shotInitial)

    // Under the task-row-interactions contract, only simple tasks have a
    // parent checkbox in the row chrome. buy-milk is the simple-task fixture
    // we use to verify the parent toggle round-trips frontmatter status.
    const milkFile = path.join(FIX_DIR, 'buy-milk-2026-05-08.md')
    const beforeParent = fs.readFileSync(milkFile, 'utf-8')

    await window.click(
      '[data-task="buy-milk"] [data-task-row] [data-checkbox-wrapper] input[type="checkbox"]'
    )
    await window.waitForTimeout(200)

    const afterParent = fs.readFileSync(milkFile, 'utf-8')
    const parentDoneInFm = /status:\s*done/.test(afterParent)
    record(
      'write-back: parent toggle flips status to done',
      parentDoneInFm,
      parentDoneInFm
        ? 'frontmatter contains status: done'
        : `frontmatter not flipped:\n${afterParent}`
    )

    const shotParentToggled = path.join(SHOT_DIR, 'todoList-parent-toggled.png')
    await window.screenshot({ path: shotParentToggled, fullPage: true })
    screenshots.push(shotParentToggled)

    fs.writeFileSync(milkFile, beforeParent, 'utf-8')

    const q2File = path.join(FIX_DIR, 'q2-report-2026-05-04.md')
    const beforeSub = fs.readFileSync(q2File, 'utf-8')

    await window.reload()
    await window.waitForSelector('[data-view="todo-list"]', { timeout: 10_000 })
    await window.waitForSelector('[data-task="q2-report"]', { timeout: 5_000 })

    // The q2-report row is collapsed by default; click the chevron area to expand
    // before clicking the subtask checkbox.
    await window.click('[data-task="q2-report"] [data-task-row] [data-chevron]')
    await window.waitForSelector('[data-task="q2-report"] [data-subtask="1"]', { timeout: 5_000 })

    await window.click(
      '[data-task="q2-report"] [data-subtask="1"] [data-checkbox-wrapper] input[type="checkbox"]'
    )
    await window.waitForTimeout(200)

    const afterSub = fs.readFileSync(q2File, 'utf-8')
    const subBoxFlipped = /- \[x\] Write executive summary/.test(afterSub)
    const otherSubUntouched = /- \[ \] Collect numbers from analytics/.test(afterSub)
    record(
      'write-back: subtask toggle flips - [ ] to - [x] for clicked subtask',
      subBoxFlipped,
      subBoxFlipped ? 'subtask line now - [x] Write executive summary' : `subtask line not flipped:\n${afterSub}`
    )
    record(
      'write-back: subtask toggle leaves the other subtask unchanged',
      otherSubUntouched,
      otherSubUntouched ? 'other subtask still - [ ]' : `other subtask was modified:\n${afterSub}`
    )

    const shotSubToggled = path.join(SHOT_DIR, 'todoList-subtask-toggled.png')
    await window.screenshot({ path: shotSubToggled, fullPage: true })
    screenshots.push(shotSubToggled)

    fs.writeFileSync(q2File, beforeSub, 'utf-8')
  } finally {
    if (app) await app.close().catch(() => undefined)
    restoreFixtures(fixtureSnap)
  }

  console.log('\n=== verify summary ===')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.reason}`)
  }
  console.log('\nscreenshots written:')
  for (const s of screenshots) console.log(`  ${s}`)
  console.log('\nThe Verify agent must now Read each PNG and assert the acceptance criteria from TECH-POC.md.')

  const failed = results.filter((r) => !r.pass)
  if (failed.length > 0) {
    console.error(`\n${failed.length} write-back check(s) failed`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('verify script crashed:', err)
  process.exit(1)
})
