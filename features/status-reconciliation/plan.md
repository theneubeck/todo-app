---
name: Status reconciliation
slug: status-reconciliation
status: planned
frozen: true
created: 2026-05-09
---

# Status reconciliation

## Pattern summary

A data-layer fix that keeps a task's frontmatter `status` in agreement with its body's subtask state whenever the body changes. Today the three subtask writers (`addSubtask`, `toggleSubtask`, `removeSubtask` in `src/renderer/data/writeTodo.ts`) mutate only the body — they never touch frontmatter — while `toggleParent` updates only frontmatter (and the first body checkbox). This independence lets the two halves drift apart, producing files like `status: done` with `- [ ] still-pending`, or `status: todo` with all body bullets `[x]`. The fix introduces one rule, applied at the end of each body-mutating writer: if the resulting body has at least one top-level checkbox AND every top-level checkbox is `[x]`, set frontmatter `status` to `done`; otherwise if the body has at least one top-level checkbox, set frontmatter `status` to `todo`; otherwise leave `status` alone (empty body — simple-task case, not derivable from subtasks). The rule never writes `doing` and never inspects `doing` — a `status: doing` task that has no subtask state to derive from stays `doing`. This plan **supersedes** the deferred "subtask-after-complete" bug recorded in `features/bug-fixes-1/notes.md` under "## Deferred"; the rule covers that bug and the broader drift that an exploration walk surfaced (see `test/screenshots/parent-child-bug/` for the exploration evidence). Renderer behavior, DOM contracts, and visual treatment do not change — only the on-disk state becomes self-consistent, which has the user-visible side effect that the "N tasks remaining" line and any future archive-on-`status:done` flow reflect what the user sees.

**In scope:** post-write `status` reconciliation in `addSubtask`, `toggleSubtask`, and `removeSubtask`; preserving `doing` and the empty-body case; unit tests for each writer covering done/todo/preserve transitions; integration tests asserting the "N tasks remaining" count moves correctly when a task auto-completes or auto-reopens via subtask edits.

**Out of scope:** changing `toggleParent` (already touches frontmatter — its existing behavior is correct under the new rule); auto-deriving `doing` from any state; reconciling on parse / read (`parseTodo` does not rewrite files); fixing on-disk files that were inconsistent before this rule landed; introducing a separate "all-subtasks-done" indicator distinct from `status`; renderer changes — the existing `data-completed` derivation from subtasks already handles the "title struck through" case and stays exactly as it is.

## Acceptance criteria

1. Given a combined task `buy-milk` exists with body `- [x] step 1\n- [ ] step 2` and frontmatter `status: todo`, when the user checks subtask "step 2", then the file frontmatter `status` becomes `done`.
2. Given a combined task `buy-milk` exists with body `- [x] step 1\n- [x] step 2` and frontmatter `status: done`, when the user unchecks subtask "step 1", then the file frontmatter `status` becomes `todo`.
3. Given a simple task `buy-milk` exists with empty body and frontmatter `status: done`, when the user adds a subtask "draft outline", then the file frontmatter `status` becomes `todo`.
4. Given a combined task `buy-milk` exists with body `- [x] step 1\n- [ ] step 2` and frontmatter `status: todo`, when the user removes subtask "step 2", then the file frontmatter `status` becomes `done`.
5. Given a combined task `buy-milk` exists with body `- [x] step 1\n- [ ] step 2` and `status: todo` and the initial remaining count is captured, when the user checks subtask "step 2", then the remaining count is 1 less than the captured value.
6. Given a combined task `buy-milk` exists with body `- [x] step 1\n- [x] step 2` and `status: done` and the initial remaining count is captured, when the user unchecks subtask "step 1", then the remaining count is 1 more than the captured value.

## Step-definition file

`test/step_defs/status-reconciliation.steps.ts` — steps:

