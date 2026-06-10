import { chromium } from 'playwright'

// Scanne tous les .module-controls et signale ceux dont le contenu déborde
// (scrollHeight > clientHeight). Usage : node check-overflow.mjs [preset...]
const presets = process.argv.slice(2)
const urls = presets.length
  ? presets.map((p) => `http://localhost:5173/?preset=${p}`)
  : ['http://localhost:5173/']

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
for (const url of urls) {
  await page.goto(url)
  await page.waitForTimeout(3000)
  const result = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('.module-card').forEach((card) => {
      const ctl = card.querySelector('.module-controls')
      if (!ctl) return
      const over = ctl.scrollHeight - ctl.clientHeight
      if (over > 2) {
        out.push({
          type: card.dataset.moduleType,
          name: card.querySelector('.module-name')?.textContent ?? '',
          over,
        })
      }
    })
    return out
  })
  const label = url.includes('preset=') ? url.split('preset=')[1] : 'default'
  console.log(`── ${label}: ${result.length} module(s) en débordement`)
  result.forEach((r) => console.log(`   ${r.type} (${r.name}) +${r.over}px`))
}
await browser.close()
