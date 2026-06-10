import { chromium } from 'playwright'

const files = ['console-mixer-steel']
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
for (const name of files) {
  await page.goto(`file:///E:/CODEX/NoobSynth3/design/mockups/${name}.html`)
  await page.waitForTimeout(1800) // fonts
  await page.screenshot({ path: `design/mockups/${name}.png` })
  console.log(`${name}.png ok`)
}
await browser.close()
