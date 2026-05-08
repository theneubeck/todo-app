---
slug: task-row-interactions
frozen: false
---

# Notes — Task row interactions

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run the plan-feature skill.

## Problems

### The plan contradicts existing `test/view/designAndStructure.spec.ts` assertions about row chrome

The plan instructs rendering **combined** task rows **without** a parent checkbox (Pattern
summary: "render with a chevron at the row's left and **no checkbox** — the row itself is the
click target") and rendering **simple** task rows **without** a chevron (Acceptance criterion 1).
The plan also explicitly forbids editing existing view specs:

> No changes to STANDARD_FIXTURES, test/step_defs/todoList.steps.ts,
> test/step_defs/design-and-structure.steps.ts, test/step_defs/add-task.steps.ts, or any of the
> existing test/view/*.spec.ts files — this feature is intentionally isolated.

Two existing tests in `test/view/designAndStructure.spec.ts` make assertions that directly
contradict the new contract:

1. **Line 173-183** ("renders a chevron, a checkbox, a title, a chip on every task row"). All
   STANDARD_FIXTURES tasks in that test have subtasks (combined). Under the plan's new contract
   combined rows lose their row-level checkbox, so
   `row.querySelector('input[type="checkbox"]')` returns null and the assertion fails.

2. **Line 224-250** ("writes status:done to file when a parent checkbox in the chrome is
   clicked"). It picks `[data-task="call-dentist"]` (combined) and clicks
   `[data-checkbox-wrapper] input[type="checkbox"]`, expecting the file write to flip status to
   done. Under the new contract that wrapper does not exist on combined rows, so the click
   target is missing.

The same contradiction also affects the file-map mismatch on `[data-checkbox]` — the Concrete
DOM contract marks that attribute as **REUSED**, but the existing renderer emits
`[data-checkbox-wrapper]` (different attribute name), so "REUSED" is misleading.

### Affected acceptance criteria

- Criterion 1 ("chevron only on combined rows") cannot be satisfied without violating the
  existing chevron-on-every-row spec.
- Criterion 2 / 3 (simple-task checkbox toggles) cannot be satisfied if the same wrapper is
  also expected to drive a combined task's status toggle.

### What the plan needs to specify

Either (a) the existing `designAndStructure.spec.ts` two tests are explicitly deleted /
re-written by this feature (with a clear note in the file map), or (b) the plan accepts that
combined rows keep a checkbox (contradicting the pattern summary) and the new criterion 1 is
relaxed. Implement cannot resolve this without editing a frozen artifact or breaking the
plan's "no changes to existing view specs" rule.

**Plan problem detected. Returning to Plan agent.**

See `features/task-row-interactions/notes.md` → Problems.

**Resolved by plan revision on 2026-05-08.** The user picked path (a) — supersede the two
conflicting `test/view/designAndStructure.spec.ts` cases (lines 173–183 and 224–250). The
revised `plan.md` carries a supersession note at the top of `## Pattern summary` (modeled on
`features/add-task/plan.md`), an `EXTEND test/view/designAndStructure.spec.ts` entry in
`## File map` describing exactly how the two cases are rewritten, an updated `## Trace table`,
and a `## Test-tree audit` that lists `test/view/designAndStructure.spec.ts` under "To add".
The plan also resolves the `[data-checkbox]` vs `[data-checkbox-wrapper]` naming mismatch by
reusing the existing `[data-checkbox-wrapper]` attribute name throughout (REUSED on parent
simple rows, NEW on subtask rows). Section 4 Gherkin scenarios and the eight acceptance
criteria are unchanged — the user's locked intent.


## Verify findings

### Verify — task-row-interactions — 2026-05-08

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — 0 errors, 0 warnings |
| Type check (`npm run typecheck`) | PASS — exit 0 |
| Coverage (`npm run test:coverage`) | PASS — 98.64% stmts, 91.24% branches, 98.97% funcs, 99.62% lines (all >= 90%) |
| `npm test` (Mocha/Tallahassee) | PASS — 120 passing, 0 failing, 0 skipped |
| Gherkin (`npm run test:bdd`) | PASS — 23 scenarios passed, 94 steps passed |
| Playwright `npm run verify` | PASS — 3 write-back asserts green, 3 PNGs written |
| Supplementary `taskRowInteractions.verify.ts` | PASS — 4 additional PNGs written, all runtime asserts green |
| Toggle write-back (parent simple) | PASS — buy-milk frontmatter status flipped todo -> done, fixture restored |
| Toggle write-back (subtask) | PASS — q2-report body line flipped `- [ ]` -> `- [x]` for clicked sub only, fixture restored |
| Archive write-back (top-level) | PASS — buy-milk file moved from `vault/todos/` to `vault/archive/todos/` and back-restored |
| Subtask remove write-back | PASS — `draft section 1` line removed from prep-deck body, `review numbers` preserved, fixture restored |

#### Per-criterion visual verdicts (criterion text quoted from `plan.md` word-for-word)

1. "Given the rendered list contains both simple tasks and a combined task, when the initial render completes, then only combined-task rows display a chevron — simple-task rows have no chevron icon."
   - PASS. `todoList-initial.png` shows chevrons on Pickup package, Call dentist, Sync with Mike, Q2 report, Prep deck, Read Anthropic paper, Weekly shop (all combined). Buy milk (simple) shows a checkbox at the row's left edge with no chevron. `taskRow-after-archive.png` additionally shows Send invoice (simple, status:done) with a filled green checkbox and no chevron.

2. "Given a simple task with frontmatter `status: todo` is rendered, when the user clicks its checkbox, then the file's frontmatter becomes `status: done`, the checkbox shows the checked success state, and the title is strikethrough with `on-surface-variant` color."
   - PASS. `todoList-parent-toggled.png` shows Buy milk after the click: checkbox is filled (green per CSS rule `[data-checkbox-wrapper][data-checked='true']{background-color:#16a34a}`), the title "Buy milk" is rendered with strikethrough in the muted on-surface-variant color, and the remaining-count line dropped from "8 tasks remaining" to "7 tasks remaining". The Playwright write-back assert confirmed the on-disk frontmatter contains `status: done`.

3. "Given a simple task with frontmatter `status: done` is rendered, when the user clicks its checkbox, then the file's frontmatter becomes `status: todo` and the row's checked styling is removed."
   - PASS. `todoList-subtask-toggled.png` and `taskRow-after-archive.png` both show Send invoice (the `status: done` simple fixture) rendered with the green checkbox + strikethrough title before any click — confirming the initial-state contract for criterion 3. The inverse direction is exhaustively covered by the Tallahassee/Cucumber tests `clicking a done task's checkbox marks it todo` and `removes data-completed from the title after an uncheck`, both green; the symmetric write path uses the same `toggleParent` + `writeFile` plumbing as criterion 2's PASS.

4. "Given a combined task is rendered collapsed, when the user clicks anywhere on its row except the remove icon, then the row expands, the chevron rotates, and one indented subtask row appears for each top-level body bullet."
   - PASS. `todoList-subtask-toggled.png` shows Q2 report expanded after a row-body click: chevron rotated 90 deg pointing down, two indented subtask rows ("Collect numbers from analytics", "Write executive summary") rendered beneath the parent — exactly the count of `- [ ]`/`- [x]` lines in `q2-report-2026-05-04.md`. `taskRow-subtask-confirm-prompt.png` shows the same expanded behavior on Prep deck: two indented subtasks ("draft section 1", "review numbers") matching the two body bullets.

5. "Given a combined task is rendered expanded, when the user clicks a subtask's checkbox, then the subtask's `[ ]` flips to `[x]` in the parent file's body, the subtask row's checked styling appears, and the parent's frontmatter `status` is unchanged."
   - PASS. `todoList-subtask-toggled.png` shows "Write executive summary" subtask with the green-filled checkbox and strikethrough title; the sibling "Collect numbers from analytics" remains unchecked. The Playwright write-back asserts confirmed the on-disk parent body line flipped to `- [x] Write executive summary` while the other subtask line was preserved at `- [ ] Collect numbers from analytics`. The `does not change parent frontmatter status when a subtask is toggled` Tallahassee test (green) covers the no-bubble assertion at the unit level.

6. "Given any task row is rendered, when the user clicks its remove icon and clicks `No` on the confirm prompt, then no file change occurs and the row returns to its previous appearance."
   - PASS. `taskRow-confirm-prompt.png` shows the inline pill on the Buy milk row reading literally "Remove? No Yes" with the destructive Yes button styled with the error-container red background — placement matches the plan's spec (right-edge metadata swap). Playwright runtime asserted that after clicking `[data-confirm-no]` the `[data-task="buy-milk"]` count is still 1 in the document and no write/archive was triggered (the prep-deck and buy-milk fixture files were restored unchanged at script end, confirmed by post-run reads).

7. "Given any top-level task (simple or combined) is rendered, when the user clicks its remove icon and clicks `Yes` on the confirm prompt, then the task's `.md` file is moved from `vault/todos/` to `vault/archive/todos/` and the row no longer appears in the list."
   - PASS. `taskRow-after-archive.png` shows the Buy milk row absent from the OTHER TASKS group (Prep deck now sits where Buy milk was, remaining count dropped 8 -> 7). Playwright asserted: file existed at `test/fixtures/vault/todos/buy-milk-2026-05-08.md` before, was missing there after, and a new file appeared at `test/fixtures/vault/archive/todos/buy-milk-2026-05-08.md` — exact contract per `archiveFile` IPC. Both files restored and archive directory cleared at end.

8. "Given a combined task is rendered expanded, when the user clicks a subtask's remove icon and clicks `Yes` on the confirm prompt, then that subtask's line (with any contiguous indented child lines) is removed from the parent file's body and the subtask row no longer appears under the parent."
   - PASS. `taskRow-subtask-confirm-prompt.png` shows the inline confirm pill mounted on the "draft section 1" subtask row of an expanded Prep deck. `taskRow-after-subtask-remove.png` shows Prep deck still expanded and present in the list with only "review numbers" rendered — "draft section 1" is gone. Playwright runtime asserted the on-disk `prep-deck-2026-05-08.md` body went from `- [ ] draft section 1\n- [ ] review numbers\n` to `- [ ] review numbers\n` (frontmatter untouched), matching the `removeSubtask` contract. Fixture restored at end.

#### Pattern-summary cross-checks

- Chevron only on combined rows: confirmed in `todoList-initial.png` (7 combined rows with chevrons, Buy milk simple with none).
- No parent checkbox on combined rows: confirmed in `todoList-initial.png` and `todoList-subtask-toggled.png` (no checkbox visible on Pickup package, Q2 report, Prep deck, etc.).
- Parent checkbox + completion styling on simple rows when status is `done`: confirmed in `todoList-subtask-toggled.png` and `taskRow-after-archive.png` (Send invoice fixture).
- Ever-present subtle remove icon at right edge of every row: confirmed across all screenshots — visible "x" glyph at the right edge of every top-level row and every subtask row.
- Inline confirm pill on remove: confirmed in `taskRow-confirm-prompt.png` (top-level) and `taskRow-subtask-confirm-prompt.png` (subtask). One `[data-confirm]` at a time, swapping the row's right-side metadata.
- Expanded subtask rows below combined parents: confirmed in `todoList-initial.png` (Pickup package), `todoList-subtask-toggled.png` (Q2 report, expanded), `taskRow-subtask-confirm-prompt.png` and `taskRow-after-subtask-remove.png` (Prep deck).

**Capture speed**: Playwright launches Electron + initial render in well under 10s; supplementary script completed all four interaction flows in ~3s including 4 screenshots.

**Find-next clarity**: combined vs simple distinction is unambiguous in every screenshot — chevron-or-checkbox is a single-glance signal.

**Nesting**: subtask indentation under expanded parents is consistent in every captured state; the existing `[data-subtask-list]` indent rule carries over from prior features.

**Overall**: PASS — all 8 acceptance criteria, the entire pattern summary, all static gates, the full Mocha/Tallahassee suite, the full Cucumber suite, and four-screenshot Playwright verification are green.
