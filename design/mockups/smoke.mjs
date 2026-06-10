import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)))

await page.goto('http://localhost:5173/')
await page.waitForTimeout(3500)
await page.click('text=Mixer')
await page.waitForTimeout(600)
await page.click('text=Racks')
await page.waitForTimeout(600)
// toggle cables off/on from the brand rail
await page.click('.rail-switch')
await page.waitForTimeout(300)
await page.click('.rail-switch')
await page.waitForTimeout(300)
// scroll the rack internally
await page.hover('.rack')
await page.mouse.wheel(0, 600)
await page.waitForTimeout(600)
await page.screenshot({ path: 'design/mockups/app-rack-scrolled.png' })
await page.mouse.wheel(0, -600)
await page.waitForTimeout(400)
await page.screenshot({ path: 'design/mockups/app-rack.png' })
console.log(JSON.stringify({ errors: errors.slice(0, 8) }))
await browser.close()
