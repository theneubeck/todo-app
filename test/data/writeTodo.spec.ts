import { describe, it } from 'mocha'
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import {
  toggleParent,
  toggleSubtask,
  removeSubtask,
  addSubtask,
} from '../../src/renderer/data/writeTodo'

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

describe('writeTodo.removeSubtask', () => {
  it('removes the top-level body bullet at the given index', () => {
    const raw =
      '---\nstatus: todo\n---\n- [ ] first\n- [ ] second\n- [ ] third\n'
    const next = removeSubtask(raw, 1)
    expect(next).to.not.match(/- \[ \] second/)
    expect(next).to.match(/- \[ \] first/)
    expect(next).to.match(/- \[ \] third/)
  })

  it('preserves the order of remaining top-level bullets', () => {
    const raw =
      '---\nstatus: todo\n---\n- [ ] first\n- [ ] second\n- [ ] third\n'
    const next = removeSubtask(raw, 1)
    const firstIdx = next.indexOf('- [ ] first')
    const thirdIdx = next.indexOf('- [ ] third')
    expect(firstIdx).to.be.greaterThan(-1)
    expect(thirdIdx).to.be.greaterThan(firstIdx)
  })

  it('removes contiguous indented child lines beneath the removed bullet', () => {
    const raw =
      '---\nstatus: todo\n---\n- [ ] first\n  - [ ] child of first\n  - [ ] another child\n- [ ] second\n'
    const next = removeSubtask(raw, 0)
    expect(next).to.not.match(/- \[ \] first/)
    expect(next).to.not.match(/child of first/)
    expect(next).to.not.match(/another child/)
    expect(next).to.match(/- \[ \] second/)
  })

  it('leaves frontmatter unchanged', () => {
    const raw =
      '---\nstatus: todo\ntitle: "Prep deck"\n---\n- [ ] first\n- [ ] second\n'
    const next = removeSubtask(raw, 0)
    expect(next).to.match(/status:\s*todo/)
    expect(next).to.match(/title:\s*"Prep deck"/)
  })

  it('returns input untouched when index is out of range', () => {
    const raw =
      '---\nstatus: todo\n---\n- [ ] only\n'
    const next = removeSubtask(raw, 5)
    expect(next).to.match(/- \[ \] only/)
    expect(next).to.match(/status:\s*todo/)
  })
})

describe('writeTodo.addSubtask', () => {
  it('appends a new bullet to a body with existing top-level bullets', () => {
    const raw =
      '---\nstatus: todo\n---\n- [ ] first\n- [ ] second\n'
    const next = addSubtask(raw, 'third')
    expect(next).to.match(/- \[ \] third/)
    const firstIdx = next.indexOf('- [ ] first')
    const secondIdx = next.indexOf('- [ ] second')
    const thirdIdx = next.indexOf('- [ ] third')
    expect(firstIdx).to.be.greaterThan(-1)
    expect(secondIdx).to.be.greaterThan(firstIdx)
    expect(thirdIdx).to.be.greaterThan(secondIdx)
  })

  it('creates the first bullet on an empty body', () => {
    const raw = '---\nstatus: todo\n---\n'
    const next = addSubtask(raw, 'first thing')
    expect(next).to.match(/- \[ \] first thing/)
    expect(next).to.match(/status:\s*todo/)
  })

  it('creates the first bullet on a whitespace-only body', () => {
    const raw = '---\nstatus: todo\n---\n   \n\n'
    const next = addSubtask(raw, 'first thing')
    expect(next).to.match(/- \[ \] first thing/)
    expect(next).to.match(/status:\s*todo/)
  })

  it('trims surrounding whitespace from the input text', () => {
    const raw =
      '---\nstatus: todo\n---\n- [ ] first\n'
    const next = addSubtask(raw, '   padded   ')
    expect(next).to.match(/- \[ \] padded/)
    expect(next).to.not.match(/- \[ \] {4}padded/)
    expect(next).to.not.match(/padded {3}/)
  })

  it('leaves frontmatter unchanged', () => {
    const raw =
      '---\nstatus: todo\ntitle: "Prep deck"\ntags: [work]\n---\n- [ ] first\n'
    const next = addSubtask(raw, 'second')
    expect(next).to.match(/status:\s*todo/)
    expect(next).to.match(/title:\s*"Prep deck"/)
    expect(next).to.match(/tags:\s*\[work\]/)
  })

  it('preserves existing top-level bullet order', () => {
    const raw =
      '---\nstatus: todo\n---\n- [ ] alpha\n- [x] beta\n- [ ] gamma\n'
    const next = addSubtask(raw, 'delta')
    const aIdx = next.indexOf('- [ ] alpha')
    const bIdx = next.indexOf('- [x] beta')
    const gIdx = next.indexOf('- [ ] gamma')
    const dIdx = next.indexOf('- [ ] delta')
    expect(aIdx).to.be.greaterThan(-1)
    expect(bIdx).to.be.greaterThan(aIdx)
    expect(gIdx).to.be.greaterThan(bIdx)
    expect(dIdx).to.be.greaterThan(gIdx)
  })
})
