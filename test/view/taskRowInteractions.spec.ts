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

describe('TaskRowInteractions', () => {
  let dom: JSDOM
  let todoz: TodozMock

  beforeEach(() => {
    const setup = setupDom()
    dom = setup.dom
    todoz = setup.todoz
  })

  it('renders no chevron on a simple task row', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const chevron = row.querySelector('[data-task-row] [data-chevron]')
    expect(chevron).to.equal(null)
  })

  it('renders a chevron on a combined task row', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const chevron = row.querySelector('[data-task-row] [data-chevron]')
    expect(chevron).to.not.equal(null)
  })

  it('renders a checkbox on a simple task row', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const wrapper = row.querySelector('[data-task-row] [data-checkbox-wrapper]')
    expect(wrapper).to.not.equal(null)
    const cb = wrapper?.querySelector('input[type="checkbox"]')
    expect(cb).to.not.equal(null)
  })

  it('renders no checkbox on a combined task row', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const wrapper = row.querySelector('[data-task-row] [data-checkbox-wrapper]')
    expect(wrapper).to.equal(null)
  })

  it('renders a remove icon on every top-level row', async () => {
    await mountApp(dom.window.document.body)
    const slugs = ['buy-milk', 'send-invoice', 'prep-deck', 'weekly-shop']
    for (const slug of slugs) {
      const row = findRow(dom.window.document, slug)
      const remove = row.querySelector('[data-task-row] [data-remove]')
      expect(remove, `remove icon on ${slug}`).to.not.equal(null)
    }
  })

  it('renders a remove icon on every subtask row when expanded', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click()
    const subtasks = row.querySelectorAll('[data-subtask-list] [data-subtask]')
    expect(subtasks.length).to.equal(2)
    subtasks.forEach((sub) => {
      expect(sub.querySelector('[data-remove]'), 'subtask remove icon').to.not.equal(
        null
      )
    })
  })

  it('calls writeFile with toggleParent output when a simple todo task\'s checkbox is clicked', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const cb = row.querySelector(
      '[data-task-row] [data-checkbox-wrapper] input[type="checkbox"]'
    ) as HTMLInputElement
    cb.click()
    await tick(10)
    expect(todoz.__writes.length).to.equal(1)
    expect(todoz.__writes[0].content).to.match(/status:\s*done/)
  })

  it('calls writeFile with toggleParent output when a simple done task\'s checkbox is clicked', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'send-invoice')
    const cb = row.querySelector(
      '[data-task-row] [data-checkbox-wrapper] input[type="checkbox"]'
    ) as HTMLInputElement
    cb.click()
    await tick(10)
    expect(todoz.__writes.length).to.equal(1)
    expect(todoz.__writes[0].content).to.match(/status:\s*todo/)
  })

  it('sets data-checked=true on the checkbox wrapper after a check', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const cb = row.querySelector(
      '[data-task-row] [data-checkbox-wrapper] input[type="checkbox"]'
    ) as HTMLInputElement
    cb.click()
    await tick(10)
    const updatedRow = findRow(dom.window.document, 'buy-milk')
    const wrap = updatedRow.querySelector(
      '[data-task-row] [data-checkbox-wrapper]'
    ) as HTMLElement
    expect(wrap.getAttribute('data-checked')).to.equal('true')
  })

  it('sets data-completed=true on the title after a check', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const cb = row.querySelector(
      '[data-task-row] [data-checkbox-wrapper] input[type="checkbox"]'
    ) as HTMLInputElement
    cb.click()
    await tick(10)
    const updated = findRow(dom.window.document, 'buy-milk')
    const title = updated.querySelector('[data-task-title]') as HTMLElement
    expect(title.getAttribute('data-completed')).to.equal('true')
  })

  it('removes data-completed from the title after an uncheck', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'send-invoice')
    const cb = row.querySelector(
      '[data-task-row] [data-checkbox-wrapper] input[type="checkbox"]'
    ) as HTMLInputElement
    cb.click()
    await tick(10)
    const updated = findRow(dom.window.document, 'send-invoice')
    const title = updated.querySelector('[data-task-title]') as HTMLElement
    expect(title.getAttribute('data-completed')).to.not.equal('true')
  })

  it('expands a collapsed combined task on row body click', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    expect(row.getAttribute('data-expanded')).to.not.equal('true')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click()
    expect(row.getAttribute('data-expanded')).to.equal('true')
  })

  it('collapses an expanded combined task on row body click', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click() // expand
    expect(row.getAttribute('data-expanded')).to.equal('true')
    taskRow.click() // collapse
    expect(row.getAttribute('data-expanded')).to.not.equal('true')
  })

  it('sets data-expanded=true on the row when expanded', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click()
    expect(row.getAttribute('data-expanded')).to.equal('true')
  })

  it('renders one subtask row per top-level body bullet when expanded', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click()
    const subtasks = row.querySelectorAll('[data-subtask-list] [data-subtask]')
    expect(subtasks.length).to.equal(2)
  })

  it('does not toggle expanded state when the remove icon is clicked', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    expect(row.getAttribute('data-expanded')).to.not.equal('true')
    const remove = row.querySelector('[data-task-row] [data-remove]') as HTMLElement
    remove.click()
    const after = findRow(dom.window.document, 'prep-deck')
    expect(after.getAttribute('data-expanded')).to.not.equal('true')
  })

  it('calls writeFile with toggleSubtask output when a subtask checkbox is clicked', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click()
    const subtask = row.querySelector(
      '[data-subtask-list] [data-subtask="0"]'
    ) as HTMLElement
    const cb = subtask.querySelector(
      '[data-checkbox-wrapper] input[type="checkbox"]'
    ) as HTMLInputElement
    cb.click()
    await tick(10)
    expect(todoz.__writes.length).to.equal(1)
    expect(todoz.__writes[0].content).to.match(/- \[x\] draft section 1/)
  })

  it('does not change parent frontmatter status when a subtask is toggled', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click()
    const subtask = row.querySelector(
      '[data-subtask-list] [data-subtask="0"]'
    ) as HTMLElement
    const cb = subtask.querySelector(
      '[data-checkbox-wrapper] input[type="checkbox"]'
    ) as HTMLInputElement
    cb.click()
    await tick(10)
    expect(todoz.__writes.length).to.equal(1)
    expect(todoz.__writes[0].content).to.match(/status:\s*todo/)
  })

  it('opens the confirm prompt when a remove icon is clicked', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const remove = row.querySelector('[data-task-row] [data-remove]') as HTMLElement
    remove.click()
    const confirm = dom.window.document.querySelector('[data-confirm]')
    expect(confirm).to.not.equal(null)
    expect(confirm?.querySelector('[data-confirm-yes]')).to.not.equal(null)
    expect(confirm?.querySelector('[data-confirm-no]')).to.not.equal(null)
  })

  it('does not call archiveFile or writeFile when the confirm is dismissed via No', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const remove = row.querySelector('[data-task-row] [data-remove]') as HTMLElement
    remove.click()
    const no = dom.window.document.querySelector(
      '[data-confirm] [data-confirm-no]'
    ) as HTMLElement
    no.click()
    await tick(10)
    expect(todoz.__writes.length).to.equal(0)
    expect(todoz.__archives.length).to.equal(0)
  })

  it('calls archiveFile with the matching filename on Yes for a top-level simple task', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const remove = row.querySelector('[data-task-row] [data-remove]') as HTMLElement
    remove.click()
    const yes = dom.window.document.querySelector(
      '[data-confirm] [data-confirm-yes]'
    ) as HTMLElement
    yes.click()
    await tick(10)
    expect(todoz.__archives.length).to.equal(1)
    expect(todoz.__archives[0]).to.match(/buy-milk-2026-05-08\.md$/)
  })

  it('calls archiveFile with the matching filename on Yes for a top-level combined task', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const remove = row.querySelector('[data-task-row] [data-remove]') as HTMLElement
    remove.click()
    const yes = dom.window.document.querySelector(
      '[data-confirm] [data-confirm-yes]'
    ) as HTMLElement
    yes.click()
    await tick(10)
    expect(todoz.__archives.length).to.equal(1)
    expect(todoz.__archives[0]).to.match(/prep-deck-2026-05-08\.md$/)
  })

  it('removes the row from the rendered list after a confirmed top-level remove', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'buy-milk')
    const remove = row.querySelector('[data-task-row] [data-remove]') as HTMLElement
    remove.click()
    const yes = dom.window.document.querySelector(
      '[data-confirm] [data-confirm-yes]'
    ) as HTMLElement
    yes.click()
    await tick(10)
    const stillThere = dom.window.document.querySelector('[data-task="buy-milk"]')
    expect(stillThere).to.equal(null)
  })

  it('calls writeFile with removeSubtask output on Yes for a subtask remove', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click() // expand
    const subtask = row.querySelector(
      '[data-subtask-list] [data-subtask="0"]'
    ) as HTMLElement
    const remove = subtask.querySelector('[data-remove]') as HTMLElement
    remove.click()
    const yes = dom.window.document.querySelector(
      '[data-confirm] [data-confirm-yes]'
    ) as HTMLElement
    yes.click()
    await tick(10)
    expect(todoz.__writes.length).to.equal(1)
    expect(todoz.__writes[0].content).to.not.match(/draft section 1/)
    expect(todoz.__writes[0].content).to.match(/review numbers/)
  })

  it('removes the subtask row from the parent\'s expanded list after a confirmed subtask remove', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click() // expand
    const subtask = row.querySelector(
      '[data-subtask-list] [data-subtask="0"]'
    ) as HTMLElement
    const remove = subtask.querySelector('[data-remove]') as HTMLElement
    remove.click()
    const yes = dom.window.document.querySelector(
      '[data-confirm] [data-confirm-yes]'
    ) as HTMLElement
    yes.click()
    await tick(10)
    const updated = findRow(dom.window.document, 'prep-deck')
    const labels = Array.from(
      updated.querySelectorAll('[data-subtask-list] [data-subtask] [data-subtask-title]')
    ).map((el) => el.textContent?.trim())
    expect(labels).to.not.include('draft section 1')
  })

  it('does not call archiveFile when a subtask remove is confirmed', async () => {
    await mountApp(dom.window.document.body)
    const row = findRow(dom.window.document, 'prep-deck')
    const taskRow = row.querySelector('[data-task-row]') as HTMLElement
    taskRow.click() // expand
    const subtask = row.querySelector(
      '[data-subtask-list] [data-subtask="0"]'
    ) as HTMLElement
    const remove = subtask.querySelector('[data-remove]') as HTMLElement
    remove.click()
    const yes = dom.window.document.querySelector(
      '[data-confirm] [data-confirm-yes]'
    ) as HTMLElement
    yes.click()
    await tick(10)
    expect(todoz.__archives.length).to.equal(0)
  })
})