**Given:**
- `Given("a combined task {string} exists with body {string} and frontmatter status {string}")` (NEW) — writes a fixture file at `test/fixtures/vault/todos/<slug>-<TODAY>.md` whose frontmatter has `type: task`, the given `title` (= slug), the given `status`, `tags: []`, `created: <TODAY>`; body is the given multi-line string with `\n` literally interpreted as a newline. Records the path on `this.createdFixtures` so the After hook can clean up.
- `Given("a simple task {string} exists with empty body and frontmatter status {string}")` (NEW) — same as above with empty body.
- `Given("the initial remaining count is captured")` (NEW) — mounts the app via `mountApp(this.document.body)` and reads `[data-remaining-count]` (or whatever selector the existing remaining-count line uses; reuse what design-and-structure / add-task tests already query). Stores the integer on `this.initialRemainingCount`.

**When:**
- `When("the user checks subtask {string}")` (NEW) — finds the `[data-subtask]` whose `[data-subtask-title]` text equals the string, clicks its `input[type="checkbox"]`. Waits for the renderer to settle (300ms) before returning.
- `When("the user unchecks subtask {string}")` (NEW) — same as above; the checkbox is already `:checked`, so a click toggles to unchecked.
- `When("the user adds a subtask {string}")` (NEW) — clicks the appropriate `[data-add-subtask]` (simple-task affordance directly under the row, or combined-task affordance inside the subtask list — whichever is present), types the string into `[data-add-subtask-input]`, presses Enter. Waits for the renderer to settle.
- `When("the user removes subtask {string}")` (NEW) — finds the `[data-subtask]` matching the title, triggers its remove control. The exact remove affordance is whatever `task-row-interactions` exposes; reuse the existing remove step from `task-row-interactions.steps.ts` if its phrasing fits, otherwise mirror its mechanism. Confirms via `[data-confirm-yes]` if the remove flow shows a confirm prompt.

**Then:**
- `Then("the file frontmatter status of {string} is {string}")` (NEW) — reads the fixture file at `test/fixtures/vault/todos/<slug>-<TODAY>.md` (path resolved from the slug + today), parses the `status:` line, asserts equality with the given string.
- `Then("the remaining count is 1 less than the captured value")` (NEW) — re-reads the remaining-count line, asserts integer equality with `this.initialRemainingCount - 1`.
- `Then("the remaining count is 1 more than the captured value")` (NEW) — analogous, with `+ 1`.

**Reuse:** `mountApp` setup from existing world.ts. The fixture lifecycle (snapshot before scenarios, restore after) already exists in `test/step_defs/world.ts` from add-subtask / task-row-interactions — extend that lifecycle to also clear out any fixture file in `this.createdFixtures` after each scenario.

## BDD test list

[file: test/data/writeTodo.spec.ts]  ← extend the existing file
- `describe("toggleSubtask")` > `it("sets frontmatter status to done when checking the last unchecked subtask")`
- `describe("toggleSubtask")` > `it("sets frontmatter status to todo when unchecking from an all-checked state")`
- `describe("toggleSubtask")` > `it("preserves frontmatter status todo when not all subtasks transition to checked")`
- `describe("toggleSubtask")` > `it("preserves frontmatter status doing when reconciliation does not apply")`
- `describe("addSubtask")` > `it("sets frontmatter status to todo when called on a done simple task")`
- `describe("addSubtask")` > `it("sets frontmatter status to todo when called on a done combined task with all checked subtasks")`
- `describe("addSubtask")` > `it("preserves frontmatter status todo when called on a todo simple task")`
- `describe("removeSubtask")` > `it("sets frontmatter status to done when remaining subtasks are all checked")`
- `describe("removeSubtask")` > `it("sets frontmatter status to todo when at least one remaining subtask is unchecked")`
- `describe("removeSubtask")` > `it("preserves frontmatter status when the body becomes empty")`

