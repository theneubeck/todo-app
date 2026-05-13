import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

type ToolEvent = {
  callId: string
  name: string
  argsRaw: string
  status: 'ok' | 'error'
  resultContent: string
  action?: string
  error?: string
}

type OllamaSuccess = { ok: true; reply: string; toolEvents?: ToolEvent[] }
type OllamaFailure = { ok: false; error: string; statusCode: number; toolEvents?: ToolEvent[] }
type OllamaResult = OllamaSuccess | OllamaFailure

type OllamaCall = {
  prompt: string
  resolve: (result: OllamaResult) => void
}

type TodozMock = {
  readTodos: () => Promise<Task[]>
  writeFile: (filePath: string, content: string) => Promise<void>
  runOllama: (prompt: string) => Promise<OllamaResult>
  today: string
  __ollamaCalls: OllamaCall[]
}

function setupDom(): { dom: JSDOM; todoz: TodozMock } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const ollamaCalls: OllamaCall[] = []
  const todoz: TodozMock = {
    today: '2026-05-13',
    __ollamaCalls: ollamaCalls,
    async readTodos() {
      return []
    },
    async writeFile() {
      // no-op
    },
    runOllama(prompt: string) {
      return new Promise<OllamaResult>((resolve) => {
        ollamaCalls.push({ prompt, resolve })
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

async function driveSendAndResolve(
  dom: JSDOM,
  todoz: TodozMock,
  result: OllamaResult,
  prompt = 'add a task to buy milk'
): Promise<void> {
  await mountApp(dom.window.document.body)
  const input = commandBarInput(dom)
  fireInput(input, dom, prompt)
  pressEnter(input, dom)
  await tick(10)
  expect(todoz.__ollamaCalls.length).to.equal(1)
  todoz.__ollamaCalls[0].resolve(result)
  await tick(20)
}

describe('Tool row rendering', () => {
  let dom: JSDOM
  let todoz: TodozMock

  beforeEach(() => {
    const setup = setupDom()
    dom = setup.dom
    todoz = setup.todoz
  })

  it('renders a [data-message=tool] row when a tool call succeeds', async () => {
    await driveSendAndResolve(dom, todoz, {
      ok: true,
      reply: 'done',
      toolEvents: [
        {
          callId: 'c1',
          name: 'add_task',
          argsRaw: '{"title":"buy milk"}',
          status: 'ok',
          resultContent: 'buy-milk-2026-05-13.md',
          action: 'add_task: buy milk',
        },
      ],
    })
    const row = dom.window.document.querySelector('[data-message="tool"]')
    expect(row).to.not.equal(null)
  })

  it('renders [data-tool-status=ok] on success', async () => {
    await driveSendAndResolve(dom, todoz, {
      ok: true,
      reply: 'done',
      toolEvents: [
        {
          callId: 'c1',
          name: 'add_task',
          argsRaw: '{"title":"buy milk"}',
          status: 'ok',
          resultContent: 'buy-milk-2026-05-13.md',
          action: 'add_task: buy milk',
        },
      ],
    })
    const row = dom.window.document.querySelector('[data-message="tool"]')
    expect(row?.getAttribute('data-tool-status')).to.equal('ok')
  })

  it('renders [data-tool-status=error] on failure', async () => {
    await driveSendAndResolve(dom, todoz, {
      ok: true,
      reply: 'sorry',
      toolEvents: [
        {
          callId: 'c1',
          name: 'add_task',
          argsRaw: '{}',
          status: 'error',
          resultContent: "add_task: missing required argument 'title'",
          action: 'add_task',
          error: "add_task: missing required argument 'title'",
        },
      ],
    })
    const row = dom.window.document.querySelector('[data-message="tool"]')
    expect(row?.getAttribute('data-tool-status')).to.equal('error')
  })

  it('renders the action label in [data-tool-action]', async () => {
    await driveSendAndResolve(dom, todoz, {
      ok: true,
      reply: 'done',
      toolEvents: [
        {
          callId: 'c1',
          name: 'add_task',
          argsRaw: '{"title":"buy milk"}',
          status: 'ok',
          resultContent: 'buy-milk-2026-05-13.md',
          action: 'add_task: buy milk',
        },
      ],
    })
    const action = dom.window.document.querySelector('[data-tool-action]')
    expect(action?.textContent).to.equal('add_task: buy milk')
  })

  it('renders the error message in [data-tool-error] on failure', async () => {
    await driveSendAndResolve(dom, todoz, {
      ok: true,
      reply: 'sorry',
      toolEvents: [
        {
          callId: 'c1',
          name: 'add_task',
          argsRaw: '{}',
          status: 'error',
          resultContent: "add_task: missing required argument 'title'",
          action: 'add_task',
          error: "add_task: missing required argument 'title'",
        },
      ],
    })
    const err = dom.window.document.querySelector('[data-tool-error]')
    expect(err?.textContent).to.equal("add_task: missing required argument 'title'")
  })
})

describe('Multi-turn flow', () => {
  let dom: JSDOM
  let todoz: TodozMock

  beforeEach(() => {
    const setup = setupDom()
    dom = setup.dom
    todoz = setup.todoz
  })

  it('renders tool rows above the final assistant bubble in chronological order', async () => {
    await driveSendAndResolve(dom, todoz, {
      ok: true,
      reply: 'Added.',
      toolEvents: [
        {
          callId: 'c1',
          name: 'add_task',
          argsRaw: '{"title":"buy milk"}',
          status: 'ok',
          resultContent: 'buy-milk-2026-05-13.md',
          action: 'add_task: buy milk',
        },
        {
          callId: 'c2',
          name: 'add_task',
          argsRaw: '{"title":"buy eggs"}',
          status: 'ok',
          resultContent: 'buy-eggs-2026-05-13.md',
          action: 'add_task: buy eggs',
        },
      ],
    })
    const thread = dom.window.document.querySelector('[data-chat-thread]') as HTMLElement
    const children = Array.from(thread.children) as HTMLElement[]
    const idxUser = children.findIndex((c) => c.getAttribute('data-message') === 'user')
    const toolIdxs = children
      .map((c, i) => ({ kind: c.getAttribute('data-message'), i }))
      .filter((x) => x.kind === 'tool')
      .map((x) => x.i)
    const idxAssistant = children.findIndex(
      (c) =>
        c.getAttribute('data-message') === 'assistant' &&
        !c.hasAttribute('data-pending') &&
        !c.hasAttribute('data-error')
    )
    expect(toolIdxs).to.have.lengthOf(2)
    expect(toolIdxs[0]).to.be.greaterThan(idxUser)
    expect(toolIdxs[1]).to.be.greaterThan(toolIdxs[0])
    expect(idxAssistant).to.be.greaterThan(toolIdxs[1])
  })

  it('does not render a normal assistant bubble when only tool calls are returned', async () => {
    await driveSendAndResolve(dom, todoz, {
      ok: true,
      reply: '',
      toolEvents: [
        {
          callId: 'c1',
          name: 'add_task',
          argsRaw: '{"title":"buy milk"}',
          status: 'ok',
          resultContent: 'buy-milk-2026-05-13.md',
          action: 'add_task: buy milk',
        },
      ],
    })
    const normal = dom.window.document.querySelectorAll(
      '[data-message="assistant"]:not([data-pending]):not([data-error])'
    )
    expect(normal.length).to.equal(0)
  })

  it('renders the assistant content bubble when the model returns content with no tool_calls', async () => {
    await driveSendAndResolve(dom, todoz, {
      ok: true,
      reply: 'Which tasks would you like to add?',
      toolEvents: [],
    })
    const bubble = dom.window.document.querySelector(
      '[data-message="assistant"]:not([data-pending]):not([data-error]) [data-message-text]'
    )
    expect(bubble?.textContent).to.equal('Which tasks would you like to add?')
  })
})
