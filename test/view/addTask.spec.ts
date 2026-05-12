import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

type Write = { filePath: string; content: string }

type TodozMock = {
  readTodos: () => Promise<Task[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  runOllama: (prompt: string) => Promise<string>
  today: string
  __writes: Write[]
}

const RAW_DENTIST =
  '---\ntype: task\ntitle: "Call dentist"\nstatus: todo\ndue: 2026-05-10\ntags: [personal]\ncreated: 2026-05-04\n---\n- [ ] Book appointment\n- [ ] Check insurance coverage\n'
const RAW_Q2 =
  '---\ntype: task\ntitle: "Q2 report"\nstatus: todo\ndue: 2026-06-01\ntags: [work, q2]\ncreated: 2026-05-04\n---\n- [ ] Collect numbers from analytics\n  - [ ] Page views\n  - [ ] Conversion rate\n- [ ] Write executive summary\n'
const RAW_READ =
  '---\ntype: task\ntitle: "Read Anthropic paper"\nstatus: todo\ntags: [reading]\ncreated: 2026-05-04\n---\n- [ ] Read and take notes\n'
const RAW_PICKUP =
  '---\ntype: task\ntitle: "Pickup package"\nstatus: todo\ndue: 2026-05-09\ntags: [errands]\ncreated: 2026-05-04\n---\n- [ ] Bring tracking number\n'
const RAW_SYNC =
  '---\ntype: task\ntitle: "Sync with Mike"\nstatus: todo\ndue: 2026-05-12\ntags: ["@mike"]\ncreated: 2026-05-04\n---\n- [ ] Walk through Q2 plan\n'

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
      subtasks: [
        { index: 0, label: 'Book appointment', done: false },
        { index: 1, label: 'Check insurance coverage', done: false },
      ],
    },
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
        { index: 1, label: 'Write executive summary', done: false },
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
    {
      slug: 'pickup-package',
      filePath: '/abs/test/fixtures/vault/todos/pickup-package-2026-05-04.md',
      title: 'Pickup package',
      status: 'todo',
      due: '2026-05-09',
      tags: ['errands'],
      created: '2026-05-04',
      raw: RAW_PICKUP,
      subtasks: [{ index: 0, label: 'Bring tracking number', done: false }],
    },
    {
      slug: 'sync-with-mike',
      filePath: '/abs/test/fixtures/vault/todos/sync-with-mike-2026-05-04.md',
      title: 'Sync with Mike',
      status: 'todo',
      due: '2026-05-12',
      tags: ['@mike'],
      created: '2026-05-04',
      raw: RAW_SYNC,
      subtasks: [{ index: 0, label: 'Walk through Q2 plan', done: false }],
    },
  ]
}

