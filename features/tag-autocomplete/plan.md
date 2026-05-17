---
name: Tag autocomplete
slug: tag-autocomplete
status: planned
frozen: true
created: 2026-05-13
---

# Tag autocomplete

## Pattern summary

When the user types `#` or `@` in the command bar input — anywhere in the value, not only at the start — a dropdown of matching tags from the active vault appears anchored below the input. The dropdown shows up to 8 suggestions, sorted alphabetically, with the leading sigil rendered (`#errands`, `@mike`) so the user sees exactly what will be inserted. The trigger is the **word the caret sits on**: walking left from the caret until a whitespace or start-of-input, the resulting word's first character decides the suggestion source (`#` → existing project tags, `@` → existing people tags). Characters typed after the sigil are a case-insensitive substring filter (`#er` matches `errands` and `verifier-things`; `@li` matches `@lina`). The dropdown is **keyboard-only**: ↑/↓ to navigate, **Tab to accept** the highlighted suggestion, Esc to dismiss. Enter is **not** intercepted — it falls through to the existing command-bar handler, so the user can type `/add buy milk @li<Tab> #wo<Tab>` and press Enter to submit without the dropdown getting in the way. Accepting a suggestion replaces just the trigger word in the input with the full tag plus a trailing space, leaves the rest of the input alone, and moves the caret to immediately after the inserted space. The dropdown closes on accept, on Esc, on blur of the input, or when the caret moves away from a `#`/`@`-prefixed word. Autocomplete fires regardless of the command bar's mode (command or chat) — the trigger is the literal `#`/`@` character, not a slash-command parse. When the suggestion list has zero matches, the dropdown does not render at all (no "no results" row).

**In scope:** trigger detection on the input event (caret-aware word extraction); a new `[data-autocomplete]` dropdown view anchored to the command bar input; up to 8 results, alphabetical; substring case-insensitive match against `uniqueTags(tasks)` output; keyboard nav (↑/↓/Tab/Esc only); inserting replaces the trigger word with `<sigil><name> ` and positions the caret after the trailing space; dropdown auto-closes on accept/Esc/blur/caret-out; works in both command mode (`/add`) and chat mode; tasks set is the source of truth — when tasks change (e.g., after `/add` or `addSubtask`), the next trigger uses the updated tag list.

