import { chromium } from 'playwright'

const shots = [
  { preset: 'granular-test', type: 'granular', name: 'p3-granular' },
  { preset: 'particle-cloud-demo', type: 'particle-cloud', name: 'p3-particle' },
  { preset: 'sampler-demo', type: 'sampler', name: 'p3-sampler' },
  { preset: null, type: 'scope', name: 'p3-scope' },
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 })
for (const { preset, type, name } of shots) {
  await page.goto(`http://localhost:5173/${preset ? `?preset=${preset}` : ''}`)
  await page.waitForTimeout(3000)
  const card = page.locator(`.module-card[data-module-type="${type}"]`).first()
  if ((await card.count()) === 0) {
    console.log(`${name}: MODULE ABSENT`)
    continue
  }
  await card.scrollIntoViewIfNeeded()
  await card.screenshot({ path: `design/mockups/${name}.png` })
  console.log(`${name}.png ok`)
}
await browser.close()
