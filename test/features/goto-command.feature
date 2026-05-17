Feature: Go to destination command

  Scenario: /goto inbox navigates to the inbox view
    Given the command bar input is empty
    When the user types "/goto inbox" in the command bar and presses Enter
    Then the main header title is "Inbox"
    And the input value is ""

  Scenario: /goto #tag navigates to a project tag filter
    Given the vault contains tasks tagged "#errands"
    When the user types "/goto #errands" in the command bar and presses Enter
    Then the main header title is "#errands"
    And the input value is ""

  Scenario: /goto @person navigates to a people tag filter
    Given the vault contains tasks tagged "@mike"
    When the user types "/goto @mike" in the command bar and presses Enter
    Then the main header title is "@mike"
    And the input value is ""

  Scenario: /goto chat switches to the chat view
    Given the command bar input is empty
    When the user types "/goto chat" in the command bar and presses Enter
    Then the chat thread is visible

  Scenario: cmd+t focuses the command bar prefilled with /goto
    Given the command bar input is empty
    When the user presses cmd+t
    Then the command bar input value starts with "/goto "
    And the input is focused

  Scenario: /goto with unknown destination is a no-op
    Given the command bar input is empty
    When the user types "/goto zzz" in the command bar and presses Enter
    Then the main header title is "Inbox"
    And the input value is "/goto zzz"
