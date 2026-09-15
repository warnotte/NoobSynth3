// Handpan MIDI presets and projects from the repo's bundled MIDI files (exact notes: each handpan's free scale is the
// set of pitches it plays). Writes public/presets/<id>.json + target/<id>-flat.json for the offline bench.
// node scripts/handpan-midi-presets.mjs  (writes public/presets, public/projects + target/<id>-flat.json for graphwav/render_graph)
import { readFileSync, writeFileSync } from 'node:fs'
import toneMidi from '@tonejs/midi'
const { Midi } = toneMidi

const [, , ...levels] = process.argv
const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const nn = (m) => `${names[m % 12]}${Math.floor(m / 12) - 1}`

/** Mirror of src/utils/midiParser.ts parseMidiBuffer: the preset embeds exactly what the MIDI player
 * loads for the same file, so reloading it from the player never changes the routing. */
function load(file) {
  const buf = readFileSync(`public/midi-presets/${file}`)
  const midi = new Midi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
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

const scaleOf = (notes) => {
  const p = [...new Set(notes.map((n) => n.note))].sort((a, b) => a - b)
  if (p.length > 32) throw new Error(`${p.length} pitches > 32 fields`)
  return `${nn(p[0])}/ ${p.slice(1).map(nn).join(' ')}`
}
const maxOnsets = (notes) => Math.max(...[...notes.reduce((m, n) => m.set(n.tick, (m.get(n.tick) ?? 0) + 1), new Map()).values()])

const c = (from, fp, to, tp, kind) => ({ from: { moduleId: from, portId: fp }, to: { moduleId: to, portId: tp }, kind })
const seq = (data, voices, file, tempo = Math.round(data.tempo)) => ({
  id: 'midi-1', type: 'midi-file-sequencer', name: 'MIDI', position: { x: 40, y: 300 },
  params: { enabled: true, tempo, gateLength: 90, loop: true, voices, midiData: JSON.stringify(data), selectedFile: file, mute1: false, mute2: false, mute3: false, mute4: false, mute5: false, mute6: false, mute7: false, mute8: false },
})
const handpan = (id, name, y, notes, extra) => ({
  id, type: 'handpan', name, position: { x: 520, y },
  params: { scale: 6, scaleNotes: scaleOf(notes), pitchRef: 1, attack: 0.5, humanize: 0.3, sustain: 1, bloom: 0.5, resonance: 0.5, cavity: 0.4, tune: 0, octave: 0, pan: 0, instrument: 0, seed: 5, level: 0.8, ...extra },
})
const notesModule = (text) => ({ id: 'notes-1', type: 'notes', name: 'A propos', position: { x: 40, y: 40 }, params: { text } })

const presets = []
/** Every piece's definition, reused by the multi-rack projects so presets and projects never drift. */
const pieces = {}
const velGains = (parts, y0) => parts.flatMap((part, i) => part.velGain
  ? [{ id: `vel-${i + 1}`, type: 'gain', name: `Vel ${part.name} x${part.velGain}`, position: { x: 280, y: y0 + 260 * i }, params: { gain: part.velGain } }]
  : [])
const velConnections = (parts, tracks, hp) => tracks.flatMap((t, j) => parts[t].velGain
  ? [c('midi-1', `vel-${t + 1}`, `vel-${t + 1}`, 'in', 'cv'), c(`vel-${t + 1}`, 'out', hp[j].id, 'vel', 'cv')]
  : [c('midi-1', `vel-${t + 1}`, hp[j].id, 'vel', 'cv')])
const midiManifest = JSON.parse(readFileSync('public/midi-presets/manifest.json', 'utf8'))

// One handpan per MIDI track in the FILE's own order (track n -> hp-n). Two handpans go through a
// `mixer`, three or four through a `mixer-8`.
function duo({ id, name, description, file, voices, text, parts, reverb, level, tempo, maxFields = 64 }) {
  const data = load(file)
  if (parts.length > 8) throw new Error(`${id}: at most 8 handpans (mixer-8)`)
  // CPU follows the number of note fields, not of handpans: 64 fields = about four 15-note handpans.
  const fields = data.tracks.reduce((n, t) => n + new Set(t.notes.map((x) => x.note)).size, 0)
  if (fields > maxFields) throw new Error(`${id}: ${fields} note fields > ${maxFields}`)
  if (data.tracks.length !== parts.length) throw new Error(`${id}: file has ${data.tracks.length} tracks`)
  const onsets = Math.max(...data.tracks.map((t) => maxOnsets(t.notes)))
  if (onsets > voices) throw new Error(`${id}: ${onsets} simultaneous strikes > ${voices} voices`)
  const hp = parts.map((part, i) => handpan(`hp-${i + 1}`, part.name, 40 + 580 * i, data.tracks[i].notes, part.params))
  pieces[id] = { file, voices, tempo, parts, reverb, onsets }
  presets.push({
    id, name, group: 'Physical Modeling', description,
    graph: {
      modules: [
        notesModule([...text, '',
          `Sequenceur a ${voices} VOIX : au plus ${onsets} frappes au meme instant sur une piste, donc chaque note est jouee.`,
          'Sur un handpan la duree de la note ne compte pas : une voix reprise continue de sonner.', '',
          ...parts.map((part, i) => `Piste ${i + 1} du fichier "${data.tracks[i].name.trim()}" (${data.tracks[i].notes.length} notes) -> ${part.name}`),
          'Chaque handpan a sa gamme libre (les notes de sa partie), son exemplaire (INSTR.) et sa place',
          'dans la stereo (PAN). Recharger le meme fichier dans le lecteur MIDI ne change rien au routage.'].join('\n')),
        // selectedFile follows the MIDI player's own convention: `<midi manifest id>.mid`.
        seq(data, voices, `${midiManifest.presets.find((e) => e.file === file).id}.mid`, tempo),
        ...hp,
        ...velGains(parts, 620),
        hp.length === 2
          ? { id: 'mix-1', type: 'mixer', name: 'Duo', position: { x: 1000, y: 300 }, params: { levelA: 0.8, levelB: 0.8 } }
          : { id: 'mix-1', type: 'mixer-8', name: 'Ensemble', position: { x: 1000, y: 300 }, params: Object.fromEntries(hp.map((_, i) => [`level${i + 1}`, 1])) },
        { id: 'rev-1', type: 'reverb', name: 'Salle', position: { x: 1240, y: 300 }, params: reverb },
        { id: 'out-1', type: 'output', name: 'Out', position: { x: 1680, y: 300 }, params: { level } },
      ],
      connections: [
        ...hp.flatMap((h, i) => [c('midi-1', `cv-${i + 1}`, h.id, 'pitch', 'cv'), c('midi-1', `gate-${i + 1}`, h.id, 'gate', 'gate'), ...velConnections(parts, [i], [h])]),
        ...(hp.length === 2
          ? [c('hp-1', 'out', 'mix-1', 'in-a', 'audio'), c('hp-2', 'out', 'mix-1', 'in-b', 'audio')]
          : hp.map((h, i) => c(h.id, 'out', 'mix-1', `in-${i + 1}`, 'audio'))),
        c('mix-1', 'out', 'rev-1', 'in', 'audio'), c('rev-1', 'out', 'out-1', 'in', 'audio'),
      ],
    },
  })
  console.log(`${id}: tempo ${data.tempo.toFixed(1)}, ${voices} voices, ${onsets} strikes max | ` + hp.map((h) => `${h.name}: ${h.params.scaleNotes}`).join(' | '))
}

// Zelda - Fairy Fountain (SNES): file tracks = Bass (harp arpeggios), Lead (melody). 4 voices.
duo({
  id: 'handpan-zelda-fairy',
  name: 'Handpans - Zelda Fairy Fountain (4 voix)',
  description: 'La Fontaine des Fees (Zelda: A Link to the Past, SNES, Koji Kondo) sur deux handpans : arpeges de harpe a gauche, melodie a droite, sequenceur a 4 voix.',
  file: 'zelda-fairy.mid',
  voices: 4,
  text: ['ZELDA - FAIRY FOUNTAIN (4 voix)', 'A Link to the Past (SNES), musique de Koji Kondo.', '',
    'Les deux harpes du MIDI sur deux handpans : les arpeges a gauche, la melodie tres aigue',
    "(jusqu'a C#7) a droite."],
  parts: [
    { name: 'Arpeges', params: { pan: -0.5, instrument: 11, seed: 34, sustain: 1.2, level: 0.8 } },
    { name: 'Melodie', params: { pan: 0.5, instrument: 3, seed: 21, attack: 0.45, level: 0.7 } },
  ],
  reverb: { time: 0.7, damp: 0.4, preDelay: 18, mix: 0.3 },
  level: Number(levels[0] ?? 2.0),
})

// Satie - Gymnopedie No.1: file tracks = treble (right hand), bass (left hand). 8 voices.
duo({
  id: 'handpan-satie-gymnopedie',
  name: 'Handpans - Satie Gymnopedie n°1 (8 voix)',
  description: "Gymnopedie n°1 d'Erik Satie sur deux handpans : main droite a droite, main gauche a gauche, sequenceur a 8 voix, notes exactes.",
  file: 'satie-gymnopedie-1.mid',
  voices: 8,
  text: ['SATIE - GYMNOPEDIE N°1 (8 voix)', 'Erik Satie, 1888 (domaine public).', '',
    'Main droite et main gauche du piano sur deux handpans : la melodie a droite, la basse et les',
    'accords a gauche. SUSTAIN un peu plus long pour le tempo lent.'],
  parts: [
    { name: 'Main droite', params: { pan: 0.45, instrument: 5, seed: 8, sustain: 1.3, attack: 0.4, level: 0.8 } },
    { name: 'Main gauche', params: { pan: -0.45, instrument: 9, seed: 19, sustain: 1.3, attack: 0.4, level: 0.75 } },
  ],
  reverb: { time: 0.65, damp: 0.5, preDelay: 16, mix: 0.28 },
  level: Number(levels[1] ?? 2.2),
})

// Purcell (Clarke) - Trumpet Voluntary: file tracks = Trumpet, Right hand, Left Hand, Pedal. 4 voices.
duo({
  id: 'handpan-purcell-trumpet',
  name: 'Handpans - Purcell Trumpet Voluntary (4 voix)',
  description: "Trumpet Voluntary (Jeremiah Clarke, longtemps attribue a Purcell) sur quatre handpans : trompette, main droite, main gauche et pedalier de l'orgue, sequenceur a 4 voix.",
  file: 'trumpet.mid',
  voices: 4,
  text: ['PURCELL - TRUMPET VOLUNTARY (4 voix)', "The Prince of Denmark's March, Jeremiah Clarke vers 1700 (domaine public),", 'longtemps attribuee a Henry Purcell.', '',
    "Les quatre pistes du MIDI sur quatre handpans : la trompette au centre-droit, la main droite a",
    "droite, la main gauche a gauche, le pedalier au centre-gauche. Le ralenti final du fichier n'est pas",
    'rejoue : le lecteur MIDI utilise le premier tempo (120).'],
  parts: [
    { name: 'Trompette', params: { pan: 0.2, instrument: 4, seed: 41, attack: 0.55, level: 1 } },
    { name: 'Main droite', params: { pan: 0.6, instrument: 14, seed: 42, level: 0.85 } },
    { name: 'Main gauche', params: { pan: -0.6, instrument: 23, seed: 43, level: 0.85 } },
    { name: 'Pedalier', params: { pan: -0.2, instrument: 31, seed: 44, sustain: 1.2, attack: 0.4, level: 0.9 } },
  ],
  reverb: { time: 0.7, damp: 0.45, preDelay: 16, mix: 0.3 },
  level: 2.5,
})

// Zelda - Kakariko Village (SNES): the file's 8 tracks on 8 small handpans (61 fields in all).
duo({
  id: 'handpan-zelda-kakariko',
  name: 'Handpans - Zelda Kakariko (8 pistes)',
  description: "Kakariko Village (Zelda: A Link to the Past, SNES, Koji Kondo) : les 8 pistes du MIDI sur 8 handpans, un par piste, doublures jouees par deux handpans de part et d'autre de la stereo.",
  file: 'zelda-kakariko.mid',
  voices: 4,
  text: ['ZELDA - KAKARIKO VILLAGE (8 pistes)', 'A Link to the Past (SNES), musique de Koji Kondo, MIDI de Thomas Rungeard.', '',
    "Un orchestre de 8 handpans, un par piste du fichier : trois lignes de cordes, la melodie, deux",
    "shakuhachis et glockenspiel + celesta. Les doublures a l'unisson sont jouees par deux handpans",
    'differents places de chaque cote : comme deux joueurs, jamais parfaitement ensemble (HUMAN).',
    'Les noms des pistes du fichier sont les credits du MIDI.'],
  parts: [
    { name: 'Cordes basses', params: { pan: -0.3, instrument: 61, seed: 71, sustain: 1.2, attack: 0.4, level: 0.75 } },
    { name: 'Cordes 2', params: { pan: 0.25, instrument: 62, seed: 72, attack: 0.4, level: 0.65 } },
    { name: 'Cordes 3', params: { pan: -0.1, instrument: 63, seed: 73, attack: 0.4, level: 0.65 } },
    { name: 'Melodie', params: { pan: 0.1, instrument: 64, seed: 74, attack: 0.55, level: 1 } },
    { name: 'Shakuhachi 1', params: { pan: 0.55, instrument: 65, seed: 75, level: 0.7 } },
    { name: 'Shakuhachi 2', params: { pan: -0.55, instrument: 66, seed: 76, level: 0.7 } },
    { name: 'Glockenspiel', params: { pan: 0.75, instrument: 67, seed: 77, attack: 0.6, level: 0.6 } },
    { name: 'Celesta', params: { pan: -0.75, instrument: 68, seed: 78, attack: 0.6, level: 0.6 } },
  ],
  reverb: { time: 0.6, damp: 0.45, preDelay: 14, mix: 0.26 },
  level: 2.7,
})

// Zelda - Dark World (SNES): 11 tracks in the file, the MIDI player keeps the first 8 (reverse cymbal,
// drum kit and flute are dropped by the player itself). Tempo map 192 (8-beat intro) then 128: the
// sequencer runs at 128 so the piece is right and only the intro is slower.
duo({
  id: 'handpan-zelda-dark-world',
  name: 'Handpans - Zelda Dark World (8 pistes)',
  description: "Dark World (Zelda: A Link to the Past, SNES, Koji Kondo) : les 8 pistes que charge le lecteur MIDI sur 8 handpans, cordes, basses doublees et cuivres.",
  file: 'zelda-dark-world.mid',
  voices: 4,
  tempo: 128,
  maxFields: 96,
  text: ['ZELDA - DARK WORLD (8 pistes)', 'A Link to the Past (SNES), musique de Koji Kondo.', '',
    'Le plus exigeant des presets handpan : 8 handpans, 87 zones de notes, 3000 frappes.',
    'Le fichier a 11 pistes, le lecteur MIDI en garde 8 : la cymbale inversee, la batterie et la',
    "flute ne sont pas jouees (limite du lecteur, pas du preset). Le fichier change de tempo apres",
    "8 temps (192 puis 128) et le lecteur n'en lit qu'un : le sequenceur est regle a 128, seule",
    "l'intro est plus lente.",
    'Basse jouee par deux handpans (cordes + cuivres a l’unisson dans le MIDI).'],
  parts: [
    { name: 'Cordes hautes', params: { pan: 0.35, instrument: 81, seed: 91, attack: 0.45, level: 0.6 } },
    { name: 'Cordes 2', params: { pan: -0.35, instrument: 82, seed: 92, attack: 0.45, level: 0.6 } },
    { name: 'Cordes 3', params: { pan: 0.15, instrument: 83, seed: 93, attack: 0.45, level: 0.6 } },
    { name: 'Basse cordes', params: { pan: -0.2, instrument: 84, seed: 94, attack: 0.5, sustain: 0.9, level: 0.8 } },
    { name: 'Basse cuivres', params: { pan: 0.2, instrument: 85, seed: 95, attack: 0.6, sustain: 0.9, level: 0.8 } },
    { name: 'Trompette solo', params: { pan: 0, instrument: 86, seed: 96, attack: 0.6, level: 1 } },
    { name: 'Cuivres synth', params: { pan: -0.6, instrument: 87, seed: 97, attack: 0.55, level: 0.7 } },
    { name: 'Trompette 2', params: { pan: 0.6, instrument: 88, seed: 98, attack: 0.55, level: 0.7 } },
  ],
  reverb: { time: 0.55, damp: 0.5, preDelay: 12, mix: 0.22 },
  level: 1.4,
})

// NoobSynth3 "Songs" (the project's own compositions): Lead + Arp on two handpans. 4 voices.
duo({
  id: 'handpan-monolithe',
  name: 'Handpans - Monolithe (4 voix)',
  description: "Monolithe, composition originale du projet (projet Songs), sur deux handpans : melodie a droite, arpege a gauche, sequenceur a 4 voix.",
  file: 'monolithe.mid',
  voices: 4,
  text: ['MONOLITHE (4 voix)', 'Composition originale de NoobSynth3 (projet Songs, fichier monolithe.mid).', '',
    "La melodie et l'arpege du morceau sur deux handpans : la melodie a droite, l'arpege continu a gauche."],
  parts: [
    { name: 'Melodie', params: { pan: 0.45, instrument: 6, seed: 51, attack: 0.5, level: 1 } },
    { name: 'Arpege', params: { pan: -0.45, instrument: 17, seed: 52, attack: 0.4, sustain: 1.1, level: 0.8 } },
  ],
  reverb: { time: 0.65, damp: 0.45, preDelay: 14, mix: 0.28 },
  level: 2.7,
})

duo({
  id: 'handpan-lumiere',
  name: 'Handpans - Lumiere (4 voix)',
  description: "Lumiere, composition originale du projet (projet Songs), sur deux handpans : melodie a droite, arpege a gauche, sequenceur a 4 voix.",
  file: 'lumiere.mid',
  voices: 4,
  text: ['LUMIERE (4 voix)', 'Composition originale de NoobSynth3 (projet Songs, fichier lumiere.mid).', '',
    "La melodie et l'arpege du morceau sur deux handpans : la melodie a droite, l'arpege continu a gauche."],
  parts: [
    { name: 'Melodie', params: { pan: 0.45, instrument: 8, seed: 61, attack: 0.5, level: 1 } },
    { name: 'Arpege', params: { pan: -0.45, instrument: 19, seed: 62, attack: 0.4, sustain: 1.1, level: 0.8 } },
  ],
  reverb: { time: 0.7, damp: 0.4, preDelay: 16, mix: 0.3 },
  level: 2.7,
})

// Aphex Twin - Avril 14th: the user's own MIDI split by hand once (melody = highest note of each onset
// from Eb4, accompaniment = the rest). Velocities of the file are only 25/50: x2.2 keeps the bloom.
duo({
  id: 'handpan-avril-14th',
  name: 'Handpans - Aphex Twin Avril 14th (8 voix)',
  description: 'Avril 14th (Aphex Twin) sur deux handpans distincts : melodie a droite, accompagnement a gauche, sequenceur a 8 voix.',
  file: 'avril-14th.mid',
  voices: 8,
  text: ['APHEX TWIN - AVRIL 14TH (8 voix)', 'Drukqs, 2001.', '',
    'Le MIDI est reparti par main : la note la plus haute de chaque attaque (a partir de Eb4) = la',
    "melodie, le reste = l'accompagnement. Les velocites du fichier (25/50) passent par un Gain x2.2",
    'pour garder accents et bloom.'],
  parts: [
    { name: 'Melodie', velGain: 2.2, params: { attack: 0.45, humanize: 0.3, sustain: 1.1, bloom: 0.55, cavity: 0.35, pan: 0.55, instrument: 7, seed: 21, level: 0.8 } },
    { name: 'Accompagnement', velGain: 2.2, params: { attack: 0.35, humanize: 0.35, sustain: 1.25, cavity: 0.45, pan: -0.55, instrument: 12, seed: 33, level: 0.72 } },
  ],
  reverb: { time: 0.6, damp: 0.45, preDelay: 14, mix: 0.24 },
  level: 2.7,
})

// Super Mario World - Overworld (SNES), from the Mario module's song data (scripts/mario-song-midi.mjs):
// melody and walking bass only (the module's harmony channel was derived mechanically and clashes).
duo({
  id: 'handpan-smw-overworld',
  name: 'Handpans - Super Mario World Overworld (4 voix)',
  description: "Le theme du monde de Super Mario World (SNES, Koji Kondo) sur deux handpans : la melodie a droite, la basse qui marche a gauche, sequenceur a 4 voix.",
  file: 'smw-overworld.mid',
  voices: 4,
  text: ['SUPER MARIO WORLD - OVERWORLD (4 voix)', 'Super Mario World (SNES, 1990), musique de Koji Kondo.', '',
    'Le theme du monde en fa majeur : la melodie sur un handpan, la basse qui marche (chromatique)',
    'sur un autre, tenue courte pour que les notes ne se melangent pas. Fichier tire des donnees du',
    'module Mario (scripts/mario-song-midi.mjs).'],
  parts: [
    { name: 'Melodie', params: { pan: 0.35, instrument: 71, seed: 81, attack: 0.55, sustain: 0.9, level: 1 } },
    { name: 'Basse', params: { pan: -0.35, instrument: 72, seed: 82, attack: 0.5, sustain: 0.7, level: 0.9 } },
  ],
  reverb: { time: 0.5, damp: 0.45, preDelay: 12, mix: 0.2 },
  level: 1.5,
})

// ---- Multi-rack projects: one rack per instrument family, every rack plays the same MIDI file with its
// own sequencer (they start together), so the mixer console gets a fader per family. In a project the
// mixer fader REPLACES each rack's output level (src/state/rackFlatten.ts, max +6 dB).
const projects = []
function project({ id, name, description, piece, racks, text, masterVolume = 1 }) {
  const def = pieces[piece]
  const data = load(def.file)
  const midiId = midiManifest.presets.find((e) => e.file === def.file).id
  const rackSpecs = racks.map((rk, ri) => {
    const hp = rk.tracks.map((t, j) => handpan(`hp-${t + 1}`, def.parts[t].name, 40 + 580 * j, data.tracks[t].notes, def.parts[t].params))
    const vel = rk.tracks.flatMap((t, j) => velGains([def.parts[t]], 620 + 260 * j).map((m) => ({ ...m, id: `vel-${t + 1}` })))
    const mixer = hp.length === 1 ? [] : hp.length === 2
      ? [{ id: 'mix-1', type: 'mixer', name: rk.name, position: { x: 1000, y: 300 }, params: { levelA: 0.8, levelB: 0.8 } }]
      : [{ id: 'mix-1', type: 'mixer-8', name: rk.name, position: { x: 1000, y: 300 }, params: Object.fromEntries(hp.map((_, i) => [`level${i + 1}`, 1])) }]
    const into = hp.length === 1 ? [c(hp[0].id, 'out', 'rev-1', 'in', 'audio')] : hp.length === 2
      ? [c(hp[0].id, 'out', 'mix-1', 'in-a', 'audio'), c(hp[1].id, 'out', 'mix-1', 'in-b', 'audio'), c('mix-1', 'out', 'rev-1', 'in', 'audio')]
      : [...hp.map((h, i) => c(h.id, 'out', 'mix-1', `in-${i + 1}`, 'audio')), c('mix-1', 'out', 'rev-1', 'in', 'audio')]
    const rackText = ri === 0
      ? [...text, '', ...racks.map((r, k) => `Rack ${k + 1} "${r.name}" : ${r.tracks.map((t) => `piste ${t + 1} -> ${def.parts[t].name}`).join(', ')}`), '',
        `Chaque rack a son propre sequenceur MIDI (${def.voices} voix) charge avec le meme fichier : ils demarrent`,
        'ensemble. La console MIXER donne un fader par famille.']
      : [`${name.toUpperCase()} - rack ${ri + 1} "${rk.name}"`, '', ...rk.tracks.map((t) => `Piste ${t + 1} du fichier -> ${def.parts[t].name}`), '', 'Voir le rack 1 pour le projet complet.']
    return {
      id: `rack-${ri + 1}`,
      name: rk.name,
      graph: {
        modules: [notesModule(rackText.join('\n')), seq(data, def.voices, `${midiId}.mid`, def.tempo), ...hp, ...vel, ...mixer,
          { id: 'rev-1', type: 'reverb', name: 'Salle', position: { x: 1240, y: 300 }, params: def.reverb },
          { id: 'out-1', type: 'output', name: 'Out', position: { x: 1680, y: 300 }, params: { level: rk.volume } }],
        connections: [...hp.flatMap((h, j) => [c('midi-1', `cv-${rk.tracks[j] + 1}`, h.id, 'pitch', 'cv'), c('midi-1', `gate-${rk.tracks[j] + 1}`, h.id, 'gate', 'gate')]),
          ...velConnections(def.parts, rk.tracks, hp), ...into, c('rev-1', 'out', 'out-1', 'in', 'audio')],
      },
    }
  })
  const tempo = def.tempo ?? Math.round(data.tempo)
  projects.push({
    entry: { id, name, description, file: `${id}.json`, group: 'Handpan' },
    json: {
      version: 2, type: 'project', masterTempo: tempo, masterVolume, activeRackId: 'rack-1', racks: rackSpecs,
      mixer: Object.fromEntries(racks.map((rk, ri) => [`rack-${ri + 1}`, { volume: rk.volume, mute: false, solo: false }])),
    },
  })
}

project({
  id: 'handpan-zelda-kakariko-project',
  piece: 'handpan-zelda-kakariko',
  name: 'Handpans - Zelda Kakariko (orchestre)',
  description: 'Kakariko Village (Zelda: A Link to the Past, SNES) : 8 handpans, un par piste du MIDI, en 3 racks (cordes, melodie + shakuhachis, cloches) avec un fader par famille.',
  text: ['ZELDA - KAKARIKO VILLAGE (orchestre de handpans)', 'A Link to the Past (SNES), musique de Koji Kondo, MIDI de Thomas Rungeard.'],
  racks: [
    { name: 'Cordes', tracks: [0, 1, 2], volume: 1.65 },
    { name: 'Melodie', tracks: [3, 4, 5], volume: 1.65 },
    { name: 'Cloches', tracks: [6, 7], volume: 1.65 },
  ],
})
project({
  id: 'handpan-zelda-dark-world-project',
  piece: 'handpan-zelda-dark-world',
  name: 'Handpans - Zelda Dark World (orchestre)',
  description: 'Dark World (Zelda: A Link to the Past, SNES) : les 8 pistes que charge le lecteur MIDI sur 8 handpans, en 3 racks (cordes, basses, cuivres).',
  text: ['ZELDA - DARK WORLD (orchestre de handpans)', 'A Link to the Past (SNES), musique de Koji Kondo.', '',
    'Le fichier a 11 pistes, le lecteur MIDI en garde 8 (cymbale, batterie et flute non jouees).',
    "Tempo du fichier 192 puis 128 : les sequenceurs sont a 128, seule l'intro est plus lente."],
  racks: [
    { name: 'Cordes', tracks: [0, 1, 2], volume: 0.78 },
    { name: 'Basses', tracks: [3, 4], volume: 0.78 },
    { name: 'Cuivres', tracks: [5, 6, 7], volume: 0.78 },
  ],
})
project({
  id: 'handpan-zelda-fairy-project',
  piece: 'handpan-zelda-fairy',
  name: 'Handpans - Zelda Fairy Fountain (2 racks)',
  description: 'La Fontaine des Fees (Zelda: A Link to the Past, SNES) : arpeges et melodie sur deux handpans, chacun dans son rack.',
  text: ['ZELDA - FAIRY FOUNTAIN (2 racks)', 'A Link to the Past (SNES), musique de Koji Kondo.'],
  racks: [
    { name: 'Arpeges', tracks: [0], volume: 1.0 },
    { name: 'Melodie', tracks: [1], volume: 1.0 },
  ],
})
project({
  id: 'handpan-avril-14th-project',
  piece: 'handpan-avril-14th',
  name: 'Handpans - Aphex Twin Avril 14th (2 racks)',
  description: 'Avril 14th (Aphex Twin) : melodie et accompagnement sur deux handpans distincts, chacun dans son rack.',
  text: ['APHEX TWIN - AVRIL 14TH (2 racks)', 'Drukqs, 2001. MIDI reparti par main (melodie / accompagnement), velocites x2.2.'],
  racks: [
    { name: 'Melodie', tracks: [0], volume: 1.6 },
    { name: 'Accompagnement', tracks: [1], volume: 1.6 },
  ],
})

for (const pr of projects) {
  writeFileSync(`public/projects/${pr.entry.file}`, JSON.stringify(pr.json, null, 2) + '\n')
  // offline bench: flatten like src/state/rackFlatten.ts (the mixer volume replaces each rack's output level)
  const modules = []
  const connections = []
  for (const rk of pr.json.racks) {
    const vol = pr.json.mixer[rk.id].volume
    for (const m of rk.graph.modules) modules.push({ ...m, id: `${rk.id}/${m.id}`, params: m.type === 'output' ? { ...m.params, level: vol } : m.params })
    for (const k of rk.graph.connections) connections.push({ from: { moduleId: `${rk.id}/${k.from.moduleId}`, portId: k.from.portId }, to: { moduleId: `${rk.id}/${k.to.moduleId}`, portId: k.to.portId }, kind: k.kind })
  }
  writeFileSync(`target/${pr.entry.id}-flat.json`, JSON.stringify({ modules, connections, taps: [] }))
}
const projManifestPath = 'public/projects/manifest.json'
const projManifest = JSON.parse(readFileSync(projManifestPath, 'utf8'))
projManifest.projects = [...projManifest.projects.filter((e) => !projects.some((p) => p.entry.id === e.id)), ...projects.map((p) => p.entry)]
writeFileSync(projManifestPath, JSON.stringify(projManifest, null, 2) + '\n')
console.log('projects', projects.map((p) => p.entry.id).join(', '))

for (const p of presets) {
  writeFileSync(`public/presets/${p.id}.json`, JSON.stringify(p, null, 2) + '\n')
  writeFileSync(`target/${p.id}-flat.json`, JSON.stringify(p.graph))
}

// Manifest: insert/replace after handpan-kurde.
const manifestPath = 'public/presets/manifest.json'
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const list = manifest.presets.filter((e) => !presets.some((p) => p.id === e.id))
const at = list.findIndex((e) => e.id === 'handpan-kurde') + 1
list.splice(at, 0, ...presets.map((p) => ({ id: p.id, name: p.name, description: p.description, file: `${p.id}.json`, group: p.group })))
manifest.presets = list
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log('written', presets.map((p) => p.id).join(', '))
