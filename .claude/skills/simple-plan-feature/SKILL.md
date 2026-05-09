---
name: simple-plan-feature
description: Reasoning-driven planner for new UI patterns / features. Reads the user's request and the repo, decides every open question without interviewing, writes frozen plan artifacts to features/<slug>/, surfaces conflicts and decisions for review, then commits the plan. Writes no implementation code. Use when starting a new feature where you trust the model to reason rather than walk a five-section interview.
---

# Simple-plan-feature skill

You are now planning a new feature. Produce a written, **frozen** plan that the Implement and Verify agents execute without ambiguity. Write planning artifacts to disk; write no implementation code.

This skill is the non-interview cousin of `plan-feature`. **You do not ask the user questions section by section.** Instead, you:

1. Read the user's request and the repo.
2. Reason out every open question yourself, deciding from known constraints.
3. Write the artifacts on disk.
4. Surface a **Conflicts & Decisions** review block at the end — call out anywhere your plan contradicts something already locked in, and anywhere you made a non-obvious judgment call.
5. Commit the planning artifacts — but only if no genuine conflict needs the user's input first.

The plan defines work in three nested layers, outside-in:

```
Gherkin .feature scenarios       ← outermost, user-language acceptance
  Tallahassee DOM specs          ← component-level
    parseTodo / writeTodo specs  ← unit
```

Every Gherkin scenario must trace to one acceptance criterion. Every Tallahassee/unit test must trace to one Gherkin step or to behavior that step depends on.

---

## Before you start

Read these files in full before doing anything else:

1. `CLAUDE.md` — hard rules, dos, don'ts (authoritative on conflict)
2. `DESIGN.md` — visual tokens (typography, color, spacing, radius)
3. `vault/AGENTS.md` — vault schema, so any fixture files match
4. Any reference assets in `features/<slug>/` if the feature directory already exists (mockups, HTML, screenshots) — read them as if they were the spec
5. Existing frozen plans under `features/*/plan.md` for stylistic alignment and to avoid contradicting prior decisions
6. Existing step definitions under `test/step_defs/*.steps.ts` so you can reuse phrasing rather than redefine

If a feature with the slug you are about to write already exists and is `frozen: true`, do not silently overwrite it. Pick a different slug, or surface this in the Conflicts review block and stop without committing.

`TECH-POC.md` and a root-level `AGENTS.md` are referenced by older docs but no longer exist — do not block on them.

---

## How the reasoning works

You receive a single request from the user. It may be:

- A short name + sketch ("nested tag tree in the sidebar — sticky header, collapsible groups")
- A pointer at a reference asset ("plan the picker the way the HTML in `features/foo/mock.html` shows it")
- A whole paragraph of intent
- Just a slug and a one-liner

**Do not ask follow-up questions to fill gaps.** Reason about the best path forward, decide, and proceed. Apply this hierarchy of constraints when filling a gap:

1. What CLAUDE.md / DESIGN.md / vault/AGENTS.md already say about it — these are authoritative.
2. What existing frozen plans in `features/*/plan.md` already established — match the style and decisions, don't contradict them.
3. What the user's request directly implies (terminology, in-scope items they named, references they pointed at).
4. What is the smallest thing that satisfies the request and is testable.

When two reasonable paths exist, pick the one that:
- Fits an existing pattern in the codebase
- Is visually simpler / has fewer moving parts
- Keeps the feature self-contained (no edits to unrelated files)

Record every non-obvious judgment call so you can surface it in the Conflicts & Decisions block at the end.

**Persist state across turns.** If the user later corrects a decision or adds context, update the artifacts in place. Treat any locked decision from earlier in the conversation as authoritative for later turns.

---

## What to produce (in artifact order)

You are producing the same shape of artifacts as `plan-feature`. The sections below describe the *content* you must derive — no interview, no waiting.

### Identity

- **Name** — one short phrase. Use the user's terminology.
- **Slug** — kebab-case, derived from the name. The slug becomes `features/<slug>/` and `test/features/<slug>.feature`.

### Pattern summary

One paragraph describing what the pattern looks like and how a user interacts with it. Name the specific UI elements: sidebar, columns, checkboxes, badges, groupings. Concrete enough that a screenshot can be evaluated against it.

If the user pointed at a mockup or HTML reference, read it and synthesize the paragraph from the asset.

State **in scope** and **out of scope** explicitly. Decide aggressively — if a sub-feature would significantly expand the plan, mark it out of scope by default and note it in Decisions.

