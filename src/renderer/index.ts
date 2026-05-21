import type { Task } from './data/parseTodo'
import {
  toggleParent,
  toggleSubtask,
  removeSubtask,
  addSubtask,
} from './data/writeTodo'
import { parseAddCommand } from './data/parseAddCommand'
import { parseGotoCommand } from './data/parseGotoCommand'
import { parseFocusCommand } from './data/parseFocusCommand'
import type { Focus } from './data/parseFocusCommand'
import { buildTaskFile } from './data/buildTaskFile'
import { vaultDir } from './data/vaultDir'
import { mountVaultPicker } from './views/VaultPicker'
import { mountSettingsPanel } from './views/SettingsPanel'
import { mountAutocompleteDropdown } from './views/AutocompleteDropdown'
import type { TearDown } from './views/AutocompleteDropdown'
import type { AppSettings, AppSettingKey } from '../main/appSettings'

export type ToolEvent = {
  callId: string
  name: string
  argsRaw: string
  status: 'ok' | 'error'
  resultContent: string
  action?: string
  error?: string
}

export type OllamaResult =
  | { ok: true; reply: string; toolEvents?: ToolEvent[] }
  | { ok: false; error: string; statusCode: number; toolEvents?: ToolEvent[] }

declare global {
  interface Window {
    todoz: {
      readTodos: () => Promise<Task[]>
      writeFile: (filePath: string, content: string) => Promise<void>
      archiveFile?: (filename: string) => Promise<void>
      runOllama: (prompt: string) => Promise<OllamaResult | string>
      today?: string
      readToday?: () => Promise<string[]>
      writeToday?: (slugs: string[]) => Promise<void>
      getVaultConfig?: () => Promise<{
        lastOpened: string | null
        recents: string[]
      }>
      openFolderPicker?: () => Promise<string | null>
      createVault?: (vaultPath: string) => Promise<void>
      setActiveVault?: (vaultPath: string) => Promise<void>
      removeRecent?: (vaultPath: string) => Promise<void>
      getAppSettings?: () => Promise<AppSettings>
      setAppSetting?: (key: AppSettingKey, value: boolean) => Promise<void>
      readFocuses?: () => Promise<Focus[]>
      writeFocuses?: (focuses: Focus[]) => Promise<void>
    }
  }
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  showChat: false,
  showToday: true,
  showUpcoming: true,
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
  const brand = el(doc, 'span', { 'data-brand': '' }, 'TODO')
  left.appendChild(brand)
  header.appendChild(left)

  const actions = el(doc, 'div', { 'data-app-bar-actions': '' })
  const addBtn = el(doc, 'button', { type: 'button', 'aria-label': 'Add' })
  addBtn.appendChild(icon(doc, 'add'))
  actions.appendChild(addBtn)

  const settingsBtn = el(doc, 'button', {
    type: 'button',
    'aria-label': 'Settings',
    'data-app-bar-settings': '',
  })
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
  | { kind: 'today' }
  | { kind: 'upcoming' }
  | { kind: 'tag'; value: string } // value: bare slug for project tags ("errands"); "@mike" for people
  | { kind: 'focus-board' }
  | { kind: 'focus'; id: string; tags: string[] }

function filterMatchesTask(filter: Filter, task: Task, today: string): boolean {
  if (filter.kind === 'inbox') return true
  if (filter.kind === 'today') return task.due !== undefined && task.due <= today
  if (filter.kind === 'upcoming') return task.due !== undefined && task.status !== 'done'
  if (filter.kind === 'focus-board') return false
  /* istanbul ignore next */
  if (filter.kind === 'focus') {
    return filter.tags.some((tag) => task.tags.includes(tag)) && task.status !== 'done'
  }
  return task.tags.includes(filter.value)
}

function filterLabel(filter: Filter, focuses: Focus[] = []): string {
  if (filter.kind === 'inbox') return 'Inbox'
  if (filter.kind === 'today') return 'Today'
  if (filter.kind === 'upcoming') return 'Upcoming'
  if (filter.kind === 'focus-board') return 'Focus'
  /* istanbul ignore next */
  if (filter.kind === 'focus') {
    const found = focuses.find((f) => f.id === filter.id)
    return found ? found.name : 'Focus'
  }
  if (filter.value === ':read') return 'To Read'
  if (filter.value === ':watch') return 'To Watch'
  if (filter.value.startsWith('@')) return filter.value
  return `#${filter.value}`
}

function entryKeyForFilter(filter: Filter): string {
  if (filter.kind === 'inbox') return 'inbox'
  if (filter.kind === 'today') return 'today'
  if (filter.kind === 'upcoming') return 'upcoming'
  if (filter.kind === 'focus-board') return 'focus'
  if (filter.kind === 'focus') return 'focus'
  return filter.value
}

function filterFromEntryKey(key: string): Filter {
  if (key === 'inbox') return { kind: 'inbox' }
  if (key === 'today') return { kind: 'today' }
  if (key === 'upcoming') return { kind: 'upcoming' }
  if (key === 'focus') return { kind: 'focus-board' }
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
  { key: 'focus', label: 'Focus', icon: 'hub' },
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

function uniqueTags(tasks: Task[]): { projects: string[]; people: string[]; resources: string[] } {
  const projects = new Set<string>()
  const people = new Set<string>()
  for (const t of tasks) {
    for (const raw of t.tags) {
      const tag = String(raw)
      if (tag.startsWith('@')) people.add(tag.toLowerCase())
      else if (tag.startsWith(':')) { /* resource tags never go into projects */ }
      else projects.add(tag.toLowerCase())
    }
  }
  return {
    projects: Array.from(projects).sort(),
    people: Array.from(people).sort(),
    resources: [':read', ':watch'],
  }
}

function isPrimaryEntryEnabled(
  entry: PrimaryEntry,
  settings: AppSettings
): boolean {
  if (entry.key === 'inbox') return true
  if (entry.key === 'focus') return true
  if (entry.key === 'chat') return settings.showChat
  if (entry.key === 'today') return settings.showToday
  if (entry.key === 'upcoming') return settings.showUpcoming
  /* istanbul ignore next */
  return true
}

function renderSidebar(
  doc: Document,
  tasks: Task[],
  activeFilter: Filter,
  settings: AppSettings,
  chatActive: boolean
): HTMLElement {
  const aside = el(doc, 'aside', { 'data-sidebar': '' })
  const activeKey = chatActive ? 'chat' : entryKeyForFilter(activeFilter)
  for (const entry of PRIMARY_ENTRIES) {
    if (!isPrimaryEntryEnabled(entry, settings)) continue
    const isActive = entry.key === activeKey
    aside.appendChild(renderPrimaryEntry(doc, entry, isActive))
  }

  const { projects, people } = uniqueTags(tasks)

  if (projects.length > 0) {
    const projectsSection = el(doc, 'div', {
      'data-section': 'projects',
    })
    projectsSection.appendChild(
      el(doc, 'h3', { 'data-section-header': '' }, 'PROJECTS')
    )
    for (const tag of projects) {
      const isActive = activeKey === tag
      projectsSection.appendChild(
        renderTagEntry(doc, tag, tag, 'tag', isActive)
      )
    }
    aside.appendChild(projectsSection)
  }

  if (people.length > 0) {
    const peopleSection = el(doc, 'div', { 'data-section': 'people' })
    peopleSection.appendChild(
      el(doc, 'h3', { 'data-section-header': '' }, 'PEOPLE')
    )
    for (const handle of people) {
      const isActive = activeKey === handle
      peopleSection.appendChild(
        renderTagEntry(doc, handle, handle.slice(1), 'alternate_email', isActive)
      )
    }
    aside.appendChild(peopleSection)
  }

  // RESOURCES section — always present, two fixed entries
  const resourcesSection = el(doc, 'div', { 'data-section': 'resources' })
  resourcesSection.appendChild(
    el(doc, 'h3', { 'data-section-header': '' }, 'RESOURCES')
  )
  resourcesSection.appendChild(
    renderTagEntry(doc, ':read', 'To Read', 'bookmark', activeKey === ':read')
  )
  resourcesSection.appendChild(
    renderTagEntry(doc, ':watch', 'To Watch', 'play_circle', activeKey === ':watch')
  )
  aside.appendChild(resourcesSection)

  return aside
}

function renderMainHeader(
  doc: Document,
  remaining: number,
  activeFilter: Filter,
  onClearAll?: () => void
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
  if (onClearAll && remaining > 0) {
    const clearAll = el(doc, 'button', { type: 'button', 'data-today-clear-all': '' }, 'Clear all')
    clearAll.addEventListener('click', onClearAll)
    inner.appendChild(clearAll)
  }
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

type RenderContext = {
  onParentToggle: (task: Task) => Promise<void>
  onExpandToggle: (task: Task) => void
  onSubtaskToggle: (task: Task, subIndex: number) => Promise<void>
  onTopLevelRemove: (task: Task) => Promise<void>
  onSubtaskRemove: (task: Task, subIndex: number) => Promise<void>
  onAddSubtaskSubmit: (task: Task, text: string) => Promise<void>
  closeAllConfirms: () => void
  /** When set, the task row shows an add-to-today icon. */
  onAddToToday?: (task: Task) => Promise<void>
  /** Updates the task's due date in memory and re-renders. Pass undefined to clear. */
  onSetDue: (slug: string, due: string | undefined, raw: string) => void
}

function renderAddSubtaskAffordance(
  doc: Document,
  task: Task,
  ctx: RenderContext
): HTMLElement {
  const span = el(
    doc,
    'span',
    { 'data-add-subtask': '', role: 'button' },
    '+ Add subtask'
  )
  span.addEventListener('click', (e) => {
    e.stopPropagation()
    const parent = span.parentNode
    if (!parent) return
    const input = doc.createElement('input') as HTMLInputElement
    input.type = 'text'
    input.setAttribute('data-add-subtask-input', '')
    parent.replaceChild(input, span)
    input.focus()
    input.addEventListener('keydown', async (ke) => {
      const evt = ke as KeyboardEvent
      if (evt.key === 'Enter') {
        evt.preventDefault()
        const trimmed = input.value.trim()
        if (trimmed.length === 0) {
          // Tear down without writing.
          const fresh = renderAddSubtaskAffordance(doc, task, ctx)
          if (input.parentNode) input.parentNode.replaceChild(fresh, input)
          return
        }
        await ctx.onAddSubtaskSubmit(task, trimmed)
      } else if (evt.key === 'Escape') {
        evt.preventDefault()
        const fresh = renderAddSubtaskAffordance(doc, task, ctx)
        if (input.parentNode) input.parentNode.replaceChild(fresh, input)
      }
    })
  })
  return span
}

function removeDueFromRaw(raw: string): string {
  const lines = raw.split('\n')
  let openIdx = -1
  let closeIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (openIdx === -1) openIdx = i
      else { closeIdx = i; break }
    }
  }
  /* istanbul ignore next */
  if (openIdx === -1 || closeIdx === -1) return raw
  const fmLines = lines.slice(openIdx + 1, closeIdx).filter((l) => !/^due:\s*/.test(l))
  return [...lines.slice(0, openIdx + 1), ...fmLines, ...lines.slice(closeIdx)].join('\n')
}

function setDueInRaw(raw: string, due: string): string {
  // Split the raw content into lines and locate the frontmatter block.
  const lines = raw.split('\n')
  // Find the opening and closing '---' delimiters.
  let openIdx = -1
  let closeIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (openIdx === -1) {
        openIdx = i
      } else {
        closeIdx = i
        break
      }
    }
  }
  if (openIdx === -1 || closeIdx === -1) return raw

  const fmLines = lines.slice(openIdx + 1, closeIdx)
  const dueLineIdx = fmLines.findIndex((l) => /^due:\s*/.test(l))
  if (dueLineIdx !== -1) {
    fmLines[dueLineIdx] = `due: ${due}`
  } else {
    // Insert after the `status:` line.
    const statusIdx = fmLines.findIndex((l) => /^status:\s*/.test(l))
    const insertAt = statusIdx !== -1 ? statusIdx + 1 : fmLines.length
    fmLines.splice(insertAt, 0, `due: ${due}`)
  }
  return [
    ...lines.slice(0, openIdx + 1),
    ...fmLines,
    ...lines.slice(closeIdx),
  ].join('\n')
}

