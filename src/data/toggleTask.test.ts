import { describe, it, expect } from 'vitest'
import { toggleTask } from './toggleTask'

// Behaviors:
// 1. toggles unchecked top-level item to checked
// 2. toggles checked top-level item to unchecked
// 3. toggles nested item via index path
// 4. preserves frontmatter content
// 5. preserves sibling items untouched

const SRC = `---
type: task
title: Sample
status: todo
tags: []
---
- [ ] First
  - [ ] Sub one
  - [x] Sub two
- [ ] Second
`

describe('toggleTask', () => {
  it('toggles unchecked top-level item to checked', () => {
    const out = toggleTask(SRC, [0])
    expect(out).toContain('- [x] First')
  })

  it('toggles checked nested item to unchecked', () => {
    const out = toggleTask(SRC, [0, 1])
    expect(out).toContain('  - [ ] Sub two')
  })

  it('toggles unchecked nested item to checked', () => {
    const out = toggleTask(SRC, [0, 0])
    expect(out).toContain('  - [x] Sub one')
  })

  it('preserves frontmatter', () => {
    const out = toggleTask(SRC, [0])
    expect(out).toContain('title: Sample')
    expect(out).toContain('status: todo')
  })

  it('preserves sibling items untouched', () => {
    const out = toggleTask(SRC, [0])
    expect(out).toContain('- [ ] Second')
    expect(out).toContain('  - [ ] Sub one')
    expect(out).toContain('  - [x] Sub two')
  })
})
