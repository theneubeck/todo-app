import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

type Write = { filePath: string; content: string }

type TodozMock = {
  readTodos: () => Promise<Task[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  archiveFile: (filename: string) => Promise<void>
  runOllama: (prompt: string) => Promise<string>
  __writes: Write[]
  __archives: string[]
}

const RAW_BUY_MILK_NEAR_DONE =
  '---\ntype: task\ntitle: "Buy milk"\nstatus: todo\ntags: [errands]\ncreated: 2026-05-08\n---\n- [x] step 1\n- [ ] step 2\n'

const RAW_BUY_MILK_ALL_DONE =
  '---\ntype: task\ntitle: "Buy milk"\nstatus: done\ntags: [errands]\ncreated: 2026-05-08\n---\n- [x] step 1\n- [x] step 2\n'

function buildBuyMilkNearDone(): Task {
  return {
    slug: 'buy-milk',
    filePath: '/abs/test/fixtures/vault/todos/buy-milk-2026-05-08.md',
    title: 'Buy milk',
    status: 'todo',
    tags: ['errands'],
    created: '2026-05-08',
    raw: RAW_BUY_MILK_NEAR_DONE,
    subtasks: [
      { index: 0, label: 'step 1', done: true },
      { index: 1, label: 'step 2', done: false },
    ],
  }
}

function buildBuyMilkAllDone(): Task {
  return {
    slug: 'buy-milk',
    filePath: '/abs/test/fixtures/vault/todos/buy-milk-2026-05-08.md',
    title: 'Buy milk',
    status: 'done',
    tags: ['errands'],
    created: '2026-05-08',
    raw: RAW_BUY_MILK_ALL_DONE,
    subtasks: [
      { index: 0, label: 'step 1', done: true },
      { index: 1, label: 'step 2', done: true },
    ],
  }
}

function setupDom(tasks: Task[]): { dom: JSDOM; todoz: TodozMock } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const writes: Write[] = []
  const archives: string[] = []
  const todoz: TodozMock = {
    __writes: writes,
    __archives: archives,
    async readTodos() {
      return tasks
    },
    async writeFile(filePath: string, content: string) {
      writes.push({ filePath, content })
    },
    async archiveFile(filename: string) {
      archives.push(filename)
    },
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
  return { dom, todoz }
}

function tick(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function readRemainingCount(dom: JSDOM): number {
  const el = dom.window.document.querySelector('[data-remaining-count]')
  const text = el?.textContent?.trim() ?? ''
  const m = /^(\d+)\s/.exec(text)
  expect(m, `remaining-count parses an integer: ${text}`).to.not.equal(null)
  return parseInt(m![1], 10)
}

describe('Status reconciliation in render', () => {
  let dom: JSDOM

  beforeEach(() => {
    // Restored per-test in each it() to allow distinct fixtures.
  })

  it('decreases the remaining count by 1 when the last unchecked subtask is checked', async () => {
    const tasks = [buildBuyMilkNearDone()]
    const setup = setupDom(tasks)
    dom = setup.dom
    await mountApp(dom.window.document.body)
    const before = readRemainingCount(dom)
    // Expand the buy-milk row first (combined tasks need expansion to expose subtasks).
    const row = dom.window.document.querySelector(
      '[data-task="buy-milk"]'
    ) as HTMLElement
    if (row.getAttribute('data-expanded') !== 'true') {
      const taskRow = row.querySelector('[data-task-row]') as HTMLElement
      taskRow.click()
      await tick(10)
    }
    const subtasks = row.querySelectorAll('[data-subtask-list] [data-subtask]')
    let target: Element | null = null
    for (const s of Array.from(subtasks)) {
      const t = s.querySelector('[data-subtask-title]')
      if (t?.textContent?.trim() === 'step 2') {
        target = s
        break
      }
    }
    expect(target, 'step 2 subtask row').to.not.equal(null)
    const cb = target!.querySelector(
      '[data-checkbox-wrapper] input[type="checkbox"]'
    ) as HTMLInputElement
    cb.click()
    await tick(10)
    const after = readRemainingCount(dom)
    expect(after).to.equal(before - 1)
  })

  it('increases the remaining count by 1 when a subtask is unchecked from an all-done state', async () => {
    const tasks = [buildBuyMilkAllDone()]
    const setup = setupDom(tasks)
    dom = setup.dom
    await mountApp(dom.window.document.body)
    const before = readRemainingCount(dom)
    const row = dom.window.document.querySelector(
      '[data-task="buy-milk"]'
    ) as HTMLElement
    if (row.getAttribute('data-expanded') !== 'true') {
      const taskRow = row.querySelector('[data-task-row]') as HTMLElement
      taskRow.click()
      await tick(10)
    }
    const subtasks = row.querySelectorAll('[data-subtask-list] [data-subtask]')
    let target: Element | null = null
    for (const s of Array.from(subtasks)) {
      const t = s.querySelector('[data-subtask-title]')
      if (t?.textContent?.trim() === 'step 1') {
        target = s
        break
      }
    }
    expect(target, 'step 1 subtask row').to.not.equal(null)
    const cb = target!.querySelector(
      '[data-checkbox-wrapper] input[type="checkbox"]'
    ) as HTMLInputElement
    cb.click()
    await tick(10)
    const after = readRemainingCount(dom)
    expect(after).to.equal(before + 1)
  })
})
