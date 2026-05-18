import { describe, it } from 'mocha'
import { expect } from 'chai'
import { parseTodayFile } from '../../src/renderer/data/parseTodayFile'
import fs from 'fs'
import path from 'path'

const FIXTURE_PATH = path.join(
  __dirname,
  '../../test/fixtures/vault/todos/today.md'
)

describe('parseTodayFile', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseTodayFile('')).to.deep.equal([])
  })

  it('returns an empty array when there are no wikilinks', () => {
    expect(parseTodayFile('---\ntype: today\n---\n')).to.deep.equal([])
  })

  it('extracts a single wikilink slug', () => {
    const raw = '---\ntype: today\n---\n- [[my-slug-2026-05-18]]\n'
    expect(parseTodayFile(raw)).to.deep.equal(['my-slug-2026-05-18'])
  })

  it('extracts multiple wikilink slugs in order', () => {
    const raw =
      '---\ntype: today\n---\n- [[slug-a]]\n- [[slug-b]]\n- [[slug-c]]\n'
    expect(parseTodayFile(raw)).to.deep.equal(['slug-a', 'slug-b', 'slug-c'])
  })

  it('preserves insertion order from the file', () => {
    const raw = '---\ntype: today\n---\n- [[z-last]]\n- [[a-first]]\n'
    expect(parseTodayFile(raw)).to.deep.equal(['z-last', 'a-first'])
  })

  it('ignores lines that do not contain wikilinks', () => {
    const raw =
      '---\ntype: today\n---\n- [[task-a]]\nsome prose\n- [[task-b]]\n'
    expect(parseTodayFile(raw)).to.deep.equal(['task-a', 'task-b'])
  })

  it('reads the today.md fixture and returns two task slugs in order', () => {
    const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8')
    const slugs = parseTodayFile(raw)
    expect(slugs).to.deep.equal([
      'today-flow-task-a-2026-05-18',
      'today-flow-task-b-2026-05-18',
    ])
  })
})
