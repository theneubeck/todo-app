import { describe, it } from 'mocha'
import { expect } from 'chai'
import path from 'path'
import { isPathInsideActiveVault } from '../../src/main/writeFileGuard'

describe('isPathInsideActiveVault', () => {
  it('returns true for a file directly inside the active vault', () => {
    const vault = '/abs/alpha'
    const target = path.join(vault, 'note.md')
    expect(isPathInsideActiveVault(target, vault)).to.equal(true)
  })

  it('returns true for a nested file inside the active vault', () => {
    const vault = '/abs/alpha'
    const target = path.join(vault, 'todos', 'buy-milk-2026-05-11.md')
    expect(isPathInsideActiveVault(target, vault)).to.equal(true)
  })

  it('returns false for a file outside the active vault', () => {
    expect(isPathInsideActiveVault('/abs/other/buy-milk.md', '/abs/alpha')).to.equal(
      false
    )
  })

  it('returns false for a path that escapes via ..', () => {
    const vault = '/abs/alpha'
    const target = path.join(vault, '..', 'somewhere-else', 'buy-milk.md')
    expect(isPathInsideActiveVault(target, vault)).to.equal(false)
  })

  it('returns false when vaultRoot is null', () => {
    expect(isPathInsideActiveVault('/abs/alpha/note.md', null)).to.equal(false)
  })

  it('returns true when target equals the vault root exactly', () => {
    expect(isPathInsideActiveVault('/abs/alpha', '/abs/alpha')).to.equal(true)
  })
})
