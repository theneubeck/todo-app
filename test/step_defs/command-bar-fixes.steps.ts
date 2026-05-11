import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld } from './world'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

const FIXED_TODAY = '2026-05-07'

async function bootstrap(world: TodozWorld): Promise<void> {
  world.mountWindow()
  const win = world.dom!.window as unknown as {
    todoz: {
      readTodos: () => Promise<Task[]>
      writeFile: (p: string, c: string) => Promise<void>
      runOllama: (p: string) => Promise<string>
      today: string
    }
  }
  win.todoz.readTodos = async () => []
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

Given('the command bar input is empty', async function (this: TodozWorld) {
  await bootstrap(this)
  commandBarInput(this).value = ''
})

Given(
  'the command bar input value is {string}',
  async function (this: TodozWorld, value: string) {
    await bootstrap(this)
    commandBarInput(this).value = value
  }
)

Given('the command bar renders on initial mount', async function (this: TodozWorld) {
  await bootstrap(this)
  const bar = this.document.querySelector('[data-command-bar]')
  expect(bar, 'expected [data-command-bar] to be present').to.not.equal(null)
})

When('its DOM is inspected', function (this: TodozWorld) {
  // No-op alias; assertions follow in the Then step.
})

Then('the input value is {string}', function (this: TodozWorld, value: string) {
  const input = commandBarInput(this)
  expect(input.value).to.equal(value)
})

Then('the input is focused', function (this: TodozWorld) {
  const input = commandBarInput(this)
  expect(this.document.activeElement).to.equal(input)
})

Then(
  'the input value is unchanged at {string}',
  function (this: TodozWorld, value: string) {
    const input = commandBarInput(this)
    expect(input.value).to.equal(value)
  }
)

Then(
  'no element with {string} is present',
  function (this: TodozWorld, selector: string) {
    const found = this.document.querySelectorAll(selector)
    expect(
      found.length,
      `expected zero matches for selector ${selector}, got ${found.length}`
    ).to.equal(0)
  }
)
