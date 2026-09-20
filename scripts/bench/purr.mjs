// "Purr" measurement: fast pitch + amplitude modulation of a held note.
// node purr.mjs in.f32 t0 t1 f0 [harmonic]
import { readFileSync } from 'node:fs'
const SR = 48000
const [, , inPath, t0s, t1s, f0s, hs = '4'] = process.argv
const t0 = +t0s, t1 = +t1s, f0 = +f0s, H = +hs
const buf = readFileSync(inPath)
const sig = new Float32Array(buf.buffer, buf.byteOffset, (buf.length / 4) | 0)
const WIN = 1024, HOP = 96 // 21 ms window, 2 ms hop
const fc = f0 * H, span = fc * 0.06 // search ±6 % (~±100 cents) around the harmonic
const dev = [], amp = []
for (let c = Math.floor(t0 * SR); c < t1 * SR; c += HOP) {
  let best = 0, bf = fc
  const x = new Float64Array(WIN)
  for (let n = 0; n < WIN; n++) x[n] = (sig[c - WIN / 2 + n] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / WIN))
  const mag = (f) => { const w = (2 * Math.PI * f) / SR; let a = 0, b = 0; for (let n = 0; n < WIN; n++) { a += x[n] * Math.cos(w * n); b -= x[n] * Math.sin(w * n) } return Math.hypot(a, b) }
  for (let f = fc - span; f <= fc + span; f += span / 20) { const m = mag(f); if (m > best) { best = m; bf = f } }
  // refine
  const st = span / 20, a = mag(bf - st), b = best, cc = mag(bf + st)
  const d = Math.max(-1, Math.min(1, (0.5 * (a - cc)) / (a - 2 * b + cc || 1e-9))) // clamp: a flat top used to send the estimate out of range (NaN cents)
  dev.push(1200 * Math.log2((bf + d * st) / fc)); amp.push(best)
}
const n = dev.length, fs = SR / HOP
const stat = (arr, label, unit) => {
  const mu = arr.reduce((a, b) => a + b, 0) / n
  const peaks = []
  for (let hz = 3; hz <= 60; hz += 0.25) {
    let re = 0, im = 0
    arr.forEach((v, i) => { const ph = (2 * Math.PI * hz * i) / fs; re += (v - mu) * Math.cos(ph); im += (v - mu) * Math.sin(ph) })
    peaks.push([hz, (2 * Math.hypot(re, im)) / n])
  }
  const top = peaks.slice().sort((a, b) => b[1] - a[1])
  const picked = []
  for (const p of top) { if (!picked.some((q) => Math.abs(q[0] - p[0]) < 2)) picked.push(p); if (picked.length >= 4) break }
  console.log(`${label}: mean ${mu.toFixed(2)} ${unit}; strongest modulation rates: ` + picked.map(([hz, a]) => `${hz.toFixed(2)} Hz (±${a.toFixed(unit === 'cents' ? 1 : 3)})`).join(', '))
}
console.log(`${inPath.split('/').pop()}  ${t0}-${t1} s, harmonic ${H} of ${f0} Hz`)
stat(dev.map((d) => d), `pitch deviation of H${H} (cents, same in cents for the note)`, 'cents')
const am = amp.map((a) => a / (amp.reduce((x, y) => x + y, 0) / n))
stat(am, 'amplitude (relative, 1 = mean)', 'x')
