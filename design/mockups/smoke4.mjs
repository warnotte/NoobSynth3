import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 150)))
await page.goto('http://localhost:5173/?preset=seq-acid-bass')
await page.waitForTimeout(3500)
await page.click('.tc-play')
await page.waitForTimeout(2500)
await page.click('text=Mixer')
await page.waitForTimeout(1500)
// read VU fill heights on channel and master strips
const fills = await page.evaluate(() => {
  const get = (sel) =>
    Array.from(document.querySelectorAll(`${sel} .vu-meter-fill`)).map(
      (el) => el.style.height,
    )
  return {
    channel: get('.mixer-strip:not(.mixer-strip-master)'),
    master: get('.mixer-strip-master'),
  }
})
await page.locator('.mixer-strips').screenshot({ path: 'design/mockups/app-mixer-zoom.png' })
console.log(JSON.stringify({ fills, errors: errors.slice(0, 5) }))
await browser.close()
