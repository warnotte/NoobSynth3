// "Les Deux Mondes d'Hyrule" — a Zelda: A Link to the Past suite (Koji Kondo) as a multi-rack project, in the spirit of
// "Le Rêve de Dinosaur Land" (scripts/reve-dinosaur.mjs): the legend opens, the Light World, the fairy, the Lost Woods,
// the fall into the Dark World, Ganon, and the credits. Every note comes from the VGMusic transcriptions that agree best
// with independent ones (scripts/sources/zelda3/SOURCES.md); the arrangement only chooses who plays what.
//
//   node scripts/deux-mondes.mjs              build into target/deux-mondes-build/ (the app is not touched)
//   node scripts/deux-mondes.mjs --public     write the project, MIDI files and manifests into public/
//   node scripts/deux-mondes-calibrate.mjs    render each rack, set the per-section levels (target/ only)
//
// Writing public/ makes the Vite dev server reload the open page: warn the user before using --public.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import toneMidi from '@tonejs/midi'
const { Midi } = toneMidi

const ID = 'deux-mondes'
const TITLE = "Les Deux Mondes d'Hyrule"
const PUBLIC = process.argv.includes('--public')
const BUILD = 'target/deux-mondes-build'
const BPM = 120
const PPQ = 480
const TICKS_PER_SEC = (BPM / 60) * PPQ
const VOICES = 8
const VOLUME_GAIN = 2 * VOICES // see songe-hyrule.mjs: poly VCA averaged into the mono reverb
const SLEW_RISE = 0.3
const SLEW_FALL = 0.9
const SRC = 'scripts/sources/zelda3/'

// ---------------------------------------------------------------- sources
function source(file) {
  const buf = readFileSync(SRC + file)
  const midi = new Midi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const tracks = midi.tracks.map((t) => ({
    channel: t.channel,
    notes: t.notes.map((n) => ({ t: n.time, d: n.duration, m: n.midi, v: Math.max(1, Math.round(n.velocity * 127)) })),
  }))
  return { midi, tracks }
}
/** indices of the tracks holding notes on MIDI channel `ch` (1-based); `first`/`last` pick among several */
const onChannel = (src, ch) => src.tracks.map((t, i) => (t.channel === ch - 1 && t.notes.length ? i : -1)).filter((i) => i >= 0)
const bars = (n, bpm) => (n * 240) / bpm

// ---------------------------------------------------------------- arrangement lanes
const RACKS = [
  { id: 'handpans', name: 'Handpans', lanes: ['basse', 'medium', 'aigu'] },
  { id: 'harpe', name: 'Harpe & cloches', lanes: ['harpe', 'pizz', 'cloche'] },
  { id: 'snes', name: 'SNES', lanes: ['lead', 'cuivre', 'sombre'] },
  { id: 'nappe', name: 'Nappe', lanes: ['flutes'] },
  { id: 'orgue', name: 'Orgue', lanes: ['grand', 'sombre', 'pedale'] },
  { id: 'percu', name: 'Percussions', lanes: ['timbales', 'caisse'] },
]
const lanes = Object.fromEntries(RACKS.flatMap((r) => r.lanes.map((l) => [`${r.id}.${l}`, []])))

/** `handpans` goes note by note to the handpan of its register (exact notes, each handpan < 32 fields). */
function put(lane, n) {
  if (n.d <= 0 || n.t < 0) return
  let m = n.m
  if (lane === 'handpans') {
    while (m < 36) m += 12
    lane = m < 60 ? 'handpans.basse' : m < 84 ? 'handpans.medium' : 'handpans.aigu'
  }
  if (!lanes[lane]) throw new Error(`unknown lane ${lane}`)
  lanes[lane].push({ t: n.t, d: n.d, m, v: Math.max(1, Math.min(127, Math.round(n.v))) })
}

/** notes of `tracks` in [from, to) seconds of a source, placed at `at` */
function excerpt(src, { tracks, from, to, at, transpose = 0, lane, vel = 1, filter = () => true, tail = 0 }) {
  for (const ti of tracks) {
    for (const n of src.tracks[ti].notes) {
      if (n.t < from - 1e-6 || n.t >= to - 1e-6 || !filter(n)) continue
      const end = Math.min(n.t + n.d, to + tail)
      put(lane, { t: at + n.t - from, d: end - n.t, m: n.m + transpose, v: n.v * vel })
    }
  }
}

const sections = []
function section(key, name, at, end, { racks, fadeOut = 1.5 } = {}) {
  sections.push({ key, name, at: +at.toFixed(3), end: +end.toFixed(3), racks, fadeOut })
  return end
}
let at = 0

