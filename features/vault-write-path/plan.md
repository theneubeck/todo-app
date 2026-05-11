---
name: Vault write path
slug: vault-write-path
status: planned
frozen: true
created: 2026-05-11
---

# Vault write path

## Pattern summary

A bug-fix plan. Today the renderer guesses the active vault's `todos/` directory by inspecting the `filePath` of any already-loaded task (`src/renderer/index.ts:609` `vaultDir(tasks)`). When the active vault has zero tasks — true on a freshly-created vault, on a vault switch into an empty target, or on any vault whose `todos/` directory is empty — the helper falls back to the hardcoded relative path `'vault/todos'`. The main process's `write-file` IPC handler at `src/main.ts:63` writes that relative path verbatim, which resolves against `process.cwd()` (the repo root in dev, the app bundle root when packaged). So `/add` on an empty active vault silently writes the new `.md` file into `<repo>/vault/todos/` instead of `<activeVault>/todos/`. The fix threads the active vault path — already available as `vaultPath` in `mountMainShell` — into the renderer's task-write helper and removes the existing-task-derived heuristic from the empty-vault code path. The main process gains a small safety check that refuses any `write-file` whose target is outside the configured active vault, so a future regression of the same shape fails loud instead of silently writing to the wrong directory.

**In scope:** thread `vaultPath` into the `vaultDir` helper and into every `/add` task and subtask-add code site in `src/renderer/index.ts`; main-process `write-file` validation that the target path is inside the active vault; unit tests covering `vaultDir(vaultPath, tasks)` with the empty-vault and non-empty-vault inputs; one Cucumber scenario asserting an empty vault accepts the first task into its `todos/` directory; one Playwright verify run that exercises an empty alternate vault via the existing fixture `test/fixtures/vaults/alpha/` (from `vault-picker`).

**Out of scope:** changing the IPC shape of `write-file` (still takes an absolute or relative path; only validation added); changing the read flow (`read-todos` is already correct — it uses `resolveActiveVault`); changing how `vaultPath` is sourced (it still comes from `vaultConfig.lastOpened`); the existing-task mutation paths (`toggleParent`, `toggleSubtask`, `addSubtask` on a task that already exists — those use `live.filePath` which is set by the main process from `resolveActiveVault` and is already correct); cleaning up files mistakenly written to `<repo>/vault/todos/` by prior buggy runs (the user manages those manually).

## Acceptance criteria

1. Given the active vault is set to `<alt-vault>` and `<alt-vault>/todos/` is empty, when the user types `/add buy milk` and presses Enter, then the file `buy-milk-<TODAY>.md` exists inside `<alt-vault>/todos/` and does NOT exist inside `<repo>/vault/todos/`.
2. Given the active vault is set to `<alt-vault>` and `<alt-vault>/todos/` already contains one task, when the user types `/add buy stamps`, then the second file is written into the same `<alt-vault>/todos/` directory (existing-task derivation continues to work — regression guard).
3. Given a task exists in the active vault and is rendered, when the user toggles the parent checkbox, then the write goes to the task's existing absolute `filePath` (no path-construction change for existing-task mutations — regression guard).
4. Given the renderer attempts to write a file outside the active vault's directory tree, when `write-file` is invoked in the main process, then the call throws (or rejects) and no file is written — the safety check fails loud.

## Step-definition file

`test/step_defs/vault-write-path.steps.ts` — steps:

