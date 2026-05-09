---
slug: status-reconciliation
frozen: false
---

# Notes — Status reconciliation

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run a plan skill.

## Problems

(none yet)

## Verify findings

### Verify — status-reconciliation — 2026-05-09

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — zero errors / zero warnings |
| Type check (`npm run typecheck`) | PASS — exit 0 |
| Coverage (`npm run test:coverage`) | PASS — 98.49% stmts / 90.2% branches / 99.31% funcs / 99.52% lines (above 90% gate) |
| `npm test` (Mocha) | PASS — 221 passing, 0 failures, 0 skipped |
| Gherkin (`npm run test:bdd`) | PASS — 53/53 scenarios, 211/211 steps |
| `npm run verify` end-to-end | PASS — all earlier verify scripts still green; statusReconciliation.verify.ts passes |
| Screenshot: all-checked (struck title + count down) | PASS — title "status-recon" rendered with strikethrough; "8 tasks remaining" (down from 9) |
| Screenshot: after-uncheck (no strikethrough + count up) | PASS — title "status-recon" rendered without strikethrough; "9 tasks remaining" (up from 8) |
| Screenshot: add-subtask-to-done (no strikethrough) | PASS — after adding `draft outline` to a done simple task, title not struck and count rose to 9 |
| Screenshot: after-remove (struck title) | PASS — after removing the only unchecked subtask, title struck and count fell to 8 |
| Frontmatter write-back assertions in verify script | PASS — all four file assertions confirm `status: done`/`status: todo` per AC |

**AC matrix:**
- AC1 (check last unchecked → status:done): PASS — verify script confirmed frontmatter `status = "done"`; screenshot 1 shows title struck through.
- AC2 (uncheck from all-done → status:todo): PASS — verify script confirmed `status = "todo"`; screenshot 2 shows title not struck through.
- AC3 (add subtask to done simple → status:todo): PASS — verify script confirmed `status = "todo"`; screenshot 3 shows title not struck through with new subtask present.
- AC4 (remove only unchecked → status:done): PASS — verify script confirmed `status = "done"`; screenshot 4 shows title struck through.
- AC5 (count drops by 1 on auto-complete): PASS — count went 9 -> 8 in the verify script and is visible in screenshot 1.
- AC6 (count rises by 1 on auto-reopen): PASS — count went 8 -> 9 in the verify script and is visible in screenshot 2.

**Capture speed:** Verify script runs cleanly; the four screenshots are produced as part of the chained `npm run verify` script after the existing patterns.
**Find-next clarity:** The on-disk frontmatter and the rendered "N tasks remaining" line now agree with the rendered title strikethrough — a user no longer sees a struck title coexisting with `status: todo` (or vice versa).
**Nesting:** No new selectors or DOM contracts were introduced; the fix is purely data-layer (`reconcileStatus`/`setStatus` private helpers in `writeTodo.ts`).

**Overall:** All 6 acceptance criteria visually and programmatically confirmed. Status reconciliation is done.

## Background

This plan was triggered by an exploration walk that drove every parent/child
mutation through the live Electron app and captured screenshots + on-disk
state at each step. Three drift modes were observed:

1. **Done simple → add subtask** leaves `status: done` while the new body
   bullet is `[ ]` (the original deferred bug from `bug-fixes-1`).
2. **All-checked combined → uncheck one** leaves `status: done` while a body
   bullet is now `[ ]`.
3. **Combined → check the last unchecked subtask** leaves `status: todo`
   while every body bullet is `[x]`; the title strikes through (because
   `data-completed` is derived from "all subtasks done") but the
   remaining-count and any future archive-on-`status:done` flow disagree.

Evidence: `test/screenshots/parent-child-bug/` — 13 screenshots and
`report.json` from the walk. The exploration script lives at
`scratch/explore-parent-child.ts` (not committed; throwaway).

This plan **supersedes** the deferred "subtask-after-complete" item in
`features/bug-fixes-1/notes.md` under "## Deferred". The deferred item
covered only drift mode (1); this plan covers all three with one rule.
