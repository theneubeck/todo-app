import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import type { Focus } from '../../src/renderer/data/parseFocusCommand'
import { mountApp } from '../../src/renderer/index'

// ---- Fixtures ----

const FOCUS_WORK: Focus = { id: 'focus-work-001', name: 'Work', tags: ['work', 'q2'] }
const FOCUS_PERSONAL: Focus = {
  id: 'focus-personal-001',
  name: 'Personal',
  tags: ['personal'],
}

const TASK_DENTIST: Task = {
  slug: 'call-dentist',
  filePath: 'test/fixtures/vault/todos/call-dentist-2026-05-04.md',
  title: 'Call dentist',
  status: 'todo',
  due: '2026-05-10',
  tags: ['personal'],
  created: '2026-05-04',
  raw: '---\ntype: task\ntitle: Call dentist\nstatus: todo\ndue: 2026-05-10\ntags: [personal]\ncreated: 2026-05-04\n---\n- [ ] Book appointment\n',
  subtasks: [{ index: 0, label: 'Book appointment', done: false }],
}

const TASK_Q2: Task = {
  slug: 'q2-report',
  filePath: 'test/fixtures/vault/todos/q2-report-2026-05-04.md',
  title: 'Q2 report',
  status: 'todo',
  due: '2026-06-01',
  tags: ['work', 'q2'],
  created: '2026-05-04',
  raw: '---\ntype: task\ntitle: Q2 report\nstatus: todo\ndue: 2026-06-01\ntags: [work, q2]\ncreated: 2026-05-04\n---\n- [ ] Write executive summary\n',
  subtasks: [{ index: 0, label: 'Write executive summary', done: false }],
}

const TASK_READING: Task = {
  slug: 'read-anthropic-paper',
  filePath: 'test/fixtures/vault/todos/read-anthropic-paper-2026-05-04.md',
  title: 'Read Anthropic paper',
  status: 'todo',
  tags: ['reading'],
  created: '2026-05-04',
  raw: '---\ntype: task\ntitle: Read Anthropic paper\nstatus: todo\ntags: [reading]\ncreated: 2026-05-04\n---\n- [ ] Read and take notes\n',
  subtasks: [{ index: 0, label: 'Read and take notes', done: false }],
}

