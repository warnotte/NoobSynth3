import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })
await page.goto('http://localhost:5173/?preset=take-on-me')
await page.waitForTimeout(3000)

const lcd = () => page.locator('.tc-lcd--small .tc-lcd-value').first().textContent()

// 1er play
await page.click('.tc-play')
await page.waitForTimeout(6000)
const firstRun = await lcd()

// stop
await page.click('.tc-play')
await page.waitForTimeout(800)
const stopped = await lcd()

// 2e play : la mesure doit repartir de 1:1
await page.click('.tc-play')
await page.waitForTimeout(1200)
const secondRunEarly = await lcd()
await page.waitForTimeout(2000)
const secondRunLater = await lcd()

// changement de preset pendant la lecture (ancien node → zombie avant le fix)
await page.goto('http://localhost:5173/?preset=hammond-leslie')
await page.waitForTimeout(3000)
await page.click('.tc-play')
await page.waitForTimeout(4000)
const beforeSwitch = await lcd()
await page.goto('http://localhost:5173/?preset=take-on-me')
await page.waitForTimeout(4000)
const afterSwitch1 = await lcd()
await page.waitForTimeout(1500)
const afterSwitch2 = await lcd()
await page.waitForTimeout(1500)
const afterSwitch3 = await lcd()

console.log(
  JSON.stringify({ firstRun, stopped, secondRunEarly, secondRunLater, beforeSwitch, afterSwitch1, afterSwitch2, afterSwitch3 }),
)
await browser.close()