**Given:**
- `Given("the active vault is set to {string} and its todos folder is empty")` (NEW) — sets `this.activeVaultPath` to the resolved absolute path of the fixture (`test/fixtures/vaults/alpha`), creates a tmp clone of just the `todos/` subdir to keep the fixture pristine, mounts the app with `getVaultConfig` mocked to return that path.
- `Given("the active vault is set to {string} with one existing task")` (NEW) — same as above but writes one canned task file into the tmp `todos/` dir first.
- `Given("a task {string} exists in the active vault and is rendered")` (REUSE — variants of this exist across `add-task.steps.ts` and others; reuse the closest match. If a literal match doesn't exist, alias one.)

**When:**
- `When("the user types {string} and presses Enter")` (REUSE — `add-task.steps.ts` defines `Given("the command bar reads {string}")` + `When("the user presses Enter")`; compose those, or define a thin wrapper here that fills + submits).
- `When("the user toggles the parent checkbox")` (REUSE — `todoList.steps.ts` / `task-row-interactions.steps.ts` have a parent-toggle step. Reuse the existing wording.)
- `When("the renderer attempts to write a file outside the active vault's directory tree")` (NEW) — invokes `window.todoz.writeFile('/tmp/should-not-write.md', 'x')` directly from the Tallahassee test (no UI gesture; this is a guard test).

**Then:**
- `Then("the file {string} exists inside the active vault's todos folder")` (NEW) — asserts `fs.existsSync(path.join(this.activeVaultPath, 'todos', <string>))`.
- `Then("the file {string} does not exist inside the repo's vault folder")` (NEW) — asserts `fs.existsSync(path.join(REPO_ROOT, 'vault', 'todos', <string>))` is `false`. The cucumber world also cleans up any file that lands there during the scenario as a safety belt.
- `Then("the second file is written into the same active vault todos folder")` (NEW) — asserts the second filename also resolves under `this.activeVaultPath`.
- `Then("the write goes to the task's existing filePath")` (NEW) — asserts the world's recorded last `writeFile` call's first argument equals the task's `filePath` (the absolute path the main process returned in `read-todos`).
- `Then("the call rejects and no file is written")` (NEW) — asserts the awaited `writeFile` promise rejects, and that no file appears at the disallowed path.

## BDD test list

[file: test/data/vaultDir.spec.ts]  ← new unit-test file
- `describe("vaultDir")` > `it("returns vaultPath/todos when vaultPath is provided")`
- `describe("vaultDir")` > `it("returns vaultPath/todos even when the tasks list is empty")`
- `describe("vaultDir")` > `it("derives from existing tasks when vaultPath is null and tasks is non-empty (back-compat)")`
- `describe("vaultDir")` > `it("returns the legacy relative fallback only when vaultPath is null and tasks is empty (back-compat for old tests)")`

[file: test/data/writeFileGuard.spec.ts]  ← new unit-test file
- `describe("isPathInsideActiveVault")` > `it("returns true for a file directly inside the active vault")`
- `describe("isPathInsideActiveVault")` > `it("returns true for a nested file inside the active vault")`
- `describe("isPathInsideActiveVault")` > `it("returns false for a file outside the active vault")`
- `describe("isPathInsideActiveVault")` > `it("returns false for a path that escapes via ..")` (defensive — handles `<vault>/../somewhere-else`)

[file: test/patterns/vault-write-path.spec.ts]
- `describe("Empty active vault")` > `it("writes the first /add task into the active vault's todos directory")`
- `describe("Empty active vault")` > `it("does not write anywhere under the repo's vault directory")`

## File map

### New files
- `src/renderer/data/vaultDir.ts` — exports `vaultDir(vaultPath: string | null, tasks: Task[]): string`. Extracted from the inline helper at `src/renderer/index.ts:609` so the unit tests can exercise it cheaply. Pure string transform. The function uses `/` as the path separator (renderer is posix-style); on macOS this works for both relative and absolute paths from the main process.
- `src/main/writeFileGuard.ts` — exports `isPathInsideActiveVault(target: string, vaultRoot: string | null): boolean`. Uses `path.resolve` and `path.relative` to compute whether `target` (resolved) sits inside `vaultRoot` (resolved). Returns `false` when `vaultRoot` is `null`.
- `test/step_defs/vault-write-path.steps.ts`
- `test/patterns/vault-write-path.spec.ts`
- `test/data/vaultDir.spec.ts`
- `test/data/writeFileGuard.spec.ts`
- `test/verify/vaultWritePath.verify.ts` — Playwright script. Boots Electron with `NODE_ENV=test` and a tmp `userData` dir whose `vault-config.json` points `lastOpened` at a tmp-cloned `test/fixtures/vaults/alpha` (so the alpha fixture stays pristine). Types `/add empty-vault-task` into the command bar, presses Enter, asserts the file exists at `<alt-vault>/todos/empty-vault-task-<TODAY>.md` AND that no `empty-vault-task-*` file exists under `<repo>/vault/todos/`. Captures one screenshot at `tmp/vaultWritePath-after-add.png`.

### Files to update
- `src/renderer/index.ts`:
  - **Remove** the inline `vaultDir(tasks)` function at lines 609-618.
  - **Import** `vaultDir` from `./data/vaultDir`.
  - **Pass `vaultPath`** (the parameter already received by `mountMainShell`) into both call sites: line 940 (`/add` from the command bar) and line 1016 (the `/add` continuation path, if it is a distinct site — confirm during implementation). New call: `const dir = vaultDir(vaultPath, tasks)`.
  - The subtask-mutation sites at lines 803, 836, 858, 872, 1132, 1142 keep using `live.filePath` / `task.filePath` — those are already correct and not part of this fix.
- `src/main.ts`:
  - **Import** `isPathInsideActiveVault` from `./main/writeFileGuard`.
  - **Replace** the body of the `write-file` IPC handler at lines 63-65 with:
    ```ts
    ipcMain.handle('write-file', (_e, filePath: string, content: string): void => {
      const vault = resolveActiveVault()
      if (!isPathInsideActiveVault(filePath, vault)) {
        throw new Error(
          `write-file refused: target "${filePath}" is outside the active vault "${vault ?? '(none)'}"`
        )
      }
      fs.writeFileSync(filePath, content, 'utf-8')
    })
    ```
  - The thrown error surfaces to the renderer as a rejected `ipcRenderer.invoke` promise (Electron's default behavior).
- `test/step_defs/world.ts` — extend with helpers/state if needed for the new step file (e.g., `activeVaultPath: string`, fixture-clone lifecycle that mirrors the vault-picker pattern). The cucumber world already has a `vaultConfigPath` lifecycle from `vault-picker.steps.ts`; reuse it.
- `package.json` — append `&& ts-node test/verify/vaultWritePath.verify.ts` to the `verify:playwright` script.

### DOM contract
No new selectors. The bug is in the write-path code, not the rendering.

### Visual treatment
No styling changes.

## Data fixtures

No new committed fixture files. The plan reuses the existing `test/fixtures/vaults/alpha/todos/` directory (committed empty during the `vault-picker` work) as the empty-vault baseline. The cucumber world and the Playwright verify script clone that fixture into a per-scenario tmp directory before each run so the committed fixture stays pristine and the `/add` writes go into the tmp clone — visible to the test, invisible to the repo.

## Diagnosis (frozen as part of the plan for audit)

Verified evidence at the time of planning:
- `src/main.ts:63-65` — `ipcMain.handle('write-file', ...)` writes the renderer-supplied `filePath` verbatim.
- `src/renderer/index.ts:609-618` — `vaultDir(tasks)` returns the hardcoded relative string `'vault/todos'` when `tasks` is empty.
- `src/renderer/index.ts:940` and `:1016` — `/add` and follow-on paths call `vaultDir(tasks)` then call `writeFile(${dir}/${filename}, content)`. With an empty active vault, this hits the fallback and writes to `<cwd>/vault/todos/<filename>` instead of `<activeVault>/todos/<filename>`.
- `src/main.ts:48-61` — `read-todos` correctly uses `resolveActiveVault()` and returns task `filePath`s that are absolute under the active vault. So once a vault has at least one task, the renderer's derive-from-existing heuristic works. The bug is specifically the empty-vault first-write.

Subtask-mutation sites in the renderer all use the existing task's `filePath`, which is set by the main process from `resolveActiveVault` — those paths are correct and remain correct after this fix.

## Conflicts & decisions

**Conflicts:** none. No frozen plan is contradicted. The `vault-picker` plan introduces the active-vault concept and the `vaultConfig` config file; this plan threads that concept into the write path. The `add-task` plan's acceptance criteria are unchanged — they assert that `/add` writes a file under "the vault todos folder", which now correctly resolves to the active vault.

**Decisions:**
- Extracted `vaultDir` to its own module rather than refactoring the inline function in place. *Reason: it is now a pure function with two arguments and meaningful unit-test coverage; extracting it cleans the renderer and gives the tests a small import surface.*
- Added a main-process safety check (`isPathInsideActiveVault`) instead of trusting the renderer. *Reason: the renderer's correctness was the root cause of the bug; a main-process invariant prevents the same shape of regression from re-occurring silently.*
- Kept the legacy relative-fallback branch in `vaultDir` for the `(null, [])` case. *Reason: existing unit tests that mount the renderer without a vault path expect the historical behavior; preserving it as the explicit fallback documents intent and keeps the test surface small.*

**Open questions:** none.
