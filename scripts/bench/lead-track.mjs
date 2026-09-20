// Track a monophonic lead in a time range: f0 per 10 ms, note segmentation, harmonic profile,
// vibrato rate/depth, attack/release. node lead-track.mjs in.f32 t0 t1 fmin fmax
import { readFileSync } from 'node:fs'
const SR = 48000
const [, , inPath, t0s, t1s, fmins, fmaxs] = process.argv
const t0 = +t0s, t1 = +t1s, FMIN = +fmins, FMAX = +fmaxs
const buf = readFileSync(inPath)
const sig = new Float32Array(buf.buffer, buf.byteOffset, (buf.length / 4) | 0)
const WIN = 4096, PAD = 32768, HOP = 480

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t
      }
    }
  }
}
const hann = new Float64Array(WIN)
for (let n = 0; n < WIN; n++) hann[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / WIN)
const magAt = (mag, f) => { const kf = (f * PAD) / SR, k = Math.round(kf); let m = 0; for (let d = -3; d <= 3; d++) m = Math.max(m, mag[k + d] || 0); return m }

const frames = []
for (let c = Math.floor(t0 * SR); c < t1 * SR; c += HOP) {
  const re = new Float64Array(PAD), im = new Float64Array(PAD)
  for (let n = 0; n < WIN; n++) re[n] = (sig[c - WIN / 2 + n] || 0) * hann[n]
  fft(re, im)
  const mag = new Float64Array(PAD / 2)
  for (let k = 0; k < PAD / 2; k++) mag[k] = Math.hypot(re[k], im[k]) / WIN
  const k0 = Math.floor((FMIN * PAD) / SR), k1 = Math.ceil((FMAX * PAD) / SR)
  let kb = k0
  for (let k = k0; k <= k1; k++) if (mag[k] > mag[kb]) kb = k
  const a = Math.log(mag[kb - 1] + 1e-15), b = Math.log(mag[kb] + 1e-15), cc = Math.log(mag[kb + 1] + 1e-15)
  const d = (0.5 * (a - cc)) / (a - 2 * b + cc)
  const f0 = ((kb + d) * SR) / PAD
  const h = []
  for (let n = 1; n <= 12; n++) h.push(magAt(mag, f0 * n))
  frames.push({ t: c / SR, f0, amp: mag[kb], h })
}
const ampMax = Math.max(...frames.map((f) => f.amp))
const midi = (f) => 69 + 12 * Math.log2(f / 440)
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// ---- note segmentation: contiguous frames within ±60 cents of a running median, amp > -26 dB ----
const notes = []
let cur = null
for (const fr of frames) {
  const loud = fr.amp > ampMax * 0.05
  if (loud && cur && Math.abs(midi(fr.f0) - cur.m) < 0.6) { cur.fr.push(fr); cur.m = 0.9 * cur.m + 0.1 * midi(fr.f0) }
  else { if (cur && cur.fr.length >= 8) notes.push(cur); cur = loud ? { fr: [fr], m: midi(fr.f0) } : null }
}
if (cur && cur.fr.length >= 8) notes.push(cur)

console.log(`range ${t0}-${t1} s, search ${FMIN}-${FMAX} Hz, ${notes.length} notes`)
console.log('  start    dur   f0(Hz)  midi     note  cents  | harmonics dB rel. H1 (H2..H8)                | vib Hz  ±cents')
const allH = []
for (const n of notes) {
  const fs = n.fr.map((f) => f.f0)
  const body = n.fr.slice(Math.floor(n.fr.length * 0.25), Math.ceil(n.fr.length * 0.9))
  const mean = body.reduce((a, f) => a + f.f0, 0) / body.length
  const m = midi(mean), near = Math.round(m)
  // harmonic profile, averaged over body
  const H = Array.from({ length: 12 }, (_, i) => body.reduce((a, f) => a + f.h[i], 0) / body.length)
  const Hdb = H.map((v) => 20 * Math.log10(v / H[0] + 1e-9))
  allH.push({ dur: n.fr.length, Hdb })
  // vibrato: detrended cents series -> dominant rate by DFT 2..12 Hz
  let vibHz = 0, vibDepth = 0
  if (body.length >= 40) {
    const c = body.map((f) => 1200 * Math.log2(f.f0 / mean))
    const mu = c.reduce((a, b) => a + b, 0) / c.length
    let best = 0
    for (let hz = 2; hz <= 12; hz += 0.1) {
      let re = 0, im = 0
      c.forEach((v, i) => { const ph = 2 * Math.PI * hz * i * (HOP / SR); re += (v - mu) * Math.cos(ph); im += (v - mu) * Math.sin(ph) })
      const a = (2 * Math.hypot(re, im)) / c.length
      if (a > best) { best = a; vibHz = hz }
    }
    vibDepth = best
  }
  console.log(
    `${n.fr[0].t.toFixed(2).padStart(7)} ${(n.fr.length * HOP / SR).toFixed(2).padStart(6)} ${mean.toFixed(1).padStart(8)} ${m.toFixed(2).padStart(6)} ${(NAMES[((near % 12) + 12) % 12] + (Math.floor(near / 12) - 1)).padStart(7)} ${((m - near) * 100).toFixed(0).padStart(5)}  | ${Hdb.slice(1, 8).map((v) => v.toFixed(0).padStart(4)).join(' ')}               | ${vibHz ? vibHz.toFixed(1).padStart(5) : '    -'} ${vibDepth ? vibDepth.toFixed(1).padStart(6) : '     -'}`,
  )
}
// ---- envelope of the longest note ----
const longest = notes.slice().sort((a, b) => b.fr.length - a.fr.length)[0]
if (longest) {
  const pk = Math.max(...longest.fr.map((f) => f.amp))
  console.log(`\nlongest note @${longest.fr[0].t.toFixed(2)} s: amplitude (dB rel. its peak) and f0 cents every 30 ms`)
  const mean = longest.fr.reduce((a, f) => a + f.f0, 0) / longest.fr.length
  let l1 = '  amp : ', l2 = '  cent: '
  for (let i = 0; i < longest.fr.length; i += 3) {
    l1 += (20 * Math.log10(longest.fr[i].amp / pk)).toFixed(0).padStart(4)
    l2 += (1200 * Math.log2(longest.fr[i].f0 / mean)).toFixed(0).padStart(4)
  }
  console.log(l1); console.log(l2)
}
