import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { loadTodos } from './loadTodos'

// Behaviors:
// 1. returns one Task per .md file in the directory
// 2. ignores non-.md files
// 3. tasks are sorted by slug for deterministic order

const fixtureDir = path.resolve(__dirname, '../../test/fixtures/vault/todos')

describe('loadTodos', () => {
  it('returns one Task per .md file in the directory', () => {
    const tasks = loadTodos(fixtureDir)
    expect(tasks).toHaveLength(3)
  })

  it('returns tasks sorted by slug', () => {
    const tasks = loadTodos(fixtureDir)
    expect(tasks.map((t) => t.slug)).toEqual([
      'buy-coffee-2026-05-05',
      'ship-onboarding-2026-05-06',
      'write-q3-strategy-2026-05-04',
    ])
  })
})
