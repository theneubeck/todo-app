---
name: Go to destination command
slug: goto-command
status: planned
frozen: true
created: 2026-05-17
---

# Go to destination command

## Pattern summary

The `/goto` command lets the user navigate to any sidebar destination by typing `/goto <destination>` in the command bar and pressing Enter — equivalent to clicking the corresponding sidebar entry but without lifting hands from the keyboard. Destinations: `inbox`, `#<project-tag>` (e.g., `/goto #errands`), `@<person>` (e.g., `/goto @mike`), and `chat`. The `#` and `@` sigils in `/goto` arguments align with how tags are displayed in the sidebar, and the existing tag autocomplete fires naturally once the user types `#` or `@` after `/goto `.

Pressing `cmd+t` from anywhere in the app focuses the command bar and pre-fills `/goto ` (mirroring how `cmd+i` pre-fills `/add `). The user can then type the destination, optionally accepting a tag via Tab autocomplete, and press Enter to navigate. On a recognised destination the command bar clears and the main view or chat view updates. An unrecognised destination (e.g., `/goto zzz`) is a silent no-op: the input is preserved so the user can correct it.

**In scope:** `parseGotoCommand` pure parser; wiring in `handleCommandEnter`; `cmd+t` document-level keydown; destinations `inbox`, `#<tag>`, `@<person>`, `chat`.

**Out of scope:** `today` and `upcoming` destinations (those sidebar entries are currently inert — no click handler — adding `/goto today` before the view is implemented would navigate to a non-functional state); fuzzy matching of tag names (exact match only; the autocomplete handles suggestion); any new autocomplete trigger (the existing `#`/`@` autocomplete already fires naturally inside a `/goto ` prefix).

## Acceptance criteria

1. Given the command bar is empty and chat is enabled, when the user types `/goto inbox` and presses Enter, then `[data-main-header] h1` shows `Inbox` and the command bar input is cleared.
2. Given the vault has tasks tagged `#errands`, when the user types `/goto #errands` and presses Enter, then `[data-main-header] h1` shows `#errands` and the command bar input is cleared.
3. Given the vault has tasks tagged `@mike`, when the user types `/goto @mike` and presses Enter, then `[data-main-header] h1` shows `@mike` and the command bar input is cleared.
4. Given the command bar is empty and chat is enabled, when the user types `/goto chat` and presses Enter, then `[data-chat-view]` is present in the DOM.
5. Given the app is mounted, when the user presses `cmd+t` anywhere, then the command bar input is focused and its value starts with `/goto `.
6. Given the command bar is empty, when the user types `/goto zzz` and presses Enter, then no navigation occurs (main header still shows `Inbox`) and the command bar input value is preserved as `/goto zzz`.

## Step-definition file

`test/step_defs/goto-command.steps.ts` — new steps only; all other steps are reused from existing files.

**Given:**
- `Given("the command bar input is empty")` (REUSE — `command-bar-fixes.steps.ts`)
- `Given("the vault contains tasks tagged {string}")` (REUSE — `tag-autocomplete.steps.ts`)

**When:**
- `When("the user types {string} in the command bar and presses Enter")` (REUSE — `chat-interface.steps.ts`)
- `When("the user presses cmd+t")` (NEW) — fires a `{ metaKey: true, key: 't', bubbles: true, cancelable: true }` KeyboardEvent on `document`

**Then:**
- `Then("the main header title is {string}")` (NEW) — asserts `[data-main-header] h1` text content equals the string
- `Then("the command bar input value starts with {string}")` (NEW) — asserts `commandBarInput(world).value.startsWith(prefix)`
- `Then("the input value is {string}")` (REUSE — `command-bar-fixes.steps.ts`)
- `Then("the input is focused")` (REUSE — `command-bar-fixes.steps.ts`)
- `Then("the chat thread is visible")` (REUSE — `chat-interface.steps.ts`)

## BDD test list

[file: test/data/parseGotoCommand.spec.ts]
- `describe("parseGotoCommand")` > `it("returns null for empty string")`
- `describe("parseGotoCommand")` > `it("returns null for input that does not start with /goto")`
- `describe("parseGotoCommand")` > `it("returns { kind: 'inbox' } for /goto inbox")`
- `describe("parseGotoCommand")` > `it("returns { kind: 'chat' } for /goto chat")`
- `describe("parseGotoCommand")` > `it("returns { kind: 'tag', value: 'errands' } for /goto #errands")`
- `describe("parseGotoCommand")` > `it("returns { kind: 'tag', value: '@mike' } for /goto @mike")`
- `describe("parseGotoCommand")` > `it("returns null for /goto with unrecognised destination")`
- `describe("parseGotoCommand")` > `it("is case-insensitive for the command prefix")`

[file: test/view/gotoCommand.spec.ts]
- `describe("GoTo command")` > `it("sets the inbox filter when /goto inbox is submitted")`
- `describe("GoTo command")` > `it("sets a project tag filter and clears input when /goto #errands is submitted")`
- `describe("GoTo command")` > `it("sets a people tag filter when /goto @mike is submitted")`
- `describe("GoTo command")` > `it("activates chat view when /goto chat is submitted")`
- `describe("GoTo command")` > `it("is a no-op and preserves input for /goto zzz")`
- `describe("GoTo command")` > `it("pre-fills /goto when cmd+t is pressed")`
- `describe("GoTo command")` > `it("does not overwrite an existing /goto prefix on a second cmd+t")`

