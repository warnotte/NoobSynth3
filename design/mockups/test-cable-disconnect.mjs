import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/?preset=hammond-leslie')
await page.waitForTimeout(3500)

const cableCount = () => page.locator('path.patch-cable:not(.ghost)').count()
// point au milieu de la courbe du premier câble (coordonnées client = user units, viewBox 1:1)
const midOfFirstCable = () =>
  page.evaluate(() => {
    const p = document.querySelector('path.patch-cable:not(.ghost)')
    if (!p) return null
    const m = p.getPointAtLength(p.getTotalLength() / 2)
    return { x: m.x, y: m.y }
  })

const n0 = await cableCount()

// 1) survol du câble → highlight + chip ✂ → clic = débranché
let mid = await midOfFirstCable()
await page.mouse.move(mid.x, mid.y)
await page.waitForTimeout(300)
const hovered = await page.locator('path.patch-cable.hovered').count()
const chipVisible = await page.locator('.cable-cut').count()
await page.locator('.cable-cut').click()
await page.waitForTimeout(300)
const n1 = await cableCount()

// 2) alt-clic sur le câble suivant = débranché
mid = await midOfFirstCable()
await page.mouse.move(mid.x, mid.y)
await page.waitForTimeout(200)
await page.keyboard.down('Alt')
await page.mouse.click(mid.x, mid.y)
await page.keyboard.up('Alt')
await page.waitForTimeout(300)
const n2 = await cableCount()

// 3) clic droit sur un jack de SORTIE connecté → menu → débrancher
const outJack = page.locator('.jack[data-port-direction="out"]').first()
await outJack.click({ button: 'right' })
await page.waitForTimeout(300)
const menuItems = await page.locator('.context-menu-item').allTextContents()
const cutItem = page.locator('.context-menu-item', { hasText: 'Débrancher' }).first()
let n3 = n2
if ((await cutItem.count()) > 0) {
  await cutItem.click()
  await page.waitForTimeout(300)
  n3 = await cableCount()
} else {
  await page.keyboard.press('Escape')
}

// 4) undo ramène les câbles
await page.keyboard.press('Control+z')
await page.keyboard.press('Control+z')
await page.keyboard.press('Control+z')
await page.waitForTimeout(400)
const n4 = await cableCount()

console.log(JSON.stringify({ n0, hovered, chipVisible, n1, n2, menuItems, n3, n4 }))
await browser.close()
