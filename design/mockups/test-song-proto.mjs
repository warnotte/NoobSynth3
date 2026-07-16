// Prototype SONG mode — E2E complet sur le projet de démo "Studio Song 🎬" :
// arrangement pré-chargé (persistance), lane ♪ précomposée, mode SONG armé,
// lecture, RÈGLE DE SEEK (clic = déplacement), courbes de volume.
// Screenshots → design/mockups/proto-song-*.png
import { chromium } from 'playwright'

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

await page.goto('http://localhost:5173')
await page.waitForSelector('.rack-tabs-view-btn', { timeout: 15000 })

// 1) Charger le projet de démo Studio Song
const projectsHeader = page.locator('.panel-section', { hasText: 'Projects' }).first()
const projectsToggle = projectsHeader.locator('button, .panel-section-header').first()
const card = page.locator('.preset-card', { hasText: 'Studio Song' })
if (!(await card.first().isVisible().catch(() => false))) {
  await projectsToggle.click()
  await page.waitForTimeout(400)
}
await card.locator('button', { hasText: 'Load' }).first().click({ timeout: 5000 })
console.log('project loaded: Studio Song')
await page.waitForTimeout(1200)

// 2) Le song embarqué doit être restauré : mode SONG armé + lanes + notes
const songModeOn = await page.locator('.tc-mode-btn.song.active').count()
console.log('mode SONG armé au chargement :', songModeOn === 1 ? 'oui' : 'NON')
await page.locator('.rack-tabs-view-btn', { hasText: 'Song' }).click()
await page.waitForSelector('.song-view', { timeout: 5000 })
console.log('lanes :', await page.locator('.song-lane-group').count())
console.log('notes lane (vignette) :', await page.locator('.song-row-notes rect').count(), 'notes')
console.log('sections :', await page.locator('.song-section-chip').count())

// 3) Lecture
await page.locator('.tc-play').click()
await page.waitForTimeout(3000)
const lcdBefore = await page.locator('.tc-lcd--song .tc-lcd-value').textContent()
const mesBefore = await page.locator('.tc-lcd .tc-lcd-value').first().textContent()
console.log('avant seek — SECTION :', lcdBefore)
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/proto-song-demo.png' })

// 4) SEEK : clic sur la règle à ~58% (mesure ~19 → DROP)
const ruler = page.locator('.song-ruler')
const rbox = await ruler.boundingBox()
await page.mouse.click(rbox.x + rbox.width * 0.58, rbox.y + rbox.height / 2)
await page.waitForTimeout(700)
const lcdAfter = await page.locator('.tc-lcd--song .tc-lcd-value').textContent()
console.log('après seek 58% — SECTION :', lcdAfter, '(attendu DROP)')
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/proto-song-seek.png' })

// 5) Seek en arrière vers l'INTRO (8%)
await page.mouse.click(rbox.x + rbox.width * 0.08, rbox.y + rbox.height / 2)
await page.waitForTimeout(700)
console.log('après seek 8% — SECTION :', await page.locator('.tc-lcd--song .tc-lcd-value').textContent(), '(attendu INTRO)')

// 6) Vérifier que la mesure du transport a bien bougé
console.log('MEASURE avant/maintenant :', mesBefore, '/', await page.locator('.tc-lcd .tc-lcd-value').first().textContent())

await page.locator('.tc-play').click()
await browser.close()
console.log('done')
