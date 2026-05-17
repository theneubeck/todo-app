Feature: Tag autocomplete

  Scenario: Typing # opens the dropdown with all project tags
    Given the vault contains tasks tagged "#errands, #personal"
    And the command bar input is empty
    When the user types "#" in the command bar
    Then the autocomplete dropdown is shown
    And the dropdown shows "#errands"
    And the dropdown shows "#personal"

  Scenario: Typing @ opens the dropdown with people tags
    Given the vault contains tasks tagged "@mike, @lina"
    And the command bar input is empty
    When the user types "@" in the command bar
    Then the autocomplete dropdown is shown
    And the dropdown shows "@mike"
    And the dropdown shows "@lina"

  Scenario: Substring match filters the suggestions
    Given the vault contains tasks tagged "@mike, @lina"
    And the command bar input is empty
    When the user types "@l" in the command bar
    Then the autocomplete dropdown is shown
    And the dropdown shows "@lina"
    And the dropdown does not show "@mike"

  Scenario: ArrowDown moves the highlight to the next suggestion
    Given the vault contains tasks tagged "#errands, #personal"
    And the autocomplete dropdown is open
    When the user presses "ArrowDown"
    Then the highlighted suggestion is "#personal"

  Scenario: Tab inserts the highlighted suggestion
    Given the vault contains tasks tagged "#errands"
    And the command bar input value is "#err" with caret at end
    When the user presses "Tab"
    Then the input value is "#errands "
    And the autocomplete dropdown is not shown
    And the input retains focus

  Scenario: Enter passes through to the existing submit handler
    Given the vault contains tasks tagged "#errands"
    And the command bar input value is "#err" with caret at end
    When the user presses "Enter"
    Then the input value is "#err"

  Scenario: Escape closes the dropdown without changing the input
    Given the vault contains tasks tagged "#errands"
    And the command bar input value is "#err" with caret at end
    When the user presses "Escape"
    Then the autocomplete dropdown is not shown
    And the input value is "#err"

  Scenario: No matches means no dropdown
    Given the vault contains tasks tagged "#errands"
    And the command bar input is empty
    When the user types "#zzz" in the command bar
    Then the autocomplete dropdown is not shown
