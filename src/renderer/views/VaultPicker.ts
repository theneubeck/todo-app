export interface VaultPickerDeps {
  getVaultConfig: () => Promise<{ lastOpened: string | null; recents: string[] }>
  openFolderPicker: () => Promise<string | null>
  createVault: (vaultPath: string) => Promise<void>
  setActiveVault: (vaultPath: string) => Promise<void>
  removeRecent: (vaultPath: string) => Promise<void>
  onVaultActivated: (vaultPath: string) => void
}

function basename(p: string): string {
  const parts = p.split('/').filter((s) => s.length > 0)
  return parts.length > 0 ? parts[parts.length - 1] : p
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

export async function mountVaultPicker(
  container: HTMLElement,
  deps: VaultPickerDeps
): Promise<void> {
  const doc = container.ownerDocument
  container.innerHTML = ''
  const config = await deps.getVaultConfig()

  const section = el(doc, 'section', { 'data-vault-picker': '' })

  const heading = el(doc, 'h1', { 'data-vault-picker-heading': '' }, 'Open a vault')
  section.appendChild(heading)

  const actions = el(doc, 'div', { 'data-vault-picker-actions': '' })
  const createBtn = el(
    doc,
    'button',
    { type: 'button', 'data-vault-picker-create': '' },
    'Create new vault'
  )
  const openBtn = el(
    doc,
    'button',
    { type: 'button', 'data-vault-picker-open': '' },
    'Open folder as vault'
  )
  actions.appendChild(createBtn)
  actions.appendChild(openBtn)
  section.appendChild(actions)

  const recentsHeader = el(
    doc,
    'h2',
    { 'data-recents-header': '' },
    'Recent vaults'
  )
  section.appendChild(recentsHeader)

  const recentsList = el(doc, 'ul', { 'data-recents': '' })
  for (const vaultPath of config.recents) {
    recentsList.appendChild(renderRecentRow(doc, vaultPath, deps))
  }
  section.appendChild(recentsList)

  container.appendChild(section)

  createBtn.addEventListener('click', async () => {
    const target = await deps.openFolderPicker()
    if (!target) return
    await deps.createVault(target)
    await deps.setActiveVault(target)
    deps.onVaultActivated(target)
  })

  openBtn.addEventListener('click', async () => {
    const target = await deps.openFolderPicker()
    if (!target) return
    await deps.setActiveVault(target)
    deps.onVaultActivated(target)
  })
}

function renderRecentRow(
  doc: Document,
  vaultPath: string,
  deps: VaultPickerDeps
): HTMLElement {
  const li = el(doc, 'li', {
    'data-recent-row': '',
    'data-vault-path': vaultPath,
  })
  const name = el(doc, 'span', { 'data-recent-name': '' }, basename(vaultPath))
  const path = el(doc, 'span', { 'data-recent-path': '' }, vaultPath)
  const remove = el(
    doc,
    'button',
    {
      type: 'button',
      'data-remove-recent': '',
      'aria-label': 'Remove from recents',
    },
    '✕'
  )
  li.appendChild(name)
  li.appendChild(path)
  li.appendChild(remove)

  li.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement | null
    if (target && target.closest('[data-remove-recent]')) return
    await deps.setActiveVault(vaultPath)
    deps.onVaultActivated(vaultPath)
  })

  remove.addEventListener('click', async (e) => {
    e.stopPropagation()
    await deps.removeRecent(vaultPath)
    li.remove()
  })

  return li
}
