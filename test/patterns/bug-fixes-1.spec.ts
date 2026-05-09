import { describe, it } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'
import { mountSettingsPanel } from '../../src/renderer/views/SettingsPanel'
import type { AppSettings, AppSettingKey } from '../../src/main/appSettings'

interface TodozMock {
  readTodos: () => Promise<Task[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  runOllama: (prompt: string) => Promise<string>
  today?: string
  getAppSettings: () => Promise<AppSettings>
  setAppSetting: (key: keyof AppSettings, value: boolean) => Promise<void>
  __setCalls: Array<[keyof AppSettings, boolean]>
}

function buildTask(opts: Partial<Task> & { slug: string; title: string }): Task {
  return {
    slug: opts.slug,
    filePath: opts.filePath ?? `/abs/${opts.slug}-2026-05-09.md`,
    title: opts.title,
    status: opts.status ?? 'todo',
    due: opts.due,
    tags: opts.tags ?? [],
    created: opts.created ?? '2026-05-09',
    raw:
      opts.raw ??
      `---\ntype: task\ntitle: "${opts.title}"\nstatus: todo\ntags: [${(opts.tags ?? []).join(', ')}]\ncreated: 2026-05-09\n---\n`,
    subtasks: opts.subtasks ?? [],
  }
}

function setupDom(
  tasks: Task[],
  settings: AppSettings = { showChat: true, showToday: true, showUpcoming: true }
): { dom: JSDOM; todoz: TodozMock } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
  })
  const calls: Array<[keyof AppSettings, boolean]> = []
  const liveSettings: AppSettings = { ...settings }
  const todoz: TodozMock = {
    today: '2026-05-09',
    __setCalls: calls,
    async readTodos() {
      return tasks
    },
    async writeFile() {},
    async runOllama() {
      return ''
    },
    async getAppSettings() {
      return { ...liveSettings }
    },
    async setAppSetting(key, value) {
      calls.push([key, value])
      liveSettings[key] = value
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(dom.window as any).todoz = todoz
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = dom.window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).document = dom.window.document
  return { dom, todoz }
}

