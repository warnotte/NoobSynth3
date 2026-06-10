import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1720, height: 1200 }, deviceScaleFactor: 2 })
await page.goto('file:///E:/CODEX/NoobSynth3/design/mockups/faceplates-steel.html')
await page.waitForTimeout(1800) // fonts
await page.screenshot({ path: 'design/mockups/faceplates-steel.png', fullPage: true })
// crops de contrôle
await page.screenshot({ path: 'design/mockups/faceplates-crop1.png', clip: { x: 24, y: 70, width: 850, height: 530 } })
await page.screenshot({ path: 'design/mockups/faceplates-crop2.png', clip: { x: 874, y: 70, width: 820, height: 530 } })
await page.screenshot({ path: 'design/mockups/faceplates-crop3.png', clip: { x: 24, y: 320, width: 850, height: 560 } })
console.log('ok')
await browser.close()
