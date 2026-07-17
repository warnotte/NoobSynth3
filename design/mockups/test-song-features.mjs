// E2E des « restes du plan » SONG : lane ▦ PATTERNS (A/B/FILL + capture),
// undo de l'arrangement, transfert step-seq → clip, bande vélocité du piano-roll.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

// ═══ A) Patterns + undo, sur le preset 909-house (drum-sequencer) ═══
await page.goto('http://localhost:5173/?preset=909-house')
await page.waitForSelector('.rack-tabs-view-btn', { timeout: 15000 })
await page.waitForTimeout(1200)
await page.locator('.rack-tabs-view-btn', { hasText: 'Song' }).click()
await page.waitForSelector('.song-view', { timeout: 5000 })

const addPtn = page.locator('.song-label-btn.add', { hasText: '+▦' })
console.log('+▦ visible :', await addPtn.count())
await addPtn.first().click()
await page.waitForTimeout(900) // > fenêtre de coalescence undo
console.log('lane ▦ :', await page.locator('.song-row-ptn').count())
console.log('boutons capture :', await page.locator('.song-label-btn.capture').count())

// chip section 1 : — → A
const chip0 = page.locator('.song-ptn-chip').first()
console.log('chip avant :', (await chip0.textContent())?.trim())
await chip0.click()
await page.waitForTimeout(900)
await chip0.click() // A → B
console.log('chip après 2 clics :', (await chip0.textContent())?.trim(), '(attendu B)')

// capture dans FILL (pas de crash, pas d'exception)
await page.locator('.song-label-btn.capture', { hasText: 'F⟳' }).click()
await page.waitForTimeout(900)

// undo : B → A (le 2e clic était coalescé ? non : espacé de 900ms → entrée propre)
await page.locator('.song-switch', { hasText: '↶' }).click()
console.log('chip après undo :', (await chip0.textContent())?.trim(), '(attendu B→retour état précédent)')
await page.locator('.song-switch', { hasText: '↶' }).click()
console.log('chip après 2e undo :', (await chip0.textContent())?.trim())
await page.locator('.song-switch', { hasText: '↷' }).click()
console.log('chip après redo :', (await chip0.textContent())?.trim())

// ═══ B) Transfert step-seq → clip + vélocité, sur un patch importé ═══
const stepData = JSON.stringify(
  Array.from({ length: 16 }, (_, i) => ({
    pitch: [0, 3, 7, 12][i / 4 | 0],
    gate: i % 4 === 0,
    velocity: 90,
    slide: false,
  })),
)
const patch = {
  version: 1,
  graph: {
    modules: [
      { id: 'seq-1', type: 'step-sequencer', name: 'Steps', position: { x: 0, y: 0 }, params: { stepData, rate: 3, gateLength: 80, length: 16 } },
      { id: 'midi-1', type: 'midi-file-sequencer', name: 'Midi', position: { x: 300, y: 0 }, params: {} },
      { id: 'out-1', type: 'output', name: 'Out', position: { x: 600, y: 0 }, params: { level: 1 } },
    ],
    connections: [],
  },
}
const patchPath = join(tmpdir(), 'song-transfer-test.json')
writeFileSync(patchPath, JSON.stringify(patch))

await page.goto('http://localhost:5173')
await page.waitForSelector('.rack-tabs-view-btn', { timeout: 15000 })
await page.setInputFiles('input.preset-file', patchPath)
await page.waitForTimeout(900)
await page.locator('.rack-tabs-view-btn', { hasText: 'Song' }).click()
await page.waitForSelector('.song-view', { timeout: 5000 })
await page.locator('.song-label-btn.add', { hasText: '+♪' }).first().click()
await page.waitForSelector('.song-pr', { timeout: 3000 })

// transfert : 4 steps gated → 4 notes (69, 72, 76, 81)
await page.locator('.song-pr-transfer').first().click()
await page.waitForTimeout(400)
console.log('notes après transfert :', await page.locator('.song-pr-note').count(), '(attendu 4)')
console.log('velbars :', await page.locator('.song-pr-velbar').count())

// vélocité : clic en HAUT de la bande sur la 1re note (x≈1) → vel ≈ 1
// (locator.click scrolle automatiquement la bande dans la vue du modal)
const vel = page.locator('.song-pr-vel')
const h0 = await page.locator('.song-pr-velbar').first().evaluate((el) => el.style.height)
await vel.click({ position: { x: 3, y: 5 } })
await page.waitForTimeout(200)
const h1 = await page.locator('.song-pr-velbar').first().evaluate((el) => el.style.height)
console.log(`vélocité note 1 : ${h0} → ${h1} (attendu ~100%)`)

await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/song-features.png' })
await page.locator('.song-pr-ok').click()
await browser.close()
console.log('done')
