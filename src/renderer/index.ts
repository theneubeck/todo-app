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

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Record<string, string> = {},
  text?: string
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, v)
  }
  if (text !== undefined) node.textContent = text
  return node
}

function icon(doc: Document, name: string): HTMLElement {
  const span = el(doc, 'span', {
    class: 'material-symbols-outlined',
    'data-icon': name,
  })
  span.textContent = name
  return span
}

function renderTopAppBar(doc: Document): HTMLElement {
  const header = el(doc, 'header', { 'data-app-bar': '' })
  const left = el(doc, 'div')
  const brand = el(doc, 'span', { 'data-brand': '' }, 'TaskStream')
  left.appendChild(brand)
  header.appendChild(left)

  const actions = el(doc, 'div', { 'data-app-bar-actions': '' })
  const addBtn = el(doc, 'button', { type: 'button', 'aria-label': 'Add' })
  addBtn.appendChild(icon(doc, 'add'))
  actions.appendChild(addBtn)

  const settingsBtn = el(doc, 'button', { type: 'button', 'aria-label': 'Settings' })
  settingsBtn.appendChild(icon(doc, 'settings'))
  actions.appendChild(settingsBtn)

  const avatar = el(doc, 'div', { 'data-avatar': '' })
  avatar.appendChild(icon(doc, 'person'))
  actions.appendChild(avatar)

  header.appendChild(actions)
  return header
}

function renderNavEntry(
  doc: Document,
  label: string,
  iconName: string,
  active = false
): HTMLElement {
  const attrs: Record<string, string> = {
    href: '#',
    'data-nav-entry': '',
  }
  if (active) attrs['data-nav-active'] = 'true'
  const a = el(doc, 'a', attrs)
  a.appendChild(icon(doc, iconName))
  const text = el(doc, 'span', { 'data-nav-label': '' }, label)
  a.appendChild(text)
  return a
}

function renderSectionEntry(
  doc: Document,
  label: string,
  iconName: string
): HTMLElement {
  const a = el(doc, 'a', { href: '#', 'data-section-entry': '' })
  a.appendChild(icon(doc, iconName))
  const text = el(doc, 'span', { 'data-section-entry-label': '' }, label)
  a.appendChild(text)
  return a
}

function renderSection(
  doc: Document,
  heading: string,
  entries: Array<{ label: string; icon: string }>
): HTMLElement {
  const section = el(doc, 'div', { 'data-section': '' })
  const h = el(doc, 'h3', { 'data-section-header': '' }, heading)
  section.appendChild(h)
  for (const e of entries) {
    section.appendChild(renderSectionEntry(doc, e.label, e.icon))
  }
  return section
}

function renderSidebar(doc: Document): HTMLElement {
  const aside = el(doc, 'aside', { 'data-sidebar': '' })
  aside.appendChild(renderNavEntry(doc, 'Chat', 'chat_bubble'))
  aside.appendChild(renderNavEntry(doc, 'Inbox', 'inbox'))
  aside.appendChild(renderNavEntry(doc, 'Today', 'today', true))
  aside.appendChild(renderNavEntry(doc, 'Upcoming', 'calendar_month'))
  aside.appendChild(
    renderSection(doc, 'Projects', [
      { label: 'Design System', icon: 'tag' },
      { label: 'Frontend Architecture', icon: 'tag' },
    ])
  )
  aside.appendChild(
    renderSection(doc, 'People', [
      { label: '@name', icon: 'alternate_email' },
      { label: '@someothername', icon: 'alternate_email' },
    ])
  )
  return aside
}

function renderMainHeader(doc: Document, remaining: number): HTMLElement {
  const header = el(doc, 'div', { 'data-main-header': '' })
  const inner = el(doc, 'div')
  const h1 = el(doc, 'h1', {}, 'Today')
  inner.appendChild(h1)
  const count = el(
    doc,
    'p',
    { 'data-remaining-count': '' },
    `${remaining} task${remaining === 1 ? '' : 's'} remaining`
  )
  inner.appendChild(count)
  header.appendChild(inner)
  return header
}

function chipForTask(doc: Document, task: Task): HTMLElement {
  // Map first tag to a chip; fall back to "Task" if none.
  const tag = task.tags[0]
  const label = tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : 'Task'
  const attrs: Record<string, string> = { 'data-chip': '' }
  // Heuristic priority: if task has a near-future due date treat as high.
  if (task.due) attrs['data-chip-priority'] = 'high'
  else attrs['data-chip-priority'] = 'medium'
  return el(doc, 'span', attrs, label)
}

function renderSubtasks(doc: Document, task: Task): HTMLElement {
  const ul = el(doc, 'ul', {
    'data-subtasks': '',
    'data-guide-line': '',
  })
  task.subtasks.forEach((sub) => {
    const li = el(doc, 'li', {
      'data-subtask': String(sub.index),
      'data-subtask-done': sub.done ? 'true' : 'false',
    })
    const cb = el(doc, 'input', { type: 'checkbox' }) as HTMLInputElement
    cb.checked = sub.done
    li.appendChild(cb)
    const labelAttrs: Record<string, string> = { 'data-subtask-label': '' }
    if (sub.done) labelAttrs['data-strikethrough'] = 'true'
    const label = el(doc, 'span', labelAttrs, sub.label)
    li.appendChild(label)
    cb.addEventListener('click', async () => {
      const next = toggleSubtask(task.raw, sub.index)
      await window.todoz.writeFile(task.filePath, next)
    })
    ul.appendChild(li)
  })
  return ul
}

