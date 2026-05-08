Feature: Vault picker

  Scenario: First-run shows the picker with empty recents
    Given no vault config file exists
    When the app launches
    Then the vault-picker is shown
    And the recents list is empty
    And the "Create new vault" button is visible
    And the "Open folder as vault" button is visible

  Scenario: Create new vault writes the skeleton
    Given the vault-picker is shown
    And the OS folder picker will return an empty target folder
    When the user clicks "Create new vault"
    Then "todos" exists in the target folder
    And "archive/todos" exists in the target folder
    And the main todo list is shown against the target folder

  Scenario: Open existing folder as vault
    Given the vault-picker is shown
    And the OS folder picker will return a folder containing "todos"
    When the user clicks "Open folder as vault"
    Then the main todo list is shown against the selected folder

  Scenario: Recents list shows previously opened vaults
    Given the vault config lists two previously opened vaults
    When the vault-picker loads
    Then the recents list shows one row per vault in most-recent-first order
    And each recent row shows the folder name and absolute path

  Scenario: Click recent opens the selected vault
    Given the vault-picker is shown with two recents
    When the user clicks the first recent row
    Then the main todo list is shown against the first recent's vault path

  Scenario: Remove recent leaves disk untouched
    Given the vault-picker is shown with two recents
    When the user hovers the first recent row and clicks the remove icon
    Then the first recent row is no longer in the recents list
    And the first recent's folder still exists on disk

  Scenario: Open another vault from main window
    Given the main todo list is shown
    When the user clicks the "Open another vault" icon button
    Then the vault-picker is shown

  Scenario: Launch with valid last-opened vault skips picker
    Given the vault config's last-opened vault exists on disk
    When the app launches
    Then the main todo list is shown against the last-opened vault
    And the vault-picker is not shown
