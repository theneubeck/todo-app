---
slug: add-task
frozen: false
---

# Notes — Add task

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run the plan skill.

## Problems

(none yet)

## Implementation clarifications

The add-task plan supersedes one acceptance criterion of `features/design-and-structure/plan.md` — the initial active sidebar entry is now **Inbox**, not Today, and the initial `<h1>` is **Inbox**, not Today. The plan's File map only lists the `designAndStructure.spec.ts` as needing updates, but the corresponding Gherkin scenarios in `test/features/design-and-structure.feature` ("Sidebar shows primary navigation with Today active" and "Main header shows Today h1 above remaining count") also assert on the initial-active label and h1 text. Implement updated those two scenarios to read "Inbox" instead of "Today" to honour the supersession; this is a mechanical follow-on of the explicit supersession in the plan's prose. No semantic change beyond what the plan already supersedes.

`window.todoz.today` (a string ISO date) was added to the IPC-mock surface so tests pin the renderer's "today" to `2026-05-07` deterministically. The renderer reads `window.todoz.today` if defined, otherwise falls back to `new Date().toISOString().slice(0,10)`. No new IPC method is added on the production side; the production preload does not yet need to expose a `today` field.

## Verify findings

### Verify — add-task — 2026-05-08

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — 0 errors |
| Type check (`npm run typecheck`) | PASS — 0 errors |
| Coverage (`npm run test:coverage`) | PASS — stmts 98.92%, branch 90.64%, funcs 100%, lines 100% (all >= 90%) |
| `npm test` (via test:coverage) | PASS — 86/86 specs passing |
| Gherkin (`npm run test:bdd`) | PASS — 15/15 scenarios, 53/53 steps |
| `npm run verify` (Playwright Electron driver) | PASS — write-back checks all green; screenshots written |
| Screenshot: initial render (todoList-initial.png) | PASS — visually confirmed below |

#### Acceptance-criteria verdicts

| # | Criterion (verbatim from plan) | Verdict | Source of evidence |
|---|---|---|---|
| 1 | Given the command bar is empty, when the user presses `cmd + i`, then the command bar input shows `/add ` with focus. | PASS | Unit specs "focuses the command bar input on cmd+i" + "prefills the command bar input with /add on cmd+i"; Gherkin scenario "cmd+i prefills the command bar with /add". Not screen-assertable from a steady-state PNG, as called out in the task brief. |
| 2 | Given the command bar reads `/add buy milk`, when the user presses Enter, then a new task file `buy-milk-2026-05-07.md` appears in the vault todos folder. | PASS | Unit spec "writes one task file when /add submits with a title"; Gherkin scenario "/add writes a new task file"; `buildTaskFile` specs cover slug-date filename. |
| 3 | Given the command bar reads `/add buy milk #urgent @sara`, when the user presses Enter, then a `#urgent` entry appears under PROJECTS and a `@sara` entry appears under PEOPLE in the sidebar. | PASS | Unit specs "renders one PROJECTS entry per unique non-@ tag", "renders one PEOPLE entry per unique @-prefixed tag", "creates a new sidebar entry the first time a tag is used"; Gherkin scenario "tagged /add creates new sidebar entries". The fixture-derived sidebar in the initial PNG already shows the same grouping rule applied (#errands, #personal, #q2, #reading, #work under PROJECTS; @mike under PEOPLE). |
| 4 | Given the command bar reads `/add buy milk #urgent @sara`, when the user presses Enter, then the `#urgent` and `@sara` sidebar entries both have `data-pulsing="true"`. | PASS | Unit specs "sets data-pulsing on each matching sidebar entry after a tagged add" + "removes data-pulsing after the pulse duration"; Gherkin scenario "tagged /add pulses matching sidebar entries". Pulse is transient (~600ms) and not capturable in the steady-state PNG. |
| 5 | Given the command bar reads `/add buy milk` (no tags), when the user presses Enter, then only the Inbox sidebar entry has `data-pulsing="true"`. | PASS | Unit spec "sets data-pulsing only on Inbox after a no-tag add"; Gherkin scenario "untagged /add pulses only the Inbox entry" (asserts no other sidebar entry pulses). |
| 6 | Given the vault contains the standard fixture todos and the initial render has completed, when the user clicks the `#errands` sidebar entry, then the main list shows only tasks tagged `errands` and the main `<h1>` reads `#errands`. | PASS | Unit specs "filters the task list to matching tasks when a tag entry is clicked" + "swaps the h1 to the active filter label"; Gherkin scenario "clicking a tag entry filters the list". |
| 7 | Given the vault contains the standard fixture todos, when the initial render completes, then the Inbox sidebar entry is visually active and the main `<h1>` reads `Inbox`. | PASS | Visually confirmed in `test/screenshots/todoList-initial.png`: the "Inbox" entry in the sidebar is highlighted with a filled pill (active state) and the main header reads exactly "Inbox" with "5 tasks remaining" beneath. Unit specs "renders the Inbox sidebar entry as initially active" + "renders an h1 reading Inbox on initial load". |
| 8 | Given the command bar reads `/add` (or `/add` plus whitespace only), when the user presses Enter, then no new task file is written, no sidebar entry pulses, and the command bar input still reads what was typed. | PASS | Unit specs "does not write a file when the input is /add only" + "retains the input value when the input is /add only"; Gherkin scenario "empty /add does nothing". |

#### Screenshot observations (test/screenshots/todoList-initial.png)

- Inbox is initially active (highlighted pill in sidebar).
- Main h1 reads "Inbox" with "5 tasks remaining" line below.
- PROJECTS section lists exactly the five `#`-tags found in the 5-fixture vault: `#errands`, `#personal`, `#q2`, `#reading`, `#work`.
- PEOPLE section lists `@mike`, sourced from the `sync-with-mike` fixture's `@mike` tag.
- Bordered task card contains, in order: Pickup package (2026-05-09), Call dentist (2026-05-10), Sync with Mike (2026-05-12), Q2 report (2026-06-01) under HIGH PRIORITY; Read Anthropic paper (undated) under OTHER TASKS — sorted by due date with the no-due task last.
- Command bar pinned at bottom of the main area with the `@name` / `#design` example chips, the placeholder input, and the "CMD + K" hint on the right.

**Overall**: All eight acceptance criteria pass — the three non-visual ones via passing unit + Cucumber tests, the visually-assertable ones via the captured PNG. The plan is satisfied; the feature is done.
