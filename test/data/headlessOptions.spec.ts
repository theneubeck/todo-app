import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { buildWindowOptions } from '../../src/main/windowOptions'

describe('buildWindowOptions', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalEnv
    }
  })

  it('returns show false when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test'
    const opts = buildWindowOptions()
    expect(opts.show).to.equal(false)
  })

  it('returns show true when NODE_ENV is unset', () => {
    delete process.env.NODE_ENV
    const opts = buildWindowOptions()
    expect(opts.show).to.equal(true)
  })

  it('returns show true when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production'
    const opts = buildWindowOptions()
    expect(opts.show).to.equal(true)
  })

  it('returns width 1280 by default', () => {
    const opts = buildWindowOptions()
    expect(opts.width).to.equal(1280)
  })

  it('returns height 800 by default', () => {
    const opts = buildWindowOptions()
    expect(opts.height).to.equal(800)
  })

  it('returns minWidth at least 800', () => {
    const opts = buildWindowOptions()
    expect(opts.minWidth).to.be.at.least(800)
  })

  it('returns minHeight at least 600', () => {
    const opts = buildWindowOptions()
    expect(opts.minHeight).to.be.at.least(600)
  })
})