function renderTaskRow(doc: Document, task: Task, expanded: boolean): HTMLElement {
  const item = el(doc, 'li', {
    'data-task': task.slug,
    'data-task-status': task.status,
    'data-expanded': expanded ? 'true' : 'false',
  })

  const row = el(doc, 'div', { 'data-task-row': '' })
  const chevron = icon(doc, expanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right')
  chevron.setAttribute('data-chevron', '')
  row.appendChild(chevron)

  const cbWrap = el(doc, 'div', { 'data-checkbox-wrapper': '' })
  const cb = el(doc, 'input', { type: 'checkbox' }) as HTMLInputElement
  cb.checked = task.status === 'done'
  cbWrap.appendChild(cb)
  row.appendChild(cbWrap)

  const title = el(doc, 'span', { 'data-task-title': '' }, task.title)
  row.appendChild(title)

  if (task.due) {
    const due = el(doc, 'span', { 'data-task-due': '' }, task.due)
    row.appendChild(due)
  }

  row.appendChild(chipForTask(doc, task))

  cb.addEventListener('click', async (e) => {
    e.stopPropagation()
    const next = toggleParent(task.raw)
    await window.todoz.writeFile(task.filePath, next)
  })

  row.addEventListener('click', () => {
    const next = item.getAttribute('data-expanded') === 'true' ? 'false' : 'true'
    item.setAttribute('data-expanded', next)
    chevron.textContent = next === 'true' ? 'keyboard_arrow_down' : 'keyboard_arrow_right'
    chevron.setAttribute(
      'data-icon',
      next === 'true' ? 'keyboard_arrow_down' : 'keyboard_arrow_right'
    )
    // Toggle subtask container visibility
    const existing = item.querySelector('[data-subtasks]')
    if (next === 'true' && !existing && task.subtasks.length > 0) {
      item.appendChild(renderSubtasks(doc, task))
    } else if (next === 'false' && existing) {
      existing.remove()
    }
  })

  item.appendChild(row)

  if (expanded && task.subtasks.length > 0) {
    item.appendChild(renderSubtasks(doc, task))
  }

  return item
}

function groupTasks(tasks: Task[]): Array<{ heading: string; tasks: Task[] }> {
  const high = tasks.filter((t) => !!t.due)
  const other = tasks.filter((t) => !t.due)
  const groups: Array<{ heading: string; tasks: Task[] }> = []
  if (high.length > 0) groups.push({ heading: 'HIGH PRIORITY', tasks: high })
  if (other.length > 0) groups.push({ heading: 'OTHER TASKS', tasks: other })
  return groups
}

function renderTaskCard(doc: Document, tasks: Task[]): HTMLElement {
  const card = el(doc, 'div', {
    'data-task-card': '',
    'data-view': 'todo-list',
  })
  const list = el(doc, 'ul', { 'data-task-list': '' })
  const groups = groupTasks(tasks)
  let firstTaskRendered = false
  groups.forEach((group) => {
    const heading = el(doc, 'h3', { 'data-group-heading': '' }, group.heading)
    list.appendChild(heading)
    group.tasks.forEach((task) => {
      const expanded = !firstTaskRendered
      firstTaskRendered = true
      list.appendChild(renderTaskRow(doc, task, expanded))
    })
  })
  card.appendChild(list)
  return card
}

function renderCommandBar(doc: Document): HTMLElement {
  const bar = el(doc, 'div', {
    'data-command-bar': '',
    'data-pinned': 'bottom',
  })
  bar.appendChild(icon(doc, 'bolt'))
  const fields = el(doc, 'div', { 'data-command-bar-fields': '' })
  const mention = el(doc, 'span', { 'data-command-chip': 'mention' })
  mention.appendChild(icon(doc, 'alternate_email'))
  mention.appendChild(doc.createTextNode('name'))
  fields.appendChild(mention)
  const tag = el(doc, 'span', { 'data-command-chip': 'tag' })
  tag.appendChild(icon(doc, 'tag'))
  tag.appendChild(doc.createTextNode('design'))
  fields.appendChild(tag)
  const input = el(doc, 'input', {
    type: 'text',
    placeholder: 'Type a command or add a task...',
  })
  fields.appendChild(input)
  bar.appendChild(fields)
  const hint = el(doc, 'span', { 'data-shortcut-hint': '' }, 'CMD + K')
  bar.appendChild(hint)
  return bar
}

export async function mountApp(container: HTMLElement): Promise<void> {
  const doc = container.ownerDocument
  container.innerHTML = ''
  const shell = el(doc, 'div', { 'data-app-shell': '' })

  shell.appendChild(renderTopAppBar(doc))

  const body = el(doc, 'div', { 'data-app-body': '' })
  body.appendChild(renderSidebar(doc))

  const main = el(doc, 'main', { 'data-main': '' })
  const tasks = await window.todoz.readTodos()
  const sorted = [...tasks].sort(compareDue)
  const remaining = sorted.filter((t) => t.status !== 'done').length

  main.appendChild(renderMainHeader(doc, remaining))
  main.appendChild(renderTaskCard(doc, sorted))
  main.appendChild(renderCommandBar(doc))

  body.appendChild(main)
  shell.appendChild(body)
  container.appendChild(shell)
}

// Backwards-compatible thin renderer for the existing TodoList tests.
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

    list.appendChild(item)
  })
}
