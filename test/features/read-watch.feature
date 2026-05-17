Feature: Read and Watch resources

  Scenario: Sidebar always shows the RESOURCES section
    Given the command bar input is empty
    Then the sidebar has a resources section

  Scenario: Clicking To Read filters to read-tagged tasks
    Given the vault contains tasks tagged ">read"
    When the user clicks sidebar entry ">read"
    Then the main header title is "To Read"

  Scenario: Clicking To Watch filters to watch-tagged tasks
    Given the vault contains tasks tagged ">watch"
    When the user clicks sidebar entry ">watch"
    Then the main header title is "To Watch"

  Scenario: Typing > opens autocomplete with resource suggestions
    Given the command bar input is empty
    When the user types ">" in the command bar
    Then the autocomplete dropdown is shown
    And the dropdown shows ">read"
    And the dropdown shows ">watch"

  Scenario: /goto >read navigates to the To Read view
    Given the command bar input is empty
    When the user types "/goto >read" in the command bar and presses Enter
    Then the main header title is "To Read"
