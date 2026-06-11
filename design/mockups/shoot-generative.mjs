import { chromium } from 'playwright'

const shots = [
  { preset: 'game-of-life-generative', type: 'game-of-life', name: 'p3-gol' },
  { preset: 'gravity-orbits', type: 'gravity-sequencer', name: 'p3-gravity' },
  { preset: 'chord-sequencer-test', type: 'chord-sequencer', name: 'p3-chord' },
  { preset: 'polyrhythm-test', type: 'polyrhythm-sequencer', name: 'p3-poly' },
  { preset: 'turing-poly', type: 'turing-machine', name: 'p3-turing' },
  { preset: 'euclidean-poly', type: 'euclidean', name: 'p3-euclid' },
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 })
for (const { preset, type, name } of shots) {
  await page.goto(`http://localhost:5173/?preset=${preset}`)
  await page.waitForTimeout(3000)
  const card = page.locator(`.module-card[data-module-type="${type}"]`).first()
  if ((await card.count()) === 0) {
    console.log(`${name}: MODULE ABSENT du preset ${preset}`)
    continue
  }
  await card.scrollIntoViewIfNeeded()
  await card.screenshot({ path: `design/mockups/${name}.png` })
  console.log(`${name}.png ok`)
}
await browser.close()
