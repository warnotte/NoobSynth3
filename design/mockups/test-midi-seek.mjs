import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
let errs = 0
page.on('pageerror', () => errs++)
await page.goto('http://localhost:5173/?preset=midi-leslie-organ')
await page.waitForTimeout(3500)
await page.click('.tc-play')
await page.waitForTimeout(4000)

const progress = page.locator('.midi-seq-progress').first()
await progress.scrollIntoViewIfNeeded()
const text = () => page.locator('.midi-seq-progress-text').first().textContent()
const before = await text()

// seek à ~80% puis ~10%
const box = await progress.boundingBox()
await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2)
await page.waitForTimeout(1200)
const at80 = await text()
await page.mouse.click(box.x + box.width * 0.1, box.y + box.height / 2)
await page.waitForTimeout(1200)
const at10 = await text()

console.log(JSON.stringify({ before, at80, at10, pageErrors: errs }))
await browser.close()
