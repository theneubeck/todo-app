import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountTodoList } from '../../src/renderer/index'

type TodozMock = {
  readTodos: () => Promise<Task[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  runOllama: (prompt: string) => Promise<string>
  __reads: number
  __writes: Array<{ filePath: string; content: string }>
  __raw: Map<string, string>
}

const FIXTURE_RAW = new Map<string, string>([
  [
    '/abs/test/fixtures/vault/todos/call-dentist-2026-05-04.md',
    `---\ntype: task\ntitle: "Call dentist"\nstatus: todo\ndue: 2026-05-10\ntags: [personal]\ncreated: 2026-05-04\n---\n- [ ] Book appointment\n- [ ] Check insurance coverage\n`,
  ],
  [
    '/abs/test/fixtures/vault/todos/q2-report-2026-05-04.md',
    `---\ntype: task\ntitle: "Q2 report"\nstatus: todo\ndue: 2026-06-01\ntags: [work, q2]\ncreated: 2026-05-04\n---\n- [ ] Collect numbers from analytics\n  - [ ] Page views\n  - [ ] Conversion rate\n- [ ] Write executive summary\n`,
  ],
  [
    '/abs/test/fixtures/vault/todos/read-anthropic-paper-2026-05-04.md',
    `---\ntype: task\ntitle: "Read Anthropic paper"\nstatus: todo\ntags: [reading]\ncreated: 2026-05-04\n---\n- [ ] Read and take notes\n`,
  ],
])

function buildTasks(raw: Map<string, string>): Task[] {
  // Build deterministic Task[] mirroring what main.ts will return.
  // Order is intentionally not sorted — the renderer must sort by due.
  return [
    {
      slug: 'read-anthropic-paper',
      filePath: '/abs/test/fixtures/vault/todos/read-anthropic-paper-2026-05-04.md',
      title: 'Read Anthropic paper',
      status: 'todo',
      tags: ['reading'],
      created: '2026-05-04',
      raw: raw.get('/abs/test/fixtures/vault/todos/read-anthropic-paper-2026-05-04.md') as string,
      subtasks: [{ index: 0, label: 'Read and take notes', done: false }],
    },
    {
      slug: 'q2-report',
      filePath: '/abs/test/fixtures/vault/todos/q2-report-2026-05-04.md',
      title: 'Q2 report',
      status: 'todo',
      due: '2026-06-01',
      tags: ['work', 'q2'],
      created: '2026-05-04',
      raw: raw.get('/abs/test/fixtures/vault/todos/q2-report-2026-05-04.md') as string,
      subtasks: [
        { index: 0, label: 'Collect numbers from analytics', done: false },
        { index: 1, label: 'Write executive summary', done: false },
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
      raw: raw.get('/abs/test/fixtures/vault/todos/call-dentist-2026-05-04.md') as string,
      subtasks: [
        { index: 0, label: 'Book appointment', done: false },
        { index: 1, label: 'Check insurance coverage', done: false },
      ],
    },
  ]
}

function setupDom(rawMap?: Map<string, string>): { dom: JSDOM; todoz: TodozMock } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const raw = new Map(rawMap ?? FIXTURE_RAW)
  const todoz: TodozMock = {
    __reads: 0,
    __writes: [],
    __raw: raw,
    async readTodos() {
      this.__reads += 1
      return buildTasks(this.__raw)
    },
    async writeFile(filePath: string, content: string) {
      this.__writes.push({ filePath, content })
      this.__raw.set(filePath, content)
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

describe('TodoList view', () => {
  let dom: JSDOM
  let todoz: TodozMock

  beforeEach(() => {
    const setup = setupDom()
    dom = setup.dom
    todoz = setup.todoz
  })

  it('renders the todo-list root view', async () => {
    await mountTodoList(dom.window.document.body)
    const root = dom.window.document.querySelector('[data-view="todo-list"]')
    expect(root).to.not.equal(null)
  })

  it('renders one task item per fixture', async () => {
    await mountTodoList(dom.window.document.body)
    const items = dom.window.document.querySelectorAll('[data-task]')
    expect(items.length).to.equal(3)
  })

  it('orders tasks by due date with undated last', async () => {
    await mountTodoList(dom.window.document.body)
    const items = Array.from(
      dom.window.document.querySelectorAll('[data-task]')
    ).map((el) => el.getAttribute('data-task'))
    expect(items).to.deep.equal(['call-dentist', 'q2-report', 'read-anthropic-paper'])
  })

  it('shows the due date for tasks that have one', async () => {
    await mountTodoList(dom.window.document.body)
    const dentist = dom.window.document.querySelector('[data-task="call-dentist"]')
    const due = dentist?.querySelector('[data-task-due]')
    expect(due?.textContent).to.equal('2026-05-10')
  })

  it('omits the due-date element for tasks without a due date', async () => {
    await mountTodoList(dom.window.document.body)
    const reading = dom.window.document.querySelector('[data-task="read-anthropic-paper"]')
    const due = reading?.querySelector('[data-task-due]')
    expect(due).to.equal(null)
  })

  it('renders only top-level subtasks under data-subtasks', async () => {
    await mountTodoList(dom.window.document.body)
    const q2 = dom.window.document.querySelector('[data-task="q2-report"]')
    const subtasks = q2?.querySelectorAll('[data-subtask]')
    const labels = Array.from(subtasks ?? []).map((el) =>
      el.querySelector('[data-subtask-label]')?.textContent
    )
    expect(labels).to.deep.equal([
      'Collect numbers from analytics',
      'Write executive summary',
    ])
  })

  it('writes status:done to the file when a parent checkbox is clicked', async () => {
    await mountTodoList(dom.window.document.body)
    const dentist = dom.window.document.querySelector(
      '[data-task="call-dentist"]'
    ) as HTMLElement
    const cb = dentist.querySelector('input[type="checkbox"]') as HTMLInputElement
    cb.click()
    // wait one tick for promise chain
    await new Promise((r) => setTimeout(r, 10))
    expect(todoz.__writes.length).to.equal(1)
    expect(todoz.__writes[0].filePath).to.equal(
      '/abs/test/fixtures/vault/todos/call-dentist-2026-05-04.md'
    )
    expect(todoz.__writes[0].content).to.match(/status:\s*done/)
    expect(todoz.__writes[0].content).to.match(/- \[x\] Book appointment/)
  })

  it('writes only the clicked subtask line when a subtask checkbox is clicked', async () => {
    await mountTodoList(dom.window.document.body)
    const dentist = dom.window.document.querySelector(
      '[data-task="call-dentist"]'
    ) as HTMLElement
    const sub = dentist.querySelector('[data-subtask="1"]') as HTMLElement
    const cb = sub.querySelector('input[type="checkbox"]') as HTMLInputElement
    cb.click()
    await new Promise((r) => setTimeout(r, 10))
    expect(todoz.__writes.length).to.equal(1)
    const content = todoz.__writes[0].content
    expect(content).to.match(/- \[ \] Book appointment/)
    expect(content).to.match(/- \[x\] Check insurance coverage/)
    // parent status should remain todo
    expect(content).to.match(/status:\s*todo/)
  })
})
