---
slug: ollama-http
frozen: false
---

# Notes — Ollama HTTP transport

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run a plan skill.

## Problems

(none yet)

## Verify findings

### Verify — ollama-http — 2026-05-12

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — zero errors, zero warnings |
| Type check (`npm run typecheck`) | PASS — exits 0 |
| Coverage (`npm run test:coverage`) | PASS 98.45% — well above 90% gate; `src/main/ollamaRun.ts` 100% lines, 95.45% branches |
| `npm test` (Mocha) | PASS — 282 tests passing, 0 failing, 0 skipped |
| Gherkin (`npm run test:bdd`) | PASS — 69 scenarios, 273 steps |
| `npm run verify:playwright` chain | FAIL — chain stopped at `chatInterface.verify.ts` (AC2 pending bubble race) before reaching `ollamaDiagnostics` / `ollamaHttp` |
| `chatInterface.verify.ts` (re-run on clean HEAD via `git stash`) | PASS — confirms the failure is introduced by this feature's diff, NOT a pre-existing flake |
| `ollamaDiagnostics.verify.ts` (run independently after the failure) | PASS — pending count 0 after failed resolve, error bubble rendered with mocked error |
| `ollamaHttp.verify.ts` (run independently after the failure) | PASS — stub server received POST with `messages[1].content === "ping"` and `stream: false`; renderer bubble text === "pong" |
| Screenshot: `tmp/ollamaHttp-after-pong.png` (read via Read tool) | PASS — visually confirms success bubble "pong" in normal (non-error) styling under user bubble "ping" |
| Screenshot: `tmp/chatInterface-after-send.png` (read via Read tool) | FAIL — shows `fetch failed` error bubble in place of the expected pending bubble |

### Per-AC results (ollama-http plan)

| AC | Statement | Result | Evidence |
|---|---|---|---|
| 1 | 200 + valid OpenAI body → `{ok:true, reply}` | PASS | `parseOllamaResponse` unit `returns ok true with trimmed content on 200`; verify script `bubble text === "pong"` |
| 2 | Non-200 → `{ok:false, error, statusCode}` | PASS | `parseOllamaResponse` unit `returns ok false with the statusCode on non-200` |
| 3 | `fetch` throws → `{ok:false, error, statusCode:-1}` + `[ollama error]` log | PASS | Covered by world-mocked failure path in existing `ollama-diagnostics` Gherkin + Tallahassee; the fetch-error branch in `main.ts:run-ollama` is plain `try/catch` and logged via `console.log('[ollama error] …')` per the diff |
| 4 | `OLLAMA_API_URL` set → fetch uses that exact URL | PASS | `resolveOllamaApiUrl` + `buildOllamaRequest` units; verify script `stub server received a POST  — captured count = 1` (env-pointed URL) |
| 5 | `OLLAMA_API_URL` unset/empty → defaults to `http://localhost:11434/v1/chat/completions` | PASS | `resolveOllamaApiUrl` units (unset + empty) |
| 6 | Non-empty system + user prompt → `[{role:system}, {role:user}]` + `stream:false` + model | PASS | `buildOllamaRequest` units (`places the system prompt first…`, `places the user prompt next…`, `sets stream to false`, `sets the resolved model name…`) |
| 7 | Empty/missing VAULT.md → system message omitted from messages | PASS | `buildOllamaRequest` unit `omits the system message when systemPrompt is empty` |

**All 7 ACs for ollama-http pass.** The end-to-end HTTP transport works.

### Cross-feature regression

The `chat-interface` verify script (`test/verify/chatInterface.verify.ts`) fails after this diff. Implement flagged it as a pre-existing flake; this Verify independently disconfirms that claim:

- `git stash` → clean HEAD → `npm run build && ts-node test/verify/chatInterface.verify.ts` → **all 6 checks pass**
- `git stash pop` → diff reapplied → same script → AC2 pending-bubble check fails with `pending bubble count = 0`
- Reproduced twice. Not a flake. Caused by this diff.

**Root cause (analysis only — not a fix):** The new HTTP fetch transport fails with `ECONNREFUSED` essentially synchronously when no server is listening on `localhost:11434`. The renderer's `runOllama` promise resolves and the pending bubble is replaced by the error bubble before the verify script's `locator('[data-message="assistant"][data-pending]').count()` runs (the script does `waitForSelector` for the user bubble, then immediately queries the pending count — no `waitForSelector` on the pending bubble itself). The pending bubble IS still rendered (the renderer code at `src/renderer/index.ts:1128-1129` is unchanged); it just exists for ~1 frame instead of for the multi-100ms lifetime of a `spawn` process failure. The screenshot `tmp/chatInterface-after-send.png` confirms: shows `fetch failed` in the error bubble where the pending bubble used to sit.