type MockTodoz = {
  readTodos: () => Promise<Task[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  runOllama: () => Promise<string>
  today: string
  readFocuses: () => Promise<Focus[]>
  writeFocuses: (focuses: Focus[]) => Promise<void>
}

function setupDom(tasks: Task[], focuses: Focus[]): { dom: JSDOM; capturedFocuses: Focus[][] } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const capturedFocuses: Focus[][] = []
  const todoz: MockTodoz = {
    today: '2026-05-20',
    readTodos: async () => tasks,
    writeFile: async () => {},
    runOllama: async () => '',
    readFocuses: async () => focuses,
    writeFocuses: async (f: Focus[]) => {
      capturedFocuses.push([...f])
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(dom.window as any).todoz = todoz
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = dom.window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).document = dom.window.document
  return { dom, capturedFocuses }
}

function tick(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function navigateToFocusBoard(dom: JSDOM): Promise<void> {
  const focusEntry = dom.window.document.querySelector(
    '[data-sidebar-entry="focus"]'
  ) as HTMLElement | null
  expect(focusEntry, '[data-sidebar-entry="focus"]').to.not.equal(null)
  focusEntry!.click()
  await tick()
}

// ---- Tests ----

describe('Focus Board', () => {
  describe('with two focus fixtures', () => {
    let dom: JSDOM

    beforeEach(async () => {
      const setup = setupDom([TASK_DENTIST, TASK_Q2, TASK_READING], [FOCUS_WORK, FOCUS_PERSONAL])
      dom = setup.dom
      await mountApp(dom.window.document.body)
      await navigateToFocusBoard(dom)
    })

    it('renders focus cards for each saved focus', () => {
      const cards = dom.window.document.querySelectorAll('[data-focus-card]')
      expect(cards.length).to.equal(2)
    })

    it('renders tag chips on each focus card', () => {
      const firstCard = dom.window.document.querySelector('[data-focus-card]')
      expect(firstCard, '[data-focus-card]').to.not.equal(null)
      const tags = Array.from(firstCard!.querySelectorAll('[data-focus-tag]')).map(
        (el) => el.textContent?.trim()
      )
      expect(tags).to.include('work')
    })
  })

  describe('empty state when no focuses exist', () => {
    let dom: JSDOM

    beforeEach(async () => {
      const setup = setupDom([], [])
      dom = setup.dom
      await mountApp(dom.window.document.body)
      await navigateToFocusBoard(dom)
    })

    it('shows the empty state when no focuses exist', () => {
      const empty = dom.window.document.querySelector('[data-focus-empty]')
      expect(empty, '[data-focus-empty]').to.not.equal(null)
    })
  })

  describe('clicking a focus card', () => {
    let dom: JSDOM

    beforeEach(async () => {
      const setup = setupDom([TASK_DENTIST, TASK_Q2, TASK_READING], [FOCUS_WORK, FOCUS_PERSONAL])
      dom = setup.dom
      await mountApp(dom.window.document.body)
      await navigateToFocusBoard(dom)
    })

    it('navigates to the task list when a focus card is clicked', async () => {
      const firstCard = dom.window.document.querySelector('[data-focus-card]') as HTMLElement
      firstCard.click()
      await tick()
      const taskList = dom.window.document.querySelector('[data-focus-task-list]')
      expect(taskList, '[data-focus-task-list]').to.not.equal(null)
    })

    it('shows only tasks whose tags overlap with the focus tags', async () => {
      // Work focus card (focus-work-001) has tags: work, q2
      const workCard = dom.window.document.querySelector(
        '[data-focus-card][data-focus-id="focus-work-001"]'
      ) as HTMLElement
      expect(workCard, 'Work card should exist').to.not.equal(null)
      workCard.click()
      await tick()
      const taskList = dom.window.document.querySelector('[data-focus-task-list]')
      expect(taskList, '[data-focus-task-list]').to.not.equal(null)
      const titles = Array.from(taskList!.querySelectorAll('[data-task-title]')).map(
        (el) => el.textContent?.trim()
      )
      // Q2 report has tags: work, q2 — should appear
      expect(titles).to.include('Q2 report')
      // Read Anthropic paper has tags: reading — should not appear
      expect(titles).to.not.include('Read Anthropic paper')
    })

    it('returns to the board when the Focus sidebar entry is clicked', async () => {
      const workCard = dom.window.document.querySelector('[data-focus-card]') as HTMLElement
      workCard.click()
      await tick()
      // Click Focus sidebar again
      const focusEntry = dom.window.document.querySelector(
        '[data-sidebar-entry="focus"]'
      ) as HTMLElement
      focusEntry.click()
      await tick()
      const board = dom.window.document.querySelector('[data-focus-board]')
      expect(board, '[data-focus-board]').to.not.equal(null)
    })

    it('shows empty state when no tasks match the focus tags', async () => {
      // Personal focus has tags: personal. TASK_Q2 has tags: work, q2. TASK_READING: reading.
      // Re-mount with only Q2 task (no personal tasks) and Personal focus
      const freshSetup = setupDom([TASK_Q2, TASK_READING], [FOCUS_PERSONAL])
      await mountApp(freshSetup.dom.window.document.body)
      await navigateToFocusBoard(freshSetup.dom)
      const personalCardFresh = freshSetup.dom.window.document.querySelector(
        '[data-focus-card][data-focus-id="focus-personal-001"]'
      ) as HTMLElement
      expect(personalCardFresh, 'Personal card').to.not.equal(null)
      personalCardFresh.click()
      await tick()
      const taskList = freshSetup.dom.window.document.querySelector('[data-focus-task-list]')
      expect(taskList, '[data-focus-task-list]').to.not.equal(null)
      const emptyEl = taskList!.querySelector('[data-focus-task-empty]')
      expect(emptyEl, '[data-focus-task-empty]').to.not.equal(null)
    })

    it('excludes done tasks from the focus task list', async () => {
      const TASK_Q2_DONE: Task = {
        ...TASK_Q2,
        status: 'done',
        slug: 'q2-report-done',
      }
      const freshSetup = setupDom([TASK_Q2_DONE, TASK_READING], [FOCUS_WORK])
      await mountApp(freshSetup.dom.window.document.body)
      await navigateToFocusBoard(freshSetup.dom)
      const workCard = freshSetup.dom.window.document.querySelector(
        '[data-focus-card][data-focus-id="focus-work-001"]'
      ) as HTMLElement
      workCard.click()
      await tick()
      const taskList = freshSetup.dom.window.document.querySelector('[data-focus-task-list]')
      const titles = Array.from(taskList!.querySelectorAll('[data-task-title]')).map(
        (el) => el.textContent?.trim()
      )
      // Done task should be excluded
      expect(titles).to.not.include('Q2 report')
    })
  })

  describe('editing a focus card', () => {
    let dom: JSDOM
    let capturedFocuses: Focus[][]

    beforeEach(async () => {
      const setup = setupDom([TASK_DENTIST, TASK_Q2, TASK_READING], [FOCUS_WORK, FOCUS_PERSONAL])
      dom = setup.dom
      capturedFocuses = setup.capturedFocuses
      await mountApp(dom.window.document.body)
      await navigateToFocusBoard(dom)
    })

    it('renders an edit icon on each focus card', () => {
      const editIcons = dom.window.document.querySelectorAll('[data-focus-edit]')
      expect(editIcons.length).to.equal(2)
    })

    it('shows inline name and tags inputs when the edit icon is clicked', () => {
      const editBtn = dom.window.document.querySelector('[data-focus-edit]') as HTMLElement
      editBtn.click()
      const nameInput = dom.window.document.querySelector('[data-focus-edit-name]')
      const tagsInput = dom.window.document.querySelector('[data-focus-edit-tags]')
      expect(nameInput, '[data-focus-edit-name]').to.not.equal(null)
      expect(tagsInput, '[data-focus-edit-tags]').to.not.equal(null)
    })

    it('pre-fills the name input with the current focus name', () => {
      const editBtn = dom.window.document.querySelector('[data-focus-edit]') as HTMLElement
      editBtn.click()
      const nameInput = dom.window.document.querySelector('[data-focus-edit-name]') as HTMLInputElement
      expect(nameInput.value).to.equal('Work')
    })

    it('pre-fills the tags input with the current tags', () => {
      const editBtn = dom.window.document.querySelector('[data-focus-edit]') as HTMLElement
      editBtn.click()
      const tagsInput = dom.window.document.querySelector('[data-focus-edit-tags]') as HTMLInputElement
      expect(tagsInput.value).to.include('work')
    })

    it('saves updated focus when Save button is clicked', async () => {
      const editBtn = dom.window.document.querySelector('[data-focus-edit]') as HTMLElement
      editBtn.click()
      const nameInput = dom.window.document.querySelector('[data-focus-edit-name]') as HTMLInputElement
      nameInput.value = 'Deep Work'
      const saveBtn = dom.window.document.querySelector('[data-focus-save]') as HTMLElement
      saveBtn.click()
      await tick(20)
      expect(capturedFocuses.length).to.be.greaterThan(0)
      const updated = capturedFocuses[capturedFocuses.length - 1]
      expect(updated.some((f) => f.name === 'Deep Work')).to.equal(true)
    })

    it('saves updated tags when Save button is clicked', async () => {
      const editBtn = dom.window.document.querySelector('[data-focus-edit]') as HTMLElement
      editBtn.click()
      const tagsInput = dom.window.document.querySelector('[data-focus-edit-tags]') as HTMLInputElement
      tagsInput.value = '#design #ux'
      const saveBtn = dom.window.document.querySelector('[data-focus-save]') as HTMLElement
      saveBtn.click()
      await tick(20)
      expect(capturedFocuses.length).to.be.greaterThan(0)
      const updated = capturedFocuses[capturedFocuses.length - 1]
      const workFocus = updated.find((f) => f.id === 'focus-work-001')
      expect(workFocus?.tags).to.include('design')
    })

    it('re-renders the card with updated tags after saving', async () => {
      const editBtn = dom.window.document.querySelector('[data-focus-edit]') as HTMLElement
      editBtn.click()
      const tagsInput = dom.window.document.querySelector('[data-focus-edit-tags]') as HTMLInputElement
      tagsInput.value = '#design #ux'
      const saveBtn = dom.window.document.querySelector('[data-focus-save]') as HTMLElement
      saveBtn.click()
      await tick(20)
      const card = dom.window.document.querySelector('[data-focus-card][data-focus-id="focus-work-001"]')
      expect(card, 'Work card should still exist after save').to.not.equal(null)
      const renderedTags = Array.from(card!.querySelectorAll('[data-focus-tag]')).map(
        (el) => el.textContent?.trim()
      )
      expect(renderedTags).to.include('design')
      expect(renderedTags).to.not.include('work')
    })

    it('cancels edit and restores the card when Cancel button is clicked', async () => {
      const editBtn = dom.window.document.querySelector('[data-focus-edit]') as HTMLElement
      editBtn.click()
      const cancelBtn = dom.window.document.querySelector('[data-focus-cancel]') as HTMLElement
      cancelBtn.click()
      await tick(10)
      const nameInputAfter = dom.window.document.querySelector('[data-focus-edit-name]')
      expect(nameInputAfter, 'edit form should be gone after Cancel').to.equal(null)
      const cards = dom.window.document.querySelectorAll('[data-focus-card]')
      expect(cards.length).to.equal(2)
    })
  })

  describe('creating a focus via the command bar', () => {
    let dom: JSDOM

    beforeEach(async () => {
      const setup = setupDom([TASK_DENTIST, TASK_Q2, TASK_READING], [])
      dom = setup.dom
      await mountApp(dom.window.document.body)
      await navigateToFocusBoard(dom)
    })

    it('creates a new focus card via the /focus command', async () => {
      const input = dom.window.document.querySelector(
        '[data-command-bar] input[type="text"]'
      ) as HTMLInputElement
      expect(input, 'command bar input').to.not.equal(null)
      input.value = '/focus Design #reading'
      const ev = new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
      input.dispatchEvent(ev)
      await tick(20)
      const cards = dom.window.document.querySelectorAll('[data-focus-card]')
      expect(cards.length).to.be.greaterThan(0)
      const names = Array.from(cards).map(
        (c) => c.querySelector('[data-focus-name]')?.textContent?.trim()
      )
      expect(names).to.include('Design')
    })
  })
})
