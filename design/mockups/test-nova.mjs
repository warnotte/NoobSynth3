// NOVA ⚡ — E2E : chargement du projet, song restauré (2 lanes ♪, courbes,
// mode SONG armé), lecture, seek dans DROP II, piano-roll du lead.
import { chromium } from 'playwright'

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

await page.goto('http://localhost:5173')
await page.waitForSelector('.rack-tabs-view-btn', { timeout: 15000 })

const projectsHeader = page.locator('.panel-section', { hasText: 'Projects' }).first()
const card = page.locator('.preset-card', { hasText: 'DUO' })
if (!(await card.first().isVisible().catch(() => false))) {
  await projectsHeader.locator('button, .panel-section-header').first().click()
  await page.waitForTimeout(400)
}
await card.locator('button', { hasText: 'Load' }).first().click({ timeout: 5000 })
console.log('NOVA chargé')
await page.waitForTimeout(1500)

console.log('mode SONG armé :', (await page.locator('.tc-mode-btn.song.active').count()) === 1)
await page.locator('.rack-tabs-view-btn', { hasText: 'Song' }).click()
await page.waitForSelector('.song-view', { timeout: 5000 })
console.log('lanes :', await page.locator('.song-lane-group').count())
console.log('lanes ♪ :', await page.locator('.song-row-notes').count())
console.log('sections :', await page.locator('.song-section-chip').count())
const noteCounts = []
for (const row of await page.locator('.song-row-notes').all()) noteCounts.push(await row.locator('rect').count())
console.log('notes vignettes (lead, bass) :', noteCounts.join(', '))

// Lecture
await page.locator('.tc-play').click()
await page.waitForTimeout(3500)
console.log('SECTION :', await page.locator('.tc-lcd--song .tc-lcd-value').textContent())
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/nova-songview.png' })

// Seek au cœur de DROP II (~72%)
const ruler = page.locator('.song-ruler')
const rbox = await ruler.boundingBox()
await page.mouse.click(rbox.x + rbox.width * 0.72, rbox.y + rbox.height / 2)
await page.waitForTimeout(800)
// note : la section attendue dépend du projet chargé (DUO 88 mes : 72% ≈ LA VOIX)
console.log('après seek 72% :', await page.locator('.tc-lcd--song .tc-lcd-value').textContent(), '(section à ~72% du morceau)')

// Piano-roll du lead
await page.locator('.song-row-notes').first().dblclick()
await page.waitForSelector('.song-pr', { timeout: 3000 })
console.log('piano-roll lead :', await page.locator('.song-pr-note').count(), 'notes')
await page.waitForTimeout(600)
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/nova-pianoroll.png' })
await page.locator('.song-pr-ok').click()

await page.locator('.tc-play').click()
await browser.close()
console.log('done')



