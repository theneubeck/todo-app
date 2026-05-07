import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseTodo } from './parseTodo'

// Behaviors:
// 1. parses title from frontmatter
// 2. parses status from frontmatter
// 3. parses tags as array
// 4. parses due as ISO string when present, undefined when absent
// 5. parses project slug when present
// 6. derives slug from filename (without .md)
// 7. parses top-level checkbox lines as items
// 8. parses nested checkbox lines as children of preceding parent
// 9. preserves done state for each checkbox item
// 10. supports two-space indent for nesting
// 11. supports deep nesting (3+ levels)

const fixtureDir = path.resolve(__dirname, '../../test/fixtures/vault/todos')
const read = (file: string) =>
  readFileSync(path.join(fixtureDir, file), 'utf-8')

describe('parseTodo', () => {
  it('parses title from frontmatter', () => {
    const t = parseTodo('write-q3-strategy-2026-05-04.md', read('write-q3-strategy-2026-05-04.md'))
    expect(t.title).toBe('Write Q3 strategy')
  })

  it('parses status from frontmatter', () => {
    const t = parseTodo('write-q3-strategy-2026-05-04.md', read('write-q3-strategy-2026-05-04.md'))
    expect(t.status).toBe('doing')
  })

  it('parses tags as array', () => {
    const t = parseTodo('write-q3-strategy-2026-05-04.md', read('write-q3-strategy-2026-05-04.md'))
    expect(t.tags).toEqual(['work', 'q3'])
  })

  it('parses due as ISO string when present', () => {
    const t = parseTodo('write-q3-strategy-2026-05-04.md', read('write-q3-strategy-2026-05-04.md'))
    expect(t.due).toBe('2026-06-15')
  })

  it('leaves due undefined when absent', () => {
    const t = parseTodo('buy-coffee-2026-05-05.md', read('buy-coffee-2026-05-05.md'))
    expect(t.due).toBeUndefined()
  })

  it('parses project slug when present', () => {
    const t = parseTodo('write-q3-strategy-2026-05-04.md', read('write-q3-strategy-2026-05-04.md'))
    expect(t.project).toBe('q3-strategy-2026-05-04')
  })

  it('derives slug from filename without .md', () => {
    const t = parseTodo('write-q3-strategy-2026-05-04.md', read('write-q3-strategy-2026-05-04.md'))
    expect(t.slug).toBe('write-q3-strategy-2026-05-04')
  })

  it('parses top-level checkbox lines as items', () => {
    const t = parseTodo('write-q3-strategy-2026-05-04.md', read('write-q3-strategy-2026-05-04.md'))
    expect(t.items.map((i) => i.text)).toEqual(['Draft outline', 'Review with manager'])
  })

  it('parses nested checkboxes as children of preceding parent', () => {
    const t = parseTodo('write-q3-strategy-2026-05-04.md', read('write-q3-strategy-2026-05-04.md'))
    expect(t.items[0].children.map((c) => c.text)).toEqual([
      'Collect last quarter metrics',
      'Sketch three scenarios',
    ])
  })

  it('preserves done state per checkbox', () => {
    const t = parseTodo('write-q3-strategy-2026-05-04.md', read('write-q3-strategy-2026-05-04.md'))
    expect(t.items[0].done).toBe(false)
    expect(t.items[0].children[0].done).toBe(true)
    expect(t.items[0].children[1].done).toBe(false)
  })

  it('parses three-level nesting', () => {
    const src = `---\ntype: task\ntitle: deep\nstatus: todo\ntags: []\n---\n- [ ] L1\n  - [ ] L2\n    - [x] L3\n`
    const t = parseTodo('deep-2026-05-06.md', src)
    expect(t.items[0].children[0].children[0]).toEqual({ text: 'L3', done: true, children: [] })
  })
})
