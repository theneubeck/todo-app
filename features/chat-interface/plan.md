---
name: Chat interface
slug: chat-interface
status: planned
frozen: true
created: 2026-05-11
---

# Chat interface

## Pattern summary

The command bar at the bottom of the app is the unified input for both chat and slash commands. By default it is in chat mode: the user types a message and presses Enter to send; Ollama is never called until Enter is pressed. The message is sent via `window.todoz.runOllama()` and the reply appears in a thread above. If the user begins their input with `/`, the bar switches to command mode — the existing `/add` handler fires on Enter, and future slash commands will be routed the same way. The mode is detected live on each keystroke so the hint text updates, but no side effects (no Ollama call, no file write) occur until Enter.

The chat thread is visible when the Chat sidebar entry is active. Activating Chat hides the task list and shows the thread instead. Each exchange is a pair of bubbles: a right-aligned user bubble and a left-aligned assistant bubble. While Ollama is responding, a pending bubble with a `data-pending` attribute takes the assistant's place. The thread is session-only — no persistence between app restarts is in scope for this feature.

The system prompt for Ollama is read from a file in the project root — currently `AGENTS.md` in `main.ts`, but since the vault is now a user-selected folder (not co-located with the project), the vault no longer contains this file. The correct source is a project-root file, renamed to `VAULT.md`, describing the vault schema. The `run-ollama` IPC handler reads `VAULT.md` from the project root (falling back to empty string if absent). No vault path is involved. This requires a one-line change to `main.ts` (`AGENTS.md` → `VAULT.md`) and renaming the file on disk — both are in scope for this feature's Implement phase.

In scope: activating the chat view via the sidebar, sending a message and receiving a reply, the pending state, mode detection on the command bar, routing `/add` to the existing handler from within the chat view, renaming `AGENTS.md` → `VAULT.md` and updating the `run-ollama` handler. Out of scope: streaming responses, markdown rendering, persisting chat history, tool calling.

## Acceptance criteria

1. Given the user clicks the Chat sidebar entry, when the view activates, then the task list is hidden and the chat thread container is visible.
2. Given the chat view is active and the command bar is empty, when the user types a message without a leading `/` and presses Enter, then a user bubble containing the message text appears in the thread and a pending assistant bubble appears below it.
3. Given a pending assistant bubble is shown, when Ollama responds, then the pending bubble is replaced by an assistant bubble containing the response text.
4. Given the task list is the active view, when the user types a chat message in the command bar and presses Enter, then the chat view activates and the thread is visible with the user bubble and pending bubble already present.
5. Given the command bar value does not start with `/`, when the user types, then `data-command-mode="chat"` is set on the command bar element.
6. Given the command bar value starts with `/`, when the user types, then `data-command-mode="command"` is set on the command bar element.
7. Given the chat view is active and the command bar reads `/add buy milk`, when the user presses Enter, then no Ollama call is made and the task handler runs instead.

## Step-definition file

`test/step_defs/chat-interface.steps.ts` — steps:

- `Given("the chat view is active")` (NEW) — mounts the app via `mountApp(this.document.body)` against the standard fixture set, then clicks `[data-sidebar-entry="chat"]` and waits for `[data-chat-view]` to be present.
- `Given("the command bar reads {string}")` (REUSED — defined in `add-task.steps.ts`)
- `When("the user types {string} in the command bar and presses Enter")` (NEW) — sets `[data-command-bar] input[type="text"]` value to the string, fires an `input` event (triggers mode detection), then fires a `keydown` with `key: "Enter"`.
- `When("the user types {string} in the command bar")` (NEW) — sets the input value and fires an `input` event only; does not press Enter.
- `When("the user clicks the {string} sidebar entry")` (REUSED — defined in `add-task.steps.ts`)
- `When("Ollama responds with {string}")` (NEW) — resolves the pending `runOllama` mock promise with the given string. The world holds the mock's resolve handle so this step can call it.
- `Then("the task list is hidden")` (NEW) — asserts `[data-task-list]` is absent or has `display: none` / `hidden` attribute.
- `Then("the chat thread is visible")` (NEW) — asserts `[data-chat-view]` exists in the document.
- `Then("a user bubble appears with text {string}")` (NEW) — asserts a `[data-message="user"]` element whose `[data-message-text]` text content equals the string.
- `Then("a pending assistant bubble appears")` (NEW) — asserts `[data-message="assistant"][data-pending]` exists.
- `Then("the assistant bubble contains {string}")` (NEW) — asserts a `[data-message="assistant"]:not([data-pending])` element whose `[data-message-text]` text equals the string.
- `Then("the command bar is in chat mode")` (NEW) — asserts `[data-command-bar][data-command-mode="chat"]` exists.
- `Then("the command bar is in command mode")` (NEW) — asserts `[data-command-bar][data-command-mode="command"]` exists.
- `Then("the chat view activates automatically")` (NEW) — asserts `[data-chat-view]` is present and `[data-task-card]` is hidden, without the user having clicked the Chat sidebar entry.
- `Then("no Ollama call was made")` (NEW) — asserts `this.ollamaCallCount === 0`. The world tracks this via the `runOllama` mock.
- `Then("the add-task handler runs")` (NEW) — asserts `this.lastWriteFilePath` is set (the add handler calls `window.todoz.writeFile`).

