---
slug: vault-write-path
frozen: false
---

# Notes — Vault write path

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run a plan skill.

## Problems

(none yet)

## Verify findings

### Verify — vault-write-path — 2026-05-11

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — 0 errors, 0 warnings |
| Type check (`npm run typecheck`) | PASS — exit 0 |
| Coverage (`npm run test:coverage`) | PASS — 99.53% lines / 90.31% branches / 99.32% funcs / 98.41% stmts (gate 90%). `vaultDir.ts` 100/83.33/100/100 (one uncovered branch is the defensive `if (dir)` after slicing — covered by `bare-filename.md` test). `writeFileGuard.ts` 92.85/87.5/100/100 (line 23 is the `path.isAbsolute(rel)` branch, defensive against cross-drive paths on win32). |
| `npm test` | PASS — 246 passing, 0 failing, 0 skipped (up from 233) |
| Gherkin (`npm run test:bdd`) | PASS — 61 scenarios / 240 steps (up from 57/227); all 4 new `vault-write-path` scenarios green |
| `npm run verify` (full chain) | PASS — all 10 Playwright verify scripts green, including the new `vaultWritePath.verify.ts` |
| Screenshot: `tmp/vaultWritePath-after-add.png` | PASS — Inbox view shows "1 task remaining" with row `empty-vault-task` rendered; confirms /add succeeded against the tmp-cloned active vault |
| AC1 — first /add into empty active vault writes inside active vault & not into `<repo>/vault/todos/` | PASS — verify script asserts `empty-vault-task-2026-05-11.md` exists under `<tmpUserData>/alpha-vault/todos/`; pre/post snapshot of `<repo>/vault/todos/` shows no `empty-vault-task-*` leak |
| AC2 — second /add into non-empty vault writes to same vault (regression guard) | PASS — Cucumber scenario `Second /add into a non-empty active vault writes to the same vault` green; `Then the second file is written into the same active vault todos folder` asserts last writeFile.path starts with `<activeVault>/todos` |
| AC3 — toggling existing task writes to its absolute `filePath` (regression guard) | PASS — Cucumber scenario `Toggling an existing task writes to its own filePath` green; `Then the write goes to the task's existing filePath` asserts `writeCalls[0].path === preMountedTask.filePath` |
| AC4 — write-file outside active vault rejects, no file written | PASS — Cucumber scenario `Writing outside the active vault is refused by main` green; `isPathInsideActiveVault` unit spec covers same shape (4+ cases) |
| `<repo>/vault/todos/` unchanged after full verify run | PASS — `ls` snapshot pre/post is byte-identical |
| Toggle write-back (Step 5, not applicable) | N/A — this is a bug-fix plan; no new user-facing toggle behavior to screenshot. Existing toggle behavior covered by AC3 + the unrelated `taskRowInteractions` verify script (also green this run). |

**Bug-and-regression matrix coverage**: `vaultDir(vaultPath, tasks)` exercised across 4 planned cases (vaultPath+empty, vaultPath+todos, null+nonempty back-compat, null+empty legacy fallback) plus a 5th defensive case for `bare-filename.md` derivation. `isPathInsideActiveVault(target, vaultRoot)` exercised across 4 planned cases (inside direct, nested, outside, escapes via `..`) plus 2 defensive cases (null vaultRoot, target === root). All pass.

**Repo vault leak check**: `vault/todos/` snapshot identical before and after `npm run verify`. No `empty-vault-task-*.md` and no `should-not-write.md` leaked. The Cucumber `After` hook and the Playwright safety belt are both wired but did not need to fire.

**Overall**: All four acceptance criteria pass. The fix correctly threads `vaultPath` into `vaultDir(vaultPath, tasks)` at both `/add` call sites, the main-process `write-file` guard refuses out-of-vault targets, and the regression guards for existing-task writes and non-empty-vault `/add` continue to pass.

## Background

User reported on 2026-05-11: "MAJOR bug detected. Adding tasks and subtask does not add the file to the Vault specified. But to `/vault`."

Investigation traced the bug to two coupled issues in the renderer + main process:

- `src/renderer/index.ts:609-618` — the `vaultDir(tasks)` helper falls back to the literal string `'vault/todos'` when the loaded task list is empty.
- `src/main.ts:63-65` — the `write-file` IPC handler writes whatever path the renderer provides without verifying it sits inside the active vault.

When the user picks an empty vault or creates a new one and immediately runs `/add`, the renderer hits the hardcoded fallback and the main process writes the file to `<cwd>/vault/todos/`. This plan threads `vaultPath` (already available in `mountMainShell`) into the helper and adds a main-process safety check that refuses writes outside the active vault.
