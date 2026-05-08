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

  mountWindow(): void {
    this.dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      runScripts: 'dangerously',
      resources: 'usable',
    })
    ;(this.dom.window as unknown as { todoz: unknown }).todoz = {
      readTodos: async () => this.fixtures,
      writeFile: async (path: string, content: string) => {
        this.lastWriteFilePath = path
        this.lastWriteFileContent = content
      },
      archiveFile: async (path: string) => {
        this.lastArchiveFilePath = path
      },
      runOllama: async () => '',
    }
  }

  get document(): Document {
    if (!this.dom) throw new Error('JSDOM not mounted - call mountWindow() first')
    return this.dom.window.document
  }
}

setWorldConstructor(TodozWorld)
