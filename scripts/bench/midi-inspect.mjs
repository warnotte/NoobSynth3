// What is inside a MIDI file: tracks, ranges, polyphony, length. node midi-inspect.mjs file.mid
import pkg from '@tonejs/midi'
import { readFileSync } from 'node:fs'
const { Midi } = pkg
const buf = readFileSync(process.argv[2])
const midi = new Midi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], nn = (m) => N[m % 12] + (Math.floor(m / 12) - 1)
const ppq = midi.header.ppq
console.log(`ppq ${ppq} | tempos ${midi.header.tempos.map((t) => t.bpm.toFixed(1)).join(', ') || 'none (120)'} | time sig ${midi.header.timeSignatures.map((t) => t.timeSignature.join('/')).join(', ') || '-'} | ${midi.tracks.length} tracks | ${midi.duration.toFixed(1)} s`)
midi.tracks.forEach((t, i) => {
  if (!t.notes.length) { console.log(` track ${i}: "${t.name}" (no notes)`); return }
  const ns = t.notes, lo = Math.min(...ns.map((n) => n.midi)), hi = Math.max(...ns.map((n) => n.midi))
  const ev = ns.flatMap((n) => [[n.ticks, 1], [n.ticks + n.durationTicks, -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let cur = 0, mx = 0; for (const [, d] of ev) { cur += d; mx = Math.max(mx, cur) }
  const pcs = new Map(); for (const n of ns) pcs.set(N[n.midi % 12], (pcs.get(N[n.midi % 12]) || 0) + 1)
  const bars = (x) => (x / ppq / 4 + 1).toFixed(1)
  console.log(` track ${i}: "${t.name}" ch${t.channel} inst "${t.instrument?.name}" | ${ns.length} notes | ${nn(lo)}..${nn(hi)} | polyphonie max ${mx} | mesures ${bars(ns[0].ticks)} -> ${bars(ns[ns.length - 1].ticks + ns[ns.length - 1].durationTicks)} | durees (16es) mediane ${(ns.map((n) => n.durationTicks).sort((a, b) => a - b)[ns.length >> 1] / (ppq / 4)).toFixed(1)}`)
  console.log(`          notes: ${[...pcs.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' ')}`)
})
