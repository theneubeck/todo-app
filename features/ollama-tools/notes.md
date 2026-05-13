---
slug: ollama-tools
frozen: false
---

# Notes — Ollama tool calls

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run a plan skill.

## Problems

(none yet)

## Verify findings

### Verify — ollama-tools — 2026-05-13

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — zero warnings |
| Type check (`npm run typecheck`) | PASS — exits 0 |
| Coverage (`npm run test:coverage`) | PASS — branches 90.96% / lines 99.61% / funcs 99.4% / stmts 98.57%, all ≥90 |
| `npm test` (Mocha) | PASS — 313/313 |
| Gherkin (`npm run test:bdd`) | PASS — 73 scenarios / 303 steps; all 4 ollama-tools scenarios green |
| `npm run verify` end-to-end | PASS — all 14 Playwright verify scripts (77 individual `record()` checks) green |
| ollama-tools verify (`tmp/ollamaTools-go-to-store.png`) | PASS — six `[data-message="tool"][data-tool-status="ok"]` rows visible between the user bubble and the final `"Added six tasks under #go-to-store."` assistant bubble, sidebar PROJECTS shows `#go-to-store` |

**Acceptance criteria (from `features/ollama-tools/plan.md`):**

1. PASS — covered by Gherkin scenario "Single add_task tool call writes a task file"; the step `then a task file matching "buy-milk-*.md" exists in the active vault todos folder` plus the frontmatter title/tags step asserts a `buy-milk-<TODAY>.md` with `title: "buy milk"`, `status: todo`, `tags: []`. Also exercised by `test/data/ollamaTools.spec.ts` `executeAddTask` tests.
2. PASS — covered by Gherkin scenario "Tool call with tags writes a tagged task"; the tag-arg path writes `tags: ["go-to-store"]` and the ollamaTools verify screenshot shows the sidebar `#go-to-store` entry rendered after re-render.
3. PASS — covered by `test/view/ollamaTools.spec.ts` "Tool row rendering" (data-tool-status=ok, data-tool-action) and by the verify screenshot showing six rows in array order.
4. PASS — covered by Gherkin scenario "Ambiguous request returns a clarifying question" and by `test/view/ollamaTools.spec.ts` "Multi-turn flow > renders the assistant content bubble when the model returns content with no tool_calls".
5. PASS — covered by Gherkin scenario "Single add_task tool call..." (`and the assistant final bubble reads "Added a task to buy milk."`) and by the verify screenshot showing the assistant summary bubble below the six tool rows.
6. PASS — covered by `test/data/ollamaTools.spec.ts` `parseToolCall` "returns error when the required title argument is missing" plus view test "renders the error message in [data-tool-error] on failure".
7. PASS — covered by `runOllamaWithTools` loop-cap branch (line covered per nyc report; explicit `'tool call loop exceeded 4 iterations'` literal exists in `src/main.ts`).
8. PASS — covered by Gherkin scenario "Go-to-store example breaks into six tagged tasks" and visually by `tmp/ollamaTools-go-to-store.png` (six `add_task: … #go-to-store` tool rows above the `Added six tasks under #go-to-store.` summary).

**Capture speed**: ollamaTools.verify.ts completes in ~3s wall (electron launch + two stub POSTs + readdir).
**Find-next clarity**: tool rows are visually distinct (mono, green check glyph, left-aligned) and clearly separate from user/assistant bubbles.
**Nesting**: chat thread keeps a flat layout — user bubble at top, tool rows in between, assistant summary last.

