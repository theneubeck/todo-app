---
slug: tag-autocomplete
frozen: false
---

# Notes — Tag autocomplete

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run a plan skill.

## Problems

(none yet)

## Verify findings

### Verify — tag-autocomplete — 2026-05-17

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS 0 errors |
| Type check (`npm run typecheck`) | PASS exits 0 |
| Coverage (`npm run test:coverage`) | PASS 97.81% statements, 90.65% branches — all above 90% |
| `npm test` | PASS 355 passing, 0 failures |
| Gherkin (`npm run test:bdd`) | PASS 81 scenarios, 344 steps, all passed |
| Screenshot: `tagAutocomplete-hash.png` — dropdown open with `#` typed | PASS: dropdown visible below the command bar input showing `#errands` and `#personal` alphabetically, `#errands` highlighted with left-border active indicator |
| Screenshot: `tagAutocomplete-at-filtered.png` — `@l` typed, only `@lina` shown | PASS: single-row dropdown with `@lina` only, `@mike` absent |
| Screenshot: `tagAutocomplete-after-insert.png` — after Tab accept | PASS: input shows `@lina ` (with trailing space), no dropdown in DOM |
| AC1: `[data-autocomplete]` dropdown appears with `#`-tags alphabetically sorted | PASS |
| AC2: ArrowDown moves `[data-autocomplete-active]` to next; wraps | PASS (unit + BDD) |
| AC3: Tab replaces trigger word with full tag + space, closes dropdown, retains focus | PASS (Playwright + screenshot) |
| AC4: Esc closes dropdown, input unchanged | PASS (unit + BDD) |
| AC5: Enter passes through; dropdown does not consume it | PASS (unit + BDD) |
| AC6: `@l` substring-filters to `@lina` only | PASS (Playwright + screenshot) |
| AC7: `#zzz` with no matches renders no dropdown | PASS (BDD) |
| AC8: Dropdown closes when caret leaves a `#`/`@`-prefixed word | PASS (unit + BDD) |

**Overall**: All 8 acceptance criteria satisfied; lint, typecheck, 355 unit/DOM tests, and 81 Gherkin scenarios are green; screenshots confirm the visual dropdown behavior in the real Electron window.

## Background

User on 2026-05-13: "Id like auto completion. When doing #project or '@person'"

The vault already exposes all existing tags via `uniqueTags(tasks)` in `src/renderer/index.ts`, so the data source is free. The work is in the command-bar input plumbing (caret-aware trigger detection, keyboard-vs-existing-handler precedence) and the dropdown view (rendering, navigation, click-to-accept). Two small subtleties locked in plan Decisions: use `mousedown` for click-to-accept (so focus/blur doesn't kill the dropdown before the click lands), and use capture-phase keydown for the dropdown so Enter / ArrowDown / Escape don't double-fire with the existing command-bar handlers.

The chat-interface uses the same command bar input, so autocomplete works in chat mode too — the trigger is the literal `#`/`@` character, not a slash-command parse. Inserted tags become part of the chat message (the LLM can read `@lina` and tag the resulting task accordingly via `ollama-tools`).
