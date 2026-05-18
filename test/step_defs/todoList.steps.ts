import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld, FixtureTodo } from './world'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

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
  {
    path: 'test/fixtures/vault/todos/pickup-package-2026-05-04.md',
    frontmatter: {
      type: 'task',
      title: 'Pickup package',
      status: 'todo',
      due: '2026-05-09',
      tags: ['errands'],
      created: '2026-05-04',
    },
    body: '- [ ] Bring tracking number',
  },
  {
    path: 'test/fixtures/vault/todos/sync-with-mike-2026-05-04.md',
    frontmatter: {
      type: 'task',
      title: 'Sync with Mike',
      status: 'todo',
      due: '2026-05-12',
      tags: ['@mike'],
      created: '2026-05-04',
    },
    body: '- [ ] Walk through Q2 plan',
  },
]

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

Given('the vault contains the standard fixture todos', function (this: TodozWorld) {
  this.fixtures = STANDARD_FIXTURES
})

When('the todo list view loads', async function (this: TodozWorld) {
  // If the app is already mounted (by a Given step that pre-mounted it),
  // this step is a no-op — the DOM is already ready.
  if (this.dom) return

  this.mountWindow()
  const win = this.dom!.window as unknown as {
    todoz: { readTodos: () => Promise<Task[]>; today: string }
  }
  win.todoz.readTodos = async () => this.fixtures.map(fixtureToTask)
  win.todoz.today = '2026-05-07'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = this.dom!.window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).document = this.document
  await mountApp(this.document.body)
})

Then('every task title appears in due-date order', function (this: TodozWorld) {
  const titles = Array.from(this.document.querySelectorAll('[data-task-title]')).map(
    (el) => el.textContent?.trim(),
  )
  // Due-ascending order; undated last sorted by slug.
  // pickup-package 2026-05-09 < call-dentist 2026-05-10 < sync-with-mike 2026-05-12 < q2-report 2026-06-01 < read-anthropic-paper (undated)
  expect(titles).to.deep.equal([
    'Pickup package',
    'Call dentist',
    'Sync with Mike',
    'Q2 report',
    'Read Anthropic paper',
  ])
})
