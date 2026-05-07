import { useState } from 'react'
import type { Task } from '../../data/parseTodo'
import './Acunote.css'

type Props = {
  sprint: string
  tasks: Task[]
  onToggle: (slug: string, path: number[]) => void
}

function inSprint(t: Task, sprint: string): boolean {
  return t.tags.includes(`sprint:${sprint}`)
}

function weightOf(t: Task): number {
  const tag = t.tags.find((x) => /^w:\d+$/.test(x))
  return tag ? parseInt(tag.slice(2), 10) : 1
}

export function Acunote({ sprint, tasks, onToggle }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const visible = tasks.filter((t) => inSprint(t, sprint))
  const remaining = visible
    .filter((t) => t.status !== 'done')
    .reduce((sum, t) => sum + weightOf(t), 0)

  const toggleExpand = (slug: string) => {
    const next = new Set(expanded)
    if (next.has(slug)) next.delete(slug)
    else next.add(slug)
    setExpanded(next)
  }

  return (
    <div className="acunote">
      <header className="acunote__header">
        <h2>Sprint {sprint}</h2>
        <aside className="acunote__burndown">
          <span className="acunote__burndown-num" aria-label="remaining weight">{remaining}</span>
          <span className="acunote__burndown-lbl">remaining</span>
        </aside>
      </header>
      <ul aria-label="sprint tasks" className="acunote__list">
        {visible.map((t) => (
          <li key={t.slug} className="acunote__row">
            <button className="acunote__title" onClick={() => toggleExpand(t.slug)}>{t.title}</button>
            <span className="acunote__weight" aria-label={`${t.title} weight`}>{weightOf(t)}</span>
            {expanded.has(t.slug) && (
              <ul className="acunote__subs">
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
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