## File map

### New files
- `src/renderer/data/parseGotoCommand.ts` — pure parser, no DOM. Exports:
  ```ts
  export type GotoTarget =
    | { kind: 'inbox' }
    | { kind: 'chat' }
    | { kind: 'tag'; value: string }  // bare slug for #tags; "@handle" for @people

  export function parseGotoCommand(input: string): GotoTarget | null
  ```
  Grammar: `/goto <dest>` (case-insensitive prefix). Destinations:
  - `inbox` → `{ kind: 'inbox' }`
  - `chat` → `{ kind: 'chat' }`
  - `#<slug>` → `{ kind: 'tag', value: slug.toLowerCase() }`
  - `@<handle>` → `{ kind: 'tag', value: '@' + handle.toLowerCase() }`
  - anything else → `null`
  - missing or empty dest → `null`
- `test/data/parseGotoCommand.spec.ts` — Mocha/Chai unit tests for `parseGotoCommand`
- `test/view/gotoCommand.spec.ts` — Tallahassee DOM tests (mounts `mountApp`, exercises command bar)
- `test/step_defs/goto-command.steps.ts` — 3 new Cucumber step definitions (see Step-definition file section)
- `test/features/goto-command.feature` — frozen Gherkin (6 scenarios)
- `test/verify/gotoCommand.verify.ts` — Playwright E2E verify script; takes screenshots to `tmp/gotoCommand-*.png`

### Files to update
- `src/renderer/index.ts`:
  - Add `import { parseGotoCommand } from './data/parseGotoCommand'` at the top.
  - In `handleCommandEnter(input)`: before calling `parseAddCommand`, call `parseGotoCommand(input.value)`. If it returns a target, call a new inline helper `applyGoto(target)` that sets `chatActive` or `activeFilter`, calls `fullRender()`, and clears `input.value`. Return early. If `parseGotoCommand` returns null and the value starts with `/goto`, treat as no-op (return early, preserve input). Otherwise fall through to `parseAddCommand`.
  - In the document-level `keydown` handler (where `cmd+i` lives): add an `else if` branch for `metaKey && (key === 't' || key === 'T')` that prevents default, queries the command bar input, and sets `input.value = '/goto '` if it does not already start with `/goto `; then calls `input.focus()`.
- `package.json`: append `&& ts-node test/verify/gotoCommand.verify.ts` to the `verify:playwright` script value.

### DOM contract
All selectors already exist — no new `data-*` attributes introduced:
- `[data-command-bar] input[type="text"]` — the command bar input (queried in step defs and verify script)
- `[data-main-header] h1` — main view title; text content is the `filterLabel(activeFilter)` return value
- `[data-sidebar-entry="{key}"][data-nav-active]` — active sidebar entry (already set by `renderSidebar`)
- `[data-chat-view]` — present when `chatActive === true`

### Visual treatment
No new visual elements. The `/goto` command reuses:
- Existing command bar (already styled)
- Existing main header h1 (already styled, Inter h1 32px 600)
- Existing sidebar active state (already has `data-nav-active` styling)

## Data fixtures

No new committed fixture files. Cucumber scenarios use:
- `Given("the command bar input is empty")` — bootstraps with empty task list (showChat defaults to true from `DEFAULT_APP_SETTINGS`)
- `Given("the vault contains tasks tagged {string}")` — constructs in-memory fixtures (defined in `tag-autocomplete.steps.ts`)

The Playwright verify script seeds fixture tasks directly via the mocked `readTodos` IPC (same pattern as other verify scripts).

## Conflicts & Decisions

**Conflicts:** none. `/goto` is a new command verb; no existing frozen plan is contradicted.

**Decisions:**
- **`/goto` not `/go`** — user mentioned both; longer form is unambiguous and consistent with `/add`. Autocomplete makes brevity less important.
- **`today`/`upcoming` out of scope** — those sidebar entries have no click handler (`bindSidebarClicks` explicitly skips them). Adding `/goto today` before the view works would silently do nothing, which is confusing. Easier to add later when the views are implemented.
- **`cmd+t` clears non-`/goto` prefix** — if the input has other content (e.g., `/add buy milk`), `cmd+t` replaces it with `/goto `. The user is explicitly requesting navigation, not appending. Matches `cmd+i` in spirit.
- **No-op for unrecognised destination** — input preserved, no navigation, no error message. Matches the `/add` no-op pattern (empty title → no-op). The user can read and correct the input.
- **Lowercase destination comparison** — `parseGotoCommand` lowercases before matching, so `/goto Inbox`, `/goto INBOX` all resolve. Matches `parseAddCommand` which lowercases tags.
- **`/goto #tag` strips `#` for Filter value** — tags are stored as bare slugs in the `Filter` type (`{ kind: 'tag', value: 'errands' }`). The sigil is the user-facing notation, same as how `parseAddCommand` strips `#` from inline tags.
