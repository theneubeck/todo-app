import { useState } from 'react'
import type { Task } from '../../data/parseTodo'
import { parseInput, type ParsedInput, type Priority } from './parseInput'
import './Todoist.css'

type Props = {
  tasks: Task[]
  today: string
  onToggle: (slug: string, path: number[]) => void
  onCreate: (parsed: ParsedInput) => void
}

function priorityOf(t: Task): Priority {
  const flag = t.tags.find((tag) => /^p[1-4]$/.test(tag)) as Priority | undefined
  return flag ?? 'p4'
}

export function Todoist({ tasks, today, onToggle, onCreate }: Props) {
  const [filter, setFilter] = useState<'all' | 'today'>('all')
  const [draft, setDraft] = useState('')

  const visible = filter === 'today' ? tasks.filter((t) => t.due === today) : tasks
  const sorted = [...visible].sort((a, b) => priorityOf(a).localeCompare(priorityOf(b)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    onCreate(parseInput(draft, today))
    setDraft('')
  }

  return (
    <div className="todoist">
      <form onSubmit={submit} className="todoist__capture">
        <label>
          Add task
          <input
            aria-label="Add task"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
      </form>
      <div className="todoist__filters">
        <button onClick={() => setFilter('all')} aria-pressed={filter === 'all'}>
          All
        </button>
        <button onClick={() => setFilter('today')} aria-pressed={filter === 'today'}>
          Today
        </button>
      </div>
      <ul aria-label="tasks">
        {sorted.map((t) => {
          const p = priorityOf(t)
          return (
            <li key={t.slug} className={`todoist__task todoist__task--${p}`}>
              <span aria-label={`priority ${p}`} className="todoist__flag">⚑</span>
              <strong>{t.title}</strong>
              <ul>
                {t.items.map((it, i) => (
                  <li key={i}>
                    <label>
                      <input
                        type="checkbox"
                        checked={it.done}
                        onChange={() => onToggle(t.slug, [i])}
                      />
                      {it.text}
                    </label>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
