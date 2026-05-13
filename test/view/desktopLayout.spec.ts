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
  '---\ntype: task\ntitle: "Call dentist"\nstatus: todo\ndue: 2026-05-10\ntags: [personal]\ncreated: 2026-05-04\n---\n- [ ] Book appointment\n'

function buildTasks(): Task[] {
  return [
    {
      slug: 'call-dentist',
      filePath: '/abs/test/fixtures/vault/todos/call-dentist-2026-05-04.md',
      title: 'Call dentist',
      status: 'todo',
      due: '2026-05-10',
      tags: ['personal'],
      created: '2026-05-04',
      raw: RAW_DENTIST,
      subtasks: [{ index: 0, label: 'Book appointment', done: false }],
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

describe('Desktop layout', () => {
  let dom: JSDOM

  beforeEach(() => {
    const setup = setupDom()
    dom = setup.dom
  })

  it('renders [data-app-shell] without a max-width on the main pane', async () => {
    await mountApp(dom.window.document.body)
    const main = dom.window.document.querySelector(
      '[data-app-shell] [data-main-view]'
    ) as HTMLElement | null
    expect(main, 'expected [data-main-view] inside [data-app-shell]').to.not.equal(
      null
    )
    // Inline style or rule must not constrain the main pane to 768px or any
    // narrower fixed reading column.
    const inlineMaxWidth = main!.style.maxWidth
    expect(inlineMaxWidth === '' || inlineMaxWidth === 'none').to.equal(true)
  })

  it('renders [data-sidebar] as a sibling of the main pane inside [data-app-body]', async () => {
    await mountApp(dom.window.document.body)
    const body = dom.window.document.querySelector('[data-app-shell] [data-app-body]')
    expect(body, '[data-app-body] inside [data-app-shell]').to.not.equal(null)
    const sidebar = body!.querySelector(':scope > [data-sidebar]')
    const mainView = body!.querySelector(':scope > [data-main-view]')
    expect(sidebar, '[data-sidebar] is a direct child of [data-app-body]').to.not.equal(
      null
    )
    expect(
      mainView,
      '[data-main-view] is a direct child of [data-app-body]'
    ).to.not.equal(null)
  })

  it('renders [data-task-card] without the outline-variant border', async () => {
    await mountApp(dom.window.document.body)
    const card = dom.window.document.querySelector(
      '[data-task-card]'
    ) as HTMLElement | null
    expect(card, '[data-task-card] is present').to.not.equal(null)
    // The plan moves the visible 1px border off the card; this assertion checks
    // there is no inline border style. The stylesheet rule sets `border: none`.
    const inlineBorder = card!.style.border
    expect(inlineBorder === '' || inlineBorder === 'none').to.equal(true)
  })

  it('renders the command bar inside the main pane, not at root', async () => {
    await mountApp(dom.window.document.body)
    const bar = dom.window.document.querySelector('[data-command-bar]')
    expect(bar, '[data-command-bar] is present').to.not.equal(null)
    // The command bar must live inside [data-main-view] (the main pane),
    // not at the root of the document body or inside the sidebar.
    const mainPane = bar!.closest('[data-main-view]')
    expect(mainPane, '[data-command-bar] is nested inside [data-main-view]').to.not.equal(
      null
    )
    const sidebar = bar!.closest('[data-sidebar]')
    expect(sidebar, '[data-command-bar] is NOT inside [data-sidebar]').to.equal(null)
  })
})
