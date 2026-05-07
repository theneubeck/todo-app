Feature: Todo list initial render

  Scenario: All tasks appear ordered by due date
    Given the vault contains the standard fixture todos
    When the todo list view loads
    Then every task title appears in due-date order
