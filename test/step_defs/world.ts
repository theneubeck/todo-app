import { setWorldConstructor, World } from '@cucumber/cucumber'
import { JSDOM } from 'jsdom'

export interface FixtureTodo {
  path: string
  frontmatter: Record<string, unknown>
  body: string
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
  resolveOllama: ((text: string) => void) | null = null

  mountWindow(): void {
    this.dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      runScripts: 'dangerously',
      resources: 'usable',
    })
    this.ollamaCallCount = 0
    this.resolveOllama = null
    ;(this.dom.window as unknown as { todoz: unknown }).todoz = {
      readTodos: async () => this.fixtures,
      writeFile: async (path: string, content: string) => {
        this.lastWriteFilePath = path
        this.lastWriteFileContent = content
      },
      archiveFile: async (path: string) => {
        this.lastArchiveFilePath = path
      },
      runOllama: (): Promise<string> => {
        this.ollamaCallCount += 1
        return new Promise<string>((resolve) => {
          this.resolveOllama = resolve
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
