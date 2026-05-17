import { describe, it } from 'mocha'
import { expect } from 'chai'
import { parseGotoCommand } from '../../src/renderer/data/parseGotoCommand'

describe('parseGotoCommand', () => {
  it('returns null for empty string', () => {
    expect(parseGotoCommand('')).to.equal(null)
  })

  it('returns null for input that does not start with /goto', () => {
    expect(parseGotoCommand('/add inbox')).to.equal(null)
  })

  it('returns { kind: \'inbox\' } for /goto inbox', () => {
    expect(parseGotoCommand('/goto inbox')).to.deep.equal({ kind: 'inbox' })
  })

  it('returns { kind: \'chat\' } for /goto chat', () => {
    expect(parseGotoCommand('/goto chat')).to.deep.equal({ kind: 'chat' })
  })

  it('returns { kind: \'tag\', value: \'errands\' } for /goto #errands', () => {
    expect(parseGotoCommand('/goto #errands')).to.deep.equal({
      kind: 'tag',
      value: 'errands',
    })
  })

  it('returns { kind: \'tag\', value: \'@mike\' } for /goto @mike', () => {
    expect(parseGotoCommand('/goto @mike')).to.deep.equal({
      kind: 'tag',
      value: '@mike',
    })
  })

  it('returns null for /goto with unrecognised destination', () => {
    expect(parseGotoCommand('/goto zzz')).to.equal(null)
  })

  it('is case-insensitive for the command prefix', () => {
    expect(parseGotoCommand('/GOTO inbox')).to.deep.equal({ kind: 'inbox' })
  })

  it("returns { kind: 'tag', value: '>read' } for /goto >read", () => {
    expect(parseGotoCommand('/goto >read')).to.deep.equal({
      kind: 'tag',
      value: '>read',
    })
  })

  it("returns { kind: 'tag', value: '>watch' } for /goto >watch", () => {
    expect(parseGotoCommand('/goto >watch')).to.deep.equal({
      kind: 'tag',
      value: '>watch',
    })
  })
})
