import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(4000)
// nudge: dispatch a resize so usePatching recomputes port positions
await page.evaluate(() => window.dispatchEvent(new Event('resize')))
await page.waitForTimeout(1200)
await page.screenshot({ path: 'design/mockups/app-rack2.png' })

// diagnostic: compare one cable endpoint vs its jack position
const diag = await page.evaluate(() => {
  const jack = document.querySelector('[data-port-key]')
  const rect = jack?.getBoundingClientRect()
  const path = document.querySelector('.patch-cable')
  const d = path?.getAttribute('d')
  return { portKey: jack?.dataset.portKey, jackCenter: rect ? [rect.left + rect.width / 2, rect.top + rect.height / 2] : null, firstPath: d?.slice(0, 60) }
})
console.log(JSON.stringify(diag))
await browser.close()
