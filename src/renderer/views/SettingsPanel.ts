import type { AppSettings, AppSettingKey } from '../../main/appSettings'

export interface SettingsPanelDeps {
  getAppSettings: () => Promise<AppSettings>
  setAppSetting: (key: AppSettingKey, value: boolean) => Promise<void>
  onChange: (key: AppSettingKey, value: boolean) => void
}

interface ToggleSpec {
  key: AppSettingKey
  toggleId: string
  label: string
}

const TOGGLES: ToggleSpec[] = [
  { key: 'showChat', toggleId: 'show-chat', label: 'Show Chat' },
  { key: 'showToday', toggleId: 'show-today', label: 'Show Today' },
  { key: 'showUpcoming', toggleId: 'show-upcoming', label: 'Show Upcoming' },
]

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Record<string, string>,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, v)
  }
  if (text !== undefined) node.textContent = text
  return node
}

export interface MountedSettingsPanel {
  teardown: () => void
  element: HTMLElement
}

export async function mountSettingsPanel(
  anchor: HTMLElement,
  deps: SettingsPanelDeps
): Promise<MountedSettingsPanel> {
  const doc = anchor.ownerDocument
  const settings = await deps.getAppSettings()

  const panel = el(doc, 'div', {
    'data-settings-panel': '',
    role: 'menu',
  })

  for (const spec of TOGGLES) {
    const row = el(doc, 'label', {
      'data-setting-toggle': spec.toggleId,
    })
    const cb = el(doc, 'input', { type: 'checkbox' }) as HTMLInputElement
    cb.checked = settings[spec.key]
    row.appendChild(cb)
    row.appendChild(el(doc, 'span', {}, spec.label))
    cb.addEventListener('click', async (e) => {
      e.stopPropagation()
      const next = cb.checked
      await deps.setAppSetting(spec.key, next)
      deps.onChange(spec.key, next)
    })
    panel.appendChild(row)
  }

  // Append to the body so absolute positioning works regardless of overflow
  // contexts on the anchor's parent chain.
  doc.body.appendChild(panel)

  // Position: anchored below the icon, right-aligned with its right edge.
  const view = doc.defaultView as Window
  const rect = anchor.getBoundingClientRect()
  panel.style.position = 'absolute'
  panel.style.top = `${rect.bottom + 8 + view.scrollY}px`
  // Right edge alignment: panel.right === anchor.right
  panel.style.right = `${doc.documentElement.clientWidth - rect.right}px`

  let isTornDown = false

  const onMouseDown = (e: MouseEvent): void => {
    const target = e.target as Node
    if (panel.contains(target)) return
    if (anchor.contains(target)) return
    teardown()
  }

  function teardown(): void {
    if (isTornDown) return
    isTornDown = true
    doc.removeEventListener('mousedown', onMouseDown, true)
    panel.remove()
  }

  doc.addEventListener('mousedown', onMouseDown, true)

  return { teardown, element: panel }
}
