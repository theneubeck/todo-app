---
name: Todo list initial render
slug: todoList
status: planned
frozen: true
created: 2026-05-07
---

# Todo list initial render

## Pattern summary

The default view that loads when the Electron app starts. A single column lists every task in the vault, sorted by `due` date ascending. Each row shows the task title and a checkbox; tasks with no `due` date sort to the end. The user can scan the full backlog at a glance and toggle a checkbox to flip `- [ ]` ↔ `- [x]` on disk.

## Acceptance criteria

1. Given the vault contains the standard fixture todos, when the todo list view loads, then every task title appears in due-date order.

## Step-definition file

`test/step_defs/todoList.steps.ts` — steps:
- Given("the vault contains the standard fixture todos")
- When("the todo list view loads")
- Then("every task title appears in due-date order")

## BDD test list

[file: test/patterns/todoList.spec.ts]
- describe("TodoList") > it("renders one row per fixture task")
- describe("TodoList") > it("orders rows by due date ascending")
- describe("TodoList") > it("places tasks without a due date last")

[file: test/data/parseTodo.spec.ts]
- describe("parseTodo") > it("extracts the title from frontmatter")
- describe("parseTodo") > it("returns due as undefined when missing")

## Data fixtures

- `test/fixtures/vault/todos/call-dentist-2026-05-04.md` — task with near-future due date
- `test/fixtures/vault/todos/q2-report-2026-05-01.md` — task with later due date
- `test/fixtures/vault/todos/read-anthropic-paper-2026-04-28.md` — task with no due date (sorts last)
