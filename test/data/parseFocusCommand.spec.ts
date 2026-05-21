import { describe, it } from 'mocha'
import { expect } from 'chai'
import { parseFocusCommand } from '../../src/renderer/data/parseFocusCommand'

describe('parseFocusCommand', () => {
  it('parses a name and hash tags from the command', () => {
    const result = parseFocusCommand('/focus Work #work #q2')
    expect(result).to.not.equal(null)
    expect(result!.name).to.equal('Work')
    expect(result!.tags).to.deep.equal(['work', 'q2'])
  })

  it('treats non-tag tokens anywhere as the name', () => {
    const result = parseFocusCommand('/focus deep #work focus')
    expect(result).to.not.equal(null)
    expect(result!.name).to.equal('deep focus')
    expect(result!.tags).to.deep.equal(['work'])
  })

  it('returns null when the title is empty', () => {
    const result = parseFocusCommand('/focus #work')
    expect(result).to.equal(null)
  })

  it('returns null when the input does not start with /focus', () => {
    const result = parseFocusCommand('/add Work #work')
    expect(result).to.equal(null)
  })

  it('returns null for /focus with no arguments', () => {
    const result = parseFocusCommand('/focus')
    expect(result).to.equal(null)
  })

  it('ignores empty tags like bare #', () => {
    const result = parseFocusCommand('/focus Design #')
    expect(result).to.not.equal(null)
    expect(result!.name).to.equal('Design')
    expect(result!.tags).to.deep.equal([])
  })

  it('returns null for non-string input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = parseFocusCommand(null as any)
    expect(result).to.equal(null)
  })
})
