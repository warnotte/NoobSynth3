import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173/?preset=take-on-me')
await page.waitForTimeout(3000)

const pitch = page.locator('.seq-step[data-step="1"] .seq-step-pitch').first()
await pitch.scrollIntoViewIfNeeded()
const box = await pitch.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

// clic droit sur la cellule pitch : −1 demi-ton SANS menu contextuel module
const before = await pitch.textContent()
await page.mouse.click(cx, cy, { button: 'right' })
await page.waitForTimeout(300)
const after = await pitch.textContent()
const menuOpen = await page.evaluate(
  () => !!document.querySelector('.context-menu, [class*="context-menu"]'),
)
console.log(JSON.stringify({ before, after, menuOpen }))

const seq = page.locator('.module-card[data-module-type="step-sequencer"]').first()
await seq.screenshot({ path: 'design/mockups/p3-stepseq.png' })
await browser.close()
