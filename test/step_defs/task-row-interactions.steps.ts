import { Given, When, Then, Before } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld, FixtureTodo } from './world'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

// Augment the world with snapshot fields used only by this feature.
type RowSnapshot = { slug: string; outerHTML: string }
type ExtendedWorld = TodozWorld & {
  __preActionStatus?: Record<string, string>
  __rowSnapshots?: RowSnapshot[]
  __taskRowFixtures?: FixtureTodo[]
}

const TASK_ROW_FIXTURES: FixtureTodo[] = [
  {
    path: 'test/fixtures/vault/todos/buy-milk-2026-05-08.md',
    frontmatter: {
      type: 'task',
      title: 'Buy milk',
      status: 'todo',
      tags: ['errands'],
      created: '2026-05-08',
    },
    body: '',
  },
  {
    path: 'test/fixtures/vault/todos/send-invoice-2026-05-08.md',
    frontmatter: {
      type: 'task',
      title: 'Send invoice',
      status: 'done',
      tags: ['work'],
      created: '2026-05-08',
    },
    body: '',
  },
  {
    path: 'test/fixtures/vault/todos/prep-deck-2026-05-08.md',
    frontmatter: {
      type: 'task',
      title: 'Prep deck',
      status: 'todo',
      tags: ['work'],
      created: '2026-05-08',
    },
    body: '- [ ] draft section 1\n- [ ] review numbers',
  },
  {
    path: 'test/fixtures/vault/todos/weekly-shop-2026-05-08.md',
    frontmatter: {
      type: 'task',
      title: 'Weekly shop',
      status: 'todo',
      tags: ['errands'],
      created: '2026-05-08',
    },
    body: '- [x] paper towels\n- [ ] coffee',
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
    slug: String(fm.title ?? 'task').toLowerCase().replace(/\s+/g, '-'),
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

function slugFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}

function filenameFromSlug(slug: string): string | undefined {
  for (const fx of TASK_ROW_FIXTURES) {
    const fxSlug = String(fx.frontmatter.title).toLowerCase().replace(/\s+/g, '-')
    if (fxSlug === slug) {
      const idx = fx.path.lastIndexOf('/')
      return fx.path.slice(idx + 1)
    }
  }
  return undefined
}

function findRow(world: TodozWorld, slug: string): HTMLElement | null {
  return world.document.querySelector(`[data-task="${slug}"]`) as HTMLElement | null
}

function findSubtaskRowByLabel(
  world: TodozWorld,
  parentSlug: string,
  label: string
): HTMLElement | null {
  const parent = findRow(world, parentSlug)
  if (!parent) return null
  const subtasks = parent.querySelectorAll('[data-subtask-list] [data-subtask]')
  for (const sub of Array.from(subtasks)) {
    const t = sub.querySelector('[data-subtask-title]')
    if (t?.textContent?.trim() === label) return sub as HTMLElement
  }
  return null
}

function parseStatusFromContent(content: string): string {
  const m = /status:\s*(todo|doing|done)/.exec(content)
  return m ? m[1] : ''
}

Before(function (this: ExtendedWorld) {
  this.lastWriteFilePath = undefined
  this.lastWriteFileContent = undefined
  this.lastArchiveFilePath = undefined
  this.__preActionStatus = {}
  this.__rowSnapshots = []
})

Given('the vault contains task-row-interactions fixtures', async function (
  this: ExtendedWorld
) {
  this.fixtures = TASK_ROW_FIXTURES
  this.__taskRowFixtures = TASK_ROW_FIXTURES
  this.mountWindow()
  ;(
    this.dom!.window as unknown as {
      todoz: { readTodos: () => Promise<Task[]> }
    }
  ).todoz.readTodos = async () => this.fixtures.map(fixtureToTask)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = this.dom!.window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).document = this.document
  await mountApp(this.document.body)
  // Capture pre-action status snapshots so "frontmatter status is unchanged"
  // can compare against the initial value.
  for (const fx of this.fixtures) {
    const slug = String(fx.frontmatter.title).toLowerCase().replace(/\s+/g, '-')
    this.__preActionStatus![slug] = String(fx.frontmatter.status ?? 'todo')
  }
})

Given(
  'the combined task {string} is rendered collapsed',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    expect(row!.getAttribute('data-expanded')).to.not.equal('true')
  }
)

Given(
  'the combined task {string} is expanded',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    if (row!.getAttribute('data-expanded') !== 'true') {
      const taskRow = row!.querySelector('[data-task-row]') as HTMLElement
      taskRow.click()
    }
    expect(row!.getAttribute('data-expanded')).to.equal('true')
  }
)

When(
  'the user clicks the checkbox of the {string} row',
  async function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    const cb = row!.querySelector(
      '[data-task-row] [data-checkbox-wrapper] input[type="checkbox"]'
    ) as HTMLInputElement
    expect(cb, `checkbox for ${slug}`).to.not.equal(null)
    cb.click()
    await new Promise((r) => setTimeout(r, 10))
  }
)

