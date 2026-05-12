Feature: Ollama diagnostics

  Scenario: Error reply renders as an error bubble
    Given the chat view is active
    And the next runOllama call will fail with "Error: model not found"
    When the user types "what should I do" in the command bar and presses Enter
    Then an error bubble appears with text "Error: model not found"
    And the pending bubble is gone
