# todoz

A keyboard-first desktop TODO app built on Electron. Tasks live as plain Markdown files in a vault folder — the same format Obsidian uses — so your data is always yours.

## Features

- **Nested tasks** — subtasks as Markdown checkboxes inside each file
- **Tag-based organisation** — `#project` and `@person` tags drive the sidebar
- **Vault picker** — switch between multiple vaults, just like Obsidian workspaces
- **Command bar** — type `/add Buy milk #errands @mike` or just hit `cmd+i` to prepend `/add`
- **Go-to navigation** — `cmd+t` opens the command bar prefilled with `/goto`; type a tag or name and press Enter
- **Tag autocomplete** — `#` and `@` open a fuzzy-search dropdown; inside `/goto` it shows all tags immediately
- **Ollama chat** — sidebar Chat view sends messages to a local Ollama model; the model can create tasks via tool calls
- **Status reconciliation** — parent task status stays in sync with its subtasks automatically

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `cmd+i` | Prepend `/add` to the command bar |
| `cmd+t` | Prepend `/goto` to the command bar |
| `↑` / `↓` | Navigate autocomplete suggestions |
| `Tab` | Accept the highlighted suggestion |
| `Esc` | Close the autocomplete dropdown |
| `Enter` | Submit the command or send a chat message |

## Command bar

| Command | Effect |
|---|---|
| `/add <title> [#tag] [@person]` | Create a new task |
| `/goto inbox` | Switch to Inbox |
| `/goto #<tag>` | Filter by project tag |
| `/goto @<person>` | Filter by person tag |
| `/goto chat` | Switch to the Chat view |

## Vault format

Tasks are Markdown files in a `todos/` folder inside the vault:

```
vault/
  todos/
    buy-milk-2026-05-08.md
    q3-strategy-2026-05-04.md
```

Each file has YAML frontmatter:

```yaml
---
type: task
title: "Buy milk"
status: todo
tags: [errands, @mike]
created: 2026-05-08
---
- [ ] Skimmed
- [ ] Oat
```

See `vault/AGENTS.md` for the full schema.

## Ollama integration

The Chat view talks to a local Ollama instance over HTTP (`http://127.0.0.1:11434`). The default model is `gemma4:e2b`. Override either with environment variables:

```
OLLAMA_API_URL=http://127.0.0.1:11434/v1/chat/completions
OLLAMA_MODEL=llama3.2
```

To run without chat:

```
DISABLE_CHAT=1 npm start
```

## Getting started

```bash
npm install
npm start
```

To package a macOS DMG:

```bash
npm run package
```

## Development

```bash
npm test                # Mocha + Tallahassee unit tests
npm run test:bdd        # Cucumber acceptance tests
npm run verify:static   # Lint + typecheck + coverage (≥90%)
npm run verify          # Full suite including Playwright E2E
```

The stack is Electron + vanilla TypeScript + DOM. No UI framework. See `CLAUDE.md` for the full development workflow.
