import { setWorldConstructor, World } from '@cucumber/cucumber'
import { JSDOM } from 'jsdom'

export interface FixtureTodo {
  path: string
  frontmatter: Record<string, unknown>
  body: string
}

export type OllamaResult =
  | { ok: true; reply: string }
  | { ok: false; error: string; exitCode: number }

export type OllamaResolveInput = string | OllamaResult

function normalizeOllamaResolve(input: OllamaResolveInput): OllamaResult {
  if (typeof input === 'string') return { ok: true, reply: input }
  return input
}

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

  mountWindow(): void {
    this.dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      runScripts: 'dangerously',
      resources: 'usable',
    })
    this.ollamaCallCount = 0
    this.resolveOllama = null
    this.nextOllamaResolveWith = null
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

  get document(): Document {
    if (!this.dom) throw new Error('JSDOM not mounted - call mountWindow() first')
    return this.dom.window.document
  }
}

setWorldConstructor(TodozWorld)
