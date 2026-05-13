import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld, FixtureTodo } from './world'
import type { Task } from '../../src/renderer/data/parseTodo'
import { mountApp } from '../../src/renderer/index'

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
  const fmYaml =
    Object.entries(fm)
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

Given('the app loads', function (this: TodozWorld) {
  // No fixtures required for chrome-only scenarios
  this.fixtures = []
})

When('the initial render completes', async function (this: TodozWorld) {
  this.mountWindow()
  // Override readTodos to return our fixtures as Task[]
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
})

When('its row is expanded', async function (this: TodozWorld) {
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
})

Then(
  'the top app bar shows the brand {string} with action icons',
  function (this: TodozWorld, brand: string) {
    const bar = this.document.querySelector('[data-app-bar]')
    expect(bar, 'app bar').to.not.equal(null)
    const brandEl = bar?.querySelector('[data-brand]')
    expect(brandEl?.textContent?.trim()).to.equal(brand)
    expect(bar?.querySelector('[data-icon="add"]'), 'add icon').to.not.equal(null)
    expect(bar?.querySelector('[data-icon="settings"]'), 'settings icon').to.not.equal(
      null
    )
    expect(bar?.querySelector('[data-icon="person"]'), 'person icon').to.not.equal(null)
  }
)

Then(
  'the left sidebar shows the navigation entries {string} with {string} marked active',
  function (this: TodozWorld, entriesText: string, activeText: string) {
    const expected = entriesText.split(',').map((s) => s.trim())
    const entries = Array.from(
      this.document.querySelectorAll('[data-sidebar] [data-nav-entry]')
    ).map((el) => el.querySelector('[data-nav-label]')?.textContent?.trim())
    expect(entries).to.deep.equal(expected)
    const active = this.document.querySelector(
      '[data-sidebar] [data-nav-entry][data-nav-active]'
    )
    const activeLabel = active?.querySelector('[data-nav-label]')
    expect(activeLabel?.textContent?.trim()).to.equal(activeText)
  }
)

Then(
  'the main content header shows the h1 {string} above the remaining-count line',
  function (this: TodozWorld, h1Text: string) {
    const header = this.document.querySelector('[data-main-header]')
    expect(header, 'main header').to.not.equal(null)
    const h1 = header?.querySelector('h1')
    expect(h1?.textContent?.trim()).to.equal(h1Text)
    const count = header?.querySelector('[data-remaining-count]')
    expect(count, 'remaining count line').to.not.equal(null)
    expect(count?.textContent ?? '').to.match(/\d+ tasks? remaining/)
  }
)

Then(
  'the task list renders inside a full-width card grouped under uppercase priority headings',
  function (this: TodozWorld) {
    // Superseded by features/desktop-layout: the card no longer has an
    // outline-variant border or 768px max-width — it stretches to the main
    // pane's full width. The grouping-headings half of the original assertion
    // is unchanged.
    const cards = this.document.querySelectorAll('[data-task-card]')
    expect(cards.length, 'one task card').to.equal(1)
    const card = cards[0] as HTMLElement
    const list = card.querySelector('[data-task-list]')
    expect(list, 'task list inside card').to.not.equal(null)
    const inlineBorder = card.style.border
    expect(inlineBorder === '' || inlineBorder === 'none').to.equal(true)
    const inlineMaxWidth = card.style.maxWidth
    expect(inlineMaxWidth === '' || inlineMaxWidth === 'none').to.equal(true)
    const headings = Array.from(
      card.querySelectorAll('[data-group-heading]')
    ).map((el) => el.textContent?.trim() ?? '')
    expect(headings.length, 'at least one group heading').to.be.greaterThan(0)
    headings.forEach((h) => {
      expect(h, `heading "${h}" should be uppercase`).to.equal(h.toUpperCase())
    })
  }
)

Then(
  'the subtasks render indented with a guide line and done items struck through',
  function (this: TodozWorld) {
    const expanded = this.document.querySelector('[data-task][data-expanded="true"]')
    expect(expanded, 'an expanded task').to.not.equal(null)
    const guide = expanded?.querySelector('[data-subtasks][data-guide-line]')
    expect(guide, 'guide line container').to.not.equal(null)
    const subItems = guide?.querySelectorAll('[data-subtask]')
    expect(subItems?.length ?? 0, 'subtasks rendered').to.be.greaterThan(0)
    // Strike-through invariant: every done subtask must carry data-strikethrough="true"
    // and every not-done subtask must not. Vacuously true if no done subtasks exist
    // in the standard fixture.
    const allSubs = this.document.querySelectorAll('[data-subtask]')
    allSubs.forEach((sub) => {
      const label = sub.querySelector('[data-subtask-label]')
      if (sub.getAttribute('data-subtask-done') === 'true') {
        expect(label?.getAttribute('data-strikethrough')).to.equal('true')
      } else {
        expect(label?.getAttribute('data-strikethrough')).to.not.equal('true')
      }
    })
  }
)

Then(
  'a command bar pinned to the bottom shows the placeholder {string} with the {string} hint',
  function (this: TodozWorld, placeholder: string, hint: string) {
    const bar = this.document.querySelector('[data-command-bar]')
    expect(bar, 'command bar').to.not.equal(null)
    expect(bar?.getAttribute('data-pinned')).to.equal('bottom')
    const input = bar?.querySelector('input[type="text"]') as HTMLInputElement | null
    expect(input?.placeholder).to.equal(placeholder)
    const hintEl = bar?.querySelector('[data-shortcut-hint]')
    expect(hintEl?.textContent?.trim()).to.equal(hint)
  }
)
