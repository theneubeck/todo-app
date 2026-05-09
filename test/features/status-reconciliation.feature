Feature: Status reconciliation

  Scenario: Checking the last unchecked subtask sets status to done
    Given a combined task "buy-milk" exists with body "- [x] step 1\n- [ ] step 2" and frontmatter status "todo"
    When the user checks subtask "step 2"
    Then the file frontmatter status of "buy-milk" is "done"

  Scenario: Unchecking a subtask resets status to todo
    Given a combined task "buy-milk" exists with body "- [x] step 1\n- [x] step 2" and frontmatter status "done"
    When the user unchecks subtask "step 1"
    Then the file frontmatter status of "buy-milk" is "todo"

  Scenario: Adding a subtask to a done simple task resets status to todo
    Given a simple task "buy-milk" exists with empty body and frontmatter status "done"
    When the user adds a subtask "draft outline"
    Then the file frontmatter status of "buy-milk" is "todo"

  Scenario: Removing the only unchecked subtask sets status to done
    Given a combined task "buy-milk" exists with body "- [x] step 1\n- [ ] step 2" and frontmatter status "todo"
    When the user removes subtask "step 2"
    Then the file frontmatter status of "buy-milk" is "done"

  Scenario: Remaining count drops by 1 when a task auto-completes
    Given a combined task "buy-milk" exists with body "- [x] step 1\n- [ ] step 2" and frontmatter status "todo"
    And the initial remaining count is captured
    When the user checks subtask "step 2"
    Then the remaining count is 1 less than the captured value

  Scenario: Remaining count rises by 1 when a task auto-reopens
    Given a combined task "buy-milk" exists with body "- [x] step 1\n- [x] step 2" and frontmatter status "done"
    And the initial remaining count is captured
    When the user unchecks subtask "step 1"
    Then the remaining count is 1 more than the captured value
