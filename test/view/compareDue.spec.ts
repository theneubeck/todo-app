import { describe, it } from 'mocha'
import { expect } from 'chai'
import { compareDue } from '../../src/renderer/index'
import type { Task } from '../../src/renderer/data/parseTodo'

function task(over: Partial<Task>): Task {
  return {
    slug: 'x',
    filePath: '/x',
    title: 'X',
    status: 'todo',
    tags: [],
    created: '2026-05-04',
    raw: '',
    subtasks: [],
    ...over,
  }
}

describe('compareDue', () => {
  it('returns -1 when a has earlier due than b', () => {
    expect(
      compareDue(task({ due: '2026-05-01' }), task({ due: '2026-05-10' }))
    ).to.equal(-1)
  })

  it('returns 1 when a has later due than b', () => {
    expect(
      compareDue(task({ due: '2026-06-01' }), task({ due: '2026-05-10' }))
    ).to.equal(1)
  })

  it('returns 0 when a and b have the same due', () => {
    expect(
      compareDue(task({ due: '2026-05-10' }), task({ due: '2026-05-10' }))
    ).to.equal(0)
  })

  it('places dated before undated', () => {
    expect(
      compareDue(task({ due: '2026-05-10' }), task({ due: undefined }))
    ).to.equal(-1)
  })

  it('places undated after dated', () => {
    expect(
      compareDue(task({ due: undefined }), task({ due: '2026-05-10' }))
    ).to.equal(1)
  })

  it('falls back to slug ordering when both are undated', () => {
    expect(
      compareDue(task({ slug: 'apple' }), task({ slug: 'banana' }))
    ).to.equal(-1)
    expect(
      compareDue(task({ slug: 'banana' }), task({ slug: 'apple' }))
    ).to.equal(1)
    expect(
      compareDue(task({ slug: 'same' }), task({ slug: 'same' }))
    ).to.equal(0)
  })
})
