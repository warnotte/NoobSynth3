const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const clampMidiNote = (value: number) => Math.max(0, Math.min(127, Math.round(value)))

export const clampVoiceCount = (value: number) => Math.max(1, Math.min(8, Math.round(value)))

export const formatMidiNote = (note: number) => {
  const clamped = clampMidiNote(note)
  const name = MIDI_NOTE_NAMES[clamped % 12]
  const octave = Math.floor(clamped / 12) - 1
  return `${name}${octave}`
}
