import { describe, it } from 'mocha'
import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import { parseTodo } from '../../src/renderer/data/parseTodo'

const FIX_DIR = path.join(__dirname, '..', 'fixtures', 'vault', 'todos')

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIX_DIR, name), 'utf-8')
}

describe('parseTodo', () => {
  it('extracts the slug from the filename without the date suffix', () => {
    const raw = readFixture('call-dentist-2026-05-04.md')
    const task = parseTodo(raw, 'call-dentist-2026-05-04.md')
    expect(task.slug).to.equal('call-dentist')
  })

  it('extracts the title from frontmatter', () => {
    const raw = readFixture('call-dentist-2026-05-04.md')
    const task = parseTodo(raw, 'call-dentist-2026-05-04.md')
    expect(task.title).to.equal('Call dentist')
  })

  it('extracts the due date from frontmatter as an ISO string', () => {
    const raw = readFixture('q2-report-2026-05-04.md')
    const task = parseTodo(raw, 'q2-report-2026-05-04.md')
    expect(task.due).to.equal('2026-06-01')
  })

  it('omits due when frontmatter has no due field', () => {
    const raw = readFixture('read-anthropic-paper-2026-05-04.md')
    const task = parseTodo(raw, 'read-anthropic-paper-2026-05-04.md')
    expect(task.due).to.equal(undefined)
  })

  it('parses only top-level body checkboxes as subtasks', () => {
    const raw = readFixture('q2-report-2026-05-04.md')
    const task = parseTodo(raw, 'q2-report-2026-05-04.md')
    const labels = task.subtasks.map((s) => s.label)
    expect(labels).to.deep.equal([
      'Collect numbers from analytics',
      'Write executive summary',
    ])
  })

  it('preserves the raw markdown on the task', () => {
    const raw = readFixture('call-dentist-2026-05-04.md')
    const task = parseTodo(raw, 'call-dentist-2026-05-04.md')
    expect(task.raw).to.equal(raw)
  })

  it('keeps a quoted-string due value as the same ISO string', () => {
    const raw =
      '---\ntype: task\ntitle: "T"\nstatus: todo\ndue: "2026-07-04"\ntags: []\ncreated: "2026-05-04"\n---\n- [ ] do it\n'
    const task = parseTodo(raw, 'sample-2026-05-04.md')
    expect(task.due).to.equal('2026-07-04')
  })

  it('uses the slug as filePath when no filePath argument is given', () => {
    const raw = '---\ntype: task\ntitle: "T"\nstatus: todo\ntags: []\ncreated: 2026-05-04\n---\n'
    const task = parseTodo(raw, 'thing-2026-05-04.md')
    expect(task.filePath).to.equal('thing-2026-05-04.md')
  })

  it('defaults tags to an empty array when frontmatter has none', () => {
    const raw = '---\ntype: task\ntitle: "T"\nstatus: todo\ncreated: 2026-05-04\n---\n'
    const task = parseTodo(raw, 'thing-2026-05-04.md')
    expect(task.tags).to.deep.equal([])
  })

  it('defaults title to empty string when frontmatter has no title field', () => {
    const raw = '---\ntype: task\nstatus: todo\ncreated: 2026-05-04\n---\n'
    const task = parseTodo(raw, 'thing-2026-05-04.md')
    expect(task.title).to.equal('')
  })

  it('defaults status to todo when frontmatter has no status field', () => {
    const raw = '---\ntype: task\ntitle: "T"\ncreated: 2026-05-04\n---\n'
    const task = parseTodo(raw, 'thing-2026-05-04.md')
    expect(task.status).to.equal('todo')
  })

  it('defaults created to empty string when frontmatter has no created field', () => {
    const raw = '---\ntype: task\ntitle: "T"\nstatus: todo\n---\n'
    const task = parseTodo(raw, 'thing-2026-05-04.md')
    expect(task.created).to.equal('')
  })
})
