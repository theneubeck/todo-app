import type { Task } from './data/parseTodo'
import { toggleParent, toggleSubtask } from './data/writeTodo'
import { parseAddCommand } from './data/parseAddCommand'
import { buildTaskFile } from './data/buildTaskFile'

declare global {
  interface Window {
    todoz: {
      readTodos: () => Promise<Task[]>
      writeFile: (filePath: string, content: string) => Promise<void>
      runOllama: (prompt: string) => Promise<string>
      today?: string
    }
  }
}

export const PULSE_DURATION_MS = 600

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

// ----- Filter & sidebar state -----

type Filter =
  | { kind: 'inbox' }
  | { kind: 'tag'; value: string } // value: bare slug for project tags ("errands"); "@mike" for people

function filterMatchesTask(filter: Filter, task: Task): boolean {
  if (filter.kind === 'inbox') return true
  return task.tags.includes(filter.value)
}

function filterLabel(filter: Filter): string {
  if (filter.kind === 'inbox') return 'Inbox'
  if (filter.value.startsWith('@')) return filter.value
  return `#${filter.value}`
}

function entryKeyForFilter(filter: Filter): string {
  if (filter.kind === 'inbox') return 'inbox'
  return filter.value
}

function filterFromEntryKey(key: string): Filter {
  if (key === 'inbox') return { kind: 'inbox' }
  return { kind: 'tag', value: key }
}

// ----- Sidebar rendering -----

type PrimaryEntry = {
  key: string
  label: string
  icon: string
}

const PRIMARY_ENTRIES: PrimaryEntry[] = [
  { key: 'chat', label: 'Chat', icon: 'chat_bubble' },
  { key: 'inbox', label: 'Inbox', icon: 'inbox' },
  { key: 'today', label: 'Today', icon: 'today' },
  { key: 'upcoming', label: 'Upcoming', icon: 'calendar_month' },
]

function renderPrimaryEntry(
  doc: Document,
  entry: PrimaryEntry,
  active: boolean
): HTMLElement {
  const attrs: Record<string, string> = {
    href: '#',
    'data-nav-entry': '',
    'data-sidebar-entry': entry.key,
  }
  if (active) attrs['data-nav-active'] = 'true'
  const a = el(doc, 'a', attrs)
  a.appendChild(icon(doc, entry.icon))
  const text = el(doc, 'span', { 'data-nav-label': '' }, entry.label)
  a.appendChild(text)
  return a
}

function renderTagEntry(
  doc: Document,
  key: string,
  visibleLabel: string,
  iconName: string,
  active: boolean
): HTMLElement {
  const attrs: Record<string, string> = {
    href: '#',
    'data-sidebar-entry': key,
  }
  if (active) attrs['data-nav-active'] = 'true'
  const a = el(doc, 'a', attrs)
  a.appendChild(icon(doc, iconName))
  const text = el(doc, 'span', { 'data-nav-label': '' }, visibleLabel)
  a.appendChild(text)
  return a
}

function uniqueTags(tasks: Task[]): { projects: string[]; people: string[] } {
  const projects = new Set<string>()
  const people = new Set<string>()
  for (const t of tasks) {
    for (const raw of t.tags) {
      const tag = String(raw)
      if (tag.startsWith('@')) people.add(tag.toLowerCase())
      else projects.add(tag.toLowerCase())
    }
  }
  return {
    projects: Array.from(projects).sort(),
    people: Array.from(people).sort(),
  }
}

function renderSidebar(
  doc: Document,
  tasks: Task[],
  activeFilter: Filter
): HTMLElement {
  const aside = el(doc, 'aside', { 'data-sidebar': '' })
  const activeKey = entryKeyForFilter(activeFilter)
  for (const entry of PRIMARY_ENTRIES) {
    const isActive = entry.key === activeKey
    aside.appendChild(renderPrimaryEntry(doc, entry, isActive))
  }

  const { projects, people } = uniqueTags(tasks)

  const projectsSection = el(doc, 'div', {
    'data-section': 'projects',
  })
  projectsSection.appendChild(
    el(doc, 'h3', { 'data-section-header': '' }, 'PROJECTS')
  )
  for (const tag of projects) {
    const isActive = activeKey === tag
    projectsSection.appendChild(
      renderTagEntry(doc, tag, `#${tag}`, 'tag', isActive)
    )
  }
  aside.appendChild(projectsSection)

  const peopleSection = el(doc, 'div', { 'data-section': 'people' })
  peopleSection.appendChild(el(doc, 'h3', { 'data-section-header': '' }, 'PEOPLE'))
  for (const handle of people) {
    const isActive = activeKey === handle
    peopleSection.appendChild(
      renderTagEntry(doc, handle, handle, 'alternate_email', isActive)
    )
  }
  aside.appendChild(peopleSection)

  return aside
}

