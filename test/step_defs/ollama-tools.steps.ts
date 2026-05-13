import { Given, Then, Before, After } from '@cucumber/cucumber'
import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { TodozWorld, QueuedOllamaResponse } from './world'
import { buildTaskFile } from '../../src/renderer/data/buildTaskFile'

// The chat-interface steps ("Given the chat view is active", "When the user
// types ... in the command bar and presses Enter") are reused from
// chat-interface.steps.ts. This file adds:
//
//  * the Given that pushes tool-call / normal-reply turns onto the world's
//    ollamaResponseQueue,
//  * the Then assertions for tool rows, file existence, frontmatter parsing,
//    and the final assistant bubble.

type ToolsWorld = TodozWorld & {
  otTmpVault?: string
  otWrittenPaths?: string[]
}

const FIXED_TODAY = '2026-05-13'

Before(function (this: ToolsWorld) {
  this.otTmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'todoz-ollama-tools-'))
  fs.mkdirSync(path.join(this.otTmpVault, 'todos'), { recursive: true })
  this.otWrittenPaths = []
  // Provide the add-task side-effect hook the world uses when it executes
  // queued tool calls. The hook writes the markdown file into the tmp vault's
  // todos folder so the Then steps can assert the file's presence.
  this.onAddTask = ({ title, tags }) => {
    const existing = this.otWrittenPaths!.map((p) => path.basename(p))
    const built = buildTaskFile({
      title,
      tags,
      today: FIXED_TODAY,
      existingFilenames: existing,
    })
    const filePath = path.join(this.otTmpVault!, 'todos', built.filename)
    fs.writeFileSync(filePath, built.content, 'utf-8')
    this.otWrittenPaths!.push(filePath)
    return { filename: built.filename, content: built.content, filePath }
  }
})

After(function (this: ToolsWorld) {
  if (this.otTmpVault && fs.existsSync(this.otTmpVault)) {
    fs.rmSync(this.otTmpVault, { recursive: true, force: true })
  }
})

function parseToolCallJson(
  jsonLiteral: string
): { name: string; arguments: Record<string, unknown> }[] {
  const parsed = JSON.parse(jsonLiteral) as {
    name: string
    arguments: Record<string, unknown>
  }[]
  return parsed
}

Given(
  'the next Ollama response is a tool call {string}',
  function (this: ToolsWorld, jsonLiteral: string) {
    const calls = parseToolCallJson(jsonLiteral)
    const turn: QueuedOllamaResponse = { kind: 'tool_calls', calls }
    this.ollamaResponseQueue.push(turn)
  }
)

Given(
  'the next Ollama response is a normal reply {string}',
  function (this: ToolsWorld, content: string) {
    const turn: QueuedOllamaResponse = { kind: 'normal_reply', content }
    this.ollamaResponseQueue.push(turn)
  }
)

Given(
  'the next Ollama response has no tool_calls and content {string}',
  function (this: ToolsWorld, content: string) {
    const turn: QueuedOllamaResponse = { kind: 'normal_reply', content }
    this.ollamaResponseQueue.push(turn)
  }
)

function matchByGlob(filename: string, pattern: string): boolean {
  // Convert the pattern (e.g. "buy-milk-*.md") to a regex.
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp('^' + escaped + '$').test(filename)
}

Then(
  'a task file matching {string} exists in the active vault todos folder',
  function (this: ToolsWorld, pattern: string) {
    const todosDir = path.join(this.otTmpVault!, 'todos')
    expect(
      fs.existsSync(todosDir),
      `expected vault todos folder to exist at ${todosDir}`
    ).to.equal(true)
    const found = fs.readdirSync(todosDir).filter((f) => matchByGlob(f, pattern))
    expect(
      found.length,
      `expected a file matching ${pattern} in ${todosDir} but found ${JSON.stringify(
        fs.readdirSync(todosDir)
      )}`
    ).to.be.greaterThan(0)
  }
)

function readMostRecentFrontmatter(vaultRoot: string): {
  title: string
  tags: string[]
} {
  const todosDir = path.join(vaultRoot, 'todos')
  const files = fs.readdirSync(todosDir).filter((f) => f.endsWith('.md'))
  expect(files.length, 'expected at least one written task file').to.be.greaterThan(
    0
  )
  // Pick the most recently modified file.
  const sorted = files
    .map((f) => ({
      f,
      mtime: fs.statSync(path.join(todosDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)
  const top = path.join(todosDir, sorted[0].f)
  const raw = fs.readFileSync(top, 'utf-8')
  const titleMatch = /^title:\s*"([^"]*)"/m.exec(raw)
  const tagsMatch = /^tags:\s*\[(.*)\]\s*$/m.exec(raw)
  const tags = tagsMatch
    ? tagsMatch[1]
        .split(',')
        .map((s) => s.trim().replace(/^"|"$/g, ''))
        .filter((s) => s.length > 0)
    : []
  return { title: titleMatch ? titleMatch[1] : '', tags }
}

Then(
  'the file frontmatter title equals {string}',
  function (this: ToolsWorld, expected: string) {
    const { title } = readMostRecentFrontmatter(this.otTmpVault!)
    expect(title).to.equal(expected)
  }
)

Then(
  'the file frontmatter tags include {string}',
  function (this: ToolsWorld, expected: string) {
    const { tags } = readMostRecentFrontmatter(this.otTmpVault!)
    expect(tags).to.include(expected)
  }
)

Then(
  'a tool row appears in the chat thread with action {string} and status {string}',
  function (this: ToolsWorld, action: string, status: string) {
    const rows = Array.from(
      this.document.querySelectorAll(`[data-message="tool"][data-tool-status="${status}"]`)
    )
    const match = rows.find((row) => {
      const actionEl = row.querySelector('[data-tool-action]')
      return actionEl?.textContent === action
    })
    expect(
      match,
      `expected a tool row with action "${action}" and status "${status}". Rows seen: ${JSON.stringify(
        rows.map((r) => r.querySelector('[data-tool-action]')?.textContent ?? '')
      )}`
    ).to.not.equal(undefined)
  }
)

Then(
  'the assistant final bubble reads {string}',
  function (this: ToolsWorld, expected: string) {
    const bubbles = Array.from(
      this.document.querySelectorAll(
        '[data-message="assistant"]:not([data-pending]):not([data-error])'
      )
    )
    expect(bubbles.length, 'expected at least one resolved assistant bubble').to.be.greaterThan(
      0
    )
    const last = bubbles[bubbles.length - 1]
    const text = last.querySelector('[data-message-text]')
    expect(text?.textContent).to.equal(expected)
  }
)
