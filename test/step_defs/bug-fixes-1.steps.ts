import { Given, When, Then, Before, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { JSDOM } from 'jsdom'
import { TodozWorld } from './world'
import type { Task } from '../../src/renderer/data/parseTodo'
import {
  readAppSettings,
  writeAppSetting,
  type AppSettings,
  type AppSettingKey,
} from '../../src/main/appSettings'
import { mountApp } from '../../src/renderer/index'

type BugFixesWorld = TodozWorld & {
  bugFixesTmpDir?: string
  bugFixesTasks?: Task[]
}

function buildTask(opts: {
  slug: string
  title: string
  tags?: string[]
  due?: string
}): Task {
  const tags = opts.tags ?? []
  const tagYaml = tags.length === 0 ? '[]' : `[${tags.join(', ')}]`
  const due = opts.due ? `\ndue: ${opts.due}` : ''
  return {
    slug: opts.slug,
    filePath: `/abs/test/fixtures/vault/todos/${opts.slug}-2026-05-09.md`,
    title: opts.title,
    status: 'todo',
    due: opts.due,
    tags,
    created: '2026-05-09',
    raw: `---\ntype: task\ntitle: "${opts.title}"\nstatus: todo${due}\ntags: ${tagYaml}\ncreated: 2026-05-09\n---\n`,
    subtasks: [],
  }
}

function bootstrapWindow(world: BugFixesWorld): void {
  world.dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
  })
  const tasks = world.bugFixesTasks ?? []
  const settingsPath = world.appSettingsPath
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(world.dom.window as any).todoz = {
    readTodos: async () => tasks,
    writeFile: async () => {},
    runOllama: async () => '',
    today: '2026-05-09',
    getAppSettings: async (): Promise<AppSettings> => {
      if (!settingsPath) {
        return { showChat: true, showToday: true, showUpcoming: true }
      }
      return readAppSettings(settingsPath)
    },
    setAppSetting: async (key: AppSettingKey, value: boolean): Promise<void> => {
      if (!settingsPath) return
      writeAppSetting(settingsPath, key, value)
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = world.dom.window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).document = world.dom.window.document
}

async function tick(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

Before(function (this: BugFixesWorld) {
  this.bugFixesTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todoz-bug-fixes-'))
  this.appSettingsPath = path.join(this.bugFixesTmpDir, 'app-settings.json')
  this.bugFixesTasks = undefined
})

After(function (this: BugFixesWorld) {
  if (this.bugFixesTmpDir && fs.existsSync(this.bugFixesTmpDir)) {
    fs.rmSync(this.bugFixesTmpDir, { recursive: true, force: true })
  }
})

// ---------------- Given steps ----------------

Given(
  'the vault has zero tags of any kind and no app-settings file exists',
  async function (this: BugFixesWorld) {
    this.bugFixesTasks = [buildTask({ slug: 'solo-task', title: 'Solo task' })]
    if (this.appSettingsPath && fs.existsSync(this.appSettingsPath)) {
      fs.unlinkSync(this.appSettingsPath)
    }
    bootstrapWindow(this)
    await mountApp(this.document.body)
  }
)

Given('the sidebar is shown', async function (this: BugFixesWorld) {
  this.bugFixesTasks = []
  bootstrapWindow(this)
  await mountApp(this.document.body)
  const sidebar = this.document.querySelector('[data-sidebar]')
  expect(sidebar, 'expected the sidebar to be present').to.not.equal(null)
})

Given(
  'the settings panel is open with all checkboxes checked',
  async function (this: BugFixesWorld) {
    this.bugFixesTasks = []
    bootstrapWindow(this)
    await mountApp(this.document.body)
    const btn = this.document.querySelector(
      '[data-app-bar-settings]'
    ) as HTMLElement
    btn.click()
    await tick(10)
    const inputs = Array.from(
      this.document.querySelectorAll(
        '[data-setting-toggle] input[type="checkbox"]'
      )
    ) as HTMLInputElement[]
    expect(inputs.length).to.equal(3)
    inputs.forEach((cb) => {
      expect(cb.checked, 'every toggle starts checked').to.equal(true)
    })
  }
)

Given(
  'the persisted settings have {string} unchecked',
  function (this: BugFixesWorld, label: string) {
    const key = settingKeyFromLabel(label)
    const settingsPath = this.appSettingsPath as string
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        showChat: true,
        showToday: true,
        showUpcoming: true,
        [key]: false,
      }),
      'utf-8'
    )
  }
)

