// "Le Rêve de Dinosaur Land" — a magical Super Mario World suite (Koji Kondo) as a multi-rack project:
// handpans, harp and bells, the SNES sound chip, a soft organ flute bed. Every note comes from the best
// VGMusic transcriptions (chosen on note-level agreement between independent transcriptions, see
// scripts/handpan-midi-presets.mjs for Overworld); the arrangement only chooses who plays what, where,
// and how loud.
//
//   node scripts/reve-dinosaur.mjs              generate MIDI files, project, manifests, bench graphs
//   node scripts/reve-dinosaur-calibrate.mjs    render each rack, set the per-section levels, regenerate
//
// Same machinery as scripts/songe-hyrule.mjs: one MIDI file per rack (public/midi-presets/reve-dinosaur-*.mid),
// each rack's sequencer embeds exactly what the MIDI player loads, the last track of each file is a VOLUME lane
// (velocity -> held CV -> slew -> VCA before the reverb). Levels: scripts/reve-dinosaur-levels.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import toneMidi from '@tonejs/midi'
const { Midi } = toneMidi

const ID = 'reve-dinosaur'
const TITLE = 'Le Rêve de Dinosaur Land'
const BPM = 120
const PPQ = 480
const TICKS_PER_SEC = (BPM / 60) * PPQ
const VOICES = 8
const VOLUME_GAIN = 2 * VOICES // see songe-hyrule.mjs: poly VCA averaged into the mono reverb
const SLEW_RISE = 0.3
const SLEW_FALL = 0.9

// ---------------------------------------------------------------- sources
// Overworld and Athletic are bundled (public/midi-presets). The other transcriptions stay out of the repo:
// download them once into sample_import/smw/vgmusic/ (git-ignored) from https://www.vgmusic.com/music/console/nintendo/snes/
const VGMUSIC = 'https://www.vgmusic.com/music/console/nintendo/snes/'
function source(path) {
  if (!existsSync(path)) {
    const file = path.split('/').pop()
    throw new Error(`missing source ${path}: download it with
  curl -sL -o ${path} ${VGMUSIC}${file}`)
  }
  const buf = readFileSync(path)
  const midi = new Midi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const tracks = midi.tracks.map((t) => ({
    channel: t.channel,
    notes: t.notes.map((n) => ({ t: n.time, d: n.duration, m: n.midi, v: Math.max(1, Math.round(n.velocity * 127)) })),
  }))
  return { midi, tracks }
}
/** indices of the tracks holding notes on MIDI channel `ch` (1-based, as in sequencer software) */
const onChannel = (src, ch) => src.tracks.map((t, i) => (t.channel === ch - 1 && t.notes.length ? i : -1)).filter((i) => i >= 0)

