# todoz — POC

Build the todo UI POC described in `TODO-POC.md` using the stack in `TECH-POC.md`. Nothing else.

Read `AGENTS.md` before touching vault data. Read `TODO-POC.md` before adding a pattern. Read `TECH-POC.md` before touching any code.

---

## Three-agent workflow

Every task moves through three agents in order. Do not skip steps.

```
plan  →  implement  →  verify
  ↑                       |
  └────── (if red) ───────┘
```

Invoke the right sub-agent for the current phase using `/agent`:

- Starting a new pattern or feature → `/agent plan`
- Writing code → `/agent implement`
- Checking results → `/agent verify`

**Gate rule**: `implement` does not start without a written plan ending in **"Plan complete. Ready for Implement."** `verify` does not start until `implement` declares **"Implement complete. Ready for Verify."** If `verify` fails, return to `implement` with the specific failure — do not re-plan unless the approach is fundamentally wrong.

---

## Stack

| Concern | Choice |
|---|---|
| Desktop shell | Electron |
| Language | TypeScript |
| UI | Vanilla TypeScript + DOM (no framework) |
| DOM testing | `@expressen/tallahassee` |
| Test runner | Mocha + Chai (BDD style) |
| Frontmatter | `gray-matter` |
| File watching | `chokidar` |
| Ollama | `child_process.spawn` |
| Visual verification | Playwright (`_electron`) + Claude vision API |

---

## Hard rules

### Never write implementation before a failing test exists

The loop is: write test → watch it fail → write minimal code → watch it pass → refactor.

If you catch yourself writing a renderer function, IPC handler, or DOM builder without a failing Mocha test — stop. Delete it. Write the test first.

### BDD outside-in

Start from the outermost layer the user sees. Write the Tallahassee acceptance test for the full pattern render first. Then work inward — write tests for `parseTodo`, `writeTodo`, IPC handlers — only as needed to make the outer test pass.

### One behavior per test

No "and" in test names. If a test needs two assertions for one behavior (element rendered AND has correct text), that is fine. If it asserts two independent behaviors, split it.

### Green before moving on

Never start the next pattern with a red bar. If stuck, that red test is the only thing being worked on.

### Renderer process never imports Node modules

`fs`, `path`, `child_process` are never imported in renderer files. All system access goes through `window.todoz.*` from the preload bridge. Tallahassee tests mock `window.todoz` with fixture data.

---

## Dos

- Read the three key files before starting: `TECH-POC.md`, `TODO-POC.md`, `AGENTS.md`
- Write fixture `.md` files in `test/fixtures/vault/todos/` that match the `AGENTS.md` schema exactly
- Mock `window.todoz` in Tallahassee tests with realistic fixture data
- Add `data-*` attributes to DOM elements so tests can query them without relying on CSS classes
- Take a screenshot at the end of every implement session
- Restore fixture files after toggle tests that mutate them
- Note findings (capture speed, find-next, nesting) in `TODO-POC.md` after each pattern is verified

## Don'ts

- Don't use React, Vue, or any UI framework
- Don't import Node.js modules in renderer files
- Don't write implementation and tests in the same edit
- Don't start pattern N+1 until pattern N is verified green
- Don't mutate fixture files without restoring them
- Don't skip the verify step — Tallahassee green is necessary but not sufficient
- Don't add features not described in `TODO-POC.md` or `TECH-POC.md`

---

## Definition of done (per pattern)

- Lint and type check pass: `npm run verify:static`
- All Mocha/Tallahassee tests pass at ≥90% coverage: `npm run test:coverage`
- Playwright verify script passes: `npm run verify`
- Vision assertion confirms the pattern renders correctly
- Toggle writes back to the fixture file and restores correctly
- Findings noted in `TODO-POC.md` under that pattern
