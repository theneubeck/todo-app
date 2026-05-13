// Pure helpers for the `run-ollama` IPC handler. No fetch, no fs, no side
// effects — these functions resolve env-var-driven configuration and build /
// parse OpenAI-compatible HTTP request and response payloads.

export type ToolEvent = {
  callId: string
  name: string
  argsRaw: string
  status: 'ok' | 'error'
  resultContent: string
  // Renderer-facing summary fields. Optional in the wire-shape; the renderer
  // falls back to `name` / `resultContent` when these are absent.
  action?: string
  error?: string
}

export type OllamaResult =
  | { ok: true; reply: string; toolEvents?: ToolEvent[] }
  | { ok: false; error: string; statusCode: number; toolEvents?: ToolEvent[] }

const DEFAULT_MODEL = 'gemma4:e2b'
// Default to IPv4 explicitly: Node 20's fetch resolves `localhost` to ::1 on
// machines where IPv6 is preferred, but Ollama listens on 127.0.0.1 only by
// default. Hardcoding the IPv4 address dodges the resolution mismatch.
const DEFAULT_API_URL = 'http://127.0.0.1:11434/v1/chat/completions'
const ERROR_BODY_TAIL_CHARS = 200

export function resolveOllamaModel(env: NodeJS.ProcessEnv): string {
  const v = env.OLLAMA_MODEL
  if (typeof v === 'string' && v.length > 0) return v
  return DEFAULT_MODEL
}

export function resolveOllamaApiUrl(env: NodeJS.ProcessEnv): string {
  const v = env.OLLAMA_API_URL
  if (typeof v === 'string' && v.length > 0) return v
  return DEFAULT_API_URL
}

type OllamaMessage = { role: 'system' | 'user'; content: string }

export function buildOllamaRequest(input: {
  apiUrl: string
  model: string
  systemPrompt: string
  userPrompt: string
}): { url: string; init: RequestInit } {
  const messages: OllamaMessage[] = []
  if (input.systemPrompt.trim().length > 0) {
    messages.push({ role: 'system', content: input.systemPrompt })
  }
  messages.push({ role: 'user', content: input.userPrompt })
  const body = JSON.stringify({
    model: input.model,
    messages,
    stream: false,
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

export function parseOllamaResponse(input: {
  status: number
  body: string
}): OllamaResult {
  if (input.status !== 200) {
    const tail = input.body.slice(-ERROR_BODY_TAIL_CHARS).trim()
    const detail =
      tail.length > 0
        ? tail
        : `ollama API returned status ${input.status}`
    return { ok: false, error: detail, statusCode: input.status }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(input.body)
  } catch {
    return {
      ok: false,
      error: 'invalid JSON body from API',
      statusCode: 200,
    }
  }
  const choices = (parsed as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) {
    return {
      ok: false,
      error: 'empty or malformed response',
      statusCode: 200,
    }
  }
  const first = choices[0] as { message?: { content?: unknown } } | undefined
  const content = first?.message?.content
  if (typeof content !== 'string' || content.trim().length === 0) {
    return {
      ok: false,
      error: 'empty or malformed response',
      statusCode: 200,
    }
  }
  return { ok: true, reply: content.trim() }
}

// Wire-shape returned by `parseOllamaToolsResponse` — distinguishes a
// content-only response (loop terminates) from a tool_calls response (loop
// must execute calls and re-request). Errors mirror parseOllamaResponse.
export type ToolsParseResult =
  | { kind: 'content'; reply: string }
  | {
      kind: 'tool_calls'
      calls: {
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }[]
    }
  | { kind: 'error'; error: string; statusCode: number }

export function parseOllamaToolsResponse(input: {
  status: number
  body: string
}): ToolsParseResult {
  if (input.status !== 200) {
    const tail = input.body.slice(-ERROR_BODY_TAIL_CHARS).trim()
    const detail =
      tail.length > 0 ? tail : `ollama API returned status ${input.status}`
    return { kind: 'error', error: detail, statusCode: input.status }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(input.body)
  } catch {
    return { kind: 'error', error: 'invalid JSON body from API', statusCode: 200 }
  }
  const choices = (parsed as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) {
    return { kind: 'error', error: 'empty or malformed response', statusCode: 200 }
  }
  const first = choices[0] as {
    message?: {
      content?: unknown
      tool_calls?: unknown
    }
  } | undefined
  const rawToolCalls = first?.message?.tool_calls
  if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
    const calls = rawToolCalls
      .map((c, i) => {
        const obj = c as {
          id?: unknown
          function?: { name?: unknown; arguments?: unknown }
        }
        const id = typeof obj.id === 'string' ? obj.id : `call_${i + 1}`
        const name = typeof obj.function?.name === 'string' ? obj.function.name : ''
        const argsRaw =
          typeof obj.function?.arguments === 'string'
            ? obj.function.arguments
            : JSON.stringify(obj.function?.arguments ?? {})
        return {
          id,
          type: 'function' as const,
          function: { name, arguments: argsRaw },
        }
      })
      .filter((c) => c.function.name.length > 0)
    if (calls.length > 0) return { kind: 'tool_calls', calls }
  }
  const content = first?.message?.content
  if (typeof content !== 'string' || content.trim().length === 0) {
    return { kind: 'error', error: 'empty or malformed response', statusCode: 200 }
  }
  return { kind: 'content', reply: content.trim() }
}
