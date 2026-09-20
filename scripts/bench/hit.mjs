// One drum hit under the microscope: band envelopes every 5 ms + low-band pitch sweep.
// node hit.mjs in.f32 tOnset [durMs=260]
import { readFileSync } from 'node:fs'
const SR = 48000
const [, , p, tS, durS = '260'] = process.argv
const b = readFileSync(p), sig = new Float32Array(b.buffer, b.byteOffset, (b.length / 4) | 0)
const s0 = Math.floor((+tS - 0.02) * SR), n = Math.floor(((+durS + 20) / 1000) * SR)
const x = Float64Array.from({ length: n }, (_, i) => sig[s0 + i] || 0)
// 4-pole Butterworth-ish via cascaded biquads (RBJ)
function biquad(x, type, f, q = 0.7071) {
  const w = (2 * Math.PI * f) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q)
  let b0, b1, b2
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2 } else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2 }
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al, y = new Float64Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v }
  return y
}
const band = (lo, hi) => { let y = x; if (lo) y = biquad(biquad(y, 'hp', lo), 'hp', lo); if (hi) y = biquad(biquad(y, 'lp', hi), 'lp', hi); return y }
const BANDS = [['sub <110', 0, 110], ['110-400', 110, 400], ['0.4-2k', 400, 2000], ['2-6k', 2000, 6000], ['>6k', 6000, 0]]
const ys = BANDS.map(([, lo, hi]) => band(lo, hi))
const STEP = 0.005 * SR
const rms = (y, i) => { let s = 0; for (let k = i; k < i + STEP; k++) s += y[k] * y[k]; return Math.sqrt(s / STEP) }
const rows = Math.floor(n / STEP)
const pre = ys.map((y) => (rms(y, 0) + rms(y, STEP) + rms(y, 2 * STEP)) / 3) // level before the hit (pad etc.)
console.log(`${p.split('/').pop()} hit @ ${tS}s — band level in dB, every 5 ms (t=0 at onset; "pre" = level just before)`)
console.log('t ms   ' + BANDS.map(([nm]) => nm.padStart(9)).join(''))
console.log('pre    ' + pre.map((v) => (20 * Math.log10(v + 1e-9)).toFixed(0).padStart(9)).join(''))
for (let r = 4; r < rows; r += r < 16 ? 1 : 3) console.log(String((r - 4) * 5).padEnd(7) + ys.map((y) => (20 * Math.log10(rms(y, r * STEP) + 1e-9)).toFixed(0).padStart(9)).join(''))
// decay time: ms for each band to fall 20 dB below its peak (or back to pre-level + 3 dB)
console.log('fall   ' + ys.map((y, bi) => { let pk = 0, pr = 0; for (let r = 4; r < rows; r++) { const v = rms(y, r * STEP); if (v > pk) { pk = v; pr = r } }
  for (let r = pr; r < rows; r++) { const v = rms(y, r * STEP); if (v < pk * 0.1 || v < pre[bi] * 1.41) return (((r - pr) * 5) + 'ms').padStart(9) } return '>'.padStart(9) }).join('') + '   (time from peak to -20 dB or back into the bed)')
// pitch sweep of the low band by zero crossings
const lowp = band(25, 450), zc = []
for (let i = Math.floor(0.02 * SR); i < n - 1; i++) if (lowp[i] <= 0 && lowp[i + 1] > 0) zc.push(i + lowp[i] / (lowp[i] - lowp[i + 1]))
console.log('pitch sweep (zero crossings of the <450 Hz band):  ' + zc.slice(1).map((z, i) => `${(((z + zc[i]) / 2 / SR - 0.02) * 1000).toFixed(0)}ms:${(SR / (z - zc[i])).toFixed(0)}Hz`).slice(0, 16).join('  '))
