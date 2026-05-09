import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  readAppSettings,
  writeAppSetting,
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
      showChat: true,
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
      showChat: true,
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
      showChat: true,
      showToday: false,
      showUpcoming: false,
    })
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
      showChat: true,
      showToday: true,
      showUpcoming: false,
    })
  })
})
