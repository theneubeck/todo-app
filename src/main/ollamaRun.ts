// Pure helpers for the `run-ollama` IPC handler. No fetch, no fs, no side
// effects — these functions resolve env-var-driven configuration and build /
// parse OpenAI-compatible HTTP request and response payloads.

export type OllamaResult =
  | { ok: true; reply: string }
  | { ok: false; error: string; statusCode: number }

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
