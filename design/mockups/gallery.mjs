/**
 * Galerie des modules — étape 5 phase 3.
 *
 * Construit un graphe contenant UN module de chaque type (parsé depuis
 * moduleRegistry.ts), le charge via le bouton Import de la BrandRail
 * (l'input .preset-file — aucun preset dans public/presets/ → la CI Rust
 * n'est pas impactée; NB: la voie ?patch= est cassée, voir follow-ups),
 * screenshote chaque module dans design/gallery/<type>.png et signale
 * les débordements.
 *
 * Usage : node design/mockups/gallery.mjs   (dev server sur :5173 requis)
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { chromium } from 'playwright'

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const registry = readFileSync(`${ROOT}src/state/moduleRegistry.ts`, 'utf8')

// tailles : seules les valeurs 'NxN' existent dans moduleSizes
const sizes = {}
for (const m of registry.matchAll(/'?([a-z0-9-]+)'?:\s*'(\d+)x(\d+)'/g)) {
  sizes[m[1]] = { w: Number(m[2]), h: Number(m[3]) }
}

// catalogue : type + label + catégorie (ordre du fichier = ordre des catégories)
const catalog = []
for (const m of registry.matchAll(/\{ type: '([a-z0-9-]+)', label: '([^']+)', category: '([a-z]+)' \}/g)) {
  catalog.push({ type: m[1], label: m[2], category: m[3] })
}
if (catalog.length < 90) {
  console.error(`Parse suspect : ${catalog.length} modules trouvés dans moduleCatalog`)
  process.exit(1)
}

// shelf packing sur 6 colonnes (la grille du rack à 1680px de viewport)
const RACK_W = 6
let x = 0
let y = 0
let rowH = 0
const modules = catalog.map((entry, i) => {
  const size = sizes[entry.type] ?? { w: 1, h: 1 }
  if (x + size.w > RACK_W) {
    x = 0
    y += rowH
    rowH = 0
  }
  const mod = {
    id: `gal-${entry.type}`,
    type: entry.type,
    name: entry.label,
    position: { x, y },
    params: {},
  }
  x += size.w
  rowH = Math.max(rowH, size.h)
  return mod
})

const graph = { modules, connections: [] }
console.log(`${modules.length} modules`)

mkdirSync(`${ROOT}design/gallery`, { recursive: true })
if (!existsSync(`${ROOT}design/gallery/.gitignore`)) {
  writeFileSync(`${ROOT}design/gallery/.gitignore`, '*.png\ngallery-graph.json\n')
}
const graphPath = `${ROOT}design/gallery/gallery-graph.json`
// format d'import v1 : { version: 1, graph }
writeFileSync(graphPath, JSON.stringify({ version: 1, graph }))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 })
page.on('pageerror', (err) => console.log('[pageerror]', err.message))
await page.goto('http://localhost:5173/')
await page.waitForTimeout(3000)
await page.setInputFiles('input.preset-file', graphPath)
await page.waitForTimeout(6000)

const found = await page.evaluate(() => document.querySelectorAll('.module-card').length)
console.log(`${found} module-cards rendues`)

// débordements
const overflows = await page.evaluate(() => {
  const out = []
  document.querySelectorAll('.module-card').forEach((card) => {
    const ctl = card.querySelector('.module-controls')
    if (!ctl) return
    const over = ctl.scrollHeight - ctl.clientHeight
    if (over > 2) out.push(`${card.dataset.moduleType} +${over}px`)
  })
  return out
})
console.log(overflows.length ? `DÉBORDEMENTS:\n  ${overflows.join('\n  ')}` : 'Aucun débordement')

// screenshot par module
let shot = 0
for (const mod of modules) {
  const card = page.locator(`.module-card[data-module-type="${mod.type}"]`).first()
  if ((await card.count()) === 0) {
    console.log(`ABSENT: ${mod.type}`)
    continue
  }
  await card.scrollIntoViewIfNeeded()
  await card.screenshot({ path: `${ROOT}design/gallery/${mod.type}.png` })
  shot++
}
console.log(`${shot}/${modules.length} screenshots dans design/gallery/`)
await browser.close()
