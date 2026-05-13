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
  parseOllamaToolsResponse,
  resolveOllamaApiUrl,
  resolveOllamaModel,
  type OllamaResult,
  type ToolEvent,
} from './main/ollamaRun'
import {
  buildOllamaToolsRequest,
  executeAddTask,
  parseToolCall,
} from './main/ollamaTools'

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

async function callOllama(
  prompt: string,
  logPrefix = '[ollama]'
): Promise<OllamaResult> {
  const start = Date.now()
  const apiUrl = resolveOllamaApiUrl(process.env)
  const model = resolveOllamaModel(process.env)
  const systemPrompt = fs.existsSync('VAULT.md')
    ? fs.readFileSync('VAULT.md', 'utf-8')
    : ''
  console.log(
    `${logPrefix} url=${apiUrl} model=${model} promptLength=${prompt.length}`
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
      `${logPrefix} status=${res.status} bodyLength=${body.length} wallMs=${wallMs}`
    )
    const result = parseOllamaResponse({ status: res.status, body })
    if (!result.ok) {
      console.log(`${logPrefix} error: ${result.error}`)
    }
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const rawCause = (err as { cause?: unknown }).cause
    const cause =
      rawCause instanceof Error
        ? rawCause.message
        : typeof rawCause === 'string'
          ? rawCause
          : undefined
    const detail = cause ? `${msg} (${cause})` : msg
    console.log(`${logPrefix} ${detail}`)
    return { ok: false, error: detail, statusCode: -1 }
  }
}

const WARMUP_PROMPT = "If you can hear me respond 'pong'"

function isChatDisabled(): boolean {
  return process.env.DISABLE_CHAT === '1'
}

function warmupOllama(): void {
  if (process.env.NODE_ENV === 'test') return
  if (isChatDisabled()) return
  // The warmup path stays on the plain (no-tools) request so a misbehaving
  // model can't bring up tool-call plumbing at boot.
  void callOllama(WARMUP_PROMPT, '[ollama warmup]')
}

const TOOL_LOOP_MAX_ITERATIONS = 4

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

async function executeToolCall(
  rawCall: {
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  },
  vault: string | null,
  todosDirExisting: string[]
): Promise<{
  event: ToolEvent
  toolMessageContent: string
}> {
  const parsed = parseToolCall(rawCall)
  if (!parsed.ok) {
    return {
      event: {
        callId: parsed.callId,
        name: parsed.name,
        argsRaw: parsed.argumentsRaw,
        status: 'error',
        resultContent: parsed.error,
        action: parsed.name,
        error: parsed.error,
      },
      toolMessageContent: parsed.error,
    }
  }
  if (!vault) {
    const err = 'no active vault'
    return {
      event: {
        callId: parsed.callId,
        name: parsed.name,
        argsRaw: parsed.argumentsRaw,
        status: 'error',
        resultContent: err,
        action: parsed.name,
        error: err,
      },
      toolMessageContent: err,
    }
  }
  try {
    const built = executeAddTask(parsed.args, {
      today: todayIso(),
      existingFilenames: todosDirExisting,
    })
    const target = path.join(vault, 'todos', built.filename)
    if (!isPathInsideActiveVault(target, vault)) {
      const err = `write-file refused: target "${target}" is outside the active vault`
      return {
        event: {
          callId: parsed.callId,
          name: parsed.name,
          argsRaw: parsed.argumentsRaw,
          status: 'error',
          resultContent: err,
          action: parsed.name,
          error: err,
        },
        toolMessageContent: err,
      }
    }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, built.content, 'utf-8')
    todosDirExisting.push(built.filename)
    const tags = parsed.args.tags ?? []
    const tagSuffix = tags.length > 0 ? ' ' + tags.map((t) => `#${t}`).join(' ') : ''
    return {
      event: {
        callId: parsed.callId,
        name: parsed.name,
        argsRaw: parsed.argumentsRaw,
        status: 'ok',
        resultContent: target,
        action: `add_task: ${parsed.args.title}${tagSuffix}`,
      },
      toolMessageContent: `Wrote ${built.filename}`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      event: {
        callId: parsed.callId,
        name: parsed.name,
        argsRaw: parsed.argumentsRaw,
        status: 'error',
        resultContent: msg,
        action: parsed.name,
        error: msg,
      },
      toolMessageContent: msg,
    }
  }
}

