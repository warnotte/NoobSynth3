// "Le Songe d'Hyrule" — a continuous classical × Nintendo medley arranged from the MIDI files bundled in
// public/midi-presets, as a multi-rack project. Everything is brought to D (minor, then major) and the
// timbres are crossed: Bach and Grieg on Nintendo sound chips, Zelda on cathedral organ and handpans.
//
//   node scripts/songe-hyrule.mjs              generate MIDI files, project, manifests, bench graphs
//   node scripts/songe-hyrule-calibrate.mjs    render each rack, set the per-section levels, regenerate
//
// Writes one MIDI file per rack (public/midi-presets/songe-hyrule-<rack>.mid, listed in the MIDI player),
// the project (public/projects/songe-hyrule.json + manifest entry) and target/songe-hyrule*-flat.json for
// the offline bench (graphwav / render_graph). Each rack's sequencer embeds exactly what the MIDI player
// loads for its file (mirror of src/utils/midiParser.ts parseMidiBuffer).
//
// Mix and transitions: every rack's last MIDI track is a VOLUME lane. Its notes' velocities are level
// points (velocity -> held CV -> slew -> VCA before the rack's reverb), so the arrangement fades racks in
// and out, crossfades sections and balances each section. Levels live in scripts/songe-hyrule-levels.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import toneMidi from '@tonejs/midi'
const { Midi } = toneMidi

const BPM = 120 // files are written at one tempo; every source keeps its real timing (tempo maps included)
const PPQ = 480
const TICKS_PER_SEC = (BPM / 60) * PPQ
// The volume VCA is a poly module (cloned per voice) feeding the mono reverb: the engine averages voices
// into a mono input (x 1/8 at 8 voices) and only voice 1 carries the automation, hence x8 to break even.
// Velocity 64 (0.5) x VOLUME_GAIN = unity; the calibration adds a per-rack bus factor.
const VOICES = 8
const VOLUME_GAIN = 2 * VOICES
const SLEW_RISE = 0.25 // s, time constant of a level going up
const SLEW_FALL = 0.7 // s, going down (tails fade instead of stopping)

// ---------------------------------------------------------------- sources
function source(file) {
  const buf = readFileSync(`public/midi-presets/${file}`)
  const midi = new Midi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const tracks = midi.tracks.map((t) => ({
    name: (t.name || '').trim(),
    channel: t.channel,
    notes: t.notes.map((n) => ({ t: n.time, d: n.duration, m: n.midi, v: Math.max(1, Math.round(n.velocity * 127)) })),
  }))
  const barTime = (bar) => midi.header.ticksToSeconds(midi.header.ppq * 4 * (bar - 1)) // 4/4 files
  return { midi, tracks, barTime }
}
const trackIndex = (src, pattern) => src.tracks.map((t, i) => (pattern.test(t.name) && t.notes.length ? i : -1)).filter((i) => i >= 0)

// ---------------------------------------------------------------- arrangement lanes
const RACKS = [
  { id: 'orgue', name: 'Orgue', lanes: ['grand', 'fonds', 'pedale'] },
  { id: 'handpans', name: 'Handpans', lanes: ['basse', 'medium', 'aigu', 'fee-arpeges', 'fee-melodie'] },
  { id: 'puces', name: 'Puces', lanes: ['snes', 'pulse', 'triangle'] },
  { id: 'harpe', name: 'Harpe & cloches', lanes: ['harpe', 'cloche'] },
  { id: 'rythme', name: 'Rythme', lanes: ['kick', 'snare', 'hat', 'crash', 'tom'] },
]
const lanes = Object.fromEntries(RACKS.flatMap((r) => r.lanes.map((l) => [`${r.id}.${l}`, []])))

/** `handpans` is routed note by note to the handpan of its register (no octave folding: chords keep
 *  their voicing, each handpan keeps < 32 fields). */
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

/** Copy notes of `tracks` from [from, to) seconds of a source to `lane`, placed at `at`. `stretch`
 *  (seconds of the source) slows everything after it down by `rit` (ritardando). */
function excerpt(src, { tracks, from, to, at, transpose = 0, lane, vel = 1, filter = () => true, tail = 0, stretch = Infinity, rit = 1 }) {
  const map = (t) => (t <= stretch ? t - from : stretch - from + (t - stretch) * rit)
  for (const ti of tracks) {
    for (const n of src.tracks[ti].notes) {
      if (n.t < from - 1e-6 || n.t >= to - 1e-6 || !filter(n)) continue
      const end = Math.min(n.t + n.d, to + tail)
      const t0 = map(n.t)
      put(lane, { t: at + t0, d: map(end) - t0, m: n.m + transpose, v: n.v * vel })
    }
  }
}
const chord = (lane, t, d, notes, v = 100) => notes.forEach((m) => put(lane, { t, d, m, v }))

