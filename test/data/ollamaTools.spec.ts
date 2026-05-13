import { describe, it } from 'mocha'
import { expect } from 'chai'
import {
  OLLAMA_TOOLS,
  SYSTEM_PROMPT_ADDENDUM,
  parseToolCall,
  executeAddTask,
  buildOllamaToolsRequest,
} from '../../src/main/ollamaTools'

describe('OLLAMA_TOOLS', () => {
  it('declares add_task with required title argument', () => {
    expect(OLLAMA_TOOLS).to.have.lengthOf(1)
    const tool = OLLAMA_TOOLS[0]
    expect(tool.type).to.equal('function')
    expect(tool.function.name).to.equal('add_task')
    expect(tool.function.parameters.required).to.deep.equal(['title'])
    expect(tool.function.parameters.properties.title.type).to.equal('string')
  })

  it('declares add_task with optional tags array argument', () => {
    const tool = OLLAMA_TOOLS[0]
    const tagsProp = tool.function.parameters.properties.tags
    expect(tagsProp.type).to.equal('array')
    expect(tagsProp.items.type).to.equal('string')
  })
})

describe('parseToolCall', () => {
  it('returns ok with name and arguments for a valid add_task call', () => {
    const result = parseToolCall({
      id: 'call_1',
      type: 'function',
      function: {
        name: 'add_task',
        arguments: JSON.stringify({ title: 'buy milk' }),
      },
    })
    expect(result.ok).to.equal(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.callId).to.equal('call_1')
    expect(result.name).to.equal('add_task')
    expect(result.args.title).to.equal('buy milk')
  })

  it('returns error when the function name is unknown', () => {
    const result = parseToolCall({
      id: 'call_2',
      type: 'function',
      function: {
        name: 'do_something_else',
        arguments: '{}',
      },
    })
    expect(result.ok).to.equal(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).to.contain('unknown tool')
  })

  it('returns error when arguments JSON fails to parse', () => {
    const result = parseToolCall({
      id: 'call_3',
      type: 'function',
      function: {
        name: 'add_task',
        arguments: 'not json {',
      },
    })
    expect(result.ok).to.equal(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).to.contain('invalid JSON')
  })

  it('returns error when the required title argument is missing', () => {
    const result = parseToolCall({
      id: 'call_4',
      type: 'function',
      function: {
        name: 'add_task',
        arguments: JSON.stringify({ tags: ['x'] }),
      },
    })
    expect(result.ok).to.equal(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).to.equal("add_task: missing required argument 'title'")
  })

  it('filters non-string entries out of the tags array', () => {
    const result = parseToolCall({
      id: 'call_5',
      type: 'function',
      function: {
        name: 'add_task',
        arguments: JSON.stringify({ title: 'x', tags: ['ok', 42, null, 'also-ok'] }),
      },
    })
    expect(result.ok).to.equal(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.args.tags).to.deep.equal(['ok', 'also-ok'])
  })
})

describe('executeAddTask', () => {
  it('returns a built task-file content matching title and tags', () => {
    const out = executeAddTask(
      { title: 'buy milk', tags: ['go-to-store'] },
      { today: '2026-05-13', existingFilenames: [] }
    )
    expect(out.content).to.match(/title:\s*"buy milk"/)
    expect(out.content).to.match(/tags:\s*\[go-to-store\]/)
  })

  it('returns a filename based on the slugified title and today date', () => {
    const out = executeAddTask(
      { title: 'Buy Milk Today', tags: [] },
      { today: '2026-05-13', existingFilenames: [] }
    )
    expect(out.filename).to.equal('buy-milk-today-2026-05-13.md')
  })

  it('falls back to an empty tags array when tags is omitted', () => {
    const out = executeAddTask(
      { title: 'buy milk' },
      { today: '2026-05-13', existingFilenames: [] }
    )
    expect(out.content).to.match(/tags:\s*\[\]/)
  })
})

describe('buildOllamaToolsRequest', () => {
  function parseBody(init: RequestInit): {
    model: string
    messages: { role: string; content: string; tool_call_id?: string }[]
    stream: boolean
    tools: unknown[]
  } {
    return JSON.parse(init.body as string) as {
      model: string
      messages: { role: string; content: string; tool_call_id?: string }[]
      stream: boolean
      tools: unknown[]
    }
  }

  it('extends buildOllamaRequest with the tools array', () => {
    const { init } = buildOllamaToolsRequest({
      apiUrl: 'http://x',
      model: 'gemma4:e2b',
      systemPrompt: 'sys',
      userPrompt: 'hi',
      priorToolResults: [],
    })
    const body = parseBody(init)
    expect(body.tools).to.have.lengthOf(1)
  })

  it('includes the system prompt addendum about tools', () => {
    const { init } = buildOllamaToolsRequest({
      apiUrl: 'http://x',
      model: 'gemma4:e2b',
      systemPrompt: 'VAULT schema...',
      userPrompt: 'hi',
      priorToolResults: [],
    })
    const body = parseBody(init)
    const sys = body.messages[0]
    expect(sys.role).to.equal('system')
    expect(sys.content).to.contain(SYSTEM_PROMPT_ADDENDUM)
    expect(sys.content).to.contain('VAULT schema')
    expect(sys.content.indexOf(SYSTEM_PROMPT_ADDENDUM)).to.be.lessThan(
      sys.content.indexOf('VAULT schema')
    )
  })

  it('places prior tool results as tool role messages keyed by tool_call_id', () => {
    const { init } = buildOllamaToolsRequest({
      apiUrl: 'http://x',
      model: 'gemma4:e2b',
      systemPrompt: '',
      userPrompt: 'hi',
      priorToolCalls: [
        { id: 'call_1', name: 'add_task', argumentsRaw: '{"title":"x"}' },
      ],
      priorToolResults: [{ callId: 'call_1', content: 'ok' }],
    })
    const body = parseBody(init)
    const toolMsg = body.messages.find((m) => m.role === 'tool')
    expect(toolMsg).to.not.equal(undefined)
    expect(toolMsg!.tool_call_id).to.equal('call_1')
    expect(toolMsg!.content).to.equal('ok')
  })
})
