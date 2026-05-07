import { describe, it } from 'mocha'
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import { toggleParent, toggleSubtask } from '../../src/renderer/data/writeTodo'

const FIX_DIR = path.join(__dirname, '..', 'fixtures', 'vault', 'todos')

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIX_DIR, name), 'utf-8')
}

describe('writeTodo.toggleParent', () => {
  it('flips status from todo to done in frontmatter', () => {
    const raw = readFixture('call-dentist-2026-05-04.md')
    const next = toggleParent(raw)
    expect(next).to.match(/status:\s*done/)
    expect(next).to.not.match(/status:\s*todo/)
  })

  it('flips the first body checkbox from blank to done', () => {
    const raw = readFixture('call-dentist-2026-05-04.md')
    const next = toggleParent(raw)
    expect(next).to.match(/- \[x\] Book appointment/)
    expect(next).to.match(/- \[ \] Check insurance coverage/)
  })

  it('flips status back from done to todo on second toggle', () => {
    const raw = readFixture('call-dentist-2026-05-04.md')
    const once = toggleParent(raw)
    const twice = toggleParent(once)
    expect(twice).to.match(/status:\s*todo/)
    expect(twice).to.match(/- \[ \] Book appointment/)
  })
})

describe('writeTodo.toggleSubtask', () => {
  it('flips only the requested subtask line', () => {
    const raw = readFixture('call-dentist-2026-05-04.md')
    const next = toggleSubtask(raw, 1)
    expect(next).to.match(/- \[ \] Book appointment/)
    expect(next).to.match(/- \[x\] Check insurance coverage/)
    expect(next).to.match(/status:\s*todo/)
  })

  it('flips a checked subtask back to unchecked', () => {
    const raw =
      '---\nstatus: todo\n---\n- [x] Already done\n- [ ] Other\n'
    const next = toggleSubtask(raw, 0)
    expect(next).to.match(/- \[ \] Already done/)
  })

  it('returns input unchanged when raw has no frontmatter', () => {
    const raw = '- [ ] Loose task\n- [ ] Another\n'
    const next = toggleSubtask(raw, 1)
    expect(next).to.equal('- [ ] Loose task\n- [x] Another\n')
  })

  it('returns input unchanged when frontmatter is unterminated', () => {
    const raw = '---\nstatus: todo\n- [ ] Bad fm\n'
    const next = toggleSubtask(raw, 0)
    expect(next).to.equal('---\nstatus: todo\n- [x] Bad fm\n')
  })
})
