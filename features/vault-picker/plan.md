---
name: Vault picker
slug: vault-picker
status: planned
frozen: true
created: 2026-05-08
---

# Vault picker

## Pattern summary

On launch, if a previously selected vault is configured and the folder still exists, the app opens that vault directly. Otherwise (true first run, or the previous vault is missing from disk), the app shows a vault-picker view centered on the workspace surface. The picker presents two actions stacked vertically: **Create new vault** (opens an OS folder picker; on confirm, todoz writes a `todos/` and `archive/todos/` skeleton inside the chosen folder, then opens it) and **Open folder as vault** (opens an OS folder picker on an existing folder, then opens it). Below the actions, a **Recent vaults** list shows one row per previously opened vault: folder name on the top line, absolute path on the second line in `mono-label` (12px monospaced) style, with a hover-only "remove from list" icon button at the right edge of each row. Clicking a recent row opens that vault. From inside the main window, an "Open another vault" icon button placed at the top of the main view re-opens the picker — the renderer reloads in place against the new vault, no Electron restart. The picker's recents list and last-opened vault path persist to a JSON config file in Electron's `userData` directory, outside any vault.

**In scope:** picker view DOM, Create new vault (creates `todos/` + `archive/todos/` only — no `bookmarks/`/`goals/`/`notes/`), Open folder as vault, Recent vaults list, remove-from-recents (config-only; folder on disk untouched), "Open another vault" affordance from the main window, persistent vault-config JSON in `userData`, in-place renderer reload when switching vaults.

**Out of scope:** missing/unavailable vault handling (gray-out, reconnect prompt), default/starred vault, per-vault settings, vault rename, drag-and-drop folder onto the picker, scaffolding for `bookmarks/`/`goals/`/`notes/` on Create new vault.

## Acceptance criteria

1. Given no vault config file exists on disk, when the app launches, then the vault-picker is shown with a "Create new vault" button, an "Open folder as vault" button, and an empty Recent vaults section.
2. Given the vault-picker is shown, when the user clicks "Create new vault" and the OS folder picker returns an empty target folder, then todoz creates `todos/` and `archive/todos/` inside that folder, the picker is hidden, and the main todo list is shown against the new vault.
3. Given the vault-picker is shown, when the user clicks "Open folder as vault" and the OS folder picker returns an existing folder containing a `todos/` directory, then the picker is hidden and the main todo list is shown against that folder.
4. Given the vault config lists two previously opened vaults, when the vault-picker loads, then the Recent vaults section shows one row per vault with folder name on the top line and absolute path on the second line, ordered most-recent first.
5. Given the vault-picker is shown with two recents, when the user clicks the first recent row, then the picker is hidden and the main todo list is shown against that recent's vault path.
6. Given the vault-picker is shown with two recents, when the user hovers the first recent row and clicks the remove icon, then the row is no longer in the recents list and the underlying folder still exists on disk.
7. Given the main todo list is shown, when the user clicks the "Open another vault" icon button at the top of the main view, then the vault-picker is shown.
8. Given the vault config's `lastOpened` path exists on disk, when the app launches, then the main todo list is shown against that path and the vault-picker is not shown.

## Step-definition file

`test/step_defs/vault-picker.steps.ts` — steps:

**Given:**
- `Given("no vault config file exists")` (NEW) — sets `this.vaultConfigPath` to a tmp file path that does not exist; world ensures it is unlinked before the When step.
- `Given("the vault-picker is shown")` (NEW) — mounts the app via `mountApp(this.document.body)` with `window.todoz.getVaultConfig()` mocked to return `{ lastOpened: null, recents: [] }`; asserts `[data-vault-picker]` is present.
- `Given("the vault-picker is shown with two recents")` (NEW) — mounts the app with `window.todoz.getVaultConfig()` mocked to return `{ lastOpened: null, recents: [<alpha-fixture-path>, <beta-fixture-path>] }`; asserts `[data-vault-picker] [data-recent-row]` count is 2.
- `Given("the OS folder picker will return an empty target folder")` (NEW) — creates a fresh tmp dir, stores its absolute path on `this.pickerReturnPath`, stubs `window.todoz.openFolderPicker()` to resolve with that path.
- `Given("the OS folder picker will return a folder containing {string}")` (NEW) — uses `test/fixtures/vaults/alpha` (which contains `todos/`) as the picker return path; stubs `window.todoz.openFolderPicker()` accordingly. The `{string}` argument names the required subdir (will be `"todos"`).
- `Given("the vault config lists two previously opened vaults")` (NEW) — writes a JSON config file at `this.vaultConfigPath` with `recents: [<alpha-fixture-path>, <beta-fixture-path>]`, `lastOpened: null`.
- `Given("the vault config's last-opened vault exists on disk")` (NEW) — writes a JSON config file with `lastOpened: <alpha-fixture-path>` and `recents: [<alpha-fixture-path>]`.
- `Given("the main todo list is shown")` (REUSE if it exists in `test/step_defs/*.steps.ts`; else NEW) — mounts the app with an active vault configured, asserts `[data-main-view]` is present and `[data-vault-picker]` is absent.

