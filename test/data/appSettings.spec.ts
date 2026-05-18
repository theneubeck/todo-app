import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  readAppSettings,
  writeAppSetting,
  migrateAppSettings,
} from '../../src/main/appSettings'

let tmpDir: string
let settingsPath: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todoz-app-settings-'))
  settingsPath = path.join(tmpDir, 'app-settings.json')
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('readAppSettings', () => {
  it('returns defaults when the file does not exist', () => {
    const settings = readAppSettings(settingsPath)
    expect(settings).to.deep.equal({
      showChat: false,
      showToday: true,
      showUpcoming: true,
    })
  })

  it('parses an existing JSON settings file', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ showChat: false, showToday: true, showUpcoming: false }),
      'utf-8'
    )
    const settings = readAppSettings(settingsPath)
    expect(settings).to.deep.equal({
      showChat: false,
      showToday: true,
      showUpcoming: false,
    })
  })

  it('falls back to defaults when the file content is malformed', () => {
    fs.writeFileSync(settingsPath, '{not-json', 'utf-8')
    const settings = readAppSettings(settingsPath)
    expect(settings).to.deep.equal({
      showChat: false,
      showToday: true,
      showUpcoming: true,
    })
  })

  it('fills missing keys with defaults when the file is partial', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ showChat: false }),
      'utf-8'
    )
    const settings = readAppSettings(settingsPath)
    expect(settings).to.deep.equal({
      showChat: false,
      showToday: true,
      showUpcoming: true,
    })
  })

  it('fills the showChat default when only that key is missing', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ showToday: false, showUpcoming: false }),
      'utf-8'
    )
    const settings = readAppSettings(settingsPath)
    expect(settings).to.deep.equal({
      showChat: false,
      showToday: false,
      showUpcoming: false,
    })
  })
})

describe('readAppSettings — legacy migration', () => {
  it('returns showChat false when a legacy file (no _v) stored showChat true', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ showChat: true, showToday: true, showUpcoming: true }),
      'utf-8'
    )
    const settings = readAppSettings(settingsPath)
    expect(settings.showChat).to.equal(false)
  })

  it('honours showChat true when the file has the current schema version', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ showChat: true, showToday: true, showUpcoming: true, _v: 1 }),
      'utf-8'
    )
    const settings = readAppSettings(settingsPath)
    expect(settings.showChat).to.equal(true)
  })
})

describe('migrateAppSettings', () => {
  it('rewrites a legacy file with _v stamped', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ showChat: true, showToday: true, showUpcoming: false }),
      'utf-8'
    )
    migrateAppSettings(settingsPath)
    const on_disk = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>
    expect(on_disk._v).to.equal(1)
  })

  it('forces showChat false when migrating a legacy file with showChat true', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ showChat: true, showToday: true, showUpcoming: false }),
      'utf-8'
    )
    migrateAppSettings(settingsPath)
    const settings = readAppSettings(settingsPath)
    expect(settings.showChat).to.equal(false)
  })

  it('does not overwrite a file that is already at the current schema version', () => {
    const content = JSON.stringify({ showChat: true, showToday: true, showUpcoming: true, _v: 1 })
    fs.writeFileSync(settingsPath, content, 'utf-8')
    const mtime1 = fs.statSync(settingsPath).mtimeMs
    migrateAppSettings(settingsPath)
    const mtime2 = fs.statSync(settingsPath).mtimeMs
    expect(mtime2).to.equal(mtime1)
  })

  it('is a no-op when the settings file does not exist', () => {
    expect(() => migrateAppSettings(settingsPath)).not.to.throw()
    expect(fs.existsSync(settingsPath)).to.equal(false)
  })
})

describe('writeAppSetting', () => {
  it('merges the change into the existing file', () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ showChat: true, showToday: true, showUpcoming: true }),
      'utf-8'
    )
    writeAppSetting(settingsPath, 'showChat', false)
    const settings = readAppSettings(settingsPath)
    expect(settings).to.deep.equal({
      showChat: false,
      showToday: true,
      showUpcoming: true,
    })
  })

  it('creates the file when it does not yet exist', () => {
    writeAppSetting(settingsPath, 'showUpcoming', false)
    expect(fs.existsSync(settingsPath)).to.equal(true)
    const settings = readAppSettings(settingsPath)
    expect(settings).to.deep.equal({
      showChat: false,
      showToday: true,
      showUpcoming: false,
    })
  })
})
