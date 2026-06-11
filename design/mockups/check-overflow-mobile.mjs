import { chromium, devices } from 'playwright'

// Scan de débordement des .module-controls en émulation iPhone.
const presets = process.argv.slice(2)
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
for (const preset of presets) {
  await page.goto(`http://localhost:5173/?preset=${preset}`)
  await page.waitForTimeout(3500)
  const result = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('.module-card').forEach((card) => {
      const ctl = card.querySelector('.module-controls')
      if (!ctl) return
      const over = ctl.scrollHeight - ctl.clientHeight
      if (over > 2) out.push(`${card.dataset.moduleType} +${over}px`)
    })
    return out
  })
  console.log(`── ${preset}: ${result.length ? result.join(' · ') : 'aucun débordement'}`)
}
await browser.close()
