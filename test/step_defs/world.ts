import { setWorldConstructor, World } from '@cucumber/cucumber'
import { JSDOM } from 'jsdom'

export interface FixtureTodo {
  path: string
  frontmatter: Record<string, unknown>
  body: string
}

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

export type OllamaResolveInput = string | OllamaResult

function normalizeOllamaResolve(input: OllamaResolveInput): OllamaResult {
  if (typeof input === 'string') return { ok: true, reply: input }
  return input
}

// A canned response in the Ollama queue. Either a "tool call" turn (executed
// before the final answer) or a "normal reply" turn that terminates the loop.
// The world's runOllama collapses any leading tool-call turns into the final
// reply's toolEvents array, matching the main-process multi-turn contract.
export type QueuedOllamaResponse =
  | { kind: 'tool_calls'; calls: { name: string; arguments: Record<string, unknown> }[] }
  | { kind: 'normal_reply'; content: string }
  | { kind: 'error'; error: string; statusCode: number }

export class TodozWorld extends World {
  fixtures: FixtureTodo[] = []
  dom?: JSDOM
  lastWriteFilePath?: string
  lastWriteFileContent?: string
  lastArchiveFilePath?: string
  appSettingsPath?: string
  // Per-scenario list of fixture file paths created at runtime; the After
  // hook unlinks each path. Owned by the status-reconciliation feature but
  // safe to share — all features can opt in by pushing to this array.
  createdFixtures: string[] = []
  initialRemainingCount?: number
  // Chat-interface bookkeeping. Tests assert no Ollama call was made for
  // slash commands; the auto-activate scenario relies on a controllable
  // pending Promise so the verifier can observe the pending state before
  // resolution.
  ollamaCallCount = 0
  // The world's resolver accepts either a bare string (back-compat with the
  // chat-interface tests written against `Promise<string>`) or the new
  // result-object shape. The renderer normalizes both.
  resolveOllama: ((input: OllamaResolveInput) => void) | null = null
  // The next runOllama call resolves with this preset value if non-null
  // (used by the ollama-diagnostics failure scenarios). After it is consumed
  // it is reset to null so subsequent calls fall back to the controllable
  // pending-promise path.
  nextOllamaResolveWith: OllamaResolveInput | null = null
  // ollama-tools feature: queue of canned responses simulating the
  // multi-turn loop. The world's runOllama mock collapses any leading
  // tool_calls turns into the toolEvents of the final reply turn.
  ollamaResponseQueue: QueuedOllamaResponse[] = []
  // Test-friendly hook so step defs can drive add_task side effects (writing
  // markdown files to a tmp vault directory). The world calls this for each
  // queued tool call; the step defs provide a vault-aware implementation.
  onAddTask: ((args: { title: string; tags: string[] }) => {
    filename: string
    content: string
    filePath: string
  }) | null = null

  mountWindow(): void {
    this.dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      runScripts: 'dangerously',
      resources: 'usable',
    })
    this.ollamaCallCount = 0
    this.resolveOllama = null
    this.nextOllamaResolveWith = null
    this.ollamaResponseQueue = []
    // NB: do not reset `onAddTask` here. The ollama-tools feature's Before
    // hook installs the hook before mountWindow runs (via the chat-view
    // Given), and the hook must survive that mount call.
    ;(this.dom.window as unknown as { todoz: unknown }).todoz = {
      readTodos: async () => this.fixtures,
      writeFile: async (path: string, content: string) => {
        this.lastWriteFilePath = path
        this.lastWriteFileContent = content
      },
      archiveFile: async (path: string) => {
        this.lastArchiveFilePath = path
      },
      runOllama: (): Promise<OllamaResult> => {
        this.ollamaCallCount += 1
        if (this.ollamaResponseQueue.length > 0) {
          return Promise.resolve(this.consumeOllamaQueue())
        }
        if (this.nextOllamaResolveWith !== null) {
          const preset = this.nextOllamaResolveWith
          this.nextOllamaResolveWith = null
          return Promise.resolve(normalizeOllamaResolve(preset))
        }
        return new Promise<OllamaResult>((resolve) => {
          this.resolveOllama = (input: OllamaResolveInput) => {
            resolve(normalizeOllamaResolve(input))
          }
        })
      },
    }
  }

  // Collapse the queue into a single OllamaResult.
  // Leading tool_calls turns produce toolEvents (and trigger onAddTask file
  // writes); the first normal_reply (or error) terminates the loop and
  // supplies the final reply text.
  consumeOllamaQueue(): OllamaResult {
    const toolEvents: ToolEvent[] = []
    let callCounter = 0
    while (this.ollamaResponseQueue.length > 0) {
      const next = this.ollamaResponseQueue.shift()!
      if (next.kind === 'tool_calls') {
        for (const c of next.calls) {
          callCounter += 1
          const callId = `call_${callCounter}`
          const argsRaw = JSON.stringify(c.arguments)
          if (c.name !== 'add_task') {
            toolEvents.push({
              callId,
              name: c.name,
              argsRaw,
              status: 'error',
              resultContent: `unknown tool: ${c.name}`,
              action: c.name,
              error: `unknown tool: ${c.name}`,
            })
            continue
          }
          const title = c.arguments.title
          if (typeof title !== 'string' || title.trim().length === 0) {
            toolEvents.push({
              callId,
              name: 'add_task',
              argsRaw,
              status: 'error',
              resultContent: "add_task: missing required argument 'title'",
              action: 'add_task',
              error: "add_task: missing required argument 'title'",
            })
            continue
          }
          const tagsRaw = c.arguments.tags
          const tags = Array.isArray(tagsRaw)
            ? (tagsRaw.filter((t) => typeof t === 'string') as string[])
            : []
          let resultContent = `written: ${title}`
          if (this.onAddTask) {
            const written = this.onAddTask({ title, tags })
            resultContent = written.filePath
          }
          const tagSuffix = tags.length > 0 ? ' ' + tags.map((t) => `#${t}`).join(' ') : ''
          toolEvents.push({
            callId,
            name: 'add_task',
            argsRaw,
            status: 'ok',
            resultContent,
            action: `add_task: ${title}${tagSuffix}`,
          })
        }
        continue
      }
      if (next.kind === 'normal_reply') {
        return { ok: true, reply: next.content, toolEvents }
      }
      // error
      return {
        ok: false,
        error: next.error,
        statusCode: next.statusCode,
        toolEvents,
      }
    }
    // Queue drained without a terminating reply — emit empty reply with the
    // captured tool events.
    return { ok: true, reply: '', toolEvents }
  }

  get document(): Document {
    if (!this.dom) throw new Error('JSDOM not mounted - call mountWindow() first')
    return this.dom.window.document
  }
}

setWorldConstructor(TodozWorld)
