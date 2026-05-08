import { Given, When, Then, Before, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { JSDOM } from 'jsdom'
import { TodozWorld } from './world'
import { mountApp } from '../../src/renderer/index'

interface VaultConfigShape {
  lastOpened: string | null
  recents: string[]
}

type VaultPickerWorld = TodozWorld & {
  vaultConfigPath?: string
  pickerReturnPath?: string
  vaultPickerTmpDir?: string
  vaultConfig?: VaultConfigShape
  vaultPickerSetActive?: string[]
  vaultPickerCreated?: string[]
  vaultPickerRemovedRecents?: string[]
}

const ALPHA_PATH = path.resolve(__dirname, '..', 'fixtures', 'vaults', 'alpha')
const BETA_PATH = path.resolve(__dirname, '..', 'fixtures', 'vaults', 'beta')

function ensureFixtureVaultsExist(): void {
  for (const v of [ALPHA_PATH, BETA_PATH]) {
    fs.mkdirSync(path.join(v, 'todos'), { recursive: true })
  }
}

Before(function (this: VaultPickerWorld) {
  this.vaultPickerTmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'todoz-vault-picker-')
  )
  this.vaultPickerSetActive = []
  this.vaultPickerCreated = []
  this.vaultPickerRemovedRecents = []
  ensureFixtureVaultsExist()
})

After(function (this: VaultPickerWorld) {
  if (this.vaultPickerTmpDir && fs.existsSync(this.vaultPickerTmpDir)) {
    fs.rmSync(this.vaultPickerTmpDir, { recursive: true, force: true })
  }
})

