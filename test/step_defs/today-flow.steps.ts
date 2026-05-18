import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld } from './world'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

// ---- Fixture data ----

const RAW_TASK_A =
  '---\ntype: task\ntitle: "Review pull requests"\nstatus: todo\ndue: 2026-05-20\ntags: [work]\ncreated: 2026-05-18\n---\n- [ ] Read through comments\n'

const RAW_TASK_B =
  '---\ntype: task\ntitle: "Update project doc"\nstatus: todo\ntags: [work]\ncreated: 2026-05-18\n---\n'

const TASK_A: Task = {
  slug: 'today-flow-task-a',
  filePath: 'test/fixtures/vault/todos/today-flow-task-a-2026-05-18.md',
  title: 'Review pull requests',
  status: 'todo',
  due: '2026-05-20',
  tags: ['work'],
  created: '2026-05-18',
  raw: RAW_TASK_A,
  subtasks: [{ index: 0, label: 'Read through comments', done: false }],
}

const TASK_B: Task = {
  slug: 'today-flow-task-b',
  filePath: 'test/fixtures/vault/todos/today-flow-task-b-2026-05-18.md',
  title: 'Update project doc',
  status: 'todo',
  tags: ['work'],
  created: '2026-05-18',
  raw: RAW_TASK_B,
  subtasks: [],
}

const TODAY_SLUG_A = 'today-flow-task-a-2026-05-18'
const TODAY_SLUG_B = 'today-flow-task-b-2026-05-18'

// Extended world for today-flow feature state.
type TodayFlowWorld = TodozWorld & {
  todaySlugs?: string[]
  writeTodayCalls?: string[][]
  writeFileCalls?: { filePath: string; content: string }[]
}

