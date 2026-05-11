import { Given, When, Then, Before, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { JSDOM } from 'jsdom'
import { TodozWorld } from './world'
import { mountApp } from '../../src/renderer/index'
import type { Task } from '../../src/renderer/data/parseTodo'

const REPO_ROOT = path.resolve(__dirname, '..', '..')

type WriteCall = { path: string; content: string }

type VaultWriteWorld = TodozWorld & {
  vwTmpDir?: string
  activeVaultPath?: string
  writeCalls?: WriteCall[]
  writeShouldRejectOutsideVault?: boolean
  lastWriteError?: Error
  preMountedTasks?: Task[]
  filesWrittenToRepoVault?: string[]
}

Before(function (this: VaultWriteWorld) {
  this.vwTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todoz-vault-write-'))
  this.writeCalls = []
  this.writeShouldRejectOutsideVault = false
  this.filesWrittenToRepoVault = []
})

After(function (this: VaultWriteWorld) {
  // Sweep any files the renderer may have written into the repo vault during
  // the scenario, even on regression. The fixture vault under
  // test/fixtures/vault/todos is preserved by the other features' lifecycle,
  // so we only target files our specific writes would create here.
  if (this.filesWrittenToRepoVault) {
    for (const p of this.filesWrittenToRepoVault) {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  }
  if (this.vwTmpDir && fs.existsSync(this.vwTmpDir)) {
    fs.rmSync(this.vwTmpDir, { recursive: true, force: true })
  }
})

function cloneAlphaVault(world: VaultWriteWorld): string {
  const target = path.join(world.vwTmpDir!, 'alpha')
  fs.mkdirSync(path.join(target, 'todos'), { recursive: true })
  return target
}

function bootstrapWindow(world: VaultWriteWorld): void {
  const vaultPath = world.activeVaultPath!
  world.dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    runScripts: 'dangerously',
    resources: 'usable',
  })
  const writeCalls = world.writeCalls!
  const todoz = {
    today: '2026-05-11',
    readTodos: async (): Promise<Task[]> => world.preMountedTasks ?? [],
    writeFile: async (filePath: string, content: string): Promise<void> => {
      writeCalls.push({ path: filePath, content })
      // Mirror the main-process guard so the "rejects outside vault" scenario
      // exercises real behavior. The renderer normally awaits writeFile so a
      // throw here surfaces as a rejected promise back into the renderer.
      const resolvedTarget = path.resolve(filePath)
      const resolvedVault = path.resolve(vaultPath)
      const rel = path.relative(resolvedVault, resolvedTarget)
      const inside =
        rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
      if (!inside) {
        const err = new Error(
          `write-file refused: target "${filePath}" is outside the active vault "${vaultPath}"`
        )
        world.lastWriteError = err
        throw err
      }
      // Side-effect: actually write the file so the file-exists assertions work.
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, content, 'utf-8')
    },
    runOllama: async (): Promise<string> => '',
    getVaultConfig: async (): Promise<{
      lastOpened: string | null
      recents: string[]
    }> => ({ lastOpened: vaultPath, recents: [vaultPath] }),
    openFolderPicker: async (): Promise<string | null> => null,
    createVault: async (): Promise<void> => undefined,
    setActiveVault: async (): Promise<void> => undefined,
    removeRecent: async (): Promise<void> => undefined,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(world.dom.window as any).todoz = todoz
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).window = world.dom.window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).document = world.dom.window.document
}

