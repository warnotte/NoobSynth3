// Prototype SONG mode — vérification E2E : charge Capitulation, ouvre la vue
// Song, édite l'arrangement (mutes + drag de volume), active le mode SONG via
// le TRANSPORT, joue, et vérifie que le mode reste visible/pilotable depuis la
// vue RACK. Screenshots → design/mockups/proto-song-*.png
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
console.log('song view open —', await page.locator('.song-row').count(), 'rows')

// 3) Éditer l'arrangement : mutes + DRAG VERTICAL = volume
const rows = await page.locator('.song-lanes .song-row:not(.song-row-sections)').all()
console.log('lanes:', rows.length)
if (rows.length >= 2) {
  await rows[1].locator('.song-cell').nth(0).click() // lane 2 muette section 1
  const last = rows[rows.length - 1]
  await last.locator('.song-cell').nth(0).click()
  await last.locator('.song-cell').nth(1).click()

  // drag vertical vers le bas sur lane 1 / section 2 → baisse le niveau
  const cell = rows[0].locator('.song-cell').nth(1)
  const before = await cell.locator('.song-cell-db').textContent()
  const box = await cell.boundingBox()
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) await page.mouse.move(cx, cy + i * 5)
  await page.mouse.up()
  const after = await cell.locator('.song-cell-db').textContent()
  const fillH = await cell
    .locator('.song-cell-fill')
    .evaluate((el) => el.style.height)
    .catch(() => 'none')
  console.log(`drag volume : ${before} dB -> ${after} dB (fill ${fillH})`)
}

// 4) Activer le mode SONG via le TRANSPORT (plus de toggle dans la vue)
await page.locator('.tc-mode-btn.song').click()
await page.waitForTimeout(200)
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/proto-song-edited.png' })

// 5) Jouer, vérifier l'avance
await page.locator('.tc-play').click()
await page.waitForTimeout(4000)
console.log('LCD SongView :', await page.locator('.song-lcd').textContent())
console.log('LCD transport SECTION :', await page.locator('.tc-lcd--song .tc-lcd-value').textContent())
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/proto-song-playing.png' })

// 6) Basculer en vue RACK pendant que le song pilote : le MODE + la SECTION
//    restent visibles et commutables dans le transport
await page.locator('.rack-tabs-view-btn', { hasText: 'Racks' }).click()
await page.waitForTimeout(2500)
console.log(
  'vue RACK — SECTION transport :',
  await page.locator('.tc-lcd--song .tc-lcd-value').textContent(),
)
await page.screenshot({ path: 'E:/CODEX/NoobSynth3/design/mockups/proto-song-rackview.png' })

// 7) Repasser en mode RACK (lecture libre) depuis la vue rack
await page.locator('.tc-mode-btn', { hasText: 'RACK' }).click()
await page.waitForTimeout(300)
const songLcdCount = await page.locator('.tc-lcd--song').count()
console.log('mode RACK — LCD SECTION masqué :', songLcdCount === 0 ? 'oui' : 'NON')

await page.locator('.tc-play').click()
await browser.close()
console.log('done')
