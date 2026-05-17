import {
  AllTags,
  Suggestion,
  applyAutocomplete,
  getSuggestions,
} from '../data/autocompleteSuggestions'

export interface AutocompleteDropdownDeps {
  getAllTags: () => AllTags
  onInsert: (newValue: string, newCaret: number) => void
}

export type TearDown = () => void

const INTERCEPT_KEYS = new Set(['Tab', 'Escape', 'ArrowUp', 'ArrowDown'])

export function mountAutocompleteDropdown(
  input: HTMLInputElement,
  deps: AutocompleteDropdownDeps
): TearDown {
  const doc = input.ownerDocument
  let dropdown: HTMLElement | null = null
  let suggestions: Suggestion[] = []
  let activeIndex = 0

  function caretPosition(): number {
    // selectionEnd reflects the caret when there is no range selection.
    const sel = input.selectionEnd
    if (sel === null) return input.value.length
    return sel
  }

  function removeDropdown(): void {
    if (dropdown && dropdown.parentNode) {
      dropdown.parentNode.removeChild(dropdown)
    }
    dropdown = null
    suggestions = []
    activeIndex = 0
  }

  function renderDropdown(): void {
    if (suggestions.length === 0) {
      removeDropdown()
      return
    }
    if (!dropdown) {
      dropdown = doc.createElement('div')
      dropdown.setAttribute('data-autocomplete', '')
      // Sibling of the input — the input cannot host children. Insert right
      // after the input so it lives in the same containing block.
      const parent = input.parentNode as ParentNode | null
      if (!parent) return
      const nextSibling = input.nextSibling
      if (nextSibling) parent.insertBefore(dropdown, nextSibling)
      else (parent as Node).appendChild(dropdown)
    }
    // Bound activeIndex to current suggestions array.
    if (activeIndex < 0) activeIndex = suggestions.length - 1
    if (activeIndex >= suggestions.length) activeIndex = 0
    // Rebuild rows from scratch — small list, cheap.
    dropdown.innerHTML = ''
    suggestions.forEach((s, i) => {
      const row = doc.createElement('div')
      row.setAttribute('data-autocomplete-suggestion', '')
      row.setAttribute('data-autocomplete-insert', s.insert)
      if (i === activeIndex) row.setAttribute('data-autocomplete-active', '')
      const label = doc.createElement('span')
      label.setAttribute('data-autocomplete-label', '')
      label.textContent = s.label
      row.appendChild(label)
      dropdown!.appendChild(row)
    })
  }

  function refreshFromInput(): void {
    const value = input.value
    const caret = caretPosition()
    const all = deps.getAllTags()
    suggestions = getSuggestions(value, caret, all)
    // Always reset highlight to the first suggestion when the suggestion set
    // changes (matches Slack/Obsidian behavior — user can ArrowDown from
    // there).
    activeIndex = 0
    renderDropdown()
  }

  function acceptActive(): void {
    if (!dropdown || suggestions.length === 0) return
    const choice = suggestions[activeIndex]
    const value = input.value
    const caret = caretPosition()
    const next = applyAutocomplete(value, caret, choice)
    removeDropdown()
    deps.onInsert(next.value, next.caret)
  }

  function onInput(): void {
    refreshFromInput()
  }

  function onKeyDown(e: Event): void {
    const ke = e as KeyboardEvent
    if (!dropdown) return
    if (!INTERCEPT_KEYS.has(ke.key)) return
    ke.preventDefault()
    ke.stopPropagation()
    if (ke.key === 'Escape') {
      removeDropdown()
      return
    }
    if (ke.key === 'ArrowDown') {
      activeIndex = (activeIndex + 1) % suggestions.length
      renderDropdown()
      return
    }
    if (ke.key === 'ArrowUp') {
      activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length
      renderDropdown()
      return
    }
    if (ke.key === 'Tab') {
      acceptActive()
      return
    }
  }

  function onBlur(): void {
    // Lose focus → close. Schedule via microtask so an accept-via-Tab doesn't
    // race the blur (Tab path calls preventDefault, but we close synchronously
    // there anyway).
    removeDropdown()
  }

  input.addEventListener('input', onInput)
  // Capture-phase so Tab/Esc/Arrow are intercepted before the browser's
  // default Tab handler shifts focus.
  input.addEventListener('keydown', onKeyDown, true)
  input.addEventListener('blur', onBlur)

  return function teardown(): void {
    input.removeEventListener('input', onInput)
    input.removeEventListener('keydown', onKeyDown, true)
    input.removeEventListener('blur', onBlur)
    removeDropdown()
  }
}
