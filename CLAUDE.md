# todoz — POC

Build the nested todo list described in `TECH-POC.md`. Nothing else.

Read `AGENTS.md` before touching vault data. Read `TECH-POC.md` before touching any code.

---

## Three-agent workflow

Every task moves through three agents in order. Do not skip steps.

```
plan  →  implement  →  verify
  ↑                       |
  └────── (if red) ───────┘
```

- Starting a new feature → `/agent plan`
- Writing code → `/agent implement`
- Checking results → `/agent verify`

**Gate rule**: `implement` does not start without a frozen plan ending in **"Plan complete. Ready for Implement."** `verify` does not start until `implement` declares **"Implement complete. Ready for Verify."** If `verify` fails, return to `implement` with the specific failure — do not re-plan unless the approach is fundamentally wrong.

### Per-feature artifact layout

Plan writes the contract to `features/<slug>/`. This is the single source of truth for one feature; Cucumber loads `.feature` files from here.

```
features/<slug>/
  plan.md          ← frozen (frontmatter `frozen: true`)
  <slug>.feature   ← frozen (Cucumber loads via cucumber.js paths)
  notes.md         ← mutable scratchpad — Problems + Verify findings
```

Fixtures still live in `test/fixtures/vault/todos/` per `AGENTS.md` schema.

### Frozen-artifact rule

`plan.md` and `<slug>.feature` are **frozen**. Implement and Verify must not edit them.

- If a plan/feature turns out to be wrong, the agent appends a `## Problem` block to `features/<slug>/notes.md`, stops, and declares **"Plan problem detected. Returning to Plan agent."**
- The user re-runs `/agent plan` to thaw, revise, and re-freeze. Implement and Verify never edit the contract themselves.
- Verify findings go into `notes.md` under `## Verify findings` (and mirror to the `TECH-POC.md` Verify section).

---

## Stack

| Concern | Choice |
|---|---|
| Desktop shell | Electron |
| Language | TypeScript |
| UI | Vanilla TypeScript + DOM (no framework) |
| DOM testing | `@expressen/tallahassee` |
| Acceptance tests | `@cucumber/cucumber` (Gherkin `.feature` + step defs that reuse Tallahassee) |
| Test runner | Mocha + Chai (BDD style) |
| Frontmatter | `gray-matter` |
| File watching | `chokidar` |
| Ollama | `child_process.spawn` |
| Visual verification | Playwright (`_electron`) screenshots, agent reads PNGs via Read tool |

---

## Hard rules

### Never write implementation before a failing test exists

The loop is: write test → watch it fail → write minimal code → watch it pass → refactor.

### BDD outside-in

Write the Tallahassee acceptance test for the full view first. Then work inward — write tests for `parseTodo`, `writeTodo` — only as needed to make the outer test pass.

### One behavior per test

No "and" in test names. One behavior per test.

### Green before moving on

Never start the next feature with a red bar.

### Renderer process never imports Node modules

`fs`, `path`, `child_process` are never imported in renderer files. All system access goes through `window.todoz.*`.

---

## Dos

- Read `TECH-POC.md` and `AGENTS.md` before starting
- Write fixture `.md` files in `test/fixtures/vault/todos/` that match the `AGENTS.md` schema exactly
- Mock `window.todoz` in Tallahassee tests with realistic fixture data
- Add `data-*` attributes to DOM elements so tests can query them without relying on CSS classes
- Take a screenshot at the end of every implement session
- Restore fixture files after toggle tests that mutate them

## Don'ts

- Don't use React, Vue, or any UI framework
- Don't import Node.js modules in renderer files
- Don't write implementation and tests in the same edit
- Don't add features not described in `TECH-POC.md`

---

## Definition of done

- Lint and type check pass: `npm run verify:static`
- All Mocha/Tallahassee tests pass at ≥90% coverage: `npm run test:coverage`
- Playwright verify script passes: `npm run verify`
- Verify agent reads the captured screenshot PNGs via the Read tool and confirms each acceptance criterion visually
- Toggle writes back to the fixture file and restores correctly
- Findings noted in the "Verify findings" section of `TECH-POC.md`
