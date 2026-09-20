// Song-level analysis of a mono 48 kHz f32 file: structure (RMS/centroid per window),
// tempo (onset autocorrelation), tuning + key (pitch-class histogram with cents offset).
import { readFileSync } from 'node:fs'

const SR = 48000
const [, , inPath] = process.argv
const buf = readFileSync(inPath)
const N = (buf.length / 4) | 0
const sig = new Float32Array(buf.buffer, buf.byteOffset, N)
console.log(`duration ${(N / SR).toFixed(1)} s`)

// ---------- FFT (radix-2, in place) ----------
function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang), wi = Math.sin(ang)
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
function spectrum(start, win) {
  const re = new Float64Array(win), im = new Float64Array(win)
  for (let n = 0; n < win; n++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / win)
    re[n] = (sig[start + n] || 0) * w
  }
  fft(re, im)
  const mag = new Float64Array(win / 2)
  for (let k = 0; k < win / 2; k++) mag[k] = Math.hypot(re[k], im[k]) / win
  return mag
}

// ---------- 1. structure: RMS / peak / centroid / low-band share per 8 s ----------
console.log('\n== structure (8 s windows) ==')
console.log('  t(s)   rms dB  peak   centroid  <200Hz  200-2k  2k-8k  >8k')
const SEG = 8 * SR
for (let s = 0; s + SEG <= N; s += SEG) {
  let sum = 0, pk = 0
  for (let i = s; i < s + SEG; i++) { const x = sig[i]; sum += x * x; if (Math.abs(x) > pk) pk = Math.abs(x) }
  // average spectrum over 6 frames
  const W = 8192
  const acc = new Float64Array(W / 2)
  for (let f = 0; f < 6; f++) {
    const m = spectrum(s + Math.floor((f + 0.5) * SEG / 6) - W / 2, W)
    for (let k = 0; k < W / 2; k++) acc[k] += m[k] * m[k]
  }
  let num = 0, den = 0
  const b = [0, 0, 0, 0]
  for (let k = 1; k < W / 2; k++) {
    const fr = (k * SR) / W
    num += fr * acc[k]; den += acc[k]
    b[fr < 200 ? 0 : fr < 2000 ? 1 : fr < 8000 ? 2 : 3] += acc[k]
  }
  const pct = (v) => ((100 * v) / den).toFixed(0).padStart(5) + '%'
  console.log(
    `${String(s / SR).padStart(6)} ${(10 * Math.log10(sum / SEG + 1e-12)).toFixed(1).padStart(8)} ${pk.toFixed(2).padStart(6)} ${(num / den).toFixed(0).padStart(9)} ${pct(b[0])} ${pct(b[1])} ${pct(b[2])} ${pct(b[3])}`,
  )
}

// ---------- 2. tempo: spectral-flux onset envelope -> autocorrelation ----------
{
  const W = 1024, HOP = 256
  const frames = Math.floor((N - W) / HOP)
  const flux = new Float64Array(frames)
  let prev = null
  for (let f = 0; f < frames; f++) {
    const m = spectrum(f * HOP, W)
    if (prev) { let s = 0; for (let k = 0; k < W / 2; k++) { const d = m[k] - prev[k]; if (d > 0) s += d } flux[f] = s }
    prev = m
  }
  let mean = 0; for (const v of flux) mean += v; mean /= frames
  for (let i = 0; i < frames; i++) flux[i] -= mean
  const fr = SR / HOP // frames per second
  const cands = []
  for (let bpm = 60; bpm <= 200; bpm += 0.25) {
    const lag = (60 / bpm) * fr
    // sum autocorrelation at lag, 2*lag, 4*lag (interpolated)
    let score = 0
    for (const mult of [1, 2, 4]) {
      const L = lag * mult, L0 = Math.floor(L), a = L - L0
      let s = 0
      for (let i = 0; i + L0 + 1 < frames; i++) s += flux[i] * ((1 - a) * flux[i + L0] + a * flux[i + L0 + 1])
      score += s / (frames - L0)
    }
    cands.push([bpm, score])
  }
  cands.sort((x, y) => y[1] - x[1])
  console.log('\n== tempo candidates (bpm, score) ==')
  const seen = []
  for (const [bpm, sc] of cands) {
    if (seen.some((b) => Math.abs(b - bpm) < 2)) continue
    seen.push(bpm); console.log(`  ${bpm.toFixed(2)}  ${sc.toExponential(3)}`)
    if (seen.length >= 6) break
  }
}

