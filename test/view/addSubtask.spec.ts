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

const RAW_BUY_MILK =
  '---\ntype: task\ntitle: "Buy milk"\nstatus: todo\ntags: [errands]\ncreated: 2026-05-08\n---\n'
const RAW_SEND_INVOICE =
  '---\ntype: task\ntitle: "Send invoice"\nstatus: done\ntags: [work]\ncreated: 2026-05-08\n---\n'
const RAW_PREP_DECK =
  '---\ntype: task\ntitle: "Prep deck"\nstatus: todo\ntags: [work]\ncreated: 2026-05-08\n---\n- [ ] draft section 1\n- [ ] review numbers\n'
const RAW_WEEKLY_SHOP =
  '---\ntype: task\ntitle: "Weekly shop"\nstatus: todo\ntags: [errands]\ncreated: 2026-05-08\n---\n- [x] paper towels\n- [ ] coffee\n'

function buildTasks(): Task[] {
  return [
    {
      slug: 'buy-milk',
      filePath: '/abs/test/fixtures/vault/todos/buy-milk-2026-05-08.md',
      title: 'Buy milk',
      status: 'todo',
      tags: ['errands'],
      created: '2026-05-08',
      raw: RAW_BUY_MILK,
      subtasks: [],
    },
    {
      slug: 'send-invoice',
      filePath: '/abs/test/fixtures/vault/todos/send-invoice-2026-05-08.md',
      title: 'Send invoice',
      status: 'done',
      tags: ['work'],
      created: '2026-05-08',
      raw: RAW_SEND_INVOICE,
      subtasks: [],
    },
    {
      slug: 'prep-deck',
      filePath: '/abs/test/fixtures/vault/todos/prep-deck-2026-05-08.md',
      title: 'Prep deck',
      status: 'todo',
      tags: ['work'],
      created: '2026-05-08',
      raw: RAW_PREP_DECK,
      subtasks: [
        { index: 0, label: 'draft section 1', done: false },
        { index: 1, label: 'review numbers', done: false },
      ],
    },
    {
      slug: 'weekly-shop',
      filePath: '/abs/test/fixtures/vault/todos/weekly-shop-2026-05-08.md',
      title: 'Weekly shop',
      status: 'todo',
      tags: ['errands'],
      created: '2026-05-08',
      raw: RAW_WEEKLY_SHOP,
      subtasks: [
        { index: 0, label: 'paper towels', done: true },
        { index: 1, label: 'coffee', done: false },
      ],
    },
  ]
}

