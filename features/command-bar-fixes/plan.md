---
name: Command bar fixes
slug: command-bar-fixes
status: planned
frozen: true
created: 2026-05-11
---

# Command bar fixes

## Pattern summary

Two small adjustments to the command bar pinned at the bottom of the main view. First, the `cmd + i` shortcut becomes **prepend-safe**: today it unconditionally overwrites the input with `/add ` (`src/renderer/index.ts` line 1064), discarding whatever the user had typed. After the fix, pressing `cmd + i` on an input whose value does not start with the literal prefix `/add ` prepends `/add ` to the existing text — so typing "buy milk" then pressing `cmd + i` produces `/add buy milk`. If the input is empty, the result is `/add ` (unchanged from today's behavior). If the input already starts with `/add ` literally, `cmd + i` leaves the value untouched and only restores focus to the input. Second, the two demo chips currently rendered inside `[data-command-bar-fields]` — `[data-command-chip="mention"]` showing "@name" and `[data-command-chip="tag"]` showing "#design" (lines 581-588) — are removed. These were visual placeholders inherited from the original `design-and-structure` plan and serve no purpose now that real tag-derived sidebar entries (PROJECTS, PEOPLE) are populated from the active vault. The bolt icon at the left of the bar, the input field, and the `CMD + K` hint on the right remain unchanged in shape and position. This plan **supersedes** the demo-chip part of the `design-and-structure` plan's Pattern summary (which lists "two demo chips ('@name', '#design')") following the same precedent as the `TaskStream → TODO` rename — explicit cross-feature supersession.

**In scope:** the `cmd + i` keydown handler in `src/renderer/index.ts` (line 1058), the chip rendering inside `renderCommandBar` (lines 581-588), corresponding tests in `test/view/addTask.spec.ts` and a new Tallahassee pattern spec.

**Out of scope:** changes to `/add` parsing or the Enter handler; new keyboard shortcuts; cursor-position preservation after the prepend (the input value is rewritten and focus restored — caret behavior is whatever the browser/DOM does by default); the `CMD + K` hint (kept as-is); replacing the chips with anything else (they are deleted, not substituted).

## Acceptance criteria

1. Given the command bar input is empty, when the user presses `cmd + i`, then the input value is `/add ` and the input is focused. (Regression guard — existing behavior preserved.)
2. Given the command bar input value is `buy milk` (does not start with `/add `), when the user presses `cmd + i`, then the input value is `/add buy milk` and the input is focused.
3. Given the command bar input value is `/add buy milk` (already starts with `/add `), when the user presses `cmd + i`, then the input value is unchanged at `/add buy milk` and the input is focused.
4. Given the command bar renders on initial mount, when its DOM is inspected, then no element with `[data-command-chip="mention"]` and no element with `[data-command-chip="tag"]` is present.

## Step-definition file

`test/step_defs/command-bar-fixes.steps.ts` — steps:

**Given:**
- `Given("the command bar input is empty")` (REUSE — `add-task.steps.ts` already defines `Given("the command bar is empty")`; alias is fine if literal phrasing differs slightly, otherwise reuse verbatim).
- `Given("the command bar input value is {string}")` (NEW) — mounts the app via `mountApp(this.document.body)` against the current fixtures, then sets `[data-command-bar] input[type="text"]` value to the string. Distinct from `Given("the command bar reads {string}")` in `add-task.steps.ts` only if needed; if the existing wording fits, reuse it.
- `Given("the command bar renders on initial mount")` (NEW) — mounts the app and asserts `[data-command-bar]` is present.

**When:**
- `When("the user presses cmd+i")` (REUSE — `add-task.steps.ts:96`).
- `When("its DOM is inspected")` (NEW) — no-op alias; assertions follow in the `Then` step.

**Then:**
- `Then("the input value is {string}")` (NEW) — asserts `[data-command-bar] input[type="text"].value` equals the string.
- `Then("the input is focused")` (NEW) — asserts `this.document.activeElement` is the `[data-command-bar] input[type="text"]` element. (May already exist as part of `Then("the command bar shows {string} with focus")` in add-task — if so, reuse.)
- `Then("the input value is unchanged at {string}")` (NEW) — same as `Then("the input value is {string}")`; phrased separately so the scenario reads naturally.
- `Then("no element with {string} is present")` (NEW) — asserts the given CSS selector returns zero matches in `this.document`.

## BDD test list

[file: test/view/addTask.spec.ts]  ← extend the existing file
- `describe("AddTask")` > `it("prepends /add to existing text when cmd+i is pressed")`
- `describe("AddTask")` > `it("leaves the value unchanged when cmd+i is pressed and the input already starts with /add ")`
- *(The existing `it("prefills the command bar input with /add on cmd+i")` and `it("focuses the command bar input on cmd+i")` cases stay green as the empty-input regression guard for AC 1.)*

[file: test/patterns/command-bar-fixes.spec.ts]
- `describe("Command bar")` > `it("renders without the @name demo chip")`
- `describe("Command bar")` > `it("renders without the #design demo chip")`

## File map

### New files
- `test/step_defs/command-bar-fixes.steps.ts`
- `test/patterns/command-bar-fixes.spec.ts`
- `test/verify/commandBarFixes.verify.ts` — Playwright script. Launches Electron, captures the initial command bar (no chips, regression baseline), focuses the input, types "buy milk", presses cmd+i, asserts the input value is "/add buy milk", screenshots. Then with `/add buy milk` already in the input, presses cmd+i again, asserts unchanged. Two screenshots: `commandBarFixes-prepended.png`, `commandBarFixes-already-add.png`.

### Files to update
- `src/renderer/index.ts`:
  - **Cmd+i handler** (line 1058 keydown listener): replace the body inside the `metaKey && key==='i'` branch with:
    ```ts
    const current = input.value
    if (!current.startsWith('/add ')) {
      input.value = `/add ${current}`
    }
    input.focus()
    ```
    The `/add ` literal stays consistent with the existing parser in `parseAddCommand` and the existing AC1 of `add-task`.
  - **Chip removal** in `renderCommandBar` (lines 581-588): delete the `mention` and `tag` `<span data-command-chip>` element creations and their `fields.appendChild` calls. The `[data-command-bar-fields]` wrapper now contains only the `<input>`. Leave the bolt icon, the input, and the `[data-shortcut-hint]` CMD+K span untouched.
- `package.json` — append `&& ts-node test/verify/commandBarFixes.verify.ts` to the `verify:playwright` script.

### DOM contract
- `[data-command-bar]` (unchanged) — bar root.
- `[data-command-bar-fields]` (unchanged) — wrapper, now contains only the input.
- `[data-command-bar] input[type="text"]` (unchanged) — input element. Value behavior changes per AC 1-3.
- `[data-command-chip="mention"]` and `[data-command-chip="tag"]` — **removed**. After the change, the document never contains either selector.
- `[data-shortcut-hint]` (unchanged) — still reads "CMD + K".

### Visual treatment
No new styling. The bar's overall layout becomes slightly less busy with the two chips gone — the bolt icon, the placeholder text, and the `CMD + K` hint sit on a single row with more breathing room. Spacing tokens (4/8px rhythm), colors, typography all stay as DESIGN.md prescribes.

### Plan-level supersession (explicit)

This plan supersedes the demo-chip portion of `features/design-and-structure/plan.md`'s Pattern summary, which describes "two demo chips ('@name', '#design')". The chips are removed; the rest of the design-and-structure plan stays intact. Implement is authorized to delete the corresponding lines in `src/renderer/index.ts` (581-588). No other line of design-and-structure's plan or its `.feature`/spec needs editing — the existing `design-and-structure.feature` and `designAndStructure.spec.ts` do not assert on the chips.

## Data fixtures

No fixture `.md` files needed. The cmd+i behavior is exercised against any fixture set (the `add-task.steps.ts` standard fixtures already cover the cases). The chip-removal assertion is structural — independent of vault content.
