import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  readVaultConfig,
  writeVaultConfig,
  addRecent,
  removeRecent,
  setLastOpened,
} from '../../src/main/vaultConfig'

let tmpDir: string
let configPath: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todoz-vc-'))
  configPath = path.join(tmpDir, 'vault-config.json')
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('readVaultConfig', () => {
  it('returns an empty config when the file does not exist', () => {
    const cfg = readVaultConfig(configPath)
    expect(cfg).to.deep.equal({ lastOpened: null, recents: [] })
  })

  it('parses an existing JSON config file', () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ lastOpened: '/some/path', recents: ['/a', '/b'] }),
      'utf-8'
    )
    const cfg = readVaultConfig(configPath)
    expect(cfg).to.deep.equal({ lastOpened: '/some/path', recents: ['/a', '/b'] })
  })

  it('returns an empty config when the file contains invalid JSON', () => {
    fs.writeFileSync(configPath, '{ not json', 'utf-8')
    const cfg = readVaultConfig(configPath)
    expect(cfg).to.deep.equal({ lastOpened: null, recents: [] })
  })

  it('coerces a missing recents field to an empty array', () => {
    fs.writeFileSync(configPath, JSON.stringify({ lastOpened: '/x' }), 'utf-8')
    const cfg = readVaultConfig(configPath)
    expect(cfg).to.deep.equal({ lastOpened: '/x', recents: [] })
  })
})

describe('writeVaultConfig', () => {
  it('writes JSON to the configured path', () => {
    writeVaultConfig(configPath, { lastOpened: '/x', recents: ['/x'] })
    const raw = fs.readFileSync(configPath, 'utf-8')
    expect(JSON.parse(raw)).to.deep.equal({ lastOpened: '/x', recents: ['/x'] })
  })
})

describe('addRecent', () => {
  it('prepends the path to the recents list', () => {
    writeVaultConfig(configPath, { lastOpened: null, recents: ['/b'] })
    addRecent(configPath, '/a')
    const cfg = readVaultConfig(configPath)
    expect(cfg.recents).to.deep.equal(['/a', '/b'])
  })

  it('deduplicates an existing path by moving it to the front', () => {
    writeVaultConfig(configPath, { lastOpened: null, recents: ['/a', '/b', '/c'] })
    addRecent(configPath, '/c')
    const cfg = readVaultConfig(configPath)
    expect(cfg.recents).to.deep.equal(['/c', '/a', '/b'])
  })
})

describe('removeRecent', () => {
  it('removes the path from the recents list', () => {
    writeVaultConfig(configPath, { lastOpened: null, recents: ['/a', '/b', '/c'] })
    removeRecent(configPath, '/b')
    const cfg = readVaultConfig(configPath)
    expect(cfg.recents).to.deep.equal(['/a', '/c'])
  })
})

describe('setLastOpened', () => {
  it('writes the lastOpened path to the config file', () => {
    writeVaultConfig(configPath, { lastOpened: null, recents: ['/a'] })
    setLastOpened(configPath, '/a')
    const cfg = readVaultConfig(configPath)
    expect(cfg.lastOpened).to.equal('/a')
  })
})
