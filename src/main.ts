import { app, BrowserWindow, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { parseTodo, type Task } from './renderer/data/parseTodo'

const VAULT_PATH = path.join(__dirname, '..', 'test', 'fixtures', 'vault')

function createWindow(): void {
  const win = new BrowserWindow({
    width: 900,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

ipcMain.handle('read-todos', (): Task[] => {
  const dir = path.join(VAULT_PATH, 'todos')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const filePath = path.join(dir, f)
      const raw = fs.readFileSync(filePath, 'utf-8')
      return parseTodo(raw, f, filePath)
    })
})

ipcMain.handle('write-file', (_e, filePath: string, content: string): void => {
  fs.writeFileSync(filePath, content, 'utf-8')
})

ipcMain.handle('run-ollama', (_e, prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    const agentsMd = fs.existsSync('AGENTS.md')
      ? fs.readFileSync('AGENTS.md', 'utf-8')
      : ''
    const proc = spawn('ollama', [
      'run',
      'gemma4:12b',
      `${agentsMd}\n\n---\n\n${prompt}`,
    ])
    let out = ''
    proc.stdout.on('data', (d: Buffer) => {
      out += d.toString()
    })
    proc.on('close', () => resolve(out))
    proc.on('error', () => resolve(''))
  })
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