When(
  'the user clicks the body of the {string} row',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    const taskRow = row!.querySelector('[data-task-row]') as HTMLElement
    expect(taskRow, `task row body for ${slug}`).to.not.equal(null)
    const title = taskRow.querySelector('[data-task-title]') as HTMLElement
    // Click the title region — it descends from neither [data-checkbox-wrapper]
    // nor [data-remove], so it triggers the row body's expand handler.
    if (title) {
      title.click()
    } else {
      taskRow.click()
    }
  }
)

When(
  'the user clicks the checkbox of the {string} subtask under {string}',
  async function (this: ExtendedWorld, label: string, parent: string) {
    const parentSlug = slugFromName(parent)
    const subRow = findSubtaskRowByLabel(this, parentSlug, label)
    expect(subRow, `subtask "${label}" under ${parentSlug}`).to.not.equal(null)
    const cb = subRow!.querySelector(
      '[data-checkbox-wrapper] input[type="checkbox"]'
    ) as HTMLInputElement
    expect(cb, `subtask checkbox`).to.not.equal(null)
    cb.click()
    await new Promise((r) => setTimeout(r, 10))
  }
)

When(
  'the user clicks the remove icon of the {string} row',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    // Snapshot the row's outer HTML before opening the confirm so we can
    // assert "row appears unchanged" after a No.
    this.__rowSnapshots!.push({ slug, outerHTML: row!.outerHTML })
    const remove = row!.querySelector(
      '[data-task-row] [data-remove]'
    ) as HTMLElement
    expect(remove, `remove icon for ${slug}`).to.not.equal(null)
    remove.click()
  }
)

When(
  'the user clicks the remove icon of the {string} subtask under {string}',
  function (this: ExtendedWorld, label: string, parent: string) {
    const parentSlug = slugFromName(parent)
    const subRow = findSubtaskRowByLabel(this, parentSlug, label)
    expect(subRow, `subtask "${label}" under ${parentSlug}`).to.not.equal(null)
    const remove = subRow!.querySelector('[data-remove]') as HTMLElement
    expect(remove, `subtask remove icon`).to.not.equal(null)
    remove.click()
  }
)

When(
  'the user clicks {string} on the confirm prompt',
  async function (this: ExtendedWorld, choice: string) {
    const sel = choice === 'Yes' ? '[data-confirm-yes]' : '[data-confirm-no]'
    const btn = this.document.querySelector(
      `[data-confirm] ${sel}`
    ) as HTMLElement | null
    expect(btn, `${choice} button on confirm prompt`).to.not.equal(null)
    btn!.click()
    await new Promise((r) => setTimeout(r, 10))
  }
)

Then('only combined-task rows display a chevron', function (this: ExtendedWorld) {
  const tasks = Array.from(this.document.querySelectorAll('[data-task]'))
  for (const t of tasks) {
    const kind = t.getAttribute('data-kind')
    const chevron = t.querySelector('[data-task-row] [data-chevron]')
    if (kind === 'combined') {
      expect(
        chevron,
        `combined task ${t.getAttribute('data-task')} should have a chevron`
      ).to.not.equal(null)
    } else {
      expect(
        chevron,
        `simple task ${t.getAttribute('data-task')} should not have a chevron`
      ).to.equal(null)
    }
  }
})

Then(
  'the {string} file\'s frontmatter status is {string}',
  function (this: ExtendedWorld, name: string, expected: string) {
    const slug = slugFromName(name)
    const filename = filenameFromSlug(slug)
    expect(filename, `filename for ${slug}`).to.not.equal(undefined)
    expect(this.lastWriteFilePath, `writeFile call for ${filename}`).to.not.equal(
      undefined
    )
    expect((this.lastWriteFilePath ?? '').endsWith(filename!)).to.equal(true)
    const content = this.lastWriteFileContent ?? ''
    expect(parseStatusFromContent(content)).to.equal(expected)
  }
)

Then(
  'the {string} row shows the checked success state',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    const wrapper = row!.querySelector(
      '[data-task-row] [data-checkbox-wrapper][data-checked="true"]'
    )
    expect(wrapper, `checked checkbox wrapper on ${slug}`).to.not.equal(null)
  }
)

Then(
  'the {string} row\'s title is strikethrough with on-surface-variant color',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    const title = row!.querySelector(
      '[data-task-title][data-completed="true"]'
    )
    expect(title, `completed title on ${slug}`).to.not.equal(null)
  }
)

Then(
  'the {string} row\'s checked styling is removed',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    const completedTitle = row!.querySelector(
      '[data-task-title][data-completed="true"]'
    )
    expect(completedTitle).to.equal(null)
  }
)

Then(
  'the {string} row is expanded',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    expect(row!.getAttribute('data-expanded')).to.equal('true')
  }
)