// 1. Prologue (Haakon Marthinsen; 88-100 % agreement) — the legend opens: the melody on the handpans, the chromatic inner
//    lines as the flute bed, the bass on the organ pedal, the string tremolo as a shimmering harp.
{
  const s = source('Zelda3_Story_Theme.mid')
  const to = 2.2 + bars(32, 135)
  excerpt(s, { tracks: onChannel(s, 1), from: 0, to, at, lane: 'handpans', vel: 0.95 })
  excerpt(s, { tracks: [...onChannel(s, 2), ...onChannel(s, 4)], from: 0, to, at, lane: 'nappe.flutes', vel: 0.8 })
  excerpt(s, { tracks: onChannel(s, 3), from: 0, to, at, lane: 'orgue.pedale', vel: 0.8 })
  excerpt(s, { tracks: [...onChannel(s, 5), ...onChannel(s, 6)], from: 0, to, at, lane: 'harpe.harpe', vel: 0.4 })
  at = section('prologue', 'Prologue — la légende s’ouvre', at, at + to, { racks: ['handpans', 'nappe', 'orgue', 'harpe'], fadeOut: 2 }) + 0.8
}

// 2. Light World (Haakon Marthinsen; 91-99 % agreement) — the brass fanfare on the full organ, the trumpet theme on the
//    handpans doubled by SNES brass, the tuba pinched, trombone harmonies on the harp, strings as the bed, timpani.
{
  const s = source('Zelda3_Light_World_Theme.mid')
  const to = 7.1 + bars(32, 135)
  const trombones = s.tracks.map((t, i) => (t.notes.length && t.notes[0].t < 1 && t.notes.at(-1).t < 8 && [2, 3, 4].includes(t.channel) ? i : -1)).filter((i) => i >= 0)
  excerpt(s, { tracks: trombones, from: 0, to, at, lane: 'orgue.grand', vel: 0.85 })
  excerpt(s, { tracks: onChannel(s, 1), from: 0, to, at, lane: 'handpans', vel: 1 })
  excerpt(s, { tracks: onChannel(s, 1), from: 0, to, at, lane: 'snes.cuivre', vel: 0.55 })
  excerpt(s, { tracks: onChannel(s, 2), from: 0, to, at, lane: 'harpe.pizz', vel: 0.85 })
  excerpt(s, { tracks: onChannel(s, 5).filter((i) => !trombones.includes(i)), from: 0, to, at, lane: 'harpe.harpe', vel: 0.55 })
  excerpt(s, { tracks: [...onChannel(s, 3), ...onChannel(s, 4)].filter((i) => !trombones.includes(i)), from: 0, to, at, lane: 'nappe.flutes', vel: 0.6 })
  excerpt(s, { tracks: onChannel(s, 7), from: 0, to, at, lane: 'percu.timbales', vel: 0.9 })
  at = section('lightworld', 'Light World — le thème du héros', at, at + to, { racks: ['orgue', 'handpans', 'snes', 'harpe', 'nappe', 'percu'], fadeOut: 2 }) + 0.8
}

// 3. Fée (Haakon Marthinsen; 77-86 % agreement) — the fountain's seven harps, the top voice doubled by bells.
{
  const s = source('Zelda3_Fairy_Theme.mid')
  const to = 2.2 + bars(24, 155)
  excerpt(s, { tracks: [1, 2, 3, 4, 5, 6, 7].flatMap((ch) => onChannel(s, ch)), from: 0, to, at: at - 2, lane: 'harpe.harpe', vel: 0.6 })
  excerpt(s, { tracks: onChannel(s, 1), from: 0, to, at: at - 2, lane: 'harpe.cloche', vel: 0.35 })
  at = section('fee', 'La fontaine des fées — harpes et cloches', at, at + to - 2, { racks: ['harpe'], fadeOut: 2 }) + 0.8
}

// 4. Lost Woods (Haakon Marthinsen; 75-78 % agreement) — the melody on the SNES chip (bell wave), the repeated inner
//    ostinato on the handpans, the bass on the low handpan, piccolo lines on the bells, strings as the bed.
{
  const s = source('Zelda3_Lost_Woods_Theme.mid')
  const to = 41.6
  excerpt(s, { tracks: onChannel(s, 1), from: 0, to, at, lane: 'snes.lead', vel: 0.8 })
  excerpt(s, { tracks: onChannel(s, 4), from: 0, to, at, lane: 'handpans', vel: 0.7 })
  excerpt(s, { tracks: onChannel(s, 2), from: 0, to, at, lane: 'handpans', vel: 0.85 })
  excerpt(s, { tracks: onChannel(s, 3), from: 0, to, at, lane: 'harpe.cloche', vel: 0.45 })
  excerpt(s, { tracks: onChannel(s, 5), from: 0, to, at, lane: 'nappe.flutes', vel: 0.6 })
  at = section('lostwoods', 'Lost Woods — la forêt perdue', at, at + to, { racks: ['snes', 'handpans', 'harpe', 'nappe'], fadeOut: 2.5 }) + 1
}