function tearDownConfirm(doc: Document): void {
  doc.querySelectorAll('[data-confirm]').forEach((el) => el.remove())
}

function renderConfirm(
  doc: Document,
  onYes: () => void,
  onNo: () => void
): HTMLElement {
  const wrap = el(doc, 'span', { 'data-confirm': '' })
  const label = el(doc, 'span', { 'data-confirm-label': '' }, 'Remove?')
  wrap.appendChild(label)
  const noBtn = el(
    doc,
    'button',
    { type: 'button', 'data-confirm-no': '' },
    'No'
  )
  const yesBtn = el(
    doc,
    'button',
    { type: 'button', 'data-confirm-yes': '' },
    'Yes'
  )
  wrap.appendChild(noBtn)
  wrap.appendChild(yesBtn)
  noBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    onNo()
  })
  yesBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    onYes()
  })
  return wrap
}

function renderSubtaskRow(
  doc: Document,
  task: Task,
  sub: Task['subtasks'][number],
  ctx: RenderContext
): HTMLElement {
  const li = el(doc, 'li', {
    'data-subtask': String(sub.index),
    'data-subtask-done': sub.done ? 'true' : 'false',
  })
  const cbWrap = el(doc, 'div', {
    'data-checkbox-wrapper': '',
    'data-checked': sub.done ? 'true' : 'false',
  })
  const cb = el(doc, 'input', { type: 'checkbox' }) as HTMLInputElement
  cb.checked = sub.done
  cbWrap.appendChild(cb)
  li.appendChild(cbWrap)

  // Single visible label carries both legacy ([data-subtask-label],
  // [data-strikethrough]) and new ([data-subtask-title], [data-completed])
  // attributes so existing tests and the new contract both query it.
  const labelAttrs: Record<string, string> = {
    'data-subtask-label': '',
    'data-subtask-title': '',
  }
  if (sub.done) {
    labelAttrs['data-strikethrough'] = 'true'
    labelAttrs['data-completed'] = 'true'
  }
  const label = el(doc, 'span', labelAttrs, sub.label)
  li.appendChild(label)

  const removeBtn = el(doc, 'span', { 'data-remove': 'subtask', role: 'button', 'aria-label': 'Remove subtask' })
  removeBtn.appendChild(icon(doc, 'close'))
  li.appendChild(removeBtn)

  cb.addEventListener('click', async (e) => {
    e.stopPropagation()
    await ctx.onSubtaskToggle(task, sub.index)
  })
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    ctx.closeAllConfirms()
    const confirm = renderConfirm(
      doc,
      async () => {
        tearDownConfirm(doc)
        await ctx.onSubtaskRemove(task, sub.index)
      },
      () => {
        tearDownConfirm(doc)
      }
    )
    li.appendChild(confirm)
  })
  return li
}

