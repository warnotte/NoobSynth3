import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
page.on('console', (msg) => console.log('[browser]', msg.text()))
page.on('pageerror', (err) => console.log('[pageerror]', err.message))
await page.goto('http://localhost:5173/?preset=take-on-me')
await page.waitForTimeout(3000)

const cell = page.locator('.seq-step[data-step="1"] .seq-step-pitch').first()
await cell.scrollIntoViewIfNeeded()
const before = await cell.textContent()
const box = await cell.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

// tap pur, sans drag préalable
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.up()
await page.waitForTimeout(400)
const afterTap1 = await cell.textContent()

// deuxième tap
await page.mouse.down()
await page.mouse.up()
await page.waitForTimeout(400)
const afterTap2 = await cell.textContent()

console.log(JSON.stringify({ before, afterTap1, afterTap2 }))
await browser.close()
