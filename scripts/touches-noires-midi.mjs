// « Touches noires » joue TON fichier MIDI : les pistes d'un .mid sont réparties sur les instruments du kit
// scripts/kit/touches-noires-kit.mjs (lead qui ronronne, nappe, accords pincés, basse, batterie fabriquée) et il en sort un preset.
// Ce script ne contient aucune note : tout vient du fichier qu'on lui donne. Mode d'emploi complet : scripts/kit/README.md.
//
//   node scripts/touches-noires-midi.mjs morceau.mid                 répartition DEVINÉE, écrit target/<id>.json (+ -flat.json pour le banc)
//   node scripts/touches-noires-midi.mjs morceau.mid --inspect       montre les pistes et la répartition devinée, n'écrit rien
//   node scripts/touches-noires-midi.mjs morceau.mid --lead 3+24 --pad 0 --pluck 2 --bass 4 --kick 1@27 --snap 1@37 --hat 1@42,46
//   node scripts/touches-noires-midi.mjs fiche.json                  les mêmes options rangées dans un fichier ({ "midi": "morceau.mid", "lead": "3+24", … })
//   … --install    écrit aussi dans public/presets/local/ (ignoré par git) : le preset apparaît dans l'app, groupe « Local »
//                  ⚠️ Vite recharge la page ouverte (coupe l'écoute en cours)
//
// Un rôle = `pistes[@hauteurs]` : `0,5` = pistes 0 et 5 · `3+24` = piste 3 montée de 2 octaves · `1@35,36` = les notes 35 et 36 de la piste 1.
import pkg from '@tonejs/midi'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, resolve } from 'node:path'
import { buildKit, deal, hold, lanes, line, mergeRuns } from './kit/touches-noires-kit.mjs'
const { Midi } = pkg

const ROLES = ['lead', 'pad', 'pluck', 'bass', 'kick', 'snap', 'hat'], DRUMS = ['kick', 'snap', 'hat']
const VALUE = new Set([...ROLES, 'midi', 'id', 'name', 'bpm', 'question', 'tune', 'level']), BOOL = new Set(['inspect', 'install', 'hold-pad', 'merge-runs', 'no-calibrate'])
const GM = { kick: [35, 36], snap: [37, 38, 39, 40], hat: [42, 44, 46] } // batterie General MIDI (canal 10)
const HOME = { lead: [60, 79], pad: [52, 68], pluck: [58, 80], bass: [33, 50] } // registre pour lequel chaque instrument a été réglé (médiane des notes)
const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], nn = (m) => N[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1)
const die = (msg) => { console.error('erreur : ' + msg + '\n(mode d\'emploi : scripts/kit/README.md)'); process.exit(1) }
const ascii = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?')

// ---- options : ligne de commande, ou fiche JSON (mêmes noms) --------------------------------------------------------------------
const opt = {}
{ const argv = process.argv.slice(2); let file = null
  for (let i = 0; i < argv.length; i++) { const a = argv[i]
    if (!a.startsWith('--')) { file = a; continue }
    const k = a.slice(2); if (BOOL.has(k)) opt[k] = true; else if (VALUE.has(k)) opt[k] = argv[++i] ?? die(`--${k} attend une valeur`); else die(`option inconnue --${k}`) }
  if (!file) die('donner un fichier .mid ou une fiche .json')
  if (extname(file).toLowerCase() === '.json') { const fiche = JSON.parse(readFileSync(file, 'utf8'))
    for (const [k, v] of Object.entries(fiche)) { if (!BOOL.has(k) && !VALUE.has(k)) die(`cle inconnue "${k}" dans ${file}`); if (!(k in opt)) opt[k] = typeof v === 'number' ? String(v) : v }
    if (!opt.midi) die(`${file} : il manque la cle "midi"`); opt.midi = resolve(dirname(file), opt.midi); opt.fiche = file
  } else opt.midi = file }
if (!existsSync(opt.midi)) die(`fichier introuvable : ${opt.midi}`)

