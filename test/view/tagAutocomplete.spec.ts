import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import { mountAutocompleteDropdown } from '../../src/renderer/views/AutocompleteDropdown'

interface Setup {
  dom: JSDOM
  input: HTMLInputElement
  inserts: { value: string; caret: number }[]
  teardown: () => void
}

const ALL_TAGS = {
  projects: ['errands', 'personal', 'work'],
  people: ['@lina', '@mike'],
}

function setupDom(allTags = ALL_TAGS): Setup {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')
  const doc = dom.window.document
  const wrap = doc.createElement('div')
  wrap.setAttribute('data-command-bar', '')
  const input = doc.createElement('input') as HTMLInputElement
  input.type = 'text'
  wrap.appendChild(input)
  doc.body.appendChild(wrap)
  const inserts: { value: string; caret: number }[] = []
  const teardown = mountAutocompleteDropdown(input, {
    getAllTags: () => allTags,
    onInsert: (value: string, caret: number) => {
      input.value = value
      input.setSelectionRange(caret, caret)
      inserts.push({ value, caret })
    },
  })
  return { dom, input, inserts, teardown }
}

function fireInput(dom: JSDOM, input: HTMLInputElement, value: string): void {
  input.value = value
  input.setSelectionRange(value.length, value.length)
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}

function pressKey(dom: JSDOM, input: HTMLInputElement, key: string): void {
  input.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    })
  )
}

describe('Autocomplete dropdown', () => {
  let s: Setup

  beforeEach(() => {
    s = setupDom()
  })

  it('renders a [data-autocomplete] container with one row per suggestion', () => {
    fireInput(s.dom, s.input, '#')
    const drop = s.dom.window.document.querySelector('[data-autocomplete]')
    expect(drop).to.not.equal(null)
    const rows = drop!.querySelectorAll('[data-autocomplete-suggestion]')
    expect(rows.length).to.equal(3)
  })

  it('marks the first suggestion as [data-autocomplete-active] on open', () => {
    fireInput(s.dom, s.input, '#')
    const active = s.dom.window.document.querySelector(
      '[data-autocomplete-suggestion][data-autocomplete-active]'
    )
    expect(active).to.not.equal(null)
    const label = active!.querySelector('[data-autocomplete-label]')
    expect(label?.textContent).to.equal('#errands')
  })

  it('advances the active row on ArrowDown', () => {
    fireInput(s.dom, s.input, '#')
    pressKey(s.dom, s.input, 'ArrowDown')
    const active = s.dom.window.document.querySelector(
      '[data-autocomplete-suggestion][data-autocomplete-active] [data-autocomplete-label]'
    )
    expect(active?.textContent).to.equal('#personal')
  })

  it('wraps the active row from last to first on ArrowDown at the end', () => {
    fireInput(s.dom, s.input, '#')
    pressKey(s.dom, s.input, 'ArrowDown')
    pressKey(s.dom, s.input, 'ArrowDown')
    pressKey(s.dom, s.input, 'ArrowDown')
    const active = s.dom.window.document.querySelector(
      '[data-autocomplete-suggestion][data-autocomplete-active] [data-autocomplete-label]'
    )
    expect(active?.textContent).to.equal('#errands')
  })

  it('retreats the active row on ArrowUp', () => {
    fireInput(s.dom, s.input, '#')
    pressKey(s.dom, s.input, 'ArrowDown')
    pressKey(s.dom, s.input, 'ArrowUp')
    const active = s.dom.window.document.querySelector(
      '[data-autocomplete-suggestion][data-autocomplete-active] [data-autocomplete-label]'
    )
    expect(active?.textContent).to.equal('#errands')
  })

  it('inserts the active suggestion on Tab', () => {
    fireInput(s.dom, s.input, '#er')
    pressKey(s.dom, s.input, 'Tab')
    expect(s.inserts.length).to.equal(1)
    expect(s.inserts[0].value).to.equal('#errands ')
  })

  it('prevents the default Tab focus shift when accepting a suggestion', () => {
    fireInput(s.dom, s.input, '#er')
    const ev = new s.dom.window.KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    s.input.dispatchEvent(ev)
    expect(ev.defaultPrevented).to.equal(true)
  })

  it('does not consume Enter when the dropdown is open', () => {
    fireInput(s.dom, s.input, '#er')
    const ev = new s.dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    s.input.dispatchEvent(ev)
    expect(ev.defaultPrevented).to.equal(false)
  })

  it('closes on Escape without modifying the input', () => {
    fireInput(s.dom, s.input, '#er')
    expect(
      s.dom.window.document.querySelector('[data-autocomplete]')
    ).to.not.equal(null)
    pressKey(s.dom, s.input, 'Escape')
    expect(s.dom.window.document.querySelector('[data-autocomplete]')).to.equal(
      null
    )
    expect(s.input.value).to.equal('#er')
  })

  it('closes when the input value changes to a non-trigger word', () => {
    fireInput(s.dom, s.input, '#er')
    expect(
      s.dom.window.document.querySelector('[data-autocomplete]')
    ).to.not.equal(null)
    fireInput(s.dom, s.input, 'hello')
    expect(s.dom.window.document.querySelector('[data-autocomplete]')).to.equal(
      null
    )
  })

  it('closes on blur', () => {
    fireInput(s.dom, s.input, '#')
    expect(
      s.dom.window.document.querySelector('[data-autocomplete]')
    ).to.not.equal(null)
    s.input.dispatchEvent(new s.dom.window.Event('blur', { bubbles: true }))
    expect(s.dom.window.document.querySelector('[data-autocomplete]')).to.equal(
      null
    )
  })

  it('ignores Tab when the dropdown is closed', () => {
    const ev = new s.dom.window.KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    s.input.dispatchEvent(ev)
    expect(ev.defaultPrevented).to.equal(false)
    expect(s.inserts.length).to.equal(0)
  })

  it('tears down listeners on teardown call', () => {
    s.teardown()
    fireInput(s.dom, s.input, '#')
    // After teardown, the input event must not produce a dropdown.
    expect(s.dom.window.document.querySelector('[data-autocomplete]')).to.equal(
      null
    )
  })
})

describe('Autocomplete dropdown — goto mode', () => {
  let s: Setup

  beforeEach(() => {
    s = setupDom()
  })

  it('opens the dropdown immediately when input is /goto with no query', () => {
    fireInput(s.dom, s.input, '/goto ')
    const drop = s.dom.window.document.querySelector('[data-autocomplete]')
    expect(drop).to.not.equal(null)
  })

  it('fuzzy-filters suggestions in /goto mode', () => {
    fireInput(s.dom, s.input, '/goto er')
    const rows = s.dom.window.document.querySelectorAll('[data-autocomplete-label]')
    const labels = Array.from(rows).map((el) => el.textContent)
    // "er" matches #errands (e,r) and #personal (e...r in "personal")
    expect(labels).to.deep.equal(['#errands', '#personal'])
  })

  it('replaces everything after /goto on Tab in goto mode', () => {
    fireInput(s.dom, s.input, '/goto er')
    pressKey(s.dom, s.input, 'Tab')
    expect(s.inserts.length).to.equal(1)
    expect(s.inserts[0].value).to.equal('/goto #errands ')
  })
})
