Feature: Bug fixes 1

  Scenario: Default render shows all primary sidebar entries when no tags exist
    Given the vault has zero tags of any kind and no app-settings file exists
    When the app loads
    Then the sidebar shows the Chat, Inbox, Today, and Upcoming entries

  Scenario: Brand reads TODO in the top app bar
    Given the app loads
    When the top app bar renders
    Then [data-brand] text content equals "TODO"

  Scenario: Settings icon opens the panel
    Given the sidebar is shown
    When the user clicks the settings icon in the top app bar
    Then a settings panel appears anchored to the icon
    And the settings panel shows three checkboxes labelled "Show Chat", "Show Today", and "Show Upcoming"

  Scenario: Unchecking Show Chat removes the Chat entry immediately
    Given the settings panel is open with all checkboxes checked
    When the user unchecks "Show Chat"
    Then the "Chat" sidebar entry is removed from the DOM

  Scenario: Persisted setting survives a fresh mount
    Given the persisted settings have "Show Chat" unchecked
    When the user re-opens the app via a fresh mount
    Then the "Chat" sidebar entry is absent

  Scenario: Outside click closes the panel
    Given the settings panel is open
    When the user clicks outside the panel and outside the settings icon
    Then the panel is closed

  Scenario: PROJECTS section absent when no hash-tags exist
    Given the vault has zero tasks with "#"-prefixed tags
    When the sidebar renders
    Then [data-section="projects"] is absent from the DOM

  Scenario: PEOPLE section absent when no at-tags exist
    Given the vault has zero tasks with "@"-prefixed tags
    When the sidebar renders
    Then [data-section="people"] is absent from the DOM
