---
name: Ollama tool calls
slug: ollama-tools
status: planned
frozen: true
created: 2026-05-13
---

# Ollama tool calls

## Pattern summary

The chat interface gains the ability to execute actions on the vault via OpenAI-compatible function/tool calling. Today every chat message is round-tripped to Ollama as a plain user prompt and the reply renders as an assistant bubble. With this feature, the request now includes a `tools` array (one entry for v1: `add_task(title, tags?)`) and the response is examined for `tool_calls` on `choices[0].message`. When present, the main process executes each call by writing a markdown task file into the active vault's `todos/` directory (reusing the existing `buildTaskFile` pure helper that `/add` uses today), records the resulting file path, sends each result back to Ollama as a `tool` role message keyed by `tool_call_id`, and loops up to four iterations until the model returns a normal `content` payload. The chat view renders one `[data-message="tool"]` row per executed call inline between the user bubble and the eventual assistant bubble, so the user sees the actions as they happen ("✓ Added: buy milk #go-to-store"). When the model judges the request ambiguous (e.g. "add some stuff"), it returns content with a clarifying question and zero tool calls — no files written, no tool rows shown, just the assistant question. The behavior is anchored by a system-prompt addendum prepended to whatever sits in `VAULT.md` today: "Use tools when the user gives a concrete instruction. Ask a clarifying question first only when essential information is missing." All existing chat flows (no-tool replies, error bubbles from `ollama-diagnostics`, the boot-time warmup from the previous commit) remain intact — tool calling layers on top, never replaces.

**In scope:** one tool definition `add_task(title: string, tags?: string[])`; main-process loop that submits `tools`, parses `tool_calls`, executes each, sends back `tool` results, loops up to a maxIterations cap of 4; new `tool` role message handling in the OpenAI-compat request body builder; renderer rendering of `[data-message="tool"]` rows with an action summary and result indicator; system-prompt addendum locking the ask-vs-go decision rule; integration with the existing active-vault write path (writes go to `resolveActiveVault() + '/todos/'`, gated by `isPathInsideActiveVault` from the `vault-write-path` plan); error paths for missing `add_task` arguments and for write failures (surfaced as a `[data-message="tool"][data-error]` row with the error message); a verify script that stubs the HTTP server with a canned tool-calling exchange to prove the loop works end-to-end.

