import { Midi } from '@tonejs/midi'

/**
 * Represents a single MIDI note event
 */
export type MidiNote = {
  /** Position in MIDI ticks from start */
  tick: number
  /** MIDI note number (0-127) */
  note: number
  /** Velocity (0-127) */
  velocity: number
  /** Duration in ticks */
  duration: number
}

/**
 * Represents a single MIDI track
 */
export type MidiTrackData = {
  /** Track name from MIDI file */
  name: string
  /** MIDI channel (0-15) */
  channel: number
  /** All notes in this track, sorted by tick */
  notes: MidiNote[]
}

/**
 * Parsed MIDI file data ready for the sequencer
 */
export type MidiFileData = {
  /** Ticks per beat (PPQN - Pulses Per Quarter Note) */
  ticksPerBeat: number
  /** Total duration in ticks */
  totalTicks: number
  /** Tempo in BPM (from first tempo event, or 120 default) */
  tempo: number
  /** Up to 8 tracks */
  tracks: MidiTrackData[]
}

/** Maximum number of tracks to extract */
const MAX_TRACKS = 8

/** Maximum notes per track to prevent memory issues */
const MAX_NOTES_PER_TRACK = 8192

/**
 * Parse a MIDI file from a File object (browser File API)
 */
export async function parseMidiFile(file: File): Promise<MidiFileData> {
  const buffer = await file.arrayBuffer()
  return parseMidiBuffer(buffer)
}

/**
 * Parse a MIDI file from an ArrayBuffer
 */
export function parseMidiBuffer(buffer: ArrayBuffer): MidiFileData {
  const midi = new Midi(buffer)

  // Get tempo from first tempo event, or default to 120 BPM
  const tempo = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120

  // Calculate total duration in ticks
  let totalTicks = 0

  // Convert tracks, limiting to MAX_TRACKS
  const tracks: MidiTrackData[] = []

  for (const track of midi.tracks) {
    if (tracks.length >= MAX_TRACKS) break

    // Skip empty tracks
    if (track.notes.length === 0) continue

    // Convert notes
    const notes: MidiNote[] = track.notes
      .slice(0, MAX_NOTES_PER_TRACK)
      .map((note) => ({
        tick: Math.round(note.ticks),
        note: note.midi,
        velocity: Math.round(note.velocity * 127),
        duration: Math.round(note.durationTicks),
      }))
      .sort((a, b) => a.tick - b.tick)

    // Update total duration
    for (const note of notes) {
      const endTick = note.tick + note.duration
      if (endTick > totalTicks) {
        totalTicks = endTick
      }
    }

    tracks.push({
      name: track.name || `Track ${tracks.length + 1}`,
      channel: track.channel,
      notes,
    })
  }

  return {
    ticksPerBeat: midi.header.ppq,
    totalTicks,
    tempo,
    tracks,
  }
}

/**
 * Serialize MIDI data to JSON string for passing to DSP engine
 */
export function serializeMidiData(data: MidiFileData): string {
  return JSON.stringify(data)
}

/**
 * Load a MIDI preset from the built-in presets directory
 */
export async function loadMidiPreset(presetId: string): Promise<MidiFileData> {
  const response = await fetch(`/midi-presets/${presetId}.mid`)
  if (!response.ok) {
    throw new Error(`Failed to load MIDI preset: ${presetId}`)
  }
  const buffer = await response.arrayBuffer()
  return parseMidiBuffer(buffer)
}

/**
 * MIDI preset manifest entry
 */
export type MidiPresetEntry = {
  id: string
  name: string
  file: string
}

/**
 * MIDI preset manifest
 */
export type MidiPresetManifest = {
  version: number
  presets: MidiPresetEntry[]
}

/**
 * Load the MIDI presets manifest
 */
export async function loadMidiPresetManifest(): Promise<MidiPresetManifest> {
  try {
    const response = await fetch('/midi-presets/manifest.json')
    if (!response.ok) {
      return { version: 1, presets: [] }
    }
    return (await response.json()) as MidiPresetManifest
  } catch {
    return { version: 1, presets: [] }
  }
}