// 5. Dark World (Ryan Pruitt; 87-97 % agreement) — the horn ostinato on the dark organ, the bass on the pedal, the
//    strings on the dark SNES voice, ocarina / oboe / string melodies on the handpans, the snare on the 909 snare.
{
  const s = source('The_Dark_World_No_Quicktime.mid')
  const to = bars(32, 137)
  excerpt(s, { tracks: onChannel(s, 2), from: 0, to, at, lane: 'orgue.sombre', vel: 0.75 })
  excerpt(s, { tracks: onChannel(s, 1), from: 0, to, at, lane: 'orgue.pedale', vel: 0.8 })
  excerpt(s, { tracks: onChannel(s, 3), from: 0, to, at, lane: 'snes.sombre', vel: 0.7 })
  excerpt(s, { tracks: [...onChannel(s, 4), ...onChannel(s, 5)], from: 0, to, at, lane: 'handpans', vel: 1 })
  excerpt(s, { tracks: onChannel(s, 10), from: 0, to, at, lane: 'percu.caisse', vel: 0.55 })
  at = section('darkworld', 'Dark World — la chute dans l’ombre', at, at + to, { racks: ['orgue', 'snes', 'handpans', 'percu'], fadeOut: 2 }) + 1
}

// 6. Ganon (Mark Jansen; 84 % agreement) — the trumpet lead on the dark SNES voice, the trumpet harmonies on the dark
//    organ, the bass on the pedal, the pitched timpani on the low handpan, the drums on the 909 snare.
{
  const s = source('z3ganonbat.mid')
  const to = 1.8 + bars(24, 120)
  excerpt(s, { tracks: onChannel(s, 2), from: 0, to, at, lane: 'snes.sombre', vel: 0.95 })
  excerpt(s, { tracks: [...onChannel(s, 4), ...onChannel(s, 5), ...onChannel(s, 6)], from: 0, to, at, lane: 'orgue.sombre', vel: 0.7 })
  excerpt(s, { tracks: onChannel(s, 1), from: 0, to, at, lane: 'orgue.pedale', vel: 0.8 })
  excerpt(s, { tracks: onChannel(s, 7), from: 0, to, at, lane: 'handpans', vel: 1 })
  excerpt(s, { tracks: onChannel(s, 10), from: 0, to, at, lane: 'percu.caisse', vel: 0.5 })
  at = section('ganon', 'Ganon — le combat', at, at + to, { racks: ['snes', 'orgue', 'handpans', 'percu'], fadeOut: 2.5 }) + 1.5
}

// 7. Générique (core shared by three transcriptions, 90-100 %) — from the snare's entrance: the pan flute theme on the
//    handpans with a bell-chip double, the high strings as the flute bed, the low strings on the harp, the march on
//    the 909 snare; octave bells join for the last phrases.
{
  const s = source('z3credit.mid')
  const from = 130.9
  const to = 238.5
  excerpt(s, { tracks: onChannel(s, 3), from, to, at, lane: 'handpans', vel: 1 })
  excerpt(s, { tracks: onChannel(s, 3), from, to, at, lane: 'snes.lead', vel: 0.4 })
  excerpt(s, { tracks: onChannel(s, 3), from: to - 25, to, at: at + (to - 25 - from), lane: 'harpe.cloche', transpose: 12, vel: 0.35 })
  excerpt(s, { tracks: onChannel(s, 1), from, to, at, lane: 'nappe.flutes', vel: 0.6 })
  excerpt(s, { tracks: onChannel(s, 2), from, to, at, lane: 'harpe.harpe', vel: 0.55 })
  excerpt(s, { tracks: onChannel(s, 10), from, to, at, lane: 'percu.caisse', vel: 0.55 })
  at = section('generique', 'Générique — le retour de la lumière', at, at + (to - from), { racks: ['handpans', 'snes', 'harpe', 'nappe', 'percu'], fadeOut: 4 })
}

// lanes nobody plays in this arrangement are dropped (the MIDI player skips empty tracks)
for (const r of RACKS) r.lanes = r.lanes.filter((l) => lanes[`${r.id}.${l}`].length)

// ---------------------------------------------------------------- volume lanes (mix + transitions)
const LEVELS_PATH = new URL(`./${ID}-levels.json`, import.meta.url)
const levels = existsSync(LEVELS_PATH) ? JSON.parse(readFileSync(LEVELS_PATH, 'utf8')) : {}
const DEFAULT_LEVEL = 0.5
const levelOf = (rack, key) => levels?.[rack]?.[key] ?? DEFAULT_LEVEL
const volume = Object.fromEntries(RACKS.map((r) => [r.id, []]))
const point = (rack, t, level) => volume[rack].push({ t: Math.max(0, t), v: Math.max(1, Math.min(127, Math.round(level * 127))) })
sections.forEach((s, i) => {
  const next = sections[i + 1]
  for (const r of RACKS) {
    const on = s.racks.includes(r.id)
    point(r.id, s.at - 0.3, on ? levelOf(r.id, s.key) : 0)
    if (on && s.fadeOut > 0 && !(next && next.racks.includes(r.id))) point(r.id, s.end - s.fadeOut, 0)
  }
})

