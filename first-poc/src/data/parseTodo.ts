import matter from 'gray-matter'

export type Status = 'todo' | 'doing' | 'done'

export type CheckboxItem = {
  text: string
  done: boolean
  children: CheckboxItem[]
}

export type Task = {
  slug: string
  title: string
  status: Status
  tags: string[]
  due?: string
  project?: string
  created?: string
  items: CheckboxItem[]
}

function isoDate(v: unknown): string | undefined {
  if (v == null) return undefined
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

const CHECKBOX = /^(\s*)- \[( |x)\] (.*)$/

const INDENT = 2

function parseItems(body: string): CheckboxItem[] {
  const top: CheckboxItem[] = []
  const stack: { depth: number; item: CheckboxItem }[] = []
  for (const line of body.split('\n')) {
    const m = CHECKBOX.exec(line)
    if (!m) continue
    const depth = Math.floor(m[1].length / INDENT)
    const item: CheckboxItem = { text: m[3], done: m[2] === 'x', children: [] }
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
    if (stack.length === 0) top.push(item)
    else stack[stack.length - 1].item.children.push(item)
    stack.push({ depth, item })
  }
  return top
}

export function parseTodo(filename: string, source: string): Task {
  const { data, content } = matter(source)
  const slug = filename.replace(/\.md$/, '')
  return {
    slug,
    title: data.title,
    status: data.status,
    tags: data.tags ?? [],
    due: isoDate(data.due),
    project: data.project,
    created: isoDate(data.created),
    items: parseItems(content),
  }
}
