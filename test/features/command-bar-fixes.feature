Feature: Command bar fixes

  Scenario: cmd+i on empty input prefills with /add
    Given the command bar input is empty
    When the user presses cmd+i
    Then the input value is "/add "
    And the input is focused

  Scenario: cmd+i prepends /add to existing text
    Given the command bar input value is "buy milk"
    When the user presses cmd+i
    Then the input value is "/add buy milk"
    And the input is focused

  Scenario: cmd+i leaves the value alone when it already starts with /add
    Given the command bar input value is "/add buy milk"
    When the user presses cmd+i
    Then the input value is unchanged at "/add buy milk"
    And the input is focused

  Scenario: Command bar renders without demo chips
    Given the command bar renders on initial mount
    When its DOM is inspected
    Then no element with "[data-command-chip=\"mention\"]" is present
    And no element with "[data-command-chip=\"tag\"]" is present