Given('the settings panel is open', async function (this: BugFixesWorld) {
  this.bugFixesTasks = []
  bootstrapWindow(this)
  await mountApp(this.document.body)
  const btn = this.document.querySelector(
    '[data-app-bar-settings]'
  ) as HTMLElement
  btn.click()
  await tick(10)
  expect(this.document.querySelector('[data-settings-panel]')).to.not.equal(null)
})

Given(
  'the vault has zero tasks with {string}-prefixed tags',
  async function (this: BugFixesWorld, prefix: string) {
    if (prefix === '#') {
      this.bugFixesTasks = [
        buildTask({ slug: 'sync-mike', title: 'Sync with Mike', tags: ['@mike'] }),
      ]
    } else if (prefix === '@') {
      this.bugFixesTasks = [
        buildTask({ slug: 'q2-report', title: 'Q2 report', tags: ['work'] }),
      ]
    } else {
      throw new Error(`Unknown tag prefix: ${prefix}`)
    }
    bootstrapWindow(this)
    await mountApp(this.document.body)
  }
)

// ---------------- When steps ----------------
//
// Note: `the app loads` is intentionally NOT defined here. The existing
// `Given('the app loads')` from design-and-structure.steps.ts matches both the
// Given and When forms (Cucumber resolves by step text alone). For the
// "Default render" scenario the matching `Given the vault has zero tags…` step
// already mounts the app, so the subsequent `When the app loads` collapses to
// the existing no-op body that sets `this.fixtures = []` — by the time the
// Then-step runs the sidebar is already in the DOM.

When('the top app bar renders', async function (this: BugFixesWorld) {
  // The matching Given (`the app loads` from design-and-structure.steps.ts)
  // only sets fixtures; trigger the actual mount here so the top app bar is
  // in the DOM before the Then-step asserts on it.
  if (!this.dom) {
    this.bugFixesTasks = this.fixtures.length > 0 ? this.bugFixesTasks ?? [] : []
    bootstrapWindow(this)
    await mountApp(this.document.body)
  }
  const bar = this.document.querySelector('[data-app-bar]')
  expect(bar, 'expected the top app bar to be present').to.not.equal(null)
})

When(
  'the user clicks the settings icon in the top app bar',
  async function (this: BugFixesWorld) {
    const btn = this.document.querySelector(
      '[data-app-bar-settings]'
    ) as HTMLElement
    expect(btn, 'expected a settings button').to.not.equal(null)
    btn.click()
    await tick(10)
  }
)

When('the user unchecks {string}', async function (
  this: BugFixesWorld,
  label: string
) {
  const rows = Array.from(
    this.document.querySelectorAll('[data-setting-toggle]')
  )
  const match = rows.find((row) => {
    const span = row.querySelector('span')
    return span?.textContent?.trim() === label
  })
  expect(match, `expected a toggle row labelled "${label}"`).to.not.equal(undefined)
  const cb = match!.querySelector(
    'input[type="checkbox"]'
  ) as HTMLInputElement
  cb.click()
  await tick(10)
})

When(
  'the user re-opens the app via a fresh mount',
  async function (this: BugFixesWorld) {
    // Throw away the existing DOM and remount. The `this.appSettingsPath` file
    // persists across the re-mount via the same shared tmp file.
    bootstrapWindow(this)
    await mountApp(this.document.body)
  }
)

When(
  'the user clicks outside the panel and outside the settings icon',
  async function (this: BugFixesWorld) {
    const ev = new this.dom!.window.MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    })
    this.document.body.dispatchEvent(ev)
    await tick(10)
  }
)

