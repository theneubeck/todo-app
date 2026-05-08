import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('todoz', {
  readTodos: () => ipcRenderer.invoke('read-todos'),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),
  archiveFile: (filename: string) => ipcRenderer.invoke('archive-file', filename),
  runOllama: (prompt: string) => ipcRenderer.invoke('run-ollama', prompt),
})