// Sections: name, span, which racks play (volume lane) and how transitions behave.
const sections = []
function section(key, name, at, end, { racks, fadeOut = 1.2, swell } = {}) {
  sections.push({ key, name, at: +at.toFixed(3), end: +end.toFixed(3), racks, fadeOut, swell })
  return end
}
let at = 0

// 1. Toccata BWV 565 (D minor) — the famous opening on the full organ, pedal notes on the 16' pedal.
{
  const s = source('bach-toccata.mid')
  const to = 24
  excerpt(s, { tracks: [0, 1], from: 0, to, at, lane: 'orgue.grand', filter: (n) => n.m >= 48, tail: 0.8 })
  excerpt(s, { tracks: [0, 1], from: 0, to, at, lane: 'orgue.pedale', filter: (n) => n.m < 48, tail: 0.8 })
  // bridge: timpani roll growing into Dark World
  for (let i = 0; i < 14; i++) put('rythme.tom', { t: at + to - 1.5 + i * 0.11, d: 0.05, m: 60, v: 35 + i * 6 })
  at = section('toccata', 'Toccata BWV 565 (Bach) — grand orgue', at, at + to, { racks: ['orgue', 'rythme'], fadeOut: 0.8 }) + 0.4
}

// 2. Dark World (C minor -> D minor): the SNES chip sings the trumpet, the organ holds strings and
//    brass (sustained parts follow the harmony exactly), the flute line rings on handpans, NES triangle
//    bass, original drums.
{
  const s = source('zelda-dark-world.mid')
  const T = 2
  const to = 63.75
  const x = (tracks, lane, o = {}) => excerpt(s, { tracks, from: 0, to, at, transpose: T, lane, ...o })
  // raw track indices of this file (every part is preceded by an empty named track)
  x([11], 'puces.snes')
  x([21], 'handpans', { vel: 0.9 })
  x([1, 3, 5, 13, 15], 'orgue.fonds')
  x([9], 'puces.triangle')
  x([17], 'rythme.crash', { transpose: 0 })
  for (const n of s.tracks[19].notes.filter((n) => n.t < to)) {
    const lane = n.m === 36 ? 'rythme.kick' : n.m === 38 || n.m === 40 ? 'rythme.snare' : n.m === 41 ? 'rythme.tom' : n.m === 57 ? 'rythme.crash' : 'rythme.hat'
    put(lane, { t: at + n.t, d: 0.1, m: 60, v: n.v })
  }
  const end = at + to
  // bridge: low D pedal and a timpani roll into the Mountain King
  chord('orgue.pedale', end, 2.2, [38, 50], 100)
  for (let i = 0; i < 18; i++) put('rythme.tom', { t: end + i * 0.11, d: 0.05, m: 60, v: 30 + i * 5 })
  at = section('darkworld', 'Dark World (Zelda) — puce SNES, orgue, handpans, batterie', at, end, { racks: ['puces', 'orgue', 'handpans', 'rythme'], fadeOut: 0.6 }) + 2.1
}

// 3. In the Hall of the Mountain King (B minor -> D minor): the final accelerando, woodwinds and
//    violins on the NES pulse, low strings and bassoons on the NES triangle, brass on the full organ,
//    timpani and cymbals. A crescendo on the volume lanes.
{
  const s = source('4_mtking.mid')
  const T = 3
  const from = s.barTime(57)
  const to = s.midi.duration
  const x = (pattern, lane, o = {}) => excerpt(s, { tracks: trackIndex(s, pattern), from, to, at, transpose: T, lane, ...o })
  x(/Piccolo|Flute|Oboe|Clarinet|Violin|Viola/, 'puces.pulse', { vel: 0.8 })
  x(/Bassoon|Cello|Contrabass/, 'puces.triangle')
  x(/Horn|Trumpet|Trombone|Tuba/, 'orgue.grand')
  x(/Timpani/, 'rythme.tom', { transpose: 0 })
  x(/Bass Drum/, 'rythme.kick', { transpose: 0 })
  x(/Cymbal/, 'rythme.crash', { transpose: 0 })
  at = section('mountain', "Dans l'antre du roi de la montagne (Grieg) — accelerando final", at, at + (to - from), { racks: ['puces', 'orgue', 'rythme'], fadeOut: 0.3, swell: { from: 0.45, to: 1 } }) + 2.6
}

// 4. The Zelda "secret" jingle, alone, as the door to the fairy fountain.
{
  const notes = [79, 78, 75, 69, 68, 76, 80, 84]
  notes.forEach((m, i) => {
    const last = i === notes.length - 1
    put('puces.snes', { t: at + i * 0.12, d: last ? 0.9 : 0.1, m, v: 100 })
    put('harpe.cloche', { t: at + i * 0.12, d: last ? 1.5 : 0.12, m: m + 12, v: 90 })
  })
  at = section('jingle', 'Jingle "secret" (Zelda)', at, at + 1.9, { racks: ['puces', 'harpe'], fadeOut: 0.2 })
}

