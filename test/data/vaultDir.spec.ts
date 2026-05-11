import { describe, it } from 'mocha'
import { expect } from 'chai'
import { vaultDir } from '../../src/renderer/data/vaultDir'
import type { Task } from '../../src/renderer/data/parseTodo'

function makeTask(filePath: string): Task {
  return {
    slug: 'x',
    filePath,
    title: 'x',
    status: 'todo',
    tags: [],
    created: '2026-05-11',
    raw: '',
    subtasks: [],
  }
}

describe('vaultDir', () => {
  it('returns vaultPath/todos when vaultPath is provided', () => {
    expect(vaultDir('/abs/alpha', [])).to.equal('/abs/alpha/todos')
  })

  it('returns vaultPath/todos even when the tasks list is empty', () => {
    expect(vaultDir('/abs/alpha', [])).to.equal('/abs/alpha/todos')
  })

  it('derives from existing tasks when vaultPath is null and tasks is non-empty (back-compat)', () => {
    const tasks = [makeTask('/abs/derived/todos/buy-milk-2026-05-11.md')]
    expect(vaultDir(null, tasks)).to.equal('/abs/derived/todos')
  })

  it('returns the legacy relative fallback only when vaultPath is null and tasks is empty (back-compat for old tests)', () => {
    expect(vaultDir(null, [])).to.equal('vault/todos')
  })

  it('falls back to the legacy relative path when tasks have no directory component', () => {
    const tasks = [makeTask('bare-filename.md')]
    expect(vaultDir(null, tasks)).to.equal('vault/todos')
  })
})
