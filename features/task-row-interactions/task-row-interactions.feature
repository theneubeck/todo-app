Feature: Task row interactions

  Scenario: simple-task rows render without a chevron
    Given the vault contains task-row-interactions fixtures
    When the initial render completes
    Then only combined-task rows display a chevron

  Scenario: clicking a todo task's checkbox marks it done
    Given the vault contains task-row-interactions fixtures
    When the user clicks the checkbox of the "buy milk" row
    Then the "buy milk" file's frontmatter status is "done"
    And the "buy milk" row shows the checked success state
    And the "buy milk" row's title is strikethrough with on-surface-variant color

  Scenario: clicking a done task's checkbox marks it todo
    Given the vault contains task-row-interactions fixtures
    When the user clicks the checkbox of the "send invoice" row
    Then the "send invoice" file's frontmatter status is "todo"
    And the "send invoice" row's checked styling is removed

  Scenario: clicking a combined-task row toggles expanded state
    Given the vault contains task-row-interactions fixtures
    And the combined task "prep deck" is rendered collapsed
    When the user clicks the body of the "prep deck" row
    Then the "prep deck" row is expanded
    And one subtask row appears for each subtask line in the "prep deck" file body

  Scenario: clicking a subtask checkbox flips its bullet in the parent body
    Given the vault contains task-row-interactions fixtures
    And the combined task "prep deck" is expanded
    When the user clicks the checkbox of the "draft section 1" subtask under "prep deck"
    Then the "prep deck" file body shows "- [x] draft section 1"
    And the "prep deck" row's frontmatter status is unchanged
    And the "draft section 1" subtask row shows the checked success state

  Scenario: cancelling a remove leaves the row untouched
    Given the vault contains task-row-interactions fixtures
    When the user clicks the remove icon of the "buy milk" row
    And the user clicks "No" on the confirm prompt
    Then no task file is changed
    And the "buy milk" row appears unchanged

  Scenario: confirming remove on a top-level task moves the file to archive
    Given the vault contains task-row-interactions fixtures
    When the user clicks the remove icon of the "buy milk" row
    And the user clicks "Yes" on the confirm prompt
    Then the "buy milk" file no longer exists in vault todos
    And the "buy milk" file exists in vault archive todos
    And the "buy milk" row no longer appears in the list

  Scenario: confirming remove on a subtask deletes the line from the parent body
    Given the vault contains task-row-interactions fixtures
    And the combined task "prep deck" is expanded
    When the user clicks the remove icon of the "draft section 1" subtask under "prep deck"
    And the user clicks "Yes" on the confirm prompt
    Then the "prep deck" file body no longer contains "draft section 1"
    And the "prep deck" file still exists in vault todos
    And the "draft section 1" subtask row no longer appears under "prep deck"
