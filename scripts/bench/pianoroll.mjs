// Banc de recreation — piano-roll POLYPHONIQUE sur la grille des doubles-croches.
// Montre quelles notes sonnent en meme temps : X = depart de note (le niveau saute), = = tenue, . = absente.
// A utiliser AVANT lead-track.mjs : ce dernier ne garde que la note la plus forte et aplatit la polyphonie en une fausse
// ligne a une voix. Limites connues : chaque coup de batterie cree de faux departs sur toutes les lignes, et une note situee
// une octave au-dessus d'une note plus forte est ignoree (prise pour son 2e harmonique). Une carte de notes ne dit pas
// laquelle l'oreille suit : les voix d'accompagnement sont souvent 10 dB sous la voix principale.
//
//   node scripts/bench/pianoroll.mjs <in.f32> <doubleCrocheDeDepart> <mesures> [accordageCents=0] [bpm=120] [phase=0] [midiBas=48] [midiHaut=96]
// <in.f32> = mono 48 kHz f32 (ffmpeg -i x.mp3 -ac 1 -ar 48000 -f f32le x.f32, ou render_graph).
import { readFileSync } from 'node:fs'
const SR = 48000
const [, , p, slot0S, barsS, tuneS = '0', bpmS = '120', phS = '0', loS = '48', hiS = '96'] = process.argv
if (!p || !barsS) { console.error('usage: pianoroll.mjs <in.f32> <slot0> <bars> [tuneCents] [bpm] [phase] [midiLo] [midiHi]'); process.exit(1) }
const b = readFileSync(p), s = new Float32Array(b.buffer, b.byteOffset, (b.length / 4) | 0)
const S16 = 60 / +bpmS / 4, T = Math.pow(2, +tuneS / 1200), slot0 = +slot0S, NB = +barsS
const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NOTES = []; for (let m = +hiS; m >= +loS; m--) NOTES.push([N[m % 12] + (Math.floor(m / 12) - 1), m])
const W = Math.round(S16 * SR * 0.9), H = 2 // deux mesures par double-croche
const lv = (c, f) => { let best = 0
  for (const df of [-0.01, -0.005, 0, 0.005, 0.01]) { const ff = f * (1 + df); let a = 0, q = 0
    for (let n = 0; n < W; n++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / W), x = (s[c - W / 2 + n] || 0) * h; a += x * Math.cos((2 * Math.PI * ff * n) / SR); q += x * Math.sin((2 * Math.PI * ff * n) / SR) }
    best = Math.max(best, Math.hypot(a, q) / W) }
  return 20 * Math.log10(best + 1e-9) }
const steps = NB * 16 * H
const L = NOTES.map(([, m]) => Array.from({ length: steps }, (_, k) => lv(Math.round((+phS + (slot0 + (k + 0.5) / H) * S16) * SR), 440 * T * Math.pow(2, (m - 69) / 12))))
const gmax = Math.max(...L.flat())
const roll = NOTES.map(([name], r) => { const row = []
  for (let k = 0; k < steps; k += H) { const now = Math.max(L[r][k], L[r][k + 1]), prev = k >= H ? Math.max(L[r][k - 1], L[r][k - 2]) : -99
    const below = NOTES.findIndex(([, m]) => m === NOTES[r][1] - 12), isHarm = below >= 0 && Math.max(L[below][k], L[below][k + 1]) > now + 3
    row.push(now < gmax - 22 || isHarm ? '.' : now - prev >= 6 ? 'X' : '=') }
  return [name, row] })
for (let bar = 0; bar < NB; bar++) { console.log(`mesure ${String(bar + 1).padEnd(12)} 1 . . . 2 . . . 3 . . . 4 . . .`)
  for (const [name, row] of roll) { const seg = row.slice(bar * 16, bar * 16 + 16); if (seg.some((c) => c !== '.')) console.log('   ' + name.padEnd(16) + seg.join(' ')) } }
