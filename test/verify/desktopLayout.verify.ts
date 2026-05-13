// Verify script for the `desktop-layout` feature.
//
// Launches Electron with NODE_ENV=test (window stays hidden) and the standard
// fixture vault. Captures three screenshots at three viewport sizes to cover
// the plan's acceptance criteria:
//   1. tmp/desktopLayout-default-1280x800.png — the new default launch size
//      (AC 1, AC 3).
//   2. tmp/desktopLayout-wide-3000x2000.png — large-display layout, the work-
//      space must fill horizontally without a centered column (AC 6).
//   3. tmp/desktopLayout-min-800x600.png — the new minimum window size; the
//      layout must still render without horizontal overflow (AC 7).
//
// At each viewport size the script asserts:
//   - `document.body.scrollWidth <= window.innerWidth` (no horizontal overflow)
//   - `[data-sidebar]` computed width is ~240px (AC 3)
//   - `[data-main-view]` exists as a sibling of `[data-sidebar]` (AC 3)
//   - `[data-task-card]` has no visible 1px border (AC 5)
//
// Per the frozen plan in features/desktop-layout/plan.md.

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

type Viewport = {
  label: string
  width: number
  height: number
  screenshot: string
}

const VIEWPORTS: Viewport[] = [
  {
    label: 'default-1280x800',
    width: 1280,
    height: 800,
    screenshot: 'desktopLayout-default-1280x800.png',
  },
  {
    label: 'wide-3000x2000',
    width: 3000,
    height: 2000,
    screenshot: 'desktopLayout-wide-3000x2000.png',
  },
  {
    label: 'min-800x600',
    width: 800,
    height: 600,
    screenshot: 'desktopLayout-min-800x600.png',
  },
]

async function assertViewport(page: Page, vp: Viewport): Promise<void> {
  await page.setViewportSize({ width: vp.width, height: vp.height })
  // Give the layout time to settle after the resize.
  await page.waitForTimeout(150)

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    innerWidth: globalThis.innerWidth,
  }))
  record(
    `${vp.label}: no horizontal overflow`,
    overflow.scrollWidth <= overflow.innerWidth,
    `body.scrollWidth=${overflow.scrollWidth} <= window.innerWidth=${overflow.innerWidth}`
  )

  const sidebarBox = await page.locator('[data-app-body] > [data-sidebar]').boundingBox()
  const sidebarPresent = sidebarBox !== null
  record(
    `${vp.label}: [data-sidebar] is a direct child of [data-app-body]`,
    sidebarPresent,
    sidebarPresent
      ? `sidebar bounding box width=${Math.round(sidebarBox!.width)}`
      : 'no [data-app-body] > [data-sidebar] found'
  )
  if (sidebarPresent) {
    const w = Math.round(sidebarBox!.width)
    record(
      `${vp.label}: [data-sidebar] computed width is approximately 240px`,
      w >= 230 && w <= 260,
      `width=${w}px (expected ~240px)`
    )
  }

  const mainBox = await page.locator('[data-app-body] > [data-main-view]').boundingBox()
  const mainPresent = mainBox !== null
  record(
    `${vp.label}: [data-main-view] is a sibling of [data-sidebar]`,
    mainPresent,
    mainPresent
      ? `main pane bounding box width=${Math.round(mainBox!.width)}`
      : 'no [data-app-body] > [data-main-view] found'
  )
  if (mainPresent && sidebarPresent) {
    const expected = vp.width - 240
    const actual = Math.round(mainBox!.width)
    record(
      `${vp.label}: main pane fills the remaining width (window.innerWidth - sidebar)`,
      Math.abs(actual - expected) <= 4,
      `width=${actual}px, expected=~${expected}px`
    )
  }

  const cardBorder = await page
    .locator('[data-task-card]')
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el)
      return {
        borderTopWidth: cs.borderTopWidth,
        borderRightWidth: cs.borderRightWidth,
        borderBottomWidth: cs.borderBottomWidth,
        borderLeftWidth: cs.borderLeftWidth,
      }
    })
  const noBorder =
    cardBorder.borderTopWidth === '0px' &&
    cardBorder.borderRightWidth === '0px' &&
    cardBorder.borderBottomWidth === '0px' &&
    cardBorder.borderLeftWidth === '0px'
  record(
    `${vp.label}: [data-task-card] has no visible border`,
    noBorder,
    `computed border widths: ${JSON.stringify(cardBorder)}`
  )

  const shot = path.join(SHOT_DIR, vp.screenshot)
  await page.screenshot({ path: shot, fullPage: false })
  console.log(`Screenshot captured at ${shot}`)
}

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  const mainEntry = path.join(REPO_ROOT, 'dist', 'main.js')
  if (!fs.existsSync(mainEntry)) {
    console.error(`dist/main.js missing — did you run \`npm run build\`?`)
    process.exit(1)
  }

  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      args: [mainEntry],
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('[data-app-shell]', { timeout: 10_000 })
    await window.waitForSelector('[data-task-card]', { timeout: 10_000 })

    for (const vp of VIEWPORTS) {
      await assertViewport(window, vp)
    }
  } catch (err) {
    record(
      'desktop-layout verify scenario',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
  }

  console.log('\n=== desktop-layout verify summary ===')
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
  console.error('desktop-layout verify crashed:', err)
  process.exit(1)
})
