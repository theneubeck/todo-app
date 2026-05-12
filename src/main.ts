import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
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
  buildOllamaRequest,
  parseOllamaResponse,
  resolveOllamaApiUrl,
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

ipcMain.handle(
  'run-ollama',
  async (_e, prompt: string): Promise<OllamaResult> => {
    const start = Date.now()
    const apiUrl = resolveOllamaApiUrl(process.env)
    const model = resolveOllamaModel(process.env)
    const systemPrompt = fs.existsSync('VAULT.md')
      ? fs.readFileSync('VAULT.md', 'utf-8')
      : ''
    console.log(
      `[ollama] url=${apiUrl} model=${model} promptLength=${prompt.length}`
    )
    const { url, init } = buildOllamaRequest({
      apiUrl,
      model,
      systemPrompt,
      userPrompt: prompt,
    })
    try {
      const res = await fetch(url, init)
      const body = await res.text()
      const wallMs = Date.now() - start
      console.log(
        `[ollama] status=${res.status} bodyLength=${body.length} wallMs=${wallMs}`
      )
      const result = parseOllamaResponse({ status: res.status, body })
      if (!result.ok) {
        console.log(`[ollama] error: ${result.error}`)
      }
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`[ollama error] ${msg}`)
      return { ok: false, error: msg, statusCode: -1 }
    }
  }
)

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
