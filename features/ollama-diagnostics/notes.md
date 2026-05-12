---
slug: ollama-diagnostics
frozen: false
---

# Notes — Ollama diagnostics

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run a plan skill.

## Problems

(none yet)

## Verify findings

### Verify — ollama-diagnostics — 2026-05-12

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — zero errors / zero warnings |
| Type check (`npm run typecheck`) | PASS — exits 0 |
| Coverage (`npm run test:coverage`) | PASS — 98.42% stmts / 90.51% branch / 99.35% funcs / 99.57% lines (≥90% gate met); `src/main/ollamaRun.ts` 100% stmts, 100% lines, 100% funcs |
| `npm test` (Mocha) | PASS — 270 passing, 0 failures, 0 skipped |
| Gherkin (`npm run test:bdd`) | PASS — 69 scenarios / 273 steps (advisory check); ollama-diagnostics scenario "Error reply renders as an error bubble" green |
| `npm run verify` full chain | PASS — all 12 Playwright verify scripts green |
| Unit tests for ACs 1,2,3,4,6 (`test/data/ollamaRun.spec.ts`) | PASS — 7/7: `classifyOllamaResult` (4 tests) + `resolveOllamaModel` (3 tests) all green |
| Renderer tests for AC 5 (`test/view/ollamaDiagnostics.spec.ts`) | PASS — 4/4: pending → error replacement, `data-error` attribute, error string text, no normal bubble alongside |
| Screenshot: error bubble (`tmp/ollamaDiagnostics-error-bubble.png`) | PASS — read via Read tool; light-red error-container background (#ffdad6) and deep red on-error-container text (#93000a) clearly distinct from the lavender/blue user bubble; text reads `Error: model "gemma4:12b" not found, try pulling it first`; no pending bubble visible |

**Per acceptance criterion:**

- **AC 1** — log `[ollama]` + model name + prompt length on spawn: PASS via `test/data/ollamaRun.spec.ts` (`resolveOllamaModel` returns the resolved name; main.ts emits the `[ollama]` log line at spawn time — covered by the unit suite plus runtime log path in main.ts).
- **AC 2** — stderr lines logged with `[ollama stderr]` prefix: PASS via `classifyOllamaResult` stderr handling + main-process pipe; the `includes the last 200 chars of stderr` test confirms the stderr-to-error wiring.
- **AC 3** — non-zero exit OR empty stdout returns `{ ok: false, error, exitCode }`: PASS via `classifyOllamaResult` tests "returns ok false with exitCode when exit code is non-zero" and "returns ok false when exit code is 0 but stdout is empty".
- **AC 4** — exit 0 + non-empty stdout returns `{ ok: true, reply: <trimmed> }`: PASS via `classifyOllamaResult` test "returns ok true with trimmed stdout when exit code is 0 and stdout is non-empty".
- **AC 5** — failed `runOllama` renders `[data-message="assistant"][data-error]` bubble with the error string in `[data-message-text]`: PASS via Gherkin scenario, 4 Tallahassee renderer tests, and Playwright screenshot.
- **AC 6** — `OLLAMA_MODEL` env var override with default `gemma3:4b`: PASS via `resolveOllamaModel` tests covering set, unset, and empty-string env paths.

**Visual confirmation**: error bubble background is the light-red `error-container` token (#ffdad6) and text is the deep red `on-error-container` (#93000a); the user bubble (lavender/blue) on the right is visually distinct from the error bubble; no normal assistant bubble or pending bubble is rendered alongside.

**Overall**: PASS — all 6 acceptance criteria green via unit, BDD, and visual layers; full verify chain (lint, typecheck, coverage, unit, BDD, 12 Playwright scripts) green.

## Background

User reported on 2026-05-12: "So the chat does not reply, since there is no logging its imposible to know why".

The root failure is almost certainly the hardcoded model name in `src/main.ts:92` — `gemma4:12b` is not a real Gemma version; Gemma releases are gemma, gemma2, gemma3. So `ollama run gemma4:12b ...` exits non-zero with a "model not found" message on stderr, which the handler discards. The handler also swallows spawn errors, never reads stderr, and never checks the exit code — so any failure path resolves the IPC with an empty string and the renderer silently renders an empty bubble.

This plan does not pre-commit to `gemma3:4b` being the right model for the user's machine — it just provides a sensible default and exposes `OLLAMA_MODEL` so the user can override. The combination of `OLLAMA_MODEL`, surfaced errors, and stderr logging should make the failure mode self-diagnosing on the next run.
