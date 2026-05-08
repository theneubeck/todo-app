import { When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld } from './world'

function slugFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}

function findRow(world: TodozWorld, slug: string): HTMLElement | null {
  return world.document.querySelector(`[data-task="${slug}"]`) as HTMLElement | null
}

function filenameFromSlug(world: TodozWorld, slug: string): string | undefined {
  for (const fx of world.fixtures) {
    const fxSlug = String(fx.frontmatter.title).toLowerCase().replace(/\s+/g, '-')
    if (fxSlug === slug) {
      const idx = fx.path.lastIndexOf('/')
      return fx.path.slice(idx + 1)
    }
  }
  return undefined
}

When(
  'the user clicks the add-subtask affordance for {string}',
  function (this: TodozWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    const aff = row!.querySelector('[data-add-subtask]') as HTMLElement | null
    expect(aff, `add-subtask affordance for ${slug}`).to.not.equal(null)
    aff!.click()
  }
)

When(
  'the user types {string} into the subtask input',
  function (this: TodozWorld, text: string) {
    const input = this.document.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement | null
    expect(input, 'subtask input').to.not.equal(null)
    input!.value = text
    const InputEventCtor = (this.dom!.window as unknown as {
      InputEvent: typeof InputEvent
    }).InputEvent
    input!.dispatchEvent(new InputEventCtor('input'))
  }
)

When('the user presses Enter in the subtask input', async function (
  this: TodozWorld
) {
  const input = this.document.querySelector(
    '[data-add-subtask-input]'
  ) as HTMLInputElement | null
  expect(input, 'subtask input').to.not.equal(null)
  const KeyboardEventCtor = (this.dom!.window as unknown as {
    KeyboardEvent: typeof KeyboardEvent
  }).KeyboardEvent
  input!.dispatchEvent(new KeyboardEventCtor('keydown', { key: 'Enter' }))
  await new Promise((r) => setTimeout(r, 10))
})

When('the user presses Esc in the subtask input', async function (
  this: TodozWorld
) {
  const input = this.document.querySelector(
    '[data-add-subtask-input]'
  ) as HTMLInputElement | null
  expect(input, 'subtask input').to.not.equal(null)
  const KeyboardEventCtor = (this.dom!.window as unknown as {
    KeyboardEvent: typeof KeyboardEvent
  }).KeyboardEvent
  input!.dispatchEvent(new KeyboardEventCtor('keydown', { key: 'Escape' }))
  await new Promise((r) => setTimeout(r, 10))
})

Then(
  'the {string} row shows an add-subtask affordance',
  function (this: TodozWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    const aff = row!.querySelector('[data-add-subtask]')
    expect(aff, `add-subtask affordance for ${slug}`).to.not.equal(null)
  }
)

Then(
  'the {string} row shows no add-subtask affordance',
  function (this: TodozWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    const aff = row!.querySelector('[data-add-subtask]')
    expect(aff, `add-subtask affordance for ${slug}`).to.equal(null)
  }
)

Then(
  'a focused subtask input replaces the affordance for {string}',
  function (this: TodozWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    const input = row!.querySelector(
      '[data-add-subtask-input]'
    ) as HTMLInputElement | null
    expect(input, `subtask input for ${slug}`).to.not.equal(null)
    expect(this.document.activeElement).to.equal(input)
    const aff = row!.querySelector('[data-add-subtask]')
    expect(aff, `affordance should be removed for ${slug}`).to.equal(null)
  }
)

Then(
  'the {string} file body ends with {string}',
  function (this: TodozWorld, name: string, expected: string) {
    const slug = slugFromName(name)
    const filename = filenameFromSlug(this, slug)
    expect(filename, `filename for ${slug}`).to.not.equal(undefined)
    expect(this.lastWriteFilePath, `writeFile path for ${filename}`).to.not.equal(
      undefined
    )
    expect((this.lastWriteFilePath ?? '').endsWith(filename!)).to.equal(true)
    const content = this.lastWriteFileContent ?? ''
    // Recover the body region by splitting on the closing frontmatter marker.
    const closeIdx = content.indexOf('\n---\n', 3)
    const bodyText = closeIdx === -1 ? content : content.slice(closeIdx + 5)
    const trimmed = bodyText.replace(/\s+$/, '')
    expect(trimmed.endsWith(expected)).to.equal(
      true,
      `expected body to end with "${expected}", got: ${JSON.stringify(trimmed.slice(-80))}`
    )
  }
)

Then(
  'the {string} subtask list ends with a row labeled {string}',
  function (this: TodozWorld, name: string, label: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    const subs = row!.querySelectorAll('[data-subtask-list] [data-subtask]')
    expect(subs.length, `subtasks under ${slug}`).to.be.greaterThan(0)
    const last = subs[subs.length - 1]
    const title = last.querySelector('[data-subtask-title]')
    expect(title?.textContent?.trim()).to.equal(label)
  }
)

Then(
  'the {string} subtask list contains exactly one row labeled {string}',
  function (this: TodozWorld, name: string, label: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    const subs = row!.querySelectorAll('[data-subtask-list] [data-subtask]')
    expect(subs.length, `subtasks under ${slug}`).to.equal(1)
    const title = subs[0].querySelector('[data-subtask-title]')
    expect(title?.textContent?.trim()).to.equal(label)
  }
)

Then(
  'the {string} row is rendered as expanded combined',
  function (this: TodozWorld, name: string) {
    const slug = slugFromName(name)
    const row = findRow(this, slug)
    expect(row, `task row ${slug}`).to.not.equal(null)
    expect(row!.getAttribute('data-kind')).to.equal('combined')
    expect(row!.getAttribute('data-expanded')).to.equal('true')
  }
)

Then('the subtask input is torn down', function (this: TodozWorld) {
  const input = this.document.querySelector('[data-add-subtask-input]')
  expect(input, 'subtask input should be gone').to.equal(null)
})
