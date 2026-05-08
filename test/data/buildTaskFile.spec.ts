import { describe, it } from 'mocha'
import { expect } from 'chai'
import { buildTaskFile } from '../../src/renderer/data/buildTaskFile'

describe('buildTaskFile', () => {
  it('produces a slugified-title-date filename', () => {
    const { filename } = buildTaskFile({
      title: 'Buy milk',
      tags: [],
      today: '2026-05-07',
      existingFilenames: [],
    })
    expect(filename).to.equal('buy-milk-2026-05-07.md')
  })

  it('appends -2 when the filename already exists', () => {
    const { filename } = buildTaskFile({
      title: 'Buy milk',
      tags: [],
      today: '2026-05-07',
      existingFilenames: ['buy-milk-2026-05-07.md'],
    })
    expect(filename).to.equal('buy-milk-2026-05-07-2.md')
  })

  it('appends -3 when both the base and -2 already exist', () => {
    const { filename } = buildTaskFile({
      title: 'Buy milk',
      tags: [],
      today: '2026-05-07',
      existingFilenames: [
        'buy-milk-2026-05-07.md',
        'buy-milk-2026-05-07-2.md',
      ],
    })
    expect(filename).to.equal('buy-milk-2026-05-07-3.md')
  })

  it('writes type, title, status, tags, created in frontmatter', () => {
    const { content } = buildTaskFile({
      title: 'Buy milk',
      tags: ['urgent', '@sara'],
      today: '2026-05-07',
      existingFilenames: [],
    })
    expect(content).to.match(/type:\s*task/)
    expect(content).to.match(/title:\s*"Buy milk"/)
    expect(content).to.match(/status:\s*todo/)
    expect(content).to.match(/tags:\s*\[urgent,\s*"@sara"\]/)
    expect(content).to.match(/created:\s*2026-05-07/)
  })

  it('writes an empty body', () => {
    const { content } = buildTaskFile({
      title: 'Buy milk',
      tags: [],
      today: '2026-05-07',
      existingFilenames: [],
    })
    // Body is the substring after the closing frontmatter delimiter.
    const body = content.split(/^---\s*$/m)[2] ?? ''
    expect(body.trim()).to.equal('')
  })
})