// 5. Fairy Fountain, exactly like the handpan preset the user loved (handpan-zelda-fairy): original key
//    (the "secret" jingle before it is the door, transposing it into D lost its high register), arpeggios
//    and melody each on their own handpan with the preset's settings.
{
  const s = source('zelda-fairy.mid')
  const to = s.midi.duration
  excerpt(s, { tracks: [0], from: 0, to, at, lane: 'handpans.fee-arpeges' })
  excerpt(s, { tracks: [1], from: 0, to, at, lane: 'handpans.fee-melodie' })
  at = section('fairy', 'Fontaine des fées (Zelda) — handpans, comme le preset', at, at + to, { racks: ['handpans'], fadeOut: 2.2 }) + 0.8
}

// 6. Prelude BWV 846 (C major -> D major), bars 1-11: arpeggios on the NES pulse, each bar's harmony
//    held by the soft organ flutes, the bass on handpans. It ends on A major, the dominant of what follows.
{
  const s = source('bach-wtc-bwv846.mid')
  const T = 2
  const bars = 11
  const to = s.barTime(bars + 1)
  excerpt(s, { tracks: [1], from: 0, to, at, transpose: T, lane: 'puces.pulse', vel: 0.9 })
  for (let bar = 1; bar <= bars; bar++) {
    const b0 = s.barTime(bar)
    const b1 = s.barTime(bar + 1)
    const inBar = s.tracks[1].notes.filter((n) => n.t >= b0 - 1e-6 && n.t < b1 - 1e-6)
    const pitches = [...new Set(inBar.map((n) => n.m + T))].sort((a, b) => a - b)
    if (!pitches.length) continue
    put('handpans', { t: at + b0, d: 2.5, m: pitches[0], v: 80 })
    chord('orgue.fonds', at + b0, b1 - b0, pitches.slice(0, 4), 80)
  }
  const end = at + to
  // bridge: the A major dominant held on the organ, resolving into the Gymnopédie
  chord('orgue.fonds', end, 2.4, [45, 52, 57, 61, 64], 80)
  at = section('prelude', 'Prélude BWV 846 (Bach) — puce NES et flûtes d\'orgue', at, end, { racks: ['puces', 'orgue', 'handpans'], fadeOut: 0.4 }) + 2.0
}

// 7. Gymnopédie n°1 (D major), bars 1-16: melody and chords on handpans, soft organ flutes underneath.
{
  const s = source('satie-gymnopedie-1.mid')
  const to = 48
  excerpt(s, { tracks: [0], from: 0, to, at, lane: 'handpans', vel: 1.1 })
  excerpt(s, { tracks: [1], from: 0, to, at, lane: 'handpans', vel: 1.0 })
  excerpt(s, { tracks: [1], from: 0, to, at, lane: 'orgue.fonds', filter: (n) => n.m >= 50, tail: 0.5 })
  at = section('gymnopedie', 'Gymnopédie n°1 (Satie) — handpans et flûtes d\'orgue', at, at + to, { racks: ['handpans', 'orgue'], fadeOut: 2.0 }) + 1.0
}

// 8. Kakariko Village (Bb major -> D major), bars 1-20: the handpan village, shakuhachi on the SNES chip,
//    glockenspiel on bells. The last two bars swell into the finale (organ dominant + snare roll).
{
  const s = source('zelda-kakariko.mid')
  const T = 4
  const to = s.barTime(21)
  const x = (tracks, lane, o = {}) => excerpt(s, { tracks, from: 0, to, at, transpose: T, lane, ...o })
  x([0, 1, 2], 'handpans', { vel: 0.8 })
  x([3], 'handpans', { vel: 1 })
  x([4], 'puces.snes', { vel: 0.8 })
  x([6], 'harpe.cloche', { vel: 0.8 })
  const bar = s.barTime(2)
  const rollStart = at + to - 2 * bar
  for (let i = 0; i < 16; i++) put('rythme.snare', { t: rollStart + i * (bar / 8), d: 0.05, m: 60, v: 40 + i * 5 })
  chord('orgue.grand', rollStart, 2 * bar, [57, 61, 64, 69], 100)
  chord('orgue.pedale', rollStart, 2 * bar, [33, 45], 100)
  at = section('kakariko', 'Village Cocorico / Kakariko (Zelda) — handpans, shakuhachi SNES, cloches', at, at + to, { racks: ['handpans', 'puces', 'harpe', 'rythme', 'orgue'], fadeOut: 0.2, swell: { racks: ['orgue', 'rythme'], from: 0, to: 0.8, last: 2 * bar } })
}

