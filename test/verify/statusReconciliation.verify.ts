import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const FIX_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'vault', 'todos')
const ARCHIVE_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'vault', 'archive', 'todos')
const SHOT_DIR = path.join(REPO_ROOT, 'tmp')

// Snapshot the fixtures directory so we can restore everything that was on
// disk before the run, including freshly-created files we created.
function snapshotDir(dir: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!fs.existsSync(dir)) return map
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    if (fs.statSync(p).isFile()) {
      map.set(p, fs.readFileSync(p, 'utf-8'))
    }
  }
  return map
}

function restoreDir(dir: string, snap: Map<string, string>): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  // Remove any file present now but not in snapshot.
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    if (fs.statSync(p).isFile() && !snap.has(p)) {
      try {
        fs.unlinkSync(p)
      } catch {
        /* ignore */
      }
    }
  }
  // Re-write snapshot contents.
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

function readStatus(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8')
  const m = /^\s*status:\s*(todo|doing|done)\s*$/m.exec(content)
  return m?.[1] ?? ''
}

const SLUG = 'status-recon'
const TODAY = new Date().toISOString().slice(0, 10)
const FILE_NAME = `${SLUG}-${TODAY}.md`
const FILE_PATH = path.join(FIX_DIR, FILE_NAME)

function buildFixture(status: 'todo' | 'done', body: string): string {
  return (
    `---\n` +
    `type: task\n` +
    `title: ${SLUG}\n` +
    `status: ${status}\n` +
    `tags: []\n` +
    `created: ${TODAY}\n` +
    `---\n` +
    `${body}`
  )
}

