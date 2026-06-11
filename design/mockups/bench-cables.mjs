import { chromium } from 'playwright'

// FPS pendant un scroll continu du rack (showcase-odyssey: 79 câbles),
// câbles visibles vs masqués (toggle CABLES) — le suspect: re-render de
// tous les <path> SVG filtrés à chaque frame de scroll.
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/?preset=showcase-odyssey')
await page.waitForTimeout(5000)

const measureScrollFps = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const rack = document.querySelector('.rack')
        const start = performance.now()
        const D = 2500
        let frames = 0
        const tick = (now) => {
          frames++
          const t = (now - start) / 1000
          rack.scrollTop = 400 + Math.sin(t * 4) * 350
          if (now - start < D) requestAnimationFrame(tick)
          else resolve(Math.round((frames / D) * 1000))
        }
        requestAnimationFrame(tick)
      }),
  )

const cables0 = await page.locator('path.patch-cable:not(.ghost)').count()
await measureScrollFps() // chauffe
const fpsOn1 = await measureScrollFps()
const fpsOn2 = await measureScrollFps()

// masquer les câbles
await page.locator('.rail-switch').first().click()
await page.waitForTimeout(500)
const cablesHidden = await page.locator('path.patch-cable:not(.ghost)').count()
await measureScrollFps() // chauffe
const fpsOff1 = await measureScrollFps()
const fpsOff2 = await measureScrollFps()

console.log(JSON.stringify({ cables: cables0, fpsOn: [fpsOn1, fpsOn2], cablesHidden, fpsOff: [fpsOff1, fpsOff2] }))
await browser.close()
