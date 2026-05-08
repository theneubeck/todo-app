import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createVault } from '../../src/main/createVault'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todoz-cv-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('createVault', () => {
  it('creates a todos directory in the target folder', () => {
    createVault(tmpDir)
    expect(fs.existsSync(path.join(tmpDir, 'todos'))).to.equal(true)
  })

  it('creates an archive/todos directory in the target folder', () => {
    createVault(tmpDir)
    expect(fs.existsSync(path.join(tmpDir, 'archive', 'todos'))).to.equal(true)
  })

  it('is idempotent when the directories already exist', () => {
    createVault(tmpDir)
    expect(() => createVault(tmpDir)).to.not.throw()
    expect(fs.existsSync(path.join(tmpDir, 'todos'))).to.equal(true)
    expect(fs.existsSync(path.join(tmpDir, 'archive', 'todos'))).to.equal(true)
  })
})