**When:**
- `When("the app launches")` (NEW) — calls `mountApp(this.document.body)`. Distinct from the `Given` mounts: this `When` is used by scenarios that assert what the app shows on initial mount, given pre-existing config-file state set up by the `Given`.
- `When("the vault-picker loads")` (NEW) — alias for `When("the app launches")` when the picker is the expected initial view; same body.
- `When("the user clicks {string}")` (REUSE — already defined in `add-task.steps.ts`) — clicks the element whose visible label text equals the string.
- `When("the user clicks the first recent row")` (NEW) — clicks the first `[data-vault-picker] [data-recent-row]`.
- `When("the user hovers the first recent row and clicks the remove icon")` (NEW) — fires `mouseenter` on the first `[data-recent-row]`, then clicks `[data-recent-row]:first-child [data-remove-recent]`. The hover step exists to surface the icon; the click is the actual action.
- `When("the user clicks the {string} icon button")` (NEW) — clicks the element with `aria-label` equal to the string. Used for "Open another vault".

**Then:**
- `Then("the vault-picker is shown")` (NEW) — asserts `[data-vault-picker]` exists in the document.
- `Then("the vault-picker is not shown")` (NEW) — asserts `[data-vault-picker]` is absent.
- `Then("the recents list is empty")` (NEW) — asserts `[data-vault-picker] [data-recent-row]` count is 0.
- `Then("the {string} button is visible")` (NEW) — asserts a `<button>` with visible text equal to the string exists in `[data-vault-picker]`.
- `Then("{string} exists in the target folder")` (NEW) — asserts the directory `path.join(this.pickerReturnPath, <string>)` exists on disk via `fs.existsSync` (run in the cucumber world Node context, not in renderer).
- `Then("the main todo list is shown against the target folder")` (NEW) — asserts `[data-main-view][data-vault-path="<this.pickerReturnPath>"]` is present.
- `Then("the main todo list is shown against the selected folder")` (NEW) — same as the previous step; the "selected folder" is also recorded in `this.pickerReturnPath` for the open-folder-as-vault scenario.
- `Then("the main todo list is shown against the first recent's vault path")` (NEW) — asserts `[data-main-view][data-vault-path]` equals the first recent's absolute path (alpha fixture).
- `Then("the main todo list is shown against the last-opened vault")` (NEW) — asserts `[data-main-view][data-vault-path]` equals the `lastOpened` path written by the corresponding `Given`.
- `Then("the recents list shows one row per vault in most-recent-first order")` (NEW) — asserts the order of `[data-recent-row][data-vault-path]` attributes matches the order of the `recents` array in the config.
- `Then("each recent row shows the folder name and absolute path")` (NEW) — for each `[data-recent-row]`, asserts `[data-recent-name]` text equals `path.basename(<vaultPath>)` and `[data-recent-path]` text equals the absolute path.
- `Then("the first recent row is no longer in the recents list")` (NEW) — asserts the post-click DOM has one `[data-recent-row]` and its `data-vault-path` equals the second recent's path (beta).
- `Then("the first recent's folder still exists on disk")` (NEW) — asserts `fs.existsSync(<alpha-fixture-path>)` is true.

`test/step_defs/world.ts` (extend, do NOT replace): add `vaultConfigPath: string`, `pickerReturnPath: string`, and a per-scenario tmp-dir lifecycle (create on `Before`, recursive remove on `After`). The world should also expose helpers `writeVaultConfig(config)` and `readVaultConfig()` against `this.vaultConfigPath`.

