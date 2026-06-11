import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173/?preset=debug-tr909-machine')
await page.waitForTimeout(3000)
await page.click('.tc-play')
await page.waitForTimeout(2000)
const playing = []
for (let i = 0; i < 4; i++) {
  playing.push(await page.evaluate(() => !!document.querySelector('.dm909-step.playing')))
  await page.waitForTimeout(300)
}
const card = page.locator('.module-card[data-module-type="drum-machine-909"]').first()
await card.scrollIntoViewIfNeeded()
await card.screenshot({ path: 'design/mockups/p3-dm909.png' })
console.log('dm909 playhead present:', JSON.stringify(playing))
await browser.close()