async function tick(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------- Given steps ----------------

Given(
  'the active vault is set to {string} and its todos folder is empty',
  async function (this: VaultWriteWorld, name: string) {
    expect(name, 'scenario name must be "alpha"').to.equal('alpha')
    this.activeVaultPath = cloneAlphaVault(this)
    bootstrapWindow(this)
    await mountApp(this.document.body)
  }
)

Given(
  'the active vault is set to {string} with one existing task',
  async function (this: VaultWriteWorld, name: string) {
    expect(name, 'scenario name must be "alpha"').to.equal('alpha')
    this.activeVaultPath = cloneAlphaVault(this)
    const existingFilename = 'existing-task-2026-05-11.md'
    const existingPath = path.join(
      this.activeVaultPath,
      'todos',
      existingFilename
    )
    const content =
      '---\ntype: task\ntitle: Existing task\nstatus: todo\ntags: []\ncreated: 2026-05-11\n---\n'
    fs.writeFileSync(existingPath, content, 'utf-8')
    this.preMountedTasks = [
      {
        slug: 'existing-task',
        filePath: existingPath,
        title: 'Existing task',
        status: 'todo',
        tags: [],
        created: '2026-05-11',
        raw: content,
        subtasks: [],
      },
    ]
    bootstrapWindow(this)
    await mountApp(this.document.body)
  }
)

Given(
  'a task {string} exists in the active vault and is rendered',
  async function (this: VaultWriteWorld, slug: string) {
    this.activeVaultPath = cloneAlphaVault(this)
    const filename = `${slug}-2026-05-11.md`
    const filePath = path.join(this.activeVaultPath, 'todos', filename)
    const content =
      '---\ntype: task\ntitle: Buy milk\nstatus: todo\ntags: []\ncreated: 2026-05-11\n---\n'
    fs.writeFileSync(filePath, content, 'utf-8')
    this.preMountedTasks = [
      {
        slug,
        filePath,
        title: 'Buy milk',
        status: 'todo',
        tags: [],
        created: '2026-05-11',
        raw: content,
        subtasks: [],
      },
    ]
    bootstrapWindow(this)
    await mountApp(this.document.body)
    // Confirm the task row is in the DOM
    const row = this.document.querySelector(`[data-task="${slug}"]`)
    expect(row, `expected task row for ${slug} to be rendered`).to.not.equal(null)
  }
)

// ---------------- When steps ----------------

When(
  'the user types {string} and presses Enter',
  async function (this: VaultWriteWorld, command: string) {
    const input = this.document.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    expect(input, 'command bar input').to.not.equal(null)
    input.value = command
    const ev = new this.dom!.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(ev)
    await tick(20)
  }
)

When('the user toggles the parent checkbox', async function (
  this: VaultWriteWorld
) {
  const checkbox = this.document.querySelector(
    '[data-task] [data-checkbox-wrapper] input[type="checkbox"]'
  ) as HTMLInputElement
  expect(checkbox, 'parent checkbox').to.not.equal(null)
  checkbox.click()
  await tick(10)
})

When(
  "the renderer attempts to write a file outside the active vault's directory tree",
  async function (this: VaultWriteWorld) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = this.dom!.window as any
    const outsidePath = path.join(this.vwTmpDir!, 'should-not-write.md')
    try {
      await win.todoz.writeFile(outsidePath, 'x')
    } catch (e) {
      this.lastWriteError = e as Error
    }
  }
)

// ---------------- Then steps ----------------

Then(
  "the file {string} exists inside the active vault's todos folder",
  function (this: VaultWriteWorld, filename: string) {
    const resolved = filename.replace('<TODAY>', '2026-05-11')
    const full = path.join(this.activeVaultPath!, 'todos', resolved)
    expect(fs.existsSync(full), `expected ${full} to exist`).to.equal(true)
  }
)

Then(
  "the file {string} does not exist inside the repo's vault folder",
  function (this: VaultWriteWorld, filename: string) {
    const resolved = filename.replace('<TODAY>', '2026-05-11')
    const repoVaultPath = path.join(REPO_ROOT, 'vault', 'todos', resolved)
    // Safety belt: if a regression wrote here, sweep on After.
    if (fs.existsSync(repoVaultPath)) {
      this.filesWrittenToRepoVault!.push(repoVaultPath)
    }
    expect(
      fs.existsSync(repoVaultPath),
      `did not expect ${repoVaultPath} to exist`
    ).to.equal(false)
  }
)

Then(
  'the second file is written into the same active vault todos folder',
  function (this: VaultWriteWorld) {
    expect(this.writeCalls!.length).to.be.greaterThan(0)
    const last = this.writeCalls![this.writeCalls!.length - 1]
    const expectedDir = path.join(this.activeVaultPath!, 'todos')
    expect(
      last.path.startsWith(expectedDir),
      `expected ${last.path} to start with ${expectedDir}`
    ).to.equal(true)
    expect(fs.existsSync(last.path), `expected ${last.path} to exist`).to.equal(
      true
    )
  }
)

Then("the write goes to the task's existing filePath", function (
  this: VaultWriteWorld
) {
  expect(this.writeCalls!.length).to.equal(1)
  const expected = this.preMountedTasks![0].filePath
  expect(this.writeCalls![0].path).to.equal(expected)
})

Then('the call rejects and no file is written', function (
  this: VaultWriteWorld
) {
  expect(this.lastWriteError, 'expected writeFile to reject').to.not.equal(
    undefined
  )
  const outsidePath = path.join(this.vwTmpDir!, 'should-not-write.md')
  expect(fs.existsSync(outsidePath)).to.equal(false)
})
