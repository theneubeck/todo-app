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

function setStatus(raw: string, next: 'todo' | 'done'): string {
  return raw.replace(STATUS_LINE_RE, (match, prefix, current, suffix) => {
    // Never write over `doing` — the rule never inspects or overwrites it.
    if (current === 'doing') return match
    if (current === next) return match
    return `${prefix}${next}${suffix}`
  })
}

// Bring frontmatter `status` into agreement with the body's top-level
// checkbox state after any body-mutating writer runs.
//   ≥1 top-level checkbox AND every one is `[x]`  → status: done
//   ≥1 top-level checkbox AND any is `[ ]`         → status: todo
//   0 top-level checkboxes (empty body)            → leave status alone
// Never writes or inspects `doing`.
function reconcileStatus(raw: string): string {
  const { fm, body } = splitFrontmatter(raw)
  // Without well-formed frontmatter there is no status line to reconcile.
  if (fm === '') return raw
  const lines = body.split(/\r?\n/)
  let total = 0
  let checked = 0
  for (const line of lines) {
    if (classifyLine(line) === 'topCheckbox') {
      total += 1
      if (/^- \[x\] /.test(line)) checked += 1
    }
  }
  if (total === 0) return raw
  const target: 'todo' | 'done' = checked === total ? 'done' : 'todo'
  return setStatus(raw, target)
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
  return reconcileStatus(`${fm}${newBody}`)
}

export function addSubtask(raw: string, text: string): string {
  const trimmed = text.trim()
  if (trimmed.length === 0) return raw
  const { fm, body } = splitFrontmatter(raw)
  const lines = body.split(/\r?\n/)
  let lastTopIdx = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (classifyLine(lines[i]) === 'topCheckbox') lastTopIdx = i
  }
  const newLine = `- [ ] ${trimmed}`
  if (lastTopIdx === -1) {
    // No existing top-level bullets — produce a single-bullet body.
    return reconcileStatus(`${fm}${newLine}\n`)
  }
  const newLines = [
    ...lines.slice(0, lastTopIdx + 1),
    newLine,
    ...lines.slice(lastTopIdx + 1),
  ]
  return reconcileStatus(`${fm}${newLines.join('\n')}`)
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
  return reconcileStatus(`${fm}${newLines.join('\n')}`)
}
