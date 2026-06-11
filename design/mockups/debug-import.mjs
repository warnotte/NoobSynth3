import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const graphPath = 'design/gallery/debug-one.json'
writeFileSync(
  graphPath,
  JSON.stringify({
    modules: [{ id: 'dbg-osc', type: 'oscillator', name: 'VCO DBG', position: { x: 0, y: 0 }, params: {} }],
    connections: [],
  }),
)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
page.on('console', (m) => console.log('[console]', m.text().slice(0, 300)))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/')
await page.waitForTimeout(3000)
await page.setInputFiles('input.preset-file', graphPath)
await page.waitForTimeout(3000)
const r = await page.evaluate(() => ({
  cards: document.querySelectorAll('.module-card').length,
  names: [...document.querySelectorAll('.module-name')].slice(0, 3).map((e) => e.textContent),
  errors: [...document.querySelectorAll('[class*="error"]')].map((e) => e.textContent?.slice(0, 120)).filter(Boolean),
}))
console.log(JSON.stringify(r, null, 1))
await browser.close()
