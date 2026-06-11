import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 3 })
await page.goto('http://localhost:5173/?preset=take-on-me')
await page.waitForTimeout(3000)

const grid = page.locator('.module-card[data-module-type="step-sequencer"] .seq-step-grid').first()
await grid.scrollIntoViewIfNeeded()
const box = await grid.boundingBox()
// crop : colonne labels + 3 premiers steps de la 1re banque
await page.screenshot({
  path: 'design/mockups/p3-labels-zoom.png',
  clip: { x: box.x, y: box.y, width: 200, height: Math.min(box.height, 180) },
})
console.log('ok')
await browser.close()