// ---------------------------------------------------------------- MIDI files (one per rack)
const OUT_MIDI = PUBLIC ? 'public/midi-presets' : `${BUILD}/midi-presets`
const OUT_PROJECTS = PUBLIC ? 'public/projects' : `${BUILD}/projects`
mkdirSync(OUT_MIDI, { recursive: true })
mkdirSync(OUT_PROJECTS, { recursive: true })
function parseLikeApp(midi) {
  const tempo = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120
  let totalTicks = 0
  const tracks = []
  for (const track of midi.tracks) {
    if (tracks.length >= 8) break
    if (track.notes.length === 0) continue
    const notes = track.notes.slice(0, 8192).map((n) => ({ tick: Math.round(n.ticks), note: n.midi, velocity: Math.round(n.velocity * 127), duration: Math.round(n.durationTicks) })).sort((a, b) => a.tick - b.tick)
    for (const n of notes) totalTicks = Math.max(totalTicks, n.tick + n.duration)
    tracks.push({ name: track.name || `Track ${tracks.length + 1}`, channel: track.channel, notes })
  }
  return { ticksPerBeat: midi.header.ppq, totalTicks, tempo, tracks }
}
const LANE_NAMES = {
  'handpans.basse': 'Handpan basse', 'handpans.medium': 'Handpan medium', 'handpans.aigu': 'Handpan aigu',
  'harpe.harpe': 'Harpe', 'harpe.pizz': 'Harpe basse', 'harpe.cloche': 'Cloches',
  'snes.lead': 'SNES', 'snes.cuivre': 'SNES cuivres', 'snes.sombre': 'SNES sombre', 'nappe.flutes': 'Flutes',
  'orgue.grand': 'Grand orgue', 'orgue.sombre': 'Orgue sombre', 'orgue.pedale': 'Pedale',
  'percu.timbales': 'Timbales', 'percu.caisse': 'Caisse claire',
}
const midiData = {}
for (const rack of RACKS) {
  const out = new Midi()
  out.header.setTempo(BPM)
  out.header.name = `${TITLE} - ${rack.name}`
  const addTrack = (name, channel, notes) => {
    const tr = out.addTrack()
    tr.name = name
    tr.channel = channel
    // one pitch at a time per track: drop exact doubles, end each note before the next one of the same pitch
    const byPitch = new Map()
    for (const n of notes) {
      const tick = Math.round(n.t * TICKS_PER_SEC)
      const list = byPitch.get(n.m) ?? []
      list.push({ tick, end: tick + Math.max(1, Math.round(n.d * TICKS_PER_SEC)), m: n.m, v: n.v })
      byPitch.set(n.m, list)
    }
    const clean = []
    for (const list of byPitch.values()) {
      list.sort((a, b) => a.tick - b.tick || b.v - a.v)
      list.forEach((n, i) => {
        if (i > 0 && list[i - 1].tick === n.tick) return
        const next = list.slice(i + 1).find((x) => x.tick > n.tick)
        clean.push({ ...n, end: Math.max(n.tick + 1, Math.min(n.end, next ? next.tick - 1 : n.end)) })
      })
    }
    for (const n of clean.sort((a, b) => a.tick - b.tick)) tr.addNote({ midi: n.m, ticks: n.tick, durationTicks: n.end - n.tick, velocity: n.v / 127 })
  }
  rack.lanes.forEach((l, i) => addTrack(LANE_NAMES[`${rack.id}.${l}`], rack.id === 'percu' ? 9 : i, lanes[`${rack.id}.${l}`]))
  addTrack('Volume', 15, volume[rack.id].sort((a, b) => a.t - b.t).map((p) => ({ t: p.t, d: 0.02, m: 60, v: p.v })))
  const path = `${OUT_MIDI}/${ID}-${rack.id}.mid`
  writeFileSync(path, Buffer.from(out.toArray()))
  const back = readFileSync(path)
  midiData[rack.id] = parseLikeApp(new Midi(back.buffer.slice(back.byteOffset, back.byteOffset + back.byteLength)))
}

