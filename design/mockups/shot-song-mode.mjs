import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'

const html = 'E:/CODEX/NoobSynth3/design/mockups/song-mode.html'
const out = 'E:/CODEX/NoobSynth3/design/mockups/song-mode.png'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.goto(pathToFileURL(html).href)
await page.waitForTimeout(1200) // laisse les webfonts arriver
await page.screenshot({ path: out })
await browser.close()
console.log('saved', out)
