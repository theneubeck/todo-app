import { contextBridge, ipcRenderer } from 'electron'

// Mirrors src/main/ollamaRun.ts OllamaResult + ToolEvent. Duplicated rather
// than imported to keep the preload bundle free of side-effectful imports.
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

contextBridge.exposeInMainWorld('todoz', {
  readTodos: () => ipcRenderer.invoke('read-todos'),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),
  archiveFile: (filename: string) => ipcRenderer.invoke('archive-file', filename),
  runOllama: (prompt: string): Promise<OllamaResult> =>
    ipcRenderer.invoke('run-ollama', prompt),
  readToday: (): Promise<string[]> => ipcRenderer.invoke('read-today'),
  writeToday: (slugs: string[]): Promise<void> =>
    ipcRenderer.invoke('write-today', slugs),
  getVaultConfig: () => ipcRenderer.invoke('vaultz:getConfig'),
  openFolderPicker: () => ipcRenderer.invoke('vaultz:openFolderPicker'),
  createVault: (vaultPath: string) =>
    ipcRenderer.invoke('vaultz:createVault', vaultPath),
  setActiveVault: (vaultPath: string) =>
    ipcRenderer.invoke('vaultz:setActiveVault', vaultPath),
  removeRecent: (vaultPath: string) =>
    ipcRenderer.invoke('vaultz:removeRecent', vaultPath),
  getAppSettings: () => ipcRenderer.invoke('settings:getAll'),
  setAppSetting: (key: string, value: boolean) =>
    ipcRenderer.invoke('settings:set', key, value),
})
