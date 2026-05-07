import { Buffer } from 'buffer'
;(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer

import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'
import { parseTodo, type CheckboxItem, type Status, type Task } from './data/parseTodo'
import type { ParsedInput } from './patterns/todoist/parseInput'

const rawFiles = import.meta.glob('/vault/todos/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const initial: Task[] = Object.entries(rawFiles)
  .map(([p, src]) => {
    const name = p.split('/').pop() ?? p
    return parseTodo(name, src)
  })
  .sort((a, b) => a.slug.localeCompare(b.slug))

function flipAt(items: CheckboxItem[], path: number[]): CheckboxItem[] {
  if (path.length === 0) return items
  return items.map((it, i) => {
    if (i !== path[0]) return it
    if (path.length === 1) return { ...it, done: !it.done }
    return { ...it, children: flipAt(it.children, path.slice(1)) }
  })
}

const today = new Date().toISOString().slice(0, 10)
const sprint = '2026-w19'

function Root() {
  const [tasks, setTasks] = useState<Task[]>(initial)

  const onToggle = (slug: string, path: number[]) => {
    setTasks((prev) =>
      prev.map((t) => (t.slug === slug ? { ...t, items: flipAt(t.items, path) } : t)),
    )
  }

  const onChangeStatus = (slug: string, status: Status) => {
    setTasks((prev) => prev.map((t) => (t.slug === slug ? { ...t, status } : t)))
  }

  const onCreate = (p: ParsedInput) => {
    const slug = `${p.title.toLowerCase().replace(/\s+/g, '-')}-${today}`
    setTasks((prev) => [
      ...prev,
      {
        slug,
        title: p.title,
        status: 'todo',
        tags: [...p.tags, p.priority],
        due: p.due,
        items: [{ text: p.title, done: false, children: [] }],
      },
    ])
  }

  return <App tasks={tasks} today={today} sprint={sprint} onToggle={onToggle} onChangeStatus={onChangeStatus} onCreate={onCreate} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
