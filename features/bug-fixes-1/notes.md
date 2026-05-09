---
slug: bug-fixes-1
frozen: false
---

# Notes — Bug fixes 1

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run a plan skill.

## Problems

(none yet)

## Resolved problems

### Adding a fourth task to `buildTasks()` breaks two unauthorized assertions

**Affected acceptance criterion:** AC#8 — `[data-section="people"]` must be absent
when no `@`-tagged tasks exist. The previous plan amendment authorized adding one
`@`-tagged task to `buildTasks()` (lines 20–61) of
`test/view/designAndStructure.spec.ts` so the existing PEOPLE-header assertion
at lines 132–138 stayed valid under the new auto-hide rule.

**Evidence:**

The plan amendment's edit envelope for `test/view/designAndStructure.spec.ts`
authorized only:
- Lines 93, 96 (brand assertion — already done)
- Lines 20–61 (`buildTasks()` — add one `@`-tagged task)

It explicitly forbade editing any other line of the file. However, adding any
fourth task to `buildTasks()` breaks two assertions outside the authorized
envelope:

1. **Line 151** — `expect(count?.textContent?.trim()).to.equal('3 tasks remaining')`
   Adding a fourth task with `status: 'todo'` increments the remaining count
   to 4. Adding a fourth task with `status: 'done'` keeps remaining at 3 but
   the suggested fixture in the plan specified `status: 'todo'`. Either way the
   user-supplied envelope forbade editing this line.

2. **Lines 180–181** — `const rows = ... '[data-task-row]'); expect(rows.length).to.equal(3)`
   The renderer creates exactly one `[data-task-row]` per task, regardless of
   `subtasks: []` vs. one trivial subtask. Adding a fourth task always pushes
   `rows.length` from 3 to 4. The plan's "minimal shape" wording could not avoid
   this — both shapes produce a `[data-task-row]`.

The plan itself anticipated this collision and instructed Implement: "Implement
may need to nudge `remaining-count` / row-count expectations only if adding
the fourth task breaks them; if so, append a `## Problem` block to `notes.md`
and stop rather than silently retuning more lines." That is what the previous
problem block did.

**Why Implement could not resolve this:**

The user-supplied superseding scope on
`test/view/designAndStructure.spec.ts` was "the rest of the file remains
off-limits except for lines 93, 96 (brand assertion, already authorized)" and
the plan amendment's envelope only added lines 20–61 to that. Lines 151 and
180–181 were explicitly outside scope. Implementing AC#8 by extending
`buildTasks()` could not succeed without also editing those two assertions.

**What Plan must add (mirroring the brand precedent):**

Either expand the authorized edit envelope on `test/view/designAndStructure.spec.ts`
to include the row-count assertion (line 181, `equal(3)` → `equal(4)`) and the
remaining-count assertion (line 151, `'3 tasks remaining'` → `'4 tasks remaining'`),
or invert the strategy: instead of adding a fourth task, supersede the
PEOPLE-header assertion at lines 132–138 (e.g., delete it, or invert it to
assert absence under the tag-free fixture set, or move the PEOPLE assertion
to a new spec file with its own `@`-tagged fixture set).

**Resolution (2026-05-09):** Plan re-amended to reverse the prior choice and
take option (a) from the original Problem block. Instead of extending
`buildTasks()`, the plan now authorizes Implement to **invert** the
PEOPLE-header assertion at `test/view/designAndStructure.spec.ts:132-138` so
it asserts that the PEOPLE section is **absent** when the fixture set has zero
`@`-tagged tasks. `buildTasks()` (lines 20–61), the remaining-count assertion
(line 151), and the row-count assertion (lines 180–181) remain off-limits and
unchanged because the fixture stays at three tasks. See `plan.md` → Files to
update → `test/view/designAndStructure.spec.ts` for the new edit envelope.

### AC#8 (auto-hide PEOPLE) breaks an existing design-and-structure test

**Affected acceptance criterion:** AC#8 — `[data-section="people"]` must be absent
from the DOM when no `@`-tagged tasks exist.

**Evidence:**

`test/view/designAndStructure.spec.ts` contains:

- `buildTasks()` (lines 20–61) — three Task fixtures, tags only `[work, q2]`,
  `[personal]`, `[reading]`. Zero `@`-prefixed tags.
- A test at line 132 (`it('renders the PEOPLE section header in the sidebar')`)
  that asserts the PEOPLE header is present in the sidebar.

Under the new auto-hide rule the section is correctly absent, so:

```
1) DesignAndStructure
     renders the PEOPLE section header in the sidebar:
   AssertionError: expected [ 'PROJECTS' ] to include 'PEOPLE'
   at Context.<anonymous> (test/view/designAndStructure.spec.ts:137:24)
```

**Why Implement cannot resolve this:**

The user-supplied superseding scope authorizes Implement to edit only
`test/view/designAndStructure.spec.ts:93,96` (brand text) and
`test/features/design-and-structure.feature:6`. The PEOPLE collision sits at
lines 132–138 (and/or `buildTasks` lines 20–61), both outside the authorized
scope, with an explicit "Do not edit any other line of those files."

**What Plan must add (mirroring the brand precedent):**

Either supersede the PEOPLE-header assertion in design-and-structure (delete
or invert it to assert absence with the tag-free fixture set), or extend
`buildTasks()` with one `@`-tagged task so the assertion remains true under
the new contract. Either way, the plan should name the file lines Implement
is permitted to touch.

