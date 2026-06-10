import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173/?preset=take-on-me')
await page.waitForTimeout(3000)

const vel = page.locator('.seq-step[data-step="1"] .seq-step-vel').first()
await vel.scrollIntoViewIfNeeded()
const read = () => vel.locator('.seq-step-vel-num').textContent()
const before = await read()
const box = await vel.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

// drag relatif de 30px vers le bas → −30 attendu
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.move(cx, cy + 30, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(300)
const afterDrag = await read()

// tap (revenir au centre) → +5
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.up()
await page.waitForTimeout(300)
const afterTap = await read()

// clic droit → −5
await page.mouse.click(cx, cy, { button: 'right' })
await page.waitForTimeout(300)
const afterRight = await read()

console.log(JSON.stringify({ before, afterDrag, afterTap, afterRight }))

const seq = page.locator('.module-card[data-module-type="step-sequencer"]').first()
await seq.screenshot({ path: 'design/mockups/p3-stepseq.png' })
await browser.close()