// ---------------------------------------------------------------- racks
const c = (from, fp, to, tp, kind) => ({ from: { moduleId: from, portId: fp }, to: { moduleId: to, portId: tp }, kind })
const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const nn = (m) => `${names[m % 12]}${Math.floor(m / 12) - 1}`
const scaleOf = (notes) => {
  const p = [...new Set(notes.map((n) => n.note))].sort((a, b) => a - b)
  if (p.length > 32) throw new Error(`${p.length} pitches > 32`)
  return `${nn(p[0])}/ ${p.slice(1).map(nn).join(' ')}`
}
const seq = (rack) => ({
  id: 'midi-1', type: 'midi-file-sequencer', name: `MIDI ${rack.name}`, position: { x: 40, y: 300 },
  params: { enabled: true, tempo: BPM, gateLength: 100, loop: false, voices: VOICES, midiData: JSON.stringify(midiData[rack.id]), selectedFile: `${ID}-${rack.id}.mid`, mute1: false, mute2: false, mute3: false, mute4: false, mute5: false, mute6: false, mute7: false, mute8: false },
})
const trackOf = (rack, name) => {
  const i = midiData[rack.id].tracks.findIndex((t) => t.name === name)
  if (i < 0) throw new Error(`${rack.id}: no track ${name}`)
  return i + 1
}
const laneTrack = (rack, lane) => trackOf(rack, LANE_NAMES[`${rack.id}.${lane}`])
const timecode = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
const PROJECT_TEXT = [
  `${TITLE.toUpperCase()} — Zelda: A Link to the Past en suite`,
  '',
  'Musique de Koji Kondo (The Legend of Zelda: A Link to the Past, Nintendo, 1991). Les notes viennent des',
  'transcriptions MIDI de fans (VGMusic) qui s\'accordent le mieux avec des transcriptions independantes',
  '(scripts/sources/zelda3/SOURCES.md). L\'arrangement choisit seulement qui joue quoi : handpans, harpe et',
  'cloches, puce sonore de la Super Nintendo, flutes, grand orgue et orgue sombre, timbales et caisse claire 909.',
  '',
  ...sections.map((s) => `${timecode(s.at)}  ${s.name}`),
  '',
  '6 racks (HANDPANS, HARPE & CLOCHES, SNES, NAPPE, ORGUE, PERCUSSIONS), un fader chacun dans la console MIXER.',
  'Chaque rack a son sequenceur MIDI (8 voix, sans boucle) ; la derniere piste de chaque fichier ("Volume")',
  'regle le niveau du rack section par section (fondus, enchainements).',
]
const note = (text) => ({ id: 'notes-1', type: 'notes', name: 'A propos', position: { x: 40, y: 40 }, params: { text } })
const rackNote = (rack, lines) => note([`${TITLE.toUpperCase()} — rack ${rack.name.toUpperCase()}`, '', ...lines, '', 'Le rack HANDPANS (1er onglet) decrit tout le morceau.'].join('\n'))
const LANE_GAINS = levels.lanes ?? {}
const laneGain = (key, fallback) => LANE_GAINS[key] ?? fallback

function busModules(rack, reverb, fx = []) {
  const tv = trackOf(rack, 'Volume')
  const modules = [
    { id: 'vol-slew', type: 'slew', name: 'Volume (lissage)', position: { x: 760, y: 620 }, params: { rise: SLEW_RISE, fall: SLEW_FALL } },
    { id: 'vol-vca', type: 'gain', name: 'Volume (automation)', position: { x: 1000, y: 620 }, params: { gain: +(VOLUME_GAIN * (levels.bus?.[rack.id] ?? 1)).toFixed(3) } },
    ...fx.map((f) => f.module),
    { id: 'rev-1', type: 'reverb', name: 'Salle', position: { x: 1240, y: 300 }, params: reverb },
    { id: 'out-1', type: 'output', name: 'Out', position: { x: 1680, y: 300 }, params: { level: 1 } },
  ]
  const chain = ['vol-vca', ...fx.map((f) => f.module.id), 'rev-1', 'out-1']
  return {
    modules,
    connections: [
      c('midi-1', `vel-${tv}`, 'vol-slew', 'in', 'cv'),
      c('vol-slew', 'out', 'vol-vca', 'cv', 'cv'),
      c('mix-1', 'out', 'vol-vca', 'in', 'audio'),
      ...chain.slice(0, -1).map((id, i) => c(id, 'out', chain[i + 1], 'in', 'audio')),
    ],
  }
}
function voiceChain(rack, lane, idx, source, adsr, vca) {
  const t = laneTrack(rack, lane)
  const y = 40 + 300 * (idx - 1)
  const label = LANE_NAMES[`${rack.id}.${lane}`]
  const src = { ...source, id: `src-${lane}`, position: { x: 520, y } }
  const env = { id: `adsr-${lane}`, type: 'adsr', name: `Env ${label}`, position: { x: 760, y }, params: adsr }
  const amp = { id: `vca-${lane}`, type: 'gain', name: `VCA ${label}`, position: { x: 880, y }, params: { gain: laneGain(`${rack.id}.${lane}`, vca) } }
  const conns = [c('midi-1', `gate-${t}`, env.id, 'gate', 'gate'), c(env.id, 'env', amp.id, 'cv', 'cv'), c(src.id, 'out', amp.id, 'in', 'audio'), c(amp.id, 'out', 'mix-1', `in-${idx}`, 'audio'), c('midi-1', `cv-${t}`, src.id, 'pitch', 'cv')]
  if (['pipe-organ', 'karplus', 'fm-op'].includes(source.type)) conns.push(c('midi-1', `gate-${t}`, src.id, 'gate', 'gate'))
  return { lane, modules: [src, env, amp], conns }
}
/** keep the chains of the lanes that are played, renumbering their mixer inputs */
const played = (rack, chains) => chains.filter((ch) => rack.lanes.includes(ch.lane)).map((ch, i) => ({
  ...ch, conns: ch.conns.map((k) => (k.to.moduleId === 'mix-1' ? { ...k, to: { ...k.to, portId: `in-${i + 1}` } } : k)),
}))
const mixer8 = (name, n) => ({ id: 'mix-1', type: 'mixer-8', name, position: { x: 1000, y: 300 }, params: Object.fromEntries(Array.from({ length: n }, (_, i) => [`level${i + 1}`, 1])) })
const racks = []
const pushRack = (rack, lines, chains, mixerName, reverb, fx = [], extraModules = [], extraConns = []) => {
  const bus = busModules(rack, reverb, fx)
  racks.push({
    id: `rack-${racks.length + 1}`, name: rack.name,
    graph: {
      modules: [racks.length === 0 ? note(PROJECT_TEXT.join('\n')) : rackNote(rack, lines), seq(rack), ...chains.flatMap((x) => x.modules), ...extraModules, mixer8(mixerName, rack.lanes.length), ...bus.modules],
      connections: [...chains.flatMap((x) => x.conns), ...extraConns, ...bus.connections],
    },
  })
}

