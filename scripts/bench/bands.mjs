// Energy per band over a time range, in dB relative to the 300-600 Hz band (where the lead lives).
// node bands.mjs in.f32 t0 t1 label
import { readFileSync } from 'node:fs'
const SR = 48000, [, , p, t0, t1, label = ''] = process.argv
const b = readFileSync(p), sig = new Float32Array(b.buffer, b.byteOffset, (b.length / 4) | 0)
const W = 8192, acc = new Float64Array(W / 2)
function fft(re, im) { const n = re.length
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t } }
  for (let len = 2; len <= n; len <<= 1) { const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) { const a = i + k, c = a + len / 2, xr = re[c] * cr - im[c] * ci, xi = re[c] * ci + im[c] * cr
        re[c] = re[a] - xr; im[c] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t } } } }
for (let c = Math.floor(+t0 * SR); c + W < +t1 * SR; c += W / 2) { const re = new Float64Array(W), im = new Float64Array(W)
  for (let n = 0; n < W; n++) re[n] = sig[c + n] * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / W)); fft(re, im)
  for (let k = 0; k < W / 2; k++) acc[k] += re[k] * re[k] + im[k] * im[k] }
const B = [['30-60', 30, 60], ['60-120', 60, 120], ['120-200', 120, 200], ['200-300', 200, 300], ['300-600', 300, 600], ['0.6-1.2k', 600, 1200], ['1.2-2.5k', 1200, 2500], ['2.5-8k', 2500, 8000]]
const e = B.map(([, lo, hi]) => { let s = 0; for (let k = Math.ceil((lo * W) / SR); k < (hi * W) / SR; k++) s += acc[k]; return s })
console.log(label.padEnd(22) + B.map(([n], i) => `${n} ${(10 * Math.log10(e[i] / e[4])).toFixed(0).padStart(4)}`).join(' | '))
