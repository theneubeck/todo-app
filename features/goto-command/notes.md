---
slug: goto-command
frozen: false
---

# Notes — Go to destination command

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run a plan skill.

## Problems

(none yet)

## Verify findings

### Verify — goto-command — 2026-05-17

| Check | Result |
|---|---|
| Lint (`npm run lint`) | ✅ 0 errors, 0 warnings |
| Type check (`npm run typecheck`) | ✅ exits 0 |
| Coverage (`npm run test:coverage`) | ✅ 97.66% stmts / 90.66% branches / 98.97% funcs / 99.17% lines — all above 90% |
| `npm test` | ✅ 370 passing, 0 failures |
| Gherkin (`npm run test:bdd`) | ✅ 87 scenarios passing (all 6 goto-command scenarios green) |
| Screenshot: AC1 `/goto inbox` → Inbox header + cleared input | ✅ `[data-main-header] h1` shows "Inbox"; command bar is empty |
| Screenshot: AC2 `/goto #errands` → `#errands` header + cleared input | ✅ `[data-main-header] h1` shows "#errands"; command bar is empty; `#errands` sidebar entry highlighted |
| Screenshot: AC3 `/goto @mike` → `@mike` header + cleared input | ✅ `[data-main-header] h1` shows "@mike"; command bar is empty; `@mike` sidebar entry highlighted |
| Screenshot: AC4 `/goto chat` → chat view active | ✅ `[data-chat-view]` present in DOM (count=1); Chat sidebar entry highlighted |
| Screenshot: AC5 `cmd+t` → input focused, value starts with `/goto ` | ✅ Command bar shows "/goto " prefix; main view still shows Inbox |
| Screenshot: AC6 `/goto zzz` → no navigation, input preserved | ✅ Header still "Inbox"; command bar retains "/goto zzz" |
| Toggle write-back | N/A — goto-command is navigation-only, no file mutations |

**Overall**: All 6 acceptance criteria satisfied — `/goto` navigation, `cmd+t` pre-fill, and no-op behaviour all work correctly in the real Electron window.
