import { chromium } from 'playwright'

const browser = await chromium.launch()

// Desktop: start the engine, check the DSP LCD goes live
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 150)))
await page.goto('http://localhost:5173/')
await page.waitForTimeout(3000)
await page.click('.tc-play')
await page.waitForTimeout(2500)
const load = await page.textContent('.tc-vu-group .tc-lcd-value')
await page.screenshot({ path: 'design/mockups/app-desktop-running.png' })
await page.close()

// Mobile: 390x844
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
mob.on('pageerror', (e) => errors.push('MOB: ' + String(e).slice(0, 150)))
await mob.goto('http://localhost:5173/')
await mob.waitForTimeout(3000)
await mob.screenshot({ path: 'design/mockups/app-mobile.png' })
await mob.click('.side-panel-fab')
await mob.waitForTimeout(600)
await mob.screenshot({ path: 'design/mockups/app-mobile-drawer.png' })
await browser.close()
console.log(JSON.stringify({ load, errors: errors.slice(0, 5) }))
