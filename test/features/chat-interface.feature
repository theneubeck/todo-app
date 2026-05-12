Feature: Chat interface

  Scenario: clicking Chat shows the chat thread
    Given the vault contains the standard fixture todos
    When the user clicks the "Chat" sidebar entry
    Then the chat thread is visible
    And the task list is hidden

  Scenario: sending a message shows user and pending bubbles
    Given the chat view is active
    When the user types "what should I focus on today?" in the command bar and presses Enter
    Then a user bubble appears with text "what should I focus on today?"
    And a pending assistant bubble appears

  Scenario: Ollama reply replaces the pending bubble
    Given the chat view is active
    When the user types "what should I focus on today?" in the command bar and presses Enter
    And Ollama responds with "Focus on the Q2 report — it's due soonest."
    Then the assistant bubble contains "Focus on the Q2 report — it's due soonest."

  Scenario: sending a message from task list activates chat view
    Given the vault contains the standard fixture todos
    When the user types "what should I focus on today?" in the command bar and presses Enter
    Then the chat view activates automatically
    And a user bubble appears with text "what should I focus on today?"
    And a pending assistant bubble appears

  Scenario: typing without / sets chat mode
    Given the chat view is active
    When the user types "remind me to" in the command bar
    Then the command bar is in chat mode

  Scenario: typing / sets command mode
    Given the chat view is active
    When the user types "/add buy milk" in the command bar
    Then the command bar is in command mode

  Scenario: /add from chat view runs the task handler
    Given the chat view is active
    And the vault contains the standard fixture todos
    When the user types "/add buy milk" in the command bar and presses Enter
    Then no Ollama call was made
    And the add-task handler runs
