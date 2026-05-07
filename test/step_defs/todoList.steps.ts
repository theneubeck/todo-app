import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld, FixtureTodo } from './world'

const STANDARD_FIXTURES: FixtureTodo[] = [
  {
    path: 'test/fixtures/vault/todos/call-dentist-2026-05-04.md',
    frontmatter: {
      type: 'task',
      title: 'Call dentist',
      status: 'todo',
      due: '2026-05-10',
      tags: ['personal'],
      created: '2026-05-04',
    },
    body: '- [ ] Book appointment\n- [ ] Check insurance coverage',
  },
  {
    path: 'test/fixtures/vault/todos/q2-report-2026-05-04.md',
    frontmatter: {
      type: 'task',
      title: 'Q2 report',
      status: 'todo',
      due: '2026-06-01',
      tags: ['work', 'q2'],
      created: '2026-05-04',
    },
    body: '- [ ] Collect numbers from analytics\n  - [ ] Page views\n  - [ ] Conversion rate\n- [ ] Write executive summary',
  },
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

Given('the vault contains the standard fixture todos', function (this: TodozWorld) {
  this.fixtures = STANDARD_FIXTURES
})

When('the todo list view loads', function (this: TodozWorld) {
  this.mountWindow()
  const sorted = [...this.fixtures].sort((a, b) => {
    const dueA = (a.frontmatter.due as string | undefined) ?? '9999-99-99'
    const dueB = (b.frontmatter.due as string | undefined) ?? '9999-99-99'
    return dueA.localeCompare(dueB)
  })
  for (const todo of sorted) {
    const li = this.document.createElement('li')
    li.setAttribute('data-task', String(todo.frontmatter.title))
    const titleEl = this.document.createElement('span')
    titleEl.setAttribute('data-task-title', '')
    titleEl.textContent = String(todo.frontmatter.title)
    li.appendChild(titleEl)
    this.document.body.appendChild(li)
  }
})

Then('every task title appears in due-date order', function (this: TodozWorld) {
  const titles = Array.from(this.document.querySelectorAll('[data-task-title]')).map(
    (el) => el.textContent?.trim(),
  )
  expect(titles).to.deep.equal(['Call dentist', 'Q2 report', 'Read Anthropic paper'])
})
