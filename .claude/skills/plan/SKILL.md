---
name: plan
description: Interview-driven planner for new UI patterns / features. Walks five sections one question at a time and writes frozen plan artifacts to features/<slug>/. Writes no implementation code. Use when starting a new feature, before /agent implement.
---

# Plan skill

You are now planning a new feature. Produce a written, **frozen** plan that the Implement and Verify agents execute without ambiguity. Write planning artifacts to disk; write no implementation code.

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

1. `CLAUDE.md` — hard rules, dos, don'ts (authoritative if conflict)
2. `DESIGN.md` — visual tokens (typography, color, spacing, radius)
3. `vault/AGENTS.md` — vault schema, so fixture files are schema-correct
4. Any reference assets in `features/<slug>/` if the feature directory already exists (mockups, HTML, screenshots)
5. Existing frozen plans under `features/*/plan.md` for stylistic alignment

If a feature with the slug you are about to write already exists and is `frozen: true`, stop and ask whether to thaw it (manual edit) or pick a new slug.

`TECH-POC.md` and a root-level `AGENTS.md` are referenced by older docs but no longer exist — do not block on them.

---

## How the interview works

Walk through the five sections below **one question at a time**. The interview should feel like a natural conversation, not a form.

- Wait for the user's answer before moving to the next question.
- If the user gives an answer that already covers a later question, skip ahead — do not re-ask.
- Use the user's terminology.
- Mark anything the user does not know as `[TBD]` and continue.
- Do not infer behavior from code or invent acceptance criteria the user has not confirmed.
- **Persist state across turns.** Keep a running internal record of every locked decision (slug, name, scope inclusions/exclusions, criteria, scenarios). When the user corrects a decision, update your record immediately and never revert.
- If the user says "follow the html" or "treat the screenshot as spec", read those assets directly and synthesize the answer — don't punt back with another question.

After all five sections, summarize what you have in **3–5 bullets** and ask for explicit confirmation. Do not write any files until the user confirms.

---

## Section 1 — Feature identity

Ask:

1. What is the feature called? (one short phrase, e.g. "Reminders sidebar", "Tag column view")
2. What is the kebab-case slug? (e.g. `reminders-sidebar`) — propose one based on the name and let the user confirm or rename.

The slug becomes the directory name `features/<slug>/` and the `.feature` filename `features/<slug>/<slug>.feature`. If `features/<slug>/` already exists with reference assets (mockups, HTML), reuse it — write the new artifacts alongside the assets.

## Section 2 — Pattern summary

One paragraph describing what the pattern looks like and how a user interacts with it. Name the specific UI elements: sidebar, columns, checkboxes, badges, groupings. Concrete enough that a screenshot can be evaluated against this description.

Ask the user to describe it in their own words first. Then read it back, ask for missing UI elements, refine until the user agrees. If the user points at a mockup or HTML reference, read it and synthesize the paragraph yourself for the user to react to.

Be explicit about what is **in scope** and what is **stubbed / out of scope** (visual placeholders vs. functional). Lock these inclusions/exclusions before moving on.

## Section 3 — Acceptance criteria

A numbered list of observable behaviors the pattern must exhibit when running in Electron. These become the Playwright visual assertions in the Verify phase.

Each criterion in the form: *Given [state], when [action], then [observable result].*

Example:

> Given tasks exist with a `tags` field, when the Reminders pattern loads, then the left sidebar shows one row per unique tag with a badge count of incomplete tasks.

Rules:
- At least 4 criteria, at most 8.
- Every criterion must be visually verifiable from a screenshot.
- Drive the criteria out with questions like: *what should a user see first? what changes when they click? what is the empty state? what is the error state?*
- Respect the in-scope/out-of-scope decisions from Section 2 — don't draft criteria for stubbed elements.

## Section 4 — Gherkin scenarios

The outermost test layer. One scenario per acceptance criterion.

Format the feature block exactly as it should land on disk:

```gherkin
Feature: <Pattern name>

  Scenario: <one observable behavior>
    Given <state>
    When <action>
    Then <observable result>
```