function setupDom(tasks: Task[] = buildTasks()): { dom: JSDOM; todoz: TodozMock } {
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

function tick(ms = 0): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function findRow(doc: Document, slug: string): HTMLElement {
  const row = doc.querySelector(`[data-task="${slug}"]`)
  if (!row) throw new Error(`row ${slug} not found`)
  return row as HTMLElement
}

describe('AddSubtask', () => {
  let dom: JSDOM
  let todoz: TodozMock

  beforeEach(() => {
    const setup = setupDom()
    dom = setup.dom
    todoz = setup.todoz
  })

  it('renders an add-subtask affordance on a simple task row', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const aff = row.querySelector('[data-add-subtask]')
    expect(aff).to.not.equal(null)
    expect(aff?.textContent ?? '').to.include('Add subtask')
  })

  it('renders no add-subtask affordance on a collapsed combined task row', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    expect(row.getAttribute('data-expanded')).to.not.equal('true')
    const aff = row.querySelector('[data-add-subtask]')
    expect(aff).to.equal(null)
  })

  it('renders an add-subtask affordance after the last subtask of an expanded combined task row', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click()
    const list = row.querySelector('[data-subtask-list]') as HTMLElement
    expect(list).to.not.equal(null)
    const last = list.lastElementChild
    expect(last).to.not.equal(null)
    expect(last!.matches('[data-add-subtask]')).to.equal(true)
  })

  it('replaces the affordance with an input on click', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const aff = row.querySelector('[data-add-subtask]') as HTMLElement
    aff.click()
    const input = row.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement | null
    expect(input).to.not.equal(null)
    const stillThere = row.querySelector('[data-add-subtask]')
    expect(stillThere).to.equal(null)
  })

  it('focuses the input when it appears', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const aff = row.querySelector('[data-add-subtask]') as HTMLElement
    aff.click()
    const input = row.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement
    expect(input).to.not.equal(null)
    expect(dom.window.document.activeElement).to.equal(input)
  })

  it('calls writeFile with addSubtask output on Enter for a combined task', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click()
    const aff = row.querySelector('[data-add-subtask]') as HTMLElement
    aff.click()
    const input = dom.window.document.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement
    input.value = 'draft outline'
    const ev = new dom.window.KeyboardEvent('keydown', { key: 'Enter' })
    input.dispatchEvent(ev)
    await tick(10)
    expect(todoz.__writes.length).to.equal(1)
    expect(todoz.__writes[0].filePath).to.match(/prep-deck-2026-05-08\.md$/)
    expect(todoz.__writes[0].content).to.match(/- \[ \] draft outline/)
    expect(todoz.__writes[0].content).to.match(/- \[ \] draft section 1/)
    expect(todoz.__writes[0].content).to.match(/- \[ \] review numbers/)
  })

  it('renders the new subtask as the last child of the parent\'s subtask list after a successful add', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click()
    const aff = row.querySelector('[data-add-subtask]') as HTMLElement
    aff.click()
    const input = dom.window.document.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement
    input.value = 'draft outline'
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter' }))
    await tick(10)
    const updated = findRow(dom.window.document, 'prep-deck')
    const subs = updated.querySelectorAll('[data-subtask-list] [data-subtask]')
    expect(subs.length).to.equal(3)
    const lastSub = subs[subs.length - 1]
    const title = lastSub.querySelector('[data-subtask-title]')
    expect(title?.textContent?.trim()).to.equal('draft outline')
  })

  it('restores the affordance after a successful add', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click()
    const aff = row.querySelector('[data-add-subtask]') as HTMLElement
    aff.click()
    const input = dom.window.document.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement
    input.value = 'draft outline'
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter' }))
    await tick(10)
    const updated = findRow(dom.window.document, 'prep-deck')
    const newAff = updated.querySelector('[data-add-subtask]')
    expect(newAff).to.not.equal(null)
    const stillInput = dom.window.document.querySelector('[data-add-subtask-input]')
    expect(stillInput).to.equal(null)
  })

  it('marks a simple task as combined after first successful add', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const aff = row.querySelector('[data-add-subtask]') as HTMLElement
    aff.click()
    const input = dom.window.document.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement
    input.value = 'buy stamps'
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter' }))
    await tick(10)
    const updated = findRow(dom.window.document, 'buy-milk')
    expect(updated.getAttribute('data-kind')).to.equal('combined')
  })

  it('marks a simple task as expanded after first successful add', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const aff = row.querySelector('[data-add-subtask]') as HTMLElement
    aff.click()
    const input = dom.window.document.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement
    input.value = 'buy stamps'
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter' }))
    await tick(10)
    const updated = findRow(dom.window.document, 'buy-milk')
    expect(updated.getAttribute('data-expanded')).to.equal('true')
  })

  it('renders the affordance below the new subtask after a simple task is converted', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const aff = row.querySelector('[data-add-subtask]') as HTMLElement
    aff.click()
    const input = dom.window.document.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement
    input.value = 'buy stamps'
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter' }))
    await tick(10)
    const updated = findRow(dom.window.document, 'buy-milk')
    const list = updated.querySelector('[data-subtask-list]') as HTMLElement
    expect(list).to.not.equal(null)
    const subs = list.querySelectorAll('[data-subtask]')
    expect(subs.length).to.equal(1)
    expect(subs[0].querySelector('[data-subtask-title]')?.textContent?.trim()).to.equal(
      'buy stamps'
    )
    const last = list.lastElementChild
    expect(last).to.not.equal(null)
    expect(last!.matches('[data-add-subtask]')).to.equal(true)
  })

  it('does not call writeFile on Esc', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const aff = row.querySelector('[data-add-subtask]') as HTMLElement
    aff.click()
    const input = dom.window.document.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement
    input.value = 'something'
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }))
    await tick(10)
    expect(todoz.__writes.length).to.equal(0)
  })

  it('tears down the input on Esc', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const aff = row.querySelector('[data-add-subtask]') as HTMLElement
    aff.click()
    const input = dom.window.document.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement
    input.value = 'something'
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }))
    await tick(10)
    const stillInput = dom.window.document.querySelector('[data-add-subtask-input]')
    expect(stillInput).to.equal(null)
    const updated = findRow(dom.window.document, 'buy-milk')
    const aff2 = updated.querySelector('[data-add-subtask]')
    expect(aff2).to.not.equal(null)
  })

  it('does not call writeFile on whitespace-only Enter', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const aff = row.querySelector('[data-add-subtask]') as HTMLElement
    aff.click()
    const input = dom.window.document.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement
    input.value = '   '
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter' }))
    await tick(10)
    expect(todoz.__writes.length).to.equal(0)
  })

  it('tears down the input on whitespace-only Enter', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const aff = row.querySelector('[data-add-subtask]') as HTMLElement
    aff.click()
    const input = dom.window.document.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement
    input.value = '   '
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter' }))
    await tick(10)
    const stillInput = dom.window.document.querySelector('[data-add-subtask-input]')
    expect(stillInput).to.equal(null)
    const updated = findRow(dom.window.document, 'buy-milk')
    const aff2 = updated.querySelector('[data-add-subtask]')
    expect(aff2).to.not.equal(null)
  })
})
