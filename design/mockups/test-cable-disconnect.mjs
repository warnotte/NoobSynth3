import { chromium } from 'playwright'

// Déconnexion des câbles : chaque geste rapide (ciseaux, alt-clic, dbl-clic)
// ouvre une CONFIRMATION Débrancher/Annuler ; le menu de jack reste direct.
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/?preset=hammond-leslie')
await page.waitForTimeout(3500)

const cableCount = () => page.locator('path.patch-cable:not(.ghost)').count()
const midOfFirstCable = () =>
  page.evaluate(() => {
    const p = document.querySelector('path.patch-cable:not(.ghost)')
    if (!p) return null
    const m = p.getPointAtLength(p.getTotalLength() / 2)
    // coordonnées CONTENU du rack → coordonnées écran pour la souris
    const rack = document.querySelector('.rack')
    const r = rack.getBoundingClientRect()
    return { x: m.x + r.left - rack.scrollLeft, y: m.y + r.top - rack.scrollTop }
  })
const confirmItem = () => page.locator('.context-menu-item', { hasText: 'Débrancher ce câble' })

const n0 = await cableCount()

// 1) ciseaux → confirmation → Débrancher
let mid = await midOfFirstCable()
await page.mouse.move(mid.x, mid.y)
await page.waitForTimeout(300)
await page.locator('.cable-cut').click()
await page.waitForTimeout(200)
const confirmShown = await confirmItem().count()
await confirmItem().click()
await page.waitForTimeout(300)
const n1 = await cableCount()

// 2) ciseaux → Annuler = rien coupé
mid = await midOfFirstCable()
await page.mouse.move(mid.x, mid.y)
await page.waitForTimeout(300)
await page.locator('.cable-cut').click()
await page.waitForTimeout(200)
await page.locator('.context-menu-item', { hasText: 'Annuler' }).click()
await page.waitForTimeout(300)
const n2 = await cableCount()

// 3) alt-clic → confirmation → Débrancher
mid = await midOfFirstCable()
await page.mouse.move(mid.x, mid.y)
await page.waitForTimeout(200)
await page.keyboard.down('Alt')
await page.mouse.click(mid.x, mid.y)
await page.keyboard.up('Alt')
await page.waitForTimeout(200)
await confirmItem().click()
await page.waitForTimeout(300)
const n3 = await cableCount()

// 4) dbl-clic → confirmation → Échap = rien coupé
mid = await midOfFirstCable()
await page.mouse.dblclick(mid.x, mid.y)
await page.waitForTimeout(200)
const dblConfirmShown = await confirmItem().count()
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
const n4 = await cableCount()

// 5) menu de jack (direct, pas de double confirmation)
const jack = page.locator('.module-card[data-module-type="pipe-organ"] .jack[data-port-direction="out"]').first()
await jack.click({ button: 'right' })
await page.waitForTimeout(200)
const jackItems = await page.locator('.context-menu-item').allTextContents()
await page.keyboard.press('Escape')

console.log(JSON.stringify({ n0, confirmShown, n1, n2, n3, dblConfirmShown, n4, jackItems }))
await browser.close()
