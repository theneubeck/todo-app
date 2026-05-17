// Verify script for the `read-watch` feature.
//
// Boots Electron with NODE_ENV=test (window visible via production) and a
// tmp vault that contains tasks tagged ">read" and ">watch". Walks through
// three scenarios and captures a screenshot at each:
//   1. tmp/readWatch-sidebar.png  — sidebar shows RESOURCES section with both entries
//   2. tmp/readWatch-filter.png   — clicking To Read filters the main view
//   3. tmp/readWatch-autocomplete.png — typing ">" opens the autocomplete dropdown
//
// Per the frozen plan in features/read-watch/plan.md.

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
    filename: 'design-of-everyday-things-2026-05-17.md',
    title: 'The Design of Everyday Things',
    tags: ['>read'],
  },
  {
    filename: 'wwdc-session-2026-05-17.md',
    title: 'Watch WWDC Session',
    tags: ['>watch'],
  },
  {
    filename: 'errands-task-2026-05-17.md',
    title: 'Errands task',
    tags: ['errands'],
  },
]

function fixtureContent(fx: Fixture): string {
  // Resource tags (">read", ">watch") must be YAML-quoted — the ">" character
  // starts a YAML block scalar indicator. Other tags are plain identifiers.
  const tagsLine = `[${fx.tags
    .map((t) => (t.startsWith('>') || t.startsWith('@') ? `"${t}"` : t))
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
    path.join(os.tmpdir(), 'todoz-readwatch-userdata-')
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
      .catch(() => {
        // may have already fired before firstWindow() returned
      })
    await window.waitForSelector('[data-command-bar]', {
      state: 'attached',
      timeout: 15_000,
    })

    // ---- Screenshot 1: sidebar RESOURCES section ----
    const resourcesSection = await window
      .locator('[data-section="resources"]')
      .count()
    record(
      'RW1: [data-section="resources"] is present',
      resourcesSection === 1,
      `count = ${resourcesSection}`
    )

    const readEntry = await window
      .locator('[data-sidebar-entry=">read"]')
      .count()
    record(
      'RW1: [data-sidebar-entry=">read"] is present',
      readEntry === 1,
      `count = ${readEntry}`
    )

    const watchEntry = await window
      .locator('[data-sidebar-entry=">watch"]')
      .count()
    record(
      'RW1: [data-sidebar-entry=">watch"] is present',
      watchEntry === 1,
      `count = ${watchEntry}`
    )

    // Confirm >read is NOT in the projects section
    const projectsReadCount = await window
      .locator('[data-section="projects"] [data-sidebar-entry=">read"]')
      .count()
    record(
      'RW1: >read does NOT appear in PROJECTS section',
      projectsReadCount === 0,
      `count in projects = ${projectsReadCount}`
    )

    const shotSidebar = path.join(SHOT_DIR, 'readWatch-sidebar.png')
    await window.screenshot({ path: shotSidebar, fullPage: true })
    console.log(`Screenshot captured at ${shotSidebar}`)

    // ---- Screenshot 2: click To Read filters the view ----
    await window.locator('[data-sidebar-entry=">read"]').click()
    await window.waitForTimeout(200)
    const headerText = await window
      .locator('[data-main-header] h1')
      .textContent()
    record(
      'RW2: clicking To Read sets header to "To Read"',
      headerText?.trim() === 'To Read',
      `header = "${headerText?.trim()}"`
    )

    const shotFilter = path.join(SHOT_DIR, 'readWatch-filter.png')
    await window.screenshot({ path: shotFilter, fullPage: true })
    console.log(`Screenshot captured at ${shotFilter}`)

    // ---- Screenshot 3: typing ">" opens autocomplete with resource suggestions ----
    const inputSelector = '[data-command-bar] input[type="text"]'
    await window.click(inputSelector)
    await window.fill(inputSelector, '>')
    await window.waitForSelector('[data-autocomplete]', {
      state: 'attached',
      timeout: 5_000,
    })
    const autocompleteLabels = await window
      .locator('[data-autocomplete-suggestion] [data-autocomplete-label]')
      .allTextContents()
    record(
      'RW4: ">" opens autocomplete showing >read',
      autocompleteLabels.includes('>read'),
      `labels = ${JSON.stringify(autocompleteLabels)}`
    )
    record(
      'RW4: ">" opens autocomplete showing >watch',
      autocompleteLabels.includes('>watch'),
      `labels = ${JSON.stringify(autocompleteLabels)}`
    )

    const shotAutocomplete = path.join(SHOT_DIR, 'readWatch-autocomplete.png')
    await window.screenshot({ path: shotAutocomplete, fullPage: true })
    console.log(`Screenshot captured at ${shotAutocomplete}`)

    // Restore input
    await window.fill(inputSelector, '')
  } catch (err) {
    record(
      'read-watch verify scenario',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  }

  console.log('\n=== read-watch verify summary ===')
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
  console.error('read-watch verify crashed:', err)
  process.exit(1)
})