// HANDPANS
{
  const rack = RACKS[0]
  const hp = [
    ['basse', { pan: -0.3, instrument: 121, seed: 131, attack: 0.45, sustain: 0.85, cavity: 0.5 }],
    ['medium', { pan: 0.15, instrument: 122, seed: 132, attack: 0.55, sustain: 1 }],
    ['aigu', { pan: 0.5, instrument: 123, seed: 133, attack: 0.55, sustain: 0.95 }],
  ].filter(([lane]) => rack.lanes.includes(lane)).map(([lane, extra], i) => {
    const t = laneTrack(rack, lane)
    const id = `hp-${lane}`
    return {
      lane,
      modules: [{ id, type: 'handpan', name: LANE_NAMES[`handpans.${lane}`], position: { x: 520, y: 40 + 580 * i }, params: { scale: 6, scaleNotes: scaleOf(midiData[rack.id].tracks[t - 1].notes), pitchRef: 1, humanize: 0.25, bloom: 0.5, resonance: 0.45, cavity: 0.4, tune: 0, octave: 0, level: laneGain(`handpans.${lane}`, 0.8), ...extra } }],
      conns: [c('midi-1', `cv-${t}`, id, 'pitch', 'cv'), c('midi-1', `gate-${t}`, id, 'gate', 'gate'), c('midi-1', `vel-${t}`, id, 'vel', 'cv'), c(id, 'out', 'mix-1', `in-${i + 1}`, 'audio')],
    }
  })
  pushRack(rack, [], hp, 'Handpans', { time: 0.7, damp: 0.4, preDelay: 18, mix: 0.3 })
}

// HARPE & CLOCHES
{
  const rack = RACKS[1]
  const bellMod = { id: 'bell-mod', type: 'fm-op', name: 'Cloche (modulateur)', position: { x: 520, y: 920 }, params: { frequency: 440, ratio: 3.5, level: 0.45, feedback: 0, attack: 1, decay: 500, sustain: 0, release: 500 } }
  const tc = laneTrack(rack, 'cloche')
  pushRack(rack, ['Harpe (Karplus) : le tremolo du prologue, les harmonies de Light World, les sept harpes de la fontaine,', 'le generique ; harpe basse pincee pour le tuba. Cloches (FM, rapport 3.5) : la fee, les piccolos, le final.'], played(rack, [
    voiceChain(rack, 'harpe', 1, { type: 'karplus', name: 'Harpe', params: { frequency: 440, damping: 0.3, decay: 0.997, brightness: 0.55, pluckPos: 0.28 } }, { attack: 0.001, decay: 0.1, sustain: 1, release: 1.2 }, 0.5),
    voiceChain(rack, 'pizz', 2, { type: 'karplus', name: 'Harpe basse', params: { frequency: 440, damping: 0.25, decay: 0.997, brightness: 0.45, pluckPos: 0.35 } }, { attack: 0.001, decay: 0.1, sustain: 1, release: 0.8 }, 0.7),
    voiceChain(rack, 'cloche', 3, { type: 'fm-op', name: 'Cloche', params: { frequency: 440, ratio: 1, level: 1, feedback: 0.03, attack: 2, decay: 1500, sustain: 0, release: 1200 } }, { attack: 0.001, decay: 0.1, sustain: 1, release: 1.4 }, 0.45),
  ]), 'Harpe & cloches', { time: 0.8, damp: 0.35, preDelay: 24, mix: 0.36 }, [], [bellMod], [
    c('midi-1', `cv-${tc}`, 'bell-mod', 'pitch', 'cv'), c('midi-1', `gate-${tc}`, 'bell-mod', 'gate', 'gate'), c('bell-mod', 'out', 'src-cloche', 'fm', 'audio'),
  ])
}