function bootstrapWindow(world: VaultPickerWorld): void {
  world.dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    runScripts: 'dangerously',
    resources: 'usable',
  })
  const config: VaultConfigShape = world.vaultConfig ?? {
    lastOpened: null,
    recents: [],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(world.dom.window as any).todoz = {
    readTodos: async () => [],
    writeFile: async () => {},
    runOllama: async () => '',
    today: '2026-05-08',
    getVaultConfig: async (): Promise<VaultConfigShape> => config,
    openFolderPicker: async (): Promise<string | null> =>
      world.pickerReturnPath ?? null,
    createVault: async (vp: string): Promise<void> => {
      world.vaultPickerCreated!.push(vp)
      // Mirror real behavior so "todos" exists in the target folder afterward.
      fs.mkdirSync(path.join(vp, 'todos'), { recursive: true })
      fs.mkdirSync(path.join(vp, 'archive', 'todos'), { recursive: true })
    },
    setActiveVault: async (vp: string): Promise<void> => {
      world.vaultPickerSetActive!.push(vp)
    },
    removeRecent: async (vp: string): Promise<void> => {
      world.vaultPickerRemovedRecents!.push(vp)
      config.recents = config.recents.filter((r) => r !== vp)
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

// ---------------- Given steps ----------------

Given('no vault config file exists', function (this: VaultPickerWorld) {
  this.vaultConfigPath = path.join(this.vaultPickerTmpDir!, 'vault-config.json')
  if (fs.existsSync(this.vaultConfigPath)) fs.unlinkSync(this.vaultConfigPath)
  this.vaultConfig = { lastOpened: null, recents: [] }
})

Given('the vault-picker is shown', async function (this: VaultPickerWorld) {
  if (!this.dom) {
    this.vaultConfig = { lastOpened: null, recents: [] }
    bootstrapWindow(this)
    await mountApp(this.document.body)
  }
  const picker = this.document.querySelector('[data-vault-picker]')
  expect(picker, 'expected the vault-picker to be visible').to.not.equal(null)
})

Given(
  'the vault-picker is shown with two recents',
  async function (this: VaultPickerWorld) {
    this.vaultConfig = {
      lastOpened: null,
      recents: [ALPHA_PATH, BETA_PATH],
    }
    bootstrapWindow(this)
    await mountApp(this.document.body)
    const rows = this.document.querySelectorAll(
      '[data-vault-picker] [data-recent-row]'
    )
    expect(rows.length).to.equal(2)
  }
)

Given(
  'the OS folder picker will return an empty target folder',
  function (this: VaultPickerWorld) {
    const target = path.join(this.vaultPickerTmpDir!, 'new-vault')
    fs.mkdirSync(target, { recursive: true })
    this.pickerReturnPath = target
  }
)

Given(
  'the OS folder picker will return a folder containing {string}',
  function (this: VaultPickerWorld, subdir: string) {
    // We use the alpha fixture vault, which already contains a todos/ subdir.
    expect(subdir, 'expected scenario subdir to be "todos"').to.equal('todos')
    this.pickerReturnPath = ALPHA_PATH
  }
)

Given(
  'the vault config lists two previously opened vaults',
  function (this: VaultPickerWorld) {
    this.vaultConfig = {
      lastOpened: null,
      recents: [ALPHA_PATH, BETA_PATH],
    }
  }
)

Given(
  "the vault config's last-opened vault exists on disk",
  function (this: VaultPickerWorld) {
    this.vaultConfig = {
      lastOpened: ALPHA_PATH,
      recents: [ALPHA_PATH],
    }
  }
)

Given('the main todo list is shown', async function (this: VaultPickerWorld) {
  this.vaultConfig = {
    lastOpened: ALPHA_PATH,
    recents: [ALPHA_PATH],
  }
  bootstrapWindow(this)
  await mountApp(this.document.body)
  expect(
    this.document.querySelector('[data-main-view]'),
    'expected main view to be visible'
  ).to.not.equal(null)
  expect(
    this.document.querySelector('[data-vault-picker]'),
    'expected the vault-picker to be hidden'
  ).to.equal(null)
})

// ---------------- When steps ----------------

When('the app launches', async function (this: VaultPickerWorld) {
  bootstrapWindow(this)
  await mountApp(this.document.body)
})

When('the vault-picker loads', async function (this: VaultPickerWorld) {
  bootstrapWindow(this)
  await mountApp(this.document.body)
})

When('the user clicks {string}', async function (
  this: VaultPickerWorld,
  label: string
) {
  const buttons = Array.from(this.document.querySelectorAll('button'))
  const match = buttons.find((b) => b.textContent?.trim() === label)
  expect(match, `expected a button labelled "${label}"`).to.not.equal(undefined)
  ;(match as HTMLButtonElement).click()
  await tick(20)
})

When('the user clicks the first recent row', async function (
  this: VaultPickerWorld
) {
  const row = this.document.querySelector(
    '[data-vault-picker] [data-recent-row]'
  ) as HTMLElement | null
  expect(row, 'expected at least one recent row').to.not.equal(null)
  row!.click()
  await tick(20)
})

When(
  'the user hovers the first recent row and clicks the remove icon',
  async function (this: VaultPickerWorld) {
    const row = this.document.querySelector(
      '[data-vault-picker] [data-recent-row]'
    ) as HTMLElement | null
    expect(row, 'expected at least one recent row').to.not.equal(null)
    const enter = new this.dom!.window.MouseEvent('mouseenter', {
      bubbles: true,
      cancelable: true,
    })
    row!.dispatchEvent(enter)
    const removeBtn = row!.querySelector(
      '[data-remove-recent]'
    ) as HTMLElement | null
    expect(removeBtn, 'expected a remove icon on the first recent row').to.not.equal(
      null
    )
    removeBtn!.click()
    await tick(20)
  }
)

When(
  'the user clicks the {string} icon button',
  async function (this: VaultPickerWorld, ariaLabel: string) {
    const btn = this.document.querySelector(
      `[aria-label="${ariaLabel}"]`
    ) as HTMLElement | null
    expect(btn, `expected an icon button labelled "${ariaLabel}"`).to.not.equal(
      null
    )
    btn!.click()
    await tick(20)
  }
)

// ---------------- Then steps ----------------

Then('the vault-picker is not shown', function (this: VaultPickerWorld) {
  expect(this.document.querySelector('[data-vault-picker]')).to.equal(null)
})

Then('the recents list is empty', function (this: VaultPickerWorld) {
  const rows = this.document.querySelectorAll(
    '[data-vault-picker] [data-recent-row]'
  )
  expect(rows.length).to.equal(0)
})

Then(
  'the {string} button is visible',
  function (this: VaultPickerWorld, label: string) {
    const buttons = Array.from(
      this.document.querySelectorAll('[data-vault-picker] button')
    )
    const match = buttons.find((b) => b.textContent?.trim() === label)
    expect(match, `expected a button labelled "${label}" inside the picker`).to.not.equal(
      undefined
    )
  }
)

Then(
  '{string} exists in the target folder',
  function (this: VaultPickerWorld, subdir: string) {
    expect(this.pickerReturnPath, 'pickerReturnPath set').to.not.equal(undefined)
    const full = path.join(this.pickerReturnPath!, subdir)
    expect(fs.existsSync(full), `expected ${full} to exist`).to.equal(true)
  }
)

Then(
  'the main todo list is shown against the target folder',
  function (this: VaultPickerWorld) {
    const main = this.document.querySelector('[data-main-view]')
    expect(main, 'expected the main view').to.not.equal(null)
    expect(main!.getAttribute('data-vault-path')).to.equal(this.pickerReturnPath)
  }
)

Then(
  'the main todo list is shown against the selected folder',
  function (this: VaultPickerWorld) {
    const main = this.document.querySelector('[data-main-view]')
    expect(main, 'expected the main view').to.not.equal(null)
    expect(main!.getAttribute('data-vault-path')).to.equal(this.pickerReturnPath)
  }
)

Then(
  "the main todo list is shown against the first recent's vault path",
  function (this: VaultPickerWorld) {
    const main = this.document.querySelector('[data-main-view]')
    expect(main, 'expected the main view').to.not.equal(null)
    expect(main!.getAttribute('data-vault-path')).to.equal(ALPHA_PATH)
  }
)

Then(
  'the main todo list is shown against the last-opened vault',
  function (this: VaultPickerWorld) {
    const main = this.document.querySelector('[data-main-view]')
    expect(main, 'expected the main view').to.not.equal(null)
    expect(main!.getAttribute('data-vault-path')).to.equal(
      this.vaultConfig!.lastOpened
    )
  }
)

Then(
  'the recents list shows one row per vault in most-recent-first order',
  function (this: VaultPickerWorld) {
    const rows = Array.from(
      this.document.querySelectorAll('[data-vault-picker] [data-recent-row]')
    )
    const paths = rows.map((r) => r.getAttribute('data-vault-path'))
    expect(paths).to.deep.equal(this.vaultConfig!.recents)
  }
)

Then(
  'each recent row shows the folder name and absolute path',
  function (this: VaultPickerWorld) {
    const rows = Array.from(
      this.document.querySelectorAll('[data-vault-picker] [data-recent-row]')
    )
    expect(rows.length).to.be.greaterThan(0)
    rows.forEach((r) => {
      const vaultPath = r.getAttribute('data-vault-path') as string
      const name = r
        .querySelector('[data-recent-name]')
        ?.textContent?.trim()
      const pathEl = r
        .querySelector('[data-recent-path]')
        ?.textContent?.trim()
      expect(name).to.equal(path.basename(vaultPath))
      expect(pathEl).to.equal(vaultPath)
    })
  }
)

Then(
  'the first recent row is no longer in the recents list',
  function (this: VaultPickerWorld) {
    const rows = Array.from(
      this.document.querySelectorAll('[data-vault-picker] [data-recent-row]')
    )
    expect(rows.length).to.equal(1)
    expect(rows[0].getAttribute('data-vault-path')).to.equal(BETA_PATH)
  }
)

Then(
  "the first recent's folder still exists on disk",
  function () {
    expect(fs.existsSync(ALPHA_PATH)).to.equal(true)
  }
)
