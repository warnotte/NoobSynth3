// How busy is the writing? Pitched-note onsets per second by register, simultaneous voices,
// pitch classes per bar, and how much each 2-bar block repeats the previous one.
// node density.mjs in.f32 t0 t1 bpm label
import { readFileSync } from 'node:fs'
const SR = 48000
const [, , p, t0s, t1s, bpmS, label = ''] = process.argv
const t0 = +t0s, t1 = +t1s, BPM = +bpmS
const b = readFileSync(p), sig = new Float32Array(b.buffer, b.byteOffset, (b.length / 4) | 0)
const WIN = 4096, HOP = 960 // 20 ms
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
// semitone salience map: MIDI 36..96 (C2..C7); a peak counts as a NOTE only if no stronger peak sits at f/2, f/3, f/4, f/5
const LO = 36, HI = 96, NS = HI - LO + 1
const active = [] // per frame: Uint8Array of active fundamentals
for (let f = 0; f < frames; f++) {
  const s = Math.floor(t0 * SR) + f * HOP, re = new Float64Array(WIN), im = new Float64Array(WIN)
  for (let n = 0; n < WIN; n++) re[n] = sig[s + n] * hann[n]
  fft(re, im)
  const mag = new Float64Array(WIN / 2); let mx = 1e-12
  for (let k = 0; k < WIN / 2; k++) { mag[k] = Math.hypot(re[k], im[k]); if (k > 5 && mag[k] > mx) mx = mag[k] }
  const sal = new Float64Array(NS)
  for (let k = 6; k < WIN / 2 - 1; k++) {
    if (mag[k] < mx * 0.02 || mag[k] < mag[k - 1] || mag[k] < mag[k + 1]) continue
    const m = Math.round(69 + 12 * Math.log2(((k * SR) / WIN) / 440))
    if (m >= LO && m <= HI && mag[k] > sal[m - LO]) sal[m - LO] = mag[k]
  }
  const act = new Uint8Array(NS)
  for (let i = 0; i < NS; i++) {
    if (!sal[i]) continue
    let harmonic = false
    for (const st of [12, 19, 24, 28]) { const j = i - st; if (j >= 0 && sal[j] > sal[i] * 0.7) harmonic = true }
    if (!harmonic) act[i] = 1
  }
  active.push(act)
}
// note onset = a fundamental absent for the 3 previous frames that then lasts >= 3 frames (60 ms)
const REG = [['grave  C2-B3', 36, 59], ['medium C4-B5', 60, 83], ['aigu   C6-C7', 84, 96]]
const onsets = REG.map(() => 0); let voices = 0
const barLen = (60 / BPM) * 4, fps = SR / HOP
const blocks = [] // per 2-bar block: histogram [slot16 x pitch] of onsets
for (let f = 3; f < frames - 3; f++) {
  let v = 0
  for (let i = 0; i < NS; i++) {
    if (active[f][i]) v++
    if (active[f][i] && active[f + 1][i] && active[f + 2][i] && !active[f - 1][i] && !active[f - 2][i] && !active[f - 3][i]) {
      REG.forEach(([, lo, hi], r) => { if (i + LO >= lo && i + LO <= hi) onsets[r]++ })
      const t = f / fps, blk = Math.floor(t / (2 * barLen)), slot = Math.floor(((t % (2 * barLen)) / (2 * barLen)) * 32)
      ;(blocks[blk] ||= new Map()).set(`${slot}:${i}`, 1)
    }
  }
  voices += v
}
const dur = t1 - t0
let rep = 0, cmp = 0
for (let k = 1; k < blocks.length; k++) { const a = blocks[k - 1], c = blocks[k]; if (!a || !c || a.size < 4 || c.size < 4) continue; let same = 0; for (const key of c.keys()) if (a.has(key)) same++; rep += same / Math.max(a.size, c.size); cmp++ }
console.log(`${label.padEnd(26)} notes/s  ${REG.map(([n], r) => `${n.split(' ')[0]} ${(onsets[r] / dur).toFixed(1).padStart(4)}`).join('  ')}  total ${(onsets.reduce((a, c) => a + c, 0) / dur).toFixed(1).padStart(4)} | voix simultanees ${(voices / (frames - 6)).toFixed(1)} | bloc de 2 mesures identique au precedent a ${cmp ? ((100 * rep) / cmp).toFixed(0) : '?'} %`)