## BDD test list

[file: test/view/chatInterface.spec.ts]
- describe("ChatInterface") > it("shows the chat thread when the Chat sidebar entry is clicked")
- describe("ChatInterface") > it("hides the task list when the Chat sidebar entry is clicked")
- describe("ChatInterface") > it("appends a user bubble when a non-slash message is submitted")
- describe("ChatInterface") > it("clears the command bar input after a chat message is submitted")
- describe("ChatInterface") > it("shows a pending assistant bubble while waiting for Ollama")
- describe("ChatInterface") > it("replaces the pending bubble with the assistant reply when Ollama responds")
- describe("ChatInterface") > it("activates the chat view when a message is sent from the task list view")
- describe("ChatInterface") > it("shows the user bubble in the thread when auto-activating from task list view")
- describe("ChatInterface") > it("sets data-command-mode=chat when the input does not start with /")
- describe("ChatInterface") > it("sets data-command-mode=command when the input starts with /")
- describe("ChatInterface") > it("switches back to chat mode when the leading / is deleted")
- describe("ChatInterface") > it("does not call runOllama when the input starts with /")
- describe("ChatInterface") > it("routes a /add command to the add-task handler from within chat view")

## Concrete DOM contract

New attributes for this feature are marked `(NEW)`; reused attributes from existing features are marked `(REUSED)`.

```
[data-command-bar][data-command-mode="chat"|"command"]   (EXTEND — add data-command-mode attr)
  input[type="text"]                                     (REUSED — mode detection fires on every `input` event)
  [data-shortcut-hint]                                   (REUSED — text: "Enter to send" in chat mode,
                                                                    "Enter to run" in command mode)

[data-sidebar-entry="chat"]                              (REUSED — already rendered, was inert; now activates chat view)
  [data-nav-active]                                      (REUSED — set when Chat is the active view)

[data-chat-view]                                         (NEW — replaces [data-task-card] in the main area
                                                                when Chat is active; absent otherwise)
  [data-chat-thread]                                     (NEW — scrollable container for message history)
    [data-message="user"]                                (NEW — one per user turn)
      [data-message-text]                                (NEW — the user's message text)
    [data-message="assistant"]                           (NEW — one per assistant turn)
    [data-message="assistant"][data-pending]             (NEW — present while awaiting Ollama; no [data-message-text])
      [data-message-text]                                (NEW — present only after response arrives; absent on pending)

[data-task-card]                                         (REUSED — existing task list container;
                                                                hidden (display:none or removed) when chat view is active)
```

Notes for Implement:

- **Mode detection (input event only — no side effects):** on every `input` event, read `input.value`. If it starts with `/`, set `data-command-mode="command"` on `[data-command-bar]` and hint text to `"Enter to run"`. Otherwise set `data-command-mode="chat"` and hint text to `"Enter to send"`. Initial state (empty input) is `"chat"`. Mode detection never calls `runOllama`, never writes files, never does anything other than update the attribute and hint.
- **On Enter in chat mode:** (1) read and trim the input value; (2) if empty, do nothing; (3) if the chat view is not already active, activate it (same logic as clicking the Chat sidebar entry — hide `[data-task-card]`, show `[data-chat-view]`, set `[data-nav-active]` on `[data-sidebar-entry="chat"]`); (4) append a `[data-message="user"]` bubble; (5) clear the input; (6) append `[data-message="assistant"][data-pending]`; (7) **only now** call `window.todoz.runOllama(text)` and `.then(reply => ...)` to remove `[data-pending]` and set `[data-message-text]` content. `runOllama` is called exactly once per Enter press, never on keystrokes.
- **On Enter in command mode:** delegate to the existing Enter handler in `index.ts` (the add-task router). The chat view does not re-implement slash-command routing — it only ensures the Enter key path reads `data-command-mode` and branches accordingly.
- **Activating Chat:** set `[data-nav-active]` on `[data-sidebar-entry="chat"]`, remove it from all others. Set `display: none` (or remove from DOM) on `[data-task-card]`. Append or show `[data-chat-view]`.
- **Ollama mock in tests:** `window.todoz.runOllama` must be a mock that returns a `Promise` whose resolve handle is stored on the world (`this.resolveOllama`). Tests assert the pending state before calling `this.resolveOllama("reply text")`, then assert the resolved state. `this.ollamaCallCount` increments on each call so tests can assert no call was made in command mode.
- **VAULT.md:** `main.ts` currently reads `AGENTS.md` from the project root as the Ollama system prompt. Rename that file to `VAULT.md` and update the one `fs.existsSync` / `fs.readFileSync` reference in the `run-ollama` handler. The vault folder (user-selected, anywhere on disk) does not contain this file — it is a project concern, not a vault concern.