async function runOllamaWithTools(
  prompt: string,
  logPrefix = '[ollama tools]'
): Promise<OllamaResult> {
  const start = Date.now()
  const apiUrl = resolveOllamaApiUrl(process.env)
  const model = resolveOllamaModel(process.env)
  const systemPrompt = fs.existsSync('VAULT.md')
    ? fs.readFileSync('VAULT.md', 'utf-8')
    : ''
  console.log(
    `${logPrefix} url=${apiUrl} model=${model} promptLength=${prompt.length}`
  )
  const vault = resolveActiveVault()
  const existing: string[] = []
  if (vault) {
    const todosDir = path.join(vault, 'todos')
    if (fs.existsSync(todosDir)) {
      for (const f of fs.readdirSync(todosDir)) {
        if (f.endsWith('.md')) existing.push(f)
      }
    }
  }
  const toolEvents: ToolEvent[] = []
  const priorToolCalls: {
    id: string
    name: string
    argumentsRaw: string
  }[] = []
  const priorToolResults: { callId: string; content: string }[] = []
  for (let iter = 0; iter < TOOL_LOOP_MAX_ITERATIONS; iter += 1) {
    const { url, init } = buildOllamaToolsRequest({
      apiUrl,
      model,
      systemPrompt,
      userPrompt: prompt,
      priorToolCalls,
      priorToolResults,
    })
    let body = ''
    let status = 0
    try {
      const res = await fetch(url, init)
      body = await res.text()
      status = res.status
      console.log(
        `${logPrefix} iter=${iter} status=${status} bodyLength=${body.length} wallMs=${Date.now() - start}`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const rawCause = (err as { cause?: unknown }).cause
      const cause =
        rawCause instanceof Error
          ? rawCause.message
          : typeof rawCause === 'string'
            ? rawCause
            : undefined
      const detail = cause ? `${msg} (${cause})` : msg
      console.log(`${logPrefix} ${detail}`)
      return { ok: false, error: detail, statusCode: -1, toolEvents }
    }
    const parsed = parseOllamaToolsResponse({ status, body })
    if (parsed.kind === 'error') {
      return {
        ok: false,
        error: parsed.error,
        statusCode: parsed.statusCode,
        toolEvents,
      }
    }
    if (parsed.kind === 'content') {
      return { ok: true, reply: parsed.reply, toolEvents }
    }
    // tool_calls: execute each sequentially, accumulating events + results.
    for (const raw of parsed.calls) {
      const { event, toolMessageContent } = await executeToolCall(
        raw,
        vault,
        existing
      )
      toolEvents.push(event)
      priorToolCalls.push({
        id: raw.id,
        name: raw.function.name,
        argumentsRaw: raw.function.arguments,
      })
      priorToolResults.push({ callId: raw.id, content: toolMessageContent })
    }
    // Loop continues for the next iteration to fetch the assistant's
    // follow-up (final content or further tool calls).
  }
  return {
    ok: false,
    error: 'tool call loop exceeded 4 iterations',
    statusCode: 200,
    toolEvents,
  }
}

ipcMain.handle(
  'run-ollama',
  (_e, prompt: string): Promise<OllamaResult> => runOllamaWithTools(prompt)
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
  const fromDisk = readAppSettings(getAppSettingsPath())
  // DISABLE_CHAT=1 hard-overrides the persisted setting so the Chat sidebar
  // entry is hidden and the command bar stays in command mode for the
  // duration of this run.
  if (isChatDisabled()) return { ...fromDisk, showChat: false }
  return fromDisk
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
  warmupOllama()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
