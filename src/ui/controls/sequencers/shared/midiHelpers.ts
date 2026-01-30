/**
 * MIDI helper hooks for MIDI File Sequencer
 */

// Helper hook to parse track info from MIDI data string
export function useMidiTrackInfo(midiDataStr: string): Array<{ name: string; noteCount: number; hasNotes: boolean }> {
  const emptyTracks = Array.from({ length: 8 }, (_, i) => ({
    name: `Track ${i + 1}`,
    noteCount: 0,
    hasNotes: false,
  }))

  if (!midiDataStr) return emptyTracks

  try {
    const data = JSON.parse(midiDataStr)
    if (!data.tracks) return emptyTracks

    return Array.from({ length: 8 }, (_, i) => {
      const track = data.tracks[i]
      if (!track) return { name: `Track ${i + 1}`, noteCount: 0, hasNotes: false }
      return {
        name: track.name || `Track ${i + 1}`,
        noteCount: track.notes?.length ?? 0,
        hasNotes: (track.notes?.length ?? 0) > 0,
      }
    })
  } catch {
    return emptyTracks
  }
}

// Helper hook to get total ticks from MIDI data string
export function useMidiTotalTicks(midiDataStr: string): number {
  if (!midiDataStr) return 0

  try {
    const data = JSON.parse(midiDataStr)
    return data.totalTicks ?? 0
  } catch {
    return 0
  }
}