## File map

```
RENAME  AGENTS.md → VAULT.md            — project-root system prompt for Ollama;
                                          vault no longer contains this file since vault
                                          is a user-selected folder anywhere on disk.

EXTEND  src/main.ts                     — update run-ollama handler: replace AGENTS.md
                                          with VAULT.md in the fs.existsSync /
                                          fs.readFileSync call. One line change.

EXTEND  src/renderer/index.ts           — add chat view mount/unmount, extend sidebar click
                                          handler for Chat entry, add mode detection on input
                                          event (attribute + hint only, no Ollama call),
                                          branch Enter handler on data-command-mode,
                                          add renderChatView / appendMessage helpers,
                                          update shortcut hint text per mode.

NEW     test/view/chatInterface.spec.ts — Tallahassee DOM specs per BDD test list
NEW     test/step_defs/chat-interface.steps.ts — Cucumber steps per step-definition file
NEW     test/features/chat-interface.feature   — Gherkin scenarios (frozen)
```

No new IPC handlers beyond the one-line `main.ts` change. No new data modules. No changes to `src/preload.ts`.

## Data fixtures

No new fixture files required. The standard five-fixture set (defined in `test/step_defs/todoList.steps.ts`) is sufficient for the `/add` routing test (criterion 6). The chat thread itself is populated by the `runOllama` mock — no vault files needed.

## Trace table

| Criterion | Scenario | Tests |
|---|---|---|
| 1. Chat entry activates view | "clicking Chat shows the chat thread" | `chatInterface.spec.ts` > "shows the chat thread when the Chat sidebar entry is clicked", "hides the task list when the Chat sidebar entry is clicked" |
| 2. Non-slash message creates user bubble + pending | "sending a message shows user and pending bubbles" | `chatInterface.spec.ts` > "appends a user bubble…", "clears the command bar…", "shows a pending assistant bubble…" |
| 3. Pending replaced by reply | "Ollama reply replaces the pending bubble" | `chatInterface.spec.ts` > "replaces the pending bubble with the assistant reply when Ollama responds" |
| 4. Sending from task list auto-activates chat view | "sending a message from task list activates chat view" | `chatInterface.spec.ts` > "activates the chat view when a message is sent from the task list view", "shows the user bubble in the thread when auto-activating from task list view" |
| 5. No-slash → chat mode | "typing without / sets chat mode" | `chatInterface.spec.ts` > "sets data-command-mode=chat…", "switches back to chat mode when the leading / is deleted" |
| 6. Slash → command mode | "typing / sets command mode" | `chatInterface.spec.ts` > "sets data-command-mode=command when the input starts with /" |
| 7. /add routes to handler, not Ollama | "/add from chat view runs the task handler" | `chatInterface.spec.ts` > "does not call runOllama when the input starts with /", "routes a /add command to the add-task handler from within chat view" |

## Test-tree audit

**Reusable (do not redefine):**
- `test/step_defs/world.ts` — `TodozWorld` with `lastWriteFilePath`, `fixtures`, `document`. **Extend** with `ollamaCallCount: number` (increments each time `runOllama` mock is called) and `resolveOllama: ((text: string) => void) | null` (holds the pending promise's resolve handle, set when `runOllama` is called, nulled after resolution). The `runOllama` mock itself must be wired in the world's setup so every spec and step gets the same controlled mock without re-implementing it.
- `test/step_defs/add-task.steps.ts` — `Given("the command bar reads {string}")`, `When("the user clicks the {string} sidebar entry")`.
- `test/step_defs/todoList.steps.ts` — `Given("the vault contains the standard fixture todos")`.

**To add:**
- `test/view/chatInterface.spec.ts` (NEW)
- `test/step_defs/chat-interface.steps.ts` (NEW)
- `test/features/chat-interface.feature` (NEW — frozen)
- `src/renderer/index.ts` (EXTEND)

**Gaps:** None. No new IPC, no new parse modules, no new fixtures.

## Gate check

- [x] Every acceptance criterion has exactly one Gherkin scenario (7 → 7)
- [x] Every Gherkin step listed with NEW / REUSED designation
- [x] Every Tallahassee test traces to a criterion via the trace table
- [x] No test or scenario name contains "and"
- [x] Layer order: Gherkin → Tallahassee → data
- [x] No new fixture files needed; standard set reused
- [x] Zero lines of TypeScript or JavaScript written by the Plan agent
- [x] Out-of-scope items (streaming, persistence, markdown render) have no criteria, scenarios, or tests

---

Plan complete. Ready for Implement.
