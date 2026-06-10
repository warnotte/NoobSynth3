import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(3000)
await page.click('text=Mixer')
await page.waitForTimeout(600)
// master strip: try to open EQ then COMP — accordion should keep only COMP open
const toggles = page.locator('.mixer-strip-master .fx-section-toggle')
await toggles.nth(0).click()
await page.waitForTimeout(300)
await toggles.nth(1).click()
await page.waitForTimeout(300)
const expandedCount = await page.locator('.mixer-strip-master .fx-section.expanded').count()
await page.locator('.mixer-strips').screenshot({ path: 'design/mockups/app-mixer-zoom.png' })
console.log(JSON.stringify({ expandedCount }))
await browser.close()
