Feature: Today Flow

  Scenario: Today view renders tasks from today.md
    Given the vault contains today-flow fixtures
    When the Today view loads
    Then the Today task list shows the linked tasks in order

  Scenario: Add-to-today icon appears on hover in a non-Today view
    Given the vault contains today-flow fixtures
    When the todo list view loads
    Then each task row shows an add-to-today icon on hover

  Scenario: Clicking the add-to-today icon appends the task to Today
    Given the vault contains today-flow fixtures
    When the todo list view loads
    When the user clicks the add-to-today icon on the first task row
    Then the task appears in the Today list
    Then today.md is updated with the task wikilink

  Scenario: Remove-from-today icon removes the task only from Today
    Given the vault contains today-flow fixtures with tasks in Today
    When the Today view loads
    When the user clicks the remove-from-today icon on a task row
    Then the task is removed from the Today list
    Then the original task file is unchanged

  Scenario: Checking a Today task marks the original task done
    Given the vault contains today-flow fixtures with tasks in Today
    When the Today view loads
    When the user toggles the parent checkbox
    Then the original task file has status done
    Then the task is removed from the Today list

  Scenario: Clear all empties the Today list
    Given the vault contains today-flow fixtures with tasks in Today
    When the Today view loads
    When the user clicks "Clear all"
    Then the Today list is empty
    Then today.md is empty

  Scenario: /today-clear command empties the Today list
    Given the vault contains today-flow fixtures with tasks in Today
    Given the command bar reads "/today-clear"
    When the user presses Enter
    Then the Today list is empty
    Then today.md is empty

  Scenario: Adding a task from Today view appends it to Today
    Given the vault contains today-flow fixtures
    When the Today view loads
    When the user adds a task via the command bar
    Then the new task appears in the Today list
    Then today.md is updated with the new task wikilink
