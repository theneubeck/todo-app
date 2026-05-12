---
name: Ollama diagnostics
slug: ollama-diagnostics
status: planned
frozen: true
created: 2026-05-12
---

# Ollama diagnostics

## Pattern summary

The `run-ollama` IPC handler in `src/main.ts:85-102` swallows every failure mode silently. It catches spawn errors with `proc.on('error', () => resolve(''))` (returning empty string), ignores stderr entirely, never checks the subprocess exit code, and hardcodes the model name `gemma4:12b` — a name that does not correspond to any released Gemma model, so on any machine without that specific mis-tagged image installed, `ollama run gemma4:12b ...` exits non-zero with a "model not found" message on stderr that nothing logs. The renderer's chat view then receives an empty string, replaces the pending bubble with an empty assistant bubble, and the user sees nothing happen. There is no signal anywhere — main-process terminal, renderer devtools, or the UI — that would let the user diagnose the failure.

This plan makes the path observable and the failures user-visible. Five changes: (1) the main-process handler logs the model name and a prompt-length summary on every call; (2) stderr is piped to console.log with an `[ollama stderr]` prefix; (3) the IPC return shape changes from `Promise<string>` to `Promise<{ ok: boolean; reply?: string; error?: string; exitCode?: number }>` so callers can distinguish success from failure; (4) the renderer renders failed replies as a visibly distinct error bubble (`[data-message="assistant"][data-error]`) using DESIGN.md's `error-container` / `on-error-container` tokens, with the error string as the bubble text; (5) the model name becomes configurable via the `OLLAMA_MODEL` environment variable with a default of `gemma3:4b` (a real, commonly-available Gemma 3 size). The Ollama subprocess invocation, prompt construction, and overall threading are unchanged — only the result-handling and the model-name source change.

**In scope:** main-process logging (model name, prompt length, stdout length, stderr content, exit code, total wall time); IPC contract change from `Promise<string>` to a result object; renderer error-bubble rendering; `OLLAMA_MODEL` env var with default `gemma3:4b`; updates to the existing chat-interface tests so they call the new shape; one new Gherkin scenario covering the error-rendering path.

**Out of scope:** retries on failure; auto-detecting which Ollama models are installed via `ollama list`; streaming responses (still ignored — full stdout buffered then returned); a settings UI for the model name (env var only); persisting chat-error state; markdown rendering of either reply or error text; renaming `runOllama` to anything else; suppressing the chat path entirely if Ollama is missing (the call still attempts; failure renders as an error bubble).

## Acceptance criteria

1. Given the main process invokes Ollama for any prompt, when the subprocess is spawned, then `console.log` emits a line containing `[ollama]`, the resolved model name, and the prompt length in characters.
2. Given Ollama writes to stderr during a run, when the subprocess produces stderr output, then each stderr line is `console.log`ged with the prefix `[ollama stderr]`.
3. Given the Ollama subprocess exits with a non-zero exit code OR emits zero bytes on stdout, when the IPC handler resolves, then it returns `{ ok: false, error: <descriptive string>, exitCode: <number> }` and `console.log` emits a line containing `[ollama] failed` plus the exit code.
4. Given the Ollama subprocess exits with code 0 AND emits a non-empty stdout, when the IPC handler resolves, then it returns `{ ok: true, reply: <stdout-trimmed> }`.
5. Given the renderer receives `{ ok: false, error }` from `runOllama`, when the pending bubble is replaced, then the resulting bubble is an `[data-message="assistant"][data-error]` element whose `[data-message-text]` content equals the error string.
6. Given `process.env.OLLAMA_MODEL` is set to `mymodel:1b` when the main process starts, when Ollama is spawned, then the spawn args include `mymodel:1b` as the model name; when the env var is unset, the args include the default `gemma3:4b`.

## Step-definition file

`test/step_defs/ollama-diagnostics.steps.ts` — steps:

**Given:**
- `Given("the chat view is active")` (REUSE — `chat-interface.steps.ts`).
- `Given("the next runOllama call will fail with {string}")` (NEW) — sets up the world's `runOllama` mock to resolve with `{ ok: false, error: <string>, exitCode: 1 }` instead of the default success path. Stores the rejection message for later assertion.

