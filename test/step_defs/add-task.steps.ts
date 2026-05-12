import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld, FixtureTodo } from './world'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

const FIXED_TODAY = '2026-05-07'

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
  win.todoz.readTodos = async () => world.fixtures.map(fixtureToTask)
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

function findEntryByLabel(world: TodozWorld, label: string): HTMLElement | null {
  const entries = Array.from(
    world.document.querySelectorAll('[data-sidebar] [data-sidebar-entry]')
  )
  for (const entry of entries) {
    const lbl = entry.querySelector('[data-nav-label]')
    if (lbl?.textContent?.trim() === label) return entry as HTMLElement
  }
  return null
}

Given('the command bar is empty', async function (this: TodozWorld) {
  this.fixtures = []
  await bootstrap(this)
  commandBarInput(this).value = ''
})

Given('the command bar reads {string}', async function (this: TodozWorld, value: string) {
  if (!this.dom) {
    this.fixtures = this.fixtures.length > 0 ? this.fixtures : []
    await bootstrap(this)
  }
  commandBarInput(this).value = value
})

When('the user presses cmd+i', function (this: TodozWorld) {
  const ev = new this.dom!.window.KeyboardEvent('keydown', {
    key: 'i',
    metaKey: true,
    bubbles: true,
    cancelable: true,
  })
  this.document.dispatchEvent(ev)
})

When('the user presses Enter', async function (this: TodozWorld) {
  const input = commandBarInput(this)
  const ev = new this.dom!.window.KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  })
  input.dispatchEvent(ev)
  // Allow any pending writeFile/render microtasks to settle.
  await new Promise((r) => setTimeout(r, 10))
})

When(
  'the user clicks the {string} sidebar entry',
  async function (this: TodozWorld, label: string) {
    if (!this.dom) {
      await bootstrap(this)
    }
    const entry = findEntryByLabel(this, label)
    expect(entry, `sidebar entry with label "${label}"`).to.not.equal(null)
    entry!.click()
  }
)

Then(
  'the command bar shows {string} with focus',
  function (this: TodozWorld, value: string) {
    const input = commandBarInput(this)
    expect(input.value).to.equal(value)
    expect(this.document.activeElement).to.equal(input)
  }
)

Then(
  'a new task file {string} appears in the vault todos folder',
  function (this: TodozWorld, filename: string) {
    expect(this.lastWriteFilePath, 'writeFile was called').to.not.equal(undefined)
    expect(
      (this.lastWriteFilePath ?? '').endsWith(filename),
      `expected last write path to end with ${filename}, got ${this.lastWriteFilePath}`
    ).to.equal(true)
  }
)

Then(
  'a {string} entry appears under PROJECTS in the sidebar',
  function (this: TodozWorld, label: string) {
    const projects = this.document.querySelector(
      '[data-sidebar] [data-section="projects"]'
    )
    expect(projects, 'PROJECTS section').to.not.equal(null)
    const labels = Array.from(
      projects!.querySelectorAll('[data-sidebar-entry] [data-nav-label]')
    ).map((el) => el.textContent?.trim())
    expect(labels).to.include(label)
  }
)

Then(
  'a {string} entry appears under PEOPLE in the sidebar',
  function (this: TodozWorld, label: string) {
    const people = this.document.querySelector(
      '[data-sidebar] [data-section="people"]'
    )
    expect(people, 'PEOPLE section').to.not.equal(null)
    const labels = Array.from(
      people!.querySelectorAll('[data-sidebar-entry] [data-nav-label]')
    ).map((el) => el.textContent?.trim())
    expect(labels).to.include(label)
  }
)

Then(
  'the {string} sidebar entry pulses',
  function (this: TodozWorld, label: string) {
    const entry = findEntryByLabel(this, label)
    expect(entry, `sidebar entry with label "${label}"`).to.not.equal(null)
    expect(entry!.getAttribute('data-pulsing')).to.equal('true')
  }
)

Then('the Inbox sidebar entry pulses', function (this: TodozWorld) {
  const inbox = this.document.querySelector(
    '[data-sidebar-entry="inbox"][data-pulsing="true"]'
  )
  expect(inbox, 'Inbox sidebar entry pulsing').to.not.equal(null)
})

Then('no other sidebar entry pulses', function (this: TodozWorld) {
  const pulsing = Array.from(
    this.document.querySelectorAll('[data-sidebar-entry][data-pulsing="true"]')
  )
  pulsing.forEach((el) => {
    expect(el.getAttribute('data-sidebar-entry')).to.equal('inbox')
  })
})

Then('no sidebar entry pulses', function (this: TodozWorld) {
  const pulsing = this.document.querySelector(
    '[data-sidebar-entry][data-pulsing="true"]'
  )
  expect(pulsing).to.equal(null)
})

Then(
  'the main list shows only tasks tagged {string}',
  function (this: TodozWorld, tag: string) {
    const expected = this.fixtures
      .filter((fx) => Array.isArray(fx.frontmatter.tags) && (fx.frontmatter.tags as string[]).includes(tag))
      .map((fx) =>
        String(fx.frontmatter.title)
          .toLowerCase()
          .replace(/\s+/g, '-')
      )
    const actual = Array.from(
      this.document.querySelectorAll('[data-task-card] [data-task]')
    ).map((el) => el.getAttribute('data-task'))
    expect(actual).to.deep.equal(expected)
  }
)

Then('the main h1 reads {string}', function (this: TodozWorld, text: string) {
  const h1 = this.document.querySelector('[data-main-header] h1')
  expect(h1?.textContent?.trim()).to.equal(text)
})

Then('the Inbox sidebar entry is visually active', function (this: TodozWorld) {
  const active = this.document.querySelector(
    '[data-sidebar-entry="inbox"][data-nav-active]'
  )
  expect(active, 'Inbox sidebar entry should have data-nav-active').to.not.equal(null)
})

Then('no new task file is written', function (this: TodozWorld) {
  expect(this.lastWriteFilePath, 'no writeFile call expected').to.equal(undefined)
})

Then(
  'the command bar still reads {string}',
  function (this: TodozWorld, value: string) {
    expect(commandBarInput(this).value).to.equal(value)
  }
)
