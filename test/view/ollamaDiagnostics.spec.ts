import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

type OllamaSuccess = { ok: true; reply: string }
type OllamaFailure = { ok: false; error: string; statusCode: number }
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

function buildTasks(): Task[] {
  return []
}

function setupDom(): { dom: JSDOM; todoz: TodozMock } {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const ollamaCalls: OllamaCall[] = []
  const todoz: TodozMock = {
    today: '2026-05-12',
    __ollamaCalls: ollamaCalls,
    async readTodos() {
      return buildTasks()
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
  ;(todoz as any).getAppSettings = async () => ({
    showChat: true,
    showToday: true,
    showUpcoming: true,
  })
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

async function driveSendAndFail(
  dom: JSDOM,
  todoz: TodozMock,
  errorText: string
): Promise<void> {
  await mountApp(dom.window.document.body)
  const input = commandBarInput(dom)
  fireInput(input, dom, 'what should I do')
  pressEnter(input, dom)
  await tick(10)
  expect(todoz.__ollamaCalls.length).to.equal(1)
  todoz.__ollamaCalls[0].resolve({
    ok: false,
    error: errorText,
    statusCode: 500,
  })
  await tick(20)
}

describe('Chat error rendering', () => {
  let dom: JSDOM
  let todoz: TodozMock

  beforeEach(() => {
    const setup = setupDom()
    dom = setup.dom
    todoz = setup.todoz
  })

  it('replaces the pending bubble with an error bubble when runOllama returns ok false', async () => {
    await driveSendAndFail(dom, todoz, 'Error: model not found')
    const pending = dom.window.document.querySelector(
      '[data-message="assistant"][data-pending]'
    )
    expect(pending, 'pending bubble must be gone').to.equal(null)
    const error = dom.window.document.querySelector(
      '[data-message="assistant"][data-error]'
    )
    expect(error, 'error bubble must be present').to.not.equal(null)
  })

  it('sets data-error on the resulting assistant bubble', async () => {
    await driveSendAndFail(dom, todoz, 'Error: model not found')
    const bubble = dom.window.document.querySelector(
      '[data-message="assistant"][data-error]'
    )
    expect(bubble, 'error bubble must exist').to.not.equal(null)
    expect(bubble!.hasAttribute('data-error')).to.equal(true)
  })

  it('renders the error string as the bubble text', async () => {
    await driveSendAndFail(dom, todoz, 'Error: model not found')
    const text = dom.window.document.querySelector(
      '[data-message="assistant"][data-error] [data-message-text]'
    )
    expect(text?.textContent).to.equal('Error: model not found')
  })

  it('does not render a normal assistant bubble alongside the error bubble', async () => {
    await driveSendAndFail(dom, todoz, 'Error: model not found')
    const normal = dom.window.document.querySelectorAll(
      '[data-message="assistant"]:not([data-pending]):not([data-error])'
    )
    expect(normal.length).to.equal(0)
  })
})
