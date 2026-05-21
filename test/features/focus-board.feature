Feature: Focus Board

  Scenario: focus board displays focus card names
    Given the vault contains focus fixtures
    When the todo list view loads
    And the user clicks sidebar entry "focus"
    Then the focus board shows 2 focus cards

  Scenario: focus card displays its tag chips
    Given the vault contains focus fixtures
    When the todo list view loads
    And the user clicks sidebar entry "focus"
    Then the focus card "Work" shows tag "work"

  Scenario: empty state when no focuses exist
    Given the vault contains no focuses
    When the todo list view loads
    And the user clicks sidebar entry "focus"
    Then an empty state message appears on the focus board

  Scenario: clicking a focus card shows a filtered task list
    Given the vault contains focus fixtures
    And the vault contains the standard fixture todos
    When the todo list view loads
    And the user clicks sidebar entry "focus"
    And the user clicks the focus card "Work"
    Then the task list shows tasks matching the focus tags

  Scenario: clicking Focus sidebar entry returns to the board
    Given the vault contains focus fixtures
    And the vault contains the standard fixture todos
    When the todo list view loads
    And the user clicks sidebar entry "focus"
    And the user clicks the focus card "Work"
    And the user clicks sidebar entry "focus"
    Then the focus board is visible

  Scenario: creating a focus via the command bar
    Given the vault contains no focuses
    And the vault contains the standard fixture todos
    When the todo list view loads
    And the user clicks sidebar entry "focus"
    And the user submits the command "/focus Work #work #q2"
    Then a focus card named "Work" appears on the board