## BDD test list

[file: test/patterns/vault-picker.spec.ts]

- `describe("VaultPicker view")` > `it("renders both action buttons when shown")`
- `describe("VaultPicker view")` > `it("renders an empty recents section when config has no recents")`
- `describe("VaultPicker view")` > `it("renders one row per recent vault in most-recent-first order")`
- `describe("VaultPicker view")` > `it("renders the folder name on each recent row")`
- `describe("VaultPicker view")` > `it("renders the absolute path on each recent row")`
- `describe("VaultPicker view")` > `it("calls window.todoz.openFolderPicker on Create new vault click")`
- `describe("VaultPicker view")` > `it("calls window.todoz.createVault with the picker-returned path on Create new vault confirm")`
- `describe("VaultPicker view")` > `it("calls window.todoz.openFolderPicker on Open folder as vault click")`
- `describe("VaultPicker view")` > `it("calls window.todoz.setActiveVault with the picker-returned path on Open folder as vault confirm")`
- `describe("VaultPicker view")` > `it("calls window.todoz.setActiveVault with the recent's path when a recent row is clicked")`
- `describe("VaultPicker view")` > `it("reveals the remove icon when a recent row is hovered")`
- `describe("VaultPicker view")` > `it("calls window.todoz.removeRecent when the remove icon is clicked")`
- `describe("VaultPicker view")` > `it("removes the DOM row when the remove icon is clicked")`
- `describe("VaultPicker view")` > `it("does not call setActiveVault when the remove icon is clicked")`
- `describe("MainWindow shell")` > `it("shows the Open another vault icon button at the top of the main view")`
- `describe("MainWindow shell")` > `it("toggles the picker visible when Open another vault is clicked")`
- `describe("App boot")` > `it("shows the picker when no active vault is configured")`
- `describe("App boot")` > `it("shows the main todo list when the configured active vault exists on disk")`

[file: test/data/vaultConfig.spec.ts]

- `describe("readVaultConfig")` > `it("returns an empty config when the file does not exist")`
- `describe("readVaultConfig")` > `it("parses an existing JSON config file")`
- `describe("writeVaultConfig")` > `it("writes JSON to the configured path")`
- `describe("addRecent")` > `it("prepends the path to the recents list")`
- `describe("addRecent")` > `it("deduplicates an existing path by moving it to the front")`
- `describe("removeRecent")` > `it("removes the path from the recents list")`

[file: test/data/createVault.spec.ts]

- `describe("createVault")` > `it("creates a todos directory in the target folder")`
- `describe("createVault")` > `it("creates an archive/todos directory in the target folder")`
- `describe("createVault")` > `it("is idempotent when the directories already exist")`

## File map

### New files

**Renderer:**
- `src/renderer/views/VaultPicker.ts` — picker view, exports `mountVaultPicker(root, deps)` returning a teardown function. `deps` shape: `{ getVaultConfig, openFolderPicker, createVault, setActiveVault, removeRecent }`.
- `src/renderer/views/MainView.ts` — extracted main todo list view (if not already extracted), so `app.ts` can swap between picker and main. If extraction is too invasive, keep the swap inside `src/renderer/index.ts` and gate by `[data-vault-path]` on the root.
- `src/renderer/data/vaultPickerHandlers.ts` — pure event handler factories for the picker (testable without DOM). Optional — only if it materially simplifies the spec.

**Main process:**
- `src/main/vaultConfig.ts` — JSON read/write over `app.getPath('userData') + '/vault-config.json'`. Exports `readVaultConfig()`, `writeVaultConfig(config)`, `addRecent(path)`, `removeRecent(path)`, `setLastOpened(path)`.
- `src/main/createVault.ts` — exports `createVault(absPath)` which `mkdir -p` creates `todos/` and `archive/todos/` inside the given folder.
- `src/main/ipc.ts` (NEW or extend existing) — wires IPC handlers: `vaultz:getConfig`, `vaultz:openFolderPicker` (uses `dialog.showOpenDialog` with `properties: ['openDirectory']`), `vaultz:createVault`, `vaultz:setActiveVault`, `vaultz:removeRecent`.

