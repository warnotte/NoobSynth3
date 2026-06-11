import { chromium } from 'playwright'

// Changement de preset EN COURS DE LECTURE (in-app, pas un reload) :
// avant le fix, l'ancien worklet zombie continuait de poster ses beats
// → mesure clignotant entre deux valeurs / ne repartant pas de zéro.
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/?preset=hammond-leslie')
await page.waitForTimeout(3000)

const lcd = () => page.locator('.tc-lcd--small .tc-lcd-value').first().textContent()

await page.click('.tc-play')
await page.waitForTimeout(5000)
const beforeSwitch = await lcd()

// ouvrir la section PRESETS du drawer et charger take-on-me
await page.click('text=PRESETS')
await page.waitForTimeout(500)
const search = page.locator('.side-panel input[type="search"], .side-panel input[type="text"]').first()
if ((await search.count()) > 0) {
  await search.fill('take on me')
  await page.waitForTimeout(400)
}
const card = page.locator('.preset-card', { hasText: 'Take On Me' }).first()
await card.locator('.preset-load').click()
await page.waitForTimeout(3500)

// échantillonner la mesure : une seule série croissante attendue, partie de ~1:1
const samples = []
for (let i = 0; i < 8; i++) {
  samples.push(await lcd())
  await page.waitForTimeout(400)
}
console.log(JSON.stringify({ beforeSwitch, samples }))
await browser.close()
