import type { CheckboxItem, Task } from '../../data/parseTodo'
import './Reminders.css'

type Props = {
  tasks: Task[]
  onToggle: (slug: string, path: number[]) => void
}

function groupKey(t: Task): string {
  return t.tags[0] ?? 'Inbox'
}

function ItemRow({
  item,
  path,
  onToggle,
}: {
  item: CheckboxItem
  path: number[]
  onToggle: () => void
}) {
  return (
    <li>
      <label>
        <input type="checkbox" checked={item.done} onChange={onToggle} />
        {item.text}
      </label>
      {item.children.length > 0 && (
        <ul>
          {item.children.map((c, i) => (
            <ItemRow key={i} item={c} path={[...path, i]} onToggle={() => undefined} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function Reminders({ tasks, onToggle }: Props) {
  const groups = new Map<string, Task[]>()
  for (const t of tasks) {
    const k = groupKey(t)
    const arr = groups.get(k) ?? []
    arr.push(t)
    groups.set(k, arr)
  }
  return (
    <div className="reminders">
      {[...groups.entries()].map(([name, group]) => (
        <section key={name} aria-label={name}>
          <h2>
            {name}{' '}
            <span aria-label={`${name} incomplete count`}>
              {group.filter((t) => t.status !== 'done').length}
            </span>
          </h2>
          <ul>
            {group.map((t) => (
              <li key={t.slug}>
                <strong>{t.title}</strong>
                <ul>
                  {t.items.map((it, i) => (
                    <ItemRow
                      key={i}
                      item={it}
                      path={[i]}
                      onToggle={() => onToggle(t.slug, [i])}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
