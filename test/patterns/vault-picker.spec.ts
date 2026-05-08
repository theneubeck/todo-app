import { describe, it } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import { mountApp } from '../../src/renderer/index'

interface VaultConfigShape {
  lastOpened: string | null
  recents: string[]
}

interface TodozMock {
  readTodos: () => Promise<unknown[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  runOllama: (prompt: string) => Promise<string>
  today?: string
  getVaultConfig: () => Promise<VaultConfigShape>
  openFolderPicker: () => Promise<string | null>
  createVault: (vaultPath: string) => Promise<void>
  setActiveVault: (vaultPath: string) => Promise<void>
  removeRecent: (vaultPath: string) => Promise<void>
  __pickerReturn: string | null
  __createVaultCalls: string[]
  __setActiveVaultCalls: string[]
  __removeRecentCalls: string[]
  __openFolderPickerCalls: number
}

function setupDom(config: VaultConfigShape): { dom: JSDOM; todoz: TodozMock } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const createVaultCalls: string[] = []
  const setActiveVaultCalls: string[] = []
  const removeRecentCalls: string[] = []
  const todoz: TodozMock = {
    today: '2026-05-08',
    __pickerReturn: null,
    __createVaultCalls: createVaultCalls,
    __setActiveVaultCalls: setActiveVaultCalls,
    __removeRecentCalls: removeRecentCalls,
    __openFolderPickerCalls: 0,
    async readTodos() {
      return []
    },
    async writeFile() {},
    async runOllama() {
      return ''
    },
    async getVaultConfig() {
      return config
    },
    async openFolderPicker() {
      todoz.__openFolderPickerCalls += 1
      return todoz.__pickerReturn
    },
    async createVault(vaultPath: string) {
      createVaultCalls.push(vaultPath)
    },
    async setActiveVault(vaultPath: string) {
      setActiveVaultCalls.push(vaultPath)
    },
    async removeRecent(vaultPath: string) {
      removeRecentCalls.push(vaultPath)
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

function tick(ms = 0): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function findButtonByText(doc: Document, text: string): HTMLButtonElement | null {
  const buttons = Array.from(doc.querySelectorAll('button'))
  for (const b of buttons) {
    if (b.textContent?.trim() === text) return b as HTMLButtonElement
  }
  return null
}

describe('VaultPicker view', () => {
  it('renders both action buttons when shown', async () => {
    const { dom } = setupDom({ lastOpened: null, recents: [] })
    await mountApp(dom.window.document.body)
    const picker = dom.window.document.querySelector('[data-vault-picker]')
    expect(picker).to.not.equal(null)
    expect(findButtonByText(dom.window.document, 'Create new vault')).to.not.equal(null)
    expect(findButtonByText(dom.window.document, 'Open folder as vault')).to.not.equal(null)
  })

  it('renders an empty recents section when config has no recents', async () => {
    const { dom } = setupDom({ lastOpened: null, recents: [] })
    await mountApp(dom.window.document.body)
    const rows = dom.window.document.querySelectorAll(
      '[data-vault-picker] [data-recent-row]'
    )
    expect(rows.length).to.equal(0)
  })

  it('renders one row per recent vault in most-recent-first order', async () => {
    const { dom } = setupDom({
      lastOpened: null,
      recents: ['/abs/alpha', '/abs/beta'],
    })
    await mountApp(dom.window.document.body)
    const rows = Array.from(
      dom.window.document.querySelectorAll('[data-vault-picker] [data-recent-row]')
    )
    expect(rows.length).to.equal(2)
    expect(rows[0].getAttribute('data-vault-path')).to.equal('/abs/alpha')
    expect(rows[1].getAttribute('data-vault-path')).to.equal('/abs/beta')
  })

  it('renders the folder name on each recent row', async () => {
    const { dom } = setupDom({
      lastOpened: null,
      recents: ['/abs/alpha', '/abs/beta'],
    })
    await mountApp(dom.window.document.body)
    const names = Array.from(
      dom.window.document.querySelectorAll(
        '[data-vault-picker] [data-recent-row] [data-recent-name]'
      )
    ).map((n) => n.textContent?.trim())
    expect(names).to.deep.equal(['alpha', 'beta'])
  })

  it('renders the absolute path on each recent row', async () => {
    const { dom } = setupDom({
      lastOpened: null,
      recents: ['/abs/alpha', '/abs/beta'],
    })
    await mountApp(dom.window.document.body)
    const paths = Array.from(
      dom.window.document.querySelectorAll(
        '[data-vault-picker] [data-recent-row] [data-recent-path]'
      )
    ).map((n) => n.textContent?.trim())
    expect(paths).to.deep.equal(['/abs/alpha', '/abs/beta'])
  })

  it('calls window.todoz.openFolderPicker on Create new vault click', async () => {
    const { dom, todoz } = setupDom({ lastOpened: null, recents: [] })
    todoz.__pickerReturn = null
    await mountApp(dom.window.document.body)
    const btn = findButtonByText(dom.window.document, 'Create new vault')!
    btn.click()
    await tick(10)
    expect(todoz.__openFolderPickerCalls).to.equal(1)
  })

  it('calls window.todoz.createVault with the picker-returned path on Create new vault confirm', async () => {
    const { dom, todoz } = setupDom({ lastOpened: null, recents: [] })
    todoz.__pickerReturn = '/abs/new-vault'
    await mountApp(dom.window.document.body)
    const btn = findButtonByText(dom.window.document, 'Create new vault')!
    btn.click()
    await tick(10)
    expect(todoz.__createVaultCalls).to.deep.equal(['/abs/new-vault'])
  })

  it('calls window.todoz.openFolderPicker on Open folder as vault click', async () => {
    const { dom, todoz } = setupDom({ lastOpened: null, recents: [] })
    todoz.__pickerReturn = null
    await mountApp(dom.window.document.body)
    const btn = findButtonByText(dom.window.document, 'Open folder as vault')!
    btn.click()
    await tick(10)
    expect(todoz.__openFolderPickerCalls).to.equal(1)
  })

  it('calls window.todoz.setActiveVault with the picker-returned path on Open folder as vault confirm', async () => {
    const { dom, todoz } = setupDom({ lastOpened: null, recents: [] })
    todoz.__pickerReturn = '/abs/existing-vault'
    await mountApp(dom.window.document.body)
    const btn = findButtonByText(dom.window.document, 'Open folder as vault')!
    btn.click()
    await tick(10)
    expect(todoz.__setActiveVaultCalls).to.deep.equal(['/abs/existing-vault'])
  })

  it('calls window.todoz.setActiveVault with the recent path when a recent row is clicked', async () => {
    const { dom, todoz } = setupDom({
      lastOpened: null,
      recents: ['/abs/alpha', '/abs/beta'],
    })
    await mountApp(dom.window.document.body)
    const firstRow = dom.window.document.querySelector(
      '[data-vault-picker] [data-recent-row]'
    ) as HTMLElement
    firstRow.click()
    await tick(10)
    expect(todoz.__setActiveVaultCalls).to.deep.equal(['/abs/alpha'])
  })

  it('reveals the remove icon when a recent row is hovered', async () => {
    const { dom } = setupDom({
      lastOpened: null,
      recents: ['/abs/alpha', '/abs/beta'],
    })
    await mountApp(dom.window.document.body)
    const removeBtn = dom.window.document.querySelector(
      '[data-vault-picker] [data-recent-row] [data-remove-recent]'
    )
    expect(removeBtn).to.not.equal(null)
    expect(removeBtn?.getAttribute('aria-label')).to.equal('Remove from recents')
  })

  it('calls window.todoz.removeRecent when the remove icon is clicked', async () => {
    const { dom, todoz } = setupDom({
      lastOpened: null,
      recents: ['/abs/alpha', '/abs/beta'],
    })
    await mountApp(dom.window.document.body)
    const removeBtn = dom.window.document.querySelector(
      '[data-vault-picker] [data-recent-row] [data-remove-recent]'
    ) as HTMLElement
    removeBtn.click()
    await tick(10)
    expect(todoz.__removeRecentCalls).to.deep.equal(['/abs/alpha'])
  })

  it('removes the DOM row when the remove icon is clicked', async () => {
    const { dom } = setupDom({
      lastOpened: null,
      recents: ['/abs/alpha', '/abs/beta'],
    })
    await mountApp(dom.window.document.body)
    const removeBtn = dom.window.document.querySelector(
      '[data-vault-picker] [data-recent-row] [data-remove-recent]'
    ) as HTMLElement
    removeBtn.click()
    await tick(10)
    const rows = Array.from(
      dom.window.document.querySelectorAll('[data-vault-picker] [data-recent-row]')
    )
    expect(rows.length).to.equal(1)
    expect(rows[0].getAttribute('data-vault-path')).to.equal('/abs/beta')
  })

  it('does not call setActiveVault when the remove icon is clicked', async () => {
    const { dom, todoz } = setupDom({
      lastOpened: null,
      recents: ['/abs/alpha', '/abs/beta'],
    })
    await mountApp(dom.window.document.body)
    const removeBtn = dom.window.document.querySelector(
      '[data-vault-picker] [data-recent-row] [data-remove-recent]'
    ) as HTMLElement
    removeBtn.click()
    await tick(10)
    expect(todoz.__setActiveVaultCalls).to.deep.equal([])
  })

  it('does not call createVault when Create new vault picker is cancelled', async () => {
    const { dom, todoz } = setupDom({ lastOpened: null, recents: [] })
    todoz.__pickerReturn = null
    await mountApp(dom.window.document.body)
    const btn = findButtonByText(dom.window.document, 'Create new vault')!
    btn.click()
    await tick(10)
    expect(todoz.__createVaultCalls).to.deep.equal([])
    expect(todoz.__setActiveVaultCalls).to.deep.equal([])
  })

  it('does not call setActiveVault when Open folder as vault picker is cancelled', async () => {
    const { dom, todoz } = setupDom({ lastOpened: null, recents: [] })
    todoz.__pickerReturn = null
    await mountApp(dom.window.document.body)
    const btn = findButtonByText(dom.window.document, 'Open folder as vault')!
    btn.click()
    await tick(10)
    expect(todoz.__setActiveVaultCalls).to.deep.equal([])
  })

  it('renders a row name from a path with a trailing slash', async () => {
    const { dom } = setupDom({
      lastOpened: null,
      recents: ['/abs/alpha/'],
    })
    await mountApp(dom.window.document.body)
    const name = dom.window.document.querySelector(
      '[data-vault-picker] [data-recent-row] [data-recent-name]'
    )
    expect(name?.textContent?.trim()).to.equal('alpha')
  })

  it('falls back to the raw path for an empty recent path string', async () => {
    const { dom } = setupDom({ lastOpened: null, recents: [''] })
    await mountApp(dom.window.document.body)
    const name = dom.window.document.querySelector(
      '[data-vault-picker] [data-recent-row] [data-recent-name]'
    )
    expect(name?.textContent ?? '').to.equal('')
  })
})

describe('MainWindow shell', () => {
  it('shows the Open another vault icon button at the top of the main view', async () => {
    const { dom } = setupDom({ lastOpened: '/abs/alpha', recents: ['/abs/alpha'] })
    await mountApp(dom.window.document.body)
    const btn = dom.window.document.querySelector(
      '[data-main-view] [data-open-another-vault]'
    )
    expect(btn).to.not.equal(null)
    expect(btn?.getAttribute('aria-label')).to.equal('Open another vault')
  })

  it('toggles the picker visible when Open another vault is clicked', async () => {
    const { dom } = setupDom({ lastOpened: '/abs/alpha', recents: ['/abs/alpha'] })
    await mountApp(dom.window.document.body)
    const btn = dom.window.document.querySelector(
      '[data-open-another-vault]'
    ) as HTMLElement
    btn.click()
    await tick(10)
    expect(dom.window.document.querySelector('[data-vault-picker]')).to.not.equal(null)
  })
})

describe('App boot', () => {
  it('shows the picker when no active vault is configured', async () => {
    const { dom } = setupDom({ lastOpened: null, recents: [] })
    await mountApp(dom.window.document.body)
    expect(dom.window.document.querySelector('[data-vault-picker]')).to.not.equal(null)
    expect(dom.window.document.querySelector('[data-main-view]')).to.equal(null)
  })

  it('shows the main todo list when the configured active vault exists on disk', async () => {
    const { dom } = setupDom({ lastOpened: '/abs/alpha', recents: ['/abs/alpha'] })
    await mountApp(dom.window.document.body)
    expect(dom.window.document.querySelector('[data-main-view]')).to.not.equal(null)
    expect(
      dom.window.document.querySelector('[data-main-view]')?.getAttribute('data-vault-path')
    ).to.equal('/abs/alpha')
    expect(dom.window.document.querySelector('[data-vault-picker]')).to.equal(null)
  })
})
