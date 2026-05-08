import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SHOT_DIR = path.join(REPO_ROOT, 'test', 'screenshots')

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'todoz-userdata-'))
  const tmpVaultA = path.join(tmpUserData, 'alpha-vault')
  const tmpVaultB = path.join(tmpUserData, 'beta-vault')
  fs.mkdirSync(path.join(tmpVaultA, 'todos'), { recursive: true })
  fs.mkdirSync(path.join(tmpVaultB, 'todos'), { recursive: true })

  // Pre-seed vault config in the temp userData so the picker opens with two recents.
  const configPath = path.join(tmpUserData, 'vault-config.json')
  fs.writeFileSync(
    configPath,
    JSON.stringify({ lastOpened: null, recents: [tmpVaultA, tmpVaultB] }),
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
      env: {
        ...process.env,
        // Bypass the test-mode shortcut so the picker is the entry point.
        NODE_ENV: 'production',
      },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    await window.waitForSelector('[data-vault-picker]', { timeout: 10_000 })

    const shot = path.join(SHOT_DIR, 'vaultPicker-with-recents.png')
    await window.screenshot({ path: shot, fullPage: true })
    console.log(`[PASS] vault-picker view captured at ${shot}`)

    // Click the first recent row to land on the main view, then capture it.
    await window.click('[data-vault-picker] [data-recent-row]')
    await window.waitForSelector('[data-main-view]', { timeout: 5_000 })
    const shotMain = path.join(SHOT_DIR, 'vaultPicker-main-with-switch.png')
    await window.screenshot({ path: shotMain, fullPage: true })
    console.log(`[PASS] main view with vault switcher captured at ${shotMain}`)
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  }
}

run().catch((err) => {
  console.error('vault-picker verify crashed:', err)
  process.exit(1)
})
