/**
 * Preset Note Validator
 *
 * Reads a preset JSON, extracts step sequencer data, and converts
 * pitch values to actual note names based on oscillator base frequencies.
 * Compares against a reference melody to flag mismatches.
 *
 * Usage: node scripts/validate-preset-notes.mjs [preset-file]
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// ─── Note name helpers ───────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function midiToNoteName(midi) {
  if (midi < 0 || midi > 127) return `?${midi}`
  const octave = Math.floor(midi / 12) - 1
  const note = NOTE_NAMES[midi % 12]
  return `${note}${octave}`
}

function freqToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440)
}

function noteNameToMidi(name) {
  const match = name.match(/^([A-G]#?)(\d)$/)
  if (!match) return -1
  const noteIdx = NOTE_NAMES.indexOf(match[1])
  const octave = parseInt(match[2])
  return (octave + 1) * 12 + noteIdx
}

// ─── Load preset ─────────────────────────────────────────────────────

const presetPath = resolve(process.argv[2] || 'public/presets/take-on-me.json')
const preset = JSON.parse(readFileSync(presetPath, 'utf8'))
const modules = preset.graph.modules
const connections = preset.graph.connections

console.log(`\n═══ Preset Note Validator ═══`)
console.log(`Preset: ${preset.name} (${preset.id})`)
console.log(`File: ${presetPath}\n`)

// ─── Find connections: which oscillator does each sequencer feed? ────

function findOscBaseFreq(seqId) {
  // Find connection: seq cv-out → osc pitch
  const cvConn = connections.find(c =>
    c.from.moduleId === seqId &&
    (c.from.portId === 'cv-out' || c.from.portId.startsWith('cv-'))
  )
  if (!cvConn) return { freq: 440, oscName: '(no CV connection found, assuming 440Hz)' }

  const oscModule = modules.find(m => m.id === cvConn.to.moduleId)
  if (!oscModule) return { freq: 440, oscName: '(target module not found)' }

  const freq = oscModule.params?.frequency ?? 220
  return { freq, oscName: `${oscModule.name} (${oscModule.type}, base ${freq}Hz)` }
}

// ─── Analyze each step sequencer ─────────────────────────────────────

const stepSeqs = modules.filter(m => m.type === 'step-sequencer')

for (const seq of stepSeqs) {
  const { freq: baseFreq, oscName } = findOscBaseFreq(seq.id)
  const baseMidi = Math.round(freqToMidi(baseFreq))
  const baseNoteName = midiToNoteName(baseMidi)

  console.log(`──────────────────────────────────────────────────`)
  console.log(`Sequencer: ${seq.name} (${seq.id})`)
  console.log(`  → Target: ${oscName}`)
  console.log(`  → Base freq ${baseFreq}Hz = ${baseNoteName} (MIDI ${baseMidi})`)
  console.log(`  → Formula: actual_note = ${baseNoteName} + pitch semitones`)
  console.log(`  → Length: ${seq.params.length} steps`)
  console.log()

  let steps = []
  try {
    steps = JSON.parse(seq.params.stepData || '[]')
  } catch { steps = [] }

  const length = seq.params.length || 16

  // Print in groups of 8 (like bars)
  for (let bar = 0; bar < Math.ceil(length / 8); bar++) {
    const barStart = bar * 8
    const barEnd = Math.min(barStart + 8, length)
    const barNotes = []

    for (let i = barStart; i < barEnd; i++) {
      const step = steps[i]
      if (!step) { barNotes.push('???'); continue }

      if (!step.gate) {
        barNotes.push('rest')
        continue
      }

      const actualMidi = baseMidi + step.pitch
      const noteName = midiToNoteName(actualMidi)
      barNotes.push(noteName)
    }

    const barLabel = `Bar ${bar + 1} (steps ${barStart + 1}-${barEnd})`
    console.log(`  ${barLabel}: ${barNotes.join(' | ')}`)
  }

  // Also print raw pitch values for debugging
  console.log()
  console.log(`  Raw pitches: [${steps.slice(0, length).map(s => s?.pitch ?? '?').join(', ')}]`)
  console.log(`  Gates:       [${steps.slice(0, length).map(s => s?.gate ? '●' : '○').join(', ')}]`)
  console.log()
}

// ─── Analyze chord sequencer ─────────────────────────────────────────

const chordSeqs = modules.filter(m => m.type === 'chord-sequencer')

for (const seq of chordSeqs) {
  console.log(`──────────────────────────────────────────────────`)
  console.log(`Chord Sequencer: ${seq.name} (${seq.id})`)

  let steps = []
  try {
    steps = JSON.parse(seq.params.stepData || '[]')
  } catch { steps = [] }

  const CHORD_TYPES = ['Major', 'Minor', 'Dim', 'Aug', 'Sus2', 'Sus4', '7th', 'Maj7', 'Min7']

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const rootNote = midiToNoteName(step.root)
    const chordType = CHORD_TYPES[step.chordType] || `type${step.chordType}`
    const inv = step.inversion ? ` inv${step.inversion}` : ''
    const gate = step.gate ? '' : ' [MUTED]'
    console.log(`  Step ${i + 1}: ${rootNote} ${chordType}${inv}${gate}`)
  }
  console.log()
}

// ─── Reference melody comparison (Take On Me) ───────────────────────

if (preset.id === 'take-on-me') {
  console.log(`\n═══ Take On Me — Reference Comparison ═══\n`)
  console.log(`Key: A major | Tempo: 169 BPM | Chord progression: Bm - E - A - D\n`)

  // The correct riff notes (eighth notes, 4 bars of 8)
  // Bar 1 (Bm): F#5 F#5 D5 B4 rest B4 E5 E5
  // Bar 2 (E):  E5 G#5 G#5 A5 B5 A5 A5 A5
  // Bar 3 (A):  F#5 F#5 E5 C#5 rest C#5 E5 E5
  // Bar 4 (D):  E5 A5 A5 B5 C#6 B5 A5 A5
  const RIFF_REFERENCE = [
    // Bar 1 (Bm)
    { note: 'F#5', gate: true }, { note: 'F#5', gate: true },
    { note: 'D5', gate: true },  { note: 'B4', gate: true },
    { note: null, gate: false },  { note: 'B4', gate: true },
    { note: 'E5', gate: true },  { note: 'E5', gate: true },
    // Bar 2 (E)
    { note: 'E5', gate: true },  { note: 'G#5', gate: true },
    { note: 'G#5', gate: true }, { note: 'A5', gate: true },
    { note: 'B5', gate: true },  { note: 'A5', gate: true },
    { note: 'A5', gate: true },  { note: 'A5', gate: true },
    // Bar 3 (A)
    { note: 'F#5', gate: true }, { note: 'F#5', gate: true },
    { note: 'E5', gate: true },  { note: 'C#5', gate: true },
    { note: null, gate: false },  { note: 'C#5', gate: true },
    { note: 'E5', gate: true },  { note: 'E5', gate: true },
    // Bar 4 (D)
    { note: 'E5', gate: true },  { note: 'A5', gate: true },
    { note: 'A5', gate: true },  { note: 'B5', gate: true },
    { note: 'C#6', gate: true }, { note: 'B5', gate: true },
    { note: 'A5', gate: true },  { note: 'A5', gate: true },
  ]

  // Bass reference (root notes, 8 eighth notes per chord)
  // Bm = B2, E = E2, A = A2, D = D3
  const BASS_REFERENCE_ROOTS = [
    { chord: 'Bm', root: 'B2', steps: 8 },
    { chord: 'E',  root: 'E2', steps: 8 },
    { chord: 'A',  root: 'A2', steps: 8 },
    { chord: 'D',  root: 'D3', steps: 8 },
  ]

  // Chord reference
  const CHORD_REFERENCE = [
    { root: 'B3', type: 'Minor' },  // Bm
    { root: 'E4', type: 'Major' },  // E
    { root: 'A3', type: 'Major' },  // A
    { root: 'D4', type: 'Major' },  // D
  ]

  // Compare riff
  const riffSeq = stepSeqs.find(s => s.id === 'seq-riff')
  if (riffSeq) {
    const { freq } = findOscBaseFreq(riffSeq.id)
    const baseMidi = Math.round(freqToMidi(freq))
    let steps = []
    try { steps = JSON.parse(riffSeq.params.stepData) } catch {}

    console.log(`RIFF COMPARISON (base ${freq}Hz = ${midiToNoteName(baseMidi)}):`)
    console.log(`${'Step'.padEnd(5)} ${'Expected'.padEnd(8)} ${'Got'.padEnd(8)} ${'Pitch'.padEnd(6)} Match`)
    console.log(`${'─'.repeat(5)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(6)} ${'─'.repeat(5)}`)

    let mismatches = 0
    for (let i = 0; i < RIFF_REFERENCE.length; i++) {
      const ref = RIFF_REFERENCE[i]
      const step = steps[i]
      if (!step) continue

      const expectedStr = ref.gate ? ref.note : 'rest'
      let gotStr = 'rest'
      let pitchStr = ''

      if (step.gate) {
        const actualMidi = baseMidi + step.pitch
        gotStr = midiToNoteName(actualMidi)
        pitchStr = `${step.pitch >= 0 ? '+' : ''}${step.pitch}`
      }

      const match = (ref.gate === step.gate) &&
        (!ref.gate || noteNameToMidi(ref.note) === baseMidi + step.pitch)

      if (!match) mismatches++
      const marker = match ? '  ✓' : '  ✗ ←'
      console.log(`${String(i + 1).padEnd(5)} ${expectedStr.padEnd(8)} ${gotStr.padEnd(8)} ${pitchStr.padEnd(6)} ${marker}`)
    }

    console.log(`\n  → ${mismatches} mismatches out of ${RIFF_REFERENCE.length} steps`)

    // Show what pitches SHOULD be
    if (mismatches > 0) {
      console.log(`\n  CORRECT pitch values for base ${midiToNoteName(baseMidi)}:`)
      const correctPitches = RIFF_REFERENCE.map(ref => {
        if (!ref.gate) return { pitch: 0, gate: false }
        return { pitch: noteNameToMidi(ref.note) - baseMidi, gate: true }
      })
      console.log(`  [${correctPitches.map(p => p.pitch).join(', ')}]`)
    }
  }

  // Compare bass
  console.log()
  const bassSeq = stepSeqs.find(s => s.id === 'seq-bass')
  if (bassSeq) {
    const { freq } = findOscBaseFreq(bassSeq.id)
    const baseMidi = Math.round(freqToMidi(freq))
    let steps = []
    try { steps = JSON.parse(bassSeq.params.stepData) } catch {}

    console.log(`BASS COMPARISON (base ${freq}Hz = ${midiToNoteName(baseMidi)}):`)
    for (const ref of BASS_REFERENCE_ROOTS) {
      const refMidi = noteNameToMidi(ref.root)
      const neededPitch = refMidi - baseMidi
      console.log(`  ${ref.chord.padEnd(4)} → ${ref.root} = MIDI ${refMidi} → pitch should be ${neededPitch >= 0 ? '+' : ''}${neededPitch}`)
    }
  }

  // Compare chords
  console.log()
  console.log(`CHORD COMPARISON:`)
  const chordSeq = chordSeqs.find(s => s.id === 'chord-seq')
  if (chordSeq) {
    let steps = []
    try { steps = JSON.parse(chordSeq.params.stepData) } catch {}

    const CHORD_TYPES = ['Major', 'Minor', 'Dim', 'Aug', 'Sus2', 'Sus4', '7th', 'Maj7', 'Min7']

    for (let i = 0; i < CHORD_REFERENCE.length; i++) {
      const ref = CHORD_REFERENCE[i]
      const step = steps[i]
      if (!step) continue

      const gotRoot = midiToNoteName(step.root)
      const gotType = CHORD_TYPES[step.chordType] || `?${step.chordType}`
      const refMidi = noteNameToMidi(ref.root)

      const match = step.root === refMidi && gotType === ref.type
      const marker = match ? '✓' : '✗'
      console.log(`  Step ${i + 1}: expected ${ref.root} ${ref.type}, got ${gotRoot} ${gotType} (MIDI ${step.root}) ${marker}`)
    }
  }
}

console.log(`\n═══ Done ═══\n`)