function tick(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Mount the app with today-flow fixtures. Call before navigating.
 * The `readToday` mock returns the given slugs.
 */
async function bootstrapTodayFlow(
  world: TodayFlowWorld,
  tasks: Task[],
  todaySlugs: string[]
): Promise<void> {
  world.todaySlugs = [...todaySlugs]
  world.writeTodayCalls = []
  world.writeFileCalls = []
  world.mountWindow()
  const win = world.dom!.window as unknown as {
    todoz: {
      readTodos: () => Promise<Task[]>
      writeFile: (p: string, c: string) => Promise<void>
      readToday: () => Promise<string[]>
      writeToday: (slugs: string[]) => Promise<void>
      today: string
    }
  }
  win.todoz.readTodos = async () => tasks
  win.todoz.today = '2026-05-18'
  win.todoz.readToday = async () => world.todaySlugs ?? []
  win.todoz.writeToday = async (slugs: string[]) => {
    world.writeTodayCalls!.push([...slugs])
    world.todaySlugs = [...slugs]
  }
  win.todoz.writeFile = async (filePath: string, content: string) => {
    world.writeFileCalls!.push({ filePath, content })
    world.lastWriteFilePath = filePath
    world.lastWriteFileContent = content
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = world.dom!.window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).document = world.document
  await mountApp(world.document.body)
}

// ---- Given steps ----

Given(
  'the vault contains today-flow fixtures',
  async function (this: TodayFlowWorld) {
    // Mount the app with both tasks and today.md referencing both tasks
    // (matching the fixture file on disk).
    await bootstrapTodayFlow(this, [TASK_A, TASK_B], [TODAY_SLUG_A, TODAY_SLUG_B])
  }
)

Given(
  'the vault contains today-flow fixtures with tasks in Today',
  async function (this: TodayFlowWorld) {
    // Mount the app with both tasks and both slugs in today.md.
    await bootstrapTodayFlow(this, [TASK_A, TASK_B], [TODAY_SLUG_A, TODAY_SLUG_B])
  }
)

// ---- When steps ----

When('the Today view loads', async function (this: TodayFlowWorld) {
  // Navigate to the Today sidebar entry which triggers readToday() and re-renders.
  const todayEntry = this.document.querySelector(
    '[data-sidebar-entry="today"]'
  ) as HTMLElement | null
  expect(todayEntry, '[data-sidebar-entry="today"] in sidebar').to.not.equal(null)
  todayEntry!.click()
  await tick(20)
})

When(
  'the user clicks the add-to-today icon on the first task row',
  async function (this: TodayFlowWorld) {
    const firstIcon = this.document.querySelector(
      '[data-add-to-today]'
    ) as HTMLElement | null
    expect(firstIcon, '[data-add-to-today] icon').to.not.equal(null)
    firstIcon!.click()
    await tick(10)
  }
)

When(
  'the user clicks the remove-from-today icon on a task row',
  async function (this: TodayFlowWorld) {
    const removeBtn = this.document.querySelector(
      '[data-remove-from-today]'
    ) as HTMLElement | null
    expect(removeBtn, '[data-remove-from-today] icon').to.not.equal(null)
    removeBtn!.click()
    await tick(10)
  }
)

When(
  'the user adds a task via the command bar',
  async function (this: TodayFlowWorld) {
    const input = this.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    expect(input, 'command bar input').to.not.equal(null)
    input.value = '/add finish the report'
    input.dispatchEvent(
      new this.dom!.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
    )
    await tick(20)
  }
)

// ---- Then steps ----

Then(
  'the Today task list shows the linked tasks in order',
  function (this: TodayFlowWorld) {
    const rows = Array.from(
      this.document.querySelectorAll('[data-today-row]')
    )
    expect(rows.length, 'number of today rows').to.be.greaterThan(0)
    // Task A should appear before Task B (order from today.md).
    const slugs = rows.map((r) => r.getAttribute('data-slug'))
    expect(slugs[0]).to.equal(TODAY_SLUG_A)
    expect(slugs[1]).to.equal(TODAY_SLUG_B)
  }
)

Then(
  'each task row shows an add-to-today icon on hover',
  function (this: TodayFlowWorld) {
    const icons = this.document.querySelectorAll('[data-add-to-today]')
    expect(icons.length, '[data-add-to-today] icon count').to.be.greaterThan(0)
  }
)

Then('the task appears in the Today list', function (this: TodayFlowWorld) {
  // After clicking add-to-today on the first task, the Today list should have a row.
  // We verify that writeToday was called with a non-empty array.
  const calls = this.writeTodayCalls ?? []
  expect(calls.length, 'writeToday call count').to.be.greaterThan(0)
  const lastCall = calls[calls.length - 1]
  expect(lastCall.length, 'today slug count').to.be.greaterThan(0)
})

Then(
  'today.md is updated with the task wikilink',
  function (this: TodayFlowWorld) {
    const calls = this.writeTodayCalls ?? []
    expect(calls.length, 'writeToday calls').to.be.greaterThan(0)
    const lastCall = calls[calls.length - 1]
    expect(lastCall.length, 'slugs in today').to.be.greaterThan(0)
  }
)

Then(
  'the task is removed from the Today list',
  function (this: TodayFlowWorld) {
    // After remove or completion, the removed task's slug is gone from today.
    const calls = this.writeTodayCalls ?? []
    expect(calls.length, 'writeToday calls').to.be.greaterThan(0)
    const lastCall = calls[calls.length - 1]
    // The Today list should have fewer slugs than before (2 → 1 or 1 → 0).
    expect(lastCall.length).to.be.lessThan(2)
  }
)

Then(
  'the original task file is unchanged',
  function (this: TodayFlowWorld) {
    // Remove-from-today should NOT have called writeFile on any task file.
    const taskWrites = (this.writeFileCalls ?? []).filter(
      (w) =>
        w.filePath.includes('today-flow-task-a') ||
        w.filePath.includes('today-flow-task-b')
    )
    expect(taskWrites.length, 'task file writes').to.equal(0)
  }
)

Then(
  'the original task file has status done',
  function (this: TodayFlowWorld) {
    const taskWrites = (this.writeFileCalls ?? []).filter(
      (w) =>
        w.filePath.includes('today-flow-task-a') ||
        w.filePath.includes('today-flow-task-b')
    )
    expect(taskWrites.length, 'task file writes').to.be.greaterThan(0)
    const anyDone = taskWrites.some((w) => /status:\s*done/.test(w.content))
    expect(anyDone, 'at least one write has status: done').to.equal(true)
  }
)

Then('the Today list is empty', function (this: TodayFlowWorld) {
  // Either the DOM shows no today rows, or writeToday was called with [].
  const rows = this.document.querySelectorAll('[data-today-row]')
  expect(rows.length, '[data-today-row] count after clear').to.equal(0)
})

Then('today.md is empty', function (this: TodayFlowWorld) {
  const calls = this.writeTodayCalls ?? []
  expect(calls.length, 'writeToday calls').to.be.greaterThan(0)
  const lastCall = calls[calls.length - 1]
  expect(lastCall).to.deep.equal([])
})

Then('the new task appears in the Today list', function (this: TodayFlowWorld) {
  const calls = this.writeTodayCalls ?? []
  expect(calls.length, 'writeToday calls').to.be.greaterThan(0)
  const lastCall = calls[calls.length - 1]
  // Should have the 2 existing slugs + 1 new slug
  expect(lastCall.length, 'total slugs in today after add').to.be.greaterThan(2)
})

Then(
  'today.md is updated with the new task wikilink',
  function (this: TodayFlowWorld) {
    const calls = this.writeTodayCalls ?? []
    expect(calls.length, 'writeToday calls').to.be.greaterThan(0)
    const lastCall = calls[calls.length - 1]
    // The new slug should contain part of the task title
    const hasNewSlug = lastCall.some((s) => s.includes('finish') || s.includes('report'))
    expect(hasNewSlug, 'new task slug in writeToday call').to.equal(true)
  }
)
