import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('todoz', {
  readTodos: () => ipcRenderer.invoke('read-todos'),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),
  archiveFile: (filename: string) => ipcRenderer.invoke('archive-file', filename),
  runOllama: (prompt: string) => ipcRenderer.invoke('run-ollama', prompt),
  getVaultConfig: () => ipcRenderer.invoke('vaultz:getConfig'),
  openFolderPicker: () => ipcRenderer.invoke('vaultz:openFolderPicker'),
  createVault: (vaultPath: string) =>
    ipcRenderer.invoke('vaultz:createVault', vaultPath),
  setActiveVault: (vaultPath: string) =>
    ipcRenderer.invoke('vaultz:setActiveVault', vaultPath),
  removeRecent: (vaultPath: string) =>
    ipcRenderer.invoke('vaultz:removeRecent', vaultPath),
})
