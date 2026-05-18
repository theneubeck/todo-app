import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

// ---- Fixtures ----

const RAW_TASK_A =
  '---\ntype: task\ntitle: "Review pull requests"\nstatus: todo\ndue: 2026-05-20\ntags: [work]\ncreated: 2026-05-18\n---\n- [ ] Read through comments\n'

const RAW_TASK_B =
  '---\ntype: task\ntitle: "Update project doc"\nstatus: todo\ntags: [work]\ncreated: 2026-05-18\n---\n'

const TASK_A: Task = {
  slug: 'today-flow-task-a',
  filePath: 'test/fixtures/vault/todos/today-flow-task-a-2026-05-18.md',
  title: 'Review pull requests',
  status: 'todo',
  due: '2026-05-20',
  tags: ['work'],
  created: '2026-05-18',
  raw: RAW_TASK_A,
  subtasks: [{ index: 0, label: 'Read through comments', done: false }],
}

const TASK_B: Task = {
  slug: 'today-flow-task-b',
  filePath: 'test/fixtures/vault/todos/today-flow-task-b-2026-05-18.md',
  title: 'Update project doc',
  status: 'todo',
  tags: ['work'],
  created: '2026-05-18',
  raw: RAW_TASK_B,
  subtasks: [],
}

// Slugs as they appear in today.md (full filename minus .md extension)
const TODAY_SLUG_A = 'today-flow-task-a-2026-05-18'
const TODAY_SLUG_B = 'today-flow-task-b-2026-05-18'

type WriteTodayCall = string[]
type WriteFileCall = { filePath: string; content: string }

