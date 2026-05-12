import { Given, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld } from './world'

// The "Given the chat view is active" and the "When the user types ..." steps
// are reused from chat-interface.steps.ts. This file only defines the
// failure-injection Given and the two error-bubble Thens.

Given(
  'the next runOllama call will fail with {string}',
  function (this: TodozWorld, errorText: string) {
    if (!this.dom) {
      // The chat-view Given mounts the window; if for some reason the user
      // ordering is reversed, mount here so we have something to attach to.
      this.mountWindow()
    }
    this.nextOllamaResolveWith = {
      ok: false,
      error: errorText,
      statusCode: 500,
    }
  }
)

Then(
  'an error bubble appears with text {string}',
  function (this: TodozWorld, text: string) {
    const bubble = this.document.querySelector(
      '[data-message="assistant"][data-error] [data-message-text]'
    )
    expect(
      bubble,
      '[data-message="assistant"][data-error] [data-message-text] should exist'
    ).to.not.equal(null)
    expect(bubble?.textContent).to.equal(text)
  }
)

Then('the pending bubble is gone', function (this: TodozWorld) {
  const pending = this.document.querySelectorAll(
    '[data-message="assistant"][data-pending]'
  )
  expect(pending.length, 'no pending assistant bubbles should remain').to.equal(0)
})
