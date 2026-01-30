/**
 * Chiptune helper types and utilities for SID and AY players
 */

// Voice state type for SID visualization
export type SidVoiceState = { freq: number; gate: boolean; waveform: number }

// Voice state type for AY visualization
export type AyVoiceState = { period: number; active: boolean; flags: number }

// Waveform labels for SID
export const WAVEFORM_LABELS: Record<number, string> = {
  0: '-',
  1: 'TRI',
  2: 'SAW',
  4: 'PUL',
  8: 'NOI',
  3: 'T+S',
  5: 'T+P',
  6: 'S+P',
  7: 'TSP',
}

// AY mode labels
export const AY_MODE_LABELS: Record<number, string> = {
  0: '-',
  1: 'T',    // Tone only
  2: 'N',    // Noise only
  3: 'T+N',  // Tone + Noise
  5: 'Te',   // Tone + Envelope
  6: 'Ne',   // Noise + Envelope
  7: 'TNe',  // Tone + Noise + Envelope
}

// Format seconds to m:ss
export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
