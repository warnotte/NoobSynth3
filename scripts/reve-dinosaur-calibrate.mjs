// Calibrate the per-section volume lanes of "Le Rêve de Dinosaur Land" on the offline bench (same method as songe-hyrule-calibrate.mjs).
//   node scripts/reve-dinosaur-calibrate.mjs
// 1. generates the project with every section at unity, 2. renders each rack alone with the repo's
// render_graph example, 3. measures each rack's ACTIVE loudness per section (90th percentile of 400 ms
// RMS windows, so a short roll in a quiet section isn't boosted), 4. writes scripts/reve-dinosaur-levels.json
// so every section hits its loudness with the intended balance, 5. regenerates and checks the full mix.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'

const RENDER = 'target/release/examples/render_graph.exe'
const SR = 48000
const LEVELS = 'scripts/reve-dinosaur-levels.json'
const RACKS = ['handpans', 'harpe', 'snes', 'nappe', 'orgue', 'percu']

// Section loudness (dBFS, active level of the mix) and balance inside the section (dB, 0 = lead).
const TARGET = {
  starroad: [-20, { snes: 0, harpe: -6, nappe: -9, handpans: -5 }],
  overworld: [-17, { handpans: 0, harpe: -4, nappe: -11 }],
  donut: [-18, { harpe: 0, snes: -6, handpans: -4 }],
  athletic: [-17, { handpans: 0, harpe: -3 }],
  forest: [-19, { handpans: 0, nappe: -5, snes: -9 }],
  castle: [-15, { orgue: 0, snes: -3, handpans: -5, percu: -6 }],
  ending: [-15, { handpans: 0, nappe: -4, harpe: -4, snes: -9 }],
}

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] }).toString()
const readF32 = (path) => { const b = readFileSync(path); return new Float32Array(b.buffer, b.byteOffset, (b.length / 4) | 0) }
const activeDb = (x, a, b) => {
  const W = Math.round(0.4 * SR)
  const rms = []
  for (let s = Math.round(a * SR); s + W <= Math.min(x.length, Math.round(b * SR)); s += W) {
    let e = 0
    for (let i = s; i < s + W; i++) e += x[i] * x[i]
    rms.push(10 * Math.log10(e / W + 1e-20))
  }
  if (!rms.length) return -200
  rms.sort((p, q) => p - q)
  return rms[Math.floor(0.9 * (rms.length - 1))]
}

console.log('build render_graph (release)')
run('cargo', ['build', '-q', '--release', '-p', 'dsp-graph', '--example', 'render_graph'])

// 1. unity levels
if (existsSync(LEVELS)) rmSync(LEVELS)
run('node', ['scripts/reve-dinosaur.mjs'])
const sections = JSON.parse(readFileSync('target/reve-dinosaur-sections.json', 'utf8'))
const duration = Math.ceil(sections.at(-1).end + 4)

// 2-3. measure every rack alone
const measured = {}
const peaks = {}
const peakOf = (x, a, b) => { let p = 0; for (let i = Math.max(0, Math.round(a * SR)); i < Math.min(x.length, Math.round(b * SR)); i++) p = Math.max(p, Math.abs(x[i])); return p }
for (const rack of RACKS) {
  const out = `target/reve-dinosaur-stem-${rack}.f32`
  process.stdout.write(`render ${rack}... `)
  run(RENDER, [`target/reve-dinosaur-${rack}-flat.json`, out, String(duration)])
  const x = readF32(out)
  measured[rack] = Object.fromEntries(sections.map((s) => [s.key, activeDb(x, s.at + 0.3, Math.max(s.at + 1, s.end - s.fadeOut))]))
  peaks[rack] = Object.fromEntries(sections.map((s) => [s.key, peakOf(x, s.at, s.end + 1)]))
  console.log(sections.map((s) => `${s.key} ${measured[rack][s.key].toFixed(1)}`).join(' | '))
}

// 4. levels: desired rack level = section target + balance offset - power sum of the offsets. Each rack
// gets a bus factor so its loudest section sits at level 1.0 and the others below (no cap needed).
const UNITY = 0.5
const RACK_PEAK = 0.55
const MIX_PEAK = 0.9
const factor = Object.fromEntries(RACKS.map((r) => [r, {}]))
for (const s of sections) {
  const [target, balance] = TARGET[s.key]
  const present = s.racks.filter((r) => balance[r] !== undefined && measured[r][s.key] > -60)
  const norm = 10 * Math.log10(present.reduce((sum, r) => sum + 10 ** (balance[r] / 10), 0))
  // a rack alone never peaks above RACK_PEAK in a section (attacks are invisible to the active level)
  for (const r of present) factor[r][s.key] = Math.min(10 ** ((target + balance[r] - norm - measured[r][s.key]) / 20), RACK_PEAK / Math.max(peaks[r][s.key], 1e-6))
}
const levels = { bus: {} }
for (const r of RACKS) {
  const max = Math.max(...Object.values(factor[r]), 1e-6)
  levels.bus[r] = +(max / 2).toFixed(4)
  levels[r] = {}
  for (const s of sections) if (s.racks.includes(r)) levels[r][s.key] = factor[r][s.key] ? +(factor[r][s.key] / max).toFixed(4) : UNITY
  console.log(`${r}: bus x${(max / 2).toFixed(2)} (${(20 * Math.log10(max / 2)).toFixed(1)} dB) | ${Object.entries(levels[r]).map(([k, v]) => `${k} ${v}`).join(' ')}`)
}
writeFileSync(LEVELS, JSON.stringify(levels, null, 2) + '\n')

// 5. regenerate and check the mix
run('node', ['scripts/reve-dinosaur.mjs'])
const report = run(RENDER, ['target/reve-dinosaur-flat.json', 'target/reve-dinosaur-mix.f32', String(duration)])
let mix = readF32('target/reve-dinosaur-mix.f32')
const peakOfMix = (x) => { let p = 0; let at = 0; x.forEach((v, i) => { if (Math.abs(v) > p) { p = Math.abs(v); at = i / SR } }); return [p, at] }
let [peak, peakAt] = peakOfMix(mix)
if (peak > MIX_PEAK) {
  // sums of racks can still overshoot: scale every bus so the whole mix fits, render once more
  const k = MIX_PEAK / peak
  for (const r of RACKS) levels.bus[r] = +(levels.bus[r] * k).toFixed(4)
  writeFileSync(LEVELS, JSON.stringify(levels, null, 2) + '\n')
  console.log(`mix peak ${peak.toFixed(2)} at ${peakAt.toFixed(1)} s -> every bus x${k.toFixed(3)}`)
  run('node', ['scripts/reve-dinosaur.mjs'])
  run(RENDER, ['target/reve-dinosaur-flat.json', 'target/reve-dinosaur-mix.f32', String(duration)])
  mix = readF32('target/reve-dinosaur-mix.f32');
  [peak, peakAt] = peakOfMix(mix)
}
console.log(`mix peak ${peak.toFixed(3)} at ${peakAt.toFixed(1)} s\n` + sections.map((s) => `${s.key.padEnd(11)} active ${activeDb(mix, s.at + 0.3, Math.max(s.at + 1, s.end - s.fadeOut)).toFixed(1)} dBFS (target ${TARGET[s.key][0]})`).join('\n'))
if (/nan/i.test(report)) console.warn(report)
