import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(3500)
await page.screenshot({ path: 'design/mockups/app-rack.png' })
// Mixer view
await page.click('text=Mixer')
await page.waitForTimeout(800)
await page.screenshot({ path: 'design/mockups/app-mixer.png' })
await browser.close()
console.log('ok')
