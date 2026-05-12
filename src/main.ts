import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { parseTodo, type Task } from './renderer/data/parseTodo'
import { getVaultPath } from './config/settings'
import {
  readVaultConfig,
  addRecent,
  removeRecent as removeRecentFromConfig,
  setLastOpened,
} from './main/vaultConfig'
import { createVault } from './main/createVault'
import {
  readAppSettings,
  writeAppSetting,
  type AppSettingKey,
} from './main/appSettings'
import { buildWindowOptions } from './main/windowOptions'
import { isPathInsideActiveVault } from './main/writeFileGuard'
import {
  classifyOllamaResult,
  resolveOllamaModel,
  type OllamaResult,
} from './main/ollamaRun'

let activeVaultPath: string | null = null

function getVaultConfigPath(): string {
  return path.join(app.getPath('userData'), 'vault-config.json')
}

function getAppSettingsPath(): string {
  return path.join(app.getPath('userData'), 'app-settings.json')
}

function resolveActiveVault(): string | null {
  if (activeVaultPath) return activeVaultPath
  const configured = getVaultPath()
  if (configured) {
    activeVaultPath = configured
    return configured
  }
  const cfg = readVaultConfig(getVaultConfigPath())
  activeVaultPath = cfg.lastOpened
  return activeVaultPath
}

function createWindow(): void {
  const win = new BrowserWindow(buildWindowOptions())
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

ipcMain.handle('read-todos', (): Task[] => {
  const vault = resolveActiveVault()
  if (!vault) return []
  const dir = path.join(vault, 'todos')
  if (!fs.existsSync(dir)) return []
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
  const vault = resolveActiveVault()
  if (!isPathInsideActiveVault(filePath, vault)) {
    throw new Error(
      `write-file refused: target "${filePath}" is outside the active vault "${vault ?? '(none)'}"`
    )
  }
  fs.writeFileSync(filePath, content, 'utf-8')
})

ipcMain.handle('archive-file', (_e, filename: string): void => {
  const vault = resolveActiveVault()
  if (!vault) return
  const todosDir = path.join(vault, 'todos')
  const archiveDir = path.join(vault, 'archive', 'todos')
  fs.mkdirSync(archiveDir, { recursive: true })
  const src = path.join(todosDir, filename)
  const dest = path.join(archiveDir, filename)
  fs.renameSync(src, dest)
})

ipcMain.handle('run-ollama', (_e, prompt: string): Promise<OllamaResult> => {
  return new Promise((resolve) => {
    const systemPrompt = fs.existsSync('VAULT.md')
      ? fs.readFileSync('VAULT.md', 'utf-8')
      : ''
    const model = resolveOllamaModel(process.env)
    const promptLength = prompt.length
    const startedAt = Date.now()
    console.log(`[ollama] model=${model} promptLength=${promptLength}`)
    let proc
    try {
      proc = spawn('ollama', [
        'run',
        model,
        `${systemPrompt}\n\n---\n\n${prompt}`,
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.log(`[ollama] spawn error: ${message}`)
      resolve({ ok: false, error: message, exitCode: -1 })
      return
    }
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString()
    })
    proc.stderr.on('data', (d: Buffer) => {
      const chunk = d.toString()
      stderr += chunk
      // Log each non-empty stderr line as it arrives so logs are tailable.
      for (const line of chunk.split(/\r?\n/)) {
        if (line.length > 0) console.log(`[ollama stderr] ${line}`)
      }
    })
    proc.on('error', (err: Error) => {
      console.log(`[ollama] spawn error: ${err.message}`)
      resolve({ ok: false, error: err.message, exitCode: -1 })
    })
    proc.on('close', (code: number | null) => {
      const exitCode = code === null ? -1 : code
      const wallMs = Date.now() - startedAt
      console.log(
        `[ollama] exit=${exitCode} stdoutLength=${stdout.length} wallMs=${wallMs}`
      )
      const classified = classifyOllamaResult({ exitCode, stdout, stderr })
      if (!classified.ok) {
        console.log(`[ollama] failed exitCode=${classified.exitCode}`)
      }
      resolve(classified)
    })
  })
})

// ----- Vault picker IPC -----

ipcMain.handle(
  'vaultz:getConfig',
  (): { lastOpened: string | null; recents: string[] } => {
    if (process.env.NODE_ENV === 'test') {
      const fixtureVault = getVaultPath()
      return { lastOpened: fixtureVault, recents: fixtureVault ? [fixtureVault] : [] }
    }
    return readVaultConfig(getVaultConfigPath())
  }
)

ipcMain.handle('vaultz:openFolderPicker', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('vaultz:createVault', (_e, vaultPath: string): void => {
  createVault(vaultPath)
})

ipcMain.handle('vaultz:setActiveVault', (_e, vaultPath: string): void => {
  activeVaultPath = vaultPath
  const configPath = getVaultConfigPath()
  addRecent(configPath, vaultPath)
  setLastOpened(configPath, vaultPath)
})

ipcMain.handle('vaultz:removeRecent', (_e, vaultPath: string): void => {
  removeRecentFromConfig(getVaultConfigPath(), vaultPath)
})

// ----- App settings IPC -----

ipcMain.handle('settings:getAll', () => {
  return readAppSettings(getAppSettingsPath())
})

ipcMain.handle(
  'settings:set',
  (_e, key: AppSettingKey, value: boolean): void => {
    writeAppSetting(getAppSettingsPath(), key, value)
  }
)

app.whenReady().then(() => {
  if (process.env.NODE_ENV === 'test' && app.dock) app.dock.hide()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
