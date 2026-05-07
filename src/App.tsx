import { useState } from 'react'
import type { Status, Task } from './data/parseTodo'
import { Reminders } from './patterns/reminders/Reminders'
import { Things } from './patterns/things/Things'
import { Todoist } from './patterns/todoist/Todoist'
import { Acunote } from './patterns/acunote/Acunote'
import { Outline } from './patterns/outline/Outline'
import { Linear } from './patterns/linear/Linear'
import type { ParsedInput } from './patterns/todoist/parseInput'

const PATTERNS = ['Reminders', 'Things', 'Todoist', 'Acunote', 'Outline', 'Linear'] as const
type Pattern = (typeof PATTERNS)[number]

type Props = {
  tasks: Task[]
  today: string
  sprint: string
  onToggle: (slug: string, path: number[]) => void
  onChangeStatus: (slug: string, status: Status) => void
  onCreate: (parsed: ParsedInput) => void
}

export function App({ tasks, today, sprint, onToggle, onChangeStatus, onCreate }: Props) {
  const [active, setActive] = useState<Pattern>('Reminders')
  return (
    <main className="app">
      <div role="tablist">
        {PATTERNS.map((p) => (
          <button key={p} role="tab" aria-selected={active === p} onClick={() => setActive(p)}>
            {p}
          </button>
        ))}
      </div>
      {active === 'Reminders' && <Reminders tasks={tasks} onToggle={onToggle} />}
      {active === 'Things' && <Things tasks={tasks} today={today} onToggle={onToggle} />}
      {active === 'Todoist' && (
        <Todoist tasks={tasks} today={today} onToggle={onToggle} onCreate={onCreate} />
      )}
      {active === 'Acunote' && <Acunote sprint={sprint} tasks={tasks} onToggle={onToggle} />}
      {active === 'Outline' && <Outline tasks={tasks} onToggle={onToggle} />}
      {active === 'Linear' && <Linear tasks={tasks} onChangeStatus={onChangeStatus} />}
    </main>
  )
}
