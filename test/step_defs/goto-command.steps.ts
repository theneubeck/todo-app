import { When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld } from './world'

function commandBarInput(world: TodozWorld): HTMLInputElement {
  return world.document.querySelector(
    '[data-command-bar] input[type="text"]'
  ) as HTMLInputElement
}

When('the user presses cmd+t', function (this: TodozWorld) {
  this.document.dispatchEvent(
    new this.dom!.window.KeyboardEvent('keydown', {
      metaKey: true,
      key: 't',
      bubbles: true,
      cancelable: true,
    })
  )
})

Then('the main header title is {string}', function (this: TodozWorld, expected: string) {
  const h1 = this.document.querySelector('[data-main-header] h1')
  expect(h1?.textContent?.trim()).to.equal(expected)
})

Then(
  'the command bar input value starts with {string}',
  function (this: TodozWorld, prefix: string) {
    const input = commandBarInput(this)
    expect(input.value.startsWith(prefix)).to.equal(true)
  }
)
