import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(3000)
await page.click('text=Mixer')
await page.waitForTimeout(800)
// expand one FX section to inspect knobs
await page.click('.fx-section-toggle >> nth=0')
await page.waitForTimeout(400)
const strips = page.locator('.mixer-strips')
await strips.screenshot({ path: 'design/mockups/app-mixer-zoom.png' })
await browser.close()
console.log('ok')
