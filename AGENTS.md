# todoz vault

A personal productivity system. All data lives as markdown files with YAML frontmatter. This file defines the schema and conventions — read it before creating or modifying any files.

## Folder structure

```
vault/
  AGENTS.md
  todos/
  bookmarks/
  goals/
  notes/
  archive/
    todos/
    bookmarks/
    goals/
    notes/
```

The folder path is the source of truth for type and status. Active items live in the top-level type folder. Archived items live in the matching `archive/<type>/` folder. The structure is always mirrored.

## General conventions

- One concept per file
- Filenames are slugified titles with an ISO date suffix: `q3-strategy-2026-05-04.md`
- Never delete files — move to the matching `archive/<type>/` folder instead
- The `type` field in frontmatter is always redundant with the folder location. If they disagree, the folder wins
- Tags are lowercase, hyphenated: `read-later`, `q2`, `editorial`

## Links

Two types of links are used throughout the vault:

**Internal links** use wikilink syntax to reference other files in the vault:

```
[[filename-slug]]                   plain link
[[filename-slug|display text]]      aliased link
[[filename-slug#heading]]           link to a specific section
```

Use wikilinks freely in the body of any file to cross-reference tasks, goals, notes, and bookmarks. The `project:` frontmatter field is for structured queries; wikilinks in the body are the human-readable layer and can reference multiple files.

**External links** use standard markdown syntax:

```
[display text](https://example.com)
```

All URLs — web pages, Slack threads, Google Drive documents — are external links. Slack and Google Drive links are first-class: paste them directly into the body or as the `url:` field in a bookmark. A bookmark body may contain multiple related external links.

**Rules:**
- Never put raw URLs in the body without a markdown link wrapper
- Prefer descriptive display text over the raw URL: `[Q3 strategy doc](https://docs.google.com/...)` not just the URL
- Wikilinks resolve relative to the vault root — use the filename slug only, no path or extension

---

## Schemas

### todos/

Tasks with optional nesting. Nested tasks are markdown checkboxes indented in the body.

```yaml
---
type: task
title: "Short description"
status: todo | doing | done
due: 2026-05-10        # ISO date, optional
tags: [work, q2]
project: project-slug  # optional, links to a goal or note
created: 2026-05-04
---
- [ ] Top level task
  - [ ] Nested subtask
  - [ ] Another subtask
    - [ ] Deeply nested
```

**Rules:**
- `status: done` items can stay in `todos/` until end of week, then archive
- Use `project:` to link a task to a goal by filename slug
- Due dates on subtasks are not supported — put them on the parent

---

### bookmarks/

Saved links from any source. The highlight is a verbatim excerpt from the source.

```yaml
---
type: bookmark
title: "Page or thread title"
url: https://example.com
source: web | slack | gdrive
highlight: "The exact text you selected when saving"  # optional
tags: [read-later, ai, design]
created: 2026-05-04
---
Optional personal notes about why this was saved or what to do with it.
```

**Rules:**
- `source: slack` links point to a Slack message or thread URL
- `source: gdrive` links point to a Google Drive document URL
- `highlight` should be a verbatim quote, not a paraphrase
- Use `tags: [read-later]` for things not yet read; remove the tag once read

---

### goals/

Long-horizon goals with a defined time span. Milestones are listed in the body.

```yaml
---
type: goal
title: "Goal description"
start: 2026-01-01
end: 2026-12-31
status: active | done | paused
tags: [career, personal]
created: 2026-05-04
---
Description of the goal and what success looks like.

## Milestones

- [ ] 2026-03-01 — First milestone description
- [ ] 2026-06-01 — Second milestone description
```

**Rules:**
- Milestones are checkboxes with an ISO date prefix in the body
- Link related tasks using `project: goal-slug` in the task frontmatter
- A goal is archived when `status: done` and all milestones are checked

---

### notes/

Free-form notes. No required fields beyond type and title.

```yaml
---
type: note
title: "Note title"
tags: [meeting, editorial]
created: 2026-05-04
---
Free markdown content.
```

---

## AI agent instructions

When operating on this vault:

1. **Read this file first** before creating or modifying anything
2. **Never delete** — use `mv <file> archive/<type>/<file>` to archive
3. **Infer type from folder**, not from frontmatter
4. **Filename convention** — slugify the title, append the date: `my-task-title-2026-05-04.md`
5. **Breaking down goals into tasks** — create individual files in `todos/` with `project:` set to the goal's filename slug
6. **Semantic search** — embeddings and full-text search operate across all non-archive folders by default; include `archive/` only when explicitly asked
7. **When in doubt about type**, default to `notes/`
