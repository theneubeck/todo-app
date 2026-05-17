// Verify script for the `goto-command` feature.
//
// Boots Electron with NODE_ENV=test (window hidden) and a tmp vault that
// contains tasks tagged #errands and @mike. Walks through the acceptance
// criteria and captures screenshots:
//   1. tmp/gotoCommand-inbox.png       — after /goto inbox, Inbox shown
//   2. tmp/gotoCommand-tag.png         — after /goto #errands, #errands shown
//   3. tmp/gotoCommand-people.png      — after /goto @mike, @mike shown
//   4. tmp/gotoCommand-chat.png        — after /goto chat, chat view shown
//   5. tmp/gotoCommand-cmd-t.png       — after cmd+t, input prefilled /goto
//   6. tmp/gotoCommand-noop.png        — /goto zzz no-op, Inbox preserved
//   7. tmp/gotoCommand-done.png        — final state screenshot

import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SHOT_DIR = path.join(REPO_ROOT, 'tmp')
const MAIN_ENTRY = path.join(REPO_ROOT, 'dist', 'main.js')

type Result = { name: string; pass: boolean; reason: string }
const results: Result[] = []
function record(name: string, pass: boolean, reason: string): void {
  results.push({ name, pass, reason })
  const tag = pass ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${name}: ${reason}`)
}

interface Fixture {
  filename: string
  title: string
  tags: string[]
}

const FIXTURES: Fixture[] = [
  {
    filename: 'errands-task-2026-05-17.md',
    title: 'Errands task',
    tags: ['errands'],
  },
  {
    filename: 'mike-task-2026-05-17.md',
    title: 'Mike task',
    tags: ['@mike'],
  },
]

function fixtureContent(fx: Fixture): string {
  const tagsLine = `[${fx.tags
    .map((t) => (t.startsWith('@') ? `"${t}"` : t))
    .join(', ')}]`
  return [
    '---',
    'type: task',
    `title: "${fx.title}"`,
    'status: todo',
    `tags: ${tagsLine}`,
    'created: 2026-05-17',
    '---',
    `- [ ] ${fx.title}`,
    '',
  ].join('\n')
}

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  if (!fs.existsSync(MAIN_ENTRY)) {
    console.error(`dist/main.js missing — did you run \`npm run build\`?`)
    process.exit(1)
  }

  const tmpUserData = fs.mkdtempSync(
    path.join(os.tmpdir(), 'todoz-goto-userdata-')
  )
  const tmpVault = path.join(tmpUserData, 'vault')
  fs.mkdirSync(path.join(tmpVault, 'todos'), { recursive: true })
  for (const fx of FIXTURES) {
    fs.writeFileSync(
      path.join(tmpVault, 'todos', fx.filename),
      fixtureContent(fx),
      'utf-8'
    )
  }
  fs.writeFileSync(
    path.join(tmpUserData, 'vault-config.json'),
    JSON.stringify({ lastOpened: tmpVault, recents: [tmpVault] }),
    'utf-8'
  )

  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      args: [MAIN_ENTRY, `--user-data-dir=${tmpUserData}`],
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window
      .waitForLoadState('domcontentloaded', { timeout: 10_000 })
      .catch(() => {})
    await window.waitForSelector('[data-command-bar]', {
      state: 'attached',
      timeout: 15_000,
    })
    const inputSelector = '[data-command-bar] input[type="text"]'
    await window.waitForSelector(inputSelector, {
      state: 'attached',
      timeout: 5_000,
    })

    // ---- AC1: /goto inbox ----
    await window.click(inputSelector)
    await window.fill(inputSelector, '/goto inbox')
    await window.press(inputSelector, 'Enter')
    await window.waitForTimeout(150)
    const inboxTitle = await window.locator('[data-main-header] h1').textContent()
    const inboxCleared = await window.locator(inputSelector).inputValue()
    record(
      'AC1: /goto inbox shows Inbox header',
      inboxTitle?.trim() === 'Inbox',
      `h1 = "${inboxTitle?.trim()}"`
    )
    record(
      'AC1: /goto inbox clears input',
      inboxCleared === '',
      `input = "${inboxCleared}"`
    )
    await window.screenshot({ path: path.join(SHOT_DIR, 'gotoCommand-inbox.png'), fullPage: true })
    console.log(`Screenshot: ${path.join(SHOT_DIR, 'gotoCommand-inbox.png')}`)

    // ---- AC2: /goto #errands ----
    await window.fill(inputSelector, '/goto #errands')
    await window.press(inputSelector, 'Enter')
    await window.waitForTimeout(150)
    const tagTitle = await window.locator('[data-main-header] h1').textContent()
    const tagCleared = await window.locator(inputSelector).inputValue()
    record(
      'AC2: /goto #errands shows #errands header',
      tagTitle?.trim() === '#errands',
      `h1 = "${tagTitle?.trim()}"`
    )
    record(
      'AC2: /goto #errands clears input',
      tagCleared === '',
      `input = "${tagCleared}"`
    )
    await window.screenshot({ path: path.join(SHOT_DIR, 'gotoCommand-tag.png'), fullPage: true })
    console.log(`Screenshot: ${path.join(SHOT_DIR, 'gotoCommand-tag.png')}`)

    // Navigate back to inbox first
    await window.fill(inputSelector, '/goto inbox')
    await window.press(inputSelector, 'Enter')
    await window.waitForTimeout(150)

    // ---- AC3: /goto @mike ----
    await window.fill(inputSelector, '/goto @mike')
    await window.press(inputSelector, 'Enter')
    await window.waitForTimeout(150)
    const peopleTitle = await window.locator('[data-main-header] h1').textContent()
    record(
      'AC3: /goto @mike shows @mike header',
      peopleTitle?.trim() === '@mike',
      `h1 = "${peopleTitle?.trim()}"`
    )
    await window.screenshot({ path: path.join(SHOT_DIR, 'gotoCommand-people.png'), fullPage: true })
    console.log(`Screenshot: ${path.join(SHOT_DIR, 'gotoCommand-people.png')}`)

    // ---- AC4: /goto chat ----
    await window.fill(inputSelector, '/goto chat')
    await window.press(inputSelector, 'Enter')
    await window.waitForTimeout(150)
    const chatViewCount = await window.locator('[data-chat-view]').count()
    record(
      'AC4: /goto chat shows chat view',
      chatViewCount > 0,
      `[data-chat-view] count = ${chatViewCount}`
    )
    await window.screenshot({ path: path.join(SHOT_DIR, 'gotoCommand-chat.png'), fullPage: true })
    console.log(`Screenshot: ${path.join(SHOT_DIR, 'gotoCommand-chat.png')}`)

    // Navigate back to inbox
    await window.fill(inputSelector, '/goto inbox')
    await window.press(inputSelector, 'Enter')
    await window.waitForTimeout(150)

    // ---- AC5: cmd+t ----
    await window.fill(inputSelector, '')
    await window.keyboard.press('Meta+t')
    await window.waitForTimeout(150)
    const cmdTValue = await window.locator(inputSelector).inputValue()
    record(
      'AC5: cmd+t prefills /goto ',
      cmdTValue.startsWith('/goto '),
      `input = "${cmdTValue}"`
    )
    await window.screenshot({ path: path.join(SHOT_DIR, 'gotoCommand-cmd-t.png'), fullPage: true })
    console.log(`Screenshot: ${path.join(SHOT_DIR, 'gotoCommand-cmd-t.png')}`)

    // ---- AC6: /goto zzz no-op ----
    await window.fill(inputSelector, '/goto inbox')
    await window.press(inputSelector, 'Enter')
    await window.waitForTimeout(150)
    await window.fill(inputSelector, '/goto zzz')
    await window.press(inputSelector, 'Enter')
    await window.waitForTimeout(150)
    const noopTitle = await window.locator('[data-main-header] h1').textContent()
    const noopValue = await window.locator(inputSelector).inputValue()
    record(
      'AC6: /goto zzz preserves Inbox header',
      noopTitle?.trim() === 'Inbox',
      `h1 = "${noopTitle?.trim()}"`
    )
    record(
      'AC6: /goto zzz preserves input value',
      noopValue === '/goto zzz',
      `input = "${noopValue}"`
    )
    await window.screenshot({ path: path.join(SHOT_DIR, 'gotoCommand-noop.png'), fullPage: true })
    console.log(`Screenshot: ${path.join(SHOT_DIR, 'gotoCommand-noop.png')}`)

    // ---- Final state screenshot ----
    await window.screenshot({ path: path.join(SHOT_DIR, 'gotoCommand-done.png'), fullPage: true })
    console.log(`Screenshot: ${path.join(SHOT_DIR, 'gotoCommand-done.png')}`)
  } catch (err) {
    record(
      'goto-command verify scenario',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  }

  console.log('\n=== goto-command verify summary ===')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.reason}`)
  }
  const failed = results.filter((r) => !r.pass)
  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('goto-command verify crashed:', err)
  process.exit(1)
})