**Preload:**
- `src/preload.ts` — extend the `window.todoz` surface to expose: `getVaultConfig()`, `openFolderPicker()`, `createVault(path)`, `setActiveVault(path)`, `removeRecent(path)`. Each is a thin `ipcRenderer.invoke` wrapper.

**Fixtures:**
- `test/fixtures/vaults/alpha/todos/.gitkeep` — committed to keep the empty dir tracked.
- `test/fixtures/vaults/beta/todos/.gitkeep` — committed to keep the empty dir tracked.

### Files to update

- `src/config/settings.ts` — keep the `NODE_ENV === 'test'` branch (returns `test/fixtures/vault/`) for back-compat with existing tests. Add a new branch: in production, resolve from `vaultConfig.lastOpened`. Returns `null` when no active vault is configured (renderer mounts the picker in that case). Existing call sites must accept a possibly-null return value.
- `src/main.ts` — register the new IPC handlers; on `app.whenReady()`, read the vault config and pass the active vault path (or null) to the renderer via `BrowserWindow` constructor query string or via the existing IPC layer.
- `src/preload.ts` — add the new methods on `window.todoz` (see above).
- `src/renderer/index.ts` — at boot, call `window.todoz.getVaultConfig()`. If `lastOpened` is set and the renderer was told the path is valid (main process pre-validates), mount the main view. Otherwise mount the picker. After the picker resolves a vault, swap views without reloading the Electron window (clear `document.body`, mount main view, set `data-vault-path` on root).
- `test/step_defs/world.ts` — add tmp-dir lifecycle and config-file helpers (see Step-definition file section).
- `test/cucumber.config.*` (whatever the existing config file is) — no change expected; new step file is auto-loaded by glob.

### DOM contract (selectors authoritative for tests)

- Root: `<div data-app>` (existing) — gains a `data-vault-path` attribute when a vault is active; absent when picker is shown.
- Picker: `<section data-vault-picker>` containing:
  - `<button>Create new vault</button>` (no special data attr — test queries by text)
  - `<button>Open folder as vault</button>`
  - `<ul data-recents>` containing zero or more `<li data-recent-row data-vault-path="<abs>">`:
    - `<span data-recent-name>` — folder name
    - `<span data-recent-path>` — absolute path (rendered with `mono-label` typography)
    - `<button data-remove-recent aria-label="Remove from recents">×</button>` — visible only on row hover (CSS-controlled; no DOM-add/remove on hover)
- Main view: `<main data-main-view data-vault-path="<abs>">` containing the existing main UI plus:
  - `<button data-open-another-vault aria-label="Open another vault">…</button>` placed in the top-right corner of `[data-main-view]`'s header.

### Visual treatment

Use existing tokens from `DESIGN.md`:
- Picker container: `surface-container-lowest` background, `outline-variant` 1px border, `rounded.lg` (0.5rem) corners, max-width 480px, centered with 32px (xl) outer margin.
- Action buttons: primary style (solid black `primary`, white `on-primary`) for Create; secondary style (white background, `outline` border) for Open. 16px (md) gap between buttons.
- Section header "Recent vaults": `label-md` typography, `on-surface-variant` color, 24px (lg) top margin.
- Recent rows: 8px (sm) vertical padding, 1px `outline-variant` separator between rows. Folder name uses `body-md`; path uses `mono-label`. Remove icon is a 16×16 button, only rendered visible on row `:hover` (use `opacity` or `display`; do not add/remove from DOM).
- "Open another vault" icon button: 32×32, `outline` border on hover, `rounded.DEFAULT` (0.25rem) corners.

## Data fixtures

- `test/fixtures/vaults/alpha/todos/.gitkeep` — empty alternate vault A; folder name `alpha` becomes the row title.
- `test/fixtures/vaults/beta/todos/.gitkeep` — empty alternate vault B; folder name `beta` becomes the row title.

The vault-config JSON files are not committed. The cucumber world (`test/step_defs/world.ts`) and individual `*.spec.ts` files create them at runtime in a per-scenario tmp dir, with absolute paths resolved against `path.resolve(__dirname, '../fixtures/vaults/<name>')`. The "create new vault" target folder is also a runtime tmp dir created by `Given("the OS folder picker will return an empty target folder")`.