// 9. Trumpet Voluntary (D major), bars 1-16 + cadence with a ritardando: the SNES trumpet, the full
//    organ, handpans on the pedal line, a light march.
{
  const s = source('trumpet.mid')
  const bar = s.barTime(2)
  const to = s.barTime(17) + 0.5
  const stretch = s.barTime(16)
  const rit = 1.45
  const x = (tracks, lane, o = {}) => excerpt(s, { tracks, from: 0, to, at, lane, stretch, rit, ...o })
  x([0], 'puces.snes')
  x([1, 2], 'orgue.grand')
  x([3], 'orgue.pedale')
  x([3], 'handpans', { vel: 1.05 })
  put('rythme.crash', { t: at, d: 0.1, m: 60, v: 120 })
  for (let b = 0; b < 15; b++) {
    const t0 = at + b * bar
    put('rythme.kick', { t: t0, d: 0.1, m: 60, v: 100 })
    put('rythme.kick', { t: t0 + bar / 2, d: 0.1, m: 60, v: 80 })
    put('rythme.snare', { t: t0 + bar / 4, d: 0.05, m: 60, v: 55 })
    put('rythme.snare', { t: t0 + (3 * bar) / 4, d: 0.05, m: 60, v: 70 })
    for (let e = 0; e < 8; e++) put('rythme.hat', { t: t0 + (e * bar) / 8, d: 0.05, m: 60, v: e % 2 ? 45 : 70 })
  }
  const length = stretch + (to - stretch) * rit
  at = section('finale', 'Trumpet Voluntary (Clarke / Purcell) — finale', at, at + length, { racks: ['orgue', 'puces', 'handpans', 'rythme'], fadeOut: 0 })
}

// 10. Final D major chord on everything.
{
  const t = at
  chord('orgue.grand', t, 6, [62, 66, 69, 74, 78, 81], 110)
  chord('orgue.pedale', t, 6, [38, 50], 110)
  chord('handpans', t, 4, [38, 45, 50, 62, 66, 69, 74, 78, 81], 115)
  put('harpe.cloche', { t, d: 4, m: 86, v: 100 })
  for (const m of [50, 57, 62, 66, 69]) put('harpe.harpe', { t: t + 0.03 * (m - 50), d: 3, m, v: 110 })
  put('rythme.crash', { t, d: 0.1, m: 60, v: 127 })
  put('rythme.kick', { t, d: 0.1, m: 60, v: 127 })
  at = section('final', 'Accord final (ré majeur)', t, t + 7, { racks: ['orgue', 'handpans', 'harpe', 'rythme'], fadeOut: 0 })
}

// ---------------------------------------------------------------- volume lanes (mix + transitions)
const LEVELS_PATH = new URL('./songe-hyrule-levels.json', import.meta.url)
const levels = existsSync(LEVELS_PATH) ? JSON.parse(readFileSync(LEVELS_PATH, 'utf8')) : {}
const DEFAULT_LEVEL = 0.5 // x VOLUME_GAIN = unity
const levelOf = (rack, key) => levels?.[rack]?.[key] ?? DEFAULT_LEVEL
const volume = Object.fromEntries(RACKS.map((r) => [r.id, []]))
const point = (rack, t, level) => volume[rack].push({ t: Math.max(0, t), v: Math.max(1, Math.min(127, Math.round(level * 127))) })
sections.forEach((s, i) => {
  const next = sections[i + 1]
  for (const r of RACKS) {
    const on = s.racks.includes(r.id)
    const lvl = on ? levelOf(r.id, s.key) : 0
    const sw = s.swell && (!s.swell.racks || s.swell.racks.includes(r.id)) ? s.swell : null
    if (sw && on) {
      // crescendo: from `from` x level to `to` x level over the section (or its `last` seconds)
      const t0 = sw.last ? s.end - sw.last : s.at
      if (sw.last) point(r.id, s.at - 0.3, sw.from * lvl)
      for (let k = 0; k <= 10; k++) point(r.id, t0 + ((s.end - t0) * k) / 10 - 0.3, lvl * (sw.from + ((sw.to - sw.from) * k) / 10))
    } else {
      point(r.id, s.at - 0.3, lvl)
    }
    if (on && s.fadeOut > 0 && !(next && next.racks.includes(r.id))) point(r.id, s.end - s.fadeOut, 0)
  }
})

