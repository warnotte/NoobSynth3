// Banc de recreation — ligne de BASSE : partiel le plus fort dans le grave, double-croche par double-croche.
// Les positions ou tombe le kick sont affichees entre parentheses (son corps masque la basse a cet endroit).
// Fiabilite : une ligne qui se repete a l'identique d'un cycle a l'autre est une ligne bien lue.
//
//   node scripts/bench/bassline.mjs <in.f32> <doubleCrocheDeDepart> <mesures> [bpm=120] [phase=0] [accordageCents=0] [positionsDuKick=0,8] [midiBas=28] [midiHaut=48]
import { readFileSync } from 'node:fs'
const SR = 48000
const [, , p, s0S, barsS, bpmS = '120', phS = '0', tuneS = '0', kickS = '0,8', loS = '28', hiS = '48'] = process.argv
if (!p || !barsS) { console.error('usage: bassline.mjs <in.f32> <slot0> <bars> [bpm] [phase] [tuneCents] [kickSlots] [midiLo] [midiHi]'); process.exit(1) }
const b = readFileSync(p), s = new Float32Array(b.buffer, b.byteOffset, (b.length / 4) | 0)
const S16 = 60 / +bpmS / 4, PH = +phS, T = Math.pow(2, +tuneS / 1200), KICK = new Set(kickS.split(',').map(Number))
const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const cand = []; for (let m = +loS; m <= +hiS; m++) cand.push(m)
const W = Math.round(S16 * SR * 1.9)
const lv = (c, f) => { let best = 0
  for (const df of [-0.012, 0, 0.012]) { const ff = f * (1 + df); let a = 0, q = 0
    for (let n = 0; n < W; n++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / W), x = (s[c - W / 2 + n] || 0) * h; a += x * Math.cos((2 * Math.PI * ff * n) / SR); q += x * Math.sin((2 * Math.PI * ff * n) / SR) }
    best = Math.max(best, Math.hypot(a, q) / W) }
  return best }
for (let bar = 0; bar < +barsS; bar++) { let line = ''
  for (let k = 0; k < 16; k++) { const c = Math.round((PH + (+s0S + bar * 16 + k + 0.5) * S16) * SR)
    const L = cand.map((m) => lv(c, 440 * T * Math.pow(2, (m - 69) / 12))), mx = Math.max(...L), i = L.indexOf(mx), kick = KICK.has(k)
    line += (20 * Math.log10(mx + 1e-12) < -40 ? ' .  ' : (kick ? '(' : ' ') + N[cand[i] % 12] + (Math.floor(cand[i] / 12) - 1) + (kick ? ')' : ' ')).padEnd(5) }
  console.log(`mes.${String(Math.floor(+s0S / 16) + bar + 1).padStart(3)} | ${line}`) }
