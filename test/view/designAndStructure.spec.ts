import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

type TodozMock = {
  readTodos: () => Promise<Task[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  runOllama: (prompt: string) => Promise<string>
}

const RAW_DENTIST =
  '---\ntype: task\ntitle: "Call dentist"\nstatus: todo\ndue: 2026-05-10\ntags: [personal]\ncreated: 2026-05-04\n---\n- [ ] Book appointment\n- [ ] Check insurance coverage\n'
const RAW_Q2 =
  '---\ntype: task\ntitle: "Q2 report"\nstatus: todo\ndue: 2026-06-01\ntags: [work, q2]\ncreated: 2026-05-04\n---\n- [ ] Collect numbers from analytics\n  - [ ] Page views\n  - [ ] Conversion rate\n- [ ] Write executive summary\n'
const RAW_READ =
  '---\ntype: task\ntitle: "Read Anthropic paper"\nstatus: todo\ntags: [reading]\ncreated: 2026-05-04\n---\n- [ ] Read and take notes\n'

function buildTasks(): Task[] {
  return [
    {
      slug: 'q2-report',
      filePath: '/abs/test/fixtures/vault/todos/q2-report-2026-05-04.md',
      title: 'Q2 report',
      status: 'todo',
      due: '2026-06-01',
      tags: ['work', 'q2'],
      created: '2026-05-04',
      raw: RAW_Q2,
      subtasks: [
        { index: 0, label: 'Collect numbers from analytics', done: false },
        { index: 1, label: 'Write executive summary', done: true },
      ],
    },
    {
      slug: 'call-dentist',
      filePath: '/abs/test/fixtures/vault/todos/call-dentist-2026-05-04.md',
      title: 'Call dentist',
      status: 'todo',
      due: '2026-05-10',
      tags: ['personal'],
      created: '2026-05-04',
      raw: RAW_DENTIST,
      subtasks: [
        { index: 0, label: 'Book appointment', done: true },
        { index: 1, label: 'Check insurance coverage', done: false },
      ],
    },
    {
      slug: 'read-anthropic-paper',
      filePath: '/abs/test/fixtures/vault/todos/read-anthropic-paper-2026-05-04.md',
      title: 'Read Anthropic paper',
      status: 'todo',
      tags: ['reading'],
      created: '2026-05-04',
      raw: RAW_READ,
      subtasks: [{ index: 0, label: 'Read and take notes', done: false }],
    },
  ]
}

function setupDom(tasks: Task[] = buildTasks()): { dom: JSDOM; todoz: TodozMock } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const todoz: TodozMock = {
    async readTodos() {
      return tasks
    },
    async writeFile() {
      // no-op
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

describe('DesignAndStructure', () => {
  let dom: JSDOM

  beforeEach(() => {
    const setup = setupDom()
    dom = setup.dom
  })

  it('renders the TODO brand in the top app bar', async () => {
    await mountApp(dom.window.document.body)
    const brand = dom.window.document.querySelector('[data-app-bar] [data-brand]')
    expect(brand?.textContent?.trim()).to.equal('TODO')
  })

  it('renders add, settings, avatar action icons in the top app bar', async () => {
    await mountApp(dom.window.document.body)
    const bar = dom.window.document.querySelector('[data-app-bar]')
    expect(bar?.querySelector('[data-icon="add"]')).to.not.equal(null)
    expect(bar?.querySelector('[data-icon="settings"]')).to.not.equal(null)
    expect(bar?.querySelector('[data-icon="person"]')).to.not.equal(null)
  })

  it('renders the primary sidebar navigation entries', async () => {
    await mountApp(dom.window.document.body)
    const entries = Array.from(
      dom.window.document.querySelectorAll('[data-sidebar] [data-nav-entry]')
    ).map((el) => el.querySelector('[data-nav-label]')?.textContent?.trim())
    expect(entries).to.deep.equal(['Chat', 'Inbox', 'Today', 'Upcoming'])
  })

  it('marks the Inbox sidebar entry as active', async () => {
    await mountApp(dom.window.document.body)
    const active = dom.window.document.querySelector(
      '[data-sidebar] [data-sidebar-entry="inbox"][data-nav-active]'
    )
    const label = active?.querySelector('[data-nav-label]')
    expect(label?.textContent?.trim()).to.equal('Inbox')
  })

  it('renders the PROJECTS section header in the sidebar', async () => {
    await mountApp(dom.window.document.body)
    const headers = Array.from(
      dom.window.document.querySelectorAll('[data-sidebar] [data-section-header]')
    ).map((el) => el.textContent?.trim().toUpperCase())
    expect(headers).to.include('PROJECTS')
  })

  it('hides the PEOPLE section header when no @-tags exist in the sidebar', async () => {
    await mountApp(dom.window.document.body)
    const headers = Array.from(
      dom.window.document.querySelectorAll('[data-sidebar] [data-section-header]')
    ).map((el) => el.textContent?.trim().toUpperCase())
    expect(headers).to.not.include('PEOPLE')
  })

  it('renders an h1 reading Inbox in the main header', async () => {
    await mountApp(dom.window.document.body)
    const h1 = dom.window.document.querySelector('[data-main-header] h1')
    expect(h1?.textContent?.trim()).to.equal('Inbox')
  })

  it('renders a remaining-count line below the h1', async () => {
    await mountApp(dom.window.document.body)
    const count = dom.window.document.querySelector(
      '[data-main-header] [data-remaining-count]'
    )
    expect(count?.textContent?.trim()).to.equal('3 tasks remaining')
  })

  it('wraps the task list in a single bordered card', async () => {
    await mountApp(dom.window.document.body)
    const cards = dom.window.document.querySelectorAll('[data-task-card]')
    expect(cards.length).to.equal(1)
    const list = cards[0].querySelector('[data-task-list]')
    expect(list).to.not.equal(null)
  })

  it('groups task rows under uppercase priority headings', async () => {
    await mountApp(dom.window.document.body)
    const headings = Array.from(
      dom.window.document.querySelectorAll('[data-task-card] [data-group-heading]')
    ).map((el) => el.textContent?.trim())
    expect(headings.length).to.be.greaterThan(0)
    headings.forEach((h) => {
      expect(h, `heading "${h}" should be uppercase`).to.equal((h ?? '').toUpperCase())
    })
  })

  it('renders a chevron, a title, a chip on every combined task row', async () => {
    // Superseded by features/task-row-interactions: every task in
    // STANDARD_FIXTURES (and this spec's buildTasks()) is combined, so under
    // the combined-row contract the parent row carries chevron + title + chip
    // but no [data-checkbox-wrapper] (parent checkbox lives on simple rows
    // only — see test/view/taskRowInteractions.spec.ts for that side).
    await mountApp(dom.window.document.body)
    const rows = dom.window.document.querySelectorAll('[data-task-row]')
    expect(rows.length).to.equal(3)
    rows.forEach((row) => {
      expect(row.querySelector('[data-chevron]'), 'chevron').to.not.equal(null)
      expect(row.querySelector('[data-task-title]'), 'title').to.not.equal(null)
      expect(row.querySelector('[data-chip]'), 'chip').to.not.equal(null)
      expect(
        row.querySelector('[data-checkbox-wrapper]'),
        'no parent checkbox wrapper on combined rows'
      ).to.equal(null)
    })
  })

  it('indents subtasks beneath an expanded parent task', async () => {
    await mountApp(dom.window.document.body)
    const expanded = dom.window.document.querySelector('[data-task][data-expanded="true"]')
    expect(expanded).to.not.equal(null)
    const guide = expanded?.querySelector('[data-subtasks][data-guide-line]')
    expect(guide).to.not.equal(null)
    const subItems = guide?.querySelectorAll('[data-subtask]')
    expect(subItems?.length ?? 0).to.be.greaterThan(0)
  })

  it('strikes through subtasks marked done', async () => {
    await mountApp(dom.window.document.body)
    const doneSub = dom.window.document.querySelector('[data-subtask][data-subtask-done="true"]')
    expect(doneSub).to.not.equal(null)
    const label = doneSub?.querySelector('[data-subtask-label]')
    expect(label?.getAttribute('data-strikethrough')).to.equal('true')
  })

  it('renders a command bar pinned to the bottom of the main area', async () => {
    await mountApp(dom.window.document.body)
    const bar = dom.window.document.querySelector('[data-command-bar]')
    expect(bar).to.not.equal(null)
    expect(bar?.getAttribute('data-pinned')).to.equal('bottom')
  })

  it('shows the placeholder text in the command bar input', async () => {
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement | null
    expect(input?.placeholder).to.equal('Type a command or add a task...')
  })

  it('shows the Enter-to-send hint on the right of the command bar', async () => {
    await mountApp(dom.window.document.body)
    const hint = dom.window.document.querySelector('[data-command-bar] [data-shortcut-hint]')
    expect(hint?.textContent?.trim()).to.equal('Enter to send')
  })

  it('renders combined task rows with no parent checkbox wrapper', async () => {
    // Superseded by features/task-row-interactions: combined rows under the
    // new contract have no parent checkbox wrapper (the row body click is the
    // expand/collapse target). The legacy "click the parent checkbox to mark
    // done" behavior is now exercised on simple-task fixtures end-to-end in
    // test/view/taskRowInteractions.spec.ts.
    await mountApp(dom.window.document.body)
    const dentist = dom.window.document.querySelector(
      '[data-task="call-dentist"]'
    ) as HTMLElement
    const wrapper = dentist.querySelector(
      '[data-task-row] [data-checkbox-wrapper]'
    )
    expect(wrapper).to.equal(null)
  })

  it('writes back the toggled subtask line when a subtask checkbox is clicked', async () => {
    const writes: Array<{ filePath: string; content: string }> = []
    const dom2 = new JSDOM('<!DOCTYPE html><html><body></body></html>')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dom2.window as any).todoz = {
      readTodos: async () => buildTasks(),
      writeFile: async (filePath: string, content: string) => {
        writes.push({ filePath, content })
      },
      runOllama: async () => '',
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = dom2.window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).document = dom2.window.document
    await mountApp(dom2.window.document.body)
    const dentist = dom2.window.document.querySelector(
      '[data-task="call-dentist"]'
    ) as HTMLElement
    const sub = dentist.querySelector('[data-subtask="1"]') as HTMLElement
    const subCb = sub.querySelector('input[type="checkbox"]') as HTMLInputElement
    subCb.click()
    await new Promise((r) => setTimeout(r, 10))
    expect(writes.length).to.equal(1)
    expect(writes[0].content).to.match(/- \[x\] Check insurance coverage/)
  })

  it('expands a collapsed task row when its row is clicked', async () => {
    await mountApp(dom.window.document.body)
    const q2 = dom.window.document.querySelector('[data-task="q2-report"]') as HTMLElement
    expect(q2.getAttribute('data-expanded')).to.equal('false')
    const row = q2.querySelector('[data-task-row]') as HTMLElement
    row.click()
    expect(q2.getAttribute('data-expanded')).to.equal('true')
    const subs = q2.querySelectorAll('[data-subtask]')
    expect(subs.length).to.equal(2)
  })

  it('collapses an expanded task row when its row is clicked again', async () => {
    await mountApp(dom.window.document.body)
    const dentist = dom.window.document.querySelector(
      '[data-task="call-dentist"]'
    ) as HTMLElement
    expect(dentist.getAttribute('data-expanded')).to.equal('true')
    const row = dentist.querySelector('[data-task-row]') as HTMLElement
    row.click()
    expect(dentist.getAttribute('data-expanded')).to.equal('false')
    expect(dentist.querySelector('[data-subtasks]')).to.equal(null)
  })

  it('uses singular "task remaining" copy when there is exactly one remaining task', async () => {
    const oneTask: Task[] = [
      {
        slug: 'only-one',
        filePath: '/abs/only-one.md',
        title: 'Only one',
        status: 'todo',
        due: '2026-05-10',
        tags: ['personal'],
        created: '2026-05-04',
        raw: '---\ntype: task\ntitle: "Only one"\nstatus: todo\ndue: 2026-05-10\ntags: [personal]\ncreated: 2026-05-04\n---\n- [ ] go\n',
        subtasks: [{ index: 0, label: 'go', done: false }],
      },
    ]
    const dom2 = new JSDOM('<!DOCTYPE html><html><body></body></html>')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dom2.window as any).todoz = {
      readTodos: async () => oneTask,
      writeFile: async () => {},
      runOllama: async () => '',
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = dom2.window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).document = dom2.window.document
    await mountApp(dom2.window.document.body)
    const count = dom2.window.document.querySelector('[data-remaining-count]')
    expect(count?.textContent?.trim()).to.equal('1 task remaining')
  })

  it('renders a single TASKS heading regardless of due dates', async () => {
    const undated: Task[] = [
      {
        slug: 'a',
        filePath: '/abs/a.md',
        title: 'A',
        status: 'todo',
        tags: ['x'],
        created: '2026-05-04',
        raw: '---\ntype: task\ntitle: "A"\nstatus: todo\ntags: [x]\ncreated: 2026-05-04\n---\n',
        subtasks: [],
      },
    ]
    const dom2 = new JSDOM('<!DOCTYPE html><html><body></body></html>')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dom2.window as any).todoz = {
      readTodos: async () => undated,
      writeFile: async () => {},
      runOllama: async () => '',
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).window = dom2.window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).document = dom2.window.document
    await mountApp(dom2.window.document.body)
    const headings = Array.from(
      dom2.window.document.querySelectorAll('[data-group-heading]')
    ).map((el) => el.textContent?.trim())
    expect(headings).to.deep.equal(['TASKS'])
  })
})