// ---------- 3. tuning + pitch classes: peak picking on long windows ----------
{
  const W = 16384, HOP = 8192
  const cents = new Float64Array(100) // histogram of deviation from 12-TET (A440), 1-cent bins, -50..+50
  const pc = new Float64Array(12)
  const pcFine = new Float64Array(1200)
  for (let s = 0; s + W <= N; s += HOP) {
    const m = spectrum(s, W)
    let mx = 0; for (let k = 0; k < W / 2; k++) if (m[k] > mx) mx = m[k]
    for (let k = 2; k < W / 2 - 1; k++) {
      const fr0 = (k * SR) / W
      if (fr0 < 110 || fr0 > 2200) continue
      if (m[k] > m[k - 1] && m[k] >= m[k + 1] && m[k] > mx * 0.08) {
        // parabolic interpolation on log magnitude
        const a = Math.log(m[k - 1] + 1e-12), b = Math.log(m[k]), c = Math.log(m[k + 1] + 1e-12)
        const d = (0.5 * (a - c)) / (a - 2 * b + c)
        const f = ((k + d) * SR) / W
        const midi = 69 + 12 * Math.log2(f / 440)
        const dev = (midi - Math.round(midi)) * 100
        const w = m[k]
        cents[Math.min(99, Math.max(0, Math.floor(dev + 50)))] += w
        pc[((Math.round(midi) % 12) + 12) % 12] += w
        pcFine[(((Math.round(midi * 100) % 1200) + 1200) % 1200)] += w
      }
    }
  }
  // circular mean of deviation
  let sx = 0, sy = 0, tot = 0
  for (let i = 0; i < 100; i++) { const ang = ((i - 50 + 0.5) / 100) * 2 * Math.PI; sx += cents[i] * Math.cos(ang); sy += cents[i] * Math.sin(ang); tot += cents[i] }
  const meanDev = (Math.atan2(sy, sx) / (2 * Math.PI)) * 100
  const conc = Math.hypot(sx, sy) / tot
  console.log(`\n== tuning ==\n  global offset vs A440 12-TET: ${meanDev.toFixed(1)} cents (concentration ${conc.toFixed(2)}; 1 = perfectly tuned, 0 = smeared)`)
  let line = '  dev histogram (5-cent bins, -50..+50): '
  for (let i = 0; i < 100; i += 5) { let s = 0; for (let j = i; j < i + 5; j++) s += cents[j]; line += ((100 * s) / tot).toFixed(0) + ' ' }
  console.log(line)
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const ptot = pc.reduce((a, b) => a + b, 0)
  console.log('\n== pitch classes (share of peak energy) ==')
  console.log('  ' + names.map((n, i) => `${n}:${((100 * pc[i]) / ptot).toFixed(1)}`).join('  '))
  // key estimate (Krumhansl)
  const maj = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
  const min = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
  const corr = (p, r) => {
    const mp = p.reduce((a, b) => a + b) / 12, mr = r.reduce((a, b) => a + b) / 12
    let n = 0, d1 = 0, d2 = 0
    for (let i = 0; i < 12; i++) { n += (p[i] - mp) * (r[i] - mr); d1 += (p[i] - mp) ** 2; d2 += (r[i] - mr) ** 2 }
    return n / Math.sqrt(d1 * d2)
  }
  const keys = []
  for (let r = 0; r < 12; r++) {
    const rot = Array.from({ length: 12 }, (_, i) => pc[(i + r) % 12])
    keys.push([names[r] + ' maj', corr(rot, maj)], [names[r] + ' min', corr(rot, min)])
  }
  keys.sort((a, b) => b[1] - a[1])
  console.log('  key candidates: ' + keys.slice(0, 4).map(([k, c]) => `${k} (${c.toFixed(2)})`).join(', '))
}
