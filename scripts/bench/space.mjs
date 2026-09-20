// Banc de recreation — ESPACE et DYNAMIQUE : largeur stereo par bande, facteur de crete, echo.
//   stereo   : correlation gauche/droite (1 = mono) et rapport cotes/centre, par bande, sur des extraits de 20 s
//   dynamique: crete, rms, facteur de crete, part d'echantillons pres du plafond (master ecrete ?)
//   echo     : periodicites de la fonction d'attaque d'une bande (une ligne rythmique en cree aussi : a recouper avec decay.mjs)
//
//   node scripts/bench/space.mjs <stereo.f32> <mono.f32> <debuts des extraits, ex. 10,120> [echoDe=0] [echoA=12] [bandeBasse=300] [bandeHaute=1500]
// stereo.f32 = 48 kHz f32 entrelace G/D (ffmpeg -i x.mp3 -ar 48000 -f f32le) ; mono.f32 = le meme en -ac 1.
import { readFileSync } from 'node:fs'
const SR = 48000
const [, , ps, pm, startsS = '10', e0 = '0', e1 = '12', loS = '300', hiS = '1500'] = process.argv
if (!ps || !pm) { console.error('usage: space.mjs <stereo.f32> <mono.f32> <starts> [echoFrom] [echoTo] [bandLo] [bandHi]'); process.exit(1) }
const rd = (p) => { const b = readFileSync(p); return new Float32Array(b.buffer, b.byteOffset, (b.length / 4) | 0) }
const st = rd(ps), mono = rd(pm)
function biquad(x, type, f, q = 0.7071) { const w = (2 * Math.PI * f) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q)
  const [b0, b1, b2] = type === 'lp' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2], a0 = 1 + al, a1 = -2 * c, a2 = 1 - al, y = new Float64Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v }
  return y }
const bp = (x, lo, hi) => { let y = x; if (lo) y = biquad(y, 'hp', lo); if (hi) y = biquad(y, 'lp', hi); return y }
const starts = startsS.split(',').map(Number)
for (const t0 of starts) { const n = 20 * SR, L = new Float64Array(n), R = new Float64Array(n)
  for (let i = 0; i < n; i++) { L[i] = st[2 * (t0 * SR + i)] || 0; R[i] = st[2 * (t0 * SR + i) + 1] || 0 }
  const out = []
  for (const [nm, lo, hi] of [['<150', 0, 150], ['150-600', 150, 600], ['0.6-2.5k', 600, 2500], ['>2.5k', 2500, 0]]) { const l = bp(L, lo, hi), r = bp(R, lo, hi)
    let ll = 0, rr = 0, lr = 0, ss = 0, mm = 0
    for (let i = 0; i < n; i++) { ll += l[i] * l[i]; rr += r[i] * r[i]; lr += l[i] * r[i]; const m = (l[i] + r[i]) / 2, sd = (l[i] - r[i]) / 2; mm += m * m; ss += sd * sd }
    out.push(`${nm}: corr ${(lr / Math.sqrt(ll * rr + 1e-30)).toFixed(2)}, cotes/centre ${(10 * Math.log10(ss / (mm + 1e-30) + 1e-12)).toFixed(0)} dB`) }
  console.log(`stereo ${String(t0).padStart(4)}-${t0 + 20} s   ${out.join(' | ')}`) }
for (const t0 of starts) { let pk = 0, q = 0, hot = 0; const n = 20 * SR
  for (let i = t0 * SR; i < t0 * SR + n; i++) { const a = Math.abs(mono[i] || 0); if (a > pk) pk = a; q += a * a; if (a > 0.95) hot++ }
  const r = Math.sqrt(q / n)
  console.log(`dynamique ${String(t0).padStart(4)}-${t0 + 20} s   crete ${pk.toFixed(2)}, rms ${(20 * Math.log10(r + 1e-12)).toFixed(1)} dB, facteur de crete ${(20 * Math.log10(pk / (r + 1e-12))).toFixed(1)} dB, au-dessus de 0,95 : ${((100 * hot) / n).toFixed(3)} %`) }
{ const a = Math.floor(+e0 * SR), n = Math.floor((+e1 - +e0) * SR), y = bp(Float64Array.from({ length: n }, (_, i) => mono[a + i] || 0), +loS, +hiS)
  const HOP = 240, fr = Math.floor(n / HOP), env = new Float64Array(fr)
  for (let f = 0; f < fr; f++) { let q = 0; for (let k = 0; k < HOP; k++) q += y[f * HOP + k] ** 2; env[f] = Math.log(Math.sqrt(q / HOP) + 1e-6) }
  const on = new Float64Array(fr); for (let f = 2; f < fr; f++) on[f] = Math.max(0, env[f] - env[f - 2])
  const mu = on.reduce((x, c) => x + c, 0) / fr; for (let f = 0; f < fr; f++) on[f] -= mu
  let z = 0; for (let f = 0; f < fr; f++) z += on[f] * on[f]
  const lags = []; for (let lag = 10; lag < 200; lag++) { let q = 0; for (let f = 0; f + lag < fr; f++) q += on[f] * on[f + lag]; lags.push([lag * (HOP / SR) * 1000, q / (z + 1e-30)]) }
  const pk = lags.filter((l, i) => i > 0 && i < lags.length - 1 && l[1] > lags[i - 1][1] && l[1] > lags[i + 1][1]).sort((x, c) => c[1] - x[1]).slice(0, 8)
  console.log(`echo / periodicite ${e0}-${e1} s, bande ${loS}-${hiS} Hz (retard ms : force) : ` + pk.map(([ms, v]) => `${ms.toFixed(0)}:${v.toFixed(2)}`).join('  ')) }