function renderMainHeader(
  doc: Document,
  remaining: number,
  activeFilter: Filter
): HTMLElement {
  const header = el(doc, 'div', { 'data-main-header': '' })
  const inner = el(doc, 'div')
  const h1 = el(doc, 'h1', {}, filterLabel(activeFilter))
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
  const tag = task.tags[0]
  const label = tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : 'Task'
  const attrs: Record<string, string> = { 'data-chip': '' }
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

// ----- Helpers -----

function todayIso(): string {
  if (typeof window !== 'undefined' && window.todoz?.today) return window.todoz.today
  return new Date().toISOString().slice(0, 10)
}

function splitPath(filePath: string): { dir: string; filename: string } {
  const idx = filePath.lastIndexOf('/')
  if (idx === -1) return { dir: '', filename: filePath }
  return { dir: filePath.slice(0, idx), filename: filePath.slice(idx + 1) }
}

function existingFilenamesFromTasks(tasks: Task[]): string[] {
  return tasks.map((t) => splitPath(t.filePath).filename)
}

function vaultDir(tasks: Task[]): string {
  // Derive the vault todos directory from any existing task. When the vault is
  // empty we fall back to a relative path so writeFile still receives a sensible
  // value; the production main process uses absolute paths.
  for (const t of tasks) {
    const { dir } = splitPath(t.filePath)
    if (dir) return dir
  }
  return 'vault/todos'
}

// ----- Mount + interactions -----

export async function mountApp(container: HTMLElement): Promise<void> {
  const doc = container.ownerDocument
  container.innerHTML = ''

  let tasks = await window.todoz.readTodos()
  let activeFilter: Filter = { kind: 'inbox' }

  const shell = el(doc, 'div', { 'data-app-shell': '' })
  shell.appendChild(renderTopAppBar(doc))
  const body = el(doc, 'div', { 'data-app-body': '' })
  shell.appendChild(body)
  container.appendChild(shell)

  function visibleTasks(): Task[] {
    return [...tasks]
      .filter((t) => filterMatchesTask(activeFilter, t))
      .sort(compareDue)
  }

  function fullRender(): void {
    body.innerHTML = ''
    const sidebar = renderSidebar(doc, tasks, activeFilter)
    body.appendChild(sidebar)
    bindSidebarClicks(sidebar)

    const main = el(doc, 'main', { 'data-main': '' })
    const visible = visibleTasks()
    const remaining = visible.filter((t) => t.status !== 'done').length
    main.appendChild(renderMainHeader(doc, remaining, activeFilter))
    main.appendChild(renderTaskCard(doc, visible))
    main.appendChild(renderCommandBar(doc))
    bindCommandBar(main)
    body.appendChild(main)
  }

  function bindSidebarClicks(sidebar: HTMLElement): void {
    const entries = sidebar.querySelectorAll('[data-sidebar-entry]')
    entries.forEach((entry) => {
      const key = entry.getAttribute('data-sidebar-entry') as string
      // Today / Upcoming / Chat are inert in this feature.
      if (key === 'today' || key === 'upcoming' || key === 'chat') return
      entry.addEventListener('click', (e) => {
        e.preventDefault()
        activeFilter = filterFromEntryKey(key)
        fullRender()
      })
    })
  }

  function pulseEntries(keys: string[]): void {
    const sidebar = body.querySelector('[data-sidebar]') as HTMLElement
    for (const key of keys) {
      const node = sidebar.querySelector(
        `[data-sidebar-entry="${cssEscape(key)}"]`
      )
      if (node) node.setAttribute('data-pulsing', 'true')
    }
    setTimeout(() => {
      const live = body.querySelector('[data-sidebar]') as HTMLElement
      live
        .querySelectorAll('[data-sidebar-entry][data-pulsing="true"]')
        .forEach((n) => n.removeAttribute('data-pulsing'))
    }, PULSE_DURATION_MS)
  }

  function bindCommandBar(main: HTMLElement): void {
    const input = main.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement | null
    if (!input) return
    input.addEventListener('keydown', async (e) => {
      const ke = e as KeyboardEvent
      if (ke.key !== 'Enter') return
      const command = parseAddCommand(input.value)
      if (!command) {
        // No-op — preserve input value, do not clear, do not pulse.
        return
      }
      const today = todayIso()
      const dir = vaultDir(tasks)
      const existing = existingFilenamesFromTasks(tasks)
      const built = buildTaskFile({
        title: command.title,
        tags: command.tags,
        today,
        existingFilenames: existing,
      })
      const filePath = dir ? `${dir}/${built.filename}` : built.filename
      await window.todoz.writeFile(filePath, built.content)
      // Append the new task in-memory so we don't depend on an async re-read.
      const newTask: Task = {
        slug: built.filename.replace(/\.md$/, '').replace(/-\d{4}-\d{2}-\d{2}$/, ''),
        filePath,
        title: command.title,
        status: 'todo',
        tags: command.tags,
        created: today,
        raw: built.content,
        subtasks: [],
      }
      tasks = [...tasks, newTask]
      input.value = ''
      // Re-render to surface new sidebar entries / counts.
      fullRender()
      // Pulse entries for the just-added task: always Inbox; plus each tag entry.
      const pulseKeys = ['inbox', ...command.tags]
      pulseEntries(pulseKeys)
    })
  }

  // Document-level cmd+i listener (does not depend on input being focused).
  doc.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent
    if (ke.metaKey && (ke.key === 'i' || ke.key === 'I')) {
      ke.preventDefault()
      const input = body.querySelector(
        '[data-command-bar] input[type="text"]'
      ) as HTMLInputElement | null
      if (!input) return
      input.value = '/add '
      input.focus()
    }
  })

  fullRender()
}

// Minimal CSS.escape replacement — JSDOM doesn't always expose it.
function cssEscape(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`)
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
