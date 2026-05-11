import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import os from 'os'
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

async function captureWithFixtureVault(): Promise<string[]> {
  // Uses NODE_ENV=test so the fixture vault (with @mike tag) is loaded.
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
    await window.waitForSelector('[data-app-bar]', { timeout: 10_000 })

    // ---- (1) Initial render with brand reading "TODO" ----
    const brandText = await window.locator('[data-brand]').textContent()
    record(
      'criterion 2: brand reads "TODO"',
      (brandText ?? '').trim() === 'TODO',
      `[data-brand] = "${brandText}"`
    )
    const shotInitial = path.join(SHOT_DIR, 'bugFixes1-initial-todo-brand.png')
    await window.screenshot({ path: shotInitial, fullPage: true })
    screenshots.push(shotInitial)

    // ---- (2) Settings panel open with three checkboxes ----
    await window.click('[data-app-bar-settings]')
    await window.waitForSelector('[data-settings-panel]', { timeout: 5_000 })
    const togglesCount = await window.locator('[data-setting-toggle]').count()
    record(
      'criterion 3: settings panel shows three checkboxes',
      togglesCount === 3,
      `found ${togglesCount} [data-setting-toggle] rows`
    )
    const shotPanelOpen = path.join(SHOT_DIR, 'bugFixes1-settings-panel-open.png')
    await window.screenshot({ path: shotPanelOpen, fullPage: true })
    screenshots.push(shotPanelOpen)

    // ---- (3) Sidebar after Show Chat is unchecked ----
    await window.click(
      '[data-setting-toggle="show-chat"] input[type="checkbox"]'
    )
    await window.waitForTimeout(150)
    // Click the settings button again to close the panel for the screenshot.
    await window.click('[data-app-bar-settings]')
    await window.waitForTimeout(100)
    const chatPresent = await window
      .locator('[data-sidebar-entry="chat"]')
      .count()
    record(
      'criterion 4: chat sidebar entry removed after toggle',
      chatPresent === 0,
      `[data-sidebar-entry="chat"] count = ${chatPresent}`
    )
    const shotChatOff = path.join(SHOT_DIR, 'bugFixes1-sidebar-chat-off.png')
    await window.screenshot({ path: shotChatOff, fullPage: true })
    screenshots.push(shotChatOff)

    // Restore the checkbox so the persisted file does not bleed into other runs.
    await window.click('[data-app-bar-settings]')
    await window.waitForSelector('[data-settings-panel]', { timeout: 5_000 })
    await window.click(
      '[data-setting-toggle="show-chat"] input[type="checkbox"]'
    )
    await window.waitForTimeout(150)
  } finally {
    if (app) await app.close().catch(() => undefined)
  }
  return screenshots
}

async function captureWithTagFreeVault(): Promise<string[]> {
  // Spin up a temp userData + temp empty vault so the sidebar has no
  // PROJECTS / PEOPLE sections.
  const screenshots: string[] = []
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'todoz-bugfixes-userdata-'))
  const tmpVault = path.join(tmpUserData, 'empty-vault')
  fs.mkdirSync(path.join(tmpVault, 'todos'), { recursive: true })
  // Pre-seed vault config so the picker is bypassed.
  const configPath = path.join(tmpUserData, 'vault-config.json')
  fs.writeFileSync(
    configPath,
    JSON.stringify({ lastOpened: tmpVault, recents: [tmpVault] }),
    'utf-8'
  )

  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      args: [
        path.join(REPO_ROOT, 'dist', 'main.js'),
        `--user-data-dir=${tmpUserData}`,
      ],
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('[data-app-bar]', { timeout: 10_000 })

    const projectsPresent = await window
      .locator('[data-section="projects"]')
      .count()
    const peoplePresent = await window
      .locator('[data-section="people"]')
      .count()
    record(
      'criterion 7: PROJECTS section absent on tag-free vault',
      projectsPresent === 0,
      `[data-section="projects"] count = ${projectsPresent}`
    )
    record(
      'criterion 8: PEOPLE section absent on tag-free vault',
      peoplePresent === 0,
      `[data-section="people"] count = ${peoplePresent}`
    )

    const shot = path.join(SHOT_DIR, 'bugFixes1-sidebar-tag-free.png')
    await window.screenshot({ path: shot, fullPage: true })
    screenshots.push(shot)
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  }
  return screenshots
}

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const screenshots: string[] = []

  const fixtureShots = await captureWithFixtureVault()
  screenshots.push(...fixtureShots)
  const tagFreeShots = await captureWithTagFreeVault()
  screenshots.push(...tagFreeShots)

  console.log('\n=== bug-fixes-1 verify summary ===')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.reason}`)
  }
  console.log('\nscreenshots written:')
  for (const s of screenshots) console.log(`  ${s}`)

  const failed = results.filter((r) => !r.pass)
  if (failed.length > 0) {
    console.error(`\n${failed.length} bug-fixes-1 check(s) failed`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('bug-fixes-1 verify script crashed:', err)
  process.exit(1)
})
