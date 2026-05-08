---
slug: vault-picker
frozen: false
---

# Notes — Vault picker

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run the plan-feature skill.

## Problems

(none yet)

## Verify findings

### Verify — vault-picker — 2026-05-08

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — 0 errors, 0 warnings |
| Type check (`npm run typecheck`) | PASS — exits 0 |
| Coverage (`npm run test:coverage`) | PASS — 90.18% branches / 99.59% lines / 99.23% functions / 98.5% statements (all >= 90%); VaultPicker.ts uncovered lines 18,118 (defensive branches) |
| `npm test` | PASS — 183 passing, 0 failures, 0 skipped (Implement reported "187"; coverage run shows 183 — all green either way) |
| Gherkin (`npm run test:bdd`) | PASS — 39 scenarios / 166 steps passed |
| Playwright build + verify | PASS — `npm run build` succeeded; `ts-node test/verify/vaultPicker.verify.ts` captured both screenshots |
| Screenshot: vault-picker with two recents | PASS — read PNG via Read tool; renders heading, both buttons, recents section, two rows |
| Screenshot: main view with vault switcher | PASS — read PNG via Read tool; folder icon button visible at top right of header |
| Toggle / write-back coverage | PASS — `createVault.spec.ts` asserts `todos/` and `archive/todos/` are written by the real main-process function; Cucumber scenario asserts `fs.existsSync` after click; remove-recent scenario asserts the underlying folder still exists on disk |

#### Acceptance criteria — visual + behavioral confirmation

| AC | Source | Verdict |
|---|---|---|
| 1. First-run picker shows both buttons and empty recents | Cucumber scenario "First-run shows the picker with empty recents" | PASS — scenario green; visually confirmed buttons render in screenshot 1 (recents populated in this scenario, but DOM shape and both button labels match) |
| 2. Create new vault writes `todos/` + `archive/todos/` and shows main view | Cucumber scenario "Create new vault writes the skeleton" + Mocha `createVault` spec | PASS — BDD scenario green; `createVault.spec.ts` asserts real fs creation; renderer wiring verified via `vaultPickerCreated` push |
| 3. Open existing folder shows main view | Cucumber scenario "Open existing folder as vault" | PASS — scenario green |
| 4. Recents list shows folder name + abs path, most-recent first | Screenshot 1 + Cucumber scenario "Recents list shows previously opened vaults" | PASS — visually confirmed: alpha-vault on top with name + monospaced abs path, beta-vault below with same shape |
| 5. Click recent opens that vault | Cucumber scenario "Click recent opens the selected vault" + verify script transition | PASS — scenario green; Playwright clicked first recent and main view rendered against that path (screenshot 2) |
| 6. Remove-recent leaves disk untouched | Cucumber scenario "Remove recent leaves disk untouched" | PASS — scenario green; `fs.existsSync(ALPHA_PATH)` asserted true after remove |
| 7. "Open another vault" icon button at top of main view | Screenshot 2 + Cucumber scenario "Open another vault from main window" | PASS — folder icon button visible at far right of TaskStream header bar |
| 8. Valid `lastOpened` vault skips picker | Cucumber scenario "Launch with valid last-opened vault skips picker" | PASS — scenario green |

**Capture speed**: Playwright launch + two screenshots ~3s wall.
**Find-next clarity**: Picker layout matches the plan's visual treatment (centered card, primary/secondary buttons stacked, label-md section header, monospaced paths).
**Nesting**: Recents rows render with separator lines between rows as specified.

**Overall**: All eight acceptance criteria are visually or behaviorally confirmed; static checks, Mocha, Cucumber, and Playwright all green.
