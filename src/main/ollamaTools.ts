// OpenAI-compatible tool-calling helpers for the chat IPC handler.
//
// Pure functions: build the request body (extending buildOllamaRequest by
// adding `tools` and `tool` role messages), parse `tool_calls` entries from
// the response, and produce the file contents for an `add_task` invocation.
// The actual fs write is performed by the main-process handler in src/main.ts;
// this module never touches the filesystem.

import { buildTaskFile } from '../renderer/data/buildTaskFile'

export const SYSTEM_PROMPT_ADDENDUM =
  'Use tools when the user gives a concrete instruction. Ask a clarifying question first only when essential information is missing.'

type AddTaskParameters = {
  type: 'object'
  properties: {
    title: { type: 'string'; description: string }
    tags: {
      type: 'array'
      items: { type: 'string' }
      description: string
    }
  }
  required: ['title']
}

export type OllamaTool = {
  type: 'function'
  function: {
    name: 'add_task'
    description: string
    parameters: AddTaskParameters
  }
}

export const OLLAMA_TOOLS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'add_task',
      description:
        'Create a new task in the active vault. Use this when the user gives a concrete instruction to add a task or break a request into multiple tasks.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short task title',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional tag list, used to group tasks under a project (e.g. ["go-to-store"])',
          },
        },
        required: ['title'],
      },
    },
  },
]

export type RawToolCall = {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export type AddTaskArgs = {
  title: string
  tags?: string[]
}

export type ParsedToolCall =
  | {
      ok: true
      callId: string
      name: 'add_task'
      args: AddTaskArgs
      argumentsRaw: string
    }
  | {
      ok: false
      callId: string
      name: string
      argumentsRaw: string
      error: string
    }

export function parseToolCall(raw: RawToolCall): ParsedToolCall {
  const callId = raw.id
  const name = raw.function.name
  const argsRaw = raw.function.arguments
  if (name !== 'add_task') {
    return {
      ok: false,
      callId,
      name,
      argumentsRaw: argsRaw,
      error: `unknown tool: ${name}`,
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(argsRaw)
  } catch {
    return {
      ok: false,
      callId,
      name,
      argumentsRaw: argsRaw,
      error: `add_task: invalid JSON arguments`,
    }
  }
  const obj = (parsed ?? {}) as Record<string, unknown>
  const title = obj.title
  if (typeof title !== 'string' || title.trim().length === 0) {
    return {
      ok: false,
      callId,
      name,
      argumentsRaw: argsRaw,
      error: `add_task: missing required argument 'title'`,
    }
  }
  const rawTags = obj.tags
  let tags: string[] | undefined
  if (Array.isArray(rawTags)) {
    tags = rawTags.filter((t): t is string => typeof t === 'string')
  }
  return {
    ok: true,
    callId,
    name: 'add_task',
    args: { title, ...(tags !== undefined ? { tags } : {}) },
    argumentsRaw: argsRaw,
  }
}

export type ExecuteAddTaskOpts = {
  today: string
  existingFilenames: string[]
}

export type ExecuteAddTaskResult = {
  filename: string
  content: string
}

export function executeAddTask(
  args: AddTaskArgs,
  opts: ExecuteAddTaskOpts
): ExecuteAddTaskResult {
  const tags = args.tags ?? []
  return buildTaskFile({
    title: args.title,
    tags,
    today: opts.today,
    existingFilenames: opts.existingFilenames,
  })
}

type PriorToolCall = {
  id: string
  name: string
  argumentsRaw: string
}

type PriorToolResult = {
  callId: string
  content: string
}

export type BuildToolsRequestInput = {
  apiUrl: string
  model: string
  systemPrompt: string
  userPrompt: string
  priorToolCalls?: PriorToolCall[]
  priorToolResults?: PriorToolResult[]
}

type OutgoingMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | {
      role: 'assistant'
      content: string
      tool_calls?: {
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }[]
    }
  | { role: 'tool'; tool_call_id: string; content: string }

export function buildOllamaToolsRequest(input: BuildToolsRequestInput): {
  url: string
  init: RequestInit
} {
  const messages: OutgoingMessage[] = []
  const sys =
    input.systemPrompt.trim().length > 0
      ? `${SYSTEM_PROMPT_ADDENDUM}\n\n${input.systemPrompt}`
      : SYSTEM_PROMPT_ADDENDUM
  messages.push({ role: 'system', content: sys })
  messages.push({ role: 'user', content: input.userPrompt })

  const priorCalls = input.priorToolCalls ?? []
  const priorResults = input.priorToolResults ?? []
  if (priorCalls.length > 0) {
    messages.push({
      role: 'assistant',
      content: '',
      tool_calls: priorCalls.map((c) => ({
        id: c.id,
        type: 'function' as const,
        function: { name: c.name, arguments: c.argumentsRaw },
      })),
    })
  }
  for (const r of priorResults) {
    messages.push({ role: 'tool', tool_call_id: r.callId, content: r.content })
  }
  const body = JSON.stringify({
    model: input.model,
    messages,
    stream: false,
    tools: OLLAMA_TOOLS,
  })
  return {
    url: input.apiUrl,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  }
}
