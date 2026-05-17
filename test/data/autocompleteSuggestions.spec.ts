import { describe, it } from 'mocha'
import { expect } from 'chai'
import {
  getTriggerWord,
  getSuggestions,
  applyAutocomplete,
  getGotoSuggestions,
  applyGotoAutocomplete,
} from '../../src/renderer/data/autocompleteSuggestions'

describe('getTriggerWord', () => {
  it('returns null when the caret is at start of empty input', () => {
    expect(getTriggerWord('', 0)).to.equal(null)
  })

  it('returns the # word when the caret is just after #', () => {
    const r = getTriggerWord('#', 1)
    expect(r).to.deep.equal({ prefix: '#', start: 0, end: 1 })
  })

  it('returns the # word with prefix when caret is mid-word', () => {
    // input "#er", caret at end (position 3) — full word is "#er"
    const r = getTriggerWord('#er', 3)
    expect(r).to.deep.equal({ prefix: '#er', start: 0, end: 3 })
  })

  it('returns the @ word similarly', () => {
    const r = getTriggerWord('@li', 3)
    expect(r).to.deep.equal({ prefix: '@li', start: 0, end: 3 })
  })

  it('returns null when the word does not start with # or @', () => {
    expect(getTriggerWord('hello', 5)).to.equal(null)
  })

  it('identifies the word the caret sits on, not the last word', () => {
    // input "hello #er world", caret right after "#er" at position 9
    const value = 'hello #er world'
    expect(value.indexOf('#er')).to.equal(6)
    const r = getTriggerWord(value, 9) // after "#er"
    expect(r).to.deep.equal({ prefix: '#er', start: 6, end: 9 })
  })

  it('returns null when caret is on a space character', () => {
    // input "abc def", caret at the space (position 3)
    expect(getTriggerWord('abc def', 3)).to.equal(null)
  })
})

describe('getSuggestions', () => {
  const allTags = {
    projects: ['errands', 'personal', 'work'],
    people: ['@lina', '@mike'],
  }

  it("returns all # tags when prefix is just '#'", () => {
    const r = getSuggestions('#', 1, allTags)
    expect(r.map((s) => s.label)).to.deep.equal(['#errands', '#personal', '#work'])
  })

  it('substring-matches case-insensitively after the sigil', () => {
    const tags = { projects: ['Errands', 'verifier-things', 'work'], people: [] }
    const r = getSuggestions('#er', 3, tags)
    expect(r.map((s) => s.label)).to.deep.equal(['#errands', '#verifier-things'])
  })

  it('returns @ tags for an @ prefix and never project tags', () => {
    const r = getSuggestions('@', 1, allTags)
    expect(r.map((s) => s.label)).to.deep.equal(['@lina', '@mike'])
  })

  it('returns alphabetically sorted results', () => {
    const tags = { projects: ['zebra', 'apple', 'mango'], people: [] }
    const r = getSuggestions('#', 1, tags)
    expect(r.map((s) => s.label)).to.deep.equal(['#apple', '#mango', '#zebra'])
  })

  it('caps the result list at 8 entries', () => {
    const tags = {
      projects: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10'],
      people: [],
    }
    const r = getSuggestions('#a', 2, tags)
    expect(r.length).to.equal(8)
  })

  it('returns an empty array when no tags match', () => {
    const r = getSuggestions('#zzz', 4, allTags)
    expect(r).to.deep.equal([])
  })

  it('returns an empty array when the caret is not on a # or @ word', () => {
    const r = getSuggestions('hello', 5, allTags)
    expect(r).to.deep.equal([])
  })
})

describe('applyAutocomplete', () => {
  it('replaces the trigger word with the chosen tag plus a trailing space', () => {
    const choice = { label: '#errands', insert: '#errands' }
    const r = applyAutocomplete('#er', 3, choice)
    expect(r.value).to.equal('#errands ')
  })

  it('preserves text before and after the trigger word', () => {
    const choice = { label: '#errands', insert: '#errands' }
    const r = applyAutocomplete('buy milk #er for mom', 12, choice)
    expect(r.value).to.equal('buy milk #errands  for mom')
  })

  it('returns the new caret position after the inserted space', () => {
    const choice = { label: '#errands', insert: '#errands' }
    const r = applyAutocomplete('#er', 3, choice)
    // trigger.start (0) + insert ("#errands"=8) + " " = 9
    expect(r.caret).to.equal(9)
  })

  it('returns the input unchanged when the caret is not on a trigger word', () => {
    const choice = { label: '#errands', insert: '#errands' }
    const r = applyAutocomplete('hello', 5, choice)
    expect(r).to.deep.equal({ value: 'hello', caret: 5 })
  })
})

describe('getGotoSuggestions', () => {
  const allTags = {
    projects: ['errands', 'personal', 'work'],
    people: ['@lina', '@mike'],
  }

  it('returns empty array when value does not start with /goto ', () => {
    const r = getGotoSuggestions('#errands', allTags)
    expect(r).to.deep.equal([])
  })

  it('returns all tags alphabetically when query is empty', () => {
    const r = getGotoSuggestions('/goto ', allTags)
    const labels = r.map((s) => s.label)
    expect(labels).to.deep.equal(['#errands', '#personal', '#work', '@lina', '@mike'])
  })

  it('returns project tags prefixed with # and people tags with @', () => {
    const r = getGotoSuggestions('/goto ', allTags)
    const projectLabels = r.filter((s) => s.label.startsWith('#')).map((s) => s.label)
    const peopleLabels = r.filter((s) => s.label.startsWith('@')).map((s) => s.label)
    expect(projectLabels).to.deep.equal(['#errands', '#personal', '#work'])
    expect(peopleLabels).to.deep.equal(['@lina', '@mike'])
  })

  it('fuzzy-filters tags by subsequence match', () => {
    const r = getGotoSuggestions('/goto er', allTags)
    const labels = r.map((s) => s.label)
    expect(labels).to.deep.equal(['#errands', '#personal'])
  })

  it('is case-insensitive', () => {
    const r = getGotoSuggestions('/goto ER', allTags)
    const labels = r.map((s) => s.label)
    expect(labels).to.deep.equal(['#errands', '#personal'])
  })

  it('caps results at 8', () => {
    const manyTags = {
      projects: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10'],
      people: [],
    }
    const r = getGotoSuggestions('/goto a', manyTags)
    expect(r.length).to.equal(8)
  })
})

describe('applyGotoAutocomplete', () => {
  it('replaces everything after /goto with the chosen tag plus a space', () => {
    const choice = { label: '#errands', insert: '#errands' }
    const r = applyGotoAutocomplete('/goto er', choice)
    expect(r.value).to.equal('/goto #errands ')
  })

  it('returns the caret at the end of the new value', () => {
    const choice = { label: '#errands', insert: '#errands' }
    const r = applyGotoAutocomplete('/goto er', choice)
    expect(r.caret).to.equal('/goto #errands '.length)
  })
})

describe('getTriggerWord input guards', () => {
  it('returns null for a non-string value', () => {
    // The runtime guard exists so callers cannot crash the renderer with an
    // accidental non-string; explicit cast bypasses the type system to
    // exercise it.
    expect(getTriggerWord(undefined as unknown as string, 0)).to.equal(null)
  })

  it('returns null when the caret is past the end of the input', () => {
    expect(getTriggerWord('hello', 99)).to.equal(null)
  })

  it('returns null when the caret is negative', () => {
    expect(getTriggerWord('hello', -1)).to.equal(null)
  })
})
