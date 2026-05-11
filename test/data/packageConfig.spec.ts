import { describe, it } from 'mocha'
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'

const REPO_ROOT = process.cwd()

type MacBuild = {
  target?: unknown
  icon?: string
  category?: string
}

type BuildBlock = {
  appId?: string
  productName?: string
  files?: string[]
  directories?: { output?: string }
  mac?: MacBuild
}

function readBuildBlock(): BuildBlock {
  const raw = fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')
  const parsed = JSON.parse(raw) as { build?: BuildBlock }
  if (!parsed.build) throw new Error('package.json has no "build" block')
  return parsed.build
}

describe('electron-builder config', () => {
  it('declares appId com.theneubeck.todoz', () => {
    const build = readBuildBlock()
    expect(build.appId).to.equal('com.theneubeck.todoz')
  })

  it('declares productName todoz', () => {
    const build = readBuildBlock()
    expect(build.productName).to.equal('todoz')
  })

  it('targets only the macOS dmg format', () => {
    const build = readBuildBlock()
    const target = build.mac?.target
    if (typeof target === 'string') {
      expect(target).to.equal('dmg')
    } else if (Array.isArray(target)) {
      expect(target).to.deep.equal(['dmg'])
    } else {
      throw new Error(`unexpected mac.target shape: ${JSON.stringify(target)}`)
    }
  })

  it('points at an icon file that exists on disk', () => {
    const build = readBuildBlock()
    const icon = build.mac?.icon
    expect(icon, 'mac.icon must be set').to.be.a('string')
    const iconPath = path.join(REPO_ROOT, icon as string)
    expect(fs.existsSync(iconPath), `icon file missing at ${iconPath}`).to.equal(true)
  })

  it('includes the renderer bundle in the package files glob', () => {
    const build = readBuildBlock()
    expect(build.files, 'build.files must be an array').to.be.an('array')
    const files = build.files as string[]
    const hasDistGlob = files.some((entry) => /^dist\/\*\*\/\*$/.test(entry) || /^dist\//.test(entry))
    expect(hasDistGlob, `files entries must cover dist/**, got: ${JSON.stringify(files)}`).to.equal(true)
  })
})