**Out of scope:** creating brand-new tags from the dropdown (the autocomplete only suggests existing tags; typing a non-matching tag is allowed and just doesn't suggest); mouse / click interaction (no `mousedown` or `click` listener on suggestions; CSS `:hover` for visual feedback is allowed but does not change the active row); accepting via Enter (Enter stays bound to the existing command-bar submit path); fuzzy matching beyond substring (no scoring, no Levenshtein); recency / usage frequency in the ordering (alphabetical only); displaying task counts next to each tag; multi-character triggers (e.g., a `:` for emoji, a `/` for slash commands — slash commands stay on the existing handler, not this feature); auto-completing inside the chat thread's history or anywhere else outside the command bar input; an "Add new tag…" button at the bottom of the dropdown; touch / mobile interactions; truncation of long tag names beyond CSS ellipsis.

## Acceptance criteria

1. Given the command bar input is empty and the vault has at least one `#`-tag, when the user types a single `#` character, then a `[data-autocomplete]` dropdown appears below the input listing every existing project tag prefixed with `#`, alphabetically sorted, capped at 8 entries.
2. Given the dropdown is open with multiple suggestions and the first is highlighted, when the user presses ↓, then `[data-autocomplete-active]` moves from the first suggestion to the second; subsequent ↓ wraps from the last back to the first.
3. Given a suggestion is highlighted in the dropdown, when the user presses Tab, then the trigger word in the input (e.g., `#e`) is replaced with `<full tag> ` (the full tag plus a trailing space), the dropdown closes, the input retains focus, and focus does NOT shift to the next focusable element.
4. Given the dropdown is open, when the user presses Esc, then the dropdown closes and the input value is unchanged.
5. Given the dropdown is open and a suggestion is highlighted, when the user presses Enter, then the Enter passes through to the existing command-bar handler (the dropdown does NOT consume it); the input value is unchanged by the dropdown.
6. Given the user types `@l` in the input and the vault has tasks tagged `@lina` and `@mike`, when the input event fires, then the dropdown shows only `@lina` (substring match on the post-sigil text, case-insensitive).
7. Given the user types `#zzz` (no matching tags) in the input, when the input event fires, then no dropdown is rendered (zero suggestions → no DOM presence).
8. Given the dropdown is open and the user types or moves the caret so the caret is no longer on a `#`- or `@`-prefixed word, when the next input/keydown event fires, then the dropdown closes.

## Step-definition file

`test/step_defs/tag-autocomplete.steps.ts` — steps:

**Given:**
- `Given("the vault contains tasks tagged {string}")` (NEW) — sets `this.fixtures` to a fixture set whose tasks collectively carry the given comma-separated tag list (e.g. `"#errands, #personal, @mike, @lina"`), then mounts the app.
- `Given("the command bar input is empty")` (REUSE — `add-task.steps.ts`).
- `Given("the command bar input value is {string} with caret at end")` (NEW) — sets `[data-command-bar] input[type="text"]` value and positions the caret at `value.length`. Fires an `input` event.
- `Given("the autocomplete dropdown is open")` (NEW) — sets the input value to something that triggers (e.g. `"#"`) and asserts `[data-autocomplete]` is present.
- `Given("a suggestion is highlighted")` (NEW) — opens the dropdown via the prior step and asserts the first suggestion has `[data-autocomplete-active]`.

**When:**
- `When("the user types {string} in the command bar")` (REUSE — `chat-interface.steps.ts` defines a parallel step; reuse the closest match or alias).
- `When("the user presses {string}")` (NEW or REUSE — Cucumber generally has a key-press step; check `task-row-interactions.steps.ts` for an existing pattern. If only "presses cmd+i" or "presses Enter" exist, add the generic `presses {string}` step). The string argument is a key name: `"ArrowDown"`, `"Tab"`, `"Escape"`, `"Enter"`, etc.
- `When("the user moves the caret to position {string}")` (NEW) — sets `input.selectionStart` and `input.selectionEnd` to the given number, fires an `input` event so the dropdown re-evaluates.

**Then:**
- `Then("the autocomplete dropdown is shown")` (NEW) — asserts `[data-autocomplete]` is present in the document.
- `Then("the autocomplete dropdown is not shown")` (NEW) — asserts `[data-autocomplete]` is absent.
- `Then("the dropdown shows {string}")` (NEW) — asserts a `[data-autocomplete-suggestion] [data-autocomplete-label]` exists whose text content equals the string.
- `Then("the dropdown does not show {string}")` (NEW) — opposite assertion.
- `Then("the highlighted suggestion is {string}")` (NEW) — asserts `[data-autocomplete-suggestion][data-autocomplete-active] [data-autocomplete-label]` text equals the string.
- `Then("the input value is {string}")` (REUSE — `chat-interface.steps.ts` defines this).
- `Then("the input retains focus")` (NEW) — asserts `this.document.activeElement` is the command bar's input element.

## BDD test list

[file: test/data/autocompleteSuggestions.spec.ts]  ← new unit-test file. The matcher is the entire interesting logic; the dropdown wiring is a small adapter on top.
- `describe("getTriggerWord")` > `it("returns null when the caret is at start of empty input")`
- `describe("getTriggerWord")` > `it("returns the # word when the caret is just after #")`
- `describe("getTriggerWord")` > `it("returns the # word with prefix when caret is mid-word")`
- `describe("getTriggerWord")` > `it("returns the @ word similarly")`
- `describe("getTriggerWord")` > `it("returns null when the word does not start with # or @")`
- `describe("getTriggerWord")` > `it("identifies the word the caret sits on, not the last word")`
- `describe("getTriggerWord")` > `it("returns null when caret is on a space character")`
- `describe("getSuggestions")` > `it("returns all # tags when prefix is just '#'")`
- `describe("getSuggestions")` > `it("substring-matches case-insensitively after the sigil")`
- `describe("getSuggestions")` > `it("returns @ tags for an @ prefix and never project tags")`
- `describe("getSuggestions")` > `it("returns alphabetically sorted results")`
- `describe("getSuggestions")` > `it("caps the result list at 8 entries")`
- `describe("getSuggestions")` > `it("returns an empty array when no tags match")`
- `describe("getSuggestions")` > `it("returns an empty array when the caret is not on a # or @ word")`
- `describe("applyAutocomplete")` > `it("replaces the trigger word with the chosen tag plus a trailing space")`
- `describe("applyAutocomplete")` > `it("preserves text before and after the trigger word")`
- `describe("applyAutocomplete")` > `it("returns the new caret position after the inserted space")`

[file: test/view/tagAutocomplete.spec.ts]
- `describe("Autocomplete dropdown")` > `it("renders a [data-autocomplete] container with one row per suggestion")`
- `describe("Autocomplete dropdown")` > `it("marks the first suggestion as [data-autocomplete-active] on open")`
- `describe("Autocomplete dropdown")` > `it("advances the active row on ArrowDown")`
- `describe("Autocomplete dropdown")` > `it("wraps the active row from last to first on ArrowDown at the end")`
- `describe("Autocomplete dropdown")` > `it("retreats the active row on ArrowUp")`
- `describe("Autocomplete dropdown")` > `it("inserts the active suggestion on Tab")`
- `describe("Autocomplete dropdown")` > `it("prevents the default Tab focus shift when accepting a suggestion")`
- `describe("Autocomplete dropdown")` > `it("does not consume Enter when the dropdown is open")`
- `describe("Autocomplete dropdown")` > `it("closes on Escape without modifying the input")`
- `describe("Autocomplete dropdown")` > `it("closes when the input value changes to a non-trigger word")`

## File map

### New files
- `src/renderer/data/autocompleteSuggestions.ts` — exports three pure functions:
  - `getTriggerWord(value: string, caret: number): { prefix: string; start: number; end: number } | null` — walks left from `caret` to the previous whitespace boundary, returns the word with its start/end indices if it begins with `#` or `@`.
  - `getSuggestions(value, caret, allTags): { label: string; insert: string }[]` — calls `getTriggerWord`; on a `#` trigger filters `allTags.projects` (no sigil in storage; `label = "#" + tag`, `insert = "#" + tag`); on `@` filters `allTags.people` (already stored with `@`; `label = tag`, `insert = tag`). Substring match, case-insensitive, alphabetical sort, cap at 8.
  - `applyAutocomplete(value, caret, choice): { value: string; caret: number }` — replaces `value.slice(trigger.start, trigger.end)` with `choice.insert + " "`, returns the new value and caret position (`trigger.start + choice.insert.length + 1`).
- `src/renderer/views/AutocompleteDropdown.ts` — exports `mountAutocompleteDropdown(input, deps): TearDown`. The view holds its own internal `activeIndex` state; the input wires the trigger detection. `deps` shape: `{ getAllTags: () => { projects: string[]; people: string[] }, onInsert: (newValue: string, newCaret: number) => void }`. The view inserts/removes a `[data-autocomplete]` element as a sibling of the input (or absolute-positioned next to it).
- `test/step_defs/tag-autocomplete.steps.ts`
- `test/data/autocompleteSuggestions.spec.ts`
- `test/view/tagAutocomplete.spec.ts`
- `test/verify/tagAutocomplete.verify.ts` — Playwright verify. Mounts the app with a fixture set that already includes `#errands`, `#personal`, `@mike`, `@lina`. Captures three screenshots:
  - `tmp/tagAutocomplete-hash.png` — dropdown open with `#` typed, showing both project tags.
  - `tmp/tagAutocomplete-at-filtered.png` — `@l` typed, dropdown shows only `@lina`.
  - `tmp/tagAutocomplete-after-insert.png` — after pressing Enter, input value contains `@lina ` and dropdown is gone.

### Files to update
- `src/renderer/index.ts`:
  - In the `bindCommandBar(main)` function (where the input + Enter handler + mode-detection live today), after the input element is grabbed, call `mountAutocompleteDropdown(input, { getAllTags, onInsert })`:
    - `getAllTags` returns `uniqueTags(tasks)` (the existing helper already exported within the file or accessible in scope).
    - `onInsert(newValue, newCaret)` sets `input.value = newValue`, calls `input.setSelectionRange(newCaret, newCaret)`, fires an `input` event so the mode-detection and any other listeners re-evaluate, and refocuses the input if needed.
  - Save the teardown handle so the dropdown is torn down if `bindCommandBar` is called again (e.g., re-mounting on vault switch).
  - **Keyboard event ordering:** the existing input `keydown` listener handles `Enter` (mode-aware command/chat dispatch). The new dropdown's `keydown` listener intercepts `Tab`, `Escape`, `ArrowUp`, `ArrowDown` **only when the dropdown is open**, and calls `event.preventDefault() + event.stopPropagation()` so the browser's default Tab focus-shift and any other handler does not fire. **Enter is NOT intercepted** by the dropdown — it falls through to the existing command-bar handler, which submits the command or chat message as today (the user can type tags inline and submit without the dropdown getting in the way). When the dropdown is closed, the existing handlers run unchanged. Install the dropdown's listener with `capture: true` so the Tab/Esc/Arrow interception runs before the browser's default Tab handling.
  - **No mouse listeners.** The dropdown does NOT install `mousedown`, `click`, or `mouseenter` JS handlers. CSS `:hover` for visual feedback on a row is allowed but does not change the active row's `[data-autocomplete-active]` state.
  - **Input event ordering:** the dropdown listens on `input` events to update suggestions. The existing `updateMode` handler also listens. Both fire on every keystroke; order doesn't matter because they don't conflict. No change needed beyond confirming both listeners are attached.
- `src/renderer/index.html` — CSS for `[data-autocomplete]`:
  - Absolute-positioned dropdown anchored to the command bar input (use `position: relative` on the command bar and `position: absolute` on the dropdown).
  - Background `surface-container-lowest`, 1px `outline-variant` border, `rounded.md` (0.375rem) corners, 4px (xs) top margin from the input.
  - Suggestions rendered as block rows, padding 8px sm vertical / 12px horizontal, `body-md` typography. Active row has `surface-container-low` background.
  - Max width matches the input width; min width 200px. Max height ~280px with `overflow-y: auto` if more than ~7 visible (cap is 8 — borderline scroll on the edge case).
- `package.json` — append `&& ts-node test/verify/tagAutocomplete.verify.ts` to `verify:playwright`.

### DOM contract
- `[data-autocomplete]` (NEW) — dropdown container. Present when dropdown is open, absent when closed.
- `[data-autocomplete-suggestion]` (NEW) — one row per suggestion. Carries `[data-autocomplete-insert]="<string-to-insert>"` (the value `onInsert` will be called with).
- `[data-autocomplete-active]` (NEW) — present on exactly one `[data-autocomplete-suggestion]` at a time, marks the keyboard-selected row.
- `[data-autocomplete-label]` (NEW) — the visible text inside a suggestion row (e.g. `"#errands"`).
- No changes to existing selectors. The command bar input element keeps its current attributes.

### Visual treatment
- Container: `surface-container-lowest` background, 1px `outline-variant` border, `rounded.md` corners. 4px (xs) gap below the input. Shadow: none (per DESIGN.md "no drop shadows on surfaces").
- Rows: `body-md` (Inter 14px 400) for the label, 8px (sm) vertical / 12px horizontal padding, full-row hover background `surface-container-low`.
- Active row: same `surface-container-low` background, plus a 2px-thick `primary` left border to visually anchor the keyboard-selected state.
- Sigil + name kept as a single string (`#errands`, `@mike`) for visual simplicity; no separate icon column.

## Skill deviations (recorded)

UI feature with both Gherkin coverage (8 scenarios for the user-visible behaviors) and unit/Tallahassee coverage (the matcher logic + dropdown DOM). Same shape as `chat-interface` or `bug-fixes-1` — no skill deviation beyond what the standard plan-feature flow assumes.

## Conflicts & decisions

**Conflicts:** none. No frozen plan is contradicted; this layers on top of the existing command bar.

**Decisions:**
- **Trigger on the caret-position word, not the input suffix.** *Reason: matches Obsidian and Slack — users edit anywhere in the input, not just the end.*
- **Substring match, alphabetical sort.** *Reason: minimal scope; fuzzy / frequency-ranked are real improvements but easy follow-ups.*
- **Cap at 8 suggestions.** *Reason: matches Slack / Obsidian default dropdown sizes; keeps the dropdown short enough to scan.*
- **First suggestion highlighted by default.** *Reason: lets the user Enter-to-accept the most likely match without moving fingers.*
- **Tab accepts; Enter does not.** *Reason: Enter must stay bound to the existing command-bar submit (run `/add` or send chat). Binding Enter to accept would force users to Esc the dropdown before submitting; binding accept to Tab keeps Enter free and matches the @-mention dropdown idiom in Slack/Discord/Obsidian.*
- **Keyboard-only; no mouse listeners.** *Reason: the user explicitly asked for no mouse. CSS `:hover` for visual feedback is still acceptable and free, but no JS click/mousedown/mouseenter handlers are wired — accepting a suggestion is exclusively Tab.*
- **Capture-phase keydown for the dropdown.** *Reason: Tab's default action is to shift focus to the next element. Without capture-phase precedence, the browser's default Tab handler fires before we can `preventDefault()`. Capture phase + stopPropagation isolates Tab/Esc/Arrow cleanly while leaving Enter to pass through to the existing handler (which is on the bubble phase).*
- **Dropdown is a sibling of the input, not a child.** *Reason: the input is a `<input>` element, which cannot have children. Anchoring a sibling absolutely-positioned dropdown works in any layout.*
- **No "no results" row.** *Reason: a silent close is less noisy. If the user types a new tag, they want it to land in the input, not be told it doesn't exist.*
- **Autocomplete fires in both command and chat modes.** *Reason: the trigger is the literal `#`/`@` character — both modes can sensibly contain those. A chat message about a person is naturally tagged via `@`; restricting to command mode would be surprising.*

**Open questions:** none.

## Data fixtures

No new committed `vault/todos/*.md` fixtures. The Cucumber world's `Given("the vault contains tasks tagged {string}")` step constructs a transient fixture set in memory or on-disk per scenario (mirror of the pattern used by `vault-write-path`). The existing fixture set already has tasks with `#errands`, `#personal`, `#work`, `@mike` — those should be sufficient for the verify script's "real" tags. If a scenario requires a specific tag that's not present, the step writes a per-scenario file under `test/fixtures/vault/todos/` and the After hook cleans it up.
