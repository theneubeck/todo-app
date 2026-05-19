import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

const TASK_A: Task = {
  slug: 'buy-milk',
  filePath: 'test/fixtures/vault/todos/buy-milk.md',
  title: 'Buy milk',
  status: 'todo',
  tags: [],
  created: '2026-05-19',
  raw: '---\ntype: task\ntitle: "Buy milk"\nstatus: todo\ntags: []\ncreated: 2026-05-19\n---\n',
  subtasks: [],
}

const TASK_B: Task = {
  slug: 'buy-milk',
  filePath: 'test/fixtures/vault/todos/buy-milk.md',
  title: 'Buy milk',
  status: 'todo',
  due: '2026-05-30',
  tags: [],
  created: '2026-05-19',
  raw: '---\ntype: task\ntitle: "Buy milk"\nstatus: todo\ndue: 2026-05-30\ntags: []\ncreated: 2026-05-19\n---\n',
  subtasks: [],
}

// Task with raw that has no status: line — covers setDueInRaw fallback insertAt=fmLines.length
const TASK_NO_STATUS: Task = {
  slug: 'no-status',
  filePath: 'test/fixtures/vault/todos/no-status.md',
  title: 'No status',
  status: 'todo',
  tags: [],
  created: '2026-05-19',
  raw: '---\ntype: task\ntitle: "No status"\ntags: []\ncreated: 2026-05-19\n---\n',
  subtasks: [],
}

type TodozMock = {
  readTodos: () => Promise<Task[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  runOllama: (prompt: string) => Promise<string>
  today: string
  lastWrite?: { filePath: string; content: string }
}

function buildDom(tasks: Task[]): { dom: JSDOM; mock: TodozMock } {
  const mock: TodozMock = {
    readTodos: async () => tasks,
    writeFile: async (filePath: string, content: string) => {
      mock.lastWrite = { filePath, content }
    },
    runOllama: async () => '',
    today: '2026-05-19',
  }
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    runScripts: 'dangerously',
    resources: 'usable',
  })
  ;(dom.window as unknown as { todoz: TodozMock }).todoz = mock
  return { dom, mock }
}

