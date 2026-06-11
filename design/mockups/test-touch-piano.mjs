import { chromium, devices } from 'playwright'

// Piano au doigt : touch sur une touche → classe active ; popup Expand sur mobile.
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
await page.goto('http://localhost:5173/?preset=hammond-leslie')
await page.waitForTimeout(3500)

const piano = page.locator('.piano-keyboard').first()
await piano.scrollIntoViewIfNeeded()
const key = page.locator('.piano-key--white').nth(3)
const box = await key.boundingBox()

const cdp = await ctx.newCDPSession(page)
const touch = (type, x, y) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })

await touch('touchStart', box.x + box.width / 2, box.y + box.height - 8)
await page.waitForTimeout(250)
const activeDuringTouch = await page.evaluate(() => !!document.querySelector('.piano-key.active'))
await touch('touchEnd', box.x + box.width / 2, box.y + box.height - 8)
await page.waitForTimeout(250)
const activeAfterRelease = await page.evaluate(() => !!document.querySelector('.piano-key.active'))

// popup Expand
let popupShot = 'absent'
const expand = page.locator('button', { hasText: 'Expand' }).first()
if ((await expand.count()) > 0) {
  await expand.tap()
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'design/mockups/m-iphone-kbpopup.png' })
  popupShot = 'm-iphone-kbpopup.png'
}

console.log(JSON.stringify({ activeDuringTouch, activeAfterRelease, popupShot }))
await browser.close()