**When:**
- `When("the user types {string} in the command bar and presses Enter")` (REUSE — `chat-interface.steps.ts`).

**Then:**
- `Then("an error bubble appears with text {string}")` (NEW) — asserts `[data-message="assistant"][data-error] [data-message-text]` exists and its text content equals the string.
- `Then("the pending bubble is gone")` (NEW) — asserts `[data-message="assistant"][data-pending]` is absent (zero matches).

This is a small step file; only AC 5 has a Gherkin scenario. ACs 1, 2, 3, 4, 6 are unit-test concerns (main-process behavior; no DOM).

## BDD test list

[file: test/data/ollamaRun.spec.ts]  ← new unit-test file. Imports a pure helper extracted from the IPC handler.
- `describe("classifyOllamaResult")` > `it("returns ok true with trimmed stdout when exit code is 0 and stdout is non-empty")`
- `describe("classifyOllamaResult")` > `it("returns ok false with exitCode when exit code is non-zero")`
- `describe("classifyOllamaResult")` > `it("returns ok false when exit code is 0 but stdout is empty")`
- `describe("classifyOllamaResult")` > `it("includes the last 200 chars of stderr in the error field when present")`
- `describe("resolveOllamaModel")` > `it("returns the env var value when OLLAMA_MODEL is set")`
- `describe("resolveOllamaModel")` > `it("returns the default gemma3:4b when OLLAMA_MODEL is unset")`
- `describe("resolveOllamaModel")` > `it("returns the default when OLLAMA_MODEL is an empty string")`

[file: test/view/ollamaDiagnostics.spec.ts]  ← new pattern spec for the renderer side.
- `describe("Chat error rendering")` > `it("replaces the pending bubble with an error bubble when runOllama returns ok false")`
- `describe("Chat error rendering")` > `it("sets data-error on the resulting assistant bubble")`
- `describe("Chat error rendering")` > `it("renders the error string as the bubble text")`
- `describe("Chat error rendering")` > `it("does not render a normal assistant bubble alongside the error bubble")`

## File map

### New files
- `src/main/ollamaRun.ts` — exports `classifyOllamaResult({ exitCode, stdout, stderr })` returning the result-object shape, and `resolveOllamaModel(env: NodeJS.ProcessEnv): string` returning the model name. Pure functions, no side effects, no spawn.
- `test/step_defs/ollama-diagnostics.steps.ts`
- `test/data/ollamaRun.spec.ts`
- `test/view/ollamaDiagnostics.spec.ts`
- `test/verify/ollamaDiagnostics.verify.ts` — Playwright script. Boots Electron with `NODE_ENV=test`. Stubs `window.todoz.runOllama` to return `{ ok: false, error: 'Error: model "gemma4:12b" not found, try pulling it first' }`. Drives a chat send, asserts the error bubble renders. Captures `tmp/ollamaDiagnostics-error-bubble.png`.

### Files to update
- `src/main.ts` `run-ollama` handler (lines 85-102):
  - Replace the hardcoded `'gemma4:12b'` with `resolveOllamaModel(process.env)`.
  - On `app.whenReady` or on first call, log `[ollama] model=<name> promptLength=<N>` before spawning.
  - Pipe `proc.stderr.on('data', ...)` and `console.log` each line with `[ollama stderr]` prefix.
  - Capture `exitCode` from the `close` event; log `[ollama] exit=<code> stdoutLength=<N> wallMs=<ms>`.
  - Replace the resolve calls with `resolve(classifyOllamaResult({ exitCode, stdout, stderr }))`.
  - On spawn error, log `[ollama] spawn error: <msg>` and resolve with an `{ ok: false, error: ... }` shape.