// ---------------------------------------------------------------- MIDI files (one per rack)
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
  'orgue.grand': 'Grand orgue', 'orgue.fonds': 'Fonds doux', 'orgue.pedale': 'Pedale',
  'handpans.basse': 'Handpan basse', 'handpans.medium': 'Handpan medium', 'handpans.aigu': 'Handpan aigu',
  'handpans.fee-arpeges': 'Fontaine arpeges', 'handpans.fee-melodie': 'Fontaine melodie',
  'puces.snes': 'SNES', 'puces.pulse': 'NES pulse', 'puces.triangle': 'NES triangle',
  'harpe.harpe': 'Harpe', 'harpe.cloche': 'Cloches',
  'rythme.kick': 'Grosse caisse', 'rythme.snare': 'Caisse claire', 'rythme.hat': 'Charleston', 'rythme.crash': 'Cymbale', 'rythme.tom': 'Timbales',
}
const midiData = {}
for (const rack of RACKS) {
  const out = new Midi()
  out.header.setTempo(BPM)
  out.header.name = `Le Songe d'Hyrule - ${rack.name}`
  const addTrack = (name, channel, notes) => {
    const tr = out.addTrack()
    tr.name = name
    tr.channel = channel
    // Same pitch twice at once can't live in one MIDI track (the second note-on steals the first one's
    // note-off and a note is lost on reading): drop exact doubles, end each note before the next one.
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
    for (const n of clean.sort((a, b) => a.tick - b.tick)) {
      tr.addNote({ midi: n.m, ticks: n.tick, durationTicks: n.end - n.tick, velocity: n.v / 127 })
    }
  }
  rack.lanes.forEach((l, i) => addTrack(LANE_NAMES[`${rack.id}.${l}`], rack.id === 'rythme' ? 9 : i, lanes[`${rack.id}.${l}`]))
  // volume lane: short notes, never overlapping (always voice 1), velocity = level
  addTrack('Volume', 15, volume[rack.id].sort((a, b) => a.t - b.t).map((p) => ({ t: p.t, d: 0.02, m: 60, v: p.v })))
  const path = `public/midi-presets/songe-hyrule-${rack.id}.mid`
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
  params: { enabled: true, tempo: BPM, gateLength: 100, loop: false, voices: VOICES, midiData: JSON.stringify(midiData[rack.id]), selectedFile: `songe-hyrule-${rack.id}.mid`, mute1: false, mute2: false, mute3: false, mute4: false, mute5: false, mute6: false, mute7: false, mute8: false },
})
const trackOf = (rack, name) => {
  const i = midiData[rack.id].tracks.findIndex((t) => t.name === name)
  if (i < 0) throw new Error(`${rack.id}: no track ${name}`)
  return i + 1
}
const laneTrack = (rack, lane) => trackOf(rack, LANE_NAMES[`${rack.id}.${lane}`])

const timecode = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
const PROJECT_TEXT = [
  "LE SONGE D'HYRULE — classique x Nintendo",
  '',
  'Un seul morceau de ~6 minutes, tout ramene en RE (mineur, puis majeur), en croisant les timbres :',
  "Bach et Grieg sur les puces sonores de la NES et de la Super Nintendo, Zelda a l'orgue de",
  'cathedrale et aux handpans.',
  '',
  ...sections.map((s) => `${timecode(s.at)}  ${s.name}`),
  '',
  '5 racks = 5 familles (ORGUE, HANDPANS, PUCES, HARPE & CLOCHES, RYTHME), un fader chacune dans la',
  'console MIXER. Chaque rack a son sequenceur MIDI (8 voix, sans boucle) : ils partent ensemble avec',
  'le transport. La derniere piste de chaque fichier ("Volume") est une automation : la velocite de',
  'ses notes regle le niveau du rack (fondus, enchainements, crescendos).',
  '',
  'Arrangement genere par scripts/songe-hyrule.mjs a partir des MIDI du lecteur (Toccata, Dark World,',
  'Mountain King, Fairy Fountain, Prelude BWV 846, Gymnopedie, Kakariko, Trumpet Voluntary).',
]
const note = (text) => ({ id: 'notes-1', type: 'notes', name: 'A propos', position: { x: 40, y: 40 }, params: { text } })
const rackNote = (rack, lines) => note([`LE SONGE D'HYRULE — rack ${rack.name.toUpperCase()}`, '', ...lines, '', 'Le rack ORGUE (1er onglet) decrit tout le morceau.'].join('\n'))
const LANE_GAINS = JSON.parse(JSON.stringify(levels.lanes ?? {}))
const laneGain = (key, fallback) => LANE_GAINS[key] ?? fallback

/** mixer -> automated VCA -> [fx] -> reverb -> output, driven by the rack's Volume track */
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
  const connections = [
    c('midi-1', `vel-${tv}`, 'vol-slew', 'in', 'cv'),
    c('vol-slew', 'out', 'vol-vca', 'cv', 'cv'),
    c('mix-1', 'out', 'vol-vca', 'in', 'audio'),
    ...chain.slice(0, -1).map((id, i) => c(id, 'out', chain[i + 1], 'in', 'audio')),
  ]
  return { modules, connections }
}

