import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import { mountApp } from '../../src/renderer/index'
import type { Task } from '../../src/renderer/data/parseTodo'

interface TodozMock {
  readTodos: () => Promise<Task[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  runOllama: (prompt: string) => Promise<string>
  today?: string
  getVaultConfig: () => Promise<{ lastOpened: string | null; recents: string[] }>
  openFolderPicker: () => Promise<string | null>
  createVault: (vaultPath: string) => Promise<void>
  setActiveVault: (vaultPath: string) => Promise<void>
  removeRecent: (vaultPath: string) => Promise<void>
  __writeFileCalls: { path: string; content: string }[]
}

function setupDom(vaultPath: string): { dom: JSDOM; todoz: TodozMock } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const writeFileCalls: { path: string; content: string }[] = []
  const todoz: TodozMock = {
    today: '2026-05-11',
    __writeFileCalls: writeFileCalls,
    async readTodos() {
      return []
    },
    async writeFile(filePath: string, content: string) {
      writeFileCalls.push({ path: filePath, content })
    },
    async runOllama() {
      return ''
    },
    async getVaultConfig() {
      return { lastOpened: vaultPath, recents: [vaultPath] }
    },
    async openFolderPicker() {
      return null
    },
    async createVault() {},
    async setActiveVault() {},
    async removeRecent() {},
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

describe('Empty active vault', () => {
  let dom: JSDOM
  let todoz: TodozMock
  const ACTIVE_VAULT = '/abs/alpha'

  beforeEach(async () => {
    const set = setupDom(ACTIVE_VAULT)
    dom = set.dom
    todoz = set.todoz
    await mountApp(dom.window.document.body)
  })

  it('writes the first /add task into the active vault todos directory', async () => {
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add buy milk'
    const ev = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(ev)
    await tick(10)
    expect(todoz.__writeFileCalls.length).to.equal(1)
    expect(todoz.__writeFileCalls[0].path.startsWith(`${ACTIVE_VAULT}/todos/`)).to.equal(
      true
    )
  })

  it('does not write anywhere under the repo vault directory', async () => {
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add buy milk'
    const ev = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(ev)
    await tick(10)
    expect(todoz.__writeFileCalls.length).to.equal(1)
    expect(todoz.__writeFileCalls[0].path.startsWith('vault/todos')).to.equal(false)
  })
})
