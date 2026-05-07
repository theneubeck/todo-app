import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5173/'
const out = process.argv[3] ?? 'screenshot.png'

const browser = await chromium.launch()
const page = await browser.newPage()
const logs = []
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`))
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}\n${err.stack ?? ''}`))
await page.goto(url, { waitUntil: 'networkidle' })
await page.screenshot({ path: out, fullPage: true })
await browser.close()
console.log(logs.join('\n'))
console.log(`saved: ${out}`)
