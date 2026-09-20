// Rhythm transcription: per-band onset strength folded on the bar grid.
// node rhythm.mjs in.f32 t0 t1 bpmLo bpmHi [bars=2]
import { readFileSync } from 'node:fs'
const SR = 48000
const [, , p, t0s, t1s, bLo, bHi, barsS = '2', bpbS = '4'] = process.argv
const BPB = +bpbS
const t0 = +t0s, t1 = +t1s, BARS = +barsS
const b = readFileSync(p), sig = new Float32Array(b.buffer, b.byteOffset, (b.length / 4) | 0)
const WIN = 1024, HOP = 120 // 2.5 ms hop
const BANDS = [['sub 30-90', 30, 90], ['low 90-200', 90, 200], ['mid 200-1k', 200, 1000], ['himid 1-3k', 1000, 3000], ['high 3-8k', 3000, 8000], ['air 8-16k', 8000, 16000]]

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t } }
  for (let len = 2; len <= n; len <<= 1) { const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) { const a = i + k, c = a + len / 2, xr = re[c] * cr - im[c] * ci, xi = re[c] * ci + im[c] * cr
        re[c] = re[a] - xr; im[c] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t } } }
}
const hann = Float64Array.from({ length: WIN }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / WIN))
const frames = Math.floor(((t1 - t0) * SR - WIN) / HOP)
const env = BANDS.map(() => new Float64Array(frames))
for (let f = 0; f < frames; f++) {
  const s = Math.floor(t0 * SR) + f * HOP, re = new Float64Array(WIN), im = new Float64Array(WIN)
  for (let n = 0; n < WIN; n++) re[n] = sig[s + n] * hann[n]
  fft(re, im)
  BANDS.forEach(([, lo, hi], bi) => { let e = 0; for (let k = Math.ceil((lo * WIN) / SR); k <= (hi * WIN) / SR; k++) e += re[k] * re[k] + im[k] * im[k]; env[bi][f] = Math.sqrt(e) })
}
// onset strength = positive difference of log energy over ~10 ms
const ons = env.map((e) => { const o = new Float64Array(frames); for (let f = 4; f < frames; f++) o[f] = Math.max(0, Math.log(e[f] + 1e-6) - Math.log(e[f - 4] + 1e-6)); return o })
const fps = SR / HOP

// ---- tempo + phase: maximise contrast of the folded low+high onset pattern ----
const SLOTS = 4 * BPB * BARS
function fold(o, bpm, phase) {
  const barLen = (60 / bpm) * BPB * BARS, acc = new Float64Array(SLOTS), cnt = new Float64Array(SLOTS)
  for (let f = 0; f < frames; f++) {
    const pos = (((f / fps - phase) / barLen) % 1 + 1) % 1
    const slotF = pos * SLOTS, slot = Math.round(slotF) % SLOTS
    if (Math.abs(slotF - Math.round(slotF)) < 0.2) { acc[slot] += o[f]; cnt[slot]++ }
  }
  return acc.map((v, i) => v / Math.max(1, cnt[i]))
}
let best = { score: -1 }
const sumOns = new Float64Array(frames); for (let f = 0; f < frames; f++) sumOns[f] = ons[0][f] + ons[4][f] + ons[3][f]
for (let bpm = +bLo; bpm <= +bHi; bpm += 0.02) {
  const barLen = (60 / bpm) * BPB * BARS
  for (let ph = 0; ph < barLen / SLOTS; ph += barLen / SLOTS / 12) {
    const fo = fold(sumOns, bpm, ph), mu = fo.reduce((a, c) => a + c, 0) / SLOTS
    const score = fo.reduce((a, c) => a + (c - mu) ** 2, 0)
    if (score > best.score) best = { score, bpm, ph }
  }
}
// choose the 16th-phase, then pick the bar offset whose slot 0 has the strongest sub hit
const barLen = (60 / best.bpm) * BPB * BARS
let bestOff = 0, bestV = -1
for (let k = 0; k < SLOTS; k++) { const fo = fold(ons[0], best.bpm, best.ph + (k * barLen) / SLOTS); if (fo[0] > bestV) { bestV = fo[0]; bestOff = k } }
const phase = best.ph + (bestOff * barLen) / SLOTS
console.log(`${p.split('/').pop()}  ${t0}-${t1}s   tempo ${best.bpm.toFixed(2)} BPM, first downbeat at ${(t0 + (phase % barLen)).toFixed(3)} s, ${BARS}-bar fold (${SLOTS} sixteenths)`)
console.log('band         ' + Array.from({ length: SLOTS }, (_, i) => (i % 4 === 0 ? String((i / 4) % BPB + 1) : '.')).join(' '))
BANDS.forEach(([name], bi) => {
  const fo = fold(ons[bi], best.bpm, phase), mx = Math.max(...fo, 1e-9)
  console.log(name.padEnd(12) + ' ' + Array.from(fo, (v) => { const q = Math.round((v / mx) * 9); return q < 2 ? '·' : String(q) }).join(' ') + `   (max ${mx.toFixed(2)})`)
})