function tick(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe('SettingsPanel view', () => {
  it('renders three checkboxes when opened', async () => {
    const { dom } = setupDom([])
    await mountApp(dom.window.document.body)
    const settingsBtn = dom.window.document.querySelector(
      '[data-app-bar-settings]'
    ) as HTMLElement
    expect(settingsBtn, 'settings button').to.not.equal(null)
    settingsBtn.click()
    await tick(10)
    const toggles = dom.window.document.querySelectorAll('[data-setting-toggle]')
    expect(toggles.length).to.equal(3)
  })

  it('reflects persisted state by initialising checkboxes', async () => {
    const { dom } = setupDom([], { showChat: false, showToday: true, showUpcoming: false })
    await mountApp(dom.window.document.body)
    const settingsBtn = dom.window.document.querySelector(
      '[data-app-bar-settings]'
    ) as HTMLElement
    settingsBtn.click()
    await tick(10)
    const chat = dom.window.document.querySelector(
      '[data-setting-toggle="show-chat"] input[type="checkbox"]'
    ) as HTMLInputElement
    const today = dom.window.document.querySelector(
      '[data-setting-toggle="show-today"] input[type="checkbox"]'
    ) as HTMLInputElement
    const upcoming = dom.window.document.querySelector(
      '[data-setting-toggle="show-upcoming"] input[type="checkbox"]'
    ) as HTMLInputElement
    expect(chat.checked).to.equal(false)
    expect(today.checked).to.equal(true)
    expect(upcoming.checked).to.equal(false)
  })

  it('calls window.todoz.setAppSetting when a checkbox is toggled', async () => {
    const { dom, todoz } = setupDom([])
    await mountApp(dom.window.document.body)
    const settingsBtn = dom.window.document.querySelector(
      '[data-app-bar-settings]'
    ) as HTMLElement
    settingsBtn.click()
    await tick(10)
    const chat = dom.window.document.querySelector(
      '[data-setting-toggle="show-chat"] input[type="checkbox"]'
    ) as HTMLInputElement
    chat.click()
    await tick(10)
    expect(todoz.__setCalls).to.deep.equal([['showChat', false]])
  })

  it('closes when the user clicks outside', async () => {
    const { dom } = setupDom([])
    await mountApp(dom.window.document.body)
    const settingsBtn = dom.window.document.querySelector(
      '[data-app-bar-settings]'
    ) as HTMLElement
    settingsBtn.click()
    await tick(10)
    expect(dom.window.document.querySelector('[data-settings-panel]')).to.not.equal(null)
    const ev = new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true })
    dom.window.document.body.dispatchEvent(ev)
    await tick(10)
    expect(dom.window.document.querySelector('[data-settings-panel]')).to.equal(null)
  })

  it('closes when the settings icon is clicked a second time', async () => {
    const { dom } = setupDom([])
    await mountApp(dom.window.document.body)
    const settingsBtn = dom.window.document.querySelector(
      '[data-app-bar-settings]'
    ) as HTMLElement
    settingsBtn.click()
    await tick(10)
    expect(dom.window.document.querySelector('[data-settings-panel]')).to.not.equal(null)
    settingsBtn.click()
    await tick(10)
    expect(dom.window.document.querySelector('[data-settings-panel]')).to.equal(null)
  })

  it('stays open when a click lands inside the panel', async () => {
    const { dom } = setupDom([])
    await mountApp(dom.window.document.body)
    const settingsBtn = dom.window.document.querySelector(
      '[data-app-bar-settings]'
    ) as HTMLElement
    settingsBtn.click()
    await tick(10)
    const panel = dom.window.document.querySelector(
      '[data-settings-panel]'
    ) as HTMLElement
    expect(panel).to.not.equal(null)
    const ev = new dom.window.MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    })
    panel.dispatchEvent(ev)
    await tick(10)
    expect(dom.window.document.querySelector('[data-settings-panel]')).to.not.equal(
      null
    )
  })

  it('stays open when a click lands inside the anchor button', async () => {
    const { dom } = setupDom([])
    await mountApp(dom.window.document.body)
    const settingsBtn = dom.window.document.querySelector(
      '[data-app-bar-settings]'
    ) as HTMLElement
    settingsBtn.click()
    await tick(10)
    expect(dom.window.document.querySelector('[data-settings-panel]')).to.not.equal(
      null
    )
    // A bare mousedown landing on the anchor must not tear the panel down.
    // (The anchor's click handler is what toggles it; outside-click logic
    // explicitly skips events whose target is inside the anchor.)
    const md = new dom.window.MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    })
    settingsBtn.dispatchEvent(md)
    await tick(10)
    expect(dom.window.document.querySelector('[data-settings-panel]')).to.not.equal(
      null
    )
  })
})

describe('Sidebar with toggles', () => {
  it('omits the Chat entry when showChat is false', async () => {
    const { dom } = setupDom([], { showChat: false, showToday: true, showUpcoming: true })
    await mountApp(dom.window.document.body)
    expect(
      dom.window.document.querySelector('[data-sidebar-entry="chat"]')
    ).to.equal(null)
  })

  it('omits the Today entry when showToday is false', async () => {
    const { dom } = setupDom([], { showChat: true, showToday: false, showUpcoming: true })
    await mountApp(dom.window.document.body)
    expect(
      dom.window.document.querySelector('[data-sidebar-entry="today"]')
    ).to.equal(null)
  })

  it('omits the Upcoming entry when showUpcoming is false', async () => {
    const { dom } = setupDom([], { showChat: true, showToday: true, showUpcoming: false })
    await mountApp(dom.window.document.body)
    expect(
      dom.window.document.querySelector('[data-sidebar-entry="upcoming"]')
    ).to.equal(null)
  })

  it('never omits the Inbox entry regardless of settings', async () => {
    const { dom } = setupDom([], { showChat: false, showToday: false, showUpcoming: false })
    await mountApp(dom.window.document.body)
    expect(
      dom.window.document.querySelector('[data-sidebar-entry="inbox"]')
    ).to.not.equal(null)
  })
})

