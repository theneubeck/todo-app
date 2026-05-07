import matter from 'gray-matter'

export type TaskStatus = 'todo' | 'doing' | 'done'

export type Subtask = {
  index: number
  label: string
  done: boolean
}

export type Task = {
  slug: string
  filePath: string
  title: string
  status: TaskStatus
  due?: string
  tags: string[]
  created: string
  raw: string
  subtasks: Subtask[]
}

const DATE_SUFFIX_RE = /-\d{4}-\d{2}-\d{2}\.md$/

function slugFromFilename(filename: string): string {
  return filename.replace(DATE_SUFFIX_RE, '')
}

function isoFromValue(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (value instanceof Date) {
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(value)
}

function parseTopLevelSubtasks(body: string): Subtask[] {
  // Top-level checkbox lines start at column 0 (no leading spaces).
  // Indented lines (subtasks of subtasks) are ignored.
  const lines = body.split(/\r?\n/)
  const subtasks: Subtask[] = []
  let index = 0
  for (const line of lines) {
    const m = /^- \[( |x)\] (.*)$/.exec(line)
    if (m) {
      subtasks.push({
        index,
        label: m[2],
        done: m[1] === 'x',
      })
      index += 1
    }
  }
  return subtasks
}

export function parseTodo(raw: string, filename: string, filePath?: string): Task {
  const parsed = matter(raw)
  const data = parsed.data as Record<string, unknown>
  const title = typeof data.title === 'string' ? data.title : ''
  const status = (data.status as TaskStatus) ?? 'todo'
  const due = isoFromValue(data.due)
  const tags = Array.isArray(data.tags) ? (data.tags as string[]) : []
  const created = isoFromValue(data.created) ?? ''
  return {
    slug: slugFromFilename(filename),
    filePath: filePath ?? filename,
    title,
    status,
    due,
    tags,
    created,
    raw,
    subtasks: parseTopLevelSubtasks(parsed.content),
  }
}
