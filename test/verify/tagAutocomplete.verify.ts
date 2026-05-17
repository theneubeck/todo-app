// Verify script for the `tag-autocomplete` feature.
//
// Boots Electron with NODE_ENV=test (window hidden) and a tmp vault that
// already contains tasks carrying #errands, #personal, @mike, @lina. Walks
// the dropdown through three states and captures a screenshot at each:
//   1. tmp/tagAutocomplete-hash.png       — typed "#", both project tags shown
//   2. tmp/tagAutocomplete-at-filtered.png — typed "@l", only @lina shown
//   3. tmp/tagAutocomplete-after-insert.png — pressed Tab, input reads "@lina "
//
// Per the frozen plan in features/tag-autocomplete/plan.md.

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
  slug: string
  tags: string[]
}

const FIXTURES: Fixture[] = [
  {
    filename: 'errands-task-2026-05-13.md',
    title: 'Errands task',
    slug: 'errands-task',
    tags: ['errands'],
  },
  {
    filename: 'personal-task-2026-05-13.md',
    title: 'Personal task',
    slug: 'personal-task',
    tags: ['personal'],
  },
  {
    filename: 'sync-with-mike-2026-05-13.md',
    title: 'Sync with Mike',
    slug: 'sync-with-mike',
    tags: ['@mike'],
  },
  {
    filename: 'lunch-with-lina-2026-05-13.md',
    title: 'Lunch with Lina',
    slug: 'lunch-with-lina',
    tags: ['@lina'],
  },
]

function fixtureContent(fx: Fixture): string {
  // People tags (`@…`) must be YAML-quoted — bare `@` starts a reserved
  // indicator. Project tags are plain identifiers and can stay unquoted.
  const tagsLine = `[${fx.tags
    .map((t) => (t.startsWith('@') ? `"${t}"` : t))
    .join(', ')}]`
  return [
    '---',
    'type: task',
    `title: "${fx.title}"`,
    'status: todo',
    `tags: ${tagsLine}`,
    'created: 2026-05-13',
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
    path.join(os.tmpdir(), 'todoz-tagac-userdata-')
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
    // NODE_ENV=production so the vault path comes from vault-config.json
    // (our tmpVault) rather than the bundled test/fixtures/vault, which
    // doesn't carry an @lina tag.
    app = await electron.launch({
      args: [MAIN_ENTRY, `--user-data-dir=${tmpUserData}`],
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window
      .waitForLoadState('domcontentloaded', { timeout: 10_000 })
      .catch(() => {
        // domcontentloaded may have already fired before firstWindow() returned;
        // proceed to the selector wait either way.
      })
    await window.waitForSelector('[data-command-bar]', {
      state: 'attached',
      timeout: 15_000,
    })
    const inputSelector = '[data-command-bar] input[type="text"]'
    await window.waitForSelector(inputSelector, {
      state: 'attached',
      timeout: 5_000,
    })

    // ---- Screenshot 1: "#" shows both project tags ----
    await window.click(inputSelector)
    await window.fill(inputSelector, '#')
    await window.waitForSelector('[data-autocomplete]', {
      state: 'attached',
      timeout: 5_000,
    })
    const projectLabels = await window
      .locator('[data-autocomplete-suggestion] [data-autocomplete-label]')
      .allTextContents()
    record(
      'AC1: # opens dropdown with both fixture project tags',
      projectLabels.length === 2 &&
        projectLabels.includes('#errands') &&
        projectLabels.includes('#personal'),
      `labels = ${JSON.stringify(projectLabels)}`
    )
    const shotHash = path.join(SHOT_DIR, 'tagAutocomplete-hash.png')
    await window.screenshot({ path: shotHash, fullPage: true })
    console.log(`Screenshot captured at ${shotHash}`)

    // ---- Screenshot 2: "@l" shows only @lina ----
    await window.fill(inputSelector, '@l')
    await window.waitForSelector('[data-autocomplete]', {
      state: 'attached',
      timeout: 5_000,
    })
    const peopleLabels = await window
      .locator('[data-autocomplete-suggestion] [data-autocomplete-label]')
      .allTextContents()
    record(
      'AC6: @l filters dropdown to @lina only',
      peopleLabels.length === 1 && peopleLabels[0] === '@lina',
      `labels = ${JSON.stringify(peopleLabels)}`
    )
    const shotFiltered = path.join(SHOT_DIR, 'tagAutocomplete-at-filtered.png')
    await window.screenshot({ path: shotFiltered, fullPage: true })
    console.log(`Screenshot captured at ${shotFiltered}`)

    // ---- Screenshot 3: Tab accepts the highlighted suggestion ----
    await window.locator(inputSelector).press('Tab')
    await window.waitForTimeout(150)
    const valueAfterTab = await window.locator(inputSelector).inputValue()
    record(
      'AC3: Tab accepts the highlighted suggestion (input value)',
      valueAfterTab === '@lina ',
      `input value = "${valueAfterTab}"`
    )
    const dropdownCountAfter = await window
      .locator('[data-autocomplete]')
      .count()
    record(
      'AC3: dropdown is gone after Tab accept',
      dropdownCountAfter === 0,
      `[data-autocomplete] count = ${dropdownCountAfter}`
    )
    const shotInserted = path.join(SHOT_DIR, 'tagAutocomplete-after-insert.png')
    await window.screenshot({ path: shotInserted, fullPage: true })
    console.log(`Screenshot captured at ${shotInserted}`)

    // Restore input so persisted state does not bleed into other runs.
    await window.fill(inputSelector, '')
  } catch (err) {
    record(
      'tag-autocomplete verify scenario',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  }

  console.log('\n=== tag-autocomplete verify summary ===')
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
  console.error('tag-autocomplete verify crashed:', err)
  process.exit(1)
})
