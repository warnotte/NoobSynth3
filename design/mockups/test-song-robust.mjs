// E2E robustesse SONG (ex-Session 6 du plan de test, automatisée) :
// A) export → import d'un projet avec song = fidèle (sections, lanes ♪, mode armé)
// B) vieux projet SANS song (Élégie) = zéro crash, song désactivé
// C) suppression d'un rack qui a une lane ♪ = pas de crash, lane disparue
// D) suppression d'une section référencée par des chips ▦ = pas de crash
// E) F5 en pleine lecture = l'app revient propre
// Prérequis : dev server sur :5173.
import { chromium } from 'playwright'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const errors = []
page.on('pageerror', (err) => {
  errors.push(err.message)
  console.log('PAGE ERROR:', err.message)
})
page.on('dialog', (dialog) => dialog.accept()) // confirm() de suppression de rack

const loadProjectCard = async (cardText) => {
  await page.goto('http://localhost:5173')
  await page.waitForSelector('.rack-tabs-view-btn', { timeout: 15000 })
  const projectsHeader = page.locator('.panel-section', { hasText: 'Projects' }).first()
  const card = page.locator('.preset-card', { hasText: cardText })
  if (!(await card.first().isVisible().catch(() => false))) {
    await projectsHeader.locator('button, .panel-section-header').first().click()
    await page.waitForTimeout(400)
  }
  await card.locator('button', { hasText: 'Load' }).first().click({ timeout: 5000 })
  await page.waitForTimeout(1500)
}

const songCounts = async () => {
  await page.locator('.rack-tabs-view-btn', { hasText: 'Song' }).click()
  await page.waitForSelector('.song-view', { timeout: 5000 })
  return {
    sections: await page.locator('.song-section-chip').count(),
    notesLanes: await page.locator('.song-row-notes').count(),
    modeArmed: (await page.locator('.tc-mode-btn.song.active').count()) === 1,
  }
}

// ═══ A) Export → import : le song survit au roundtrip ═══
await loadProjectCard('NOVA ⚡')
const before = await songCounts()
console.log('A · avant export :', JSON.stringify(before))
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('.rail-patch-actions .rail-btn').first().click(),
])
const exported = join(tmpdir(), 'song-robust-roundtrip.json')
await download.saveAs(exported)
await page.goto('http://localhost:5173') // état vierge
await page.waitForSelector('.rack-tabs-view-btn', { timeout: 15000 })
await page.setInputFiles('input.preset-file', exported)
await page.waitForTimeout(1500)
const after = await songCounts()
console.log('A · après import :', JSON.stringify(after))
const roundtripOk =
  before.sections === after.sections &&
  before.notesLanes === after.notesLanes &&
  before.modeArmed &&
  after.modeArmed
console.log('A · roundtrip fidèle :', roundtripOk)

// ═══ C) (on est sur NOVA importé) supprimer LE rack qui a une lane ♪ ═══
// repérer l'index du groupe de lanes contenant une .song-row-notes → même index d'onglet
const groups = await page.locator('.song-lane-group').all()
let laneRackIndex = -1
for (let i = 0; i < groups.length; i += 1) {
  if ((await groups[i].locator('.song-row-notes').count()) > 0) {
    laneRackIndex = i
    break
  }
}
console.log('C · rack porteur de la 1re lane ♪ : index', laneRackIndex)
await page.locator('.rack-tabs-view-btn', { hasText: 'Racks' }).click()
await page.waitForTimeout(300)
const tabsBefore = await page.locator('.rack-tab-close').count()
await page.locator('.rack-tab-close').nth(laneRackIndex).click()
await page.waitForTimeout(800)
console.log('C · onglets racks :', tabsBefore, '→', await page.locator('.rack-tab-close').count())
const afterRemove = await songCounts()
console.log('C · lanes ♪ après suppression :', afterRemove.notesLanes, `(avant : ${after.notesLanes}, attendu ${after.notesLanes - 1})`)
console.log('C · pas de crash :', errors.length === 0)

// ═══ B) Vieux projet sans song : zéro crash, song désactivé ═══
await loadProjectCard('Élégie')
const elegie = await songCounts()
console.log('B · Élégie — mode SONG armé :', elegie.modeArmed, '(attendu false) · vue song rendue, sections :', elegie.sections)

// ═══ D) Supprimer une section référencée par des chips ▦ (909-house) ═══
await page.goto('http://localhost:5173/?preset=909-house')
await page.waitForSelector('.rack-tabs-view-btn', { timeout: 15000 })
await page.waitForTimeout(1200)
await page.locator('.rack-tabs-view-btn', { hasText: 'Song' }).click()
await page.waitForSelector('.song-view', { timeout: 5000 })
const addPtn = page.locator('.song-label-btn.add', { hasText: '+▦' })
await addPtn.first().waitFor({ timeout: 5000 })
await addPtn.first().click()
await page.waitForTimeout(400)
await page.locator('.song-ptn-chip').first().click() // — → A sur la section 1
await page.waitForTimeout(400)
const sectionsBefore = await page.locator('.song-section-chip').count()
await page.locator('.song-section-close').first().click() // supprime la section référencée
await page.waitForTimeout(600)
const sectionsAfter = await page.locator('.song-section-chip').count()
console.log('D · sections :', sectionsBefore, '→', sectionsAfter, '· chips ▦ restantes :', await page.locator('.song-ptn-chip').count(), '· pas de crash :', errors.length === 0)

// ═══ E) F5 en pleine lecture ═══
await page.locator('.tc-play').click()
await page.waitForTimeout(1200)
await page.reload()
await page.waitForSelector('.rack-tabs-view-btn', { timeout: 15000 })
await page.waitForTimeout(800)
console.log('E · app revenue propre après F5 :', errors.length === 0)

const ok = roundtripOk && !elegie.modeArmed && errors.length === 0
console.log(ok ? 'done' : `FAIL (pageerrors: ${errors.length})`)
await browser.close()
process.exit(ok ? 0 : 1)
