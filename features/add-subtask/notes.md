---
slug: add-subtask
frozen: false
---

# Notes — Add subtask

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run the plan-feature skill.

## Problems

(none yet)

## Verify findings

### Verify — add-subtask — 2026-05-08

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — 0 errors, 0 warnings |
| Type check (`npm run typecheck`) | PASS — exit 0 |
| Coverage (`npm run test:coverage`) | PASS — 98.43% stmts / 90.21% branches / 99.04% funcs / 99.65% lines (uncovered: `index.ts:388,474`, `writeTodo.ts:30,76`) |
| `npm test` (mocha/Tallahassee) | PASS — 141 passing |
| Gherkin (`npm run test:bdd`) | PASS — 31 scenarios / 132 steps |
| `npm run verify` (todoList script) | PASS — 3 write-back checks |
| `addSubtask.verify.ts` (interactive) | PASS — 14 in-window checks |

#### Screenshots → acceptance criteria

| # | Criterion (verbatim from plan.md) | Result | Screenshot |
|---|---|---|---|
| 1 | Given a simple task is rendered, when the initial render completes, then a `+ Add subtask` affordance is present directly beneath that task row, indented to subtask alignment. | PASS | `test/screenshots/addSubtask-initial.png` — Buy milk and Send invoice each show `+ Add subtask` indented to subtask alignment beneath the row |
| 2 | Given a combined task is expanded, when the initial render completes, then a `+ Add subtask` affordance is present immediately beneath the last subtask row. | PASS | `test/screenshots/addSubtask-initial.png` (Pickup package) and `test/screenshots/addSubtask-prep-deck-expanded.png` (Prep deck) — `+ Add subtask` sits immediately beneath the last subtask in both expanded combined rows |
| 3 | Given a combined task is collapsed, when the initial render completes, then no `+ Add subtask` affordance is rendered for that task. | PASS | `test/screenshots/addSubtask-initial.png` — Call dentist, Sync with Mike, Q2 report, Weekly shop are collapsed and show no `+ Add subtask` text. Programmatic check also confirmed no `[data-add-subtask]` exists under collapsed prep-deck |
| 4 | Given a `+ Add subtask` affordance is rendered, when the user clicks it, then the affordance is replaced in the same position by a focused `<input type="text">`. | PASS | `test/screenshots/addSubtask-buy-milk-input-open.png` — `+ Add subtask` text replaced by an empty bordered text input box at the same position beneath Buy milk; `document.activeElement === input` confirmed programmatically |
| 5 | Given the input is open on a combined task with text "draft outline", when the user presses Enter, then the parent file's body has `- [ ] draft outline` appended after the existing top-level bullets, a new subtask row with that title appears at the end of the parent's subtask list, and the affordance is restored beneath it. | PASS | `test/screenshots/addSubtask-prep-deck-after-add.png` — Prep deck shows draft section 1, review numbers, draft outline (new, at end), and `+ Add subtask` restored beneath; file body asserted to contain `- [ ] draft outline` |
| 6 | Given the input is open on a simple task with text "buy stamps", when the user presses Enter, then the task is rendered as combined+expanded with one subtask row "buy stamps" and a `+ Add subtask` affordance below it. | PASS | `test/screenshots/addSubtask-buy-milk-converted.png` — Buy milk now shows a chevron (combined+expanded), one subtask "buy stamps", and `+ Add subtask` below; `[data-task="buy-milk"][data-kind="combined"][data-expanded="true"]` confirmed in DOM |
| 7 | Given the input is open, when the user presses Esc, then the input tears down, the affordance is restored, and no file write occurs. | PASS | `test/screenshots/addSubtask-after-esc.png` — input is gone, `+ Add subtask` restored beneath Buy milk; file content compared byte-for-byte before/after Esc, unchanged |
| 8 | Given the input is open with whitespace-only text, when the user presses Enter, then the input tears down, the affordance is restored, and no file write occurs. | PASS | Same render state as `addSubtask-after-esc.png` re-asserted programmatically; file content compared byte-for-byte before/after whitespace-Enter, unchanged |

#### Toggle write-back

PASS — `addSubtask.verify.ts` exercised both flows that mutate vault files (`prep-deck` combined add and `buy-milk` simple-to-combined conversion). For each: snapshotted the fixture, performed the click + type + Enter sequence, asserted the file contained the new `- [ ] <text>` line, then restored the fixture from the snapshot. Final `git status` of the fixtures directory is clean.

**Capture speed**: ~2.0s for full mocha + ~0.4s for cucumber. Playwright add-subtask script runs ~12s.
**Find-next clarity**: affordance is consistently `+ Add subtask` styled in the outline/grey color and clearly distinguishable from real subtasks; humans reviewing the screenshots can locate it without ambiguity.
**Nesting**: `+ Add subtask` appears at the same horizontal indent as subtask titles in both simple and combined+expanded rows, matching the plan's "indented to subtask alignment" requirement.

**Overall**: All 8 acceptance criteria pass visually and programmatically; static checks, unit tests, BDD, and both Playwright verify scripts are green; coverage is comfortably above the 90% gate.