function renderSubtasks(doc: Document, task: Task, ctx: RenderContext): HTMLElement {
  const ul = el(doc, 'ul', {
    'data-subtasks': '',
    'data-subtask-list': '',
    'data-guide-line': '',
  })
  task.subtasks.forEach((sub) => {
    ul.appendChild(renderSubtaskRow(doc, task, sub, ctx))
  })
  ul.appendChild(renderAddSubtaskAffordance(doc, task, ctx))
  return ul
}

function renderTaskRow(
  doc: Document,
  task: Task,
  expanded: boolean,
  ctx: RenderContext
): HTMLElement {
  const isCombined = task.subtasks.length > 0
  const kind = isCombined ? 'combined' : 'simple'
  const item = el(doc, 'li', {
    'data-task': task.slug,
    'data-task-status': task.status,
    'data-kind': kind,
    'data-expanded': expanded ? 'true' : 'false',
  })

  const row = el(doc, 'div', { 'data-task-row': '' })

  if (isCombined) {
    const chevron = icon(doc, 'keyboard_arrow_right')
    chevron.setAttribute('data-chevron', '')
    row.appendChild(chevron)
  } else {
    const cbWrap = el(doc, 'div', {
      'data-checkbox-wrapper': '',
      'data-checked': task.status === 'done' ? 'true' : 'false',
    })
    const cb = el(doc, 'input', { type: 'checkbox' }) as HTMLInputElement
    cb.checked = task.status === 'done'
    cbWrap.appendChild(cb)
    row.appendChild(cbWrap)
    cb.addEventListener('click', async (e) => {
      e.stopPropagation()
      await ctx.onParentToggle(task)
    })
  }

  const titleAttrs: Record<string, string> = { 'data-task-title': '' }
  const simpleDone = !isCombined && task.status === 'done'
  const allSubtasksDone =
    isCombined && task.subtasks.every((s) => s.done)
  if (simpleDone || allSubtasksDone) {
    titleAttrs['data-completed'] = 'true'
  }
  const title = el(doc, 'span', titleAttrs, task.title)
  row.appendChild(title)

  if (task.due) {
    const due = el(doc, 'span', { 'data-task-due': '' }, task.due)
    row.appendChild(due)
  }

  row.appendChild(chipForTask(doc, task))

  if (ctx.onAddToToday) {
    const addToTodayHandler = ctx.onAddToToday
    row.appendChild(
      renderAddToTodayIcon(doc, () => {
        void addToTodayHandler(task)
      })
    )
  }

  // Calendar icon — set due date affordance
  const setDueBtn = el(doc, 'span', {
    'data-set-due': '',
    role: 'button',
    'aria-label': 'Set due date',
  })
  setDueBtn.appendChild(icon(doc, 'calendar_month'))
  row.appendChild(setDueBtn)

  setDueBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    // Remove any existing due input in the whole doc first.
    doc.querySelectorAll('[data-due-input]').forEach((n) => n.remove())
    const input = el(doc, 'input', {
      type: 'date',
      'data-due-input': '',
    }) as HTMLInputElement
    if (task.due) input.value = task.due
    row.appendChild(input)
    input.focus()

    async function saveDue(): Promise<void> {
      const due = input.value || undefined
      input.remove()
      if (due === task.due) return
      const updatedRaw = due ? setDueInRaw(task.raw, due) : removeDueFromRaw(task.raw)
      await window.todoz.writeFile(task.filePath, updatedRaw)
      ctx.onSetDue(task.slug, due, updatedRaw)
    }

    // change fires when the native date picker selection is confirmed —
    // keydown Enter does not fire in that case.
    input.addEventListener('change', saveDue)

    input.addEventListener('keydown', async (ke) => {
      if (ke.key === 'Enter') {
        ke.preventDefault()
        ke.stopPropagation()
        await saveDue()
      } else if (ke.key === 'Escape') {
        ke.preventDefault()
        ke.stopPropagation()
        input.remove()
      }
    })
  })

  const removeBtn = el(
    doc,
    'span',
    { 'data-remove': '', role: 'button', 'aria-label': 'Remove task' }
  )
  removeBtn.appendChild(icon(doc, 'close'))
  row.appendChild(removeBtn)

  if (isCombined) {
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null
      if (target && target.closest('[data-remove]')) {
        /* istanbul ignore next */
        return
      }
      if (target && target.closest('[data-set-due]')) {
        /* istanbul ignore next */
        return
      }
      ctx.onExpandToggle(task)
    })
  }

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    ctx.closeAllConfirms()
    const confirm = renderConfirm(
      doc,
      async () => {
        tearDownConfirm(doc)
        await ctx.onTopLevelRemove(task)
      },
      () => {
        tearDownConfirm(doc)
      }
    )
    row.appendChild(confirm)
  })

  item.appendChild(row)

  if (expanded && isCombined) {
    item.appendChild(renderSubtasks(doc, task, ctx))
  } else if (!isCombined) {
    item.appendChild(renderAddSubtaskAffordance(doc, task, ctx))
  }

  return item
}

function renderTaskCard(
  doc: Document,
  tasks: Task[],
  expandedSlugs: Set<string>,
  ctx: RenderContext
): HTMLElement {
  const card = el(doc, 'div', {
    'data-task-card': '',
    'data-view': 'todo-list',
  })
  const list = el(doc, 'ul', { 'data-task-list': '' })
  if (tasks.length > 0) {
    list.appendChild(el(doc, 'h3', { 'data-group-heading': '' }, 'TASKS'))
  }
  const dued = tasks.filter((t) => !!t.due)
  const undued = tasks.filter((t) => !t.due)
  const ordered = [...dued, ...undued]
  ordered.forEach((task) => {
    const expanded = expandedSlugs.has(task.slug)
    list.appendChild(renderTaskRow(doc, task, expanded, ctx))
  })
  card.appendChild(list)
  return card
}