The same logic applies to the PROJECTS section if Plan ever introduces a
fixture change that strips `#`-tags from the design-and-structure suite —
not currently broken, but worth flagging while the surface is open.

**Plan problem detected. Returning to Plan agent.**

See `features/bug-fixes-1/notes.md` → Problems.

**Resolution (2026-05-09):** Plan amended to authorize Implement to extend
`buildTasks()` (lines 20–61) of `test/view/designAndStructure.spec.ts` with
one `@`-tagged task (`meet-mentor`, `tags: ['@mike']`). The existing three
tasks remain unchanged. The PEOPLE-header assertion at lines 132–138 stays
true under the new auto-hide rule. See `plan.md` → Files to update →
`test/view/designAndStructure.spec.ts` for the full edit envelope.

## Verify findings

### Verify — bug-fixes-1 — 2026-05-09

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — zero errors, zero warnings |
| Type check (`npm run typecheck`) | PASS — exit 0, zero errors |
| Coverage (`npm run test:coverage`) | PASS — 90.03% branches / 99.51% lines / 99.29% funcs / 98.45% statements (above 90% gate) |
| `npm test` (Mocha) | PASS — 209 passing, 0 failing, 0 skipped |
| Gherkin (`npm run test:bdd`) | PASS — 47 scenarios, 191 steps, all green |
| `npm run verify` (full Playwright chain) | PASS — bugFixes1 + todoList + taskRowInteractions + addSubtask + vaultPicker all green |
| Screenshot: bugFixes1-initial-todo-brand.png | PASS — `[data-brand]` reads "TODO"; sidebar shows Chat, Inbox, Today, Upcoming; PROJECTS + PEOPLE both populated; settings icon visible in app bar |
| Screenshot: bugFixes1-settings-panel-open.png | PASS — panel anchored under settings icon with three checkboxes "Show Chat", "Show Today", "Show Upcoming", all checked |
| Screenshot: bugFixes1-sidebar-chat-off.png | PASS — Chat sidebar entry absent after Show Chat is unchecked; Inbox / Today / Upcoming still present |
| Screenshot: bugFixes1-sidebar-tag-free.png | PASS — `[data-section="projects"]` and `[data-section="people"]` both absent on tag-free vault; brand still "TODO"; primary entries Chat/Inbox/Today/Upcoming all rendered |
| Toggle write-back (settings → app-settings.json) | PASS — verify-script criterion 4 confirms toggle removes Chat entry from DOM; verify chain exit 0 |

**Acceptance-criteria roll-up:**

- AC#1 (default render shows Chat, Inbox, Today, Upcoming when zero tags + no settings file) — PASS — `bugFixes1-sidebar-tag-free.png` shows all four primary entries on the tag-free vault.
- AC#2 (`[data-brand]` text equals "TODO") — PASS — verify-script asserts `[data-brand] = "TODO"`; visible in all four screenshots.
- AC#3 (clicking settings icon opens a panel anchored to icon with three checkboxes "Show Chat", "Show Today", "Show Upcoming", all checked) — PASS — `bugFixes1-settings-panel-open.png` and verify-script "found 3 [data-setting-toggle] rows".
- AC#4 (unchecking "Show Chat" removes Chat sidebar entry from DOM) — PASS — `bugFixes1-sidebar-chat-off.png` and verify-script "[data-sidebar-entry=chat] count = 0".
- AC#5 (persisted settings survive a fresh mount) — PASS — Cucumber scenario "Persisted setting survives a fresh mount" green; Mocha "reflects persisted state by initialising checkboxes" green; `appSettings.spec.ts` covers JSON read/write merge semantics with 100% coverage.
- AC#6 (outside click closes the panel) — PASS — Cucumber scenario "Outside click closes the panel" green; Mocha "closes when the user clicks outside" green.
- AC#7 (`[data-section="projects"]` absent when no `#`-tag tasks exist) — PASS — `bugFixes1-sidebar-tag-free.png` and verify-script "[data-section=projects] count = 0".
- AC#8 (`[data-section="people"]` absent when no `@`-tag tasks exist) — PASS — `bugFixes1-sidebar-tag-free.png` and verify-script "[data-section=people] count = 0".

**Capture speed**: Playwright launch + four screenshots + assertions completed inside the standard verify timeout; no flakiness observed across the chained verify scripts.
**Find-next clarity**: settings dropdown anchors cleanly under the existing top-bar icon; chevron-free toggles read correctly.
**Nesting**: tag-free vault collapses both `[data-section]` elements entirely (header + body), matching the plan's "the entire `[data-section]` element disappears, not just the header" requirement.

**Overall**: Verify complete — all eight acceptance criteria confirmed against screenshots and the green test suites; no regressions in the previously verified features.

## Deferred

The "subtask-after-complete" bug from the original `fixes.md` brainstorm is **not** in scope of this plan. The expected behavior is genuinely ambiguous (see Q1 in the conversation that produced this plan):

- (a) Reset frontmatter `status` from `done` to `todo` when `addSubtask` is called on a done simple task.
- (b) Leave `status: done` alone; adjust only the UI to drop the strikethrough when subtasks exist.
- (c) Leave both as-is and treat the inconsistency as user-managed.

A separate plan should be drafted once the answer is decided.
