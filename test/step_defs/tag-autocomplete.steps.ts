import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld, FixtureTodo } from './world'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

const FIXED_TODAY = '2026-05-13'

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
      getAppSettings?: () => Promise<{
        showChat: boolean
        showToday: boolean
        showUpcoming: boolean
      }>
    }
  }
  win.todoz.readTodos = async () => world.fixtures.map(fixtureToTask)
  win.todoz.today = FIXED_TODAY
  // Chat is disabled so that the existing "submit handler" the autocomplete
  // scenarios talk about is the no-op `handleCommandEnter` path (chat would
  // clear the input on Enter and break the "Enter passes through" assertion
  // that proves the dropdown does NOT consume the key). The dropdown itself
  // is mode-agnostic and is exercised in the same way regardless.
  win.todoz.getAppSettings = async () => ({
    showChat: false,
    showToday: true,
    showUpcoming: true,
  })
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

function pressKey(world: TodozWorld, key: string): void {
  const input = commandBarInput(world)
  input.dispatchEvent(
    new world.dom!.window.KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    })
  )
}

// Build a fixture set whose tasks collectively carry the given tag list. Each
// tag gets its own one-task fixture so the renderer's uniqueTags() pulls them
// in. Tags split on commas, trimmed; project tags ("#x") are stored bare
// ("x") in frontmatter, people tags ("@x") keep their @.
function fixturesFromTagList(tagList: string): FixtureTodo[] {
  const parts = tagList.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
  return parts.map((raw, i) => {
    const tagForFrontmatter = raw.startsWith('#')
      ? raw.slice(1).toLowerCase()
      : raw.toLowerCase()
    return {
      path: `test/fixtures/vault/todos/tag-${i}-2026-05-13.md`,
      frontmatter: {
        type: 'task',
        title: `Tag fixture ${i}`,
        status: 'todo',
        tags: [tagForFrontmatter],
        created: '2026-05-13',
      },
      body: '',
    }
  })
}

Given(
  'the vault contains tasks tagged {string}',
  async function (this: TodozWorld, tagList: string) {
    this.fixtures = fixturesFromTagList(tagList)
    await ensureMounted(this)
  }
)

// "the command bar input is empty" is defined in
// test/step_defs/command-bar-fixes.steps.ts. That definition bootstraps the
// app when nothing is mounted yet, which is what the autocomplete scenarios
// also want.

Given(
  'the command bar input value is {string} with caret at end',
  async function (this: TodozWorld, value: string) {
    await ensureMounted(this)
    const input = commandBarInput(this)
    input.value = value
    input.setSelectionRange(value.length, value.length)
    input.focus()
    input.dispatchEvent(new this.dom!.window.Event('input', { bubbles: true }))
  }
)

Given('the autocomplete dropdown is open', function (this: TodozWorld) {
  const input = commandBarInput(this)
  // Use the first sigil that matches the available fixtures' tags.
  const projects = this.fixtures.some(
    (fx) =>
      Array.isArray(fx.frontmatter.tags) &&
      (fx.frontmatter.tags as string[]).some((t) => !t.startsWith('@'))
  )
  const trigger = projects ? '#' : '@'
  input.value = trigger
  input.setSelectionRange(1, 1)
  input.dispatchEvent(new this.dom!.window.Event('input', { bubbles: true }))
  const dropdown = this.document.querySelector('[data-autocomplete]')
  expect(dropdown, '[data-autocomplete] after opening').to.not.equal(null)
})

// "the user types {string} in the command bar" lives in
// test/step_defs/chat-interface.steps.ts and works for this feature too
// (it calls ensureMounted and dispatches an input event on the same field).

When('the user presses {string}', function (this: TodozWorld, key: string) {
  pressKey(this, key)
})

Then('the autocomplete dropdown is shown', function (this: TodozWorld) {
  const drop = this.document.querySelector('[data-autocomplete]')
  expect(drop, '[data-autocomplete] should be present').to.not.equal(null)
})

Then('the autocomplete dropdown is not shown', function (this: TodozWorld) {
  const drop = this.document.querySelector('[data-autocomplete]')
  expect(drop, '[data-autocomplete] should be absent').to.equal(null)
})

Then('the dropdown shows {string}', function (this: TodozWorld, label: string) {
  const labels = Array.from(
    this.document.querySelectorAll(
      '[data-autocomplete-suggestion] [data-autocomplete-label]'
    )
  ).map((el) => el.textContent?.trim())
  expect(labels, `dropdown labels should include "${label}"`).to.include(label)
})

Then(
  'the dropdown does not show {string}',
  function (this: TodozWorld, label: string) {
    const labels = Array.from(
      this.document.querySelectorAll(
        '[data-autocomplete-suggestion] [data-autocomplete-label]'
      )
    ).map((el) => el.textContent?.trim())
    expect(
      labels,
      `dropdown labels should not include "${label}"`
    ).to.not.include(label)
  }
)

Then(
  'the highlighted suggestion is {string}',
  function (this: TodozWorld, label: string) {
    const active = this.document.querySelector(
      '[data-autocomplete-suggestion][data-autocomplete-active] [data-autocomplete-label]'
    )
    expect(active, 'highlighted suggestion element').to.not.equal(null)
    expect(active?.textContent?.trim()).to.equal(label)
  }
)

// "the input value is {string}" is defined in
// test/step_defs/command-bar-fixes.steps.ts.

Then('the input retains focus', function (this: TodozWorld) {
  const input = commandBarInput(this)
  expect(this.document.activeElement).to.equal(input)
})
