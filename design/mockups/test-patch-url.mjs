import LZString from 'lz-string'
import { chromium } from 'playwright'

// Lien partagé ?patch= : le graphe encodé doit s'afficher (et pas le défaut).
const graph = {
  modules: [
    { id: 'osc-1', type: 'oscillator', name: 'VCO PARTAGÉ', position: { x: 0, y: 0 }, params: {} },
    { id: 'vcf-1', type: 'vcf', name: 'FILTRE', position: { x: 2, y: 0 }, params: {} },
    { id: 'out-1', type: 'output', name: 'OUT', position: { x: 4, y: 0 }, params: {} },
  ],
  connections: [
    { from: { moduleId: 'osc-1', portId: 'out' }, to: { moduleId: 'vcf-1', portId: 'in' }, kind: 'audio' },
    { from: { moduleId: 'vcf-1', portId: 'out' }, to: { moduleId: 'out-1', portId: 'in' }, kind: 'audio' },
  ],
}
const patch = LZString.compressToEncodedURIComponent(JSON.stringify(graph))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto(`http://localhost:5173/?patch=${patch}`)
await page.waitForTimeout(4000)
const r = await page.evaluate(() => ({
  cards: document.querySelectorAll('.module-card').length,
  names: [...document.querySelectorAll('.module-name')].map((e) => e.textContent),
  cables: document.querySelectorAll('.patch-layer path[class*="cable"]').length,
  search: location.search,
}))
console.log(JSON.stringify(r, null, 1))
await browser.close()
