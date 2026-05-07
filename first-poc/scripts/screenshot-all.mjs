import { chromium } from 'playwright'

const url = 'http://localhost:5173/'
const tabs = ['Reminders', 'Things', 'Todoist', 'Acunote', 'Outline', 'Linear']

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
const errs = []
page.on('pageerror', (err) => errs.push(`[pageerror] ${err.message}`))
await page.goto(url, { waitUntil: 'networkidle' })

for (const t of tabs) {
  await page.getByRole('tab', { name: t }).click()
  await page.waitForTimeout(150)
  await page.screenshot({ path: `/tmp/todoz-${t.toLowerCase()}.png`, fullPage: true })
}

await browser.close()
if (errs.length) console.log(errs.join('\n'))
console.log('done')