// SNES
{
  const rack = RACKS[2]
  pushRack(rack, ['La puce sonore de la Super Nintendo (S-DSP) : onde cloche pour Lost Woods et le generique, onde', 'dent de scie douce en cuivres pour le theme du heros, onde cordes sombre et lo-fi pour Dark World et Ganon.'], played(rack, [
    voiceChain(rack, 'lead', 1, { type: 'snes-osc', name: 'SNES', params: { frequency: 440, fine: 0, volume: 1, wave: 3, gauss: 0.7, color: 0.6, lofi: 0.4 } }, { attack: 0.004, decay: 0.25, sustain: 0.55, release: 0.35 }, 0.45),
    voiceChain(rack, 'cuivre', 2, { type: 'snes-osc', name: 'SNES cuivres', params: { frequency: 440, fine: 0, volume: 1, wave: 1, gauss: 0.8, color: 0.45, lofi: 0.35 } }, { attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.25 }, 0.35),
    voiceChain(rack, 'sombre', 3, { type: 'snes-osc', name: 'SNES sombre', params: { frequency: 440, fine: 0, volume: 1, wave: 2, gauss: 0.85, color: 0.3, lofi: 0.6 } }, { attack: 0.02, decay: 0.3, sustain: 0.75, release: 0.4 }, 0.45),
  ]), 'SNES', { time: 0.75, damp: 0.4, preDelay: 20, mix: 0.3 }, [{ module: { id: 'delay-1', type: 'tape-delay', name: 'Echo', position: { x: 1120, y: 300 }, params: { time: 330, feedback: 0.25, mix: 0.16, tone: 0.55, wow: 0.15, flutter: 0.1, drive: 0 } } }])
}

// NAPPE
{
  const rack = RACKS[3]
  const flutes = { type: 'pipe-organ', name: 'Flutes', params: { frequency: 440, drawbar16: 0, drawbar8: 0.85, drawbar4: 0.5, drawbar223: 0, drawbar2: 0.2, drawbar135: 0, drawbar113: 0, drawbar1: 0, voicing: 1, chiff: 0.1, percussion: 0, chorusVibrato: 0, tremulant: 0.18, tremRate: 5.2, wind: 0.1, brightness: 0.45 } }
  pushRack(rack, ['Nappe douce de flutes d\'orgue (8\' et 4\', tremblant) : lignes interieures du prologue, cordes de Light World', 'et de Lost Woods, cordes aigues du generique.'], played(rack, [
    voiceChain(rack, 'flutes', 1, flutes, { attack: 0.12, decay: 0.2, sustain: 1, release: 0.8 }, 0.3),
  ]), 'Nappe', { time: 0.9, damp: 0.35, preDelay: 30, mix: 0.4 })
}

// ORGUE
{
  const rack = RACKS[4]
  const organ = (drawbars, extra) => ({ type: 'pipe-organ', name: 'Orgue', params: { frequency: 440, ...drawbars, percussion: 0, chorusVibrato: 0, tremRate: 5.5, ...extra } })
  pushRack(rack, ['Grand orgue brillant pour la fanfare de Light World ; orgue sombre (16\' et 8\' ronds) pour l\'ostinato de', 'Dark World et les cuivres de Ganon ; pedale 16\' pour les basses du prologue, de Dark World et de Ganon.'], played(rack, [
    voiceChain(rack, 'grand', 1, organ({ drawbar16: 0.5, drawbar8: 1, drawbar4: 0.85, drawbar223: 0.45, drawbar2: 0.7, drawbar135: 0.25, drawbar113: 0.35, drawbar1: 0.45 }, { voicing: 0, chiff: 0.25, wind: 0.08, brightness: 0.75, tremulant: 0 }), { attack: 0.01, decay: 0.1, sustain: 1, release: 0.35 }, 0.4),
    voiceChain(rack, 'sombre', 2, organ({ drawbar16: 0.7, drawbar8: 1, drawbar4: 0.3, drawbar223: 0, drawbar2: 0.1, drawbar135: 0, drawbar113: 0, drawbar1: 0 }, { voicing: 0, chiff: 0.15, wind: 0.12, brightness: 0.45, tremulant: 0 }), { attack: 0.02, decay: 0.1, sustain: 1, release: 0.4 }, 0.4),
    voiceChain(rack, 'pedale', 3, organ({ drawbar16: 1, drawbar8: 0.6, drawbar4: 0, drawbar223: 0, drawbar2: 0, drawbar135: 0, drawbar113: 0, drawbar1: 0 }, { voicing: 0, chiff: 0.1, wind: 0.08, brightness: 0.4, tremulant: 0 }), { attack: 0.03, decay: 0.1, sustain: 1, release: 0.7 }, 0.6),
  ]), 'Orgue', { time: 0.9, damp: 0.45, preDelay: 35, mix: 0.36 })
}

