// Export a song of the Mario module (src/state/marioSongs.ts, 16th-note steps) as a real MIDI file for
// the MIDI player: consecutive equal steps become one held note, except on rhythm channels where every
// step is its own hit.
//   node scripts/mario-song-midi.mjs <songKey> <out.mid> "<track names, comma separated>" [rhythmChannels]
//   e.g. node scripts/mario-song-midi.mjs smw public/midi-presets/smw-overworld.mid "Melodie:1,Basse:4"
import { readFileSync, writeFileSync } from 'node:fs'
import toneMidi from '@tonejs/midi'
const { Midi } = toneMidi

const [, , key, outPath, trackNames = '', rhythm = ''] = process.argv
const source = readFileSync('src/state/marioSongs.ts', 'utf8').replace(/^export const marioSongs =/m, 'return').replace(/\}\s*as const/g, '}').replace(/^export .*$/gm, '')
const songs = new Function(source)()
const song = songs[key]
if (!song) throw new Error(`unknown song ${key} (${Object.keys(songs).join(', ')})`)

const names = trackNames.split(',').map((s) => s.trim()).filter(Boolean)
const rhythmChannels = new Set(rhythm.split(',').filter(Boolean).map(Number))
const midi = new Midi()
midi.header.setTempo(song.tempo)
midi.header.name = song.name
const stepTicks = midi.header.ppq / 4

// A name can pick its channel: "Basse:4" = channel 4 of the song (default: position + 1).
names.forEach((entry, i) => {
  const [name, chosen] = entry.split(':')
  const ch = chosen ? Number(chosen) : i + 1
  const steps = song[`ch${ch}`]
  if (!steps) throw new Error(`${key} has no ch${ch}`)
  const tr = midi.addTrack()
  tr.name = name
  tr.channel = i
  for (let s = 0; s < steps.length; s++) {
    const m = steps[s]
    if (m == null) continue
    let len = 1
    if (!rhythmChannels.has(ch)) while (s + len < steps.length && steps[s + len] === m) len++
    tr.addNote({ midi: m, ticks: s * stepTicks, durationTicks: rhythmChannels.has(ch) ? Math.round(stepTicks * 0.6) : len * stepTicks - 1, velocity: rhythmChannels.has(ch) ? 0.7 : 0.8 })
    s += rhythmChannels.has(ch) ? 0 : len - 1
  }
})
writeFileSync(outPath, Buffer.from(midi.toArray()))
console.log(`${song.name}: ${midi.tracks.map((t) => `${t.name} ${t.notes.length} notes`).join(", ")} -> ${outPath}`)
