---
name: Ollama HTTP transport
slug: ollama-http
status: planned
frozen: true
created: 2026-05-12
---

# Ollama HTTP transport

## Pattern summary

The `run-ollama` IPC handler in `src/main.ts:85-102` currently shells out to the `ollama` CLI via `child_process.spawn`, captures stdout, and surfaces stderr / exit-code failures via the `ollama-diagnostics` result object. This plan replaces the subprocess transport with an HTTP POST to the OpenAI-compatible `/v1/chat/completions` endpoint that Ollama exposes natively at `http://localhost:11434/v1/chat/completions` and that almost every other local LLM server (LM Studio, vLLM, llama.cpp's server) and most cloud APIs (OpenAI, OpenRouter, etc.) speak with the same request/response shape. The endpoint URL becomes configurable via `OLLAMA_API_URL`; the existing `OLLAMA_MODEL` env var still selects the model. The user-facing IPC contract is preserved — `runOllama(prompt)` still returns `{ ok, reply?, error?, statusCode? }` — only the transport changes and the prior `exitCode` field is renamed `statusCode` to reflect HTTP. The system prompt (read from `VAULT.md` at repo root, behavior introduced in the chat-interface plan) becomes the first message in the `messages` array with `role: "system"`, the user prompt becomes the second with `role: "user"`. `stream: false` keeps the full response buffered before returning to the renderer, matching today's behavior. Node 20's built-in `fetch` is used — no new dependency. Logging keeps the `[ollama]` prefix used by `ollama-diagnostics`; `[ollama stderr]` is dropped (no stderr concept in HTTP) and replaced by `[ollama error]` lines that include the status code or thrown-error message. The renderer's chat error-bubble path from `ollama-diagnostics` is unchanged.

**In scope:** `src/main/ollamaRun.ts` helpers refactored from subprocess result classification to HTTP request/response shape: drop `classifyOllamaResult`, add `buildOllamaRequest`, `parseOllamaResponse`, and `resolveOllamaApiUrl`; `resolveOllamaModel` stays as-is; `src/main.ts` `run-ollama` handler swapped from `spawn` to `fetch` with the same `Promise<OllamaResult>` shape; `OllamaResult` type updated (`exitCode` → `statusCode`); env var `OLLAMA_API_URL` exposed with default `http://localhost:11434/v1/chat/completions`; a new verify script that starts a local HTTP stub server, points `OLLAMA_API_URL` at it, drives a chat send through the real Electron app, and asserts the request body shape on the server side and the response bubble in the UI.

**Out of scope:** streaming responses (still buffered; `stream: false` in the request); auth headers / API keys (cloud-provider support — deferred to a follow-up plan if needed); conversation memory (each `runOllama` call still constructs a fresh two-message array); retries on 5xx or network errors; rate-limit handling; provider-specific quirks (per-provider response shape variations beyond the OpenAI baseline); renaming the IPC channel from `run-ollama` to something more generic (`run-llm` etc. — minimum-blast-radius keeps the existing name); deleting the `child_process` import from `src/main.ts` if nothing else uses it (Implement decides during refactor).

## Acceptance criteria

1. Given a successful 200 response from the configured API URL with a valid OpenAI-compat body `{"choices":[{"message":{"content":"hello world"}}]}`, when the IPC handler resolves, then it returns `{ ok: true, reply: "hello world" }`.
2. Given a non-200 HTTP response (e.g., 500 with `{"error":"model not found"}`), when the IPC handler resolves, then it returns `{ ok: false, error: <descriptive string>, statusCode: <the HTTP status> }`.
3. Given `fetch` throws (network error / `ECONNREFUSED`), when the IPC handler resolves, then it returns `{ ok: false, error: <fetch error message>, statusCode: -1 }` and `console.log` emits a line containing `[ollama error]` plus the error message.
4. Given `OLLAMA_API_URL` is set to `http://example.test/v1/chat/completions`, when the handler builds the request, then `fetch` is called with that exact URL.
5. Given `OLLAMA_API_URL` is unset (or empty), when the handler builds the request, then the URL defaults to `http://localhost:11434/v1/chat/completions`.
6. Given a non-empty system prompt and a user prompt, when the request body is built, then it contains `messages = [{role:"system", content:<system>}, {role:"user", content:<user>}]` and `stream: false` and the resolved model name.
7. Given an empty / missing `VAULT.md`, when the request body is built, then the `messages` array contains only the user message (the `system` entry is omitted, not sent with empty content).

## Step-definition file

**Not applicable.** This plan has no Gherkin scenarios — same skill deviation as `headless-test-mode`, `package`, and `ollama-diagnostics`-the-unit-AC-portion. All seven ACs are exercised by unit tests on the pure helpers (`buildOllamaRequest`, `parseOllamaResponse`, `resolveOllamaApiUrl`) plus the new verify script that boots a stub HTTP server. The renderer behavior does NOT change — the existing `chat-interface` Gherkin scenarios and the `ollama-diagnostics` Gherkin scenario continue to cover the user-facing chat path against the world's mocked `runOllama`. The world's mock returns the same `OllamaResult` shape; only the `exitCode` field is renamed to `statusCode` in the type, which propagates to the few test sites that reference it.

## BDD test list

[file: test/data/ollamaRun.spec.ts]  ← REPLACE the existing file (the prior `classifyOllamaResult` tests are removed along with the function)

- `describe("resolveOllamaApiUrl")` > `it("returns the env var value when OLLAMA_API_URL is set")`
- `describe("resolveOllamaApiUrl")` > `it("returns the default localhost URL when OLLAMA_API_URL is unset")`
- `describe("resolveOllamaApiUrl")` > `it("returns the default when OLLAMA_API_URL is an empty string")`
- `describe("resolveOllamaModel")` > `it("returns the env var value when OLLAMA_MODEL is set")` (REUSED from prior plan — keep verbatim)
- `describe("resolveOllamaModel")` > `it("returns the default gemma4:e2b when OLLAMA_MODEL is unset")` (REUSED)
- `describe("resolveOllamaModel")` > `it("returns the default when OLLAMA_MODEL is an empty string")` (REUSED)
- `describe("buildOllamaRequest")` > `it("uses the configured api URL")`
- `describe("buildOllamaRequest")` > `it("sets POST as the method")`
- `describe("buildOllamaRequest")` > `it("sets Content-Type application/json on the headers")`
- `describe("buildOllamaRequest")` > `it("sets the resolved model name in the body")`
- `describe("buildOllamaRequest")` > `it("places the system prompt first with role system")`
- `describe("buildOllamaRequest")` > `it("places the user prompt next with role user")`
- `describe("buildOllamaRequest")` > `it("omits the system message when systemPrompt is empty")`
- `describe("buildOllamaRequest")` > `it("sets stream to false")`
- `describe("parseOllamaResponse")` > `it("returns ok true with trimmed content on 200")`
- `describe("parseOllamaResponse")` > `it("returns ok false with the statusCode on non-200")`
- `describe("parseOllamaResponse")` > `it("returns ok false when choices array is missing")`
- `describe("parseOllamaResponse")` > `it("returns ok false when choices[0].message.content is missing")`
- `describe("parseOllamaResponse")` > `it("returns ok false when the JSON body fails to parse")`

No new Tallahassee/DOM tests for this feature — renderer behavior is unchanged.

## File map

### New files
- `test/verify/ollamaHttp.verify.ts` — Playwright + Node HTTP server. Starts a tiny `http.createServer` listening on an ephemeral port, sets `OLLAMA_API_URL=http://localhost:<port>/v1/chat/completions` in the Electron child's env, drives the chat view to send "ping", asserts on the server side that the inbound POST body has `messages[1].content === "ping"` and `stream: false`, responds with a valid OpenAI-compat shape `{"choices":[{"message":{"content":"pong"}}]}`, then asserts on the Playwright side that the resulting assistant bubble's `[data-message-text]` equals "pong". Captures `tmp/ollamaHttp-after-pong.png`. Shuts down the stub server on exit.

### Files to update
- `src/main/ollamaRun.ts`:
  - Remove `classifyOllamaResult` and its `STDERR_TAIL_CHARS` constant (no longer needed — no stderr).
  - Add `resolveOllamaApiUrl(env: NodeJS.ProcessEnv): string` mirroring `resolveOllamaModel`'s shape. Default `'http://localhost:11434/v1/chat/completions'`.
  - Add `buildOllamaRequest({ apiUrl, model, systemPrompt, userPrompt })` returning `{ url: string, init: RequestInit }`. The `init` carries `method: 'POST'`, `headers: { 'Content-Type': 'application/json' }`, and a JSON-stringified body with the model + messages + `stream: false` shape. The `system` message is included only when `systemPrompt.trim().length > 0`.
  - Add `parseOllamaResponse({ status, body }: { status: number; body: string }): OllamaResult` that:
    - On `status !== 200`, returns `{ ok: false, error: <truncated body or status-derived message>, statusCode: status }`.
    - On `status === 200`, tries `JSON.parse(body)`. On parse error, returns `{ ok: false, error: 'invalid JSON body from API', statusCode: 200 }`.
    - Extracts `choices[0].message.content`. If missing/empty, returns `{ ok: false, error: 'empty or malformed response', statusCode: 200 }`.
    - Otherwise returns `{ ok: true, reply: content.trim() }`.
  - Update the exported `OllamaResult` type: rename `exitCode?: number` → `statusCode?: number`.
- `src/main.ts`:
  - Remove `import { spawn } from 'child_process'` if no other handler uses it (check `archive-file`, `read-todos`, etc. — they don't).
  - Replace the `run-ollama` handler body with:
    1. `const start = Date.now()`
    2. `const apiUrl = resolveOllamaApiUrl(process.env)`
    3. `const model = resolveOllamaModel(process.env)`
    4. `const systemPrompt = fs.existsSync('VAULT.md') ? fs.readFileSync('VAULT.md', 'utf-8') : ''`
    5. `console.log(\`[ollama] url=${apiUrl} model=${model} promptLength=${prompt.length}\`)`
    6. `const { url, init } = buildOllamaRequest({ apiUrl, model, systemPrompt, userPrompt: prompt })`
    7. `try { const res = await fetch(url, init); const body = await res.text(); const wallMs = Date.now() - start; console.log(\`[ollama] status=${res.status} bodyLength=${body.length} wallMs=${wallMs}\`); const result = parseOllamaResponse({ status: res.status, body }); if (!result.ok) console.log(\`[ollama] error: ${result.error}\`); return result; } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.log(\`[ollama error] ${msg}\`); return { ok: false, error: msg, statusCode: -1 }; }`
  - The handler signature changes from sync (`(_e, prompt: string): Promise<string>`) to async (`async (_e, prompt: string): Promise<OllamaResult>`).
- `src/renderer/index.ts` — references to the result type field `exitCode` (if any) are renamed to `statusCode`. The chat error-bubble rendering does NOT need to change — it only reads `result.ok` and `result.error`. Confirm during implementation that the existing renderer code doesn't read `exitCode` anywhere; if it does, rename in place.
- `src/preload.ts` — update the TypeScript declaration of `runOllama`'s return type if it references `exitCode`. The wire IPC stays `'run-ollama'`.
- `test/data/ollamaRun.spec.ts` — REPLACE per the BDD test list above. The previous `classifyOllamaResult` tests are removed because the function is removed.
- `test/step_defs/world.ts` — the controllable mock's result-object shape updates from `exitCode` to `statusCode`. Any existing test that pre-constructs a result object updates accordingly.
- `test/view/ollamaDiagnostics.spec.ts` — same rename if it references the field. The error-bubble render assertions are unchanged.
- `package.json` — append `&& ts-node test/verify/ollamaHttp.verify.ts` to the `verify:playwright` script.

### DOM contract
No changes. The renderer's chat view, error bubble, and pending bubble all use the same selectors as before. The `OllamaResult` shape rename (`exitCode` → `statusCode`) is internal to the type system; the renderer reads only `.ok`, `.reply`, and `.error`.

### Visual treatment
No styling changes.

## Skill deviations (recorded)

Build/transport-layer feature. No `.feature` file, no Cucumber step defs, no Tallahassee DOM tests, no fixtures — same shape as `headless-test-mode` and `package`. Full test surface is the unit suite in `test/data/ollamaRun.spec.ts` plus the Playwright verify with the stub HTTP server. The existing `chat-interface` + `ollama-diagnostics` Gherkin/Tallahassee suites continue to cover the user-facing chat flow against the world's mocked `runOllama`.

## Conflicts & decisions

**Conflicts:**
- This plan **supersedes** the transport mechanism described in `features/ollama-diagnostics/plan.md` (subprocess + stderr + exitCode) with HTTP (fetch + body + statusCode). The user-facing acceptance criteria from `ollama-diagnostics` (logging, error-bubble rendering, env-var-configurable model) are **preserved verbatim** — only the underlying source of each failure mode changes. The renamed `OllamaResult.exitCode → statusCode` is a small public-type adjustment; the user-facing chat behavior is unchanged. Recorded in this plan's Pattern summary and File map; no edits to the `ollama-diagnostics` frozen artifacts are required (the result-object shape is implementation-visible only).

**Decisions:**
- **OpenAI-compatible `/v1/chat/completions` endpoint.** *Reason: broadest interoperability — Ollama, LM Studio, vLLM, llama.cpp, OpenAI, OpenRouter, Together, Groq all speak this shape.*
- **Single env var `OLLAMA_API_URL` carrying the full endpoint URL.** *Reason: more flexible than a `BASE_URL` + path split — some servers expose non-standard paths; Implement and the user don't have to reason about path concatenation.*
- **No auth header in this plan.** *Reason: minimal scope; OAuth/Bearer support is a separate feature when the user wants to point at a paid API. The shape is easy to add later (one `Authorization` header field).*
- **Built-in Node 20 `fetch`.** *Reason: zero new deps. The project already declares `@types/node: ^20.11.0`, so the type is in scope.*
- **Keep IPC channel name `'run-ollama'`.** *Reason: minimum blast radius — preload, renderer, world mock, all existing tests reference it. Renaming to `run-llm` is a follow-up.*
- **Rename result field `exitCode` → `statusCode`.** *Reason: accuracy. The renderer doesn't read it; only internal logs do.*
- **System message omitted when `VAULT.md` is missing or empty.** *Reason: sending an empty `system` content can confuse some providers; omitting the role entirely is cleaner. Equivalent user-facing behavior either way.*
- **`stream: false`** in the request body. *Reason: matches today's "buffer the full reply" behavior. Streaming is out of scope for this plan.*

**Open questions:** none.
