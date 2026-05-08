// Pure string transforms over raw markdown. No fs, no Node modules.
// The renderer never imports gray-matter; we operate on the raw string and
// keep the existing frontmatter line formatting intact.

const STATUS_LINE_RE = /^(\s*status:\s*)(todo|doing|done)(\s*)$/m

function flipStatus(raw: string): string {
  return raw.replace(STATUS_LINE_RE, (_match, prefix, current, suffix) => {
    const next = current === 'done' ? 'todo' : 'done'
    return `${prefix}${next}${suffix}`
  })
}

type LineKind = 'topCheckbox' | 'other'

function classifyLine(line: string): LineKind {
  if (/^- \[( |x)\] /.test(line)) return 'topCheckbox'
  return 'other'
}

function flipCheckbox(line: string): string {
  return line.replace(/^- \[( |x)\] /, (_m, ch) => (ch === 'x' ? '- [ ] ' : '- [x] '))
}

function splitFrontmatter(raw: string): { fm: string; body: string; sep: string } {
  // Frontmatter delimited by --- on its own line at the very start.
  if (!raw.startsWith('---')) {
    return { fm: '', body: raw, sep: '' }
  }
  const newline = raw.includes('\r\n') ? '\r\n' : '\n'
  const closeIdx = raw.indexOf(`${newline}---${newline}`, 3)
  if (closeIdx === -1) {
    return { fm: '', body: raw, sep: '' }
  }
  const fmEnd = closeIdx + newline.length + 3 + newline.length
  return {
    fm: raw.slice(0, fmEnd),
    body: raw.slice(fmEnd),
    sep: '',
  }
}

export function toggleParent(raw: string): string {
  const flipped = flipStatus(raw)
  const { fm, body } = splitFrontmatter(flipped)
  const lines = body.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    if (classifyLine(lines[i]) === 'topCheckbox') {
      lines[i] = flipCheckbox(lines[i])
      break
    }
  }
  const newBody = lines.join('\n')
  return `${fm}${newBody}`
}

export function toggleSubtask(raw: string, index: number): string {
  const { fm, body } = splitFrontmatter(raw)
  const lines = body.split(/\r?\n/)
  let seen = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (classifyLine(lines[i]) === 'topCheckbox') {
      seen += 1
      if (seen === index) {
        lines[i] = flipCheckbox(lines[i])
        break
      }
    }
  }
  const newBody = lines.join('\n')
  return `${fm}${newBody}`
}

export function removeSubtask(raw: string, index: number): string {
  const { fm, body } = splitFrontmatter(raw)
  const lines = body.split(/\r?\n/)
  let seen = -1
  let startIdx = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (classifyLine(lines[i]) === 'topCheckbox') {
      seen += 1
      if (seen === index) {
        startIdx = i
        break
      }
    }
  }
  if (startIdx === -1) {
    return `${fm}${lines.join('\n')}`
  }
  // Remove the start line plus any following lines that are children
  // (first character is whitespace) — these are indented continuations.
  let endIdx = startIdx + 1
  while (endIdx < lines.length && /^\s/.test(lines[endIdx]) && lines[endIdx].length > 0) {
    endIdx += 1
  }
  const newLines = lines.slice(0, startIdx).concat(lines.slice(endIdx))
  return `${fm}${newLines.join('\n')}`
}
