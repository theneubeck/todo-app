# todoz — TODO UI POC

Scope: build the POC described in `TODO-POC.md`. Nothing else. Ignore `PLAN.md` phases until the POC picks a winner.

Read `AGENTS.md` before touching vault data. Read `TODO-POC.md` before adding a pattern.

---

## Hard rules

### 1. Test-first. Always.

No production code is written before a failing test exists for it.

The loop is **red → green → refactor**, every time:

1. Write a test that describes the next behavior.
2. Run it. Confirm it fails for the expected reason (not a typo, not a missing import).
3. Write the smallest code that makes it pass.
4. Run the full test file. Confirm green.
5. Refactor only with tests green.

If you catch yourself writing a component, hook, or parser without a failing test on screen — stop, delete it, write the test first.

**Never** write the implementation and the test in the same edit. The test lands first, in its own commit-sized change, and is observed failing before the implementation exists.

### 2. One behavior per test

Each test asserts one behavior. No "and" in test names. If the test needs two assertions to describe one behavior (e.g. element rendered AND has correct text), that is one behavior — fine. If it asserts two independent behaviors, split it.

### 3. Test the contract, not the implementation

Tests describe what the user (or the calling code) sees. They do not assert on internal state, private functions, or DOM structure beyond what is user-visible. Component tests use React Testing Library queries by role/label/text — never by class name or test id unless there is no other way.

### 4. No mocking the file system in unit tests

The data layer reads markdown files. Unit tests for the data layer use real fixture files in `test/fixtures/vault/`. Mocking `fs` hides parser bugs. Component tests mock the data layer (the parser is already covered by its own tests).

### 5. Green bar before moving on

Never start the next test, the next pattern, or the next refactor with a red bar. If a test is red and you're stuck, that is the only thing being worked on.

### 6. Tests run in CI-equivalent locally

`npm test` runs the full suite headless, exits non-zero on failure, and is what defines "done." A pattern is not complete until `npm test` passes with the new tests included.

---

## POC structure

```
src/
  data/                shared data layer (read vault/todos/*.md → Task[])
    parseTodo.ts
    parseTodo.test.ts
    loadTodos.ts
    loadTodos.test.ts
  patterns/
    reminders/         pattern 1 — flat grouped list
      Reminders.tsx
      Reminders.test.tsx
    things/            pattern 2 — areas → projects → tasks
    todoist/           pattern 3 — priorities + NLP
    acunote/           pattern 4 — sprint + burndown
    outline/           pattern 5 — node tree
    linear/            pattern 6 — status columns
  App.tsx              pattern picker, no logic
test/
  fixtures/
    vault/
      todos/           hand-written .md files for tests
```

The shared data layer is built once, test-first. Each pattern reuses it. Patterns differ only in presentation and interaction — never in how data is loaded or written back.

---

## Stack (proposed — confirm before scaffolding)

| Concern | Choice | Reason |
|---|---|---|
| Build | Vite | fastest React dev loop |
| Language | TypeScript | catches schema drift in Task type |
| Test runner | Vitest | same config as Vite, jsdom built-in |
| Component tests | React Testing Library | role-based queries match rule #3 |
| User events | `@testing-library/user-event` | realistic input simulation |
| Frontmatter | `gray-matter` | already named in PLAN.md |

No Tauri yet. POC runs in browser via Vite dev server, reading fixture files bundled at build time or via a small dev-only fetch endpoint. Tauri integration happens after a winning pattern is picked.

---

## Build sequence

Follow `TODO-POC.md` order. Do not start pattern N+1 until pattern N renders fixture data, handles toggle, and has tests green.

For each pattern:

1. Write the test list (a comment block in the spec file with the behaviors to cover).
2. Pick the first behavior. Write the test. Watch it fail.
3. Implement. Watch it pass.
4. Repeat for each behavior in the list.
5. Manual smoke check in the browser only after the spec is fully green.

The data layer is built before pattern 1, in the same test-first loop, against fixture files that match the AGENTS.md schema.

---

## Definition of done (per pattern)

- All behaviors in the test list have passing tests.
- `npm test` passes with no skipped or `.only` tests.
- The pattern reads from the shared data layer, not its own parser.
- Toggling a task writes back to the source markdown file (or, in tests, the in-memory equivalent).
- A note in `TODO-POC.md` under that pattern: capture speed, find-next clarity, nesting handling.

---

## Out of scope for the POC

- Tauri shell, fs watching, real Google Drive sync
- Bookmarks, goals, notes views
- Editor (CodeMirror)
- AI layer, embeddings, semantic search
- Browser extension
- Styling beyond what is needed to evaluate the interaction

If a pattern needs one of these to be evaluable, stub it with the smallest possible fake and note the gap in `TODO-POC.md`.
