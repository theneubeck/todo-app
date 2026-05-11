import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

interface TodozMock {
  readTodos: () => Promise<Task[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  runOllama: (prompt: string) => Promise<string>
  today: string
}

function setupDom(): { dom: JSDOM } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
  })
  const todoz: TodozMock = {
    today: '2026-05-11',
    async readTodos() {
      return []
    },
    async writeFile() {},
    async runOllama() {
      return ''
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(dom.window as any).todoz = todoz
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = dom.window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).document = dom.window.document
  return { dom }
}

describe('Command bar', () => {
  let dom: JSDOM

  beforeEach(() => {
    const setup = setupDom()
    dom = setup.dom
  })

  it('renders without the @name demo chip', async () => {
    await mountApp(dom.window.document.body)
    const mention = dom.window.document.querySelector(
      '[data-command-chip="mention"]'
    )
    expect(mention).to.equal(null)
  })

  it('renders without the #design demo chip', async () => {
    await mountApp(dom.window.document.body)
    const tag = dom.window.document.querySelector('[data-command-chip="tag"]')
    expect(tag).to.equal(null)
  })
})
