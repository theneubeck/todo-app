// One-off verify script: captures tmp/gotoCommand-autocomplete.png showing
// the dropdown that appears when the user types /goto  in the command bar.

import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SHOT_DIR = path.join(REPO_ROOT, 'tmp')
const MAIN_ENTRY = path.join(REPO_ROOT, 'dist', 'main.js')

interface Fixture {
  filename: string
  title: string
  tags: string[]
}

const FIXTURES: Fixture[] = [
  { filename: 'errands-task-2026-05-17.md', title: 'Errands task', tags: ['errands'] },
  { filename: 'personal-task-2026-05-17.md', title: 'Personal task', tags: ['personal'] },
  { filename: 'mike-task-2026-05-17.md', title: 'Mike task', tags: ['@mike'] },
  { filename: 'lina-task-2026-05-17.md', title: 'Lina task', tags: ['@lina'] },
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

  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'todoz-goto-ac-'))
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
    await window.waitForSelector(inputSelector, { state: 'attached', timeout: 5_000 })

    // Type "/goto " — should open autocomplete with all tags
    await window.click(inputSelector)
    await window.fill(inputSelector, '/goto ')
    await window.waitForSelector('[data-autocomplete]', {
      state: 'attached',
      timeout: 5_000,
    })
    const labels = await window
      .locator('[data-autocomplete-suggestion] [data-autocomplete-label]')
      .allTextContents()
    console.log(`Dropdown shows ${labels.length} suggestions: ${labels.join(', ')}`)

    const shotPath = path.join(SHOT_DIR, 'gotoCommand-autocomplete.png')
    await window.screenshot({ path: shotPath, fullPage: true })
    console.log(`Screenshot captured at ${shotPath}`)
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  }
}

run().catch((err) => {
  console.error('gotoAutocomplete verify crashed:', err)
  process.exit(1)
})
