// « Touches noires » (preset `touches-noires`, groupe Showcase) : le kit scripts/kit/touches-noires-kit.mjs joué avec NOS notes.
// Tout est écrit sur les cinq touches noires (do# ré# fa# sol# la#) : aucune note ne peut sonner faux.
//   node scripts/touches-noires.mjs            écrit target/touches-noires.json (pour le banc : render_graph, scripts/bench/)
//   node scripts/touches-noires.mjs --public   écrit public/presets/touches-noires.json (⚠️ Vite recharge la page ouverte)
import { writeFileSync, mkdirSync } from 'node:fs'
import { buildKit } from './kit/touches-noires-kit.mjs'

const BPM = 132, PPQ = 480, S16 = PPQ / 4, BAR = S16 * 16, BARS = 24
const at = (notes, bar) => notes.map(([s, n, d]) => ({ tick: (bar * 16 + s) * S16, note: n, dur: d * S16 }))
const bars = (from, to, fn) => Array.from({ length: to - from }, (_, b) => fn(from + b)).flat()

// lead : une phrase de 8 mesures, grille de doubles-croches, petites notes d'ornement d'une double-croche
const PHRASE = [[0, 63, 5], [5, 66, 1], [6, 63, 2], [8, 68, 6], [14, 70, 1], [15, 68, 1], [16, 66, 8], [24, 63, 2], [26, 61, 2], [28, 63, 4],
  [32, 73, 4], [36, 70, 1], [37, 73, 1], [38, 70, 2], [40, 68, 6], [46, 66, 2], [48, 68, 1], [49, 70, 1], [50, 68, 2], [52, 66, 10], [62, 63, 2],
  [64, 70, 4], [68, 73, 1], [69, 75, 1], [70, 73, 2], [72, 70, 6], [78, 68, 2], [80, 66, 6], [86, 68, 1], [87, 66, 1], [88, 63, 8],
  [96, 61, 2], [98, 63, 2], [100, 66, 4], [104, 68, 4], [108, 70, 2], [110, 73, 2], [112, 70, 1], [113, 73, 1], [114, 70, 2], [116, 68, 4], [120, 66, 8]]
const lead = [...at(PHRASE, 4), ...at(PHRASE, 12), ...at(PHRASE.filter(([s]) => s < 64), 20)] // mesures 5-12, 13-20, puis seul 21-24
// basse : entre mesure 9 (seconde moitié de la ligne), complète mesures 13-20
const BASS_8 = [[0, 42, 14], [16, 42, 12], [28, 44, 4], [32, 39, 14], [48, 39, 8], [56, 37, 8], [64, 46, 14], [80, 46, 12], [92, 44, 4], [96, 42, 16], [112, 39, 8], [120, 37, 8]]
const bass = [...at(BASS_8.filter(([s]) => s >= 64).map(([s, n, d]) => [s - 64, n, d]), 8), ...at(BASS_8, 12)]
// nappe : do#4 et la#3 tenus, la voix du bas tourne sur 4 mesures (fa# · ré# · fa# · sol#). Elle se tait mesures 21-22 et revient pour finir.
const LOW = [54, 51, 54, 56]
const padBars = [...Array.from({ length: 20 }, (_, b) => b), 22, 23]
const pad = [padBars.flatMap((b) => at([[0, 61, 16]], b)), padBars.flatMap((b) => at([[0, 58, 16]], b)), padBars.flatMap((b) => at([[0, LOW[b % 4], 16]], b))]
// accords pincés : sur les contretemps, les notes de l'accord une octave au-dessus de la nappe (mesures 9-20)
const PLUCKS = [[73, 70, 73, 66], [70, 66, 70, 63], [73, 70, 73, 66], [73, 68, 75, 68]]
const pluck = [bars(8, 20, (b) => at([2, 6, 10, 14].map((s, i) => [s, PLUCKS[b % 4][i], 1]), b))]
// batterie : kick sur 1 et 3 (+ un rappel), clac sur 2 et 4 (+ deux fantômes) ; charley en croches fort/faible à partir de la mesure 13
const hits = (from, to, pat) => bars(from, to, (b) => pat.map(([s, vel]) => ({ tick: (b * 16 + s) * S16, vel })))
const kick = hits(0, 20, [[0, 110], [8, 100], [10, 58]]), snap = hits(0, 20, [[4, 105], [12, 110], [6, 30], [14, 38]])
const hat = hits(12, 20, [[0, 100], [2, 62], [4, 100], [6, 66], [8, 100], [10, 62], [12, 100], [14, 70], [3, 30], [11, 30], [15, 34]])

const NOTES = `TOUCHES NOIRES

Une couleur faite de modules de base (VCO, VCF, ADSR, VCA, LFO, bruit) : pas de boite a rythmes, pas de sample.
Tout est ecrit sur les cinq touches noires (do# re# fa# sol# la#) : aucune note ne peut sonner faux.

- LE RONRON : deux LFO a 12,7 Hz font trembler la hauteur (+-22 cents) et le volume du lead. A cette vitesse on n'entend plus
  un vibrato mais un grain. Baisser RATE vers 5 Hz = vibrato normal.
- LEAD A 4 VOIX : les notes sont distribuees a tour de role a 4 copies du synthe, pour que le RELEASE de chaque note sonne
  par-dessus les suivantes. Il GONFLE sur les notes tenues, et son OMBRE (une octave plus bas, ronron lent a 6,5 Hz) eclot dessous.
- LA QUESTION : une nappe haute ne tient que la#4 + do#5, une tierce sans fondamentale (fa# majeur ? la# mineur ?).
- NAPPE : do#4 + la#3 tenus, la voix du bas tourne (fa# re# fa# sol#), tremolo 6,5 Hz. ACCORDS PINCES sur les contretemps.
- BATTERIE FABRIQUEE : kick = sinus 42 Hz + 95 Hz dont la hauteur tombe en 30 ms, coupe net ; clac = 15 ms de bruit rose
  pousse dans un filtre + un corps a 180 Hz ; charley = bruit au-dessus de 5,5 kHz. Mono, sec, pas de reverb.
- Le lead est accorde 37 cents trop haut, la nappe et la basse 20 : les voix frottent un peu.

L'ADSR de ce synthe monte, tient tant que la note dure, puis RELACHE : les sons percussifs sont une note tres courte + le
RELEASE. 24 mesures : nappe + batterie · le lead entre mesure 5 · basse et accords mesure 9 · charley mesure 13 · mesures 21-24
le lead reste seul puis la nappe revient. Ce kit peut jouer n'importe quelles notes : voir scripts/kit/touches-noires-kit.mjs.`

const graph = buildKit({ bpm: BPM, ticksPerBeat: PPQ, totalTicks: BARS * BAR, notesText: NOTES, outLevel: 2.35, parts: { lead, bass, pad, pluck, kick, snap, hat } })
const preset = { id: 'touches-noires', name: 'Touches noires', group: 'Showcase',
  description: 'Lead polyphonique qui ronronne (LFO 12,7 Hz), nappe a tremolo, batterie fabriquee en sinus et bruit : une couleur faite de modules de base, ecrite sur les touches noires.', graph }
const pub = process.argv.includes('--public')
mkdirSync('target', { recursive: true })
const out = pub ? 'public/presets/touches-noires.json' : 'target/touches-noires.json'
writeFileSync(out, JSON.stringify(preset, null, 2) + '\n')
writeFileSync('target/touches-noires-flat.json', JSON.stringify({ ...graph, taps: [] }))
console.log(`ecrit ${out} (${graph.modules.length} modules, ${graph.connections.length} cables) + target/touches-noires-flat.json pour le banc`)
