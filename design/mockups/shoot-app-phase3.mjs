import { chromium } from 'playwright'

const shots = [
  { url: 'http://localhost:5173/', name: 'p3-app-default' },
  { url: 'http://localhost:5173/?preset=hammond-leslie', name: 'p3-app-leslie' },
  { url: 'http://localhost:5173/?preset=take-on-me', name: 'p3-app-seq' },
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 })
for (const { url, name } of shots) {
  await page.goto(url)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `design/mockups/${name}.png` })
  console.log(`${name}.png ok`)
}
await browser.close()
