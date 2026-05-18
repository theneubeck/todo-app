---
slug: read-watch
frozen: false
---

# Notes — Read and Watch resources

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run a plan skill.

## Background

Reference mockup: `features/to-read-and-watch/Untitled.jpg`

The mockup shows a RESOURCES sidebar section with "To Read" (bookmark icon) and "To Watch" (play circle icon). Resource tasks appear in the main view when the filter is active. The `>` sigil was chosen by the user as the shorthand: `>read` and `>watch`.

## Problem — sigil renamed > → : (authorised supersession)
User renamed the resource sigil from > to : after the feature shipped.
The .feature file was updated under authorised supersession (user-approved rename, not a behaviour change).

## Verify findings

### Verify — read-watch — 2026-05-17

| Check | Result |
|---|---|
| Lint (`npm run lint`) | ✅ 0 errors, 0 warnings |
| Type check (`npm run typecheck`) | ✅ exits 0 |
| Coverage (`npm run test:coverage`) | ✅ 97.75% stmts / 90.81% branches / 99.02% funcs / 99.19% lines — all ≥ 90% |
| `npm test` | ✅ 396 passing, 0 failures |
| Gherkin (`npm run test:bdd`) | ✅ 92 scenarios, 383 steps — all passing |
| Screenshot: readWatch-sidebar.png | ✅ RESOURCES section visible with "To Read" (bookmark icon) and "To Watch" (play_circle icon); >read absent from PROJECTS section |
| Screenshot: readWatch-filter.png | ✅ h1 reads "To Read" after clicking To Read entry; only the >read-tagged task is shown |
| Screenshot: readWatch-autocomplete.png | ✅ Autocomplete dropdown shows ">read" and ">watch" when ">" is typed in the command bar |
| Toggle write-back | N/A — resource filter is read-only navigation; no toggle write-back needed for this feature |

**Overall**: All 5 acceptance criteria pass — RESOURCES sidebar section always present, To Read/To Watch filter correctly, ">" triggers autocomplete with both resource suggestions, and /goto >read navigates to the To Read view.

### Verify — read-watch sigil rename > → : — 2026-05-18

| Check | Result |
|---|---|
| Lint (`npm run lint`) | ✅ 0 errors, 0 warnings |
| Type check (`npm run typecheck`) | ✅ exits 0 |
| Coverage (`npm run test:coverage`) | ✅ 97.75% stmts / 90.81% branches / 99.02% funcs / 99.19% lines — all ≥ 90% |
| `npm test` | ✅ 396 passing, 0 failures |
| Gherkin (`npm run test:bdd`) | ✅ 92 scenarios, 383 steps — all passing (`:read`/`:watch` throughout) |
| Screenshot: readWatch-sidebar.png | ✅ RESOURCES section visible with "To Read" (bookmark icon) and "To Watch" (play_circle icon); task chips show `:read` and `:watch`; `:read` absent from PROJECTS section |
| Screenshot: readWatch-filter.png | ✅ h1 reads "To Read" after clicking To Read entry; only the `:read`-tagged task is shown; "To Read" sidebar entry highlighted as active |
| Screenshot: readWatch-autocomplete.png | ✅ Autocomplete dropdown shows `:read` and `:watch` when `:` is typed in the command bar |
| Toggle write-back | N/A — resource filter is read-only navigation; no toggle write-back needed |

**Overall**: Sigil rename from `>` to `:` is clean — all source files, test files, step defs, and the feature file consistently use `:read`/`:watch`; all 5 acceptance criteria pass with the new sigil.
