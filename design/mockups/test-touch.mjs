import { chromium, devices } from 'playwright'

// Teste les gestes tactiles réels (CDP touch events) : drag vertical sur un
// knob, tap sur un bouton — le cœur du scope « jouer + tweaker » mobile.
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
await page.goto('http://localhost:5173/?preset=hammond-leslie')
await page.waitForTimeout(3500)

const knob = page.locator('.module-card[data-module-type="pipe-organ"] .rotary-dial').first()
await knob.scrollIntoViewIfNeeded()
const readout = page.locator('.module-card[data-module-type="pipe-organ"] .rotary-readout').first()
const before = await readout.textContent()

const box = await knob.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

const cdp = await ctx.newCDPSession(page)
const touch = (type, x, y) =>
  cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
  })

// drag tactile : 40px vers le haut
await touch('touchStart', cx, cy)
for (let i = 1; i <= 8; i++) {
  await touch('touchMove', cx, cy - i * 5)
  await page.waitForTimeout(30)
}
await touch('touchEnd', cx, cy - 40)
await page.waitForTimeout(400)
const afterDrag = await readout.textContent()

// drag dans la zone ÉTENDUE (10px à côté du dial, pointer coarse)
const before2 = await readout.textContent()
await touch('touchStart', box.x - 6, cy)
for (let i = 1; i <= 6; i++) {
  await touch('touchMove', box.x - 6, cy + i * 5)
  await page.waitForTimeout(30)
}
await touch('touchEnd', box.x - 6, cy + 30)
await page.waitForTimeout(400)
const afterEdgeDrag = await readout.textContent()

// tap tactile sur un toggle (PC KEYS du clavier)
const pcKeys = page.locator('.module-card[data-module-type="control"] .toggle-btn', { hasText: 'PC Keys' }).first()
let tapResult = 'absent'
if ((await pcKeys.count()) > 0) {
  await pcKeys.scrollIntoViewIfNeeded()
  const cls0 = (await pcKeys.getAttribute('class')) ?? ''
  await pcKeys.tap()
  await page.waitForTimeout(300)
  const cls1 = (await pcKeys.getAttribute('class')) ?? ''
  tapResult = cls0.includes('active') !== cls1.includes('active') ? 'toggle OK' : 'pas de changement'
}

console.log(JSON.stringify({ before, afterDrag, before2, afterEdgeDrag, tapResult }))
await browser.close()