- `src/preload.ts` — update the TypeScript declaration of `runOllama` to the new return shape `Promise<{ ok: boolean; reply?: string; error?: string; exitCode?: number }>`.
- `src/renderer/index.ts` (chat send logic):
  - Update the `runOllama` await to handle the result object. On `result.ok === true`, set the pending bubble's text to `result.reply` and remove `[data-pending]`. On `result.ok === false`, remove `[data-pending]`, add `[data-error]` to the bubble, and set its text to `result.error`.
  - Update the global `window.todoz` type declaration to match the new return shape.
- `src/renderer/index.html` — add CSS for `[data-message="assistant"][data-error]`: background `error-container` (#ffdad6), text `on-error-container` (#93000a), 1px border `outline-variant` (or none for solid card), same padding/radius as a normal assistant bubble. Keep the rest of the message-bubble styling untouched.
- `test/step_defs/world.ts` — update the controllable `runOllama` mock to return the new shape. The existing `resolveOllama` helper used by chat-interface tests should now accept either a string (back-compat — wraps it in `{ ok: true, reply: <string> }`) OR the full result object so tests can resolve failures explicitly.
- `test/view/chatInterface.spec.ts` — the existing tests that assert on the assistant bubble after a successful resolve should continue to work via the back-compat string path in the world mock; if any test breaks because of the shape change, update its assertion to the new shape.
- `test/step_defs/chat-interface.steps.ts` — same: any step that resolves the Ollama promise needs to use either the back-compat or the explicit object shape.
- `package.json` — append `&& ts-node test/verify/ollamaDiagnostics.verify.ts` to the `verify:playwright` script.

### DOM contract
- `[data-message="assistant"][data-error]` (NEW) — error bubble. Present only when `runOllama` returned `ok: false`. Visually distinct from a normal assistant bubble via the `error-container` / `on-error-container` colors. Carries `[data-message-text]` (REUSED) with the error string as content.
- `[data-message="assistant"][data-pending]` (REUSED) — present only while waiting for the resolve. The error-rendering path removes `[data-pending]` and adds `[data-error]` in the same step.

### Visual treatment
- Error bubble: `error-container` background (`#ffdad6`), `on-error-container` text (`#93000a`), `rounded.DEFAULT` (0.25rem) corners — matching the existing assistant bubble shape. No icon (out of scope). Same alignment as the assistant bubble (left).
- Logging is `console.log` (main process terminal). No new file outputs. No log levels — flat string lines with `[ollama]` or `[ollama stderr]` prefixes for grep-ability.

## Skill deviations (recorded)

Mixed-shape feature: most ACs are observability/main-process concerns, one is a UI render. So this plan has both a Gherkin scenario (for AC 5) and unit/Tallahassee tests (for ACs 1, 2, 3, 4, 6). Not a full deviation like `headless-test-mode` or `package` — just lighter on Gherkin (1 scenario instead of one-per-AC).

## Data fixtures

No fixture `.md` files needed. The world's `runOllama` mock provides the response shape for tests; no vault data is involved.

## Conflicts & decisions

**Conflicts:** The `chat-interface` plan describes the `runOllama` call as returning a string (e.g., Pattern summary: "Ollama responds, then the pending bubble is replaced by an assistant bubble containing the response text"). The new IPC contract changes that shape to `{ ok, reply, error? }`. The chat-interface plan's behavior in the success path is preserved (the renderer just unwraps `result.reply`), so its acceptance criteria 2, 3, 4 continue to hold; only the underlying contract is wider. This is a non-disruptive extension, not a supersession — chat-interface scenarios still pass after this plan ships.

**Decisions:**
- Default model `gemma3:4b`. *Reason: real, commonly-available, small enough for a laptop. The user can override via env var.*
- Returning a result object instead of throwing on failure. *Reason: lets the renderer render a distinct error bubble; throwing would lose the structured info (exit code, stderr excerpt) at the IPC boundary.*
- `console.log` rather than a structured logger. *Reason: zero deps, easy to grep, visible in the terminal where `npm start` runs.*
- Last 200 chars of stderr in the `error` field. *Reason: Ollama errors are usually one line ("Error: model 'X' not found, try pulling it first"), so 200 chars is enough; full stderr is in the terminal log anyway.*

**Open questions:** none.
