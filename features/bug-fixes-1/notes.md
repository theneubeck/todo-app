---
slug: bug-fixes-1
frozen: false
---

# Notes — Bug fixes 1

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run a plan skill.

## Problems

(none yet)

## Verify findings

(filled by the Verify agent)

## Deferred

The "subtask-after-complete" bug from the original `fixes.md` brainstorm is **not** in scope of this plan. The expected behavior is genuinely ambiguous (see Q1 in the conversation that produced this plan):

- (a) Reset frontmatter `status` from `done` to `todo` when `addSubtask` is called on a done simple task.
- (b) Leave `status: done` alone; adjust only the UI to drop the strikethrough when subtasks exist.
- (c) Leave both as-is and treat the inconsistency as user-managed.

A separate plan should be drafted once the answer is decided.
