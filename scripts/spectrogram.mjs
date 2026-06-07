// Sound test bench (2/2): raw f32 samples -> log-frequency spectrogram PNG + timbre metrics
// (spectral flatness = tonal↔noisy, centroid = brightness, band energy). Lets a model that
// can't hear audio "see" a sound and tune it on numbers. PNG via Node's built-in zlib (no deps).
// Pair with the renderer `cargo run -p dsp-core --example dump_cymbals`. Usage:
//   node scripts/spectrogram.mjs <in.f32> <out.png> "<label>"
import { deflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'

const SR = 48000
const FBINS = 140, TCOLS = 320, WIN = 1024
const FLO = 100, FHI = 19000

const [, , inPath, outPath, label = ''] = process.argv

// ---- read samples ----
const buf = readFileSync(inPath)
const N = (buf.length / 4) | 0
const sig = new Float32Array(N)
for (let i = 0; i < N; i++) sig[i] = buf.readFloatLE(i * 4)

// ---- analysis grid ----
const freqs = Array.from({ length: FBINS }, (_, j) => FLO * Math.pow(FHI / FLO, j / (FBINS - 1)))
const hann = new Float32Array(WIN)
for (let n = 0; n < WIN; n++) hann[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / WIN)
const hop = Math.max(1, Math.floor((N - WIN) / TCOLS))
// precompute per-freq twiddles
const cosT = [], sinT = []
for (let j = 0; j < FBINS; j++) {
  const w = (2 * Math.PI * freqs[j]) / SR
  const c = new Float32Array(WIN), s = new Float32Array(WIN)
  for (let n = 0; n < WIN; n++) { c[n] = Math.cos(w * n); s[n] = Math.sin(w * n) }
  cosT.push(c); sinT.push(s)
}
const mag = []
let gmax = 1e-9
for (let t = 0; t < TCOLS; t++) {
  const start = t * hop
  const col = new Float32Array(FBINS)
  const lim = Math.min(WIN, N - start)
  for (let j = 0; j < FBINS; j++) {
    let re = 0, im = 0
    const c = cosT[j], s = sinT[j]
    for (let n = 0; n < lim; n++) { const x = sig[start + n] * hann[n]; re += x * c[n]; im -= x * s[n] }
    const m = Math.sqrt(re * re + im * im) / WIN
    col[j] = m; if (m > gmax) gmax = m
  }
  mag.push(col)
}

// ---- metrics from an early-body column (just after attack) ----
const probe = mag[Math.min(3, TCOLS - 1)]
let logsum = 0, linsum = 0, num = 0, den = 0
const bands = [[0, 1000], [1000, 3000], [3000, 6000], [6000, 10000], [10000, 20000]]
const be = [0, 0, 0, 0, 0]
for (let j = 0; j < FBINS; j++) {
  const m = Math.max(probe[j], 1e-9)
  logsum += Math.log(m); linsum += m
  num += freqs[j] * probe[j]; den += probe[j]
  for (let bi = 0; bi < 5; bi++) if (freqs[j] >= bands[bi][0] && freqs[j] < bands[bi][1]) be[bi] += probe[j]
}
const flatness = Math.exp(logsum / FBINS) / (linsum / FBINS)
const centroid = num / den
const tot = be.reduce((a, b) => a + b, 0) || 1
console.log(`${label}: flatness=${flatness.toFixed(3)}  centroid=${centroid.toFixed(0)}Hz  bands<1k=${(be[0]/tot*100).toFixed(0)} 1-3k=${(be[1]/tot*100).toFixed(0)} 3-6k=${(be[2]/tot*100).toFixed(0)} 6-10k=${(be[3]/tot*100).toFixed(0)} 10k+=${(be[4]/tot*100).toFixed(0)}`)

// ---- color map (dB -> heat) ----
const STOPS = [[2, 2, 12], [30, 12, 90], [120, 20, 110], [200, 40, 50], [240, 120, 25], [252, 220, 90], [255, 255, 255]]
function heat(v) {
  v = Math.max(0, Math.min(0.9999, v))
  const p = v * (STOPS.length - 1), i = Math.floor(p), f = p - i
  const a = STOPS[i], b = STOPS[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

// ---- render image (high freq at top), 2x upscale, with octave gridlines ----
const SCALE = 2
const W = TCOLS * SCALE, H = FBINS * SCALE
const rgb = new Uint8Array(W * H * 3)
// octave gridline rows (1k, 2k, 4k, 8k, 16k)
const gridFreqs = [1000, 2000, 4000, 8000, 16000]
const gridRows = new Set()
for (const gf of gridFreqs) {
  let best = 0, bd = 1e9
  for (let j = 0; j < FBINS; j++) { const d = Math.abs(freqs[j] - gf); if (d < bd) { bd = d; best = j } }
  gridRows.add(best)
}
for (let y = 0; y < H; y++) {
  const j = FBINS - 1 - Math.floor(y / SCALE)
  const isGrid = gridRows.has(j) && (y % SCALE === 0)
  for (let x = 0; x < W; x++) {
    const t = Math.floor(x / SCALE)
    const m = mag[t][j]
    const db = 20 * Math.log10(Math.max(m / gmax, 1e-5)) // -100..0
    let [r, g, b] = heat((db + 80) / 80)
    if (isGrid) { r = Math.min(255, r + 40); g = Math.min(255, g + 40); b = Math.min(255, b + 40) }
    const o = (y * W + x) * 3
    rgb[o] = r | 0; rgb[o + 1] = g | 0; rgb[o + 2] = b | 0
  }
}

// ---- PNG encode (zlib + manual chunks/CRC) ----
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0 } return t })()
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const cd = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cd)); return Buffer.concat([len, cd, crc]) }
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2 // RGB
const rawimg = Buffer.alloc(H * (1 + W * 3))
for (let y = 0; y < H; y++) { rawimg[y * (1 + W * 3)] = 0; for (let x = 0; x < W * 3; x++) rawimg[y * (1 + W * 3) + 1 + x] = rgb[y * W * 3 + x] }
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rawimg, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(outPath, png)
console.log(`  wrote ${outPath} (${W}x${H})  [top=${FHI}Hz bottom=${FLO}Hz, gridlines 1/2/4/8/16k, left->right=time]`)
