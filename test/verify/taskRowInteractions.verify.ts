import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const FIX_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'vault', 'todos')
const ARCHIVE_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'vault', 'archive', 'todos')
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
    if (fs.existsSync(p)) map.set(p, fs.readFileSync(p, 'utf-8'))
  }
  return map
}

function restoreFixtures(snap: Map<string, string>): void {
  for (const [p, content] of snap) {
    fs.writeFileSync(p, content, 'utf-8')
  }
  // remove anything in archive/todos that may have been moved during this run
  if (fs.existsSync(ARCHIVE_DIR)) {
    for (const f of fs.readdirSync(ARCHIVE_DIR)) {
      const archived = path.join(ARCHIVE_DIR, f)
      const original = path.join(FIX_DIR, f)
      // if the original fixture is missing because it was archived, restore from archive only if original is missing
      if (!fs.existsSync(original) && snap.has(original)) {
        fs.writeFileSync(original, snap.get(original)!, 'utf-8')
      }
      try { fs.unlinkSync(archived) } catch { /* ignore */ }
    }
  }
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

    // ---- Capture confirm prompt (criterion 6, 7) ----
    await window.click('[data-task="buy-milk"] [data-task-row] [data-remove]')
    await window.waitForSelector('[data-confirm]', { timeout: 5_000 })
    const shotConfirmPrompt = path.join(SHOT_DIR, 'taskRow-confirm-prompt.png')
    await window.screenshot({ path: shotConfirmPrompt, fullPage: true })
    screenshots.push(shotConfirmPrompt)
    console.log('[shot] confirm prompt:', shotConfirmPrompt)

    // dismiss via No (criterion 6)
    await window.click('[data-confirm-no]')
    await window.waitForTimeout(150)
    const buyMilkExistsAfterNo = await window.locator('[data-task="buy-milk"]').count()
    console.log(`[criterion 6] buy-milk row count after No: ${buyMilkExistsAfterNo}`)

    // ---- Confirm-yes archive flow (criterion 7) ----
    const buyMilkPath = path.join(FIX_DIR, 'buy-milk-2026-05-08.md')
    const buyMilkExistsBefore = fs.existsSync(buyMilkPath)
    console.log(`[criterion 7] buy-milk file exists before archive: ${buyMilkExistsBefore}`)

    await window.click('[data-task="buy-milk"] [data-task-row] [data-remove]')
    await window.waitForSelector('[data-confirm]', { timeout: 5_000 })
    await window.click('[data-confirm-yes]')
    await window.waitForTimeout(400)

    const buyMilkExistsAfter = fs.existsSync(buyMilkPath)
    const archivedPath = path.join(ARCHIVE_DIR, 'buy-milk-2026-05-08.md')
    const archivedExists = fs.existsSync(archivedPath)
    const buyMilkRowAfterArchive = await window.locator('[data-task="buy-milk"]').count()
    console.log(`[criterion 7] buy-milk file exists after archive: ${buyMilkExistsAfter}`)
    console.log(`[criterion 7] archive file exists: ${archivedExists} (path=${archivedPath})`)
    console.log(`[criterion 7] buy-milk row count after archive: ${buyMilkRowAfterArchive}`)

    const shotAfterArchive = path.join(SHOT_DIR, 'taskRow-after-archive.png')
    await window.screenshot({ path: shotAfterArchive, fullPage: true })
    screenshots.push(shotAfterArchive)
    console.log('[shot] after archive:', shotAfterArchive)

    // ---- Subtask remove flow (criterion 8) ----
    // reload to restore any in-memory state and read the freshly-restored prep-deck fixture
    // (verify script restores fixtures at the end; for now we trigger a reload to make sure the renderer
    //  picks up the still-intact prep-deck file)
    await window.reload()
    await window.waitForSelector('[data-view="todo-list"]', { timeout: 10_000 })
    await window.waitForSelector('[data-task="prep-deck"]', { timeout: 5_000 })
    // expand prep-deck
    await window.click('[data-task="prep-deck"] [data-task-row]')
    await window.waitForSelector('[data-task="prep-deck"] [data-subtask]', { timeout: 5_000 })

    const prepDeckPath = path.join(FIX_DIR, 'prep-deck-2026-05-08.md')
    const prepDeckBefore = fs.readFileSync(prepDeckPath, 'utf-8')
    console.log(`[criterion 8] prep-deck body before:\n${prepDeckBefore}`)

    // click remove on first subtask (draft section 1)
    await window.click('[data-task="prep-deck"] [data-subtask="0"] [data-remove]')
    await window.waitForSelector('[data-task="prep-deck"] [data-subtask="0"] [data-confirm]', { timeout: 5_000 })

    const shotSubtaskConfirm = path.join(SHOT_DIR, 'taskRow-subtask-confirm-prompt.png')
    await window.screenshot({ path: shotSubtaskConfirm, fullPage: true })
    screenshots.push(shotSubtaskConfirm)
    console.log('[shot] subtask confirm prompt:', shotSubtaskConfirm)

    await window.click('[data-confirm-yes]')
    await window.waitForTimeout(400)

    const prepDeckAfter = fs.readFileSync(prepDeckPath, 'utf-8')
    const draftRemoved = !/draft section 1/.test(prepDeckAfter)
    const reviewKept = /review numbers/.test(prepDeckAfter)
    console.log(`[criterion 8] prep-deck body after:\n${prepDeckAfter}`)
    console.log(`[criterion 8] "draft section 1" removed: ${draftRemoved}`)
    console.log(`[criterion 8] "review numbers" preserved: ${reviewKept}`)

    const remainingSubtasks = await window
      .locator('[data-task="prep-deck"] [data-subtask]')
      .count()
    console.log(`[criterion 8] remaining subtask row count: ${remainingSubtasks}`)

    const shotAfterSubtaskRemove = path.join(SHOT_DIR, 'taskRow-after-subtask-remove.png')
    await window.screenshot({ path: shotAfterSubtaskRemove, fullPage: true })
    screenshots.push(shotAfterSubtaskRemove)
    console.log('[shot] after subtask remove:', shotAfterSubtaskRemove)
  } finally {
    if (app) await app.close().catch(() => undefined)
    restoreFixtures(fixtureSnap)
  }

  console.log('\nscreenshots written:')
  for (const s of screenshots) console.log(`  ${s}`)
}

run().catch((err) => {
  console.error('verify script crashed:', err)
  process.exit(1)
})