type MockTodoz = {
  readTodos: () => Promise<Task[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  writeToday: (slugs: string[]) => Promise<void>
  readToday: () => Promise<string[]>
  runOllama: () => Promise<string>
  today: string
  __writeTodayCalls: WriteTodayCall[]
  __writeFileCalls: WriteFileCall[]
}

function setupDom(
  tasks: Task[],
  todaySlugs: string[]
): { dom: JSDOM; todoz: MockTodoz } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const writeTodayCalls: WriteTodayCall[] = []
  const writeFileCalls: WriteFileCall[] = []
  const todoz: MockTodoz = {
    today: '2026-05-18',
    __writeTodayCalls: writeTodayCalls,
    __writeFileCalls: writeFileCalls,
    readTodos: async () => tasks,
    readToday: async () => todaySlugs,
    writeFile: async (filePath: string, content: string) => {
      writeFileCalls.push({ filePath, content })
    },
    writeToday: async (slugs: string[]) => {
      writeTodayCalls.push([...slugs])
    },
    runOllama: async () => '',
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

async function navigateToToday(dom: JSDOM): Promise<void> {
  const todayEntry = dom.window.document.querySelector(
    '[data-sidebar-entry="today"]'
  ) as HTMLElement | null
  expect(todayEntry, '[data-sidebar-entry="today"]').to.not.equal(null)
  todayEntry!.click()
  await tick()
}

// ---- Tests ----

describe('TodayFlow', () => {
  describe('renders task rows from today.md wikilinks', () => {
    let dom: JSDOM

    beforeEach(async () => {
      const setup = setupDom([TASK_A, TASK_B], [TODAY_SLUG_A, TODAY_SLUG_B])
      dom = setup.dom
      await mountApp(dom.window.document.body)
      await navigateToToday(dom)
    })

    it('renders task rows from today.md wikilinks', () => {
      const rows = dom.window.document.querySelectorAll('[data-today-row]')
      expect(rows.length).to.equal(2)
    })

    it('renders tasks in the order they appear in today.md', () => {
      const rows = Array.from(
        dom.window.document.querySelectorAll('[data-today-row]')
      )
      expect(rows[0].getAttribute('data-slug')).to.equal(TODAY_SLUG_A)
      expect(rows[1].getAttribute('data-slug')).to.equal(TODAY_SLUG_B)
    })

    it('renders a Clear all link when the Today list has tasks', () => {
      const clearAll = dom.window.document.querySelector('[data-today-clear-all]')
      expect(clearAll, '[data-today-clear-all]').to.not.equal(null)
    })
  })

  describe('empty state', () => {
    let dom: JSDOM

    beforeEach(async () => {
      const setup = setupDom([TASK_A, TASK_B], [])
      dom = setup.dom
      await mountApp(dom.window.document.body)
      await navigateToToday(dom)
    })

    it('renders an empty state when today.md has no links', () => {
      const empty = dom.window.document.querySelector('[data-today-empty]')
      expect(empty, '[data-today-empty]').to.not.equal(null)
    })

    it('does not render a Clear all link when the Today list is empty', () => {
      const clearAll = dom.window.document.querySelector('[data-today-clear-all]')
      expect(clearAll, '[data-today-clear-all]').to.equal(null)
    })
  })

  describe('readToday unavailable', () => {
    it('renders an empty Today list when readToday is not defined on window.todoz', async () => {
      const { dom } = setupDom([TASK_A], [TODAY_SLUG_A])
      // Remove readToday from the mock to exercise the fallback branch.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (dom.window as any).todoz.readToday
      await mountApp(dom.window.document.body)
      await new Promise((r) => setTimeout(r, 10))
      const todayEntry = dom.window.document.querySelector(
        '[data-sidebar-entry="today"]'
      ) as HTMLElement
      todayEntry.click()
      await new Promise((r) => setTimeout(r, 10))
      const empty = dom.window.document.querySelector('[data-today-empty]')
      expect(empty, '[data-today-empty] should exist when readToday is missing').to.not.equal(null)
    })
  })

  describe('add-to-today icon on non-Today task rows', () => {
    let dom: JSDOM

    beforeEach(async () => {
      const setup = setupDom([TASK_A, TASK_B], [])
      dom = setup.dom
      await mountApp(dom.window.document.body)
      // Stay in inbox view (default)
    })

    it('renders an add-to-today icon on task rows in the inbox view', () => {
      const icons = dom.window.document.querySelectorAll('[data-add-to-today]')
      expect(icons.length).to.be.greaterThan(0)
    })
  })

  describe('clicking add-to-today', () => {
    let dom: JSDOM
    let todoz: MockTodoz

    beforeEach(async () => {
      const setup = setupDom([TASK_A, TASK_B], [])
      dom = setup.dom
      todoz = setup.todoz
      await mountApp(dom.window.document.body)
      // Stay in inbox view
    })

    it('clicking add-to-today calls writeToday with the slug appended', async () => {
      const firstIcon = dom.window.document.querySelector(
        '[data-add-to-today]'
      ) as HTMLElement | null
      expect(firstIcon, '[data-add-to-today]').to.not.equal(null)
      firstIcon!.click()
      await tick()
      expect(todoz.__writeTodayCalls.length).to.equal(1)
      // The first add-to-today icon corresponds to the first rendered task
      const written = todoz.__writeTodayCalls[0]
      expect(written.length).to.equal(1)
    })
  })

  describe('remove-from-today', () => {
    let dom: JSDOM
    let todoz: MockTodoz

    beforeEach(async () => {
      const setup = setupDom([TASK_A, TASK_B], [TODAY_SLUG_A, TODAY_SLUG_B])
      dom = setup.dom
      todoz = setup.todoz
      await mountApp(dom.window.document.body)
      await navigateToToday(dom)
    })

    it('clicking remove-from-today calls writeToday without that slug', async () => {
      const removeBtn = dom.window.document.querySelector(
        `[data-today-row][data-slug="${TODAY_SLUG_A}"] [data-remove-from-today]`
      ) as HTMLElement | null
      expect(removeBtn, '[data-remove-from-today] for task A').to.not.equal(null)
      removeBtn!.click()
      await tick()
      expect(todoz.__writeTodayCalls.length).to.equal(1)
      const remaining = todoz.__writeTodayCalls[0]
      expect(remaining).to.not.include(TODAY_SLUG_A)
      expect(remaining).to.include(TODAY_SLUG_B)
    })

    it('clicking remove-from-today does not call writeFile on the original task', async () => {
      const removeBtn = dom.window.document.querySelector(
        `[data-today-row][data-slug="${TODAY_SLUG_A}"] [data-remove-from-today]`
      ) as HTMLElement | null
      expect(removeBtn, '[data-remove-from-today] for task A').to.not.equal(null)
      removeBtn!.click()
      await tick()
      // writeFile should NOT have been called for the original task file
      const taskAWrites = todoz.__writeFileCalls.filter((w) =>
        w.filePath.includes('today-flow-task-a')
      )
      expect(taskAWrites.length).to.equal(0)
    })
  })

  describe('checking a Today task checkbox', () => {
    let dom: JSDOM
    let todoz: MockTodoz

    beforeEach(async () => {
      const setup = setupDom([TASK_A, TASK_B], [TODAY_SLUG_A, TODAY_SLUG_B])
      dom = setup.dom
      todoz = setup.todoz
      await mountApp(dom.window.document.body)
      await navigateToToday(dom)
    })

    it('checking a Today task checkbox calls writeFile with status done on the original', async () => {
      const checkbox = dom.window.document.querySelector(
        `[data-today-row][data-slug="${TODAY_SLUG_B}"] input[type="checkbox"]`
      ) as HTMLInputElement | null
      expect(checkbox, 'checkbox in today row B').to.not.equal(null)
      checkbox!.click()
      await tick()
      const taskBWrites = todoz.__writeFileCalls.filter((w) =>
        w.filePath.includes('today-flow-task-b')
      )
      expect(taskBWrites.length).to.be.greaterThan(0)
      expect(taskBWrites[0].content).to.match(/status:\s*done/)
    })

    it('checking a Today task checkbox calls writeToday without that slug', async () => {
      const checkbox = dom.window.document.querySelector(
        `[data-today-row][data-slug="${TODAY_SLUG_B}"] input[type="checkbox"]`
      ) as HTMLInputElement | null
      expect(checkbox, 'checkbox in today row B').to.not.equal(null)
      checkbox!.click()
      await tick()
      expect(todoz.__writeTodayCalls.length).to.be.greaterThan(0)
      const lastCall = todoz.__writeTodayCalls[todoz.__writeTodayCalls.length - 1]
      expect(lastCall).to.not.include(TODAY_SLUG_B)
    })
  })

  describe('Clear all', () => {
    let dom: JSDOM
    let todoz: MockTodoz

    beforeEach(async () => {
      const setup = setupDom([TASK_A, TASK_B], [TODAY_SLUG_A, TODAY_SLUG_B])
      dom = setup.dom
      todoz = setup.todoz
      await mountApp(dom.window.document.body)
      await navigateToToday(dom)
    })

    it('clicking Clear all calls writeToday with an empty list', async () => {
      const clearAll = dom.window.document.querySelector(
        '[data-today-clear-all]'
      ) as HTMLElement | null
      expect(clearAll, '[data-today-clear-all]').to.not.equal(null)
      clearAll!.click()
      await tick()
      expect(todoz.__writeTodayCalls.length).to.equal(1)
      expect(todoz.__writeTodayCalls[0]).to.deep.equal([])
    })
  })

  describe('/today-clear command', () => {
    let dom: JSDOM
    let todoz: MockTodoz

    beforeEach(async () => {
      const setup = setupDom([TASK_A, TASK_B], [TODAY_SLUG_A, TODAY_SLUG_B])
      dom = setup.dom
      todoz = setup.todoz
      await mountApp(dom.window.document.body)
      await navigateToToday(dom)
    })

    it('submitting /today-clear calls writeToday with an empty list', async () => {
      const input = dom.window.document.querySelector(
        '[data-command-bar] input[type="text"]'
      ) as HTMLInputElement
      input.value = '/today-clear'
      input.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        })
      )
      await tick()
      expect(todoz.__writeTodayCalls.length).to.equal(1)
      expect(todoz.__writeTodayCalls[0]).to.deep.equal([])
    })
  })

  describe('adding a task from Today view', () => {
    let dom: JSDOM
    let todoz: MockTodoz

    beforeEach(async () => {
      const setup = setupDom([TASK_A, TASK_B], [TODAY_SLUG_A, TODAY_SLUG_B])
      dom = setup.dom
      todoz = setup.todoz
      await mountApp(dom.window.document.body)
      await navigateToToday(dom)
    })

    it('adding a task from the Today view calls writeToday with the new slug', async () => {
      const input = dom.window.document.querySelector(
        '[data-command-bar] input[type="text"]'
      ) as HTMLInputElement
      input.value = '/add deploy the app'
      input.dispatchEvent(
        new dom.window.KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        })
      )
      await tick()
      expect(todoz.__writeTodayCalls.length).to.equal(1)
      const call = todoz.__writeTodayCalls[0]
      // Should include existing slugs + the new one
      expect(call.length).to.equal(3)
      // The new slug should end with the today date
      const newSlug = call.find((s) => s.includes('deploy'))
      expect(newSlug).to.not.equal(undefined)
    })
  })
})
