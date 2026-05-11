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
    await window.waitForSelector('[data-command-bar]', { timeout: 10_000 })

    // ---- (1) Baseline: no demo chips after the fix (AC 4) ----
    const mentionCount = await window
      .locator('[data-command-chip="mention"]')
      .count()
    const tagChipCount = await window
      .locator('[data-command-chip="tag"]')
      .count()
    record(
      'criterion 4: mention chip is removed',
      mentionCount === 0,
      `[data-command-chip="mention"] count = ${mentionCount}`
    )
    record(
      'criterion 4: tag chip is removed',
      tagChipCount === 0,
      `[data-command-chip="tag"] count = ${tagChipCount}`
    )

    // ---- (2) Type "buy milk", press cmd+i, expect "/add buy milk" (AC 2) ----
    const inputSelector = '[data-command-bar] input[type="text"]'
    await window.click(inputSelector)
    await window.fill(inputSelector, 'buy milk')
    await window.keyboard.press('Meta+i')
    await window.waitForTimeout(150)

    const valueAfterPrepend = await window.locator(inputSelector).inputValue()
    record(
      'criterion 2: cmd+i prepends /add to existing text',
      valueAfterPrepend === '/add buy milk',
      `input value = "${valueAfterPrepend}"`
    )

    const shotPrepended = path.join(SHOT_DIR, 'commandBarFixes-prepended.png')
    await window.screenshot({ path: shotPrepended, fullPage: true })
    screenshots.push(shotPrepended)

    // ---- (3) Press cmd+i again (value already starts with "/add ") (AC 3) ----
    await window.keyboard.press('Meta+i')
    await window.waitForTimeout(150)

    const valueAfterSecondPress = await window
      .locator(inputSelector)
      .inputValue()
    record(
      'criterion 3: cmd+i leaves the value alone when it already starts with /add ',
      valueAfterSecondPress === '/add buy milk',
      `input value = "${valueAfterSecondPress}"`
    )

    const shotAlreadyAdd = path.join(SHOT_DIR, 'commandBarFixes-already-add.png')
    await window.screenshot({ path: shotAlreadyAdd, fullPage: true })
    screenshots.push(shotAlreadyAdd)

    // Restore input so persisted state does not bleed into other runs.
    await window.fill(inputSelector, '')
  } finally {
    if (app) await app.close().catch(() => undefined)
  }

  console.log('\n=== command-bar-fixes verify summary ===')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.reason}`)
  }
  console.log('\nscreenshots written:')
  for (const s of screenshots) console.log(`  ${s}`)

  const failed = results.filter((r) => !r.pass)
  if (failed.length > 0) {
    console.error(`\n${failed.length} command-bar-fixes check(s) failed`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('command-bar-fixes verify script crashed:', err)
  process.exit(1)
})
