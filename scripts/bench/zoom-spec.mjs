// Zoomed log-frequency spectrogram of a time range: node zoom-spec.mjs in.f32 out.png t0 t1 flo fhi [win]
import { deflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'

const SR = 48000
const [, , inPath, outPath, t0s, t1s, flos, fhis, wins = '4096'] = process.argv
const t0 = +t0s, t1 = +t1s, FLO = +flos, FHI = +fhis, WIN = +wins
const PAD = Math.max(16384, WIN * 2)
const Wpx = 1400, Hpx = 560, ML = 60, MB = 24
const buf = readFileSync(inPath)
const sig = new Float32Array(buf.buffer, buf.byteOffset, (buf.length / 4) | 0)

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

const cols = Wpx - ML, rows = Hpx - MB
const img = new Float64Array(cols * rows)
let gmax = 1e-12
for (let c = 0; c < cols; c++) {
  const center = Math.floor((t0 + ((t1 - t0) * c) / cols) * SR)
  const re = new Float64Array(PAD), im = new Float64Array(PAD)
  for (let n = 0; n < WIN; n++) re[n] = (sig[center - WIN / 2 + n] || 0) * hann[n]
  fft(re, im)
  for (let r = 0; r < rows; r++) {
    const f = FLO * Math.pow(FHI / FLO, 1 - r / (rows - 1))
    const kf = (f * PAD) / SR, k0 = Math.floor(kf), a = kf - k0
    const m0 = Math.hypot(re[k0], im[k0]), m1 = Math.hypot(re[k0 + 1], im[k0 + 1])
    const m = (1 - a) * m0 + a * m1
    img[r * cols + c] = m
    if (m > gmax) gmax = m
  }
}
// ---- render (dB, 70 dB range) with note grid ----
const px = new Uint8Array(Wpx * Hpx * 3).fill(16)
const cmap = (v) => {
  // black -> blue -> magenta -> orange -> white
  const s = [[0, 0, 0], [20, 30, 120], [160, 30, 140], [250, 140, 30], [255, 255, 230]]
  const x = Math.min(0.9999, Math.max(0, v)) * 4, i = Math.floor(x), a = x - i
  return s[i].map((q, j) => Math.round(q * (1 - a) + s[i + 1][j] * a))
}
for (let r = 0; r < rows; r++)
  for (let c = 0; c < cols; c++) {
    const db = 20 * Math.log10(img[r * cols + c] / gmax + 1e-9)
    const [R, G, B] = cmap((db + 70) / 70)
    const o = (r * Wpx + c + ML) * 3
    px[o] = R; px[o + 1] = G; px[o + 2] = B
  }
// tiny 3x5 font for axis labels
const FONT = { '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111001111001111', '.': '000000000000010', 'k': '100101110101101', 's': '011100010001110', ' ': '000000000000000', 'A': '010101111101101', 'C': '111100100100111', '#': '101111101111101', '-': '000000111000000' }
function text(x, y, str, col = [230, 230, 230]) {
  for (const ch of String(str)) {
    const g = FONT[ch] || FONT[' ']
    for (let i = 0; i < 15; i++) if (g[i] === '1')
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const X = x + (i % 3) * 2 + dx, Y = y + Math.floor(i / 3) * 2 + dy
        if (X >= 0 && X < Wpx && Y >= 0 && Y < Hpx) { const o = (Y * Wpx + X) * 3; px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2] }
      }
    x += 8
  }
}
// frequency ticks: every octave of A (55,110,...) and C
for (let f = 27.5; f < FHI; f *= 2) {
  for (const [mul, lab] of [[1, 'A'], [Math.pow(2, 3 / 12), 'C']]) {
    const ff = f * mul
    if (ff < FLO || ff > FHI) continue
    const r = Math.round((1 - Math.log(ff / FLO) / Math.log(FHI / FLO)) * (rows - 1))
    for (let c = ML; c < Wpx; c += 6) { const o = (r * Wpx + c) * 3; px[o] = 90; px[o + 1] = 90; px[o + 2] = 90 }
    text(2, r - 4, `${lab} ${ff.toFixed(0)}`)
  }
}
// time ticks
const span = t1 - t0
const step = span > 120 ? 20 : span > 40 ? 5 : span > 10 ? 1 : 0.5
for (let t = Math.ceil(t0 / step) * step; t < t1; t += step) {
  const c = ML + Math.round(((t - t0) / span) * cols)
  for (let r = rows; r < rows + 5; r++) { const o = (r * Wpx + c) * 3; px[o] = px[o + 1] = px[o + 2] = 220 }
  text(c - 8, rows + 8, `${+t.toFixed(1)}s`)
}

// ---- PNG ----
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]) }
const raw = Buffer.alloc((Wpx * 3 + 1) * Hpx)
for (let y = 0; y < Hpx; y++) { raw[y * (Wpx * 3 + 1)] = 0; Buffer.from(px.buffer, y * Wpx * 3, Wpx * 3).copy(raw, y * (Wpx * 3 + 1) + 1) }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(Wpx, 0); ihdr.writeUInt32BE(Hpx, 4); ihdr[8] = 8; ihdr[9] = 2
writeFileSync(outPath, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
console.log('wrote', outPath)
