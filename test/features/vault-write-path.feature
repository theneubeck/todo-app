Feature: Vault write path

  Scenario: First /add into an empty active vault writes to the active vault
    Given the active vault is set to "alpha" and its todos folder is empty
    When the user types "/add buy milk" and presses Enter
    Then the file "buy-milk-<TODAY>.md" exists inside the active vault's todos folder
    And the file "buy-milk-<TODAY>.md" does not exist inside the repo's vault folder

  Scenario: Second /add into a non-empty active vault writes to the same vault
    Given the active vault is set to "alpha" with one existing task
    When the user types "/add buy stamps" and presses Enter
    Then the second file is written into the same active vault todos folder

  Scenario: Toggling an existing task writes to its own filePath
    Given a task "buy-milk" exists in the active vault and is rendered
    When the user toggles the parent checkbox
    Then the write goes to the task's existing filePath

  Scenario: Writing outside the active vault is refused by main
    Given the active vault is set to "alpha" and its todos folder is empty
    When the renderer attempts to write a file outside the active vault's directory tree
    Then the call rejects and no file is written
