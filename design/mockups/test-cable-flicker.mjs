import { chromium } from 'playwright'

// Anti-clignotement : balayage en petits pas LE LONG du câble puis arrivée
// SUR la croix ✂ — le chip doit rester visible à chaque échantillon.
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/?preset=hammond-leslie')
await page.waitForTimeout(3500)

const pts = await page.evaluate(() => {
  const p = document.querySelector('path.patch-cable:not(.ghost)')
  const len = p.getTotalLength()
  const out = []
  // du quart au milieu de la courbe, pas de ~3px
  for (let l = len * 0.25; l <= len * 0.5; l += 3) {
    const m = p.getPointAtLength(l)
    out.push({ x: m.x, y: m.y })
  }
  return out
})

let samples = 0
let missing = 0
// approche initiale
await page.mouse.move(pts[0].x, pts[0].y)
await page.waitForTimeout(150)
for (const pt of pts) {
  await page.mouse.move(pt.x, pt.y)
  await page.waitForTimeout(35)
  samples++
  if ((await page.locator('.cable-cut').count()) === 0) missing++
}

// arrivée sur la croix (au milieu) puis micro-mouvements dessus
const mid = pts[pts.length - 1]
for (const d of [0, 1, -1, 2, -2, 1, 0]) {
  await page.mouse.move(mid.x + d, mid.y + d)
  await page.waitForTimeout(40)
  samples++
  if ((await page.locator('.cable-cut').count()) === 0) missing++
}

console.log(JSON.stringify({ samples, missing }))
await browser.close()