// ---- lecture du fichier ------------------------------------------------------------------------------------------------------------
const buf = readFileSync(opt.midi), midi = new Midi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const PPQ = midi.header.ppq, S16 = PPQ / 4, [sigNum, sigDen] = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4], BAR = Math.round((PPQ * 4 * sigNum) / sigDen)
const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1]
const tracks = midi.tracks.map((t, i) => { const ns = t.notes; if (!ns.length) return { i, n: 0, name: t.name }
  const ev = ns.flatMap((n) => [[n.ticks, 1], [n.ticks + n.durationTicks, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); let cur = 0, poly = 0
  for (const [, d] of ev) { cur += d; poly = Math.max(poly, cur) }
  const pitches = new Map(); for (const n of ns) pitches.set(n.midi, (pitches.get(n.midi) || 0) + 1)
  return { i, n: ns.length, name: t.name, inst: t.instrument?.name ?? '', family: t.instrument?.family ?? '', perc: !!t.instrument?.percussion || t.channel === 9, channel: t.channel,
    lo: Math.min(...pitches.keys()), hi: Math.max(...pitches.keys()), med: median(ns.map((n) => n.midi)), poly, med16: median(ns.map((n) => n.durationTicks)) / S16, pitches } })

// ---- répartition : donnée par l'utilisateur, sinon devinée -----------------------------------------------------------------------
const parseSpec = (role, spec) => { const [tr, pit] = String(spec).split('@')
  const pitches = pit ? pit.split(',').map((p) => (/^\d+$/.test(p.trim()) ? +p : die(`--${role} : hauteur "${p}" (attendu un numero MIDI)`))) : null
  return tr.split(',').map((tok) => { const m = /^\s*(\d+)\s*([+-]\d+)?\s*$/.exec(tok) ?? die(`--${role} : piste "${tok}" (attendu p. ex. 3, 3+12 ou 1@35,36)`)
    const t = tracks[+m[1]]; if (!t?.n) die(`--${role} : la piste ${m[1]} n'existe pas ou n'a pas de notes`)
    return { track: +m[1], transpose: +(m[2] ?? 0), pitches } }) }
const octaveFor = (role, med) => { const [lo, hi] = HOME[role]; let k = 0; while (med + 12 * k < lo) k++; while (med + 12 * k > hi) k--; return 12 * k }
const guess = () => { const map = {}, mel = tracks.filter((t) => t.n && !t.perc), label = (t) => `${t.name} ${t.inst} ${t.family}`, take = (t) => mel.splice(mel.indexOf(t), 1)[0]
  for (const d of tracks.filter((t) => t.n && t.perc)) for (const role of DRUMS) { const found = GM[role].filter((p) => d.pitches.has(p)); if (found.length) (map[role] ??= []).push({ track: d.i, transpose: 0, pitches: found }) }
  const put = (role, t) => (map[role] ??= []).push({ track: t.i, transpose: octaveFor(role, t.med), pitches: null })
  const bass = mel.find((t) => /bass/i.test(label(t))) ?? mel.filter((t) => t.med < 52 && t.poly <= 2).sort((a, b) => a.med - b.med)[0]; if (bass) put('bass', take(bass))
  const lead = mel.find((t) => /lead|melod|solo|vocal|voice|chant/i.test(label(t))) ?? [...mel].sort((a, b) => (b.poly <= 2) - (a.poly <= 2) || (b.med16 >= 1.5) - (a.med16 >= 1.5) || b.med - a.med)[0]; if (lead) put('lead', take(lead)) // de préférence une ligne, chantée, la plus haute
  const room = { pad: 3, pluck: 4 } // tenu = nappe (3 voix), bref = accords pincés (4 voix) ; ce qui ne tient pas dans l'un va dans l'autre, sinon reste de côté
  for (const t of mel) { const want = /pad|string|ensemble|choir|organ/i.test(label(t)) || t.med16 >= 3 ? 'pad' : 'pluck', role = [want, want === 'pad' ? 'pluck' : 'pad'].find((r) => room[r] >= t.poly)
    if (role) { room[role] -= t.poly; put(role, t) } }
  return map }
const given = ROLES.some((r) => r in opt), map = given ? Object.fromEntries(ROLES.filter((r) => r in opt).map((r) => [r, parseSpec(r, opt[r])])) : guess()
const specText = (r) => map[r].map((s) => s.track + (s.transpose ? (s.transpose > 0 ? '+' : '') + s.transpose : '')).join(',') + (map[r][0].pitches ? '@' + map[r][0].pitches.join(',') : '')
const mapText = ROLES.filter((r) => map[r]).map((r) => `--${r} ${specText(r)}`).join(' ')

const tempos = [...new Set(midi.header.tempos.map((t) => +t.bpm.toFixed(2)))], bpm = opt.bpm ? +opt.bpm : tempos[0] ?? 120
console.log(`${basename(opt.midi)} : ${PPQ} ticks/noire · ${sigNum}/${sigDen} · tempo ${bpm}${opt.bpm ? ' (force)' : ''} · ${midi.duration.toFixed(0)} s`)
const roleOf = (i) => ROLES.filter((r) => map[r]?.some((s) => s.track === i)).join('+') || '—'
for (const t of tracks) console.log(t.n ? `  piste ${t.i} ${JSON.stringify(t.name || t.inst)}${t.perc ? ' [batterie]' : ''} : ${t.n} notes · ${nn(t.lo)}..${nn(t.hi)} (mediane ${nn(t.med)}) · polyphonie ${t.poly} · duree mediane ${t.med16.toFixed(1)} doubles-croches → ${roleOf(t.i)}`
  : `  piste ${t.i} ${JSON.stringify(t.name ?? '')} : vide`)
console.log(`repartition ${given ? 'donnee' : 'DEVINEE'} : ${mapText || '(rien)'}`)
const warn = (msg) => console.log('  ! ' + msg)
if (tempos.length > 1 && !opt.bpm) warn(`le fichier change de tempo (${tempos.join(', ')}) : le sequenceur n'en suit qu'un, ${bpm} est garde (--bpm pour en choisir un autre)`)
for (const d of tracks.filter((t) => t.n && t.perc && !DRUMS.some((r) => map[r]?.some((s) => s.track === t.i))))
  warn(`piste ${d.i} : batterie hors General MIDI, a repartir a la main — hauteurs presentes : ${[...d.pitches.entries()].sort((a, b) => b[1] - a[1]).map(([p, c]) => `${p} (${nn(p)}) x${c}`).join(', ')} → --kick ${d.i}@… --snap ${d.i}@… --hat ${d.i}@…`)
const idle = tracks.filter((t) => t.n && !t.perc && roleOf(t.i) === '—'); if (idle.length) warn(`piste${idle.length > 1 ? 's' : ''} ${idle.map((t) => t.i).join(', ')} non jouee${idle.length > 1 ? 's' : ''} (${given ? 'aucun role ne la prend' : 'plus de voix libre : nappe 3, accords pinces 4'})`)
for (const r of Object.keys(HOME)) for (const s of map[r] ?? []) { const med = tracks[s.track].med + s.transpose, k = octaveFor(r, med)
  if (k) warn(`${r} : piste ${s.track} mediane ${nn(med)}, l'instrument est regle pour ${nn(HOME[r][0])}..${nn(HOME[r][1])} → essayer ${s.track}${s.transpose + k > 0 ? '+' : ''}${s.transpose + k || ''}`) }
if (!mapText) die('aucune piste a jouer')
if (opt.inspect) process.exit(0)

// ---- des pistes aux parties du kit --------------------------------------------------------------------------------------------------
const notesOf = (role) => (map[role] ?? []).flatMap((s) => midi.tracks[s.track].notes.filter((n) => !s.pitches || s.pitches.includes(n.midi))
  .map((n) => ({ tick: Math.round(n.ticks), note: n.midi + s.transpose, dur: Math.max(1, Math.round(n.durationTicks)), vel: Math.max(1, Math.round(n.velocity * 127)) })))
  .sort((a, b) => a.tick - b.tick || b.note - a.note)
const clean = (notes) => notes.map(({ tick, note, dur }) => ({ tick, note, dur }))
const runs = (notes) => (opt['merge-runs'] ? mergeRuns(notes) : notes)
const crowded = (lane) => lane.filter((n, i) => i && lane[i - 1].tick + lane[i - 1].dur > n.tick).length
const split = (role, count) => { const L = lanes(clean(notesOf(role)), count), lost = L.reduce((a, l) => a + crowded(l), 0)
  if (lost) warn(`${role} : ${lost} notes de trop pour ${count} voix (elles coupent la note precedente de la derniere voix)`); return L }
const leadAll = runs(clean(notesOf('lead'))), leadPoly = crowded(leadAll) > 0
const bassAll = runs(clean(notesOf('bass')))
const hits = (role) => { const m = new Map(); for (const n of notesOf(role)) m.set(n.tick, Math.max(m.get(n.tick) ?? 0, n.vel)); return [...m.entries()].map(([tick, vel]) => ({ tick, vel })) }
const parts = { lead: leadAll, ...(leadPoly ? { shadow: line(leadAll, true) } : {}), bass: crowded(bassAll) ? line(bassAll, false) : bassAll,
  pad: split('pad', 3).map((l) => (opt['hold-pad'] ? hold(l, BAR) : l)), pluck: split('pluck', 4), kick: hits('kick'), snap: hits('snap'), hat: hits('hat') }
if (leadPoly) { console.log('  lead polyphonique : notes distribuees aux 4 voix, l\'ombre suit la note du dessus')
  const lost = deal(leadAll, 4).reduce((a, l) => a + crowded(l), 0); if (lost) warn(`lead : ${lost} notes de trop pour 4 voix (elles coupent la note qui finit le plus tot)`) }
const lastTick = Math.max(...ROLES.flatMap((r) => notesOf(r).map((n) => n.tick + n.dur))), totalTicks = Math.ceil(lastTick / BAR) * BAR, seconds = (totalTicks / PPQ) * (60 / bpm)

const noteOrMidi = (s) => { const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(s.trim()); if (!m) return /^\d+$/.test(s.trim()) ? +s : die(`--question : "${s}" (attendu p. ex. A#4,C#5 ou 70,73)`)
  return 12 * (+m[3] + 1) + N.indexOf(m[1].toUpperCase()) + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) }
const question = opt.question ? String(opt.question).split(',').map(noteOrMidi) : null
if (question && question.length !== 2) die('--question attend DEUX notes (p. ex. A#4,C#5)')
const [leadTuneCents, bedTuneCents] = opt.tune ? String(opt.tune).split(',').map(Number) : [37, 20]

const slug = (opt.id ?? basename(opt.midi, extname(opt.midi))).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'morceau'
const name = opt.name ?? basename(opt.midi, extname(opt.midi))
const again = opt.fiche ? `node scripts/touches-noires-midi.mjs ${opt.fiche}` : `node scripts/touches-noires-midi.mjs ${basename(opt.midi)} ${mapText}`
const NOTES = ascii(`${name.toUpperCase()} — joue par le kit Touches noires

Fichier MIDI : ${basename(opt.midi)} · tempo ${bpm} · ${Math.round(totalTicks / BAR)} mesures · ${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}, en boucle.
${ROLES.filter((r) => map[r]).map((r) => `- ${r.toUpperCase()} : ${map[r].map((s) => `piste ${s.track} ${JSON.stringify(tracks[s.track].name || tracks[s.track].inst)}${s.transpose ? ` ${s.transpose > 0 ? '+' : ''}${s.transpose} demi-tons` : ''}${s.pitches ? ` (notes ${s.pitches.join(', ')})` : ''}`).join(' + ')}`).join('\n')}

Les instruments : lead en dent de scie qui RONRONNE (deux LFO a 12,7 Hz sur la hauteur et le volume), 4 voix pour que le release
de chaque note sonne sur les suivantes, il gonfle sur les tenues et une ombre le double a l'octave du dessous · nappe a tremolo
6,5 Hz · accords pinces · basse + sous-octave · batterie fabriquee en sinus et bruit. Mono, sec. Lead accorde +${leadTuneCents} cents,
le reste +${bedTuneCents} : les voix frottent un peu${question ? ` · nappe haute tenue ${question.map(nn).join(' + ')}` : ''}.

Refaire ce preset : ${again}`)

const build = (outLevel) => buildKit({ bpm, ticksPerBeat: PPQ, totalTicks, parts, question, notesText: NOTES, notesName: name, outLevel, leadTuneCents, bedTuneCents })
mkdirSync('target', { recursive: true })
const flat = `target/${slug}-flat.json`
let outLevel = opt.level ? +opt.level : 2.3
// niveau de sortie : un rendu hors ligne du morceau entier, puis la sortie est réglée pour une crête à 0,95 (la sortie est le dernier étage, linéaire)
if (!opt.level && !opt['no-calibrate']) { const exe = 'target/release/examples/render_graph' + (process.platform === 'win32' ? '.exe' : '')
  spawnSync('cargo', ['build', '-q', '--release', '-p', 'dsp-graph', '--example', 'render_graph'], { stdio: 'ignore' })
  if (!existsSync(exe)) warn(`pas de banc de rendu (cargo absent ?) : niveau de sortie ${outLevel} non verifie`)
  else { writeFileSync(flat, JSON.stringify({ ...build(outLevel), taps: [] }))
    const t0 = Date.now(), r = spawnSync(exe, [flat, `target/${slug}.f32`, String(Math.ceil(seconds) + 1)], { encoding: 'utf8' }), m = /peak=([\d.]+)\s+nan=(\d+)/.exec(r.stderr ?? '')
    if (!m || +m[2] || !(+m[1] > 0)) warn(`rendu de controle inexploitable (${(r.stderr ?? '').trim().split('\n').pop() || 'pas de sortie'}) : niveau de sortie ${outLevel} non verifie`)
    else { outLevel = +((outLevel * 0.95) / +m[1]).toFixed(3); console.log(`  banc : crete ${m[1]} au niveau 2.3 → niveau de sortie ${outLevel} (crete 0,95) · rendu de ${Math.ceil(seconds)} s en ${((Date.now() - t0) / 1000).toFixed(1)} s`) } } }

const graph = build(outLevel)
const preset = { version: 1, id: 'local-' + slug, name, group: 'Local', description: ascii(`${basename(opt.midi)} joue par le kit Touches noires (${ROLES.filter((r) => map[r]).join(', ')}). ${Math.round(totalTicks / BAR)} mesures a ${bpm}.`), graph }
writeFileSync(flat, JSON.stringify({ ...graph, taps: [] }))
writeFileSync(`target/${slug}.json`, JSON.stringify(preset))
console.log(`ecrit target/${slug}.json (${graph.modules.length} modules, ${graph.connections.length} cables ; bouton Import de l'app) + ${flat} pour le banc`)
if (opt.install) { const dir = 'public/presets/local', mf = `${dir}/manifest.json`; mkdirSync(dir, { recursive: true })
  const manifest = existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : { presets: [] }, entry = { id: preset.id, name, description: preset.description, file: `${slug}.json`, group: 'Local' }
  manifest.presets = [...(manifest.presets ?? []).filter((p) => p.id !== entry.id), entry]
  writeFileSync(`${dir}/${slug}.json`, JSON.stringify(preset)); writeFileSync(mf, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`installe dans ${dir}/ (ignore par git) : preset "${name}", groupe Local — ?preset=${preset.id}`) }
