import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 })
await page.goto('file:///E:/CODEX/NoobSynth3/design/mockups/faceplates-steel.html')
await page.waitForTimeout(1800) // fonts
await page.screenshot({ path: 'design/mockups/faceplates-steel.png', fullPage: true })
await page.screenshot({ path: 'design/mockups/faceplates-crop1.png', clip: { x: 0, y: 60, width: 840, height: 480 } })
await page.screenshot({ path: 'design/mockups/faceplates-crop2.png', clip: { x: 840, y: 60, width: 840, height: 480 } })
console.log('ok')
await browser.close()
