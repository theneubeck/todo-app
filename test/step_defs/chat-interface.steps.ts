import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld, FixtureTodo } from './world'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

const FIXED_TODAY = '2026-05-07'

function fixtureToTask(fx: FixtureTodo): Task {
  const fm = fx.frontmatter
  const lines = fx.body.split(/\r?\n/)
  const subtasks: Task['subtasks'] = []
  let index = 0
  for (const line of lines) {
    const m = /^- \[( |x)\] (.*)$/.exec(line)
    if (m) {
      subtasks.push({ index, label: m[2], done: m[1] === 'x' })
      index += 1
    }
  }
  const fmYaml = Object.entries(fm)
    .map(([k, v]) =>
      Array.isArray(v)
        ? `${k}: [${v.join(', ')}]`
        : typeof v === 'string'
          ? `${k}: ${v}`
          : `${k}: ${String(v)}`
    )
    .join('\n')
  const raw = `---\n${fmYaml}\n---\n${fx.body}\n`
  return {
    slug: String(fm.title ?? 'task')
      .toLowerCase()
      .replace(/\s+/g, '-'),
    filePath: fx.path,
    title: String(fm.title ?? ''),
    status: (fm.status as Task['status']) ?? 'todo',
    due: fm.due as string | undefined,
    tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
    created: String(fm.created ?? ''),
    raw,
    subtasks,
  }
}

async function ensureMounted(world: TodozWorld): Promise<void> {
  if (world.dom) return
  world.mountWindow()
  const win = world.dom!.window as unknown as {
    todoz: {
      readTodos: () => Promise<Task[]>
      today: string
    }
  }
  win.todoz.readTodos = async () => world.fixtures.map(fixtureToTask)
  win.todoz.today = FIXED_TODAY
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = world.dom!.window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).document = world.document
  await mountApp(world.document.body)
}

function commandBarInput(world: TodozWorld): HTMLInputElement {
  return world.document.querySelector(
    '[data-command-bar] input[type="text"]'
  ) as HTMLInputElement
}

function fireInput(world: TodozWorld, value: string): void {
  const input = commandBarInput(world)
  input.value = value
  input.dispatchEvent(new world.dom!.window.Event('input', { bubbles: true }))
}

function pressEnter(world: TodozWorld): void {
  const input = commandBarInput(world)
  input.dispatchEvent(
    new world.dom!.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  )
}

function tick(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

Given('the chat view is active', async function (this: TodozWorld) {
  if (this.fixtures.length === 0) {
    this.fixtures = []
  }
  await ensureMounted(this)
  const chat = this.document.querySelector(
    '[data-sidebar-entry="chat"]'
  ) as HTMLElement | null
  expect(chat, 'Chat sidebar entry').to.not.equal(null)
  chat!.click()
  const view = this.document.querySelector('[data-chat-view]')
  expect(view, '[data-chat-view] after clicking Chat').to.not.equal(null)
})

When(
  'the user types {string} in the command bar and presses Enter',
  async function (this: TodozWorld, text: string) {
    await ensureMounted(this)
    fireInput(this, text)
    pressEnter(this)
    await tick(15)
  }
)

When(
  'the user types {string} in the command bar',
  async function (this: TodozWorld, text: string) {
    await ensureMounted(this)
    fireInput(this, text)
  }
)

When(
  'Ollama responds with {string}',
  async function (this: TodozWorld, text: string) {
    expect(this.resolveOllama, 'pending Ollama resolver').to.not.equal(null)
    this.resolveOllama!(text)
    this.resolveOllama = null
    await tick(15)
  }
)

Then('the task list is hidden', function (this: TodozWorld) {
  const card = this.document.querySelector('[data-task-card]')
  expect(card, '[data-task-card] should be absent when chat view is active').to.equal(
    null
  )
})

Then('the chat thread is visible', function (this: TodozWorld) {
  const view = this.document.querySelector('[data-chat-view]')
  expect(view, '[data-chat-view] should be present').to.not.equal(null)
})

Then(
  'a user bubble appears with text {string}',
  function (this: TodozWorld, text: string) {
    const bubble = this.document.querySelector(
      '[data-message="user"] [data-message-text]'
    )
    expect(bubble, '[data-message="user"] [data-message-text]').to.not.equal(null)
    expect(bubble?.textContent).to.equal(text)
  }
)

Then('a pending assistant bubble appears', function (this: TodozWorld) {
  const pending = this.document.querySelector(
    '[data-message="assistant"][data-pending]'
  )
  expect(pending, '[data-message="assistant"][data-pending]').to.not.equal(null)
})

Then(
  'the assistant bubble contains {string}',
  function (this: TodozWorld, text: string) {
    const bubble = this.document.querySelector(
      '[data-message="assistant"]:not([data-pending]) [data-message-text]'
    )
    expect(bubble, 'resolved assistant bubble').to.not.equal(null)
    expect(bubble?.textContent).to.equal(text)
  }
)

Then('the command bar is in chat mode', function (this: TodozWorld) {
  const bar = this.document.querySelector('[data-command-bar]')
  expect(bar?.getAttribute('data-command-mode')).to.equal('chat')
})

Then('the command bar is in command mode', function (this: TodozWorld) {
  const bar = this.document.querySelector('[data-command-bar]')
  expect(bar?.getAttribute('data-command-mode')).to.equal('command')
})

Then('the chat view activates automatically', function (this: TodozWorld) {
  const view = this.document.querySelector('[data-chat-view]')
  expect(view, '[data-chat-view] should be present').to.not.equal(null)
  const card = this.document.querySelector('[data-task-card]')
  expect(card, '[data-task-card] should be hidden / removed').to.equal(null)
})

Then('no Ollama call was made', function (this: TodozWorld) {
  expect(this.ollamaCallCount).to.equal(0)
})

Then('the add-task handler runs', function (this: TodozWorld) {
  expect(this.lastWriteFilePath, 'writeFile should have been called').to.not.equal(
    undefined
  )
})
