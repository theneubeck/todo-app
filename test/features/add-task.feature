Feature: Add task

  Scenario: cmd+i prefills the command bar with /add
    Given the command bar is empty
    When the user presses cmd+i
    Then the command bar shows "/add " with focus

  Scenario: /add writes a new task file
    Given the command bar reads "/add buy milk"
    When the user presses Enter
    Then a new task file "buy-milk-2026-05-07.md" appears in the vault todos folder

  Scenario: tagged /add creates new sidebar entries
    Given the command bar reads "/add buy milk #urgent @sara"
    When the user presses Enter
    Then a "#urgent" entry appears under PROJECTS in the sidebar
    And a "@sara" entry appears under PEOPLE in the sidebar

  Scenario: tagged /add pulses matching sidebar entries
    Given the command bar reads "/add buy milk #urgent @sara"
    When the user presses Enter
    Then the "#urgent" sidebar entry pulses
    And the "@sara" sidebar entry pulses

  Scenario: untagged /add pulses only the Inbox entry
    Given the command bar reads "/add buy milk"
    When the user presses Enter
    Then the Inbox sidebar entry pulses
    And no other sidebar entry pulses

  Scenario: clicking a tag entry filters the list
    Given the vault contains the standard fixture todos
    And the initial render completes
    When the user clicks the "#errands" sidebar entry
    Then the main list shows only tasks tagged "errands"
    And the main h1 reads "#errands"

  Scenario: initial render shows Inbox active
    Given the vault contains the standard fixture todos
    When the initial render completes
    Then the Inbox sidebar entry is visually active
    And the main h1 reads "Inbox"

  Scenario: empty /add does nothing
    Given the command bar reads "/add"
    When the user presses Enter
    Then no new task file is written
    And no sidebar entry pulses
    And the command bar still reads "/add"
