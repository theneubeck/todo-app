import { useState } from 'react'
import type { Task } from '../../data/parseTodo'
import './Things.css'

type Bucket = 'Today' | 'Upcoming' | 'Anytime' | 'Someday'
const BUCKETS: Bucket[] = ['Today', 'Upcoming', 'Anytime', 'Someday']

type Props = {
  tasks: Task[]
  today: string
  onToggle: (slug: string, path: number[]) => void
}

function bucketOf(t: Task, today: string): Bucket {
  if (t.tags.includes('someday')) return 'Someday'
  if (!t.due) return 'Anytime'
  if (t.due === today) return 'Today'
  if (t.due > today) return 'Upcoming'
  return 'Today'
}

function areaOf(t: Task): string {
  return t.tags[0] ?? 'No area'
}

function projectOf(t: Task): string {
  return t.project ?? 'Loose'
}

function groupBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const item of arr) {
    const k = key(item)
    const a = m.get(k) ?? []
    a.push(item)
    m.set(k, a)
  }
  return m
}

export function Things({ tasks, today, onToggle }: Props) {
  const [bucket, setBucket] = useState<Bucket>('Today')
  const visible = tasks.filter((t) => bucketOf(t, today) === bucket)
  const byArea = groupBy(visible, areaOf)

  return (
    <div className="things">
      <div role="tablist" className="things__buckets">
        {BUCKETS.map((b) => (
          <button key={b} role="tab" aria-selected={bucket === b} onClick={() => setBucket(b)}>
            {b}
          </button>
        ))}
      </div>
      <section aria-label={bucket}>
        <h2>{bucket}</h2>
        {[...byArea.entries()].map(([area, areaTasks]) => {
          const byProject = groupBy(areaTasks, projectOf)
          return (
            <section key={area} aria-label={area}>
              <h3>{area}</h3>
              {[...byProject.entries()].map(([project, projTasks]) => (
                <div key={project} role="group" aria-label={project}>
                  <h4>{project}</h4>
                  <ul>
                    {projTasks.map((t) => (
                      <li key={t.slug}>
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
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )
        })}
      </section>
    </div>
  )
}