function renderTodayList(
  doc: Document,
  slugs: string[],
  allTasks: Task[],
  onCheckboxToggle: (slug: string, task: Task) => Promise<void>,
  onRemove: (slug: string) => Promise<void>
): HTMLElement {
  const container = el(doc, 'div', { 'data-today-list': '' })

  if (slugs.length === 0) {
    const empty = el(
      doc,
      'p',
      { 'data-today-empty': '' },
      "Your Today list is empty. Add tasks using the today icon on any task row."
    )
    container.appendChild(empty)
    return container
  }

  // Build a map from full-slug (e.g. "today-flow-task-a-2026-05-18") to Task.
  // Task.slug strips the date suffix, so we match by filePath filename stem.
  const slugToTask = new Map<string, Task>()
  for (const task of allTasks) {
    // Derive the full slug (filename without .md) from filePath
    const fp = task.filePath
    const lastSlash = fp.lastIndexOf('/')
    const filename = lastSlash === -1 ? fp : fp.slice(lastSlash + 1)
    const fullSlug = filename.endsWith('.md') ? filename.slice(0, -3) : filename
    slugToTask.set(fullSlug, task)
  }

  for (const slug of slugs) {
    const task = slugToTask.get(slug)
    const rowAttrs: Record<string, string> = {
      'data-today-row': '',
      'data-slug': slug,
    }
    const row = el(doc, 'div', rowAttrs)

    // Checkbox
    const cbWrap = el(doc, 'div', {
      'data-checkbox-wrapper': '',
      'data-checked': task?.status === 'done' ? 'true' : 'false',
    })
    const cb = el(doc, 'input', { type: 'checkbox' }) as HTMLInputElement
    cb.checked = task !== undefined && task.status === 'done'
    cbWrap.appendChild(cb)
    row.appendChild(cbWrap)

    // Title
    const titleText = task ? task.title : slug
    const title = el(doc, 'span', { 'data-task-title': '' }, titleText)
    row.appendChild(title)

    // Tag chip
    if (task && task.tags.length > 0) {
      row.appendChild(chipForTask(doc, task))
    }

    // Remove-from-today icon
    row.appendChild(
      renderRemoveFromTodayIcon(doc, () => {
        void onRemove(slug)
      })
    )

    if (task) {
      cb.addEventListener('click', (e) => {
        e.stopPropagation()
        void onCheckboxToggle(slug, task)
      })
    }

    container.appendChild(row)
  }

  return container
}

function renderUpcomingList(doc: Document, tasks: Task[]): HTMLElement {
  const container = el(doc, 'div', { 'data-upcoming-list': '' })

  // Filter: only incomplete tasks with a due field, sorted ascending
  const dueTasks = tasks
    .filter((t) => t.due !== undefined && t.status !== 'done')
    .sort(compareDue)

  if (dueTasks.length === 0) {
    const empty = el(doc, 'p', { 'data-upcoming-empty': '' }, 'No upcoming deadlines.')
    container.appendChild(empty)
    return container
  }

  for (const task of dueTasks) {
    const row = el(doc, 'div', {
      'data-upcoming-row': '',
      'data-slug': task.slug,
    })

    // Line 1: task title
    const titleSpan = el(doc, 'span', { 'data-task-title': '' }, task.title)
    row.appendChild(titleSpan)

    // Line 2: due-date row with icon, date, and optional tag chip
    const dueRow = el(doc, 'div', { 'data-due-row': '' })
    dueRow.appendChild(icon(doc, 'calendar_month'))
    dueRow.appendChild(el(doc, 'span', { 'data-due-date': '' }, task.due as string))
    if (task.tags.length > 0) {
      dueRow.appendChild(el(doc, 'span', { 'data-tag-chip': '' }, task.tags[0]))
    }
    row.appendChild(dueRow)

    container.appendChild(row)
  }

  return container
}

function renderAddToTodayIcon(doc: Document, onAddToToday: () => void): HTMLElement {
  const btn = el(doc, 'span', {
    'data-add-to-today': '',
    role: 'button',
    'aria-label': 'Add to Today',
  })
  btn.appendChild(icon(doc, 'today'))
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    onAddToToday()
  })
  return btn
}

function renderRemoveFromTodayIcon(doc: Document, onRemove: () => void): HTMLElement {
  const btn = el(doc, 'span', {
    'data-remove-from-today': '',
    role: 'button',
    'aria-label': 'Remove from Today',
  })
  btn.appendChild(icon(doc, 'close'))
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    onRemove()
  })
  return btn
}

function openFocusEditForm(doc: Document, card: HTMLElement, focus: Focus, onSave: (updated: Focus) => void, onCancel: () => void): void {
  card.innerHTML = ''

  // Wrap everything so any click inside the form stays inside and never reaches
  // the card's navigation click handler.
  const form = el(doc, 'div', { 'data-focus-form': '' })
  form.addEventListener('click', (e) => e.stopPropagation())

  const nameInput = el(doc, 'input', {
    type: 'text',
    'data-focus-edit-name': '',
    placeholder: 'Name',
  }) as HTMLInputElement
  nameInput.value = focus.name

  const tagsInput = el(doc, 'input', {
    type: 'text',
    'data-focus-edit-tags': '',
    placeholder: '#tag1 #tag2',
  }) as HTMLInputElement
  tagsInput.value = focus.tags.join(' ')

  const saveBtn = el(doc, 'button', { 'data-focus-save': '' }, 'Save')
  const cancelBtn = el(doc, 'button', { 'data-focus-cancel': '' }, 'Cancel')
  const actions = el(doc, 'div', { 'data-focus-edit-actions': '' })
  actions.appendChild(saveBtn)
  actions.appendChild(cancelBtn)

  form.appendChild(nameInput)
  form.appendChild(tagsInput)
  form.appendChild(actions)
  card.appendChild(form)
  nameInput.focus()

  function parseAndSave(): void {
    const name = nameInput.value.trim()
    if (!name) { onCancel(); return }
    const tags = tagsInput.value
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, '').toLowerCase())
      .filter((t) => t.length > 0)
    onSave({ ...focus, name, tags })
  }

  function onKeyDown(e: Event): void {
    const ke = e as KeyboardEvent
    if (ke.key === 'Escape') { ke.preventDefault(); onCancel() }
  }

  nameInput.addEventListener('keydown', onKeyDown)
  tagsInput.addEventListener('keydown', onKeyDown)
  saveBtn.addEventListener('click', parseAndSave)
  cancelBtn.addEventListener('click', onCancel)
}

function renderFocusBoard(
  doc: Document,
  focuses: Focus[],
  onCardClick: (focus: Focus) => void,
  onSaveFocus: (updated: Focus) => void,
  onCancelEdit: () => void
): HTMLElement {
  const container = el(doc, 'div', { 'data-focus-board': '' })
  if (focuses.length === 0) {
    const empty = el(doc, 'div', { 'data-focus-empty': '' }, 'No focuses yet.')
    container.appendChild(empty)
  }
  for (const focus of focuses) {
    const card = el(doc, 'div', {
      'data-focus-card': '',
      'data-focus-id': focus.id,
    })
    const nameEl = el(doc, 'span', { 'data-focus-name': '' }, focus.name)
    card.appendChild(nameEl)
    for (const tag of focus.tags) {
      const tagEl = el(doc, 'span', { 'data-focus-tag': '' }, tag)
      card.appendChild(tagEl)
    }
    // Edit icon — hover-reveal, top-right of card.
    const editBtn = el(doc, 'span', { 'data-focus-edit': '', role: 'button', 'aria-label': 'Edit focus' })
    editBtn.appendChild(icon(doc, 'edit'))
    card.appendChild(editBtn)
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      openFocusEditForm(doc, card, focus, onSaveFocus, onCancelEdit)
    })
    card.addEventListener('click', () => onCardClick(focus))
    container.appendChild(card)
  }
  // Create-focus affordance — always shown as a dashed card at the end.
  const createCard = el(doc, 'div', { 'data-create-focus': '', role: 'button' }, '+ Create focus')
  createCard.addEventListener('click', () => {
    const input = doc.querySelector('[data-command-bar] input[type="text"]') as HTMLInputElement | null
    /* istanbul ignore next */
    if (!input) return
    input.value = '/focus '
    input.dispatchEvent(new doc.defaultView!.Event('input', { bubbles: true }))
    input.focus()
  })
  container.appendChild(createCard)
  return container
}

