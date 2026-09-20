// Transcribe sustained parts: strongest pitch peaks per 8th-note slot. node pad.mjs in.f32 tDownbeat bpm slots fmin fmax
import { readFileSync } from 'node:fs'
const SR = 48000
const [, , p, tdS, bpmS, slotsS, fminS, fmaxS] = process.argv
const b = readFileSync(p), sig = new Float32Array(b.buffer, b.byteOffset, (b.length / 4) | 0)
const slot = 60 / +bpmS / 2, W = 8192, N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NB = 600, fr = (i) => +fminS * Math.pow(+fmaxS / +fminS, i / (NB - 1))
for (let k = 0; k < +slotsS; k++) {
  const c = Math.floor((+tdS + (k + 0.5) * slot) * SR), x = new Float64Array(W)
  for (let n = 0; n < W; n++) x[n] = (sig[c - W / 2 + n] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / W))
  const m = new Float64Array(NB)
  for (let i = 0; i < NB; i++) { const w = (2 * Math.PI * fr(i)) / SR; let a = 0, q = 0; for (let n = 0; n < W; n += 2) { a += x[n] * Math.cos(w * n); q += x[n] * Math.sin(w * n) } m[i] = Math.hypot(a, q) }
  const pk = []
  for (let i = 2; i < NB - 2; i++) if (m[i] > m[i - 1] && m[i] > m[i + 1] && m[i] > m[i - 2] && m[i] > m[i + 2]) pk.push([fr(i), m[i]])
  pk.sort((u, v) => v[1] - u[1])
  const top = pk.slice(0, 6).filter((q) => q[1] > pk[0][1] * 0.2).sort((u, v) => u[0] - v[0])
  const lab = top.map(([f, a]) => { const mm = 69 + 12 * Math.log2(f / 440), r = Math.round(mm); return `${N[r % 12]}${Math.floor(r / 12) - 1}${a > pk[0][1] * 0.6 ? '!' : ''}` })
  console.log(`bar ${Math.floor(k / 8) + 1} ${['1', '1&', '2', '2&', '3', '3&', '4', '4&'][k % 8].padEnd(2)}  ${lab.join(' ')}`)
}