The `chat-interface` plan's AC2 ("pending assistant bubble appears below the user bubble") is still semantically true — the pending bubble is created and rendered — but the existing verify script can no longer observe it because the failure-to-resolve race is now ~3 orders of magnitude faster. Fixing this is Implement's call (either tighten the renderer's pending-bubble hold, or update `chatInterface.verify.ts` to `waitForSelector` on the pending bubble with a strict timing window, or have the verify script use a stub HTTP server like `ollamaHttp.verify.ts` does).

**Capture speed:** fast — full unit + bdd + coverage suite finishes in ~6s.
**Find-next clarity:** clear — single failing check with reproducible signal.
**Nesting:** N/A — transport-layer feature.

**Overall:** All 7 ollama-http ACs pass and the HTTP transport works end-to-end (verified by stub-server + screenshot). However, this feature's diff regresses `chatInterface.verify.ts` (AC2 pending-bubble race). Returning to Implement to address the cross-feature regression before commit.

### Verify — ollama-http — 2026-05-12 (re-run after cross-feature regression fix)

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — zero errors, zero warnings |
| Type check (`npm run typecheck`) | PASS — exits 0 |
| Coverage (`npm run test:coverage`) | PASS 98.45% stmts / 90.95% branches (≥90% gate); `src/main/ollamaRun.ts` 100% lines, 95.45% branches |
| `npm test` (Mocha) | PASS — 282 tests passing, 0 failing, 0 skipped |
| Gherkin (`npm run test:bdd`) | PASS — 69 scenarios, 273 steps |
| `npm run verify` chain (full) | PASS — all 13 Playwright verify scripts green, including `chatInterface.verify.ts` and `ollamaHttp.verify.ts` |
| `chatInterface.verify.ts` (standalone spot-check after the chain) | PASS — all 8 checks green; pending bubble count = 1; assistant bubble text = "hi there" |
| Screenshot: `tmp/ollamaHttp-after-pong.png` (read via Read tool) | PASS — user bubble "ping" and assistant bubble "pong" both rendered in normal styling under the active Chat sidebar entry |
| Screenshot: `tmp/chatInterface-after-send.png` (read via Read tool) | PASS — user bubble "hello" with the pending bubble (three-dot placeholder) below it; no error-bubble styling visible (cross-feature regression resolved) |

### Per-AC results (ollama-http plan) — re-run

| AC | Statement | Result | Evidence |
|---|---|---|---|
| 1 | 200 + valid OpenAI body → `{ok:true, reply}` | PASS | `parseOllamaResponse` unit `returns ok true with trimmed content on 200`; verify script `bubble text === "pong"` |
| 2 | Non-200 → `{ok:false, error, statusCode}` | PASS | `parseOllamaResponse` unit `returns ok false with the statusCode on non-200` |
| 3 | `fetch` throws → `{ok:false, error, statusCode:-1}` + `[ollama error]` log | PASS | Covered by world-mocked failure path in existing `ollama-diagnostics` Gherkin + Tallahassee; fetch-error branch in `main.ts:run-ollama` is `try/catch` and logs via `console.log('[ollama error] …')` |
| 4 | `OLLAMA_API_URL` set → fetch uses that exact URL | PASS | `resolveOllamaApiUrl` + `buildOllamaRequest` units; verify script `stub server captured count = 1` (env-pointed URL) |
| 5 | `OLLAMA_API_URL` unset/empty → defaults to `http://localhost:11434/v1/chat/completions` | PASS | `resolveOllamaApiUrl` units (unset + empty) |
| 6 | Non-empty system + user prompt → `[{role:system}, {role:user}]` + `stream:false` + model | PASS | `buildOllamaRequest` units; verify script `user content === "ping"` and `stream === false` |
| 7 | Empty/missing VAULT.md → system message omitted from messages | PASS | `buildOllamaRequest` unit `omits the system message when systemPrompt is empty` |

**All 7 ollama-http ACs pass.** The cross-feature regression flagged in the prior verify run has been resolved by making `chatInterface.verify.ts` hermetic (Node HTTP stub server holds the response so the pending bubble is observable). No renderer or transport changes were required — the fix is scoped to the verify script's timing harness only.

**Capture speed:** fast — full unit + bdd + coverage suite finishes in ~6s; full Playwright chain (13 scripts including the slow package step) completes end-to-end.
**Find-next clarity:** clear — every script printed a per-check PASS line.
**Nesting:** N/A — transport-layer feature.

**Overall:** Verify complete. Pattern `ollama-http` is done.

## Background

User on 2026-05-12: "So lets make the ollama use http instead. That means we could use other apis also."

This plan swaps the existing `child_process.spawn('ollama', ...)` subprocess transport for an HTTP POST to the OpenAI-compatible `/v1/chat/completions` endpoint. Default URL is Ollama's local server (`http://localhost:11434/v1/chat/completions`); `OLLAMA_API_URL` env var points it at anything that speaks the same shape (LM Studio, vLLM, llama.cpp's server, OpenAI, OpenRouter, Together, Groq, etc.).

The user-facing chat behavior is unchanged — the renderer keeps the same `runOllama` IPC contract, the error-bubble render path from `ollama-diagnostics` keeps working, the logging keeps the `[ollama]` prefix. Only the transport and the `OllamaResult.exitCode → statusCode` field rename are visible at the type level.

## Skill deviations (acknowledged)

No `.feature` file. No Cucumber step defs. No Tallahassee/DOM tests. No fixtures. Same shape as `headless-test-mode`, `package`, and the unit-AC portion of `ollama-diagnostics`. Full test surface: `test/data/ollamaRun.spec.ts` (~19 unit tests on pure helpers) plus `test/verify/ollamaHttp.verify.ts` (Playwright + stub HTTP server end-to-end).
