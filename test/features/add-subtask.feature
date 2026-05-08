Feature: Add subtask

  Scenario: Simple task rows show the add-subtask affordance
    Given the vault contains task-row-interactions fixtures
    When the initial render completes
    Then the "buy milk" row shows an add-subtask affordance

  Scenario: Expanded combined task rows show the add-subtask affordance
    Given the vault contains task-row-interactions fixtures
    And the combined task "prep deck" is expanded
    Then the "prep deck" row shows an add-subtask affordance

  Scenario: Collapsed combined task rows hide the add-subtask affordance
    Given the vault contains task-row-interactions fixtures
    When the initial render completes
    Then the "prep deck" row shows no add-subtask affordance

  Scenario: Clicking the affordance opens a focused subtask input
    Given the vault contains task-row-interactions fixtures
    When the user clicks the add-subtask affordance for "buy milk"
    Then a focused subtask input replaces the affordance for "buy milk"

  Scenario: Submitting non-empty text on a combined task appends a subtask
    Given the vault contains task-row-interactions fixtures
    And the combined task "prep deck" is expanded
    When the user clicks the add-subtask affordance for "prep deck"
    And the user types "draft outline" into the subtask input
    And the user presses Enter in the subtask input
    Then the "prep deck" file body ends with "- [ ] draft outline"
    And the "prep deck" subtask list ends with a row labeled "draft outline"
    And the "prep deck" row shows an add-subtask affordance

  Scenario: Submitting non-empty text on a simple task converts it to combined
    Given the vault contains task-row-interactions fixtures
    When the user clicks the add-subtask affordance for "buy milk"
    And the user types "buy stamps" into the subtask input
    And the user presses Enter in the subtask input
    Then the "buy milk" row is rendered as expanded combined
    And the "buy milk" subtask list contains exactly one row labeled "buy stamps"
    And the "buy milk" row shows an add-subtask affordance

  Scenario: Pressing Esc cancels the input without writing
    Given the vault contains task-row-interactions fixtures
    When the user clicks the add-subtask affordance for "buy milk"
    And the user presses Esc in the subtask input
    Then the subtask input is torn down
    And no task file is changed

  Scenario: Submitting whitespace-only text cancels the input without writing
    Given the vault contains task-row-interactions fixtures
    When the user clicks the add-subtask affordance for "buy milk"
    And the user types "   " into the subtask input
    And the user presses Enter in the subtask input
    Then the subtask input is torn down
    And no task file is changed
