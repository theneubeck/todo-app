import { Given, When, Then, Before, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import { TodozWorld, FixtureTodo } from './world'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

const TODAY = '2026-05-09'
const FIX_DIR = path.resolve(__dirname, '..', 'fixtures', 'vault', 'todos')

type ExtendedWorld = TodozWorld & {
  __snapshotsBySlug?: Map<string, { path: string; content: string | null }>
}

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

function buildRaw(slug: string, status: string, body: string): string {
  // The body is supplied by the feature step, with literal "\n" sequences
  // that we must convert to real newlines. The frontmatter is minimal but
  // matches the schema (type, title, status, tags, created).
  const realBody = body.replace(/\\n/g, '\n')
  return (
    `---\n` +
    `type: task\n` +
    `title: ${slug}\n` +
    `status: ${status}\n` +
    `tags: []\n` +
    `created: ${TODAY}\n` +
    `---\n` +
    `${realBody}\n`
  )
}

function fixturePath(slug: string): string {
  return path.join(FIX_DIR, `${slug}-${TODAY}.md`)
}

function snapshotFile(world: ExtendedWorld, slug: string, p: string): void {
  if (!world.__snapshotsBySlug) world.__snapshotsBySlug = new Map()
  if (world.__snapshotsBySlug.has(slug)) return
  const exists = fs.existsSync(p)
  world.__snapshotsBySlug.set(slug, {
    path: p,
    content: exists ? fs.readFileSync(p, 'utf-8') : null,
  })
}

function findSubtaskByTitle(
  parentRow: HTMLElement,
  title: string
): HTMLElement | null {
  const subs = parentRow.querySelectorAll('[data-subtask-list] [data-subtask]')
  for (const s of Array.from(subs)) {
    const t = s.querySelector('[data-subtask-title]')
    if (t?.textContent?.trim() === title) return s as HTMLElement
  }
  return null
}

async function ensureExpanded(world: TodozWorld, row: HTMLElement): Promise<void> {
  if (row.getAttribute('data-expanded') === 'true') return
  const taskRow = row.querySelector('[data-task-row]') as HTMLElement | null
  if (!taskRow) return
  taskRow.click()
  await new Promise((r) => setTimeout(r, 10))
}

async function bootstrapWorld(world: TodozWorld): Promise<void> {
  world.mountWindow()
  const win = world.dom!.window as unknown as {
    todoz: {
      readTodos: () => Promise<Task[]>
      writeFile: (p: string, c: string) => Promise<void>
      runOllama: (p: string) => Promise<string>
      today?: string
    }
  }
  win.todoz.readTodos = async () => world.fixtures.map(fixtureToTask)
  win.todoz.today = TODAY
  // Override writeFile so it captures (existing behaviour) AND writes to
  // disk so the Then steps can re-read the file frontmatter directly.
  const origWrite = win.todoz.writeFile
  win.todoz.writeFile = async (p: string, c: string) => {
    await origWrite(p, c)
    fs.writeFileSync(p, c, 'utf-8')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = world.dom!.window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).document = world.document
  await mountApp(world.document.body)
}

Before({ tags: '@status-reconciliation or not @status-reconciliation' }, function () {
  // No-op marker hook so that After hooks below have a chance to run when
  // they need to. Cucumber runs After hooks for every scenario regardless
  // of tags, so we instead guard the After body itself by checking the
  // snapshot map.
})

After(function (this: ExtendedWorld) {
  const snaps = this.__snapshotsBySlug
  if (snaps) {
    for (const { path: p, content } of snaps.values()) {
      if (content === null) {
        if (fs.existsSync(p)) fs.unlinkSync(p)
      } else {
        fs.writeFileSync(p, content, 'utf-8')
      }
    }
    this.__snapshotsBySlug = undefined
  }
  // Also unlink anything in createdFixtures that wasn't snapshotted.
  for (const p of this.createdFixtures) {
    if (fs.existsSync(p)) {
      // Skip if any snapshot already restored it.
      const wasSnapshotted = false
      if (!wasSnapshotted) fs.unlinkSync(p)
    }
  }
  this.createdFixtures = []
})

// ---------- Given ----------

Given(
  'a combined task {string} exists with body {string} and frontmatter status {string}',
  async function (
    this: ExtendedWorld,
    slug: string,
    body: string,
    status: string
  ) {
    const p = fixturePath(slug)
    snapshotFile(this, slug, p)
    const raw = buildRaw(slug, status, body)
    fs.mkdirSync(FIX_DIR, { recursive: true })
    fs.writeFileSync(p, raw, 'utf-8')
    this.createdFixtures.push(p)
    // Seed the in-memory fixtures the world will hand to readTodos.
    const realBody = body.replace(/\\n/g, '\n')
    this.fixtures = [
      {
        path: p,
        frontmatter: {
          type: 'task',
          title: slug,
          status,
          tags: [],
          created: TODAY,
        },
        body: realBody,
      },
    ]
    await bootstrapWorld(this)
  }
)

Given(
  'a simple task {string} exists with empty body and frontmatter status {string}',
  async function (this: ExtendedWorld, slug: string, status: string) {
    const p = fixturePath(slug)
    snapshotFile(this, slug, p)
    const raw = buildRaw(slug, status, '')
    fs.mkdirSync(FIX_DIR, { recursive: true })
    fs.writeFileSync(p, raw, 'utf-8')
    this.createdFixtures.push(p)
    this.fixtures = [
      {
        path: p,
        frontmatter: {
          type: 'task',
          title: slug,
          status,
          tags: [],
          created: TODAY,
        },
        body: '',
      },
    ]
    await bootstrapWorld(this)
  }
)

Given('the initial remaining count is captured', function (this: ExtendedWorld) {
  const el = this.document.querySelector('[data-remaining-count]')
  const text = el?.textContent?.trim() ?? ''
  const m = /^(\d+)\s/.exec(text)
  expect(m, `remaining-count parses an integer: "${text}"`).to.not.equal(null)
  this.initialRemainingCount = parseInt(m![1], 10)
})

// ---------- When ----------

When('the user checks subtask {string}', async function (
  this: ExtendedWorld,
  title: string
) {
  // The fixture has a single task row whose slug matches title-case via
  // slugFromName; we look it up by walking [data-task] entries.
  const allTaskRows = Array.from(this.document.querySelectorAll('[data-task]'))
  expect(allTaskRows.length, 'task rows on screen').to.be.greaterThan(0)
  const row = allTaskRows[0] as HTMLElement
  await ensureExpanded(this, row)
  const sub = findSubtaskByTitle(row, title)
  expect(sub, `subtask titled "${title}"`).to.not.equal(null)
  const cb = sub!.querySelector(
    '[data-checkbox-wrapper] input[type="checkbox"]'
  ) as HTMLInputElement
  expect(cb, 'subtask checkbox').to.not.equal(null)
  expect(cb.checked, 'subtask should not already be checked').to.equal(false)
  cb.click()
  await new Promise((r) => setTimeout(r, 50))
})

When('the user unchecks subtask {string}', async function (
  this: ExtendedWorld,
  title: string
) {
  const allTaskRows = Array.from(this.document.querySelectorAll('[data-task]'))
  expect(allTaskRows.length, 'task rows on screen').to.be.greaterThan(0)
  const row = allTaskRows[0] as HTMLElement
  await ensureExpanded(this, row)
  const sub = findSubtaskByTitle(row, title)
  expect(sub, `subtask titled "${title}"`).to.not.equal(null)
  const cb = sub!.querySelector(
    '[data-checkbox-wrapper] input[type="checkbox"]'
  ) as HTMLInputElement
  expect(cb, 'subtask checkbox').to.not.equal(null)
  expect(cb.checked, 'subtask should be checked before uncheck').to.equal(true)
  cb.click()
  await new Promise((r) => setTimeout(r, 50))
})

When('the user adds a subtask {string}', async function (
  this: ExtendedWorld,
  title: string
) {
  const allTaskRows = Array.from(this.document.querySelectorAll('[data-task]'))
  expect(allTaskRows.length, 'task rows on screen').to.be.greaterThan(0)
  const row = allTaskRows[0] as HTMLElement
  // Pick the simple-task affordance directly under the row, or the combined
  // affordance inside the subtask list — whichever is present.
  const aff = row.querySelector('[data-add-subtask]') as HTMLElement | null
  expect(aff, 'add-subtask affordance').to.not.equal(null)
  aff!.click()
  const input = row.querySelector(
    '[data-add-subtask-input]'
  ) as HTMLInputElement | null
  expect(input, 'add-subtask input').to.not.equal(null)
  input!.value = title
  const KeyboardEventCtor = (this.dom!.window as unknown as {
    KeyboardEvent: typeof KeyboardEvent
  }).KeyboardEvent
  input!.dispatchEvent(new KeyboardEventCtor('keydown', { key: 'Enter' }))
  await new Promise((r) => setTimeout(r, 50))
})

When('the user removes subtask {string}', async function (
  this: ExtendedWorld,
  title: string
) {
  const allTaskRows = Array.from(this.document.querySelectorAll('[data-task]'))
  expect(allTaskRows.length, 'task rows on screen').to.be.greaterThan(0)
  const row = allTaskRows[0] as HTMLElement
  await ensureExpanded(this, row)
  const sub = findSubtaskByTitle(row, title)
  expect(sub, `subtask titled "${title}"`).to.not.equal(null)
  const remove = sub!.querySelector('[data-remove]') as HTMLElement | null
  expect(remove, 'subtask remove icon').to.not.equal(null)
  remove!.click()
  // Confirm via the Yes button.
  const yes = this.document.querySelector(
    '[data-confirm] [data-confirm-yes]'
  ) as HTMLElement | null
  expect(yes, 'confirm yes button').to.not.equal(null)
  yes!.click()
  await new Promise((r) => setTimeout(r, 50))
})

// ---------- Then ----------

Then(
  'the file frontmatter status of {string} is {string}',
  function (this: ExtendedWorld, slug: string, expected: string) {
    const p = fixturePath(slug)
    expect(fs.existsSync(p), `fixture file ${p}`).to.equal(true)
    const content = fs.readFileSync(p, 'utf-8')
    const m = /^\s*status:\s*(todo|doing|done)\s*$/m.exec(content)
    expect(m, `status line in ${p}`).to.not.equal(null)
    expect(m![1]).to.equal(expected)
  }
)

Then('the remaining count is 1 less than the captured value', function (
  this: ExtendedWorld
) {
  expect(this.initialRemainingCount, 'initial count captured').to.not.equal(undefined)
  const el = this.document.querySelector('[data-remaining-count]')
  const text = el?.textContent?.trim() ?? ''
  const m = /^(\d+)\s/.exec(text)
  expect(m, `remaining-count parses: "${text}"`).to.not.equal(null)
  const after = parseInt(m![1], 10)
  expect(after).to.equal(this.initialRemainingCount! - 1)
})

Then('the remaining count is 1 more than the captured value', function (
  this: ExtendedWorld
) {
  expect(this.initialRemainingCount, 'initial count captured').to.not.equal(undefined)
  const el = this.document.querySelector('[data-remaining-count]')
  const text = el?.textContent?.trim() ?? ''
  const m = /^(\d+)\s/.exec(text)
  expect(m, `remaining-count parses: "${text}"`).to.not.equal(null)
  const after = parseInt(m![1], 10)
  expect(after).to.equal(this.initialRemainingCount! + 1)
})
