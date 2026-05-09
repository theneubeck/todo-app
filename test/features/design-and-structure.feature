Feature: Design and structure

  Scenario: Top app bar shows brand and action icons
    Given the app loads
    When the initial render completes
    Then the top app bar shows the brand "TODO" with action icons

  Scenario: Sidebar shows primary navigation with Inbox active
    Given the app loads
    When the initial render completes
    Then the left sidebar shows the navigation entries "Chat, Inbox, Today, Upcoming" with "Inbox" marked active

  Scenario: Main header shows Inbox h1 above remaining count
    Given the app loads
    When the initial render completes
    Then the main content header shows the h1 "Inbox" above the remaining-count line

  Scenario: Task list renders as a bordered card grouped by priority
    Given the vault contains the standard fixture todos
    When the initial render completes
    Then the task list renders inside a bordered card grouped under uppercase priority headings

  Scenario: Expanded task reveals indented subtasks with guide line
    Given the vault contains the standard fixture todos
    When its row is expanded
    Then the subtasks render indented with a guide line and done items struck through

  Scenario: Command bar pinned at the bottom shows placeholder and shortcut hint
    Given the app loads
    When the initial render completes
    Then a command bar pinned to the bottom shows the placeholder "Type a command or add a task..." with the "CMD + K" hint