### Acceptance criteria

A numbered list, 4–8 entries, each in the form *Given [state], when [action], then [observable result].* Every criterion must be visually verifiable from a screenshot taken in the real Electron window.

Drive these out by asking yourself:
- What should the user see first when the pattern loads?
- What changes when the user clicks each interactive element?
- What is the empty state?
- What is the error / missing-data state?
- What persists across reloads?

Respect the in-scope/out-of-scope split — don't write criteria for stubbed elements.

### Gherkin scenarios

The outermost test layer. One scenario per acceptance criterion, no exceptions. Format the feature block exactly as it should land on disk:

```gherkin
Feature: <Pattern name>

  Scenario: <one observable behavior>
    Given <state>
    When <action>
    Then <observable result>
```

Rules:
- One scenario per acceptance criterion.
- No "and" in scenario names. (Steps may use `And`; only the scenario *name* must be a single behavior.)
- `Given` describes vault/fixture state. `When` describes a user action or app load. `Then` describes a DOM/file-on-disk observation.
- Reuse step phrasing across scenarios so step defs stay deduplicated.
- Reuse step phrasing from existing `test/step_defs/*.steps.ts` files where the wording fits — Cucumber loads steps globally, so a step defined in `add-task.steps.ts` is available here too.

List the step-definition file the Implement agent will create or extend, with a per-step note marking each step as `(NEW)` or `(REUSE — defined in <file>)`.

### BDD test list

A list of Mocha test descriptions — one per behavior — for the Tallahassee (DOM) and unit layers.

```
[file: test/patterns/<slug>.spec.ts]
- describe("<PatternName>") > it("<behavior>")

[file: test/data/<module>.spec.ts]   ← only if new data behavior is needed
- describe("<module>") > it("<behavior>")
```

Rules:
- Tallahassee tests first, data tests after.
- No "and" in test names.
- Every test traces to a Gherkin step or to behavior a step depends on.
- Do not duplicate tests that the Gherkin scenario already covers end-to-end — the Tallahassee spec is for component-level mocked-IPC coverage; the Gherkin spec is for end-to-end against real boot.

### Data fixtures

A list of files to create. For todo-related features this is `.md` files in `test/fixtures/vault/todos/` matching the `vault/AGENTS.md` schema exactly. For non-todo features (settings, picker windows, schema-less folders) state explicitly that no `vault/todos` fixtures are needed and describe whatever fixtures *are* needed (e.g., empty alt-vault folders, JSON config files written at runtime, etc.).

Skip files that already exist on disk and match the schema. For files that exist with different content, do not overwrite — surface the conflict in the Conflicts & Decisions block.

### File map

Add a `## File map` section to the plan listing:

- **New files** — every source/test file Implement will create.
- **Files to update** — every existing file Implement will modify, with a one-line description of the change.
- **DOM contract** — the authoritative `data-*` selectors tests will query against. Implement and Verify both rely on this contract.
- **Visual treatment** — concrete tokens from `DESIGN.md` (colors, spacing, radius, typography) for each major element.

The file map is what makes a "simple" plan executable without an interview — Implement should not have to guess where things go.

---

## Gate check before writing

Before saving anything, confirm in your head:

- [ ] Every acceptance criterion has exactly one Gherkin scenario
- [ ] Every Gherkin step has a step definition listed (or is marked as REUSE with the source file named)
- [ ] Every Tallahassee/unit test traces to a Gherkin step or step dependency
- [ ] No scenario name and no test name contains "and"
- [ ] Layer order is respected: Gherkin first, Tallahassee second, data last
- [ ] Every fixture file uses the correct schema from `vault/AGENTS.md` (or is documented as a non-vault fixture)
- [ ] You have written zero lines of TypeScript or JavaScript
- [ ] In-scope/out-of-scope split is consistent — no out-of-scope criteria, scenarios, or tests crept in
- [ ] No selector or file path in the File map contradicts an existing frozen plan or existing source file in a way that would break it

If any item fails, fix it before writing files.

---

## Writing the artifacts

Write these files **in this order**. Use the `Write` tool, not Bash heredocs.

### 1. `features/<slug>/plan.md`

Frontmatter marks the file as frozen. Implement and Verify will refuse to edit it.

