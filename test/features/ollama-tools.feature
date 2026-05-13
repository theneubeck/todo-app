Feature: Ollama tool calls

  Scenario: Single add_task tool call writes a task file
    Given the chat view is active
    And the next Ollama response is a tool call "[{\"name\":\"add_task\",\"arguments\":{\"title\":\"buy milk\"}}]"
    And the next Ollama response is a normal reply "Added a task to buy milk."
    When the user types "add a task to buy milk" in the command bar and presses Enter
    Then a task file matching "buy-milk-*.md" exists in the active vault todos folder
    And the file frontmatter title equals "buy milk"
    And a tool row appears in the chat thread with action "add_task: buy milk" and status "ok"
    And the assistant final bubble reads "Added a task to buy milk."

  Scenario: Tool call with tags writes a tagged task
    Given the chat view is active
    And the next Ollama response is a tool call "[{\"name\":\"add_task\",\"arguments\":{\"title\":\"buy milk\",\"tags\":[\"go-to-store\"]}}]"
    And the next Ollama response is a normal reply "Added it under #go-to-store."
    When the user types "add buy milk under go-to-store" in the command bar and presses Enter
    Then a task file matching "buy-milk-*.md" exists in the active vault todos folder
    And the file frontmatter tags include "go-to-store"
    And a tool row appears in the chat thread with action "add_task: buy milk #go-to-store" and status "ok"

  Scenario: Go-to-store example breaks into six tagged tasks
    Given the chat view is active
    And the next Ollama response is a tool call "[{\"name\":\"add_task\",\"arguments\":{\"title\":\"buy milk\",\"tags\":[\"go-to-store\"]}},{\"name\":\"add_task\",\"arguments\":{\"title\":\"buy eggs\",\"tags\":[\"go-to-store\"]}},{\"name\":\"add_task\",\"arguments\":{\"title\":\"buy fruit\",\"tags\":[\"go-to-store\"]}},{\"name\":\"add_task\",\"arguments\":{\"title\":\"buy flour\",\"tags\":[\"go-to-store\"]}},{\"name\":\"add_task\",\"arguments\":{\"title\":\"buy jam\",\"tags\":[\"go-to-store\"]}},{\"name\":\"add_task\",\"arguments\":{\"title\":\"make pancakes\",\"tags\":[\"go-to-store\"]}}]"
    And the next Ollama response is a normal reply "Added six tasks under #go-to-store."
    When the user types "I need you to go to the store, buy milk, some eggs, fruit and flour. We should be making pancakes. So some jam can be needed too." in the command bar and presses Enter
    Then a task file matching "buy-milk-*.md" exists in the active vault todos folder
    And a task file matching "buy-eggs-*.md" exists in the active vault todos folder
    And a task file matching "buy-fruit-*.md" exists in the active vault todos folder
    And a task file matching "buy-flour-*.md" exists in the active vault todos folder
    And a task file matching "buy-jam-*.md" exists in the active vault todos folder
    And a task file matching "make-pancakes-*.md" exists in the active vault todos folder
    And the assistant final bubble reads "Added six tasks under #go-to-store."

  Scenario: Ambiguous request returns a clarifying question
    Given the chat view is active
    And the next Ollama response has no tool_calls and content "Which tasks would you like to add?"
    When the user types "add some stuff" in the command bar and presses Enter
    Then the assistant final bubble reads "Which tasks would you like to add?"