// ---------------------------------------------------------------- arrangement lanes
const RACKS = [
  { id: 'handpans', name: 'Handpans', lanes: ['basse', 'medium', 'aigu'] },
  { id: 'harpe', name: 'Harpe & cloches', lanes: ['harpe', 'pizz', 'cloche'] },
  { id: 'snes', name: 'SNES', lanes: ['lead', 'sombre'] },
  { id: 'nappe', name: 'Nappe', lanes: ['flutes'] },
  { id: 'orgue', name: 'Orgue', lanes: ['ostinato', 'pedale'] },
  { id: 'percu', name: 'Timbales', lanes: ['timbales'] },
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

// 1. Star Road (SMW, A minor feel on D / C) — the sparkling riff on the SNES chip doubled by bells, the two
//    sustained harmony voices as an organ flute bed, the bass on the low handpan. GM drum tracks left out.
{
  const s = source('sample_import/smw/vgmusic/SMW-Star_Road.mid') // Frederico Saar, 96-100 % agreement
  const to = 23.05
  excerpt(s, { tracks: onChannel(s, 1), from: 0, to, at, lane: 'snes.lead', vel: 0.9 })
  excerpt(s, { tracks: onChannel(s, 1), from: 0, to, at, lane: 'harpe.cloche', transpose: 12, vel: 0.55 })
  excerpt(s, { tracks: [...onChannel(s, 3), ...onChannel(s, 5)], from: 0, to, at, lane: 'nappe.flutes', vel: 0.8 })
  excerpt(s, { tracks: onChannel(s, 2), from: 0, to, at, lane: 'handpans', vel: 0.9 })
  at = section('starroad', 'Star Road — puce SNES, cloches, flûtes', at, at + to, { racks: ['snes', 'harpe', 'nappe', 'handpans'], fadeOut: 1.2 }) + 0.6
}

// 2. Overworld (SMW, F major, SevenChaos transcription) — melody on the handpans, the off-beat chords on the
//    harp, the walking bass as low harp pizzicato, the root bass on the low handpan, the intro fanfare on the
//    bells, flute and cello lines as the organ bed.
{
  const s = source('public/midi-presets/smw-overworld.mid')
  const to = 50
  excerpt(s, { tracks: onChannel(s, 2), from: 0, to, at, lane: 'harpe.cloche', vel: 0.8 }) // celesta fanfare
  excerpt(s, { tracks: onChannel(s, 5), from: 0, to, at, lane: 'handpans', vel: 1 }) // steel drums melody
  excerpt(s, { tracks: onChannel(s, 3), from: 0, to, at, lane: 'handpans', vel: 0.8 }) // tuba roots
  excerpt(s, { tracks: onChannel(s, 6), from: 0, to, at, lane: 'harpe.pizz', vel: 0.85 }) // contrabass walk
  excerpt(s, { tracks: onChannel(s, 4), from: 0, to, at, lane: 'harpe.harpe', vel: 0.6 }) // guitar off-beats
  excerpt(s, { tracks: [...onChannel(s, 8), ...onChannel(s, 9)], from: 0, to, at, lane: 'nappe.flutes', vel: 0.7 })
  at = section('overworld', 'Overworld — handpans, harpe, cloches', at, at + to, { racks: ['handpans', 'harpe', 'nappe'], fadeOut: 3 }) + 0.8
}

// 3. Donut Plains map (Daniel Lippert; 100 % agreement with The Ultimate Koopa) — the marimba lead on the harp,
//    its ocarina double on the SNES chip, the two harmony lines on the handpans, the bass pinched, piccolo bells.
{
  const s = source('sample_import/smw/vgmusic/SMWWorldMap.mid')
  const to = 43.3
  excerpt(s, { tracks: onChannel(s, 4), from: 0, to, at, lane: 'harpe.harpe', vel: 0.8 })
  excerpt(s, { tracks: onChannel(s, 5), from: 0, to, at, lane: 'snes.lead', vel: 0.5 })
  excerpt(s, { tracks: [...onChannel(s, 7), ...onChannel(s, 9)], from: 0, to, at, lane: 'handpans', vel: 0.7 })
  excerpt(s, { tracks: onChannel(s, 2), from: 0, to, at, lane: 'harpe.pizz', vel: 0.85 })
  excerpt(s, { tracks: onChannel(s, 6), from: 0, to, at, lane: 'harpe.cloche', vel: 0.6 })
  at = section('donut', 'Carte de Donut Plains — harpe, puce SNES, handpans', at, at + to, { racks: ['harpe', 'snes', 'handpans'], fadeOut: 1.5 }) + 0.8
}

// 4. Athletic (AI Musicware Branch, 96-97 % agreement) — melody on the handpans, off-beats and chords on the
//    harp, the very low bass pinched.
{
  const s = source('public/midi-presets/smw-athletic.mid')
  const to = 48
  excerpt(s, { tracks: onChannel(s, 1), from: 0, to, at, lane: 'handpans', vel: 1 })
  excerpt(s, { tracks: onChannel(s, 2), from: 0, to, at, lane: 'harpe.pizz', vel: 0.8 })
  excerpt(s, { tracks: onChannel(s, 3), from: 0, to, at, lane: 'harpe.harpe', vel: 0.55 })
  excerpt(s, { tracks: [...onChannel(s, 4), ...onChannel(s, 5)], from: 0, to, at, lane: 'harpe.harpe', vel: 0.45 })
  at = section('athletic', 'Athletic — handpans et harpe', at, at + to, { racks: ['handpans', 'harpe'], fadeOut: 1.5 }) + 1
}

// 5. Forest of Illusion (Daniel Lippert, 97 % agreement with SwordBolt; C minor) — the lead on the handpans with a
//    faint SNES double, the chords as the flute bed, the bass on the low handpan: the light starts to fade.
{
  const s = source('sample_import/smw/vgmusic/SMWForestOfIllusion.mid')
  const to = 65.9
  excerpt(s, { tracks: onChannel(s, 2), from: 0, to, at, lane: 'handpans', vel: 0.95 })
  excerpt(s, { tracks: onChannel(s, 3), from: 0, to, at, lane: 'snes.lead', vel: 0.35 })
  excerpt(s, { tracks: [...onChannel(s, 4), ...onChannel(s, 5)], from: 0, to, at, lane: 'nappe.flutes', vel: 0.75 })
  excerpt(s, { tracks: onChannel(s, 6), from: 0, to, at, lane: 'handpans', vel: 0.9 })
  at = section('forest', 'Forest of Illusion — handpans, flûtes, puce SNES', at, at + to, { racks: ['handpans', 'snes', 'nappe'], fadeOut: 2.5 }) + 1
}

// 6. Castle (Erik, 85-96 % agreement between four transcriptions) — the chromatic background ostinato on a dark
//    organ, the "dun dun" and the second bass on the 16' pedal, the leads on the SNES chip (strings wave, dark and
//    lo-fi), the bass line on the low handpan, the drums as low timpani. Ends inside the accelerando.
{
  const s = source('sample_import/smw/vgmusic/smwcstle.mid')
  const to = 68
  excerpt(s, { tracks: onChannel(s, 1), from: 0, to, at, lane: 'orgue.ostinato', vel: 0.8 })
  excerpt(s, { tracks: onChannel(s, 2), from: 0, to, at, lane: 'orgue.pedale', vel: 1 })
  excerpt(s, { tracks: onChannel(s, 6), from: 0, to, at, lane: 'orgue.pedale', vel: 0.6 })
  excerpt(s, { tracks: [...onChannel(s, 3), ...onChannel(s, 4)], from: 0, to, at, lane: 'snes.sombre', vel: 0.9 })
  excerpt(s, { tracks: onChannel(s, 5), from: 0, to, at, lane: 'handpans', vel: 0.8 })
  excerpt(s, { tracks: onChannel(s, 10), from: 0, to, at, lane: 'percu.timbales', vel: 1 })
  at = section('castle', 'Le château — orgue sombre, puce SNES, timbales', at, at + to, { racks: ['orgue', 'snes', 'handpans', 'percu'], fadeOut: 3 }) + 1.5
}

// 7. Ending (Tim Connolly; 81-88 % of its first 86 s found in an independent transcription) — the square lead on
//    the handpans with a bell-chip double, the accordion and strings as the flute bed, the guitar arpeggios on the
//    harp, the tuba pinched; octave bells join the lead for the last phrases.
{
  const s = source('sample_import/smw/vgmusic/Smwend.mid')
  const to = (192 * 60) / 133
  excerpt(s, { tracks: onChannel(s, 5), from: 0, to, at, lane: 'handpans', vel: 1 })
  excerpt(s, { tracks: onChannel(s, 5), from: 0, to, at, lane: 'snes.lead', vel: 0.4 })
  excerpt(s, { tracks: onChannel(s, 5), from: 60, to, at: at + 60, lane: 'harpe.cloche', transpose: 12, vel: 0.35 })
  excerpt(s, { tracks: [...onChannel(s, 1), ...onChannel(s, 4)], from: 0, to, at, lane: 'nappe.flutes', vel: 0.55 })
  excerpt(s, { tracks: onChannel(s, 3), from: 0, to, at, lane: 'harpe.harpe', vel: 0.6 })
  excerpt(s, { tracks: onChannel(s, 2), from: 0, to, at, lane: 'harpe.pizz', vel: 0.8 })
  at = section('ending', "Générique de fin — tout l'orchestre", at, at + to, { racks: ['handpans', 'snes', 'nappe', 'harpe'], fadeOut: 4 })
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
  'snes.lead': 'SNES', 'snes.sombre': 'SNES sombre', 'nappe.flutes': 'Flutes',
  'orgue.ostinato': 'Orgue sombre', 'orgue.pedale': 'Pedale', 'percu.timbales': 'Timbales',
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
  rack.lanes.forEach((l, i) => addTrack(LANE_NAMES[`${rack.id}.${l}`], i, lanes[`${rack.id}.${l}`]))
  addTrack('Volume', 15, volume[rack.id].sort((a, b) => a.t - b.t).map((p) => ({ t: p.t, d: 0.02, m: 60, v: p.v })))
  const path = `public/midi-presets/${ID}-${rack.id}.mid`
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
  `${TITLE.toUpperCase()} — Super Mario World en suite magique`,
  '',
  'Musique de Koji Kondo (Super Mario World, Nintendo, 1990). Les notes viennent des meilleures',
  'transcriptions MIDI de fans (VGMusic), choisies parce que des transcriptions independantes y',
  'retrouvent les memes notes. L\'arrangement choisit seulement qui joue quoi : handpans, harpe et',
  'cloches, puce sonore de la Super Nintendo, nappe de flutes d\'orgue ; pour le chateau, un orgue',
  'sombre et des timbales.',
  '',
  ...sections.map((s) => `${timecode(s.at)}  ${s.name}`),
  '',
  '6 racks (HANDPANS, HARPE & CLOCHES, SNES, NAPPE, ORGUE, TIMBALES), un fader chacun dans la console MIXER. Chaque rack',
  'a son sequenceur MIDI (8 voix, sans boucle) ; la derniere piste de chaque fichier ("Volume") regle',
  'le niveau du rack section par section (fondus, enchainements).',
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
  return { modules: [src, env, amp], conns }
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

// HANDPANS
{
  const rack = RACKS[0]
  const hp = [
    ['basse', { pan: -0.3, instrument: 101, seed: 111, attack: 0.45, sustain: 0.85, cavity: 0.5 }],
    ['medium', { pan: 0.15, instrument: 102, seed: 112, attack: 0.55, sustain: 1 }],
    ['aigu', { pan: 0.5, instrument: 103, seed: 113, attack: 0.55, sustain: 0.95 }],
  ].filter(([lane]) => rack.lanes.includes(lane)).map(([lane, extra], i) => {
    const t = laneTrack(rack, lane)
    const id = `hp-${lane}`
    return {
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
  pushRack(rack, ['Harpe (Karplus) : les accords en contretemps et la basse qui marche, pinces. Cloches (FM, rapport', '3.5) : la fanfare de l\'Overworld, le motif de Star Road a l\'octave.'], [
    voiceChain(rack, 'harpe', 1, { type: 'karplus', name: 'Harpe', params: { frequency: 440, damping: 0.3, decay: 0.997, brightness: 0.55, pluckPos: 0.28 } }, { attack: 0.001, decay: 0.1, sustain: 1, release: 1.2 }, 0.5),
    voiceChain(rack, 'pizz', 2, { type: 'karplus', name: 'Harpe basse', params: { frequency: 440, damping: 0.25, decay: 0.997, brightness: 0.45, pluckPos: 0.35 } }, { attack: 0.001, decay: 0.1, sustain: 1, release: 0.8 }, 0.7),
    voiceChain(rack, 'cloche', 3, { type: 'fm-op', name: 'Cloche', params: { frequency: 440, ratio: 1, level: 1, feedback: 0.03, attack: 2, decay: 1500, sustain: 0, release: 1200 } }, { attack: 0.001, decay: 0.1, sustain: 1, release: 1.4 }, 0.45),
  ], 'Harpe & cloches', { time: 0.8, damp: 0.35, preDelay: 24, mix: 0.36 }, [], [bellMod], [
    c('midi-1', `cv-${tc}`, 'bell-mod', 'pitch', 'cv'), c('midi-1', `gate-${tc}`, 'bell-mod', 'gate', 'gate'), c('bell-mod', 'out', 'src-cloche', 'fm', 'audio'),
  ])
}

// SNES
{
  const rack = RACKS[2]
  pushRack(rack, ['La puce sonore de la Super Nintendo (S-DSP), pour garder la couleur du jeu : onde cloche pour Star Road', 'et les doublures, onde cordes sombre et grain 32 kHz marque pour les melodies du chateau.'], [
    voiceChain(rack, 'lead', 1, { type: 'snes-osc', name: 'SNES', params: { frequency: 440, fine: 0, volume: 1, wave: 3, gauss: 0.7, color: 0.6, lofi: 0.4 } }, { attack: 0.004, decay: 0.25, sustain: 0.55, release: 0.35 }, 0.45),
    voiceChain(rack, 'sombre', 2, { type: 'snes-osc', name: 'SNES sombre', params: { frequency: 440, fine: 0, volume: 1, wave: 2, gauss: 0.85, color: 0.3, lofi: 0.6 } }, { attack: 0.02, decay: 0.3, sustain: 0.75, release: 0.4 }, 0.45),
  ], 'SNES', { time: 0.75, damp: 0.4, preDelay: 20, mix: 0.3 }, [{ module: { id: 'delay-1', type: 'tape-delay', name: 'Echo', position: { x: 1120, y: 300 }, params: { time: 360, feedback: 0.3, mix: 0.2, tone: 0.55, wow: 0.15, flutter: 0.1, drive: 0 } } }])
}

// NAPPE
{
  const rack = RACKS[3]
  const flutes = { type: 'pipe-organ', name: 'Flutes', params: { frequency: 440, drawbar16: 0, drawbar8: 0.85, drawbar4: 0.5, drawbar223: 0, drawbar2: 0.2, drawbar135: 0, drawbar113: 0, drawbar1: 0, voicing: 1, chiff: 0.1, percussion: 0, chorusVibrato: 0, tremulant: 0.18, tremRate: 5.2, wind: 0.1, brightness: 0.45 } }
  pushRack(rack, ['Nappe douce de flutes d\'orgue (8\' et 4\', tremblant) : les accords tenus de Star Road, les lignes', 'de flute et de violoncelle de l\'Overworld.'], [
    voiceChain(rack, 'flutes', 1, flutes, { attack: 0.12, decay: 0.2, sustain: 1, release: 0.8 }, 0.3),
  ], 'Nappe', { time: 0.9, damp: 0.35, preDelay: 30, mix: 0.4 })
}

// ORGUE (the castle)
{
  const rack = RACKS[4]
  const organ = (drawbars, extra) => ({ type: 'pipe-organ', name: 'Orgue', params: { frequency: 440, ...drawbars, percussion: 0, chorusVibrato: 0, tremRate: 5.5, ...extra } })
  pushRack(rack, ["Orgue sombre du chateau : l'ostinato chromatique (16' et 8' ronds, peu d'harmoniques) et la pedale", '16\' des "dun dun" et des basses.'], [
    voiceChain(rack, 'ostinato', 1, organ({ drawbar16: 0.7, drawbar8: 1, drawbar4: 0.3, drawbar223: 0, drawbar2: 0.1, drawbar135: 0, drawbar113: 0, drawbar1: 0 }, { voicing: 0, chiff: 0.15, wind: 0.12, brightness: 0.45, tremulant: 0 }), { attack: 0.02, decay: 0.1, sustain: 1, release: 0.4 }, 0.4),
    voiceChain(rack, 'pedale', 2, organ({ drawbar16: 1, drawbar8: 0.6, drawbar4: 0, drawbar223: 0, drawbar2: 0, drawbar135: 0, drawbar113: 0, drawbar1: 0 }, { voicing: 0, chiff: 0.1, wind: 0.08, brightness: 0.4, tremulant: 0 }), { attack: 0.03, decay: 0.1, sustain: 1, release: 0.7 }, 0.6),
  ], 'Orgue', { time: 0.9, damp: 0.5, preDelay: 35, mix: 0.38 })
}

// TIMBALES (the castle drums)
{
  const rack = RACKS[5]
  const t = laneTrack(rack, 'timbales')
  pushRack(rack, ['Les percussions du chateau jouees par une timbale 909 accordee grave.'], [{
    modules: [{ id: 'drum-timbales', type: '909-tom', name: 'Timbales', position: { x: 520, y: 40 }, params: { tune: 70, decay: 0.75 } }],
    conns: [c('midi-1', `gate-${t}`, 'drum-timbales', 'trigger', 'gate'), c('midi-1', `vel-${t}`, 'drum-timbales', 'accent', 'cv'), c('drum-timbales', 'out', 'mix-1', 'in-1', 'audio')],
  }], 'Timbales', { time: 0.85, damp: 0.55, preDelay: 25, mix: 0.3 })
}

// ---------------------------------------------------------------- project + manifests + bench
const MIXER_VOLUME = levels.mixer ?? {}
const project = {
  version: 2, type: 'project', masterTempo: BPM, masterVolume: 0.85, activeRackId: 'rack-1', racks,
  mixer: Object.fromEntries(racks.map((r, i) => [r.id, { volume: MIXER_VOLUME[RACKS[i].id] ?? 1, mute: false, solo: false }])),
}
writeFileSync(`public/projects/${ID}.json`, JSON.stringify(project, null, 2) + '\n')
const entry = { id: ID, name: `${TITLE} 🍄`, description: "Super Mario World (Koji Kondo) en suite magique : Star Road sur la puce SNES, Overworld et Athletic aux handpans et a la harpe, carte de Donut Plains, Forest of Illusion, un chateau tenebreux a l'orgue et aux timbales, puis le generique de fin. 6 racks, automation de volume.", file: `${ID}.json`, group: 'Songs' }
const projManifest = JSON.parse(readFileSync('public/projects/manifest.json', 'utf8'))
if (projManifest.projects.some((e) => e.id === ID)) projManifest.projects = projManifest.projects.map((e) => (e.id === ID ? entry : e))
else projManifest.projects.push(entry)
writeFileSync('public/projects/manifest.json', JSON.stringify(projManifest, null, 2) + '\n')
const midiManifest = JSON.parse(readFileSync('public/midi-presets/manifest.json', 'utf8'))
const midiEntries = RACKS.map((r) => ({ id: `${ID}-${r.id}`, name: `${TITLE} - ${r.name}`, file: `${ID}-${r.id}.mid` }))
midiManifest.presets = [...midiManifest.presets.filter((e) => !e.id.startsWith(`${ID}-`)), ...midiEntries]
writeFileSync('public/midi-presets/manifest.json', JSON.stringify(midiManifest, null, 2) + '\n')

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

console.log(sections.map((s) => `${timecode(s.at)} ${s.at.toFixed(1).padStart(6)}s -> ${s.end.toFixed(1).padStart(6)}s  ${s.name}`).join('\n'))
for (const r of RACKS) console.log(`${r.name}: ${midiData[r.id].tracks.map((t) => `${t.name} ${t.notes.length}`).join(', ')}`)
console.log(`handpans: ${racks[0].graph.modules.filter((m) => m.type === 'handpan').map((m) => `${m.name}: ${m.params.scaleNotes}`).join(' | ')}`)