function renderFocusTaskList(
  doc: Document,
  tasks: Task[],
  filter: { kind: 'focus'; id: string; tags: string[] },
  ctx: RenderContext
): HTMLElement {
  const container = el(doc, 'div', { 'data-focus-task-list': '' })
  const matching = tasks
    .filter((t) => filter.tags.some((tag) => t.tags.includes(tag)) && t.status !== 'done')
    .sort(compareDue)
  if (matching.length === 0) {
    const empty = el(doc, 'p', { 'data-focus-task-empty': '' }, 'No tasks match this focus.')
    container.appendChild(empty)
    return container
  }
  const list = el(doc, 'ul', { 'data-task-list': '' })
  for (const task of matching) {
    list.appendChild(renderTaskRow(doc, task, false, ctx))
  }
  container.appendChild(list)
  return container
}

function renderCommandBar(doc: Document): HTMLElement {
  const bar = el(doc, 'div', {
    'data-command-bar': '',
    'data-pinned': 'bottom',
    'data-command-mode': 'chat',
  })
  bar.appendChild(icon(doc, 'bolt'))
  const fields = el(doc, 'div', { 'data-command-bar-fields': '' })
  const input = el(doc, 'input', {
    type: 'text',
    placeholder: 'Type a command or add a task...',
  })
  fields.appendChild(input)
  bar.appendChild(fields)
  const hint = el(doc, 'span', { 'data-shortcut-hint': '' }, 'Enter to send')
  bar.appendChild(hint)
  return bar
}

// ----- Chat view -----

type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'assistant'; text: string; error: true }
  | { role: 'assistant'; pending: true }
  | { role: 'tool'; event: ToolEvent }

