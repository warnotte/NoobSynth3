import { chromium, devices } from 'playwright'

// État des lieux mobile — iPhone 13 (390×844) + petit Android (360×800) + paysage
const browser = await chromium.launch()

const scenarios = [
  { name: 'm-iphone-rack', device: devices['iPhone 13'], url: '/?preset=hammond-leslie' },
  { name: 'm-iphone-default', device: devices['iPhone 13'], url: '/' },
  { name: 'm-android-rack', device: devices['Galaxy S9+'], url: '/?preset=hammond-leslie' },
  { name: 'm-iphone-landscape', device: devices['iPhone 13 landscape'], url: '/?preset=hammond-leslie' },
]

for (const { name, device, url } of scenarios) {
  const ctx = await browser.newContext({ ...device })
  const page = await ctx.newPage()
  await page.goto(`http://localhost:5173${url}`)
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `design/mockups/${name}.png` })
  console.log(`${name}.png ok (${device.viewport.width}x${device.viewport.height})`)
  await ctx.close()
}

// drawer ouvert (FAB) + vue mixer sur iPhone
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
await page.goto('http://localhost:5173/?preset=hammond-leslie')
await page.waitForTimeout(3500)
const fab = page.locator('.side-panel-fab, [class*="fab"]').first()
if ((await fab.count()) > 0) {
  await fab.click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'design/mockups/m-iphone-drawer.png' })
  console.log('m-iphone-drawer.png ok')
  // le drawer se ferme par le X (ou le backdrop) — Échap n'est pas câblé, par choix
  await page.click('.side-panel-close')
  await page.waitForTimeout(400)
} else {
  console.log('FAB introuvable')
}
await page.click('text=MIXER')
await page.waitForTimeout(800)
await page.screenshot({ path: 'design/mockups/m-iphone-mixer.png' })
console.log('m-iphone-mixer.png ok')
await ctx.close()
await browser.close()
