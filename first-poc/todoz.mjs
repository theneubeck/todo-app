// todoz.mjs
import { Ollama } from 'ollama'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import path from 'path'

const VAULT = '/Users/jens.carlen/code/testing/vibing/todoz'
const ollama = new Ollama()
const agentsMd = readFileSync(path.join(VAULT, 'AGENTS.md'), 'utf-8')

const tools = [{
  type: 'function',
  function: {
    name: 'write_file',
    description: 'Write a markdown file to the vault',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to vault root, e.g. todos/my-task-2026-05-04.md' },
        content: { type: 'string', description: 'Full file content including frontmatter' }
      },
      required: ['path', 'content']
    }
  }
}]

const messages = [
  { role: 'system', content: agentsMd },
  { role: 'user', content: process.argv[2] }
]

let response = await ollama.chat({ model: 'gemma4:e2b', messages, tools })

while (response.message.tool_calls?.length > 0) {
  messages.push(response.message)
  for (const call of response.message.tool_calls) {
    const { path: filePath, content } = call.function.arguments
    const fullPath = path.join(VAULT, filePath)
    mkdirSync(path.dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, content)
    console.log(`✓ ${filePath}`)
    messages.push({ role: 'tool', content: `written: ${filePath}` })
  }
  response = await ollama.chat({ model: 'gemma4:e2b', messages, tools })
}

console.log(response.message.content)