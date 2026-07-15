import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'

const shots = [
  ['E:/CODEX/NoobSynth3/design/mockups/song-mode.html', 'E:/CODEX/NoobSynth3/design/mockups/song-mode.png'],
  ['E:/CODEX/NoobSynth3/design/mockups/song-pianoroll.html', 'E:/CODEX/NoobSynth3/design/mockups/song-pianoroll.png'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
for (const [html, out] of shots) {
  await page.goto(pathToFileURL(html).href)
  await page.waitForTimeout(1200) // laisse les webfonts arriver
  await page.screenshot({ path: out })
  console.log('saved', out)
}
await browser.close()
