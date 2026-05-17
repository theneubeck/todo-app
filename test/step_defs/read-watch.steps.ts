import { When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { TodozWorld } from './world'

When('the user clicks sidebar entry {string}', function (this: TodozWorld, value: string) {
  const entry = this.document.querySelector(
    `[data-sidebar-entry="${value}"]`
  ) as HTMLElement | null
  expect(entry, `[data-sidebar-entry="${value}"] should be present`).to.not.equal(null)
  entry!.click()
})

Then('the sidebar has a resources section', function (this: TodozWorld) {
  const section = this.document.querySelector('[data-section="resources"]')
  expect(section, '[data-section="resources"] should be present').to.not.equal(null)
  const readEntry = section!.querySelector('[data-sidebar-entry=">read"]')
  const watchEntry = section!.querySelector('[data-sidebar-entry=">watch"]')
  expect(readEntry, '[data-sidebar-entry=">read"] inside resources section').to.not.equal(null)
  expect(watchEntry, '[data-sidebar-entry=">watch"] inside resources section').to.not.equal(null)
})
