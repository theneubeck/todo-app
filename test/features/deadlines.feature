Feature: Deadlines

  Scenario: upcoming view shows only tasks with due dates
    Given the vault contains the standard fixture todos
    When the todo list view loads
    And the user clicks sidebar entry "upcoming"
    Then only tasks with a due date appear in the Upcoming list

  Scenario: upcoming view orders tasks by ascending due date
    Given the vault contains the standard fixture todos
    When the todo list view loads
    And the user clicks sidebar entry "upcoming"
    Then the tasks in the Upcoming list appear in ascending due-date order

  Scenario: each upcoming task row shows a due-date line
    Given the vault contains the standard fixture todos
    When the todo list view loads
    And the user clicks sidebar entry "upcoming"
    Then each task row in the Upcoming list shows a due-date line below the title

  Scenario: tag chip appears on the due-date line
    Given the vault contains the standard fixture todos
    When the todo list view loads
    And the user clicks sidebar entry "upcoming"
    Then the first task row in the Upcoming list shows a tag chip on the due-date line

  Scenario: empty state when no tasks have due dates
    Given the vault contains only tasks without due dates
    When the todo list view loads
    And the user clicks sidebar entry "upcoming"
    Then an empty state message appears in the Upcoming view

  Scenario: upcoming view header shows correct label
    Given the vault contains the standard fixture todos
    When the todo list view loads
    And the user clicks sidebar entry "upcoming"
    Then the main header title is "Upcoming"
