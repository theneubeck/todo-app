import type { Task } from './data/parseTodo'
import {
  toggleParent,
  toggleSubtask,
  removeSubtask,
  addSubtask,
} from './data/writeTodo'
import { parseAddCommand } from './data/parseAddCommand'
import { buildTaskFile } from './data/buildTaskFile'
import { vaultDir } from './data/vaultDir'
import { mountVaultPicker } from './views/VaultPicker'
import { mountSettingsPanel } from './views/SettingsPanel'
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
    }
  }
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  showChat: true,
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

function isPrimaryEntryEnabled(
  entry: PrimaryEntry,
  settings: AppSettings
): boolean {
  if (entry.key === 'inbox') return true
  if (entry.key === 'chat') return settings.showChat
  if (entry.key === 'today') return settings.showToday
  if (entry.key === 'upcoming') return settings.showUpcoming
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
        renderTagEntry(doc, tag, `#${tag}`, 'tag', isActive)
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
        renderTagEntry(doc, handle, handle, 'alternate_email', isActive)
      )
    }
    aside.appendChild(peopleSection)
  }

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

type RenderContext = {
  onParentToggle: (task: Task) => Promise<void>
  onExpandToggle: (task: Task) => void
  onSubtaskToggle: (task: Task, subIndex: number) => Promise<void>
  onTopLevelRemove: (task: Task) => Promise<void>
  onSubtaskRemove: (task: Task, subIndex: number) => Promise<void>
  onAddSubtaskSubmit: (task: Task, text: string) => Promise<void>
  closeAllConfirms: () => void
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

  const removeBtn = el(
    doc,
    'span',
    { 'data-remove': '', role: 'button', 'aria-label': 'Remove subtask' },
    '✕'
  )
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

  const removeBtn = el(
    doc,
    'span',
    { 'data-remove': '', role: 'button', 'aria-label': 'Remove task' },
    '✕'
  )
  row.appendChild(removeBtn)

  if (isCombined) {
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null
      if (target && target.closest('[data-remove]')) {
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

function renderChatView(doc: Document, messages: ChatMessage[]): HTMLElement {
  const view = el(doc, 'div', { 'data-chat-view': '' })
  const thread = el(doc, 'div', { 'data-chat-thread': '' })
  for (const msg of messages) {
    thread.appendChild(renderMessage(doc, msg))
  }
  view.appendChild(thread)
  return view
}

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
  let activeFilter: Filter = { kind: 'inbox' }
  const expandedSlugs = new Set<string>()
  let defaultExpandSeeded = false
  // Chat state — session-only, lives in the closure across re-renders.
  let chatActive = false
  let chatMessages: ChatMessage[] = []

  const getAppSettings = window.todoz.getAppSettings
  const setAppSetting = window.todoz.setAppSetting
  let appSettings: AppSettings = getAppSettings
    ? await getAppSettings()
    : { ...DEFAULT_APP_SETTINGS }

  const shell = el(doc, 'div', { 'data-app-shell': '' })
  shell.appendChild(renderTopAppBar(doc))
  const body = el(doc, 'div', { 'data-app-body': '' })
  shell.appendChild(body)

  let openSettingsTeardown: (() => void) | null = null
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

  let rootMount: HTMLElement = shell
  if (vaultPath) {
    const mainView = el(doc, 'main', {
      'data-main-view': '',
      'data-vault-path': vaultPath,
    })
    const switchBtn = el(doc, 'button', {
      type: 'button',
      'data-open-another-vault': '',
      'aria-label': 'Open another vault',
    })
    switchBtn.appendChild(icon(doc, 'folder_open'))
    switchBtn.addEventListener('click', () => {
      void mountPickerWithSwap(container)
    })
    mainView.appendChild(switchBtn)
    mainView.appendChild(shell)
    rootMount = mainView
  }
  container.appendChild(rootMount)

  function visibleTasks(): Task[] {
    return [...tasks]
      .filter((t) => filterMatchesTask(activeFilter, t))
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
  }

  function fullRender(): void {
    body.innerHTML = ''
    const sidebar = renderSidebar(doc, tasks, activeFilter, appSettings, chatActive)
    body.appendChild(sidebar)
    bindSidebarClicks(sidebar)

    const main = el(doc, 'main', { 'data-main': '' })
    if (chatActive) {
      main.appendChild(renderChatView(doc, chatMessages))
    } else {
      const visible = visibleTasks()
      const remaining = visible.filter((t) => t.status !== 'done').length
      main.appendChild(renderMainHeader(doc, remaining, activeFilter))
      // Seed default expansion once: the very first task in the visible list
      // is rendered expanded on initial mount (matches the legacy chrome
      // behavior). Subsequent renders honor explicit expandedSlugs only.
      if (!defaultExpandSeeded) {
        if (visible.length > 0) {
          expandedSlugs.add(visible[0].slug)
        }
        defaultExpandSeeded = true
      }
      main.appendChild(renderTaskCard(doc, visible, expandedSlugs, renderCtx))
      main.appendChild(renderAddTaskAffordance())
    }
    main.appendChild(renderCommandBar(doc))
    bindCommandBar(main)
    body.appendChild(main)
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
      // Today / Upcoming remain inert. Chat now activates the chat view.
      if (key === 'today' || key === 'upcoming') return
      entry.addEventListener('click', (e) => {
        e.preventDefault()
        if (key === 'chat') {
          chatActive = true
        } else {
          chatActive = false
          activeFilter = filterFromEntryKey(key)
        }
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
    // The command bar is always rendered by fullRender(); these queries cannot
    // be null in production, so we cast directly rather than guarding.
    const bar = main.querySelector('[data-command-bar]') as HTMLElement
    const input = bar.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement
    const hint = bar.querySelector('[data-shortcut-hint]') as HTMLElement

    function updateMode(): void {
      const isCommand = input.value.startsWith('/')
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
  }

  async function handleCommandEnter(input: HTMLInputElement): Promise<void> {
    const command = parseAddCommand(input.value)
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
  }

  async function handleChatEnter(input: HTMLInputElement): Promise<void> {
    const text = input.value.trim()
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

  // Document-level cmd+i listener (does not depend on input being focused).
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
