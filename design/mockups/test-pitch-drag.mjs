import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/?preset=take-on-me')
await page.waitForTimeout(3000)

const cell = page.locator('.seq-step[data-step="1"] .seq-step-pitch').first()
await cell.scrollIntoViewIfNeeded()
const before = await cell.textContent()
const box = await cell.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

// drag de 40px vers le haut → +10 demi-tons attendus
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.move(cx, cy - 40, { steps: 10 })
await page.mouse.up()
const afterDrag = await cell.textContent()

await page.waitForTimeout(300)

// tap sans mouvement → +1 (revenir au centre de la cellule d'abord !)
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.up()
await page.waitForTimeout(300)
const afterTap = await cell.textContent()

// clic droit → −1
await page.mouse.click(cx, cy, { button: 'right' })
await page.waitForTimeout(300)
const afterRight = await cell.textContent()

console.log(JSON.stringify({ before, afterDrag, afterTap, afterRight }))

const seq = page.locator('.module-card[data-module-type="step-sequencer"]').first()
await seq.screenshot({ path: 'design/mockups/p3-stepseq.png' })
await browser.close()
