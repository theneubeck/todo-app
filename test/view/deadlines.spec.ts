import { describe, it, before } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

function makeTask(overrides: Partial<Task> & { slug: string; title: string }): Task {
  return {
    slug: overrides.slug,
    filePath: `test/fixtures/vault/todos/${overrides.slug}.md`,
    title: overrides.title,
    status: overrides.status ?? 'todo',
    due: overrides.due,
    tags: overrides.tags ?? [],
    created: '2026-05-04',
    raw: '',
    subtasks: [],
  }
}

const WITH_DUE_TASKS: Task[] = [
  makeTask({ slug: 'pickup-package', title: 'Pickup package', due: '2026-05-09', tags: ['errands'] }),
  makeTask({ slug: 'call-dentist', title: 'Call dentist', due: '2026-05-10', tags: ['personal'] }),
  makeTask({ slug: 'read-anthropic-paper', title: 'Read Anthropic paper', tags: ['reading'] }),
]

const NO_DUE_TASKS: Task[] = [
  makeTask({ slug: 'read-anthropic-paper', title: 'Read Anthropic paper', tags: ['reading'] }),
]

function mountWithTasks(tasks: Task[]): { doc: Document } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    runScripts: 'dangerously',
    resources: 'usable',
  })
  const win = dom.window as unknown as { todoz: Window['todoz'] }
  win.todoz = {
    readTodos: async () => tasks,
    writeFile: async () => {},
    runOllama: async () => ({ ok: true as const, reply: '' }),
    today: '2026-05-07',
  }
  ;(globalThis as unknown as { window: Window; document: Document }).window = dom.window as unknown as Window
  ;(globalThis as unknown as { window: Window; document: Document }).document = dom.window.document
  return { doc: dom.window.document }
}

describe('Deadlines — Upcoming view', () => {
  let doc: Document

  before(async () => {
    const mounted = mountWithTasks(WITH_DUE_TASKS)
    doc = mounted.doc
    await mountApp(doc.body)
    // Click sidebar entry for upcoming
    const entry = doc.querySelector('[data-sidebar-entry="upcoming"]') as HTMLElement
    entry.click()
  })

  it('shows only tasks that have a due field', () => {
    const rows = doc.querySelectorAll('[data-upcoming-row]')
    expect(rows.length).to.equal(2)
  })

  it('orders tasks by ascending due date', () => {
    const rows = Array.from(doc.querySelectorAll('[data-upcoming-row]'))
    const titles = rows.map((r) => r.querySelector('[data-task-title]')?.textContent?.trim())
    expect(titles).to.deep.equal(['Pickup package', 'Call dentist'])
  })

  it('renders a due-date row below each task title', () => {
    const rows = Array.from(doc.querySelectorAll('[data-upcoming-row]'))
    for (const row of rows) {
      const dueRow = row.querySelector('[data-due-row]')
      expect(dueRow, 'each [data-upcoming-row] should contain a [data-due-row]').to.not.equal(null)
    }
  })

  it('renders a tag chip inside the due-date row', () => {
    const firstRow = doc.querySelector('[data-upcoming-row]')
    expect(firstRow, 'first [data-upcoming-row] should exist').to.not.equal(null)
    const chip = firstRow!.querySelector('[data-due-row] [data-tag-chip]')
    expect(chip, '[data-tag-chip] inside [data-due-row]').to.not.equal(null)
  })

  it('sets the main header title to Upcoming', () => {
    const h1 = doc.querySelector('[data-main-view] h1, [data-main-header] h1')
    expect(h1?.textContent?.trim()).to.equal('Upcoming')
  })
})

describe('Deadlines — Upcoming view (empty state)', () => {
  let doc: Document

  before(async () => {
    const mounted = mountWithTasks(NO_DUE_TASKS)
    doc = mounted.doc
    await mountApp(doc.body)
    const entry = doc.querySelector('[data-sidebar-entry="upcoming"]') as HTMLElement
    entry.click()
  })

  it('shows the empty state when no tasks have due dates', () => {
    const empty = doc.querySelector('[data-upcoming-empty]')
    expect(empty, '[data-upcoming-empty] should be present').to.not.equal(null)
  })
})
