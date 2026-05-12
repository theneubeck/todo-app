import { contextBridge, ipcRenderer } from 'electron'

// Mirrors src/main/ollamaRun.ts OllamaResult. Duplicated rather than imported
// to keep the preload bundle free of side-effectful imports.
export type OllamaResult =
  | { ok: true; reply: string }
  | { ok: false; error: string; statusCode: number }

contextBridge.exposeInMainWorld('todoz', {
  readTodos: () => ipcRenderer.invoke('read-todos'),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),
  archiveFile: (filename: string) => ipcRenderer.invoke('archive-file', filename),
  runOllama: (prompt: string): Promise<OllamaResult> =>
    ipcRenderer.invoke('run-ollama', prompt),
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
