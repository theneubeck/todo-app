import { useState } from 'react'
import type { Status, Task } from '../../data/parseTodo'
import './Linear.css'

type Props = {
  tasks: Task[]
  onChangeStatus: (slug: string, status: Status) => void
}

const COLUMNS: Status[] = ['todo', 'doing', 'done']
const LABEL: Record<Status, string> = { todo: 'Todo', doing: 'Doing', done: 'Done' }
const NEXT: Record<Status, Status | null> = { todo: 'doing', doing: 'done', done: null }

function inCycle(t: Task): boolean {
  return t.tags.some((tag) => tag.startsWith('cycle:'))
}

export function Linear({ tasks, onChangeStatus }: Props) {
  const [view, setView] = useState<'board' | 'triage'>('board')

  if (view === 'triage') {
    const triage = tasks.filter((t) => !inCycle(t))
    return (
      <div className="linear">
        <div className="linear__toolbar">
          <button onClick={() => setView('board')}>Board</button>
        </div>
        <section aria-label="Triage" className="linear__triage">
          <h2>Triage</h2>
          <ul>
            {triage.map((t) => (
              <li key={t.slug} className="linear__card">{t.title}</li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  return (
    <div className="linear">
      <div className="linear__toolbar">
        <button onClick={() => setView('triage')}>Triage</button>
      </div>
      <div className="linear__board">
        {COLUMNS.map((status) => (
          <section key={status} aria-label={LABEL[status]} className={`linear__col linear__col--${status}`}>
            <h2>{LABEL[status]}</h2>
            <ul>
              {tasks
                .filter((t) => t.status === status)
                .map((t) => (
                  <li key={t.slug} className="linear__card">
                    <span className="linear__title">{t.title}</span>
                    {NEXT[status] && (
                      <button
                        className="linear__advance"
                        aria-label={`${t.title} advance status`}
                        onClick={() => onChangeStatus(t.slug, NEXT[status]!)}
                      >
                        →
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
