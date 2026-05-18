import { describe, it, beforeEach } from 'mocha'
import { expect } from 'chai'
import { JSDOM } from 'jsdom'
import { mountApp } from '../../src/renderer/index'
import type { Task } from '../../src/renderer/data/parseTodo'

const FIXED_TODAY = '2026-05-17'

function makeTask(slug: string, title: string, tags: string[]): Task {
  return {
    slug,
    filePath: `test/fixtures/vault/todos/${slug}-${FIXED_TODAY}.md`,
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

describe('Read and Watch resources', () => {
  let dom: JSDOM
  let doc: Document

  beforeEach(async () => {
    dom = makeDom([
      makeTask('read-task', 'The Design of Everyday Things', [':read']),
      makeTask('watch-task', 'WWDC Session', [':watch']),
      makeTask('project-task', 'Some project task', ['work']),
    ])
    ;(globalThis as unknown as { window: unknown }).window = dom.window
    ;(globalThis as unknown as { document: unknown }).document = dom.window.document
    doc = dom.window.document
    await mountApp(doc.body)
  })

  it("renders [data-section='resources'] in the sidebar on mount", () => {
    const section = doc.querySelector('[data-section="resources"]')
    expect(section, '[data-section="resources"] should be present').to.not.equal(null)
  })

  it('resources section contains To Read and To Watch entries', () => {
    const section = doc.querySelector('[data-section="resources"]')
    expect(section).to.not.equal(null)
    const readEntry = section!.querySelector('[data-sidebar-entry=":read"]')
    const watchEntry = section!.querySelector('[data-sidebar-entry=":watch"]')
    expect(readEntry, '[data-sidebar-entry=":read"] should be present').to.not.equal(null)
    expect(watchEntry, '[data-sidebar-entry=":watch"] should be present').to.not.equal(null)
    expect(readEntry!.textContent).to.include('To Read')
    expect(watchEntry!.textContent).to.include('To Watch')
  })

  it('clicking To Read sets the main header to To Read', async () => {
    const readEntry = doc.querySelector('[data-sidebar-entry=":read"]') as HTMLElement
    expect(readEntry).to.not.equal(null)
    readEntry.click()
    await tick()
    const h1 = doc.querySelector('[data-main-header] h1')
    expect(h1?.textContent?.trim()).to.equal('To Read')
  })

  it('clicking To Watch sets the main header to To Watch', async () => {
    const watchEntry = doc.querySelector('[data-sidebar-entry=":watch"]') as HTMLElement
    expect(watchEntry).to.not.equal(null)
    watchEntry.click()
    await tick()
    const h1 = doc.querySelector('[data-main-header] h1')
    expect(h1?.textContent?.trim()).to.equal('To Watch')
  })

  it('resource tags do not appear in the PROJECTS section', () => {
    const projectsSection = doc.querySelector('[data-section="projects"]')
    if (projectsSection) {
      const readInProjects = projectsSection.querySelector('[data-sidebar-entry=":read"]')
      const watchInProjects = projectsSection.querySelector('[data-sidebar-entry=":watch"]')
      expect(readInProjects, ':read should not be in PROJECTS section').to.equal(null)
      expect(watchInProjects, ':watch should not be in PROJECTS section').to.equal(null)
    }
    // If the projects section doesn't exist, the test passes (no > tags leaked in)
  })

  it('filterLabel returns To Read for the :read tag filter', async () => {
    const input = doc.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    fireInput(dom, input, '/goto :read')
    pressEnter(dom, input)
    await tick()
    const h1 = doc.querySelector('[data-main-header] h1')
    expect(h1?.textContent?.trim()).to.equal('To Read')
  })

  it('filterLabel returns To Watch for the :watch tag filter', async () => {
    const input = doc.querySelector(
      '[data-command-bar] input[type="text"]'
    ) as HTMLInputElement
    fireInput(dom, input, '/goto :watch')
    pressEnter(dom, input)
    await tick()
    const h1 = doc.querySelector('[data-main-header] h1')
    expect(h1?.textContent?.trim()).to.equal('To Watch')
  })
})
