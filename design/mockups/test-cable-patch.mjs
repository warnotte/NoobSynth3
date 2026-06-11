import { chromium } from 'playwright'

// Création d'un câble au drag jack→jack, rack scrollé (vérifie les
// conversions écran↔contenu du ghost et du snap).
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/?preset=hammond-leslie')
await page.waitForTimeout(3500)

const cableCount = () => page.locator('path.patch-cable:not(.ghost)').count()
const n0 = await cableCount()

// scroller un peu pour tester les conversions hors origine
await page.evaluate(() => { document.querySelector('.rack').scrollTop = 120 })
await page.waitForTimeout(300)

// débrancher organ.out → vca.in via le menu de jack
const organOut = page.locator('.module-card[data-module-type="pipe-organ"] .jack[data-port-direction="out"]').first()
await organOut.click({ button: 'right' })
await page.waitForTimeout(200)
await page.locator('.context-menu-item', { hasText: 'Débrancher' }).first().click()
await page.waitForTimeout(300)
const n1 = await cableCount()

// re-patcher au DRAG : organ.out → vca.in
const vcaIn = page.locator('.module-card[data-module-type="gain"] .jack[data-port-id="in"]').first()
const a = await organOut.boundingBox()
const b = await vcaIn.boundingBox()
await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
await page.mouse.down()
await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 8 })
const ghostMid = await page.locator('path.patch-cable.ghost').count()
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(400)
const n2 = await cableCount()

console.log(JSON.stringify({ n0, n1, ghostMid, n2, repatched: n2 === n0 }))
await browser.close()
