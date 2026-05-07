import { useState } from 'react'
import type { CheckboxItem, Task } from '../../data/parseTodo'
import './Outline.css'

type Props = {
  tasks: Task[]
  onToggle: (slug: string, path: number[]) => void
}

type Node = {
  id: string
  text: string
  isTask: boolean
  done?: boolean
  taskSlug: string
  path: number[]
  children: Node[]
}

function itemToNode(item: CheckboxItem, taskSlug: string, path: number[]): Node {
  return {
    id: `${taskSlug}/${path.join('.')}`,
    text: item.text,
    isTask: false,
    done: item.done,
    taskSlug,
    path,
    children: item.children.map((c, i) => itemToNode(c, taskSlug, [...path, i])),
  }
}

function taskToNode(task: Task): Node {
  return {
    id: task.slug,
    text: task.title,
    isTask: true,
    taskSlug: task.slug,
    path: [],
    children: task.items.map((it, i) => itemToNode(it, task.slug, [i])),
  }
}

function findNode(nodes: Node[], id: string): Node | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    const inner = findNode(n.children, id)
    if (inner) return inner
  }
  return undefined
}

export function Outline({ tasks, onToggle }: Props) {
  const roots = tasks.map(taskToNode)
  const [zoomId, setZoomId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const visibleRoots: Node[] = zoomId
    ? (() => {
        const found = findNode(roots, zoomId)
        return found ? [found] : roots
      })()
    : roots

  const toggleCollapse = (id: string) => {
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCollapsed(next)
  }

  const renderNode = (n: Node) => {
    const isCollapsed = collapsed.has(n.id)
    return (
      <li key={n.id} role="treeitem" aria-label={n.text} className="outline__node">
        <span className="outline__row">
          {n.children.length > 0 ? (
            <button className="outline__caret" onClick={() => toggleCollapse(n.id)} aria-label={isCollapsed ? 'expand' : 'collapse'}>
              {isCollapsed ? '▸' : '▾'}
            </button>
          ) : (
            <span className="outline__bullet">•</span>
          )}
          {n.isTask ? (
            <button className="outline__title" onClick={() => setZoomId(n.id)} aria-label={`zoom ${n.text}`}>
              {n.text}
            </button>
          ) : (
            <label>
              <input
                type="checkbox"
                checked={!!n.done}
                onChange={() => onToggle(n.taskSlug, n.path)}
              />
              {n.text}
            </label>
          )}
        </span>
        {!isCollapsed && n.children.length > 0 && (
          <ul role="group">{n.children.map(renderNode)}</ul>
        )}
      </li>
    )
  }

  return (
    <div className="outline">
      {zoomId && (
        <nav className="outline__crumbs">
          <button onClick={() => setZoomId(null)}>Home</button>
        </nav>
      )}
      <ul role="tree" className="outline__tree">{visibleRoots.map(renderNode)}</ul>
    </div>
  )
}