function renderMessage(doc: Document, msg: ChatMessage): HTMLElement {
  if (msg.role === 'user') {
    const bubble = el(doc, 'div', { 'data-message': 'user' })
    bubble.appendChild(el(doc, 'span', { 'data-message-text': '' }, msg.text))
    return bubble
  }
  if (msg.role === 'tool') {
    const ev = msg.event
    const row = el(doc, 'div', {
      'data-message': 'tool',
      'data-tool-status': ev.status,
      'data-tool-name': ev.name,
    })
    const action = ev.action ?? ev.name
    row.appendChild(el(doc, 'span', { 'data-tool-action': '' }, action))
    if (ev.status === 'error') {
      const errText = ev.error ?? ev.resultContent
      row.appendChild(el(doc, 'span', { 'data-tool-error': '' }, errText))
    }
    return row
  }
  // assistant
  if ('pending' in msg) {
    const bubble = el(doc, 'div', {
      'data-message': 'assistant',
      'data-pending': 'true',
    })
    return bubble
  }
  const attrs: Record<string, string> = { 'data-message': 'assistant' }
  if ('error' in msg && msg.error) attrs['data-error'] = 'true'
  const bubble = el(doc, 'div', attrs)
  bubble.appendChild(el(doc, 'span', { 'data-message-text': '' }, msg.text))
  return bubble
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

// ----- Mount + interactions -----

export async function mountApp(container: HTMLElement): Promise<void> {
  const getVaultConfig = window.todoz.getVaultConfig
  if (typeof getVaultConfig === 'function') {
    const config = await getVaultConfig()
    if (!config.lastOpened) {
      await mountPickerWithSwap(container)
      return
    }
    await mountMainShell(container, config.lastOpened)
    return
  }
  await mountMainShell(container, null)
}

async function mountPickerWithSwap(container: HTMLElement): Promise<void> {
  const todoz = window.todoz
  const getVaultConfig = todoz.getVaultConfig
  const openFolderPicker = todoz.openFolderPicker
  const createVault = todoz.createVault
  const setActiveVault = todoz.setActiveVault
  const removeRecent = todoz.removeRecent
  if (
    !getVaultConfig ||
    !openFolderPicker ||
    !createVault ||
    !setActiveVault ||
    !removeRecent
  ) {
    /* istanbul ignore next */
    return
  }
  await mountVaultPicker(container, {
    getVaultConfig,
    openFolderPicker,
    createVault,
    setActiveVault,
    removeRecent,
    onVaultActivated: (vaultPath: string) => {
      void mountMainShell(container, vaultPath)
    },
  })
}

async function mountMainShell(
  container: HTMLElement,
  vaultPath: string | null
): Promise<void> {
  const doc = container.ownerDocument
  container.innerHTML = ''

  let tasks = await window.todoz.readTodos()
  let focuses: Focus[] = window.todoz.readFocuses ? await window.todoz.readFocuses() : []
  let activeFilter: Filter = { kind: 'inbox' }
  const expandedSlugs = new Set<string>()
  let defaultExpandSeeded = false
  // Chat state — session-only, lives in the closure across re-renders.
  let chatActive = false
  let chatMessages: ChatMessage[] = []
  // Today Flow state — ordered list of slugs from today.md
  let todaySlugs: string[] = []

  const getAppSettings = window.todoz.getAppSettings
  const setAppSetting = window.todoz.setAppSetting
  let appSettings: AppSettings = getAppSettings
    ? await getAppSettings()
    : { ...DEFAULT_APP_SETTINGS }

  const shell = el(doc, 'div', { 'data-app-shell': '' })
  shell.appendChild(renderTopAppBar(doc))
  const body = el(doc, 'div', { 'data-app-body': '' })
  shell.appendChild(body)
  container.appendChild(shell)

  let openSettingsTeardown: (() => void) | null = null
  let autocompleteTeardown: TearDown | null = null
  const settingsBtn = shell.querySelector(
    '[data-app-bar-settings]'
  ) as HTMLElement | null
  if (settingsBtn) {
    settingsBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (openSettingsTeardown) {
        openSettingsTeardown()
        openSettingsTeardown = null
        return
      }
      if (!getAppSettings || !setAppSetting) return
      const mounted = await mountSettingsPanel(settingsBtn, {
        getAppSettings,
        setAppSetting,
        onChange: (key, value) => {
          appSettings = { ...appSettings, [key]: value }
          fullRender()
        },
      })
      // Wrap the teardown so we can clear our local handle when the panel
      // self-destructs via outside click.
      const origTeardown = mounted.teardown
      const wrappedTeardown = (): void => {
        origTeardown()
        if (openSettingsTeardown === wrappedTeardown) {
          openSettingsTeardown = null
        }
      }
      // Observe DOM removal to drop the local handle on outside-click teardown.
      const observer = new (doc.defaultView as unknown as {
        MutationObserver: typeof MutationObserver
      }).MutationObserver(() => {
        if (!doc.body.contains(mounted.element)) {
          if (openSettingsTeardown === wrappedTeardown) {
            openSettingsTeardown = null
          }
          observer.disconnect()
        }
      })
      observer.observe(doc.body, { childList: true })
      openSettingsTeardown = wrappedTeardown
    })
  }

  function renderSwitchVaultButton(): HTMLElement | null {
    if (!vaultPath) return null
    const switchBtn = el(doc, 'button', {
      type: 'button',
      'data-open-another-vault': '',
      'aria-label': 'Open another vault',
    })
    switchBtn.appendChild(icon(doc, 'folder_open'))
    switchBtn.addEventListener('click', () => {
      void mountPickerWithSwap(container)
    })
    return switchBtn
  }

  function visibleTasks(): Task[] {
    return [...tasks]
      .filter((t) => filterMatchesTask(activeFilter, t, todayIso()))
      .sort(compareDue)
  }

  function updateTask(slug: string, updater: (t: Task) => Task): void {
    tasks = tasks.map((t) => (t.slug === slug ? updater(t) : t))
  }

  function rebuildSubtasksFromRaw(raw: string): Task['subtasks'] {
    const fmEnd = raw.indexOf('---', 3)
    let body = raw
    if (fmEnd !== -1) {
      const after = raw.indexOf('\n', fmEnd + 3)
      body = after === -1 ? '' : raw.slice(after + 1)
    }
    const lines = body.split(/\r?\n/)
    const out: Task['subtasks'] = []
    let index = 0
    for (const line of lines) {
      const m = /^- \[( |x)\] (.*)$/.exec(line)
      if (m) {
        out.push({ index, label: m[2], done: m[1] === 'x' })
        index += 1
      }
    }
    return out
  }

  function statusFromRaw(raw: string, fallback: Task['status']): Task['status'] {
    const m = /^\s*status:\s*(todo|doing|done)\s*$/m.exec(raw)
    return (m?.[1] as Task['status']) ?? fallback
  }

  function currentTask(slug: string): Task {
    // The task was rendered from `tasks` so the slug is always present;
    // the handler can only fire while the row is in the live DOM.
    return tasks.find((t) => t.slug === slug) as Task
  }

  const renderCtx: RenderContext = {
    onParentToggle: async (task: Task) => {
      const live = currentTask(task.slug)
      const next = toggleParent(live.raw)
      const flippedStatus: Task['status'] = live.status === 'done' ? 'todo' : 'done'
      updateTask(live.slug, (t) => ({ ...t, raw: next, status: flippedStatus }))
      fullRender()
      await window.todoz.writeFile(live.filePath, next)
    },
    onExpandToggle: (task: Task) => {
      const willExpand = !expandedSlugs.has(task.slug)
      if (willExpand) expandedSlugs.add(task.slug)
      else expandedSlugs.delete(task.slug)
      // In-place DOM mutation so any callers holding row references see the
      // updated state without a full re-render dropping them.
      const item = body.querySelector(
        `[data-task="${cssEscape(task.slug)}"]`
      ) as HTMLElement | null
      if (!item) return
      item.setAttribute('data-expanded', willExpand ? 'true' : 'false')
      const existing = item.querySelector('[data-subtasks]')
      const live = currentTask(task.slug)
      if (willExpand) {
        if (!existing && live.subtasks.length > 0) {
          item.appendChild(renderSubtasks(doc, live, renderCtx))
        }
      } else {
        if (existing) existing.remove()
      }
    },
    onSubtaskToggle: async (task: Task, subIndex: number) => {
      const live = currentTask(task.slug)
      const next = toggleSubtask(live.raw, subIndex)
      updateTask(live.slug, (t) => ({
        ...t,
        raw: next,
        status: statusFromRaw(next, t.status),
        subtasks: rebuildSubtasksFromRaw(next),
      }))
      fullRender()
      await window.todoz.writeFile(live.filePath, next)
    },
    onTopLevelRemove: async (task: Task) => {
      const live = currentTask(task.slug)
      const filename = splitPath(live.filePath).filename
      tasks = tasks.filter((t) => t.slug !== live.slug)
      expandedSlugs.delete(live.slug)
      fullRender()
      if (window.todoz.archiveFile) {
        await window.todoz.archiveFile(filename)
      }
    },
    onSubtaskRemove: async (task: Task, subIndex: number) => {
      const live = currentTask(task.slug)
      const next = removeSubtask(live.raw, subIndex)
      updateTask(live.slug, (t) => ({
        ...t,
        raw: next,
        status: statusFromRaw(next, t.status),
        subtasks: rebuildSubtasksFromRaw(next),
      }))
      fullRender()
      await window.todoz.writeFile(live.filePath, next)
    },
    onAddSubtaskSubmit: async (task: Task, text: string) => {
      const live = currentTask(task.slug)
      const next = addSubtask(live.raw, text)
      updateTask(live.slug, (t) => ({
        ...t,
        raw: next,
        status: statusFromRaw(next, t.status),
        subtasks: rebuildSubtasksFromRaw(next),
      }))
      // Cover both simple→combined conversion and idempotent re-expansion.
      expandedSlugs.add(live.slug)
      fullRender()
      await window.todoz.writeFile(live.filePath, next)
    },
    closeAllConfirms: () => {
      tearDownConfirm(doc)
    },
    onSetDue: (slug, due, raw) => {
      updateTask(slug, (t) => ({ ...t, due, raw }))
      fullRender()
    },
  }

  function fullRender(): void {
    body.innerHTML = ''
    const sidebar = renderSidebar(doc, tasks, activeFilter, appSettings, chatActive)
    body.appendChild(sidebar)
    bindSidebarClicks(sidebar)

    // The second column slot is either [data-main-view] (task list) or
    // [data-chat-view] (chat thread). Both are direct children of
    // [data-app-body], i.e. siblings of [data-sidebar]. The data-vault-path
    // and the Open-another-vault button live on whichever slot is active so
    // existing vault-picker behavior is preserved across views.
    const slotAttrs: Record<string, string> = chatActive
      ? { 'data-chat-view': '' }
      : { 'data-main-view': '' }
    if (vaultPath) slotAttrs['data-vault-path'] = vaultPath
    const slot = el(doc, 'main', slotAttrs)

    const switchBtn = renderSwitchVaultButton()
    if (switchBtn) slot.appendChild(switchBtn)

    if (chatActive) {
      const thread = el(doc, 'div', { 'data-chat-thread': '' })
      for (const msg of chatMessages) {
        thread.appendChild(renderMessage(doc, msg))
      }
      slot.appendChild(thread)
    } else if (activeFilter.kind === 'today') {
      // Today view — curated list from today.md, not the filter-based task list.
      const clearAll = async () => {
        todaySlugs = []
        fullRender()
        if (window.todoz.writeToday) {
          await window.todoz.writeToday([])
        }
      }
      slot.appendChild(renderMainHeader(doc, todaySlugs.length, activeFilter, clearAll))
      const todayList = renderTodayList(
        doc,
        todaySlugs,
        tasks,
        async (slug: string, task: Task) => {
          // Checkbox toggle: mark original task done, remove from Today.
          const next = toggleParent(task.raw)
          const flippedStatus: Task['status'] = task.status === 'done' ? 'todo' : 'done'
          updateTask(task.slug, (t) => ({ ...t, raw: next, status: flippedStatus }))
          todaySlugs = todaySlugs.filter((s) => s !== slug)
          fullRender()
          await window.todoz.writeFile(task.filePath, next)
          if (window.todoz.writeToday) {
            await window.todoz.writeToday([...todaySlugs])
          }
        },
        async (slug: string) => {
          // Remove from Today only — do not touch the original task file.
          todaySlugs = todaySlugs.filter((s) => s !== slug)
          fullRender()
          if (window.todoz.writeToday) {
            await window.todoz.writeToday([...todaySlugs])
          }
        }
      )
      slot.appendChild(todayList)
    } else if (activeFilter.kind === 'upcoming') {
      // Upcoming view — due-dated incomplete tasks sorted ascending.
      const upcomingTasks = tasks.filter((t) => t.due !== undefined && t.status !== 'done')
      slot.appendChild(renderMainHeader(doc, upcomingTasks.length, activeFilter))
      slot.appendChild(renderUpcomingList(doc, tasks))
    } else if (activeFilter.kind === 'focus-board') {
      // Focus board — grid of named focus cards.
      slot.appendChild(
        renderFocusBoard(
          doc,
          focuses,
          (focus: Focus) => {
            activeFilter = { kind: 'focus', id: focus.id, tags: focus.tags }
            fullRender()
          },
          async (updated: Focus) => {
            focuses = focuses.map((f) => (f.id === updated.id ? updated : f))
            if (window.todoz.writeFocuses) {
              try { await window.todoz.writeFocuses(focuses) } catch { /* non-fatal */ }
            }
            fullRender()
          },
          () => fullRender()
        )
      )
    } else if (activeFilter.kind === 'focus') {
      // Focus task list — filtered by focus tags.
      const focusFilter = activeFilter
      slot.appendChild(renderFocusTaskList(doc, tasks, focusFilter, renderCtx))
    } else {
      // Add onAddToToday to the render context for non-Today views.
      const ctxWithToday: RenderContext = {
        ...renderCtx,
        onAddToToday: async (task: Task) => {
          // Build the full slug from filePath (same logic as renderTodayList).
          const fp = task.filePath
          const lastSlash = fp.lastIndexOf('/')
          const filename = lastSlash === -1 ? fp : fp.slice(lastSlash + 1)
          const fullSlug = filename.endsWith('.md') ? filename.slice(0, -3) : filename
          // Append if not already present; always persist the current state.
          if (!todaySlugs.includes(fullSlug)) {
            todaySlugs = [...todaySlugs, fullSlug]
          }
          // Always write (idempotent if already present) so the file is current.
          if (window.todoz.writeToday) {
            await window.todoz.writeToday([...todaySlugs])
          }
          fullRender()
          pulseEntries(['today'])
        },
      }
      const visible = visibleTasks()
      const remaining = visible.filter((t) => t.status !== 'done').length
      slot.appendChild(renderMainHeader(doc, remaining, activeFilter))
      // Seed default expansion once: the very first task in the visible list
      // is rendered expanded on initial mount (matches the legacy chrome
      // behavior). Subsequent renders honor explicit expandedSlugs only.
      if (!defaultExpandSeeded) {
        if (visible.length > 0) {
          expandedSlugs.add(visible[0].slug)
        }
        defaultExpandSeeded = true
      }
      slot.appendChild(renderTaskCard(doc, visible, expandedSlugs, ctxWithToday))
      slot.appendChild(renderAddTaskAffordance())
    }
    slot.appendChild(renderCommandBar(doc))
    bindCommandBar(slot)
    body.appendChild(slot)
  }

  function renderAddTaskAffordance(): HTMLElement {
    const span = el(
      doc,
      'span',
      { 'data-add-task': '', role: 'button' },
      '+ Add task'
    )
    span.addEventListener('click', (e) => {
      e.stopPropagation()
      const parent = span.parentNode as Node
      const input = doc.createElement('input') as HTMLInputElement
      input.type = 'text'
      input.setAttribute('data-add-task-input', '')
      input.setAttribute('placeholder', 'Task title')
      parent.replaceChild(input, span)
      input.focus()
      const restore = () => {
        const fresh = renderAddTaskAffordance()
        ;(input.parentNode as Node).replaceChild(fresh, input)
      }
      input.addEventListener('keydown', async (ke) => {
        const evt = ke as KeyboardEvent
        if (evt.key === 'Escape') {
          evt.preventDefault()
          restore()
          return
        }
        if (evt.key !== 'Enter') return
        evt.preventDefault()
        const trimmed = input.value.trim()
        if (trimmed.length === 0) {
          restore()
          return
        }
        const today = todayIso()
        const dir = vaultDir(vaultPath, tasks)
        const existing = existingFilenamesFromTasks(tasks)
        const autoTags =
          activeFilter.kind === 'tag' ? [activeFilter.value] : []
        const built = buildTaskFile({
          title: trimmed,
          tags: autoTags,
          today,
          existingFilenames: existing,
        })
        const filePath = dir ? `${dir}/${built.filename}` : built.filename
        await window.todoz.writeFile(filePath, built.content)
        const newTask: Task = {
          slug: built.filename
            .replace(/\.md$/, '')
            .replace(/-\d{4}-\d{2}-\d{2}$/, ''),
          filePath,
          title: trimmed,
          status: 'todo',
          tags: autoTags,
          created: today,
          raw: built.content,
          subtasks: [],
        }
        tasks = [...tasks, newTask]
        fullRender()
        pulseEntries(['inbox', ...autoTags])
      })
    })
    return span
  }

  function bindSidebarClicks(sidebar: HTMLElement): void {
    const entries = sidebar.querySelectorAll('[data-sidebar-entry]')
    entries.forEach((entry) => {
      const key = entry.getAttribute('data-sidebar-entry') as string
      entry.addEventListener('click', (e) => {
        e.preventDefault()
        if (key === 'chat') {
          chatActive = true
          fullRender()
        } else if (key === 'today') {
          chatActive = false
          activeFilter = { kind: 'today' }
          // Load today slugs, then render.
          const loadAndRender = async (): Promise<void> => {
            if (window.todoz.readToday) {
              todaySlugs = await window.todoz.readToday()
            } else {
              todaySlugs = []
            }
            fullRender()
          }
          void loadAndRender()
        } else {
          chatActive = false
          activeFilter = filterFromEntryKey(key)
          fullRender()
        }
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
    // The command bar is always rendered by fullRender(); these queries cannot
    // be null in production, so we cast directly rather than guarding.
    const bar = main.querySelector('[data-command-bar]') as HTMLElement
    const input = bar.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement
    const hint = bar.querySelector('[data-shortcut-hint]') as HTMLElement

    function updateMode(): void {
      // When chat is disabled (settings.showChat=false, or env var
      // DISABLE_CHAT=1 which the main process funnels through showChat),
      // the bar stays in command mode regardless of input. Plain text on
      // Enter then becomes a no-op via handleCommandEnter's parser, instead
      // of activating the now-hidden chat view.
      const chatOn = appSettings.showChat
      const isCommand = !chatOn || input.value.startsWith('/') || /^[#@:]/.test(input.value)
      bar.setAttribute('data-command-mode', isCommand ? 'command' : 'chat')
      hint.textContent = isCommand ? 'Enter to run' : 'Enter to send'
    }
    // Initialize from current value (covers re-render with retained input).
    updateMode()
    input.addEventListener('input', () => {
      updateMode()
    })

    input.addEventListener('keydown', async (e) => {
      const ke = e as KeyboardEvent
      if (ke.key !== 'Enter') return
      // Sync mode from the live value at Enter time. The attribute is the
      // visual reflection (set on every input event) but the value is the
      // source of truth — guarding against programmatic value changes that
      // bypass input events.
      updateMode()
      const mode = bar.getAttribute('data-command-mode')
      if (mode === 'command') {
        await handleCommandEnter(input)
      } else {
        await handleChatEnter(input)
      }
    })

    // Mount the tag-autocomplete dropdown on this input. fullRender() is
    // called on every state change and rebuilds the command bar, so the
    // previous teardown (if any) must run first to release event listeners
    // on the old (now-detached) input element.
    if (autocompleteTeardown) {
      autocompleteTeardown()
      autocompleteTeardown = null
    }
    autocompleteTeardown = mountAutocompleteDropdown(input, {
      getAllTags: () => uniqueTags(tasks),
      onInsert: (newValue: string, newCaret: number) => {
        input.value = newValue
        try {
          input.setSelectionRange(newCaret, newCaret)
        } catch {
          /* istanbul ignore next */
          void 0 // setSelectionRange rejected (detached input); value is already set
        }
        // Notify the mode-detection / any other listeners so they re-evaluate.
        const view = doc.defaultView as unknown as {
          Event: { new (type: string, init?: EventInit): Event }
        }
        input.dispatchEvent(new view.Event('input', { bubbles: true }))
        // Keep focus on the input so the user can keep typing.
        input.focus()
      },
    })
  }

  function applyGoto(target: import('./data/parseGotoCommand').GotoTarget): boolean {
    if (target.kind === 'chat') {
      chatActive = true
    } else if (target.kind === 'inbox') {
      chatActive = false
      activeFilter = { kind: 'inbox' }
    } else if (target.kind === 'today') {
      chatActive = false
      activeFilter = { kind: 'today' }
    } else {
      // Only navigate to a tag if it exists in the current task set.
      const { projects, people, resources } = uniqueTags(tasks)
      const known = [...projects, ...people, ...resources]
      if (!known.includes(target.value)) return false
      chatActive = false
      activeFilter = { kind: 'tag', value: target.value }
    }
    fullRender()
    return true
  }

  async function handleCommandEnter(input: HTMLInputElement): Promise<void> {
    // /today-clear — wipe today.md
    if (input.value.trim().toLowerCase() === '/today-clear') {
      input.value = ''
      todaySlugs = []
      fullRender()
      if (window.todoz.writeToday) {
        await window.todoz.writeToday([])
      }
      return
    }

    const gotoTarget = parseGotoCommand(input.value)
    if (gotoTarget !== null) {
      if (applyGoto(gotoTarget)) input.value = ''
      return
    }
    if (input.value.toLowerCase().startsWith('/goto')) {
      // Unrecognised /goto destination — preserve input, no navigation.
      return
    }

    // /focus command — create a new focus
    const focusCmd = parseFocusCommand(input.value)
    if (focusCmd) {
      const newFocus: Focus = {
        id: crypto.randomUUID(),
        name: focusCmd.name,
        tags: focusCmd.tags,
      }
      focuses = [...focuses, newFocus]
      if (window.todoz.writeFocuses) await window.todoz.writeFocuses(focuses)
      input.value = ''
      activeFilter = { kind: 'focus-board' }
      fullRender()
      return
    }

    // Sigil shorthand: "#tag text", "@person text", ":read text" → "/add …"
    const raw = input.value
    const expanded = /^[#@:]/.test(raw) ? `/add ${raw}` : raw
    const command = parseAddCommand(expanded)
    if (!command) {
      // No-op — preserve input value, do not clear, do not pulse.
      return
    }
    const today = todayIso()
    const dir = vaultDir(vaultPath, tasks)
    const existing = existingFilenamesFromTasks(tasks)
    const built = buildTaskFile({
      title: command.title,
      tags: command.tags,
      today,
      existingFilenames: existing,
      due: command.due,
    })
    const filePath = dir ? `${dir}/${built.filename}` : built.filename
    await window.todoz.writeFile(filePath, built.content)
    // Append the new task in-memory so we don't depend on an async re-read.
    const newTask: Task = {
      slug: built.filename.replace(/\.md$/, '').replace(/-\d{4}-\d{2}-\d{2}$/, ''),
      filePath,
      title: command.title,
      status: 'todo',
      due: command.due,
      tags: command.tags,
      created: today,
      raw: built.content,
      subtasks: [],
    }
    tasks = [...tasks, newTask]
    input.value = ''
    // If we're in Today view, also append the new task slug to today.md.
    if (activeFilter.kind === 'today') {
      const fullSlug = built.filename.endsWith('.md')
        ? built.filename.slice(0, -3)
        : built.filename
      todaySlugs = [...todaySlugs, fullSlug]
      if (window.todoz.writeToday) {
        await window.todoz.writeToday([...todaySlugs])
      }
    }
    // Re-render to surface new sidebar entries / counts.
    fullRender()
    // Pulse entries for the just-added task: always Inbox; plus each tag entry.
    const pulseKeys = ['inbox', ...command.tags]
    pulseEntries(pulseKeys)
  }

  async function handleChatEnter(input: HTMLInputElement): Promise<void> {
    const text = input.value.trim()
    /* istanbul ignore next */
    if (text.length === 0) return
    chatActive = true
    const userMsg: ChatMessage = { role: 'user', text }
    const pendingMsg: ChatMessage = { role: 'assistant', pending: true }
    chatMessages = [...chatMessages, userMsg, pendingMsg]
    input.value = ''
    fullRender()
    // Fire Ollama after the pending render so tests / users see the pending bubble.
    const result = await window.todoz.runOllama(text)
    // Back-compat: older callers (and some tests) resolve with a bare string.
    // Wrap it as a successful result so downstream branching is uniform.
    const normalized: OllamaResult =
      typeof result === 'string'
        ? { ok: true, reply: result }
        : result
    // Replace the pending bubble (identified by reference) with the resolved
    // assistant message. If the bubble was removed elsewhere, do nothing.
    const idx = chatMessages.indexOf(pendingMsg)
    /* istanbul ignore next */
    if (idx === -1) return
    const toolEvents = normalized.toolEvents ?? []
    const toolMessages: ChatMessage[] = toolEvents.map((ev) => ({
      role: 'tool' as const,
      event: ev,
    }))
    const replyText = normalized.ok ? normalized.reply : normalized.error
    const showAssistant =
      !normalized.ok || (normalized.ok && replyText.trim().length > 0)
    const replacement: ChatMessage[] = [...toolMessages]
    if (showAssistant) {
      replacement.push(
        normalized.ok
          ? { role: 'assistant', text: replyText }
          : { role: 'assistant', text: replyText, error: true }
      )
    }
    chatMessages = [
      ...chatMessages.slice(0, idx),
      ...replacement,
      ...chatMessages.slice(idx + 1),
    ]
    // Refresh the in-memory task list so tool-written files show up when the
    // user navigates back to a task view.
    if (toolEvents.some((e) => e.status === 'ok')) {
      try {
        tasks = await window.todoz.readTodos()
      } catch {
        // ignore — keep current state on read failure
      }
    }
    fullRender()
  }

  // Document-level cmd+i / cmd+t listener (does not depend on input being focused).
  doc.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent
    if (ke.metaKey && (ke.key === 'i' || ke.key === 'I')) {
      ke.preventDefault()
      const input = body.querySelector(
        '[data-command-bar] input[type="text"]'
      ) as HTMLInputElement | null
      if (!input) return
      const current = input.value
      if (!current.startsWith('/add ')) {
        input.value = `/add ${current}`
      }
      input.focus()
    } else if (ke.metaKey && (ke.key === 't' || ke.key === 'T')) {
      ke.preventDefault()
      const input = body.querySelector(
        '[data-command-bar] input[type="text"]'
      ) as HTMLInputElement | null
      /* istanbul ignore next */
      if (!input) return
      if (!input.value.startsWith('/goto ')) {
        input.value = '/goto '
      }
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

    /* istanbul ignore else */
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
