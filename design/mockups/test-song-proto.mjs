// Prototype SONG mode — vérification E2E complète :
// 1. mode RACK|SONG au transport, 2. mutes par section, 3. COURBE de volume
// (points), 4. lane ♪ NOTES : +♪ → piano-roll → pose de notes → vignette →
// compilation midiData. Projet : Lumière (rack 1 = midi-file-sequencer).
// Screenshots → design/mockups/proto-song-*.png
import { chromium } from 'playwright'

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

await page.goto('http://localhost:5173')
await page.waitForSelector('.rack-tabs-view-btn', { timeout: 15000 })

// 1) Charger le projet Lumière (multi-rack, avec MIDI seq)
const projectsHeader = page.locator('.panel-section', { hasText: 'Projects' }).first()
const projectsToggle = projectsHeader.locator('button, .panel-section-header').first()
const lumCard = page.locator('.preset-card', { hasText: 'Lumière' })
if (!(await lumCard.first().isVisible().catch(() => false))) {
  await projectsToggle.click()
  await page.waitForTimeout(400)
}
await lumCard.locator('button', { hasText: 'Load' }).first().click({ timeout: 5000 })
console.log('project loaded: Lumière')
await page.waitForTimeout(1200)

// 2) Vue Song
await page.locator('.rack-tabs-view-btn', { hasText: 'Song' }).click()
await page.waitForSelector('.song-view', { timeout: 5000 })
console.log('lanes:', await page.locator('.song-lane-group').count())

// 3) Lane ♪ NOTES : le rack 1 (midi seq) doit proposer +♪
const addNotesBtn = page.locator('.song-label-btn.add').first()
console.log('+♪ visible :', await addNotesBtn.isVisible())
await addNotesBtn.click()
await page.waitForSelector('.song-pr', { timeout: 3000 })
console.log('piano-roll ouvert')

// Poser 5 notes (clic = pose, la grille snap 1/16)
const grid = page.locator('.song-pr-grid')
const gbox = await grid.boundingBox()
const midY = gbox.y + gbox.height / 2
for (let i = 0; i < 5; i++) {
  const x = gbox.x + 12 + i * 56 // toutes les 4 double-croches
  const y = midY - i * 24 // ligne montante
  await page.mouse.click(x, y)
  await page.waitForTimeout(80)
}
const prNotes = await page.locator('.song-pr-note').count()
console.log('notes posées dans le piano-roll :', prNotes)
// Déplacer la 2e note d'un ton vers le haut (drag)
const n2 = page.locator('.song-pr-note').nth(1)
const nb = await n2.boundingBox()
await page.mouse.move(nb.x + 3, nb.y + nb.height / 2)
await page.mouse.down()
await page.mouse.move(nb.x + 3, nb.y + nb.height / 2 - 24, { steps: 4 })
await page.mouse.up()
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/proto-song-pianoroll.png' })
await page.locator('.song-pr-ok').click()
await page.waitForTimeout(600) // compile (300 ms debounce)
const thumbNotes = await page.locator('.song-row-notes rect').count()
console.log('vignette lane ♪ :', thumbNotes, 'notes')

// 4) COURBE de volume sur la lane 1 : VOL → 2 points
await page.locator('.song-label-btn', { hasText: 'VOL' }).first().click()
const volZone = page.locator('.song-voledit').first()
const vbox = await volZone.boundingBox()
await page.mouse.click(vbox.x + vbox.width * 0.3, vbox.y + vbox.height * 0.7)
await page.waitForTimeout(100)
await page.mouse.click(vbox.x + vbox.width * 0.6, vbox.y + vbox.height * 0.15)
await page.waitForTimeout(100)
console.log('points de courbe :', await page.locator('.song-volpoint').count())

// 5) Mute d'une cellule (lane 2, section 1)
const lane2cells = page.locator('.song-lane-group').nth(1).locator('.song-cell')
await lane2cells.nth(0).click()

// 6) Mode SONG au transport + lecture
await page.locator('.tc-mode-btn.song').click()
await page.locator('.tc-play').click()
await page.waitForTimeout(3500)
console.log('SECTION transport :', await page.locator('.tc-lcd--song .tc-lcd-value').textContent())
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/proto-song-v2.png' })
await page.locator('.tc-play').click()
await browser.close()
console.log('done')