function voiceChain(rack, lane, idx, source, adsr, vca) {
  // pitch (+ gate) -> source -> ADSR-gated VCA -> mixer input idx
  const t = laneTrack(rack, lane)
  const y = 40 + 300 * (idx - 1)
  const label = LANE_NAMES[`${rack.id}.${lane}`]
  const src = { ...source, id: `src-${lane}`, position: { x: 520, y } }
  const env = { id: `adsr-${lane}`, type: 'adsr', name: `Env ${label}`, position: { x: 760, y }, params: adsr }
  const amp = { id: `vca-${lane}`, type: 'gain', name: `VCA ${label}`, position: { x: 880, y }, params: { gain: laneGain(`${rack.id}.${lane}`, vca) } }
  const modules = [src, env, amp]
  const conns = [c('midi-1', `gate-${t}`, env.id, 'gate', 'gate'), c(env.id, 'env', amp.id, 'cv', 'cv'), c(src.id, 'out', amp.id, 'in', 'audio'), c(amp.id, 'out', 'mix-1', `in-${idx}`, 'audio')]
  conns.push(c('midi-1', `cv-${t}`, src.id, 'pitch', 'cv'))
  if (['pipe-organ', 'karplus', 'fm-op'].includes(source.type)) conns.push(c('midi-1', `gate-${t}`, src.id, 'gate', 'gate'))
  return { modules, conns }
}
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

// ORGUE
{
  const rack = RACKS[0]
  const organ = (drawbars, extra) => ({ type: 'pipe-organ', name: 'Orgue', params: { frequency: 440, ...drawbars, percussion: 0, chorusVibrato: 0, tremRate: 5.5, ...extra } })
  pushRack(rack, [], [
    voiceChain(rack, 'grand', 1, organ({ drawbar16: 0.6, drawbar8: 1, drawbar4: 0.9, drawbar223: 0.55, drawbar2: 0.8, drawbar135: 0.3, drawbar113: 0.45, drawbar1: 0.55 }, { voicing: 0, chiff: 0.25, wind: 0.08, brightness: 0.8, tremulant: 0 }), { attack: 0.01, decay: 0.1, sustain: 1, release: 0.35 }, 0.5),
    voiceChain(rack, 'fonds', 2, organ({ drawbar16: 0.25, drawbar8: 0.9, drawbar4: 0.45, drawbar223: 0, drawbar2: 0.15, drawbar135: 0, drawbar113: 0, drawbar1: 0 }, { voicing: 1, chiff: 0.12, wind: 0.12, brightness: 0.5, tremulant: 0.12 }), { attack: 0.06, decay: 0.2, sustain: 1, release: 0.5 }, 0.3),
    voiceChain(rack, 'pedale', 3, organ({ drawbar16: 1, drawbar8: 0.75, drawbar4: 0.25, drawbar223: 0, drawbar2: 0, drawbar135: 0, drawbar113: 0, drawbar1: 0 }, { voicing: 0, chiff: 0.1, wind: 0.05, brightness: 0.55, tremulant: 0 }), { attack: 0.03, decay: 0.1, sustain: 1, release: 0.5 }, 0.55),
  ], 'Registres', { time: 0.85, damp: 0.35, preDelay: 30, mix: 0.34 })
}

// HANDPANS
{
  const rack = RACKS[1]
  const hp = [
    ['basse', { pan: -0.35, instrument: 41, seed: 51, attack: 0.45, sustain: 1.05, cavity: 0.5 }],
    ['medium', { pan: 0.25, instrument: 42, seed: 52, attack: 0.5, sustain: 0.95 }],
    ['aigu', { pan: 0.55, instrument: 43, seed: 53, attack: 0.5, sustain: 0.9 }],
    // the two handpans of the Fairy Fountain preset, same settings
    ['fee-arpeges', { pan: -0.5, instrument: 11, seed: 34, attack: 0.5, sustain: 1.2, humanize: 0.3, resonance: 0.5 }],
    ['fee-melodie', { pan: 0.5, instrument: 3, seed: 21, attack: 0.45, sustain: 1, humanize: 0.3, resonance: 0.5, level: 0.7 }],
  ].map(([lane, extra], i) => {
    const t = laneTrack(rack, lane)
    const id = `hp-${lane}`
    return {
      modules: [{ id, type: 'handpan', name: LANE_NAMES[`handpans.${lane}`], position: { x: 520, y: 40 + 580 * i }, params: { scale: 6, scaleNotes: scaleOf(midiData[rack.id].tracks[t - 1].notes), pitchRef: 1, humanize: 0.2, bloom: 0.5, resonance: 0.45, cavity: 0.4, tune: 0, octave: 0, level: laneGain(`handpans.${lane}`, 0.8), ...extra } }],
      conns: [c('midi-1', `cv-${t}`, id, 'pitch', 'cv'), c('midi-1', `gate-${t}`, id, 'gate', 'gate'), c('midi-1', `vel-${t}`, id, 'vel', 'cv'), c(id, 'out', 'mix-1', `in-${i + 1}`, 'audio')],
    }
  })
  pushRack(rack, ['Trois handpans par registre (basse < C4, medium < C6, aigu) : chaque note va au handpan de son', 'registre, sans repliement d\'octave. Chaque handpan a pour gamme libre les notes qu\'il joue.', 'Deux handpans dedies a la Fontaine des fees, regles comme le preset "Handpans - Zelda Fairy Fountain"', '(arpeges a gauche, melodie a droite, tonalite d\'origine).'], hp, 'Handpans', { time: 0.65, damp: 0.45, preDelay: 16, mix: 0.26 })
}

