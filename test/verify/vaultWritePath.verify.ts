// Verify script for the `vault-write-path` feature.
//
// Boots Electron with NODE_ENV=production and a tmp userData dir whose
// vault-config.json points lastOpened at a tmp-cloned alpha fixture. Types
// /add empty-vault-task into the command bar, presses Enter, and asserts:
//   1. The file exists at <alt-vault>/todos/empty-vault-task-<TODAY>.md
//   2. No empty-vault-task-* file exists under <repo>/vault/todos/
// Captures one screenshot at tmp/vaultWritePath-after-add.png.
//
// Per the frozen plan in features/vault-write-path/plan.md.

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  if (!fs.existsSync(MAIN_ENTRY)) {
    console.error(`dist/main.js missing — did you run \`npm run build\`?`)
    process.exit(1)
  }

  const tmpUserData = fs.mkdtempSync(
    path.join(os.tmpdir(), 'todoz-vwp-userdata-')
  )
  // Clone the alpha fixture into a tmp location so committed fixtures stay
  // pristine; the /add command writes into this clone.
  const tmpVault = path.join(tmpUserData, 'alpha-vault')
  fs.mkdirSync(path.join(tmpVault, 'todos'), { recursive: true })

  const configPath = path.join(tmpUserData, 'vault-config.json')
  fs.writeFileSync(
    configPath,
    JSON.stringify({ lastOpened: tmpVault, recents: [tmpVault] }),
    'utf-8'
  )

  // Snapshot the repo's vault/todos directory (if any) so we can detect
  // post-run additions even if the directory existed before.
  const repoVaultTodos = path.join(REPO_ROOT, 'vault', 'todos')
  const repoVaultPre = fs.existsSync(repoVaultTodos)
    ? new Set(fs.readdirSync(repoVaultTodos))
    : new Set<string>()

  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      args: [MAIN_ENTRY, `--user-data-dir=${tmpUserData}`],
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('[data-main-view]', { timeout: 10_000 })
    await window.waitForSelector('[data-command-bar] input[type="text"]', {
      timeout: 5_000,
    })

    // Type the /add command into the command bar and press Enter.
    const input = window.locator('[data-command-bar] input[type="text"]')
    await input.fill('/add empty-vault-task')
    await input.press('Enter')
    await window.waitForTimeout(500)

    const today = todayIso()
    const expectedFile = path.join(
      tmpVault,
      'todos',
      `empty-vault-task-${today}.md`
    )
    record(
      'AC1: file lands inside the active vault todos folder',
      fs.existsSync(expectedFile),
      `expected ${expectedFile} to exist`
    )

    const repoVaultPost = fs.existsSync(repoVaultTodos)
      ? new Set(fs.readdirSync(repoVaultTodos))
      : new Set<string>()
    const added: string[] = []
    for (const name of repoVaultPost) {
      if (!repoVaultPre.has(name) && name.startsWith('empty-vault-task-')) {
        added.push(name)
      }
    }
    record(
      'AC1: no empty-vault-task-* leak into the repo vault folder',
      added.length === 0,
      added.length === 0
        ? 'no leaks detected'
        : `leaked files: ${added.join(', ')}`
    )
    // Safety belt: sweep any leaked files so a regression run does not
    // contaminate the working tree.
    for (const name of added) {
      const leaked = path.join(repoVaultTodos, name)
      if (fs.existsSync(leaked)) fs.unlinkSync(leaked)
    }

    const shot = path.join(SHOT_DIR, 'vaultWritePath-after-add.png')
    await window.screenshot({ path: shot, fullPage: true })
    console.log(`Screenshot captured at ${shot}`)
  } catch (err) {
    record(
      'vault-write-path verify launch / scenario',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  }

  console.log('\n=== vault-write-path verify summary ===')
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
  console.error('vault-write-path verify crashed:', err)
  process.exit(1)
})
