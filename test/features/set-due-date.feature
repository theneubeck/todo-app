Feature: Set Due Date

  Scenario: add command with due token creates task with due date
    Given the vault contains the standard fixture todos
    When the todo list view loads
    And the user submits the command "/add finish report due:2026-06-15"
    Then the written file contains due "2026-06-15"

  Scenario: calendar icon is present on task rows
    Given the vault contains the standard fixture todos
    When the todo list view loads
    Then a set-due icon is present on the first task row

  Scenario: clicking calendar icon on undated task shows empty date input
    Given the vault contains the standard fixture todos
    When the todo list view loads
    And the user clicks the set-due icon on the first task row
    Then a date input is visible in the first task row

  Scenario: entering a date and pressing Enter saves it to the file
    Given the vault contains the standard fixture todos
    When the todo list view loads
    And the user clicks the set-due icon on the first task row
    And the user types "2026-07-01" into the due input and presses Enter
    Then the written file contains due "2026-07-01"

  Scenario: pressing Escape closes the input without saving
    Given the vault contains the standard fixture todos
    When the todo list view loads
    And the user clicks the set-due icon on the first task row
    And the user presses Escape on the due input
    Then the date input is not present
    And the task file is not written

  Scenario: calendar icon on dated task pre-fills the input
    Given a task with due date "2026-05-30" is loaded
    When the todo list view loads
    And the user clicks the set-due icon on the first task row
    Then the date input is pre-filled with "2026-05-30"
