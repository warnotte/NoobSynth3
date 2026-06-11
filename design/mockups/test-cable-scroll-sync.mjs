import { chromium } from 'playwright'

// Les câbles doivent rester COLLÉS aux jacks pendant le scroll (l'ancienne
// architecture re-mesurait en coordonnées écran avec 2 frames de retard :
// les câbles « nageaient »). On scrolle brutalement puis on compare, UNE
// frame plus tard, l'extrémité du câble avec le centre réel du jack.
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/?preset=showcase-odyssey')
await page.waitForTimeout(5000)

const result = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const rack = document.querySelector('.rack')
      const errors = []
      const measure = () => {
        // extrémité de chaque câble vs centre client du jack correspondant
        const rackRect = rack.getBoundingClientRect()
        document.querySelectorAll('path.patch-cable:not(.ghost)').forEach((p) => {
          const len = p.getTotalLength()
          const end = p.getPointAtLength(len) // côté entrée
          const endClient = {
            x: end.x + rackRect.left - rack.scrollLeft,
            y: end.y + rackRect.top - rack.scrollTop,
          }
          // jack le plus proche de cette extrémité
          let best = Infinity
          document.querySelectorAll('[data-port-key]').forEach((el) => {
            const r = el.getBoundingClientRect()
            const d = Math.hypot(r.left + r.width / 2 - endClient.x, r.top + r.height / 2 - endClient.y)
            if (d < best) best = d
          })
          errors.push(Math.round(best * 10) / 10)
        })
      }
      const scrolls = [0, 350, 700, 120, 500]
      let i = 0
      const step = () => {
        if (i >= scrolls.length) {
          resolve(errors)
          return
        }
        rack.scrollTop = scrolls[i++]
        // UNE frame après le scroll : avec l'ancien système (double-rAF de
        // re-mesure), l'écart serait ≈ le delta de scroll ; maintenant 0.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          measure()
          step()
        }))
      }
      step()
    }),
)

const max = Math.max(...result)
console.log(JSON.stringify({ samples: result.length, maxMisalignPx: max }))
await browser.close()