Rules:
- One scenario per acceptance criterion. No "and" in scenario names.
- `Given` describes vault/fixture state. `When` describes a user action or app load. `Then` describes a DOM/file-on-disk observation.
- Reuse step phrasing across scenarios so step defs stay deduplicated.
- Keep step text declarative (what), not imperative (how).

Also list the step-definition file the Implement agent will create or extend:

```
[file: test/step_defs/<slug>.steps.ts]
- Given("the vault contains the standard fixture todos")
- When("the <pattern> view loads")
- Then("every task title appears in due-date order")
```

Reuse `Given` steps that already exist in `test/step_defs/*.steps.ts` (Cucumber loads steps globally — no duplication needed). Only introduce a `common.steps.ts` if three or more features share a step.

## Section 5 — BDD test list

A numbered list of Mocha test descriptions — one per behavior — for the Tallahassee (DOM) and unit (parseTodo / writeTodo) layers.

```
[file: test/patterns/<slug>.spec.ts]
- describe("<PatternName>") > it("<behavior>")

[file: test/data/parseTodo.spec.ts]   ← only if new parsing behavior is needed
- describe("parseTodo") > it("<behavior>")
```

Rules:
- Tallahassee tests first, data tests after.
- No "and" in test names.
- Every test traces to a Gherkin step or to behavior a step depends on.
- Do not duplicate tests that the Gherkin scenario already covers end-to-end.

## Section 6 — Data fixtures

A list of `.md` files to create in `test/fixtures/vault/todos/`. For each file: filename and exact frontmatter + body. Use the `vault/AGENTS.md` schema exactly.

Cover all acceptance criteria. Cover edge cases (empty tag list, due date in the past, nested subtasks) only if the pattern requires them. Skip files that already exist on disk and match the schema.

---

## Gate check before writing

Before saving anything, verify:

- [ ] Every acceptance criterion has exactly one Gherkin scenario
- [ ] Every Gherkin step has a step definition listed
- [ ] Every Tallahassee/unit test traces to a Gherkin step or step dependency
- [ ] No scenario or test name contains "and"
- [ ] Layer order: Gherkin first, Tallahassee second, data last
- [ ] Every fixture file uses the correct schema from `vault/AGENTS.md`
- [ ] You have written zero lines of TypeScript or JavaScript
- [ ] Locked scope from Section 2 is respected throughout — no out-of-scope criteria, scenarios, or tests crept in

If any item is unchecked, fix it before writing files.

---

## Writing the artifacts

When the user has confirmed, write these files **in this order**:

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

<paragraph from Section 2>

## Acceptance criteria

1. Given …, when …, then …
2. …

## Step-definition file

`test/step_defs/<slug>.steps.ts` — steps:
- Given(…)
- When(…)
- Then(…)

## BDD test list

[file: test/patterns/<slug>.spec.ts]
- describe("<PatternName>") > it("<behavior>")

[file: test/data/parseTodo.spec.ts]
- describe("parseTodo") > it("<behavior>")

## Data fixtures

- `test/fixtures/vault/todos/<filename>.md` — <one-line purpose>
- …
```

### 2. `features/<slug>/<slug>.feature`

The Gherkin block from Section 4, exactly. Cucumber loads this file. It is part of the frozen contract — do not include comments that contradict the plan.

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
a `## Problem` block here and stop. The user will re-run the plan skill.

## Problems

(none yet)

## Verify findings

(filled by the Verify agent)
```

### 4. Fixture files

Write each `test/fixtures/vault/todos/<filename>.md` from Section 6. Skip files that already exist on disk and match the schema; for files that exist with different content, append a `## Problem` to `notes.md` and ask the user how to proceed.

---

## Hand-off

End your response with:

> **Plan complete. Ready for Implement.**
>
> Artifacts written:
> - `features/<slug>/plan.md` (frozen)
> - `features/<slug>/<slug>.feature` (frozen)
> - `features/<slug>/notes.md` (mutable)
> - `test/fixtures/vault/todos/<...>` (N files)

Implement will not start until it sees this phrase and finds the artifacts on disk.
