// Pure helpers extracted from the `run-ollama` IPC handler. No spawn, no fs, no
// side effects — these functions classify subprocess results and resolve the
// model name from the environment, and are unit-testable in isolation.

export type OllamaResult =
  | { ok: true; reply: string }
  | { ok: false; error: string; exitCode: number }

const STDERR_TAIL_CHARS = 200

const DEFAULT_MODEL = 'gemma3:4b'

export function classifyOllamaResult(input: {
  exitCode: number
  stdout: string
  stderr: string
}): OllamaResult {
  const trimmed = input.stdout.trim()
  if (input.exitCode === 0 && trimmed.length > 0) {
    return { ok: true, reply: trimmed }
  }
  const stderrTail = input.stderr.slice(-STDERR_TAIL_CHARS).trim()
  if (input.exitCode !== 0) {
    const detail =
      stderrTail.length > 0
        ? stderrTail
        : `ollama exited with code ${input.exitCode}`
    return { ok: false, error: detail, exitCode: input.exitCode }
  }
  // exit 0 but empty stdout — treat as failure so the renderer can surface it.
  const detail =
    stderrTail.length > 0
      ? stderrTail
      : 'ollama produced no output'
  return { ok: false, error: detail, exitCode: 0 }
}

export function resolveOllamaModel(env: NodeJS.ProcessEnv): string {
  const v = env.OLLAMA_MODEL
  if (typeof v === 'string' && v.length > 0) return v
  return DEFAULT_MODEL
}