async function readRemainingCount(window: Page): Promise<number> {
  const text = (await window.locator('[data-remaining-count]').textContent()) ?? ''
  const m = /^(\d+)\s/.exec(text.trim())
  return m ? parseInt(m[1], 10) : NaN
}

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const fixtureSnap = snapshotDir(FIX_DIR)
  const archiveSnap = snapshotDir(ARCHIVE_DIR)

  const screenshots: string[] = []
  let app: ElectronApplication | undefined

  try {
    // Pre-seed the fixture file BEFORE the app boots, so it's discoverable
    // by readTodos at first render.
    fs.mkdirSync(FIX_DIR, { recursive: true })
    fs.writeFileSync(
      FILE_PATH,
      buildFixture('todo', '- [x] step 1\n- [ ] step 2\n'),
      'utf-8'
    )

    app = await electron.launch({
      args: [path.join(REPO_ROOT, 'dist', 'main.js')],
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('[data-view="todo-list"]', { timeout: 10_000 })
    await window.waitForSelector(`[data-task="${SLUG}"]`, { timeout: 5_000 })

    const rowSel = `[data-task="${SLUG}"]`

    // ---- Step 1: status: todo, body has [x][ ] — check the open subtask.
    // Expand the row first.
    const expanded = await window
      .locator(`${rowSel}[data-expanded="true"]`)
      .count()
    if (expanded === 0) {
      await window.click(`${rowSel} [data-task-row]`)
      await window.waitForSelector(`${rowSel}[data-expanded="true"]`, {
        timeout: 5_000,
      })
    }

    const beforeCheckCount = await readRemainingCount(window)

    // Find the unchecked subtask (step 2) and click its checkbox.
    await window.click(
      `${rowSel} [data-subtask-list] [data-subtask] >> nth=1 >> [data-checkbox-wrapper] input[type="checkbox"]`
    )
    await window.waitForTimeout(300)

    const statusAfterCheck = readStatus(FILE_PATH)
    record(
      'criterion 1: status flips to done after checking the last unchecked subtask',
      statusAfterCheck === 'done',
      `frontmatter status = "${statusAfterCheck}" (expected "done")`
    )

    const afterCheckCount = await readRemainingCount(window)
    record(
      'criterion 5: remaining count drops by 1 when last subtask is checked',
      afterCheckCount === beforeCheckCount - 1,
      `count went ${beforeCheckCount} -> ${afterCheckCount}`
    )

    const shotAllChecked = path.join(SHOT_DIR, 'statusReconciliation-all-checked.png')
    await window.screenshot({ path: shotAllChecked, fullPage: true })
    screenshots.push(shotAllChecked)

    // ---- Step 2: now uncheck a subtask — status should flip back to todo,
    // count should rise by 1.
    const beforeUncheckCount = await readRemainingCount(window)
    await window.click(
      `${rowSel} [data-subtask-list] [data-subtask] >> nth=0 >> [data-checkbox-wrapper] input[type="checkbox"]`
    )
    await window.waitForTimeout(300)

    const statusAfterUncheck = readStatus(FILE_PATH)
    record(
      'criterion 2: status flips back to todo when a subtask is unchecked from all-done',
      statusAfterUncheck === 'todo',
      `frontmatter status = "${statusAfterUncheck}" (expected "todo")`
    )

    const afterUncheckCount = await readRemainingCount(window)
    record(
      'criterion 6: remaining count rises by 1 when a subtask is unchecked from all-done',
      afterUncheckCount === beforeUncheckCount + 1,
      `count went ${beforeUncheckCount} -> ${afterUncheckCount}`
    )

    const shotAfterUncheck = path.join(SHOT_DIR, 'statusReconciliation-after-uncheck.png')
    await window.screenshot({ path: shotAfterUncheck, fullPage: true })
    screenshots.push(shotAfterUncheck)

    // ---- Step 3: simple-task done → add subtask path.
    // Reset the file to a simple done task and reload.
    fs.writeFileSync(FILE_PATH, buildFixture('done', ''), 'utf-8')
    await window.reload()
    await window.waitForSelector('[data-view="todo-list"]', { timeout: 10_000 })
    await window.waitForSelector(`${rowSel}`, { timeout: 5_000 })
    await window.waitForSelector(`${rowSel} [data-add-subtask]`, { timeout: 5_000 })

    await window.click(`${rowSel} [data-add-subtask]`)
    await window.waitForSelector(`${rowSel} [data-add-subtask-input]`, {
      timeout: 5_000,
    })
    await window.fill(`${rowSel} [data-add-subtask-input]`, 'draft outline')
    await window.keyboard.press('Enter')
    await window.waitForTimeout(300)

    const statusAfterAdd = readStatus(FILE_PATH)
    record(
      'criterion 3: status resets to todo when a subtask is added to a done simple task',
      statusAfterAdd === 'todo',
      `frontmatter status = "${statusAfterAdd}" (expected "todo")`
    )

    const shotAfterAddSubtask = path.join(
      SHOT_DIR,
      'statusReconciliation-add-subtask-to-done.png'
    )
    await window.screenshot({ path: shotAfterAddSubtask, fullPage: true })
    screenshots.push(shotAfterAddSubtask)

    // ---- Step 4: remove the only unchecked subtask, leaving an all-checked
    // body. Status should flip to done.
    fs.writeFileSync(
      FILE_PATH,
      buildFixture('todo', '- [x] step 1\n- [ ] step 2\n'),
      'utf-8'
    )
    await window.reload()
    await window.waitForSelector('[data-view="todo-list"]', { timeout: 10_000 })
    await window.waitForSelector(`${rowSel}`, { timeout: 5_000 })

    // Make sure the row is expanded.
    const expanded2 = await window
      .locator(`${rowSel}[data-expanded="true"]`)
      .count()
    if (expanded2 === 0) {
      await window.click(`${rowSel} [data-task-row]`)
      await window.waitForSelector(`${rowSel}[data-expanded="true"]`, {
        timeout: 5_000,
      })
    }

    // Click remove on the second subtask (step 2).
    await window.click(
      `${rowSel} [data-subtask-list] [data-subtask] >> nth=1 >> [data-remove]`
    )
    await window.waitForSelector(`${rowSel} [data-confirm]`, { timeout: 5_000 })
    await window.click(`${rowSel} [data-confirm] [data-confirm-yes]`)
    await window.waitForTimeout(300)

    const statusAfterRemove = readStatus(FILE_PATH)
    record(
      'criterion 4: status flips to done when removing the only unchecked subtask',
      statusAfterRemove === 'done',
      `frontmatter status = "${statusAfterRemove}" (expected "done")`
    )

    const shotAfterRemove = path.join(
      SHOT_DIR,
      'statusReconciliation-after-remove.png'
    )
    await window.screenshot({ path: shotAfterRemove, fullPage: true })
    screenshots.push(shotAfterRemove)
  } finally {
    if (app) await app.close().catch(() => undefined)
    restoreDir(FIX_DIR, fixtureSnap)
    restoreDir(ARCHIVE_DIR, archiveSnap)
  }

  console.log('\n=== status-reconciliation verify summary ===')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.reason}`)
  }
  console.log('\nscreenshots written:')
  for (const s of screenshots) console.log(`  ${s}`)

  const failed = results.filter((r) => !r.pass)
  if (failed.length > 0) {
    console.error(`\n${failed.length} status-reconciliation check(s) failed`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('status-reconciliation verify script crashed:', err)
  process.exit(1)
})