// PUCES
{
  const rack = RACKS[2]
  pushRack(rack, ['Les puces sonores de Nintendo : SNES (trompette de Dark World, shakuhachi de Kakariko, trompette', 'du final, jingle "secret"), NES pulse (bois et violons du roi de la montagne, Prelude BWV 846),', 'NES triangle (basses). Chaque voix a son ADSR + VCA.'], [
    voiceChain(rack, 'snes', 1, { type: 'snes-osc', name: 'SNES', params: { frequency: 440, fine: 0, volume: 1, wave: 0, gauss: 0.7, color: 0.55, lofi: 0.45 } }, { attack: 0.008, decay: 0.12, sustain: 0.8, release: 0.12 }, 0.5),
    voiceChain(rack, 'pulse', 2, { type: 'nes-osc', name: 'NES pulse', params: { frequency: 440, fine: 0, volume: 1, mode: 0, duty: 1, noiseMode: 0, bitcrush: 1 } }, { attack: 0.002, decay: 0.09, sustain: 0.55, release: 0.07 }, 0.28),
    voiceChain(rack, 'triangle', 3, { type: 'nes-osc', name: 'NES triangle', params: { frequency: 440, fine: 0, volume: 1, mode: 2, duty: 0, noiseMode: 0, bitcrush: 1 } }, { attack: 0.002, decay: 0.05, sustain: 1, release: 0.06 }, 0.5),
  ], 'Puces', { time: 0.55, damp: 0.5, preDelay: 12, mix: 0.2 }, [{ module: { id: 'delay-1', type: 'tape-delay', name: 'Echo', position: { x: 1120, y: 300 }, params: { time: 375, feedback: 0.22, mix: 0.16, tone: 0.5, wow: 0.1, flutter: 0.1, drive: 0.1 } } }])
}

// HARPE & CLOCHES
{
  const rack = RACKS[3]
  const bellMod = { id: 'bell-mod', type: 'fm-op', name: 'Cloche (modulateur)', position: { x: 520, y: 620 }, params: { frequency: 440, ratio: 3.5, level: 0.55, feedback: 0, attack: 1, decay: 600, sustain: 0, release: 600 } }
  const tc = laneTrack(rack, 'cloche')
  pushRack(rack, ['Harpe (Karplus) : arpeges de la Fontaine des fees. Cloches (deux operateurs FM, rapport 3.5) :', 'glockenspiel de Kakariko, jingle "secret", accord final.'], [
    voiceChain(rack, 'harpe', 1, { type: 'karplus', name: 'Harpe', params: { frequency: 440, damping: 0.35, decay: 0.997, brightness: 0.55, pluckPos: 0.28 } }, { attack: 0.001, decay: 0.1, sustain: 1, release: 2.5 }, 0.7),
    voiceChain(rack, 'cloche', 2, { type: 'fm-op', name: 'Cloche', params: { frequency: 440, ratio: 1, level: 1, feedback: 0.05, attack: 2, decay: 1800, sustain: 0, release: 1400 } }, { attack: 0.001, decay: 0.1, sustain: 1, release: 1.5 }, 0.5),
  ], 'Harpe & cloches', { time: 0.75, damp: 0.4, preDelay: 22, mix: 0.32 }, [], [bellMod], [
    c('midi-1', `cv-${tc}`, 'bell-mod', 'pitch', 'cv'), c('midi-1', `gate-${tc}`, 'bell-mod', 'gate', 'gate'), c('bell-mod', 'out', 'src-cloche', 'fm', 'audio'),
  ])
}

