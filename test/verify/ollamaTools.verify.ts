// Verify script for the `ollama-tools` feature.
//
// Boots a stub HTTP server that speaks the OpenAI-compatible
// /v1/chat/completions shape with tool calling. On the first POST it returns
// a 6-call `tool_calls` response (the go-to-store break-down example); on
// the second POST it returns the final assistant summary. Launches Electron
// with OLLAMA_API_URL pointing at the stub, drives a chat send via the
// command bar, and asserts:
//   1. Six markdown task files are written into the active vault's todos
//      folder, each tagged #go-to-store.
//   2. Six [data-message="tool"] rows render in the chat thread.
//   3. The final assistant bubble shows the summary text.
// Captures tmp/ollamaTools-go-to-store.png at the rendered state.
//
// Per the frozen plan in features/ollama-tools/plan.md.

import { _electron as electron, ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SHOT_DIR = path.join(REPO_ROOT, 'tmp')
const MAIN_ENTRY = path.join(REPO_ROOT, 'dist', 'main.js')

type Result = { name: string; pass: boolean; reason: string }
const results: Result[] = []
function record(name: string, pass: boolean, reason: string): void {
  results.push({ name, pass, reason })
  const tag = pass ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${name}: ${reason}`)
}

const TITLES = [
  'buy milk',
  'buy eggs',
  'buy fruit',
  'buy flour',
  'buy jam',
  'make pancakes',
]

const FINAL_SUMMARY = 'Added six tasks under #go-to-store.'

function makeToolCallsResponse(): string {
  return JSON.stringify({
    choices: [
      {
        message: {
          content: '',
          tool_calls: TITLES.map((title, i) => ({
            id: `call_${i + 1}`,
            type: 'function',
            function: {
              name: 'add_task',
              arguments: JSON.stringify({
                title,
                tags: ['go-to-store'],
              }),
            },
          })),
        },
      },
    ],
  })
}

function makeFinalResponse(): string {
  return JSON.stringify({
    choices: [{ message: { content: FINAL_SUMMARY } }],
  })
}

function startStubServer(): Promise<{
  port: number
  toolPostCount: () => number
  close: () => Promise<void>
}> {
  return new Promise((resolve, reject) => {
    // Count only POSTs that came from the tool loop (i.e. requests carrying
    // a `tools` array). The boot-time warmup uses plain buildOllamaRequest
    // which omits `tools`, so we can recognise + answer it separately.
    let toolPosts = 0
    const server = http.createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk.toString()
      })
      req.on('end', () => {
        if (req.method !== 'POST') {
          res.statusCode = 404
          res.end('not found')
          return
        }
        let isToolsRequest = false
        try {
          const parsed = JSON.parse(raw) as { tools?: unknown }
          isToolsRequest = Array.isArray(parsed.tools)
        } catch {
          // ignore — treat as plain
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        if (!isToolsRequest) {
          // Warmup or any other plain call — answer with a benign content.
          res.end(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }))
          return
        }
        toolPosts += 1
        if (toolPosts === 1) {
          res.end(makeToolCallsResponse())
        } else {
          res.end(makeFinalResponse())
        }
      })
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        reject(new Error('failed to determine ephemeral port'))
        return
      }
      resolve({
        port: addr.port,
        toolPostCount: () => toolPosts,
        close: () =>
          new Promise<void>((resolveClose) => {
            server.close(() => resolveClose())
          }),
      })
    })
  })
}

async function run(): Promise<void> {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  if (!fs.existsSync(MAIN_ENTRY)) {
    console.error(`dist/main.js missing — did you run \`npm run build\`?`)
    process.exit(1)
  }

  const tmpUserData = fs.mkdtempSync(
    path.join(os.tmpdir(), 'todoz-ollama-tools-userdata-')
  )
  const tmpVault = path.join(tmpUserData, 'vault')
  const todosDir = path.join(tmpVault, 'todos')
  fs.mkdirSync(todosDir, { recursive: true })
  fs.writeFileSync(
    path.join(tmpUserData, 'vault-config.json'),
    JSON.stringify({ lastOpened: tmpVault, recents: [tmpVault] }),
    'utf-8'
  )

  const stub = await startStubServer()
  const apiUrl = `http://127.0.0.1:${stub.port}/v1/chat/completions`

  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      args: [MAIN_ENTRY, `--user-data-dir=${tmpUserData}`],
      cwd: REPO_ROOT,
      // Use NODE_ENV=production so resolveActiveVault reads vault-config.json
      // (the in-test getVaultPath() short-circuits to the repo fixture, which
      // is not what we want here — we need writes to land in the tmp vault).
      env: {
        ...process.env,
        NODE_ENV: 'production',
        OLLAMA_API_URL: apiUrl,
      },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('[data-main-view]', { timeout: 10_000 })
    await window.waitForSelector('[data-command-bar]', { timeout: 10_000 })

    // Drive a chat send.
    const input = window.locator('[data-command-bar] input[type="text"]')
    await input.click()
    const userPrompt =
      'I need you to go to the store, buy milk, some eggs, fruit and flour. ' +
      'We should be making pancakes. So some jam can be needed too.'
    await input.type(userPrompt, { delay: 1 })
    await input.press('Enter')

    // Wait for the final assistant bubble — implies both POSTs landed and
    // the tool calls have been executed in between.
    await window.waitForSelector(
      '[data-message="assistant"]:not([data-pending]):not([data-error]) [data-message-text]',
      { state: 'attached', timeout: 15_000 }
    )

    const replyText = await window
      .locator(
        '[data-message="assistant"]:not([data-pending]):not([data-error]) [data-message-text]'
      )
      .textContent()
    record(
      'final assistant bubble shows the summary returned by the stub server',
      replyText?.trim() === FINAL_SUMMARY,
      `bubble text = "${replyText ?? '(null)'}"`
    )

    // Six tool rows should be present.
    const toolRowCount = await window.locator('[data-message="tool"]').count()
    record(
      'chat thread renders one tool row per executed call',
      toolRowCount === 6,
      `tool row count = ${toolRowCount}`
    )

    // Six task files exist on disk.
    const writtenFiles = fs.readdirSync(todosDir).filter((f) => f.endsWith('.md'))
    record(
      'active vault todos folder contains six new task files',
      writtenFiles.length === 6,
      `file count = ${writtenFiles.length} (${writtenFiles.join(', ')})`
    )

    // Each expected title produced exactly one file.
    for (const title of TITLES) {
      const slug = title.replace(/\s+/g, '-')
      const match = writtenFiles.find((f) => f.startsWith(slug + '-'))
      record(
        `task file for "${title}" exists`,
        match !== undefined,
        `match = ${match ?? '(none)'}`
      )
    }

    // Each file's frontmatter carries the go-to-store tag.
    for (const f of writtenFiles) {
      const raw = fs.readFileSync(path.join(todosDir, f), 'utf-8')
      const hasTag = /tags:\s*\[\s*go-to-store\s*\]/.test(raw)
      record(
        `${f} carries tags: [go-to-store]`,
        hasTag,
        `tags line ok = ${hasTag}`
      )
    }

    // Both tool-loop POSTs landed.
    record(
      'stub server received two tool-loop POST requests (tool-call turn + summary turn)',
      stub.toolPostCount() === 2,
      `tool-loop POST count = ${stub.toolPostCount()}`
    )

    const shot = path.join(SHOT_DIR, 'ollamaTools-go-to-store.png')
    await window.screenshot({ path: shot, fullPage: true })
    console.log(`Screenshot captured at ${shot}`)
  } catch (err) {
    record(
      'ollama-tools verify scenario',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
    await stub.close().catch(() => undefined)
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  }

  console.log('\n=== ollama-tools verify summary ===')
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.reason}`)
  }
  const failed = results.filter((r) => !r.pass)
  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('ollama-tools verify crashed:', err)
  process.exit(1)
})
