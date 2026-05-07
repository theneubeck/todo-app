# todoz — implementation plan

Personal productivity system built on markdown files, synced via Google Drive, with a Tauri desktop UI and an AI layer via Ollama.

---

## Stack

| Concern | Choice |
|---|---|
| Desktop UI | Tauri + React |
| Editor | CodeMirror 6 |
| Data format | Markdown + YAML frontmatter |
| Sync | Google Drive (system-level) |
| AI reasoning | Ollama (`gemma4:e2b`) |
| AI embeddings | Transformers.js (`nomic-embed-text`) |
| Browser capture | Chrome extension (Manifest V3) |

Schema and AI conventions are defined in `AGENTS.md`.

---

## Phase 1 — Foundation

Goal: working Tauri app that reads real files and renders the Tasks view.

- [ ] Scaffold Tauri + React project
- [ ] Configure Tauri fs permissions for vault folder
- [ ] Parse markdown + YAML frontmatter (`gray-matter`)
- [ ] Watch vault folder for changes (Tauri fs watch)
- [ ] Render Tasks view — read `todos/`, display nested checkboxes
- [ ] Toggle task status — check/uncheck writes back to file
- [ ] Filter by tag

**Deliverable**: you can see and check off todos in the app.

---

## Phase 2 — Core views

- [ ] Bookmarks view — read `bookmarks/`, display with tag filters and source badges (web / slack / gdrive)
- [ ] Goals view — read `goals/`, render CSS Gantt from `start`/`end` frontmatter dates
- [ ] Deadlines view — cross-folder query for files with a `due:` field, grouped by urgency
- [ ] Sidebar navigation between views
- [ ] Full-text search (FlexSearch across all non-archive folders)

**Deliverable**: all four views working with real data.

---

## Phase 3 — Editor

- [ ] Integrate CodeMirror 6 as the file editor
- [ ] Open any file from any view
- [ ] YAML frontmatter syntax highlighting
- [ ] Wikilink autocomplete — `[[` triggers filename suggestions from vault
- [ ] External link handling — `[text](url)` opens in default browser
- [ ] Save on blur / ⌘S

**Deliverable**: read and edit files without leaving the app.

---

## Phase 4 — AI layer

The CLI script is already prototyped (`todoz.mjs`). This phase integrates it properly.

- [ ] Config file (`config.yaml`) — Ollama endpoint, model, vault path
- [ ] Formalise CLI tool (`todoz`) — wraps Ollama with AGENTS.md as system prompt and `write_file` tool
- [ ] Semantic search — generate embeddings with Transformers.js, store as `.embeddings/` JSON sidecars, query on search input
- [ ] Embedding refresh — re-embed on file change via fs watcher
- [ ] Quick AI command in UI — ⌘K → natural language input → executes via Ollama tool calling, results appear in view

**Deliverable**: `todoz "break down my Q3 goal into tasks"` writes real files. Semantic search works in app.

---

## Phase 5 — Browser extension

- [ ] Chrome extension scaffold (Manifest V3)
- [ ] Capture current tab — title, URL, selected highlight text
- [ ] Write to `bookmarks/` via local HTTP endpoint exposed by Tauri app
- [ ] Tag picker in extension popup
- [ ] Auto-suggest tags using Chrome's built-in AI (Gemini Nano) from page content

**Deliverable**: one-click bookmark capture from browser with auto-tagging.

---

## Phase 6 — Polish

- [ ] Keyboard navigation throughout all views
- [ ] Quick capture modal — ⌘N → pick type (task / bookmark / goal) → fill fields → writes file
- [ ] Archive action from any view — moves file to `archive/<type>/`
- [ ] Dark mode
- [ ] Wikilink graph view (stretch goal)

---

## Key files

Two separate locations:

**Project repo** (`todoz/`) — code, never synced as data:
```
PLAN.md              this file
todoz.mjs            CLI AI script
config.yaml          AI provider, model, vault path
src/                 Tauri app source
```

**Vault** (`vault/`) — data only, synced via Google Drive:
```
todos/
bookmarks/
goals/
notes/
archive/
  todos/
  bookmarks/
  goals/
  notes/
.embeddings/         semantic search sidecars (excluded from Google Drive sync)
```

The app reads `vault_path` from `config.yaml` to locate the vault at runtime.

---

## Open questions

- **Embedding refresh**: re-embed on every file save via watcher, or batch on startup?
- **Wikilink resolution**: resolve from vault root, no path or extension required
- **Multi-vault**: not in scope for v1
- **Mobile**: not in scope for v1
