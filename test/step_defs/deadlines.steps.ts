import { Given, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld } from './world'

// Reused steps (Given 'the vault contains the standard fixture todos') → todoList.steps.ts
// Reused steps (When 'the todo list view loads') → todoList.steps.ts
// Reused steps (When 'the user clicks sidebar entry {string}') → read-watch.steps.ts
// Reused steps (Then 'the main header title is {string}') → goto-command.steps.ts

Given('the vault contains only tasks without due dates', function (this: TodozWorld) {
  // Inline fixture: one task with no due field
  this.fixtures = [
    {
      path: 'test/fixtures/vault/todos/read-anthropic-paper-2026-05-04.md',
      frontmatter: {
        type: 'task',
        title: 'Read Anthropic paper',
        status: 'todo',
        tags: ['reading'],
        created: '2026-05-04',
      },
      body: '- [ ] Read and take notes',
    },
  ]
})

Then('only tasks with a due date appear in the Upcoming list', function (this: TodozWorld) {
  const rows = this.document.querySelectorAll('[data-upcoming-row]')
  expect(rows.length, 'number of [data-upcoming-row] elements').to.be.greaterThan(0)
  // Ensure every row has a [data-due-date] element (meaning it has a due date)
  Array.from(rows).forEach((row) => {
    const dueDate = row.querySelector('[data-due-date]')
    expect(dueDate, 'each upcoming row must have a [data-due-date]').to.not.equal(null)
  })
  // Ensure tasks without due dates are not shown (read-anthropic-paper has no due date)
  const allTitles = Array.from(this.document.querySelectorAll('[data-upcoming-row] [data-task-title]')).map(
    (el) => el.textContent?.trim(),
  )
  expect(allTitles).to.not.include('Read Anthropic paper')
})

Then('the tasks in the Upcoming list appear in ascending due-date order', function (this: TodozWorld) {
  const rows = Array.from(this.document.querySelectorAll('[data-upcoming-row]'))
  const dueDates = rows.map((row) => row.querySelector('[data-due-date]')?.textContent?.trim())
  // Verify ascending order: each date should be <= the next
  for (let i = 0; i < dueDates.length - 1; i++) {
    const a = dueDates[i]!
    const b = dueDates[i + 1]!
    expect(a <= b, `"${a}" should be <= "${b}"`).to.equal(true)
  }
})

Then('each task row in the Upcoming list shows a due-date line below the title', function (this: TodozWorld) {
  const rows = Array.from(this.document.querySelectorAll('[data-upcoming-row]'))
  expect(rows.length, '[data-upcoming-row] elements should exist').to.be.greaterThan(0)
  for (const row of rows) {
    const dueRow = row.querySelector('[data-due-row]')
    expect(dueRow, '[data-due-row] inside [data-upcoming-row]').to.not.equal(null)
  }
})

Then('the first task row in the Upcoming list shows a tag chip on the due-date line', function (this: TodozWorld) {
  const firstRow = this.document.querySelector('[data-upcoming-row]')
  expect(firstRow, 'first [data-upcoming-row] should exist').to.not.equal(null)
  const chip = firstRow!.querySelector('[data-due-row] [data-tag-chip]')
  expect(chip, '[data-tag-chip] inside [data-due-row] of first row').to.not.equal(null)
})

Then('an empty state message appears in the Upcoming view', function (this: TodozWorld) {
  const empty = this.document.querySelector('[data-upcoming-empty]')
  expect(empty, '[data-upcoming-empty] should be present').to.not.equal(null)
})

// NOTE: 'the main header title is {string}' is defined in goto-command.steps.ts — not redefined here.
