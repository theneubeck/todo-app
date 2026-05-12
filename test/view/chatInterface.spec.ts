import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

type Write = { filePath: string; content: string }

type OllamaCall = {
  prompt: string
  resolve: (text: string) => void
  reject: (err: Error) => void
}

type TodozMock = {
  readTodos: () => Promise<Task[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  runOllama: (prompt: string) => Promise<string>
  today: string
  __writes: Write[]
  __ollamaCalls: OllamaCall[]
}

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
      raw: '---\ntype: task\ntitle: "Call dentist"\nstatus: todo\ndue: 2026-05-10\ntags: [personal]\ncreated: 2026-05-04\n---\n- [ ] Book appointment\n',
      subtasks: [{ index: 0, label: 'Book appointment', done: false }],
    },
  ]
}

function setupDom(tasks: Task[] = buildTasks()): { dom: JSDOM; todoz: TodozMock } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const writes: Write[] = []
  const ollamaCalls: OllamaCall[] = []
  const todoz: TodozMock = {
    today: '2026-05-07',
    __writes: writes,
    __ollamaCalls: ollamaCalls,
    async readTodos() {
      return tasks
    },
    async writeFile(filePath: string, content: string) {
      writes.push({ filePath, content })
    },
    runOllama(prompt: string) {
      return new Promise<string>((resolve, reject) => {
        ollamaCalls.push({ prompt, resolve, reject })
      })
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

function commandBarInput(dom: JSDOM): HTMLInputElement {
  return dom.window.document.querySelector(
    '[data-command-bar] input[type="text"]'
  ) as HTMLInputElement
}

function fireInput(input: HTMLInputElement, dom: JSDOM, value: string): void {
  input.value = value
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}

function pressEnter(input: HTMLInputElement, dom: JSDOM): void {
  input.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  )
}

function clickChatEntry(dom: JSDOM): void {
  const chat = dom.window.document.querySelector(
    '[data-sidebar-entry="chat"]'
  ) as HTMLElement
  chat.click()
}

describe('ChatInterface', () => {
  let dom: JSDOM
  let todoz: TodozMock

  beforeEach(() => {
    const setup = setupDom()
    dom = setup.dom
    todoz = setup.todoz
  })

  it('shows the chat thread when the Chat sidebar entry is clicked', async () => {
    await mountApp(dom.window.document.body)
    clickChatEntry(dom)
    const view = dom.window.document.querySelector('[data-chat-view]')
    expect(view).to.not.equal(null)
  })

  it('hides the task list when the Chat sidebar entry is clicked', async () => {
    await mountApp(dom.window.document.body)
    clickChatEntry(dom)
    const card = dom.window.document.querySelector('[data-task-card]')
    expect(card).to.equal(null)
  })

  it('appends a user bubble when a non-slash message is submitted', async () => {
    await mountApp(dom.window.document.body)
    clickChatEntry(dom)
    const input = commandBarInput(dom)
    fireInput(input, dom, 'hello there')
    pressEnter(input, dom)
    await tick(10)
    const bubble = dom.window.document.querySelector(
      '[data-message="user"] [data-message-text]'
    )
    expect(bubble?.textContent).to.equal('hello there')
  })

  it('clears the command bar input after a chat message is submitted', async () => {
    await mountApp(dom.window.document.body)
    clickChatEntry(dom)
    const input = commandBarInput(dom)
    fireInput(input, dom, 'hello there')
    pressEnter(input, dom)
    await tick(10)
    expect(commandBarInput(dom).value).to.equal('')
  })

  it('shows a pending assistant bubble while waiting for Ollama', async () => {
    await mountApp(dom.window.document.body)
    clickChatEntry(dom)
    const input = commandBarInput(dom)
    fireInput(input, dom, 'hello there')
    pressEnter(input, dom)
    await tick(10)
    const pending = dom.window.document.querySelector(
      '[data-message="assistant"][data-pending]'
    )
    expect(pending).to.not.equal(null)
  })

  it('replaces the pending bubble with the assistant reply when Ollama responds', async () => {
    await mountApp(dom.window.document.body)
    clickChatEntry(dom)
    const input = commandBarInput(dom)
    fireInput(input, dom, 'hello there')
    pressEnter(input, dom)
    await tick(10)
    expect(todoz.__ollamaCalls.length).to.equal(1)
    todoz.__ollamaCalls[0].resolve('hi back')
    await tick(20)
    const pending = dom.window.document.querySelector(
      '[data-message="assistant"][data-pending]'
    )
    expect(pending).to.equal(null)
    const assistant = dom.window.document.querySelector(
      '[data-message="assistant"]:not([data-pending]) [data-message-text]'
    )
    expect(assistant?.textContent).to.equal('hi back')
  })

  it('activates the chat view when a message is sent from the task list view', async () => {
    await mountApp(dom.window.document.body)
    // Do not click chat — we are on inbox/task list
    expect(dom.window.document.querySelector('[data-chat-view]')).to.equal(null)
    const input = commandBarInput(dom)
    fireInput(input, dom, 'what should I focus on?')
    pressEnter(input, dom)
    await tick(10)
    const view = dom.window.document.querySelector('[data-chat-view]')
    expect(view).to.not.equal(null)
  })

  it('shows the user bubble in the thread when auto-activating from task list view', async () => {
    await mountApp(dom.window.document.body)
    const input = commandBarInput(dom)
    fireInput(input, dom, 'what should I focus on?')
    pressEnter(input, dom)
    await tick(10)
    const bubble = dom.window.document.querySelector(
      '[data-message="user"] [data-message-text]'
    )
    expect(bubble?.textContent).to.equal('what should I focus on?')
  })

  it('sets data-command-mode=chat when the input does not start with /', async () => {
    await mountApp(dom.window.document.body)
    const input = commandBarInput(dom)
    fireInput(input, dom, 'remind me to')
    const bar = dom.window.document.querySelector('[data-command-bar]')
    expect(bar?.getAttribute('data-command-mode')).to.equal('chat')
  })

  it('sets data-command-mode=command when the input starts with /', async () => {
    await mountApp(dom.window.document.body)
    const input = commandBarInput(dom)
    fireInput(input, dom, '/add buy milk')
    const bar = dom.window.document.querySelector('[data-command-bar]')
    expect(bar?.getAttribute('data-command-mode')).to.equal('command')
  })

  it('switches back to chat mode when the leading / is deleted', async () => {
    await mountApp(dom.window.document.body)
    const input = commandBarInput(dom)
    fireInput(input, dom, '/add buy milk')
    fireInput(input, dom, 'add buy milk')
    const bar = dom.window.document.querySelector('[data-command-bar]')
    expect(bar?.getAttribute('data-command-mode')).to.equal('chat')
  })

  it('does not call runOllama when the input starts with /', async () => {
    await mountApp(dom.window.document.body)
    clickChatEntry(dom)
    const input = commandBarInput(dom)
    fireInput(input, dom, '/add buy milk')
    pressEnter(input, dom)
    await tick(10)
    expect(todoz.__ollamaCalls.length).to.equal(0)
  })

  it('routes a /add command to the add-task handler from within chat view', async () => {
    await mountApp(dom.window.document.body)
    clickChatEntry(dom)
    const input = commandBarInput(dom)
    fireInput(input, dom, '/add buy milk')
    pressEnter(input, dom)
    await tick(10)
    expect(todoz.__writes.length).to.equal(1)
    expect(todoz.__writes[0].filePath.endsWith('buy-milk-2026-05-07.md')).to.equal(true)
  })
})
