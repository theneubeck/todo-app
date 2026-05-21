import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld } from './world'
import type { Focus } from '../../src/renderer/data/parseFocusCommand'
import focusFixtures from '../../test/fixtures/vault/focuses.json'

// NOTE: 'the vault contains the standard fixture todos' is defined in todoList.steps.ts — REUSE.
// NOTE: 'When the todo list view loads' is defined in todoList.steps.ts — REUSE.
//   That step calls world.mountWindow() (which already sets readFocuses / writeFocuses from
//   world.focuses via the world.ts base) then calls mountApp.
//   The focus Given steps below only set world.focuses before mount, so they're picked up.
// NOTE: 'When the user clicks sidebar entry {string}' is in read-watch.steps.ts — REUSE.
// NOTE: 'When the user submits the command {string}' is in set-due-date.steps.ts — REUSE.

function tick(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ---- Given steps ----

Given('the vault contains focus fixtures', function (this: TodozWorld) {
  this.focuses = focusFixtures as Focus[]
})

Given('the vault contains no focuses', function (this: TodozWorld) {
  this.focuses = []
})

// ---- When steps ----

When('the user clicks the focus card {string}', async function (this: TodozWorld, cardName: string) {
  const cards = Array.from(this.document.querySelectorAll('[data-focus-card]'))
  const targetCard = cards.find((c) => {
    const nameEl = c.querySelector('[data-focus-name]')
    return nameEl?.textContent?.trim() === cardName
  }) as HTMLElement | null
  expect(targetCard, `focus card named "${cardName}"`).to.not.equal(null)
  targetCard!.click()
  await tick(10)
})

// ---- Then steps ----

Then(
  'the focus board shows {int} focus cards',
  function (this: TodozWorld, count: number) {
    const cards = this.document.querySelectorAll('[data-focus-card]')
    expect(cards.length).to.equal(count)
  }
)

Then(
  'the focus card {string} shows tag {string}',
  function (this: TodozWorld, cardName: string, tagName: string) {
    const cards = Array.from(this.document.querySelectorAll('[data-focus-card]'))
    const targetCard = cards.find((c) => {
      const nameEl = c.querySelector('[data-focus-name]')
      return nameEl?.textContent?.trim() === cardName
    })
    expect(targetCard, `focus card named "${cardName}"`).to.not.equal(null)
    const tagEls = Array.from(targetCard!.querySelectorAll('[data-focus-tag]'))
    const tagTexts = tagEls.map((el) => el.textContent?.trim())
    expect(tagTexts).to.include(tagName)
  }
)

Then('an empty state message appears on the focus board', function (this: TodozWorld) {
  const empty = this.document.querySelector('[data-focus-empty]')
  expect(empty, '[data-focus-empty] should be present').to.not.equal(null)
})

Then(
  'the task list shows tasks matching the focus tags',
  function (this: TodozWorld) {
    const taskList = this.document.querySelector('[data-focus-task-list]')
    expect(taskList, '[data-focus-task-list]').to.not.equal(null)
    // The Work focus has tags: work, q2 — so Q2 report should appear (tags: work, q2)
    const titles = Array.from(taskList!.querySelectorAll('[data-task-title]')).map(
      (el) => el.textContent?.trim()
    )
    expect(titles).to.include('Q2 report')
    // Read Anthropic paper has tags: reading — should not appear
    expect(titles).to.not.include('Read Anthropic paper')
  }
)

Then('the focus board is visible', function (this: TodozWorld) {
  const board = this.document.querySelector('[data-focus-board]')
  expect(board, '[data-focus-board] should be present').to.not.equal(null)
})

Then(
  'a focus card named {string} appears on the board',
  function (this: TodozWorld, cardName: string) {
    const cards = Array.from(this.document.querySelectorAll('[data-focus-card]'))
    const names = cards.map((c) => c.querySelector('[data-focus-name]')?.textContent?.trim())
    expect(names).to.include(cardName)
  }
)
