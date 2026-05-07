import type { Task } from './data/parseTodo'
import { toggleParent, toggleSubtask } from './data/writeTodo'

declare global {
  interface Window {
    todoz: {
      readTodos: () => Promise<Task[]>
      writeFile: (filePath: string, content: string) => Promise<void>
      runOllama: (prompt: string) => Promise<string>
    }
  }
}

export function compareDue(a: Task, b: Task): number {
  if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0
  if (a.due && !b.due) return -1
  if (!a.due && b.due) return 1
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
}

function renderTask(doc: Document, task: Task): HTMLElement {
  const item = doc.createElement('li')
  item.setAttribute('data-task', task.slug)
  item.setAttribute('data-task-status', task.status)

  const row = doc.createElement('div')
  row.setAttribute('data-task-row', '')

  const cb = doc.createElement('input')
  cb.type = 'checkbox'
  cb.checked = task.status === 'done'
  row.appendChild(cb)

  const title = doc.createElement('span')
  title.setAttribute('data-task-title', '')
  title.textContent = task.title
  row.appendChild(title)

  if (task.due) {
    const due = doc.createElement('span')
    due.setAttribute('data-task-due', '')
    due.textContent = task.due
    row.appendChild(due)
  }

  item.appendChild(row)

  if (task.subtasks.length > 0) {
    const subWrap = doc.createElement('ul')
    subWrap.setAttribute('data-subtasks', '')
    task.subtasks.forEach((sub) => {
      const subItem = doc.createElement('li')
      subItem.setAttribute('data-subtask', String(sub.index))

      const subCb = doc.createElement('input')
      subCb.type = 'checkbox'
      subCb.checked = sub.done
      subItem.appendChild(subCb)

      const subLabel = doc.createElement('span')
      subLabel.setAttribute('data-subtask-label', '')
      subLabel.textContent = sub.label
      subItem.appendChild(subLabel)

      subCb.addEventListener('click', async () => {
        const next = toggleSubtask(task.raw, sub.index)
        await window.todoz.writeFile(task.filePath, next)
      })

      subWrap.appendChild(subItem)
    })
    item.appendChild(subWrap)
  }

  cb.addEventListener('click', async () => {
    const next = toggleParent(task.raw)
    await window.todoz.writeFile(task.filePath, next)
  })

  return item
}

export async function mountTodoList(container: HTMLElement): Promise<void> {
  const doc = container.ownerDocument
  container.innerHTML = ''
  const root = doc.createElement('section')
  root.setAttribute('data-view', 'todo-list')

  const list = doc.createElement('ul')
  list.setAttribute('data-task-list', '')
  root.appendChild(list)
  container.appendChild(root)

  const tasks = await window.todoz.readTodos()
  const sorted = [...tasks].sort(compareDue)
  sorted.forEach((task) => {
    list.appendChild(renderTask(doc, task))
  })
}
