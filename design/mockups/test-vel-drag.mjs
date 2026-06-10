import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173/?preset=take-on-me')
await page.waitForTimeout(3000)

const vel = page.locator('.seq-step[data-step="1"] .seq-step-vel').first()
await vel.scrollIntoViewIfNeeded()
const read = () => vel.evaluate((el) => el.style.getPropertyValue('--vel'))
const before = await read()
const box = await vel.boundingBox()
const cx = box.x + box.width / 2

// drag du haut (100) vers le bas (≈25%)
await page.mouse.move(cx, box.y + 2)
await page.mouse.down()
await page.mouse.move(cx, box.y + box.height * 0.75, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(300)
const afterDrag = await read()

console.log(JSON.stringify({ before, afterDrag }))

// screenshot de la zone Rate/Direction/Length pour vérifier le layout
const seq = page.locator('.module-card[data-module-type="step-sequencer"]').first()
await seq.screenshot({ path: 'design/mockups/p3-stepseq.png' })
await browser.close()
