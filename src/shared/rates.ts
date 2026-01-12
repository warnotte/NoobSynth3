/**
 * Unified rate division constants.
 *
 * These match the Rust RATE_DIVISIONS in crates/dsp-core/src/sequencers/mod.rs.
 * All sequencer modules use these indices for consistent behavior.
 */

/**
 * Rate division entry with index, label, and beat duration.
 */
export interface RateDivision {
  /** Index in the RATE_DIVISIONS array */
  id: number
  /** Display label (e.g., "1/4", "1/8T") */
  label: string
  /** Duration in beats (1.0 = quarter note) */
  beats: number
}

/**
 * All available rate divisions.
 *
 * | Index | Label | Beats | Description |
 * |-------|-------|-------|-------------|
 * | 0 | 1/1 | 4.0 | Whole note |
 * | 1 | 1/2 | 2.0 | Half note |
 * | 2 | 1/4 | 1.0 | Quarter note |
 * | 3 | 1/8 | 0.5 | Eighth note |
 * | 4 | 1/16 | 0.25 | Sixteenth note |
 * | 5 | 1/32 | 0.125 | Thirty-second note |
 * | 6 | 1/2T | 1.333 | Half triplet |
 * | 7 | 1/4T | 0.667 | Quarter triplet |
 * | 8 | 1/8T | 0.333 | Eighth triplet |
 * | 9 | 1/16T | 0.167 | Sixteenth triplet |
 * | 10 | 1/32T | 0.083 | Thirty-second triplet |
 * | 11 | 1/2. | 3.0 | Dotted half |
 * | 12 | 1/4. | 1.5 | Dotted quarter |
 * | 13 | 1/8. | 0.75 | Dotted eighth |
 * | 14 | 1/16. | 0.375 | Dotted sixteenth |
 * | 15 | 1/32. | 0.1875 | Dotted thirty-second |
 */
export const RATE_DIVISIONS: RateDivision[] = [
  { id: 0, label: '1/1', beats: 4.0 },
  { id: 1, label: '1/2', beats: 2.0 },
  { id: 2, label: '1/4', beats: 1.0 },
  { id: 3, label: '1/8', beats: 0.5 },
  { id: 4, label: '1/16', beats: 0.25 },
  { id: 5, label: '1/32', beats: 0.125 },
  { id: 6, label: '1/2T', beats: 1.333 },
  { id: 7, label: '1/4T', beats: 0.667 },
  { id: 8, label: '1/8T', beats: 0.333 },
  { id: 9, label: '1/16T', beats: 0.167 },
  { id: 10, label: '1/32T', beats: 0.083 },
  { id: 11, label: '1/2.', beats: 3.0 },
  { id: 12, label: '1/4.', beats: 1.5 },
  { id: 13, label: '1/8.', beats: 0.75 },
  { id: 14, label: '1/16.', beats: 0.375 },
  { id: 15, label: '1/32.', beats: 0.1875 },
]

/**
 * Common rate presets for different UI contexts.
 */
export const RATE_PRESETS = {
  /** Basic straight divisions (no triplets or dotted) */
  straight: [0, 1, 2, 3, 4, 5] as const,

  /** Common sequencer rates: 1/4, 1/8, 1/16 + triplets */
  sequencer: [2, 3, 4, 7, 8, 9] as const,

  /** Arpeggiator rates: 1/4, 1/8, 1/16 + triplets */
  arpeggiator: [2, 3, 4, 7, 8, 9] as const,

  /** Clock rates: straight divisions + triplets */
  clock: [0, 1, 2, 3, 4, 5, 7, 8, 9] as const,

  /** Drum sequencer rates: 1/4, 1/8, 1/16, 1/32 */
  drums: [2, 3, 4, 5] as const,

  /** Extended set with triplets */
  withTriplets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const,

  /** Extended set with dotted */
  withDotted: [0, 1, 2, 3, 4, 5, 11, 12, 13, 14, 15] as const,

  /** Full set */
  all: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const,
} as const

/**
 * Get rate divisions for a specific preset.
 */
export function getRateOptions(preset: keyof typeof RATE_PRESETS): RateDivision[] {
  return RATE_PRESETS[preset].map(id => RATE_DIVISIONS[id])
}

/**
 * Get a specific rate division by index.
 */
export function getRate(index: number): RateDivision {
  return RATE_DIVISIONS[Math.min(index, RATE_DIVISIONS.length - 1)]
}

/**
 * Default rate indices for each module type.
 */
export const DEFAULT_RATES = {
  arpeggiator: 3,      // 1/8
  stepSequencer: 3,    // 1/8
  drumSequencer: 4,    // 1/16
  euclidean: 4,        // 1/16 (Euclidean rhythms work well at 1/16)
  clock: 4,            // 1/16
} as const