**Out of scope:** additional tools beyond `add_task` (no `list_tasks`, no `complete_task`, no `archive_task`, no `read_vault` — each is a follow-up plan); streaming responses with interleaved tool calls (still buffered per response); concurrent tool execution (calls are run sequentially in array order); model selection / capability detection (if the configured model doesn't speak tool calling, the request degrades to a plain-text answer — no warning or fallback logic this plan); persisting the tool-call transcript across reloads; allowing the model to read existing tasks or tags (so the model may invent new tag names — the user can correct in conversation); a UI control to retry a failed tool call; user-visible diagnostics about which iteration the loop is on; goals (`vault/goals/`) — the "project" concept in the user's example is modeled as a `#tag` (which the existing PROJECTS sidebar already renders), not as a `project:` frontmatter field linking to a goal file.

## Acceptance criteria

1. Given the chat view is active and the user sends "add a task to buy milk", when the model responds with a single `tool_calls` array containing `add_task(title: "buy milk")` and the main process executes it, then a markdown task file matching `buy-milk-<TODAY>.md` exists in the active vault's `todos/` directory with frontmatter `title: "buy milk"`, `status: todo`, `tags: []`.
2. Given a `tool_calls` response that includes a tag argument (e.g. `add_task(title: "buy milk", tags: ["go-to-store"])`), when the call executes, then the resulting task file's frontmatter has `tags: ["go-to-store"]` and the sidebar PROJECTS section shows a `#go-to-store` entry after re-render.
3. Given multiple `add_task` tool calls in a single response, when they execute, then one file is written per call in array order, and the chat thread renders one `[data-message="tool"]` row per call with the action title and `[data-tool-status="ok"]`.
4. Given the model returns a normal `content` payload with no `tool_calls`, when the chat completes, then no files are written and the response renders as an `[data-message="assistant"]` bubble as today.
5. Given the model returns `tool_calls` that succeed, when the loop sends each result back as a `tool` role message and the model produces a final `content`, then the assistant's final natural-language summary renders as the last bubble in the thread, below the tool rows.
6. Given a tool call references the `add_task` tool with required argument `title` missing, when the executor processes it, then the corresponding `[data-message="tool"]` row carries `[data-tool-status="error"]` and a text message of `"add_task: missing required argument 'title'"`, the file write is not attempted, and the error is reported to the model in the follow-up `tool` message.
7. Given the multi-turn loop is in flight, when it reaches the cap of four iterations without a normal `content` response, then the chat thread renders an assistant bubble reading `"tool call loop exceeded 4 iterations"` and no further requests are sent.
8. Given an Ollama message of `"I need you to go to the store, buy milk, some eggs, fruit and flour. We should be making pancakes. So some jam can be needed too."`, when sent through a tool-capable model that the verify script stubs with a canned 6-call response, then six task files exist in the active vault tagged `#go-to-store` and the chat thread shows six tool rows followed by the assistant's summary.

## Step-definition file

`test/step_defs/ollama-tools.steps.ts` — steps:

**Given:**
- `Given("the chat view is active")` (REUSE — `chat-interface.steps.ts`).
- `Given("the next Ollama response is a tool call {string}")` (NEW) — sets the world's stub to return `choices[0].message.tool_calls = [<parsed JSON>]` with auto-generated `tool_call_id`s. The string argument is a JSON literal like `[{"name":"add_task","arguments":{"title":"buy milk"}}]`.
- `Given("the next Ollama response is a normal reply {string}")` (NEW) — sets the stub to return `choices[0].message.content = <string>` with no `tool_calls`. Used to terminate the loop.
- `Given("the next Ollama response has no tool_calls and content {string}")` (REUSE alias of the above; same body).

**When:**
- `When("the user types {string} in the command bar and presses Enter")` (REUSE — `chat-interface.steps.ts`).

**Then:**
- `Then("a task file matching {string} exists in the active vault todos folder")` (NEW) — asserts a file matching the wildcard pattern (e.g. `buy-milk-*.md`) is present under `<activeVault>/todos/`.
- `Then("the file frontmatter title equals {string}")` (REUSE if a similar step exists in `vault-write-path.steps.ts`; otherwise NEW) — re-reads the most recently written file and asserts the `title:` line.
- `Then("the file frontmatter tags include {string}")` (NEW) — parses the `tags:` array literal in the frontmatter and asserts the given string is one of its members.
- `Then("a tool row appears in the chat thread with action {string} and status {string}")` (NEW) — asserts a `[data-message="tool"][data-tool-status="<status>"]` element whose `[data-tool-action]` text contains the action label.
- `Then("the assistant final bubble reads {string}")` (NEW) — asserts the last `[data-message="assistant"]:not([data-pending]):not([data-error])` bubble's `[data-message-text]` equals the string.

## BDD test list

[file: test/data/ollamaTools.spec.ts]  ← new unit-test file
- `describe("OLLAMA_TOOLS")` > `it("declares add_task with required title argument")`
- `describe("OLLAMA_TOOLS")` > `it("declares add_task with optional tags array argument")`
- `describe("parseToolCall")` > `it("returns ok with name and arguments for a valid add_task call")`
- `describe("parseToolCall")` > `it("returns error when the function name is unknown")`
- `describe("parseToolCall")` > `it("returns error when arguments JSON fails to parse")`
- `describe("parseToolCall")` > `it("returns error when the required title argument is missing")`
- `describe("executeAddTask")` > `it("returns a built task-file content matching title and tags")`
- `describe("executeAddTask")` > `it("returns a filename based on the slugified title and today's date")`
- `describe("executeAddTask")` > `it("falls back to an empty tags array when tags is omitted")`
- `describe("buildOllamaToolsRequest")` > `it("extends buildOllamaRequest with the tools array")`
- `describe("buildOllamaToolsRequest")` > `it("includes the system prompt addendum about tools")`
- `describe("buildOllamaToolsRequest")` > `it("places prior tool results as tool role messages keyed by tool_call_id")`

[file: test/view/ollamaTools.spec.ts]
- `describe("Tool row rendering")` > `it("renders a [data-message=tool] row when a tool call succeeds")`
- `describe("Tool row rendering")` > `it("renders [data-tool-status=ok] on success")`
- `describe("Tool row rendering")` > `it("renders [data-tool-status=error] on failure")`
- `describe("Tool row rendering")` > `it("renders the action label in [data-tool-action]")`
- `describe("Tool row rendering")` > `it("renders the error message in [data-tool-error] on failure")`
- `describe("Multi-turn flow")` > `it("renders tool rows above the final assistant bubble in chronological order")`
- `describe("Multi-turn flow")` > `it("does not render a normal assistant bubble when only tool calls are returned")`
- `describe("Multi-turn flow")` > `it("renders the assistant content bubble when the model returns content with no tool_calls")`

## File map

### New files
- `src/main/ollamaTools.ts` — exports:
  - `OLLAMA_TOOLS`: the static `tools` array submitted on every request, containing one function definition for `add_task` with JSON-schema parameters.
  - `parseToolCall(rawCall)`: validates and normalizes a `tool_call` from the OpenAI response shape into `{ ok: true, callId, name: 'add_task', args: { title, tags } } | { ok: false, callId, error }`.
  - `executeAddTask(args, opts)`: pure (no fs) — given `{ title, tags }` and `{ today, existingFilenames }`, returns `{ filename, content }` via the existing `buildTaskFile` helper. The fs write is done in `src/main.ts` after this returns.
  - `SYSTEM_PROMPT_ADDENDUM`: the string `"Use tools when the user gives a concrete instruction. Ask a clarifying question first only when essential information is missing."` — prepended to `VAULT.md` content before sending.
  - `buildOllamaToolsRequest(input)`: extension of `buildOllamaRequest` that adds the `tools` array, the addendum prepended to the system prompt, and supports a `priorToolResults` array of `{ callId, content }` for the multi-turn loop.
- `test/step_defs/ollama-tools.steps.ts`
- `test/data/ollamaTools.spec.ts`
- `test/view/ollamaTools.spec.ts`
- `test/verify/ollamaTools.verify.ts` — Playwright + Node HTTP stub server. The stub returns a 6-call `tool_calls` response on the first POST, a `tool`-message-acknowledging `content` summary on the second POST. The script types the go-to-store example into the command bar, presses Enter, asserts six task files appear under the tmp-cloned active vault, asserts six `[data-message="tool"]` rows in the chat thread, asserts the assistant final summary bubble appears last. Captures `tmp/ollamaTools-go-to-store.png`.

### Files to update
- `src/main.ts`:
  - Extract the multi-turn loop from the existing `callOllama` into a new private async function `runOllamaWithTools(prompt: string, logPrefix: string): Promise<{ result: OllamaResult; toolEvents: ToolEvent[] }>`. The function:
    1. Builds the initial request via `buildOllamaToolsRequest` with `priorToolResults: []`.
    2. Sends the request; on non-200 or fetch throw, returns the existing `OllamaResult` shape with an empty `toolEvents` array.
    3. On 200, inspects `choices[0].message`:
       - If `tool_calls` is present and non-empty: for each call, parse via `parseToolCall`. On parse ok, call `executeAddTask`, write the file (gated by `isPathInsideActiveVault`), push a `ToolEvent` entry. On parse error, push an error event. Append all results as `tool` role messages and re-request with `priorToolResults` extended.
       - If `content` is present and `tool_calls` is empty: parse via `parseOllamaResponse` and return.
    4. Cap iterations at 4. On exhaustion, return `{ ok: false, error: 'tool call loop exceeded 4 iterations', statusCode: 200 }`.
  - The `run-ollama` IPC handler now returns `{ ok, reply?, error?, statusCode?, toolEvents?: ToolEvent[] }`. `toolEvents` is always an array (empty when no tools fired).
  - The boot-time `warmupOllama()` uses the plain `callOllama` path (no tools) — no change.
- `src/main/ollamaRun.ts`:
  - Export a new `ToolEvent` type: `{ callId: string; name: string; argsRaw: string; status: 'ok' | 'error'; resultContent: string }`.
  - Update `OllamaResult` to optionally carry `toolEvents?: ToolEvent[]`. Update `parseOllamaResponse` so the success branch passes `toolEvents` through if provided.
- `src/preload.ts` — update the TypeScript declaration of `runOllama`'s return shape to include `toolEvents`.
- `src/renderer/index.ts`:
  - After the await of `window.todoz.runOllama(text)`:
    - If `result.toolEvents` has entries, render each as a `[data-message="tool"]` row (inserted before the pending bubble) — see DOM contract below — and only then render the final `[data-message="assistant"]` bubble with `result.reply` (or error).
    - If `toolEvents` is empty, behavior is unchanged from `chat-interface`.
  - Re-fetch tasks after any successful tool event so the new tasks appear in the sidebar and main list when the user navigates back. The chat view itself doesn't render the task list, but the data refresh is needed so the existing task views show the new state.
- `src/renderer/index.html` — add CSS for `[data-message="tool"]`: smaller, left-aligned row using `surface-container-low` background, `body-md` typography, monospaced `[data-tool-action]` text, a small status glyph (`✓` for ok, `✗` for error) via CSS `::before`. No new selectors beyond the data attributes.
- `src/renderer/views/` — no new view files; the tool-row rendering lives inline in `index.ts` next to the existing message-rendering code.
- `src/main/writeFileGuard.ts` — no changes; the existing `isPathInsideActiveVault` gates the tool-driven writes the same way it gates `/add`.
- `test/step_defs/world.ts` — extend the world's `runOllama` mock to support a sequence of canned responses (the previous single-response mock is the first element of the sequence; subsequent elements are popped on each main-process re-request). Tests can pre-load 1-N responses and the world will dispense them in order.
- `package.json` — append `&& ts-node test/verify/ollamaTools.verify.ts` to `verify:playwright`.

### DOM contract
- `[data-message="tool"]` (NEW) — one row per executed tool call. Attributes:
  - `[data-tool-status="ok" | "error"]` — overall outcome.
  - `[data-tool-name="add_task"]` — which tool fired.
  - Children:
    - `[data-tool-action]` (NEW) — a one-line summary, e.g. `"add_task: buy milk #go-to-store"`. Plain text.
    - `[data-tool-error]` (NEW, present only when status="error") — the error message.
- The chat-thread layout adds tool rows between the user bubble and the final assistant bubble. The pending bubble (`[data-message="assistant"][data-pending]`, from `chat-interface`) is removed when the *first* response arrives, regardless of whether it carries tool_calls or content. If the response carries tool_calls, a new pending bubble may be re-rendered to indicate the loop is still running — or the tool rows alone signal progress. (Implement chooses; tests assert the final DOM, not the intermediate flicker.)

### Visual treatment
- Tool rows: `surface-container-low` background (`#f2f4f6`), `outline-variant` 1px border, `rounded.DEFAULT` (0.25rem) corners, 8px padding. Status glyph rendered via `::before` content: `'✓ '` (green, `#16a34a`-ish — pick a token close to DESIGN.md's vibe; or use a stock checkmark) for ok, `'✗ '` (`error` token #ba1a1a) for error. `[data-tool-action]` uses `mono-label` (12px monospace) for the action text. Width: same max as the chat thread; left-aligned (not centered or attributed to user/assistant).

## Skill deviations (recorded)

Mixed-shape feature like `ollama-diagnostics`. Most ACs are main-process/IPC-contract concerns; ACs 3, 5, 6, 7, 8 have a user-visible UI surface. Three Gherkin scenarios cover the user-visible flow (AC 1+2 unified into "one tool call writes a file", AC 5 "final assistant summary after tool calls", AC 8 "multi-call go-to-store example"). The remaining ACs are unit-tested.

## Conflicts & decisions

**Conflicts:**
- The `chat-interface` plan's Pattern summary describes the chat flow as: send message → pending bubble → Ollama responds → bubble replaced with content. This plan extends that flow with an intermediate tool-call layer that may show tool rows before the final content. The chat-interface ACs 2, 3, 4 continue to hold because: AC2 (user bubble + pending bubble appear) — still true on first request; AC3 (pending replaced by reply) — still true once the loop terminates with content; AC4 (auto-activate from task list) — unchanged. No supersession of the chat-interface frozen artifacts is required; this plan layers on top.
- The `ollama-http` plan's `OllamaResult` shape gains an optional `toolEvents` field. This is an additive change; existing callers that don't read it are unaffected. No frozen artifact edit needed.

**Decisions:**
- **One tool only for v1: `add_task(title, tags?)`.** *Reason: keeps scope tight; the user's example is fully addressed; further tools (list_tasks, complete_task, archive) are independent follow-ups.*
- **`tags` mapped to the user's "project" concept.** *Reason: the existing sidebar PROJECTS section already groups by `#`-prefixed tags; adding goal-file support (vault/goals/) would balloon scope.*
- **Multi-turn loop cap of 4 iterations.** *Reason: a misbehaving model could loop forever; 4 is enough for a multi-call response followed by a final summary plus headroom.*
- **System-prompt addendum locks the ask-vs-go behavior.** *Reason: the user explicitly asked for "if unclear ask, otherwise go" — that is a model-instruction, not a code-level guarantee, so the right place is the system prompt.*
- **Sequential tool execution.** *Reason: writes touch the same directory; parallel execution risks filename collisions in the `existing` dedupe and adds no real speed-up for small tool counts.*
- **No capability detection.** *Reason: Ollama silently ignores `tools` for non-tool-capable models and returns plain content. That's the right default — the user picks the model via `OLLAMA_MODEL`.*
- **The system prompt addendum is prepended, not appended, to `VAULT.md`.** *Reason: vault schema lives in VAULT.md and may run long; addendum first keeps the tool-use instruction near the top of the context where the model is most likely to attend.*

**Open questions:** none.

## Data fixtures

No fixture files. The cucumber world's per-scenario tmp vault (already in place from `vault-write-path` and the `test/fixtures/vaults/alpha/` fixture from `vault-picker`) is sufficient. Tool calls write to the active vault's tmp clone, the After hook cleans up.