[file: test/patterns/status-reconciliation.spec.ts]
- `describe("Status reconciliation in render")` > `it("decreases the remaining count by 1 when the last unchecked subtask is checked")`
- `describe("Status reconciliation in render")` > `it("increases the remaining count by 1 when a subtask is unchecked from an all-done state")`

## File map

### New files
- `test/step_defs/status-reconciliation.steps.ts`
- `test/patterns/status-reconciliation.spec.ts`
- `test/verify/statusReconciliation.verify.ts` — Playwright script. Drives a live walk: create simple task via `/add status-recon` (or use a known fixture), add two subtasks, check both, screenshot ("title struck + count down by 1"), uncheck one, screenshot ("title not struck + count up by 1"), then for the simple-done-then-add path: create another task, toggle parent done, add a subtask, screenshot ("status reset to todo, remaining count restored"). Asserts file frontmatter at each step. Captures four screenshots into `test/screenshots/`.

### Files to update
- `src/renderer/data/writeTodo.ts`:
  - Add a private helper `function reconcileStatus(raw: string): string` that parses the body, finds top-level checkbox lines, applies the rule (≥1 checkbox AND all `[x]` → `done`; ≥1 checkbox AND any `[ ]` → `todo`; zero checkboxes → leave alone), and rewrites the `status:` line via the existing `STATUS_LINE_RE` only when a transition is needed. Idempotent on inputs that already match the rule.
  - Add a private helper `function setStatus(raw: string, next: 'todo' | 'done'): string` that writes the value via `STATUS_LINE_RE` if the current value differs, returning `raw` unchanged when already correct.
  - Wrap the return value of `addSubtask`, `toggleSubtask`, and `removeSubtask` with `reconcileStatus(...)`. Do NOT modify `toggleParent` — its current behavior (flip `status` AND first body checkbox) remains correct under the rule and is explicitly out of scope.
  - The `STATUS_LINE_RE` regex (line 5) is reused as-is.
- `test/data/writeTodo.spec.ts` — add the 10 new test cases listed in BDD test list. The existing tests for the four writers must stay green — `reconcileStatus` is additive, idempotent on well-formed input, and never fires on the empty-body path.
- `package.json` — append `&& ts-node test/verify/statusReconciliation.verify.ts` to `verify:playwright`.
- `test/step_defs/world.ts` — add a `createdFixtures: string[]` field initialized to `[]` on each scenario; the After hook unlinks every path in the array. The existing fixture-restore lifecycle from add-subtask/task-row-interactions stays intact.

### DOM contract
No new selectors. Existing selectors used by the new tests:
- `[data-task="<slug>"]` (existing) — task row.
- `[data-subtask]` and `[data-subtask-title]` (existing) — subtask row + visible title.
- `[data-add-subtask]`, `[data-add-subtask-input]` (existing from add-subtask) — affordance and inline input.
- The remaining-count line — reuse whatever selector existing tests query (likely `[data-remaining-count]` or text inside the main view's header). Implement should grep `test/view/designAndStructure.spec.ts` and `test/patterns/add-task.spec.ts` for the existing pattern and reuse it; do not introduce a new selector.

### Visual treatment
No new styling. The existing rendering rules (parent title struck through when all subtasks are done; remaining-count line in the main header) are unchanged — what changes is the on-disk frontmatter that drives them once a write returns to the renderer.

## Data fixtures

No fixture `.md` files committed for this feature. The cucumber world writes per-scenario fixture files at runtime to `test/fixtures/vault/todos/<slug>-<TODAY>.md` via the `Given` step phrased as "a combined task ... exists with body ..." or "a simple task ... exists with empty body ...". The After hook removes them. Each scenario uses the slug `buy-milk` for its fixture (per the AC text); the file path is `test/fixtures/vault/todos/buy-milk-<TODAY>.md`. If a real `buy-milk-<date>.md` is already present in the fixture set on a given run, the world should overwrite it for the scenario and restore it from the existing snapshot mechanism in After (this matches how task-row-interactions and add-subtask handle fixture mutation).
