// Banc de recreation — carte d'un morceau MESURE PAR MESURE : qui joue quand.
// Colonnes fixes : KICK (energie sous 70 Hz sur les temps 1 et 3), CLAC (saut d'energie 1,5-5 kHz sur 2 et 4), CHARLEY
// (energie au-dessus de 7 kHz). Colonnes libres : des parties reperees par leurs frequences, donnees en arguments
// sous la forme nom:f1,f2,... (mesurees entre les kicks). Sert a relever la FORME reelle d'un morceau avant de l'arranger,
// puis a verifier son propre rendu avec la meme carte.
//
//   node scripts/bench/structure.mjs <in.f32> [bpm=120] [phase=0] [nom:f1,f2,...]...
//   ex. node scripts/bench/structure.mjs ref.f32 132.2 0.067 basse:78.7,93.6,117.9 nappe:235.8,280.6
import { readFileSync } from 'node:fs'
const SR = 48000
const [, , p, bpmS = '120', phS = '0', ...partArgs] = process.argv
if (!p) { console.error('usage: structure.mjs <in.f32> [bpm] [phase] [name:f1,f2,...]...'); process.exit(1) }
const parts = partArgs.map((a) => { const [name, fs] = a.split(':'); return [name, fs.split(',').map(Number)] })
const b = readFileSync(p), s = new Float32Array(b.buffer, b.byteOffset, (b.length / 4) | 0)
const S16 = 60 / +bpmS / 4, BAR = S16 * 16, PH = +phS, nBars = Math.floor((s.length / SR - PH) / BAR)
function biquad(x, type, f, q = 0.7071) { const w = (2 * Math.PI * f) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q)
  const [b0, b1, b2] = type === 'lp' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2], a0 = 1 + al, a1 = -2 * c, a2 = 1 - al, y = new Float32Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v }
  return y }
const band = (lo, hi) => { let y = s; if (lo) y = biquad(biquad(y, 'hp', lo), 'hp', lo); if (hi) y = biquad(biquad(y, 'lp', hi), 'lp', hi); return y }
const SUB = band(0, 70), AIR = band(7000, 0), SNP = band(1500, 5000)
const rms = (y, t0, t1) => { let q = 0; const i0 = Math.max(0, (t0 * SR) | 0), i1 = Math.min(y.length, (t1 * SR) | 0); for (let i = i0; i < i1; i++) q += y[i] * y[i]; return 10 * Math.log10(q / Math.max(1, i1 - i0) + 1e-12) }
const tone = (f, t0, t1) => { const n = ((t1 - t0) * SR) | 0, i0 = (t0 * SR) | 0; let best = 0
  for (const df of [-0.01, -0.005, 0, 0.005, 0.01]) { const ff = f * (1 + df); let a = 0, q = 0
    for (let i = 0; i < n; i += 2) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n), x = (s[i0 + i] || 0) * h; a += x * Math.cos((2 * Math.PI * ff * i) / SR); q += x * Math.sin((2 * Math.PI * ff * i) / SR) }
    best = Math.max(best, Math.hypot(a, q) / (n / 2)) }
  return 20 * Math.log10(best + 1e-9) }
console.log('mes.  temps    kick  clac  charley  ' + parts.map(([n]) => n.padStart(8)).join('') + '   (dB ; clac = saut au-dessus du fond)')
for (let k = 0; k < nBars; k++) { const t = PH + k * BAR
  const kick = Math.max(rms(SUB, t, t + 0.12), rms(SUB, t + 8 * S16, t + 8 * S16 + 0.12))
  const snap = Math.max(rms(SNP, t + 4 * S16, t + 4 * S16 + 0.04), rms(SNP, t + 12 * S16, t + 12 * S16 + 0.04)) - rms(SNP, t + 2.5 * S16, t + 3.5 * S16)
  const hat = Math.max(rms(AIR, t + 2 * S16, t + 2 * S16 + 0.05), rms(AIR, t + 6 * S16, t + 6 * S16 + 0.05), rms(AIR, t + 14 * S16, t + 14 * S16 + 0.05))
  // parties tonales : mesurees entre les kicks (doubles-croches 2 a 7,5 et 11,5 a 16)
  const vals = parts.map(([, fs]) => Math.max(...fs.map((f) => Math.max(tone(f, t + 2 * S16, t + 7.5 * S16), tone(f, t + 11.5 * S16, t + 16 * S16)))))
  console.log(`${String(k + 1).padStart(3)}  ${(Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0')).padStart(5)}  ${kick.toFixed(0).padStart(6)} ${snap.toFixed(0).padStart(5)} ${hat.toFixed(0).padStart(8)}  ${vals.map((v) => v.toFixed(0).padStart(8)).join('')}`) }