Then(
  'one subtask row appears for each subtask line in the {string} file body',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    const fx = (this.__taskRowFixtures ?? this.fixtures).find(
      (f) => String(f.frontmatter.title).toLowerCase().replace(/\s+/g, '-') === slug
    )
    expect(fx, `fixture for ${slug}`).to.not.equal(undefined)
    const lines = fx!.body.split(/\r?\n/)
    const expected = lines.filter((l) => /^- \[( |x)\] /.test(l)).length
    const actual = row!.querySelectorAll('[data-subtask-list] [data-subtask]').length
    expect(actual).to.equal(expected)
  }
)

Then(
  'the {string} file body shows {string}',
  function (this: ExtendedWorld, name: string, expected: string) {
    const slug = slugFromName(name)
    const filename = filenameFromSlug(slug)
    expect(this.lastWriteFilePath, `writeFile path for ${filename}`).to.not.equal(
      undefined
    )
    expect((this.lastWriteFilePath ?? '').endsWith(filename!)).to.equal(true)
    expect(this.lastWriteFileContent ?? '').to.include(expected)
  }
)

Then(
  'the {string} row\'s frontmatter status is unchanged',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const filename = filenameFromSlug(slug)
    const before = this.__preActionStatus?.[slug] ?? 'todo'
    if (
      this.lastWriteFilePath &&
      this.lastWriteFilePath.endsWith(filename!) &&
      this.lastWriteFileContent
    ) {
      expect(parseStatusFromContent(this.lastWriteFileContent)).to.equal(before)
    }
    // If no write was recorded for this file's name, the status is trivially
    // unchanged.
  }
)

Then(
  'the {string} subtask row shows the checked success state',
  function (this: ExtendedWorld, label: string) {
    // Search globally for a subtask row matching the label (the parent context
    // is implicit: only one parent is expanded in the scenarios that use this).
    const subs = Array.from(
      this.document.querySelectorAll('[data-subtask-list] [data-subtask]')
    )
    const target = subs.find(
      (s) =>
        s.querySelector('[data-subtask-title]')?.textContent?.trim() === label
    )
    expect(target, `subtask "${label}"`).to.not.equal(undefined)
    const wrapper = target!.querySelector(
      '[data-checkbox-wrapper][data-checked="true"]'
    )
    expect(wrapper, `checked subtask wrapper for "${label}"`).to.not.equal(null)
  }
)

Then('no task file is changed', function (this: ExtendedWorld) {
  expect(this.lastWriteFilePath, 'no writeFile expected').to.equal(undefined)
  expect(this.lastArchiveFilePath, 'no archiveFile expected').to.equal(undefined)
})

Then(
  'the {string} row appears unchanged',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const snap = (this.__rowSnapshots ?? []).find((s) => s.slug === slug)
    expect(snap, `snapshot for ${slug}`).to.not.equal(undefined)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    expect(row!.outerHTML).to.equal(snap!.outerHTML)
  }
)

Then(
  'the {string} file no longer exists in vault todos',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const filename = filenameFromSlug(slug)
    expect(this.lastArchiveFilePath, `archiveFile call`).to.not.equal(undefined)
    expect((this.lastArchiveFilePath ?? '').endsWith(filename!)).to.equal(true)
  }
)

Then(
  'the {string} file exists in vault archive todos',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const filename = filenameFromSlug(slug)
    expect(this.lastArchiveFilePath, `archiveFile call`).to.not.equal(undefined)
    expect((this.lastArchiveFilePath ?? '').endsWith(filename!)).to.equal(true)
  }
)

Then(
  'the {string} row no longer appears in the list',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row).to.equal(null)
  }
)

Then(
  'the {string} file body no longer contains {string}',
  function (this: ExtendedWorld, name: string, fragment: string) {
    const slug = slugFromName(name)
    const filename = filenameFromSlug(slug)
    expect(this.lastWriteFilePath, `writeFile call for ${filename}`).to.not.equal(
      undefined
    )
    expect((this.lastWriteFilePath ?? '').endsWith(filename!)).to.equal(true)
    expect(this.lastWriteFileContent ?? '').to.not.include(fragment)
  }
)

Then(
  'the {string} file still exists in vault todos',
  function (this: ExtendedWorld, name: string) {
    const slug = slugFromName(name)
    const filename = filenameFromSlug(slug)
    if (this.lastArchiveFilePath) {
      expect((this.lastArchiveFilePath ?? '').endsWith(filename!)).to.equal(false)
    }
    // Otherwise no archive call was made for any file → the file is still in vault todos.
  }
)

Then(
  'the {string} subtask row no longer appears under {string}',
  function (this: ExtendedWorld, label: string, parent: string) {
    const parentSlug = slugFromName(parent)
    const row = findRow(this, parentSlug)
    expect(row, `parent row ${parentSlug}`).to.not.equal(null)
    const subs = row!.querySelectorAll('[data-subtask-list] [data-subtask]')
    const labels = Array.from(subs).map(
      (s) => s.querySelector('[data-subtask-title]')?.textContent?.trim()
    )
    expect(labels).to.not.include(label)
  }
)