```markdown
---
name: <Pattern name>
slug: <slug>
status: planned
frozen: true
created: <YYYY-MM-DD>
---

# <Pattern name>

## Pattern summary

<paragraph>

**In scope:** …
**Out of scope:** …

## Acceptance criteria

1. Given …, when …, then …
2. …

## Step-definition file

`test/step_defs/<slug>.steps.ts` — steps:

**Given:**
- `Given(…)` (NEW | REUSE — `<file>`)

**When:**
- `When(…)` (NEW | REUSE — `<file>`)

**Then:**
- `Then(…)` (NEW | REUSE — `<file>`)

## BDD test list

[file: test/patterns/<slug>.spec.ts]
- `describe("<PatternName>")` > `it("<behavior>")`

[file: test/data/<module>.spec.ts]
- `describe("<module>")` > `it("<behavior>")`

## File map

### New files
- …

### Files to update
- …

### DOM contract
- …

### Visual treatment
- …

## Data fixtures

- …
```

### 2. `test/features/<slug>.feature`

The Gherkin block, exactly. **Lives at `test/features/<slug>.feature`**, not under `features/<slug>/` — Cucumber loads from `test/features/**/*.feature`. This is part of the frozen contract.

### 3. `features/<slug>/notes.md`

The mutable scratchpad Implement and Verify use to flag problems with the plan. Seed it with the template:

```markdown
---
slug: <slug>
frozen: false
---

# Notes — <Pattern name>

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run a plan skill.

## Problems

(none yet)

## Verify findings

(filled by the Verify agent)
```

### 4. Fixture files

Write each fixture file referenced in the Data fixtures section. Skip files that already exist on disk and match the schema; for files that exist with different content, do **not** overwrite — surface the collision in the Conflicts & Decisions block and stop without committing.

---

## Conflicts & Decisions review block

After all artifacts are written, output a single review block with three sub-sections:

```markdown
## Conflicts & Decisions

### Conflicts (must resolve before commit)

- <a place where the user's request, or the artifacts derived from it, contradicts CLAUDE.md, DESIGN.md, vault/AGENTS.md, an existing frozen plan, or an existing source file in a way that cannot be silently absorbed>
- <a fixture path that already exists on disk with different content>
- <a slug that already exists frozen>

(none) — if there are no conflicts.

### Decisions (judgment calls worth flagging)

- <a place where multiple reasonable paths existed; state the call and the one-line reason>
- …

### Open questions (only if a decision is genuinely undecidable)

- <something the user must answer before this plan can ship>

(none) — if there are no open questions.
```

Be honest in this block. If you guessed and the guess might be wrong, list it under Decisions. If you can't decide without input, list it under Open questions and **do not commit**.

---

## Commit on green review

If the review block has **zero Conflicts** and **zero Open questions**, commit the planning artifacts.

If there are Conflicts or Open questions, **do not commit**. Output the review block and stop, declaring:

> **Plan drafted — review before commit.**
>
> Resolve the items in **Conflicts & Decisions** (above) and tell me how to proceed. I will not commit until they are addressed.

### Staging

Stage planning paths explicitly. Never `git add -A`.

```bash
git add features/<slug>/ test/features/<slug>.feature test/fixtures/<...paths from Data fixtures...>
```

If the Data fixtures section listed no fixture files, omit that path from the `git add` invocation.

### Commit message

Match the existing repo style — short imperative subject, optional body. Run `git log --oneline -10` to confirm the convention. The expected shape:

```
Plan <slug> feature

<2–3 line summary distilled from the Pattern summary>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Use a HEREDOC for multi-line commit messages:

```bash
git commit -m "$(cat <<'EOF'
Plan <slug> feature

<body>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Safety rules

- Never `--amend` — always create a new commit.
- Never `--no-verify`.
- Never push.
- Never sweep in unrelated untracked files (personal scratchpads like `fixes.md`, `todo.md`, `scratch*`). If `git status` shows something you can't attribute to this plan, stop and ask before committing.

After commit, run `git status` to confirm and report the resulting commit hash to the user.

---

## Hand-off

End your response with one of two phrases.

If the plan was committed:

> **Plan complete. Ready for Implement.**
>
> Artifacts written and committed:
> - `features/<slug>/plan.md` (frozen)
> - `test/features/<slug>.feature` (frozen)
> - `features/<slug>/notes.md` (mutable)
> - `test/fixtures/<...>` (N files, if any)
>
> Commit: `<sha>`

If the plan was drafted but blocked on conflicts/open questions:

> **Plan drafted — review before commit.**
>
> See the **Conflicts & Decisions** block above. Resolve and tell me how to proceed.

Implement will not start until it sees "Plan complete. Ready for Implement." and finds the artifacts on disk.
