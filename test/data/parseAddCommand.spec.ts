import { describe, it } from 'mocha'
import { expect } from 'chai'
import { parseAddCommand } from '../../src/renderer/data/parseAddCommand'

describe('parseAddCommand', () => {
  it('extracts the title from non-tag tokens', () => {
    const result = parseAddCommand('/add buy milk')
    expect(result?.title).to.equal('buy milk')
  })

  it('extracts #-prefixed tokens as tag values without the #', () => {
    const result = parseAddCommand('/add buy milk #urgent')
    expect(result?.tags).to.deep.equal(['urgent'])
  })

  it('preserves the @ prefix on @-prefixed tokens', () => {
    const result = parseAddCommand('/add buy milk @sara')
    expect(result?.tags).to.deep.equal(['@sara'])
  })

  it('lowercases tag values', () => {
    const result = parseAddCommand('/add buy milk #Urgent @Sara')
    expect(result?.tags).to.deep.equal(['urgent', '@sara'])
  })

  it('returns null when the title is empty', () => {
    expect(parseAddCommand('/add')).to.equal(null)
    expect(parseAddCommand('/add   ')).to.equal(null)
    expect(parseAddCommand('/add #only-tag')).to.equal(null)
  })

  it('returns null when the input lacks the /add prefix', () => {
    expect(parseAddCommand('buy milk')).to.equal(null)
    expect(parseAddCommand('  buy milk')).to.equal(null)
    expect(parseAddCommand('')).to.equal(null)
  })

  it('returns null when input is not a string', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseAddCommand(undefined as any)).to.equal(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseAddCommand(42 as any)).to.equal(null)
  })

  it('skips bare "#" and "@" tokens (no tag value)', () => {
    const result = parseAddCommand('/add buy milk # @')
    expect(result?.title).to.equal('buy milk')
    expect(result?.tags).to.deep.equal([])
  })
})
