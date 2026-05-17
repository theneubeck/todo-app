import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import { mountApp } from '../../src/renderer/index'
import type { Task } from '../../src/renderer/data/parseTodo'

const FIXED_TODAY = '2026-05-17'

function makeTask(slug: string, title: string, tags: string[]): Task {
  return {
    slug,
    filePath: `test/fixtures/vault/todos/${slug}-2026-05-17.md`,
    title,
    status: 'todo',
    tags,
    created: FIXED_TODAY,
    raw: `---\ntitle: ${title}\nstatus: todo\ntags: [${tags.join(', ')}]\ncreated: ${FIXED_TODAY}\n---\n`,
    subtasks: [],
  }
}

function makeDom(tasks: Task[]): JSDOM {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    runScripts: 'dangerously',
    resources: 'usable',
  })
  ;(dom.window as unknown as { todoz: unknown }).todoz = {
    readTodos: async () => tasks,
    writeFile: async () => {},
    runOllama: async () => '',
    today: FIXED_TODAY,
  }
  return dom
}

function commandBarInput(doc: Document): HTMLInputElement {
  return doc.querySelector('[data-command-bar] input[type="text"]') as HTMLInputElement
}

function mainHeaderTitle(doc: Document): string {
  return doc.querySelector('[data-main-header] h1')?.textContent ?? ''
}

function fireInput(dom: JSDOM, input: HTMLInputElement, value: string): void {
  input.value = value
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}

function pressEnter(dom: JSDOM, input: HTMLInputElement): void {
  input.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  )
}

function tick(ms = 15): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe('GoTo command', () => {
  let dom: JSDOM
  let doc: Document

  beforeEach(async () => {
    dom = makeDom([
      makeTask('errands-task', 'Errands task', ['errands']),
      makeTask('mike-task', 'Mike task', ['@mike']),
    ])
    ;(globalThis as unknown as { window: unknown }).window = dom.window
    ;(globalThis as unknown as { document: unknown }).document = dom.window.document
    doc = dom.window.document
    await mountApp(doc.body)
  })

  it('sets the inbox filter when /goto inbox is submitted', async () => {
    const input = commandBarInput(doc)
    fireInput(dom, input, '/goto inbox')
    pressEnter(dom, input)
    await tick()
    expect(mainHeaderTitle(doc)).to.equal('Inbox')
    expect(input.value).to.equal('')
  })

  it('sets a project tag filter and clears input when /goto #errands is submitted', async () => {
    const input = commandBarInput(doc)
    fireInput(dom, input, '/goto #errands')
    pressEnter(dom, input)
    await tick()
    expect(mainHeaderTitle(doc)).to.equal('#errands')
    expect(input.value).to.equal('')
  })

  it('sets a people tag filter when /goto @mike is submitted', async () => {
    const input = commandBarInput(doc)
    fireInput(dom, input, '/goto @mike')
    pressEnter(dom, input)
    await tick()
    expect(mainHeaderTitle(doc)).to.equal('@mike')
    expect(input.value).to.equal('')
  })

  it('activates chat view when /goto chat is submitted', async () => {
    const input = commandBarInput(doc)
    fireInput(dom, input, '/goto chat')
    pressEnter(dom, input)
    await tick()
    const chatView = doc.querySelector('[data-chat-view]')
    expect(chatView).to.not.equal(null)
  })

  it('is a no-op and preserves input for /goto zzz', async () => {
    const input = commandBarInput(doc)
    fireInput(dom, input, '/goto zzz')
    pressEnter(dom, input)
    await tick()
    expect(mainHeaderTitle(doc)).to.equal('Inbox')
    expect(input.value).to.equal('/goto zzz')
  })

  it('pre-fills /goto when cmd+t is pressed', async () => {
    const input = commandBarInput(doc)
    input.value = ''
    doc.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        metaKey: true,
        key: 't',
        bubbles: true,
        cancelable: true,
      })
    )
    expect(input.value.startsWith('/goto ')).to.equal(true)
    expect(doc.activeElement).to.equal(input)
  })

  it('does not overwrite an existing /goto prefix on a second cmd+t', async () => {
    const input = commandBarInput(doc)
    input.value = '/goto inbox'
    doc.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        metaKey: true,
        key: 't',
        bubbles: true,
        cancelable: true,
      })
    )
    expect(input.value).to.equal('/goto inbox')
  })
})
