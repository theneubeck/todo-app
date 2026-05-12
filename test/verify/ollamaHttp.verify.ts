// Verify script for the `ollama-http` feature.
//
// Boots a tiny Node http.createServer on an ephemeral port that speaks the
// OpenAI-compatible /v1/chat/completions shape, launches Electron with
// OLLAMA_API_URL pointing at the stub, drives a chat send via the command
// bar, and asserts:
//   1. The stub received a POST with messages[1].content === "ping" and
//      stream: false.
//   2. The renderer's assistant bubble [data-message-text] equals "pong".
// Captures tmp/ollamaHttp-after-pong.png at the resolved state.
//
// Per the frozen plan in features/ollama-http/plan.md.

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

type CapturedRequest = {
  method: string
  url: string
  body: unknown
}

function startStubServer(): Promise<{
  port: number
  captured: CapturedRequest[]
  close: () => Promise<void>
}> {
  return new Promise((resolve, reject) => {
    const captured: CapturedRequest[] = []
    const server = http.createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk.toString()
      })
      req.on('end', () => {
        let parsed: unknown = null
        try {
          parsed = JSON.parse(raw)
        } catch {
          parsed = raw
        }
        captured.push({
          method: req.method ?? '',
          url: req.url ?? '',
          body: parsed,
        })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            choices: [{ message: { content: 'pong' } }],
          })
        )
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
        captured,
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
    path.join(os.tmpdir(), 'todoz-ollama-http-userdata-')
  )
  const tmpVault = path.join(tmpUserData, 'vault')
  fs.mkdirSync(path.join(tmpVault, 'todos'), { recursive: true })
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
      env: {
        ...process.env,
        NODE_ENV: 'test',
        OLLAMA_API_URL: apiUrl,
      },
      timeout: 30_000,
    })
    const window: Page = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await window.waitForSelector('[data-command-bar]', { timeout: 10_000 })

    // Drive a chat send.
    const input = window.locator('[data-command-bar] input[type="text"]')
    await input.click()
    await input.type('ping', { delay: 5 })
    await input.press('Enter')

    // Wait for an assistant bubble that is not pending and not an error —
    // the resolved success bubble carrying the stub's "pong".
    await window.waitForSelector(
      '[data-message="assistant"]:not([data-pending]):not([data-error]) [data-message-text]',
      { state: 'attached', timeout: 10_000 }
    )

    const replyText = await window
      .locator(
        '[data-message="assistant"]:not([data-pending]):not([data-error]) [data-message-text]'
      )
      .textContent()
    record(
      'renderer assistant bubble shows the stub server response',
      replyText?.trim() === 'pong',
      `bubble text = "${replyText ?? '(null)'}"`
    )

    // Inspect the captured request on the stub side.
    const post = stub.captured.find((c) => c.method === 'POST')
    record(
      'stub server received a POST',
      post !== undefined,
      `captured count = ${stub.captured.length}`
    )

    if (post) {
      const body = post.body as {
        messages?: { role: string; content: string }[]
        stream?: boolean
      }
      const messages = body.messages ?? []
      // The user message is the last entry; with no VAULT.md it's index 0,
      // with one it's index 1. Plan asserts messages[1].content === "ping",
      // which matches the with-VAULT.md case. Pluck the user message by role
      // to stay robust against the optional system prefix.
      const userMsg = messages.find((m) => m.role === 'user')
      record(
        'request body has a user message with content "ping"',
        userMsg?.content === 'ping',
        `user content = ${JSON.stringify(userMsg?.content)}`
      )
      record(
        'request body has stream: false',
        body.stream === false,
        `stream = ${String(body.stream)}`
      )
    }

    const shot = path.join(SHOT_DIR, 'ollamaHttp-after-pong.png')
    await window.screenshot({ path: shot, fullPage: true })
    console.log(`Screenshot captured at ${shot}`)
  } catch (err) {
    record(
      'ollama-http verify scenario',
      false,
      err instanceof Error ? err.message : String(err)
    )
  } finally {
    if (app) await app.close().catch(() => undefined)
    await stub.close().catch(() => undefined)
    fs.rmSync(tmpUserData, { recursive: true, force: true })
  }

  console.log('\n=== ollama-http verify summary ===')
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
  console.error('ollama-http verify crashed:', err)
  process.exit(1)
})
