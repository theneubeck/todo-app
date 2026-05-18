// Pure helpers powering the command-bar tag-autocomplete dropdown.
// No DOM, no fs — testable in isolation.
//
// Trigger model:
//   - Walk left from the caret until whitespace or start-of-input.
//   - The resulting word is the "trigger word".
//   - If the trigger word's first character is "#" or "@", autocomplete fires.
//   - The caret must NOT be on a whitespace character itself.

export interface TriggerWord {
  prefix: string
  start: number
  end: number
}

export interface AllTags {
  projects: string[]
  people: string[]
  resources: string[]
}

export interface Suggestion {
  label: string
  insert: string
}

const MAX_SUGGESTIONS = 8

function isWhitespace(ch: string): boolean {
  return /\s/.test(ch)
}

export function getTriggerWord(
  value: string,
  caret: number
): TriggerWord | null {
  if (typeof value !== 'string') return null
  if (caret < 0 || caret > value.length) return null
  // Walk left to find the word start: the previous whitespace boundary, or
  // start-of-input. The "trigger word" is everything from that boundary up
  // to (but not including) the caret.
  let start = caret
  while (start > 0 && !isWhitespace(value[start - 1])) {
    start -= 1
  }
  const end = caret
  if (start === end) return null
  const prefix = value.slice(start, end)
  const first = prefix.charAt(0)
  if (first !== '#' && first !== '@' && first !== ':') return null
  return { prefix, start, end }
}

export function getSuggestions(
  value: string,
  caret: number,
  allTags: AllTags
): Suggestion[] {
  const trigger = getTriggerWord(value, caret)
  if (!trigger) return []
  const sigil = trigger.prefix.charAt(0)
  const query = trigger.prefix.slice(1).toLowerCase()
  let pool: string[]
  let toLabel: (tag: string) => string
  let toInsert: (tag: string) => string
  if (sigil === '#') {
    // Project tags are stored without a leading "#".
    pool = allTags.projects
    toLabel = (tag) => `#${tag}`
    toInsert = (tag) => `#${tag}`
  } else if (sigil === ':') {
    // Resource tags are stored with the leading ":" prefix (e.g., ":read").
    pool = allTags.resources
    toLabel = (tag) => tag
    toInsert = (tag) => tag
  } else {
    // People tags are stored with a leading "@".
    pool = allTags.people
    toLabel = (tag) => tag
    toInsert = (tag) => tag
  }
  // Tags are normalized to lowercase before matching, and the displayed
  // label/insert use the lowercased form so the user sees exactly what will
  // land in the input (and the contract is stable regardless of fixture
  // casing).
  const matches = pool
    .map((tag) => tag.toLowerCase())
    .filter((tag) => tag.includes(query))
  // De-duplicate after lowercase normalization in case the input pool has
  // case-variant duplicates.
  const unique = Array.from(new Set(matches))
  const sorted = unique
    .map((tag) => ({ label: toLabel(tag), insert: toInsert(tag) }))
    .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
  return sorted.slice(0, MAX_SUGGESTIONS)
}

function fuzzyMatch(label: string, query: string): boolean {
  if (query.length === 0) return true
  const l = label.toLowerCase()
  let li = 0
  for (let qi = 0; qi < query.length; qi++) {
    const found = l.indexOf(query[qi], li)
    if (found === -1) return false
    li = found + 1
  }
  return true
}

export function getGotoSuggestions(value: string, allTags: AllTags): Suggestion[] {
  const GOTO_PREFIX = '/goto '
  if (!value.startsWith(GOTO_PREFIX)) return []
  const query = value.slice(GOTO_PREFIX.length).toLowerCase()
  const pool: Suggestion[] = [
    ...allTags.projects.map((tag) => {
      const label = `#${tag.toLowerCase()}`
      return { label, insert: label }
    }),
    ...allTags.people.map((tag) => {
      const label = tag.toLowerCase()
      return { label, insert: label }
    }),
    ...allTags.resources.map((tag) => {
      const label = tag.toLowerCase()
      return { label, insert: label }
    }),
  ].sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
  const filtered = pool.filter((s) => fuzzyMatch(s.label, query))
  return filtered.slice(0, MAX_SUGGESTIONS)
}

export function applyGotoAutocomplete(
  value: string,
  choice: Suggestion
): { value: string; caret: number } {
  const newValue = '/goto ' + choice.insert + ' '
  return { value: newValue, caret: newValue.length }
}

export function applyAutocomplete(
  value: string,
  caret: number,
  choice: Suggestion
): { value: string; caret: number } {
  const trigger = getTriggerWord(value, caret)
  if (!trigger) return { value, caret }
  const before = value.slice(0, trigger.start)
  const after = value.slice(trigger.end)
  const replacement = `${choice.insert} `
  const newValue = `${before}${replacement}${after}`
  const newCaret = trigger.start + replacement.length
  return { value: newValue, caret: newCaret }
}
