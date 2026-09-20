// Print a MIDI track bar by bar on the sixteenth grid. node midi-grid.mjs file.mid track barFrom barTo
import pkg from '@tonejs/midi'
import { readFileSync } from 'node:fs'
const { Midi } = pkg
const [, , f, trS, b0S, b1S] = process.argv
const buf = readFileSync(f), midi = new Midi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], nn = (m) => N[m % 12] + (Math.floor(m / 12) - 1)
const s16 = midi.header.ppq / 4, t = midi.tracks[+trS]
for (let bar = +b0S; bar <= +b1S; bar++) {
  const ns = t.notes.filter((n) => Math.floor(n.ticks / s16 / 16) === bar - 1)
  console.log(`mes.${String(bar).padStart(2)} : ` + ns.map((n) => `${Math.round(n.ticks / s16) % 16}:${nn(n.midi)}x${+(n.durationTicks / s16).toFixed(1)}`).join('  '))
}