When('the sidebar renders', function (this: BugFixesWorld) {
  // The matching Given already triggered render; this When only asserts the
  // sidebar is in the DOM so the Then-step can query it.
  expect(this.document.querySelector('[data-sidebar]')).to.not.equal(null)
})

// ---------------- Then steps ----------------

Then(
  'the sidebar shows the Chat, Inbox, Today, and Upcoming entries',
  function (this: BugFixesWorld) {
    expect(
      this.document.querySelector('[data-sidebar-entry="chat"]'),
      'Chat entry'
    ).to.not.equal(null)
    expect(
      this.document.querySelector('[data-sidebar-entry="inbox"]'),
      'Inbox entry'
    ).to.not.equal(null)
    expect(
      this.document.querySelector('[data-sidebar-entry="today"]'),
      'Today entry'
    ).to.not.equal(null)
    expect(
      this.document.querySelector('[data-sidebar-entry="upcoming"]'),
      'Upcoming entry'
    ).to.not.equal(null)
  }
)

Then(
  '[data-brand] text content equals {string}',
  function (this: BugFixesWorld, expected: string) {
    const brand = this.document.querySelector('[data-brand]')
    expect(brand?.textContent?.trim()).to.equal(expected)
  }
)

Then(
  'a settings panel appears anchored to the icon',
  function (this: BugFixesWorld) {
    const panel = this.document.querySelector('[data-settings-panel]')
    expect(panel, 'expected a settings panel').to.not.equal(null)
    const anchor = this.document.querySelector(
      '[data-app-bar-settings]'
    ) as HTMLElement | null
    expect(anchor, 'expected a settings anchor button').to.not.equal(null)
    // jsdom's getBoundingClientRect returns zeros, so we check structural
    // anchoring instead: the panel uses absolute positioning aligned to the
    // anchor's right edge.
    expect((panel as HTMLElement).style.position).to.equal('absolute')
  }
)

Then(
  'the settings panel shows three checkboxes labelled {string}, {string}, and {string}',
  function (this: BugFixesWorld, a: string, b: string, c: string) {
    const expected = [a, b, c]
    const rows = Array.from(
      this.document.querySelectorAll('[data-setting-toggle]')
    )
    expect(rows.length).to.equal(3)
    const labels = rows.map((row) =>
      row.querySelector('span')?.textContent?.trim()
    )
    expect(labels).to.deep.equal(expected)
    rows.forEach((row, i) => {
      const cb = row.querySelector(
        'input[type="checkbox"]'
      ) as HTMLInputElement
      expect(cb.checked, `${expected[i]} should be checked`).to.equal(true)
    })
  }
)

Then(
  'the {string} sidebar entry is removed from the DOM',
  function (this: BugFixesWorld, label: string) {
    const key = label.toLowerCase()
    expect(
      this.document.querySelector(`[data-sidebar-entry="${key}"]`)
    ).to.equal(null)
  }
)

Then(
  'the {string} sidebar entry is absent',
  function (this: BugFixesWorld, label: string) {
    const key = label.toLowerCase()
    expect(
      this.document.querySelector(`[data-sidebar-entry="${key}"]`)
    ).to.equal(null)
  }
)

Then('the panel is closed', function (this: BugFixesWorld) {
  expect(this.document.querySelector('[data-settings-panel]')).to.equal(null)
})

Then(
  '[data-section="projects"] is absent from the DOM',
  function (this: BugFixesWorld) {
    expect(this.document.querySelector('[data-section="projects"]')).to.equal(
      null
    )
  }
)

Then(
  '[data-section="people"] is absent from the DOM',
  function (this: BugFixesWorld) {
    expect(this.document.querySelector('[data-section="people"]')).to.equal(null)
  }
)

// ---------------- Helpers ----------------

function settingKeyFromLabel(label: string): AppSettingKey {
  switch (label) {
    case 'Show Chat':
      return 'showChat'
    case 'Show Today':
      return 'showToday'
    case 'Show Upcoming':
      return 'showUpcoming'
    default:
      throw new Error(`Unknown setting label: ${label}`)
  }
}
