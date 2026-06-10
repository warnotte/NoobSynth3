import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 150)))
// Spoof Tauri detection so the I/O button renders (invokes will fail
// gracefully — we only check the popover frame/layout)
await page.addInitScript(() => { window.__TAURI_INTERNALS__ = {} })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(3000)
const drawerHasTauri = await page.locator('text=TAURI BRIDGE').count()
await page.click('.rail-btn--io')
await page.waitForTimeout(600)
await page.screenshot({ path: 'design/mockups/app-io-popover.png' })
// click outside closes
await page.mouse.click(800, 600)
await page.waitForTimeout(300)
const popoverGone = (await page.locator('.io-popover').count()) === 0
console.log(JSON.stringify({ drawerHasTauri, popoverGone, errors: errors.slice(0, 5) }))
await browser.close()
