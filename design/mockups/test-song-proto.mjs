// Prototype SONG mode — vérification E2E : charge Capitulation, ouvre la vue
// Song, édite l'arrangement, démarre le transport et vérifie que la section
// avance. Screenshots → design/mockups/proto-song-*.png
import { chromium } from 'playwright'

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

await page.goto('http://localhost:5173')
await page.waitForSelector('.rack-tabs-view-btn', { timeout: 15000 })

// 1) Charger le projet multi-rack Capitulation depuis la section Projects
const projectsHeader = page.locator('.panel-section', { hasText: 'Projects' }).first()
const projectsToggle = projectsHeader.locator('button, .panel-section-header').first()
try {
  const capitCard = page.locator('.preset-card', { hasText: 'Capitulation' })
  if (!(await capitCard.first().isVisible().catch(() => false))) {
    await projectsToggle.click()
    await page.waitForTimeout(400)
  }
  await capitCard.locator('button', { hasText: 'Load' }).first().click({ timeout: 5000 })
  console.log('project loaded: Capitulation')
  await page.waitForTimeout(1200)
} catch (e) {
  console.log('project load failed (fallback: default rack):', e.message.split('\n')[0])
}

// 2) Ouvrir la vue Song
await page.locator('.rack-tabs-view-btn', { hasText: 'Song' }).click()
await page.waitForSelector('.song-view', { timeout: 5000 })
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/proto-song-initial.png' })
console.log('song view open —', await page.locator('.song-row').count(), 'rows')

// 3) Éditer l'arrangement : couper des cellules dans INTRO/BUILD (drop progressif)
const rows = await page.locator('.song-lanes .song-row:not(.song-row-sections)').all()
console.log('lanes:', rows.length)
if (rows.length >= 2) {
  // lane 2 muette en section 1
  await rows[1].locator('.song-cell').nth(0).click()
  // dernière lane muette en sections 1 et 2
  const last = rows[rows.length - 1]
  await last.locator('.song-cell').nth(0).click()
  await last.locator('.song-cell').nth(1).click()
}
// SONG ON
await page.locator('.song-switch', { hasText: 'SONG' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/proto-song-edited.png' })

// 4) Démarrer le transport et vérifier que la position avance
await page.locator('.tc-play').click()
await page.waitForTimeout(4000)
const lcd1 = await page.locator('.song-lcd').textContent()
console.log('LCD après 4 s :', lcd1)
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/proto-song-playing.png' })
await page.waitForTimeout(5000)
const lcd2 = await page.locator('.song-lcd').textContent()
console.log('LCD après 9 s :', lcd2)
const playheadLeft = await page.locator('.song-playhead').evaluate((el) => el.style.left)
console.log('playhead left:', playheadLeft)
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/proto-song-playing2.png' })

// 5) Stop
await page.locator('.tc-play').click()
await browser.close()
console.log('done')