describe('Set Due Date — row icon', () => {
  let dom: JSDOM
  let doc: Document
  let mock: TodozMock

  describe('with undated task (Task A)', () => {
    beforeEach(async () => {
      const built = buildDom([TASK_A])
      dom = built.dom
      mock = built.mock
      const g = globalThis as unknown as { window: Window; document: Document }
      g.window = dom.window as unknown as Window
      g.document = dom.window.document
      doc = dom.window.document
      await mountApp(doc.body)
    })

    it('renders the calendar icon on each task row', () => {
      const icons = doc.querySelectorAll('[data-set-due]')
      expect(icons.length).to.be.greaterThan(0)
    })

    it('shows a date input when the icon is clicked', () => {
      const setDueBtn = doc.querySelector('[data-set-due]') as HTMLElement
      expect(setDueBtn, '[data-set-due] should exist').to.not.equal(null)
      setDueBtn.click()
      const input = doc.querySelector('[data-due-input]')
      expect(input, '[data-due-input] should appear after click').to.not.equal(null)
    })

    it('calls writeFile with updated due date on Enter', async () => {
      const setDueBtn = doc.querySelector('[data-set-due]') as HTMLElement
      setDueBtn.click()
      const input = doc.querySelector('[data-due-input]') as HTMLInputElement
      expect(input).to.not.equal(null)
      input.value = '2026-07-01'
      const ev = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
      input.dispatchEvent(ev)
      // Allow microtasks to settle
      await new Promise((r) => setTimeout(r, 10))
      expect(mock.lastWrite, 'writeFile should have been called').to.not.equal(undefined)
      expect(mock.lastWrite!.content).to.contain('due: 2026-07-01')
    })

    it('removes the input without writing on Escape', () => {
      const setDueBtn = doc.querySelector('[data-set-due]') as HTMLElement
      setDueBtn.click()
      const input = doc.querySelector('[data-due-input]') as HTMLInputElement
      expect(input).to.not.equal(null)
      const ev = new dom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
      input.dispatchEvent(ev)
      const inputAfter = doc.querySelector('[data-due-input]')
      expect(inputAfter, '[data-due-input] should be gone after Escape').to.equal(null)
      expect(mock.lastWrite, 'writeFile should not have been called').to.equal(undefined)
    })
  })

  describe('with dated task (Task B)', () => {
    beforeEach(async () => {
      const built = buildDom([TASK_B])
      dom = built.dom
      mock = built.mock
      const g = globalThis as unknown as { window: Window; document: Document }
      g.window = dom.window as unknown as Window
      g.document = dom.window.document
      doc = dom.window.document
      await mountApp(doc.body)
    })

    it('pre-fills the input with an existing due date', () => {
      const setDueBtn = doc.querySelector('[data-set-due]') as HTMLElement
      expect(setDueBtn).to.not.equal(null)
      setDueBtn.click()
      const input = doc.querySelector('[data-due-input]') as HTMLInputElement
      expect(input).to.not.equal(null)
      expect(input.value).to.equal('2026-05-30')
    })

    it('calls writeFile with due removed when input is cleared', async () => {
      const setDueBtn = doc.querySelector('[data-set-due]') as HTMLElement
      setDueBtn.click()
      const input = doc.querySelector('[data-due-input]') as HTMLInputElement
      expect(input).to.not.equal(null)
      // Clear the pre-filled value
      input.value = ''
      const ev = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
      input.dispatchEvent(ev)
      await new Promise((r) => setTimeout(r, 10))
      expect(mock.lastWrite, 'writeFile should have been called').to.not.equal(undefined)
      expect(mock.lastWrite!.content).to.not.contain('due:')
    })

    it('calls writeFile replacing the existing due date on Enter', async () => {
      const setDueBtn = doc.querySelector('[data-set-due]') as HTMLElement
      setDueBtn.click()
      const input = doc.querySelector('[data-due-input]') as HTMLInputElement
      expect(input).to.not.equal(null)
      input.value = '2026-08-01'
      const ev = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
      input.dispatchEvent(ev)
      await new Promise((r) => setTimeout(r, 10))
      expect(mock.lastWrite, 'writeFile should have been called').to.not.equal(undefined)
      expect(mock.lastWrite!.content).to.contain('due: 2026-08-01')
    })
  })

  describe('with task that has no status line in raw', () => {
    beforeEach(async () => {
      const built = buildDom([TASK_NO_STATUS])
      dom = built.dom
      mock = built.mock
      const g = globalThis as unknown as { window: Window; document: Document }
      g.window = dom.window as unknown as Window
      g.document = dom.window.document
      doc = dom.window.document
      await mountApp(doc.body)
    })

    it('inserts due at end of frontmatter when no status line exists', async () => {
      const setDueBtn = doc.querySelector('[data-set-due]') as HTMLElement
      setDueBtn.click()
      const input = doc.querySelector('[data-due-input]') as HTMLInputElement
      expect(input).to.not.equal(null)
      input.value = '2026-09-01'
      const ev = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
      input.dispatchEvent(ev)
      await new Promise((r) => setTimeout(r, 10))
      expect(mock.lastWrite, 'writeFile should have been called').to.not.equal(undefined)
      expect(mock.lastWrite!.content).to.contain('due: 2026-09-01')
    })
  })

  describe('edge cases', () => {
    beforeEach(async () => {
      const built = buildDom([TASK_A])
      dom = built.dom
      mock = built.mock
      const g = globalThis as unknown as { window: Window; document: Document }
      g.window = dom.window as unknown as Window
      g.document = dom.window.document
      doc = dom.window.document
      await mountApp(doc.body)
    })

    it('does not write when Enter is pressed with an empty date input', async () => {
      const setDueBtn = doc.querySelector('[data-set-due]') as HTMLElement
      setDueBtn.click()
      const input = doc.querySelector('[data-due-input]') as HTMLInputElement
      expect(input).to.not.equal(null)
      // Leave input.value as '' (empty)
      const ev = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
      input.dispatchEvent(ev)
      await new Promise((r) => setTimeout(r, 10))
      expect(mock.lastWrite, 'writeFile should NOT have been called with empty date').to.equal(undefined)
      // Input should be removed regardless
      const inputAfter = doc.querySelector('[data-due-input]')
      expect(inputAfter, '[data-due-input] should be removed').to.equal(null)
    })
  })
})
