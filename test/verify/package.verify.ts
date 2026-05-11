// Verify script for the `package` feature.
//
// Exercises the full DMG pipeline end-to-end:
//   1. Run `npm run package` (uses electron-builder).
//   2. Mount the DMG via hdiutil.
//   3. Read Info.plist via plutil.
//   4. Capture Finder + icon screenshots via sips.
//   5. Launch the packaged .app via Playwright and assert [data-brand] === "TODO".
//   6. Detach the volume.
//
// Per the frozen plan in features/package/plan.md.

import { _electron as electron, ElectronApplication, Page } from 'playwright'
import { spawn, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const RELEASE_DIR = path.join(REPO_ROOT, 'release')
const SHOT_DIR = path.join(REPO_ROOT, 'tmp')
const ASSETS_ICON = path.join(REPO_ROOT, 'assets', 'icon.png')

type Result = { name: string; pass: boolean; reason: string }
const results: Result[] = []
function record(name: string, pass: boolean, reason: string): void {
  results.push({ name, pass, reason })
  const tag = pass ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${name}: ${reason}`)
}

function runShellSync(
  command: string,
  args: string[],
  cwd: string = REPO_ROOT
): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return {
    code: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function runPackage(): Promise<number> {
  return new Promise((resolve) => {
    console.log('Running `npm run package` (this can take a few minutes)...')
    const proc = spawn('npm', ['run', 'package'], {
      cwd: REPO_ROOT,
      env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
      stdio: 'inherit',
    })
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        console.error('`npm run package` exceeded 8 minute timeout — killing.')
        proc.kill('SIGKILL')
        resolve(-1)
      }
    }, 8 * 60 * 1000)
    proc.on('close', (code) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve(code ?? -1)
      }
    })
    proc.on('error', (err) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        console.error('package spawn error:', err)
        resolve(-1)
      }
    })
  })
}

function findDmg(): string | null {
  if (!fs.existsSync(RELEASE_DIR)) return null
  const entries = fs.readdirSync(RELEASE_DIR)
  const dmgs = entries.filter((f) => /^todoz-.*\.dmg$/.test(f))
  if (dmgs.length === 0) return null
  return path.join(RELEASE_DIR, dmgs[0])
}

function mountDmg(dmgPath: string): string {
  const r = runShellSync('hdiutil', [
    'attach',
    '-nobrowse',
    '-readonly',
    '-plist',
    dmgPath,
  ])
  if (r.code !== 0) {
    throw new Error(`hdiutil attach failed (code ${r.code}): ${r.stderr}`)
  }
  // The plist output lists every mount-point; pick the one that mounts a volume.
  const match = r.stdout.match(/<key>mount-point<\/key>\s*<string>([^<]+)<\/string>/)
  if (!match) {
    throw new Error(`could not find mount-point in hdiutil output:\n${r.stdout}`)
  }
  return match[1]
}

function detachVolume(mount: string): void {
  const r = runShellSync('hdiutil', ['detach', mount, '-force'])
  if (r.code !== 0) {
    console.warn(`hdiutil detach returned code ${r.code}: ${r.stderr}`)
  }
}

function readPlistValue(plist: string, key: string): string {
  const r = runShellSync('plutil', ['-extract', key, 'raw', '-o', '-', plist])
  if (r.code !== 0) {
    throw new Error(`plutil failed for ${key} (code ${r.code}): ${r.stderr}`)
  }
  return r.stdout.trim()
}

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  // Snapshot existing release/ contents so a re-run is idempotent.
  const previousDmgs = fs.existsSync(RELEASE_DIR)
    ? fs.readdirSync(RELEASE_DIR).filter((f) => /\.dmg$/.test(f))
    : []
  console.log(
    `Previous .dmg files in release/: ${
      previousDmgs.length === 0 ? '(none)' : previousDmgs.join(', ')
    }`
  )

  // Step 1+2: run `npm run package`.
  const packageExit = await runPackage()
  record(
    'AC1: npm run package exits 0',
    packageExit === 0,
    packageExit === 0 ? 'exit 0' : `exit code ${packageExit}`
  )
  if (packageExit !== 0) {
    finalize()
    return
  }

  // Step 3: DMG exists.
  const dmgPath = findDmg()
  record(
    'AC1: release/todoz-*.dmg exists',
    !!dmgPath,
    dmgPath ? `found ${dmgPath}` : 'no DMG matched glob'
  )
  if (!dmgPath) {
    finalize()
    return
  }

  // Copy the source icon next to the screenshots so Verify can compare it.
  const iconCopy = path.join(SHOT_DIR, 'package-icon-source.png')
  fs.copyFileSync(ASSETS_ICON, iconCopy)
  console.log(`Copied icon source to ${iconCopy}`)

  // Step 4: mount the DMG.
  let mount: string | undefined
  try {
    mount = mountDmg(dmgPath)
    console.log(`Mounted at ${mount}`)

    // Step 5: todoz.app at top level (AC2).
    const appPath = path.join(mount, 'todoz.app')
    const appExists = fs.existsSync(appPath)
    record('AC2: todoz.app exists at DMG root', appExists, appPath)
    if (!appExists) {
      finalize()
      return
    }

    // Step 6: read Info.plist (AC3).
    const plistPath = path.join(appPath, 'Contents', 'Info.plist')
    const bundleId = readPlistValue(plistPath, 'CFBundleIdentifier')
    record(
      'AC3: CFBundleIdentifier === com.theneubeck.todoz',
      bundleId === 'com.theneubeck.todoz',
      `got "${bundleId}"`
    )
    const bundleName = readPlistValue(plistPath, 'CFBundleName')
    record(
      'AC3: CFBundleName === todoz',
      bundleName === 'todoz',
      `got "${bundleName}"`
    )

    // Step 7: list volume root contents (AC5 file-system).
    const rootEntries = fs.readdirSync(mount)
    const hasApp = rootEntries.includes('todoz.app')
    const hasApplications = rootEntries.includes('Applications')
    record(
      'AC5: todoz.app present at volume root',
      hasApp,
      `entries: ${rootEntries.join(', ')}`
    )
    record(
      'AC5: Applications symlink present at volume root',
      hasApplications,
      `entries: ${rootEntries.join(', ')}`
    )

    // Step 8: capture icon screenshot via sips. Extract the icns resource
    // and convert to PNG so Verify can visually compare.
    const iconResource = path.join(
      appPath,
      'Contents',
      'Resources',
      'icon.icns'
    )
    if (fs.existsSync(iconResource)) {
      const iconShot = path.join(SHOT_DIR, 'package-app-icon.png')
      const sips = runShellSync('sips', [
        '-s',
        'format',
        'png',
        iconResource,
        '--out',
        iconShot,
      ])
      record(
        'AC4: app icon extracted as PNG via sips',
        sips.code === 0 && fs.existsSync(iconShot),
        sips.code === 0 ? iconShot : `sips exit ${sips.code}: ${sips.stderr}`
      )
    } else {
      record(
        'AC4: app icon resource present at Contents/Resources/icon.icns',
        false,
        `missing icon.icns at ${iconResource}`
      )
    }

    // Step 9: Open the volume in Finder, capture a screenshot via screencapture
    // so the Verify agent can confirm the DMG layout visually (AC4 + AC5 visual).
    // We use AppleScript via `osascript` to open the volume; on CI/headless this
    // may no-op, so we don't fail if it doesn't produce a window.
    const finderShot = path.join(SHOT_DIR, 'package-dmg-window.png')
    const osa = runShellSync('osascript', [
      '-e',
      `tell application "Finder" to open POSIX file "${mount}"`,
    ])
    if (osa.code === 0) {
      // Give Finder a moment to paint.
      await new Promise((r) => setTimeout(r, 1200))
      const cap = runShellSync('screencapture', ['-x', finderShot])
      if (cap.code === 0 && fs.existsSync(finderShot)) {
        console.log(`Captured Finder screenshot at ${finderShot}`)
      }
      // Close Finder window.
      runShellSync('osascript', [
        '-e',
        `tell application "Finder" to close (every window whose target is folder (POSIX file "${mount}" as alias))`,
      ])
    } else {
      console.log(`(skipping Finder window screenshot — osascript exit ${osa.code})`)
    }

    // Step 10: launch the packaged app via Playwright and assert [data-brand].
    const executable = path.join(appPath, 'Contents', 'MacOS', 'todoz')
    let app: ElectronApplication | undefined
    try {
      app = await electron.launch({
        executablePath: executable,
        cwd: mount,
        env: { ...process.env, NODE_ENV: 'test' },
        timeout: 30_000,
      })
      const window: Page = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await window.waitForSelector('[data-brand]', { timeout: 8_000 })
      const brand = (await window.textContent('[data-brand]'))?.trim()
      record(
        'AC6: packaged app renders [data-brand] === "TODO"',
        brand === 'TODO',
        `got "${brand ?? '(null)'}"`
      )
      const launchedShot = path.join(SHOT_DIR, 'package-launched-app.png')
      await window.screenshot({ path: launchedShot, fullPage: true })
      console.log(`Captured launched-app screenshot at ${launchedShot}`)
    } catch (err) {
      record(
        'AC6: packaged app launches and renders main window',
        false,
        err instanceof Error ? err.message : String(err)
      )
    } finally {
      if (app) await app.close().catch(() => undefined)
    }
  } finally {
    if (mount) detachVolume(mount)
  }

  finalize()
}

function finalize(): void {
  console.log('\n=== package verify summary ===')
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
  console.error('package.verify script crashed:', err)
  process.exit(1)
})