describe('Sidebar section visibility', () => {
  it('hides the PROJECTS section when there are no #-tags', async () => {
    const tasks = [buildTask({ slug: 'sync-mike', title: 'Sync with Mike', tags: ['@mike'] })]
    const { dom } = setupDom(tasks)
    await mountApp(dom.window.document.body)
    expect(
      dom.window.document.querySelector('[data-section="projects"]')
    ).to.equal(null)
  })

  it('hides the PEOPLE section when there are no @-tags', async () => {
    const tasks = [buildTask({ slug: 'q2', title: 'Q2 report', tags: ['work'] })]
    const { dom } = setupDom(tasks)
    await mountApp(dom.window.document.body)
    expect(
      dom.window.document.querySelector('[data-section="people"]')
    ).to.equal(null)
  })

  it('shows the PROJECTS section when at least one #-tag exists', async () => {
    const tasks = [buildTask({ slug: 'q2', title: 'Q2 report', tags: ['work'] })]
    const { dom } = setupDom(tasks)
    await mountApp(dom.window.document.body)
    expect(
      dom.window.document.querySelector('[data-section="projects"]')
    ).to.not.equal(null)
  })

  it('shows the PEOPLE section when at least one @-tag exists', async () => {
    const tasks = [buildTask({ slug: 'sync-mike', title: 'Sync with Mike', tags: ['@mike'] })]
    const { dom } = setupDom(tasks)
    await mountApp(dom.window.document.body)
    expect(
      dom.window.document.querySelector('[data-section="people"]')
    ).to.not.equal(null)
  })
})

describe('Brand label', () => {
  it('renders TODO as the [data-brand] text', async () => {
    const { dom } = setupDom([])
    await mountApp(dom.window.document.body)
    const brand = dom.window.document.querySelector('[data-brand]')
    expect(brand?.textContent?.trim()).to.equal('TODO')
  })
})

describe('mountSettingsPanel direct', () => {
  function makeDeps(initial: AppSettings = {
    showChat: true,
    showToday: true,
    showUpcoming: true,
  }): {
    deps: {
      getAppSettings: () => Promise<AppSettings>
      setAppSetting: (key: AppSettingKey, value: boolean) => Promise<void>
      onChange: (key: AppSettingKey, value: boolean) => void
    }
    calls: Array<[AppSettingKey, boolean]>
    changes: Array<[AppSettingKey, boolean]>
  } {
    const calls: Array<[AppSettingKey, boolean]> = []
    const changes: Array<[AppSettingKey, boolean]> = []
    const live: AppSettings = { ...initial }
    return {
      deps: {
        getAppSettings: async () => ({ ...live }),
        setAppSetting: async (key, value) => {
          calls.push([key, value])
          live[key] = value
        },
        onChange: (key, value) => {
          changes.push([key, value])
        },
      },
      calls,
      changes,
    }
  }

  it('teardown removes the panel from the DOM', async () => {
    const dom = new JSDOM(
      '<!DOCTYPE html><html><body><button id="anchor"></button></body></html>'
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = dom.window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).document = dom.window.document
    const anchor = dom.window.document.getElementById('anchor') as HTMLElement
    const { deps } = makeDeps()
    const mounted = await mountSettingsPanel(anchor, deps)
    expect(dom.window.document.querySelector('[data-settings-panel]')).to.not.equal(
      null
    )
    mounted.teardown()
    expect(dom.window.document.querySelector('[data-settings-panel]')).to.equal(null)
  })

  it('teardown is idempotent when invoked twice', async () => {
    const dom = new JSDOM(
      '<!DOCTYPE html><html><body><button id="anchor"></button></body></html>'
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = dom.window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).document = dom.window.document
    const anchor = dom.window.document.getElementById('anchor') as HTMLElement
    const { deps } = makeDeps()
    const mounted = await mountSettingsPanel(anchor, deps)
    mounted.teardown()
    // Second call should be a no-op without throwing.
    mounted.teardown()
    expect(dom.window.document.querySelector('[data-settings-panel]')).to.equal(null)
  })

  it('passes the toggled value through onChange after a click', async () => {
    const dom = new JSDOM(
      '<!DOCTYPE html><html><body><button id="anchor"></button></body></html>'
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = dom.window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).document = dom.window.document
    const anchor = dom.window.document.getElementById('anchor') as HTMLElement
    const { deps, calls, changes } = makeDeps()
    await mountSettingsPanel(anchor, deps)
    const cb = dom.window.document.querySelector(
      '[data-setting-toggle="show-today"] input[type="checkbox"]'
    ) as HTMLInputElement
    cb.click()
    await new Promise((r) => setTimeout(r, 5))
    expect(calls).to.deep.equal([['showToday', false]])
    expect(changes).to.deep.equal([['showToday', false]])
  })
})
