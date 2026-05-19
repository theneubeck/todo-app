import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld, FixtureTodo } from './world'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

// The shared steps ('the vault contains the standard fixture todos' and
// 'the todo list view loads') are registered in todoList.steps.ts and will
// be found automatically since Cucumber loads all step defs.

// ---------------------------------------------------------------------------
// Helper: bootstrap the app from the world's fixtures
// (mirrors the pattern in todoList.steps.ts / add-task.steps.ts)
// ---------------------------------------------------------------------------
async function bootstrap(world: TodozWorld): Promise<void> {
  world.mountWindow()
  const win = world.dom!.window as unknown as {
    todoz: { readTodos: () => Promise<Task[]>; today: string }
  }
  win.todoz.readTodos = async () => world.fixtures as unknown as Task[]
  win.todoz.today = '2026-05-19'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = world.dom!.window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).document = world.document
  await mountApp(world.document.body)
}

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

Given(
  'a task with due date {string} is loaded',
  function (this: TodozWorld, dueDate: string) {
    const fixture: FixtureTodo = {
      path: 'test/fixtures/vault/todos/buy-milk.md',
      frontmatter: {
        type: 'task',
        title: 'Buy milk',
        status: 'todo',
        due: dueDate,
        tags: [],
        created: '2026-05-19',
      },
      body: '',
    }
    this.fixtures = [fixture]
  }
)

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

When(
  'the user submits the command {string}',
  async function (this: TodozWorld, command: string) {
    // If app not already mounted, bootstrap it.
    if (!this.dom) {
      await bootstrap(this)
    }
    const input = this.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    expect(input, 'command bar input').to.not.equal(null)
    input.value = command
    const ev = new this.dom!.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(ev)
    // Allow async writeFile and re-render to settle.
    await new Promise((r) => setTimeout(r, 20))
  }
)

When(
  'the user clicks the set-due icon on the first task row',
  function (this: TodozWorld) {
    const btn = this.document.querySelector('[data-set-due]') as HTMLElement | null
    expect(btn, '[data-set-due] button should be present').to.not.equal(null)
    btn!.click()
  }
)

When(
  'the user types {string} into the due input and presses Enter',
  async function (this: TodozWorld, date: string) {
    const input = this.document.querySelector('[data-due-input]') as HTMLInputElement | null
    expect(input, '[data-due-input] should be present').to.not.equal(null)
    input!.value = date
    const ev = new this.dom!.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    input!.dispatchEvent(ev)
    // Allow async writeFile to settle.
    await new Promise((r) => setTimeout(r, 20))
  }
)

When(
  'the user presses Escape on the due input',
  function (this: TodozWorld) {
    const input = this.document.querySelector('[data-due-input]') as HTMLInputElement | null
    expect(input, '[data-due-input] should be present').to.not.equal(null)
    const ev = new this.dom!.window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    input!.dispatchEvent(ev)
  }
)

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

Then(
  'the written file contains due {string}',
  function (this: TodozWorld, date: string) {
    expect(
      this.lastWriteFileContent,
      'writeFile should have been called'
    ).to.not.equal(undefined)
    expect(this.lastWriteFileContent).to.contain(`due: ${date}`)
  }
)

Then(
  'a set-due icon is present on the first task row',
  function (this: TodozWorld) {
    const icon = this.document.querySelector('[data-set-due]')
    expect(icon, '[data-set-due] icon should be present').to.not.equal(null)
  }
)

Then(
  'a date input is visible in the first task row',
  function (this: TodozWorld) {
    const input = this.document.querySelector('[data-due-input]')
    expect(input, '[data-due-input] should be present').to.not.equal(null)
  }
)

Then(
  'the date input is pre-filled with {string}',
  function (this: TodozWorld, date: string) {
    const input = this.document.querySelector('[data-due-input]') as HTMLInputElement | null
    expect(input, '[data-due-input] should be present').to.not.equal(null)
    expect(input!.value).to.equal(date)
  }
)

Then(
  'the date input is not present',
  function (this: TodozWorld) {
    const input = this.document.querySelector('[data-due-input]')
    expect(input, '[data-due-input] should be gone').to.equal(null)
  }
)

Then(
  'the task file is not written',
  function (this: TodozWorld) {
    expect(this.lastWriteFilePath, 'writeFile should not have been called').to.equal(undefined)
    expect(this.lastWriteFileContent, 'writeFile should not have been called').to.equal(undefined)
  }
)