// RYTHME
{
  const rack = RACKS[4]
  const kit = [
    ['kick', '909-kick', { tune: 50, attack: 0.5, decay: 0.55, drive: 0.25 }],
    ['snare', '909-snare', { tune: 190, tone: 0.45, snappy: 0.6, decay: 0.28 }],
    ['hat', '909-hihat', { tune: 1, decay: 0.15, tone: 0.55, open: 0 }],
    ['crash', '909-crash', { tune: 1, decay: 1.8, tone: 0.55 }],
    ['tom', '909-tom', { tune: 95, decay: 0.5 }],
  ]
  const chains = kit.map(([lane, type, params], i) => {
    const t = laneTrack(rack, lane)
    const id = `drum-${lane}`
    return {
      modules: [{ id, type, name: LANE_NAMES[`rythme.${lane}`], position: { x: 520, y: 40 + 200 * i }, params }],
      conns: [c('midi-1', `gate-${t}`, id, 'trigger', 'gate'), c('midi-1', `vel-${t}`, id, 'accent', 'cv'), c(id, 'out', 'mix-1', `in-${i + 1}`, 'audio')],
    }
  })
  pushRack(rack, ['Batterie 909 : la batterie originale de Dark World, timbales et cymbales du roi de la montagne,', 'roulements des enchainements et marche legere du final. Velocites MIDI -> accent.'], chains, 'Batterie', { time: 0.45, damp: 0.55, preDelay: 10, mix: 0.14 }, [{ module: { id: 'comp-1', type: 'compressor', name: 'Bus batterie', position: { x: 1120, y: 300 }, params: { threshold: -16, ratio: 3, attack: 8, release: 120, makeup: 2, mix: 1 } } }])
}

// ---------------------------------------------------------------- project + manifests + bench
const MIXER_VOLUME = levels.mixer ?? {}
const project = {
  version: 2, type: 'project', masterTempo: BPM, masterVolume: 0.85, activeRackId: 'rack-1', racks,
  mixer: Object.fromEntries(racks.map((r, i) => [r.id, { volume: MIXER_VOLUME[RACKS[i].id] ?? 1, mute: false, solo: false }])),
}
writeFileSync('public/projects/songe-hyrule.json', JSON.stringify(project, null, 2) + '\n')

const entry = { id: 'songe-hyrule', name: "Le Songe d'Hyrule 🏰", description: "Classique x Nintendo en un seul morceau de 6 minutes, tout en ré : Toccata de Bach a l'orgue, Dark World sur puce SNES, le roi de la montagne, Fontaine des fees a la harpe, Prelude BWV 846 en NES, Gymnopedie et Kakariko aux handpans, Trumpet Voluntary en finale. 5 racks, automation de volume pour les enchainements.", file: 'songe-hyrule.json', group: 'Songs' }
const projManifest = JSON.parse(readFileSync('public/projects/manifest.json', 'utf8'))
projManifest.projects = [...projManifest.projects.filter((e) => e.id !== entry.id), entry]
writeFileSync('public/projects/manifest.json', JSON.stringify(projManifest, null, 2) + '\n')

const midiManifest = JSON.parse(readFileSync('public/midi-presets/manifest.json', 'utf8'))
midiManifest.presets = [
  ...midiManifest.presets.filter((e) => !e.id.startsWith('songe-hyrule-')),
  ...RACKS.map((r) => ({ id: `songe-hyrule-${r.id}`, name: `Le Songe d'Hyrule - ${r.name}`, file: `songe-hyrule-${r.id}.mid` })),
]
writeFileSync('public/midi-presets/manifest.json', JSON.stringify(midiManifest, null, 2) + '\n')

const flatModules = []
const flatConnections = []
racks.forEach((rk, i) => {
  const vol = project.mixer[rk.id].volume
  const graph = { modules: rk.graph.modules.map((m) => ({ ...m, params: m.type === 'output' ? { ...m.params, level: vol } : m.params })), connections: rk.graph.connections, taps: [] }
  writeFileSync(`target/songe-hyrule-${RACKS[i].id}-flat.json`, JSON.stringify(graph))
  for (const m of graph.modules) flatModules.push({ ...m, id: `${rk.id}/${m.id}` })
  for (const k of rk.graph.connections) flatConnections.push({ from: { moduleId: `${rk.id}/${k.from.moduleId}`, portId: k.from.portId }, to: { moduleId: `${rk.id}/${k.to.moduleId}`, portId: k.to.portId }, kind: k.kind })
})
writeFileSync('target/songe-hyrule-flat.json', JSON.stringify({ modules: flatModules, connections: flatConnections, taps: [] }))
writeFileSync('target/songe-hyrule-sections.json', JSON.stringify(sections, null, 2))

console.log(sections.map((s) => `${timecode(s.at)} ${s.at.toFixed(1).padStart(6)}s → ${s.end.toFixed(1).padStart(6)}s  ${s.name}`).join('\n'))
for (const r of RACKS) console.log(`${r.name}: ${midiData[r.id].tracks.map((t) => `${t.name} ${t.notes.length}`).join(', ')}`)
console.log(`handpan scales: ${racks[1].graph.modules.filter((m) => m.type === 'handpan').map((m) => `${m.name}: ${m.params.scaleNotes.split(' ').length} notes`).join(' | ')}`)