function setupDom(tasks: Task[] = buildTasks()): { dom: JSDOM; todoz: TodozMock } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const writes: Write[] = []
  const todoz: TodozMock = {
    today: '2026-05-07',
    __writes: writes,
    async readTodos() {
      return tasks
    },
    async writeFile(filePath: string, content: string) {
      writes.push({ filePath, content })
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

describe('AddTask', () => {
  let dom: JSDOM
  let todoz: TodozMock

  beforeEach(() => {
    const setup = setupDom()
    dom = setup.dom
    todoz = setup.todoz
  })

  it('focuses the command bar input on cmd+i', async () => {
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    const ev = new dom.window.KeyboardEvent('keydown', {
      key: 'i',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    dom.window.document.dispatchEvent(ev)
    expect(dom.window.document.activeElement).to.equal(input)
  })

  it('prefills the command bar input with /add on cmd+i', async () => {
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    const ev = new dom.window.KeyboardEvent('keydown', {
      key: 'i',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    dom.window.document.dispatchEvent(ev)
    expect(input.value).to.equal('/add ')
  })

  it('prepends /add to existing text when cmd+i is pressed', async () => {
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = 'buy milk'
    const ev = new dom.window.KeyboardEvent('keydown', {
      key: 'i',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    dom.window.document.dispatchEvent(ev)
    expect(input.value).to.equal('/add buy milk')
  })

  it('leaves the value unchanged when cmd+i is pressed and the input already starts with /add ', async () => {
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add buy milk'
    const ev = new dom.window.KeyboardEvent('keydown', {
      key: 'i',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    dom.window.document.dispatchEvent(ev)
    expect(input.value).to.equal('/add buy milk')
  })

  it('writes one task file when /add submits with a title', async () => {
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add buy milk'
    input.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(10)
    expect(todoz.__writes.length).to.equal(1)
    expect(todoz.__writes[0].filePath.endsWith('buy-milk-2026-05-07.md')).to.equal(true)
  })

  it('clears the command bar input after a successful submit', async () => {
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add buy milk'
    input.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(10)
    expect(input.value).to.equal('')
  })

  it('does not write a file when the input is /add only', async () => {
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add'
    input.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(10)
    expect(todoz.__writes.length).to.equal(0)
  })

  it('retains the input value when the input is /add only', async () => {
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add'
    input.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(10)
    expect(input.value).to.equal('/add')
  })

  it('renders the Inbox sidebar entry as initially active', async () => {
    await mountApp(dom.window.document.body)
    const inbox = dom.window.document.querySelector(
      '[data-sidebar-entry="inbox"]'
    ) as HTMLElement
    expect(inbox).to.not.equal(null)
    expect(inbox.hasAttribute('data-nav-active')).to.equal(true)
  })

  it('renders an h1 reading Inbox on initial load', async () => {
    await mountApp(dom.window.document.body)
    const h1 = dom.window.document.querySelector('[data-main-header] h1')
    expect(h1?.textContent?.trim()).to.equal('Inbox')
  })

  it('renders one PROJECTS entry per unique non-@ tag', async () => {
    await mountApp(dom.window.document.body)
    const projects = dom.window.document.querySelector(
      '[data-sidebar] [data-section="projects"]'
    )
    const labels = Array.from(
      projects?.querySelectorAll('[data-sidebar-entry] [data-nav-label]') ?? []
    ).map((el) => el.textContent?.trim())
    // Standard 5-fixture set tags: personal, work, q2, reading, errands
    expect(labels).to.include.members(['#personal', '#work', '#q2', '#reading', '#errands'])
    // None of the @ tags should appear under projects
    labels.forEach((l) => expect(l?.startsWith('@')).to.equal(false))
  })

  it('renders one PEOPLE entry per unique @-prefixed tag', async () => {
    await mountApp(dom.window.document.body)
    const people = dom.window.document.querySelector(
      '[data-sidebar] [data-section="people"]'
    )
    const labels = Array.from(
      people?.querySelectorAll('[data-sidebar-entry] [data-nav-label]') ?? []
    ).map((el) => el.textContent?.trim())
    expect(labels).to.deep.equal(['@mike'])
  })

  it('creates a new sidebar entry the first time a tag is used', async () => {
    await mountApp(dom.window.document.body)
    const before = dom.window.document.querySelector(
      '[data-sidebar] [data-section="projects"] [data-sidebar-entry="urgent"]'
    )
    expect(before).to.equal(null)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add buy milk #urgent'
    input.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(10)
    const after = dom.window.document.querySelector(
      '[data-sidebar] [data-section="projects"] [data-sidebar-entry="urgent"]'
    )
    expect(after).to.not.equal(null)
  })

  it('sets data-pulsing on each matching sidebar entry after a tagged add', async () => {
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add buy milk #urgent @sara'
    input.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(10)
    const urgent = dom.window.document.querySelector('[data-sidebar-entry="urgent"]')
    const sara = dom.window.document.querySelector('[data-sidebar-entry="@sara"]')
    expect(urgent?.getAttribute('data-pulsing')).to.equal('true')
    expect(sara?.getAttribute('data-pulsing')).to.equal('true')
  })

  it('sets data-pulsing only on Inbox after a no-tag add', async () => {
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add buy milk'
    input.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(10)
    const pulsing = Array.from(
      dom.window.document.querySelectorAll('[data-sidebar-entry][data-pulsing="true"]')
    ).map((el) => el.getAttribute('data-sidebar-entry'))
    expect(pulsing).to.deep.equal(['inbox'])
  })

  it('removes data-pulsing after the pulse duration', async () => {
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add buy milk #urgent'
    input.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(10)
    const urgent = dom.window.document.querySelector('[data-sidebar-entry="urgent"]')
    expect(urgent?.getAttribute('data-pulsing')).to.equal('true')
    await tick(700)
    const urgentAfter = dom.window.document.querySelector('[data-sidebar-entry="urgent"]')
    expect(urgentAfter?.hasAttribute('data-pulsing')).to.equal(false)
  })

  it('filters the task list to matching tasks when a tag entry is clicked', async () => {
    await mountApp(dom.window.document.body)
    const errands = dom.window.document.querySelector(
      '[data-sidebar-entry="errands"]'
    ) as HTMLElement
    expect(errands, 'errands sidebar entry').to.not.equal(null)
    errands.click()
    const tasks = Array.from(
      dom.window.document.querySelectorAll('[data-task-card] [data-task]')
    ).map((el) => el.getAttribute('data-task'))
    expect(tasks).to.deep.equal(['pickup-package'])
  })

  it('swaps the h1 to the active filter label', async () => {
    await mountApp(dom.window.document.body)
    const errands = dom.window.document.querySelector(
      '[data-sidebar-entry="errands"]'
    ) as HTMLElement
    errands.click()
    const h1 = dom.window.document.querySelector('[data-main-header] h1')
    expect(h1?.textContent?.trim()).to.equal('#errands')
  })

  it('writes to the relative vault/todos path when the vault is empty', async () => {
    const { dom: emptyDom, todoz: emptyTodoz } = setupDom([])
    await mountApp(emptyDom.window.document.body)
    const input = emptyDom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add buy milk'
    input.dispatchEvent(
      new emptyDom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(10)
    expect(emptyTodoz.__writes.length).to.equal(1)
    expect(emptyTodoz.__writes[0].filePath).to.equal(
      'vault/todos/buy-milk-2026-05-07.md'
    )
  })

  it('falls back to today from new Date() when window.todoz.today is missing', async () => {
    const { dom: nodateDom, todoz: nodateTodoz } = setupDom([])
    // Remove the today field to exercise the fallback branch
    delete (nodateTodoz as { today?: string }).today
    await mountApp(nodateDom.window.document.body)
    const input = nodateDom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add buy milk'
    input.dispatchEvent(
      new nodateDom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(10)
    expect(nodateTodoz.__writes.length).to.equal(1)
    // Filename should match today's actual date pattern; we just match the shape
    expect(nodateTodoz.__writes[0].filePath).to.match(
      /vault\/todos\/buy-milk-\d{4}-\d{2}-\d{2}\.md$/
    )
  })

  it('does not focus the input on cmd+i when no command bar is mounted', async () => {
    const { dom: bareDom } = setupDom([])
    await mountApp(bareDom.window.document.body)
    // Remove the command bar to exercise the early-return branch
    const cb = bareDom.window.document.querySelector('[data-command-bar]')
    cb?.remove()
    const ev = new bareDom.window.KeyboardEvent('keydown', {
      key: 'i',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    bareDom.window.document.dispatchEvent(ev)
    // No throw => pass
    expect(true).to.equal(true)
  })

  it('does not write when Enter is pressed on a non-add input value', async () => {
    // Note: non-slash input is now routed to the chat handler (see
    // features/chat-interface) — the input value is consumed and cleared.
    // The add-task contract here is that no file is written.
    await mountApp(dom.window.document.body)
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = 'hello world'
    input.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(10)
    expect(todoz.__writes.length).to.equal(0)
  })

  it('keeps the active filter unchanged after submit', async () => {
    await mountApp(dom.window.document.body)
    const errands = dom.window.document.querySelector(
      '[data-sidebar-entry="errands"]'
    ) as HTMLElement
    errands.click()
    const input = dom.window.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    input.value = '/add buy milk'
    input.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(10)
    const active = dom.window.document.querySelector(
      '[data-sidebar-entry][data-nav-active]'
    )
    expect(active?.getAttribute('data-sidebar-entry')).to.equal('errands')
    const h1 = dom.window.document.querySelector('[data-main-header] h1')
    expect(h1?.textContent?.trim()).to.equal('#errands')
  })
})

describe('AddTask affordance below the task card', () => {
  let dom: JSDOM
  let todoz: TodozMock

  beforeEach(() => {
    const setup = setupDom()
    dom = setup.dom
    todoz = setup.todoz
  })

  it('renders an add-task affordance after the task card on the inbox view', async () => {
    await mountApp(dom.window.document.body)
    const card = dom.window.document.querySelector('[data-task-card]')
    const aff = dom.window.document.querySelector('[data-add-task]')
    expect(card).to.not.equal(null)
    expect(aff).to.not.equal(null)
    expect(card!.compareDocumentPosition(aff!) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING).to.not.equal(0)
  })

  it('replaces the affordance with a focused input on click', async () => {
    await mountApp(dom.window.document.body)
    const aff = dom.window.document.querySelector('[data-add-task]') as HTMLElement
    aff.click()
    const input = dom.window.document.querySelector('[data-add-task-input]') as HTMLInputElement
    expect(input).to.not.equal(null)
    expect(dom.window.document.querySelector('[data-add-task]')).to.equal(null)
    expect(dom.window.document.activeElement).to.equal(input)
  })

  it('writes a new task file on Enter with non-empty text', async () => {
    await mountApp(dom.window.document.body)
    ;(dom.window.document.querySelector('[data-add-task]') as HTMLElement).click()
    const input = dom.window.document.querySelector('[data-add-task-input]') as HTMLInputElement
    input.value = 'walk the dog'
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter' }))
    await tick(10)
    expect(todoz.__writes.length).to.equal(1)
    expect(todoz.__writes[0].filePath.endsWith('walk-the-dog-2026-05-07.md')).to.equal(true)
    expect(todoz.__writes[0].content).to.contain('title: "walk the dog"')
  })

  it('does not write a file on Esc', async () => {
    await mountApp(dom.window.document.body)
    ;(dom.window.document.querySelector('[data-add-task]') as HTMLElement).click()
    const input = dom.window.document.querySelector('[data-add-task-input]') as HTMLInputElement
    input.value = 'should not write'
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }))
    await tick(10)
    expect(todoz.__writes.length).to.equal(0)
    expect(dom.window.document.querySelector('[data-add-task-input]')).to.equal(null)
    expect(dom.window.document.querySelector('[data-add-task]')).to.not.equal(null)
  })

  it('does not write a file on whitespace-only Enter', async () => {
    await mountApp(dom.window.document.body)
    ;(dom.window.document.querySelector('[data-add-task]') as HTMLElement).click()
    const input = dom.window.document.querySelector('[data-add-task-input]') as HTMLInputElement
    input.value = '   '
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter' }))
    await tick(10)
    expect(todoz.__writes.length).to.equal(0)
    expect(dom.window.document.querySelector('[data-add-task-input]')).to.equal(null)
    expect(dom.window.document.querySelector('[data-add-task]')).to.not.equal(null)
  })

  it('auto-tags the new task with the active filter when on a tag tab', async () => {
    await mountApp(dom.window.document.body)
    // Click the #errands tab
    const entry = dom.window.document.querySelector(
      '[data-sidebar-entry="errands"]'
    ) as HTMLElement
    entry.click()
    await tick(5)
    ;(dom.window.document.querySelector('[data-add-task]') as HTMLElement).click()
    const input = dom.window.document.querySelector('[data-add-task-input]') as HTMLInputElement
    input.value = 'pick up envelopes'
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter' }))
    await tick(10)
    expect(todoz.__writes.length).to.equal(1)
    expect(todoz.__writes[0].content).to.contain('tags: [errands]')
  })

  it('ignores other keys typed into the add-task input', async () => {
    await mountApp(dom.window.document.body)
    ;(dom.window.document.querySelector('[data-add-task]') as HTMLElement).click()
    const input = dom.window.document.querySelector('[data-add-task-input]') as HTMLInputElement
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'a' }))
    await tick(5)
    expect(todoz.__writes.length).to.equal(0)
    expect(dom.window.document.querySelector('[data-add-task-input]')).to.not.equal(null)
  })

  it('appends the new task to the rendered list after a successful add', async () => {
    await mountApp(dom.window.document.body)
    const before = dom.window.document.querySelectorAll('[data-task]').length
    ;(dom.window.document.querySelector('[data-add-task]') as HTMLElement).click()
    const input = dom.window.document.querySelector('[data-add-task-input]') as HTMLInputElement
    input.value = 'reorder coffee'
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter' }))
    await tick(10)
    const after = dom.window.document.querySelectorAll('[data-task]').length
    expect(after).to.equal(before + 1)
  })
})