// PERCUSSIONS
{
  const rack = RACKS[5]
  const drum = (lane, type, params, i) => {
    const t = laneTrack(rack, lane)
    const id = `drum-${lane}`
    return {
      lane,
      modules: [{ id, type, name: LANE_NAMES[`percu.${lane}`], position: { x: 520, y: 40 + 200 * i }, params }],
      conns: [c('midi-1', `gate-${t}`, id, 'trigger', 'gate'), c('midi-1', `vel-${t}`, id, 'accent', 'cv'), c(id, 'out', 'mix-1', `in-${i + 1}`, 'audio')],
    }
  }
  const chains = [['timbales', '909-tom', { tune: 75, decay: 0.7 }], ['caisse', '909-snare', { tune: 185, tone: 0.45, snappy: 0.55, decay: 0.3 }]]
    .filter(([lane]) => rack.lanes.includes(lane)).map(([lane, type, params], i) => drum(lane, type, params, i))
  pushRack(rack, ['Timbale 909 grave pour Light World ; caisse claire 909 (calee sur une vraie TR-909) pour les marches de', 'Dark World, de Ganon et du generique.'], chains, 'Percussions', { time: 0.6, damp: 0.5, preDelay: 15, mix: 0.2 })
}

// ---------------------------------------------------------------- project + manifests + bench
const MIXER_VOLUME = levels.mixer ?? {}
const project = {
  version: 2, type: 'project', masterTempo: BPM, masterVolume: 0.85, activeRackId: 'rack-1', racks,
  mixer: Object.fromEntries(racks.map((r, i) => [r.id, { volume: MIXER_VOLUME[RACKS[i].id] ?? 1, mute: false, solo: false }])),
}
writeFileSync(`${OUT_PROJECTS}/${ID}.json`, JSON.stringify(project, null, 2) + '\n')
if (PUBLIC) {
  const entry = { id: ID, name: `${TITLE} 🗡️`, description: "Zelda: A Link to the Past (Koji Kondo) en suite : le prologue, le theme du heros de Light World, la fontaine des fees, Lost Woods, la chute dans le Dark World, Ganon, et le generique. Handpans, harpe, puce SNES, orgues, caisse claire 909. 6 racks, automation de volume.", file: `${ID}.json`, group: 'Songs' }
  const projManifest = JSON.parse(readFileSync('public/projects/manifest.json', 'utf8'))
  if (projManifest.projects.some((e) => e.id === ID)) projManifest.projects = projManifest.projects.map((e) => (e.id === ID ? entry : e))
  else projManifest.projects.push(entry)
  writeFileSync('public/projects/manifest.json', JSON.stringify(projManifest, null, 2) + '\n')
  const midiManifest = JSON.parse(readFileSync('public/midi-presets/manifest.json', 'utf8'))
  const midiEntries = RACKS.map((r) => ({ id: `${ID}-${r.id}`, name: `${TITLE} - ${r.name}`, file: `${ID}-${r.id}.mid` }))
  midiManifest.presets = [...midiManifest.presets.filter((e) => !e.id.startsWith(`${ID}-`)), ...midiEntries]
  writeFileSync('public/midi-presets/manifest.json', JSON.stringify(midiManifest, null, 2) + '\n')
}

const flatModules = []
const flatConnections = []
racks.forEach((rk, i) => {
  const vol = project.mixer[rk.id].volume
  const graph = { modules: rk.graph.modules.map((m) => ({ ...m, params: m.type === 'output' ? { ...m.params, level: vol } : m.params })), connections: rk.graph.connections, taps: [] }
  writeFileSync(`target/${ID}-${RACKS[i].id}-flat.json`, JSON.stringify(graph))
  for (const m of graph.modules) flatModules.push({ ...m, id: `${rk.id}/${m.id}` })
  for (const k of rk.graph.connections) flatConnections.push({ from: { moduleId: `${rk.id}/${k.from.moduleId}`, portId: k.from.portId }, to: { moduleId: `${rk.id}/${k.to.moduleId}`, portId: k.to.portId }, kind: k.kind })
})
writeFileSync(`target/${ID}-flat.json`, JSON.stringify({ modules: flatModules, connections: flatConnections, taps: [] }))
writeFileSync(`target/${ID}-sections.json`, JSON.stringify(sections, null, 2))

console.log(`${PUBLIC ? 'public/' : BUILD + '/'}`)
console.log(sections.map((s) => `${timecode(s.at)} ${s.at.toFixed(1).padStart(6)}s -> ${s.end.toFixed(1).padStart(6)}s  ${s.name}`).join('\n'))
for (const r of RACKS) console.log(`${r.name}: ${midiData[r.id].tracks.map((t) => `${t.name} ${t.notes.length}`).join(', ')}`)
console.log(`handpans: ${racks[0].graph.modules.filter((m) => m.type === 'handpan').map((m) => `${m.name}: ${m.params.scaleNotes.split(' ').length} zones`).join(' | ')}`)
