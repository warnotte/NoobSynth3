// E2E phase 3 SONG : transferts statiques chord/euclidean → clip, et ⏺ REC
// (recorder cv/gate moteur) d'un turing-machine clocké, en vraie lecture Web.
// Prérequis : dev server sur :5173.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

const importPatch = async (patch, name) => {
  const patchPath = join(tmpdir(), name)
  writeFileSync(patchPath, JSON.stringify(patch))
  await page.goto('http://localhost:5173')
  await page.waitForSelector('.rack-tabs-view-btn', { timeout: 15000 })
  await page.setInputFiles('input.preset-file', patchPath)
  await page.waitForTimeout(900)
}

// ═══ A) Transferts statiques : chord-sequencer + euclidean → clip ═══
// chord par défaut : C/Am/F/G (4 steps gated, length 4) → 4 accords × 3 notes = 12
// euclidean par défaut : E(4,16) → 4 notes (note fixe 69)
await importPatch(
  {
    version: 1,
    graph: {
      modules: [
        { id: 'chord-1', type: 'chord-sequencer', name: 'Chords', position: { x: 0, y: 0 }, params: {} },
        { id: 'euclid-1', type: 'euclidean', name: 'Euclid', position: { x: 300, y: 0 }, params: {} },
        { id: 'midi-1', type: 'midi-file-sequencer', name: 'Midi', position: { x: 600, y: 0 }, params: {} },
        { id: 'out-1', type: 'output', name: 'Out', position: { x: 900, y: 0 }, params: { level: 1 } },
      ],
      connections: [],
    },
  },
  'song-rec-test-static.json',
)
await page.locator('.rack-tabs-view-btn', { hasText: 'Song' }).click()
await page.waitForSelector('.song-view', { timeout: 5000 })
await page.locator('.song-label-btn.add', { hasText: '+♪' }).first().click()
await page.waitForSelector('.song-pr', { timeout: 3000 })

const transferBtns = page.locator('.song-pr-transfer:not(.song-pr-rec)')
console.log('boutons ⇐ :', await transferBtns.count(), '(attendu 2 : Chords + Euclid)')
await transferBtns.filter({ hasText: 'Chords' }).click()
await page.waitForTimeout(400)
console.log('notes après ⇐ Chords :', await page.locator('.song-pr-note').count(), '(attendu 12 = 4 accords × 3 notes)')
await transferBtns.filter({ hasText: 'Euclid' }).click()
await page.waitForTimeout(400)
console.log('notes après ⇐ Euclid :', await page.locator('.song-pr-note').count(), '(attendu 16 = 12 + E(4,16))')

// ═══ B) ⏺ REC : clock → turing-machine, enregistrement 1 mesure en lecture ═══
await importPatch(
  {
    version: 1,
    graph: {
      modules: [
        { id: 'clk-1', type: 'clock', name: 'Clock', position: { x: 0, y: 0 }, params: {} },
        { id: 'turing-1', type: 'turing-machine', name: 'Turing', position: { x: 300, y: 0 }, params: {} },
        { id: 'midi-1', type: 'midi-file-sequencer', name: 'Midi', position: { x: 600, y: 0 }, params: {} },
        { id: 'out-1', type: 'output', name: 'Out', position: { x: 900, y: 0 }, params: { level: 1 } },
      ],
      connections: [
        { from: { moduleId: 'clk-1', portId: 'clock' }, to: { moduleId: 'turing-1', portId: 'clock' }, kind: 'sync' },
      ],
    },
  },
  'song-rec-test-gen.json',
)
await page.locator('.tc-play').click() // transport en marche (le REC l'exige)
await page.waitForTimeout(800)
await page.locator('.rack-tabs-view-btn', { hasText: 'Song' }).click()
await page.waitForSelector('.song-view', { timeout: 5000 })
await page.locator('.song-label-btn.add', { hasText: '+♪' }).first().click()
await page.waitForSelector('.song-pr', { timeout: 3000 })

const recBtn = page.locator('.song-pr-rec')
console.log('bouton ⏺ :', await recBtn.count(), '· activé :', await recBtn.first().isEnabled(), '(attendu 1 · true)')
await page.locator('.song-pr-recbars').selectOption('1')
await recBtn.first().click()
await page.waitForSelector('.song-pr-recstate', { timeout: 3000 })
console.log('état REC :', (await page.locator('.song-pr-recstate').textContent())?.trim())

// armé → départ à la prochaine mesure → 1 mesure d'enregistrement (~2 s à 120)
let notes = 0
for (let i = 0; i < 30; i += 1) {
  await page.waitForTimeout(500)
  if ((await page.locator('.song-pr-recstate').count()) === 0) {
    notes = await page.locator('.song-pr-note').count()
    break
  }
}
console.log('notes enregistrées :', notes, '(attendu > 0 — gates du turing clockés)')
console.log(notes > 0 ? 'done' : 'FAIL: aucune note capturée')
await browser.close()
process.exit(notes > 0 ? 0 : 1)