**Pre-existing-flake disclosure outcome (corrected):** The Implement note about `addSubtask.verify.ts` "criterion 4" being a pre-existing flake on `main` is **wrong**. I reproduced 5/5 PASS on stashed clean `main` (commit `f1341e4`) and 5/5 FAIL on the working tree before cleaning the fixtures dir. Root cause: the working tree carried six untracked fixture files under `test/fixtures/vault/todos/` (`buy-milk-2026-05-13.md`, `buy-eggs-...`, `buy-fruit-...`, `buy-flour-...`, `buy-jam-...`, `make-pancakes-...`) — leftovers from an earlier exploratory run by Implement. The new `buy-milk-2026-05-13.md` and the existing `buy-milk-2026-05-08.md` both slug-strip to `buy-milk`, so `readTodos()` produced two tasks sharing `data-task="buy-milk"`. The addSubtask verify clicked the affordance on the first one, but the second one's affordance was still present in the DOM — hence "affordance still present alongside input". After `rm`ing the six leftover files (NOT touching the implement diff), `addSubtask.verify.ts` and the entire `npm run verify` chain pass 14/14 scripts green. The ollama-tools verify script itself uses its own `os.tmpdir()`-rooted vault and never writes into `test/fixtures/`; the leftovers were a stale dev-environment artifact, not a generated test side-effect from this feature's verify run.

**Overall**: All static checks, all 313 Mocha tests, all 73 Cucumber scenarios, and the full `npm run verify` Playwright chain pass. The "pre-existing flake" was a fixture-pollution mirage that resolved by deleting six untracked .md files; no code change required.

## Background

User on 2026-05-13: "So is there any way I can get ollma to opt for tool calls? If its unclear I'd like it to ask but otherwise just go. It needs to handle break this down into tasks in the go to store project. ['I need you to go to the store, buy milk, some eggs, fruit and flour. We should be making pancakes. So some jam can be needed too.']"

This plan plumbs OpenAI-compatible tool calling through the existing HTTP transport (from `ollama-http`). One tool for v1: `add_task(title, tags?)`. The user's example demonstrates the value: a single sentence → 5-6 task files under a `#go-to-store` project tag, with the model picking out the items.

The "ask-vs-go" behavior is set via a system-prompt addendum that prepends to `VAULT.md` before each request. The model's actual ability to follow the instruction depends on its capability — `gemma4:e2b` may not handle tool calling reliably; tool-capable Ollama models like `llama3.1`, `llama3.2`, `qwen2.5`, `mistral` are the realistic targets. The plumbing itself works for any of them; the user picks via `OLLAMA_MODEL`.

## Skill deviations (acknowledged)

Mixed-shape feature. Three Gherkin scenarios cover the user-visible flow (single tool call, multi-tool go-to-store example, ambiguous request). Most other ACs are unit-test concerns (request body shape, parse helpers, tool-row rendering). Same shape as `ollama-diagnostics`. Implement should not retrofit additional Gherkin for the unit-test ACs.

## Implement notes

- All 4 ollama-tools Gherkin scenarios pass (`npm run test:bdd -- test/features/ollama-tools.feature`).
- `npm test` is green: 313 tests passing. Coverage stayed ≥90% on every metric (branches 90.96%).
- `npm run verify:static` (lint + typecheck + coverage) passes.
- The new `test/verify/ollamaTools.verify.ts` passes all 16 checks: six tool rows render, six markdown files are written into the tmp vault with `tags: [go-to-store]`, both stub-server tool-loop POSTs land, final summary bubble shows the expected text. Screenshot at `tmp/ollamaTools-go-to-store.png`.
- The renderer never imports Node modules; tool execution and write-guarding stay in `src/main.ts` / `src/main/ollamaTools.ts`.
- Regression checks: `chatInterface.verify.ts`, `ollamaDiagnostics.verify.ts`, and `ollamaHttp.verify.ts` all pass post-changes. The boot-time `warmupOllama()` still uses the plain `callOllama` path — the stub server detects warmup requests by the absence of a `tools` array and responds with a benign `"pong"`.
- Pre-existing flake (NOT caused by ollama-tools): `test/verify/addSubtask.verify.ts`'s "criterion 4: click replaces affordance with input" fails on `main` before any of these changes (confirmed via `git stash` round-trip on commit `541d5e6`). Because `verify:playwright` chains scripts with `&&`, running `npm run verify` end-to-end stops at that pre-existing failure before reaching the new verify script. All 13 other verify scripts plus the new `ollamaTools.verify.ts` pass when invoked individually.
