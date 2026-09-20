// Average spectrum peaks of a time range: node peaks.mjs in.f32 t0 t1 fmin fmax
import { readFileSync } from 'node:fs'
const SR = 48000
const [, , p, t0, t1, fmin, fmax] = process.argv
const b = readFileSync(p), sig = new Float32Array(b.buffer, b.byteOffset, (b.length / 4) | 0)
const W = 16384, acc = new Float64Array(2000)
const fr = (i) => +fmin * Math.pow(+fmax / +fmin, i / 1999)
let frames = 0
for (let c = Math.floor(+t0 * SR); c + W < +t1 * SR; c += W / 2, frames++) {
  const x = new Float64Array(W)
  for (let n = 0; n < W; n++) x[n] = sig[c + n] * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / W))
  for (let i = 0; i < 2000; i++) { const w = (2 * Math.PI * fr(i)) / SR; let a = 0, q = 0; for (let n = 0; n < W; n += 2) { a += x[n] * Math.cos(w * n); q += x[n] * Math.sin(w * n) } acc[i] += Math.hypot(a, q) }
}
const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], out = []
for (let i = 2; i < 1998; i++) if (acc[i] > acc[i - 1] && acc[i] > acc[i + 1] && acc[i] > acc[i - 2] && acc[i] > acc[i + 2]) out.push([fr(i), acc[i]])
const mx = Math.max(...out.map((o) => o[1]))
for (const [f, a] of out.filter((o) => o[1] > mx * 0.12).sort((x, y) => x[0] - y[0])) { const m = 69 + 12 * Math.log2(f / 440), r = Math.round(m); console.log(`${f.toFixed(1).padStart(7)} Hz  ${(N[r % 12] + (Math.floor(r / 12) - 1)).padEnd(4)} ${((m - r) * 100).toFixed(0).padStart(4)} c  ${(20 * Math.log10(a / mx)).toFixed(0).padStart(4)} dB`) }
