//! Sequencer modules.
//!
//! This module provides various sequencer implementations:
//!
//! ## Shared Rate Divisions
//!
//! All sequencers use the shared [`RATE_DIVISIONS`] constant for consistent
//! tempo-synced timing. Values are in beats (1.0 = quarter note).
//!
//!
//! ## Clock
//! - [`MasterClock`] - Global transport/clock generator
//!
//! ## Note Sequencers
//! - [`Arpeggiator`] - Arpeggiator with multiple modes and patterns
//! - [`StepSequencer`] - 16-step CV/gate sequencer with slide
//! - [`MidiFileSequencer`] - MIDI file playback with 8 tracks
//!
//! ## Rhythm Sequencers
//! - [`DrumSequencer`] - 8-track, 16-step drum pattern sequencer
//! - [`EuclideanSequencer`] - Euclidean rhythm generator
//!
//! ## Special
//! - [`Mario`] - Mario song player (host-controlled CV/gate holder)
//!
//! # Typical Usage
//!
//! Sequencers generate control signals (CV, gate, accent) that drive
//! synthesizer voices and drum modules. They can be clocked internally
//! via tempo parameter or externally via clock input.
//!
//! # Example
//!
//! ```ignore
//! use dsp_core::sequencers::{MasterClock, MasterClockParams, MasterClockInputs, MasterClockOutputs};
//!
//! let mut clock = MasterClock::new(44100.0);
//! let mut clock_out = [0.0f32; 128];
//! let mut reset_out = [0.0f32; 128];
//! let mut run_out = [0.0f32; 128];
//! let mut bar_out = [0.0f32; 128];
//!
//! clock.process_block(
//!     MasterClockOutputs {
//!         clock: &mut clock_out,
//!         reset: &mut reset_out,
//!         run: &mut run_out,
//!         bar: &mut bar_out,
//!     },
//!     MasterClockInputs { start: None, stop: None, reset_in: None },
//!     MasterClockParams {
//!         running: &[1.0],
//!         tempo: &[120.0],
//!         rate: &[4.0],
//!         swing: &[0.0],
//!     },
//! );
//! ```

pub mod clock;
pub mod arpeggiator;
pub mod step_sequencer;
pub mod drum_sequencer;
pub mod euclidean;
pub mod mario;
pub mod midi_file_sequencer;
pub mod turing;
pub mod sid_player;

// ============================================================================
// Shared Rate Divisions
// ============================================================================

/// Unified rate division values (in beats, where 1.0 = quarter note).
///
/// All sequencer modules use this shared table for consistent behavior.
/// The value represents the duration in quarter-note beats.
///
/// # Index Layout
///
/// | Index | Label | Beats | Description |
/// |-------|-------|-------|-------------|
/// | 0 | 1/1 | 4.0 | Whole note |
/// | 1 | 1/2 | 2.0 | Half note |
/// | 2 | 1/4 | 1.0 | Quarter note |
/// | 3 | 1/8 | 0.5 | Eighth note |
/// | 4 | 1/16 | 0.25 | Sixteenth note |
/// | 5 | 1/32 | 0.125 | Thirty-second note |
/// | 6 | 1/2T | 1.333 | Half triplet (3 in time of 2 halves) |
/// | 7 | 1/4T | 0.667 | Quarter triplet |
/// | 8 | 1/8T | 0.333 | Eighth triplet |
/// | 9 | 1/16T | 0.167 | Sixteenth triplet |
/// | 10 | 1/32T | 0.083 | Thirty-second triplet |
/// | 11 | 1/2. | 3.0 | Dotted half |
/// | 12 | 1/4. | 1.5 | Dotted quarter |
/// | 13 | 1/8. | 0.75 | Dotted eighth |
/// | 14 | 1/16. | 0.375 | Dotted sixteenth |
/// | 15 | 1/32. | 0.1875 | Dotted thirty-second |
///
/// # Triplet Math
///
/// A triplet means 3 notes in the time of 2 normal notes of the same type:
/// - 1/4T = 2 quarter notes / 3 = 2/3 beat ≈ 0.667
/// - 1/8T = 2 eighth notes / 3 = 1/3 beat ≈ 0.333
///
/// # Dotted Note Math
///
/// A dotted note is 1.5x the normal duration:
/// - 1/4. = 1.0 × 1.5 = 1.5 beats
/// - 1/8. = 0.5 × 1.5 = 0.75 beats
pub const RATE_DIVISIONS: [f64; 16] = [
    4.0,    // 0: 1/1 (whole note)
    2.0,    // 1: 1/2 (half note)
    1.0,    // 2: 1/4 (quarter note)
    0.5,    // 3: 1/8 (eighth note)
    0.25,   // 4: 1/16 (sixteenth note)
    0.125,  // 5: 1/32 (thirty-second note)
    1.333,  // 6: 1/2T (half triplet)
    0.667,  // 7: 1/4T (quarter triplet)
    0.333,  // 8: 1/8T (eighth triplet)
    0.167,  // 9: 1/16T (sixteenth triplet)
    0.083,  // 10: 1/32T (thirty-second triplet)
    3.0,    // 11: 1/2. (dotted half)
    1.5,    // 12: 1/4. (dotted quarter)
    0.75,   // 13: 1/8. (dotted eighth)
    0.375,  // 14: 1/16. (dotted sixteenth)
    0.1875, // 15: 1/32. (dotted thirty-second)
];

/// Get beat duration for a rate index (clamped to valid range).
#[inline]
pub fn rate_to_beats(rate_index: usize) -> f64 {
    RATE_DIVISIONS.get(rate_index).copied().unwrap_or(1.0)
}

// ============================================================================
// Re-exports
// ============================================================================

pub use clock::{MasterClock, MasterClockInputs, MasterClockParams, MasterClockOutputs};
pub use arpeggiator::{
    Arpeggiator, ArpeggiatorInputs, ArpeggiatorParams, ArpeggiatorOutputs,
    ArpMode,
};
pub use step_sequencer::{
    StepSequencer, StepSequencerInputs, StepSequencerParams, StepSequencerOutputs,
    SeqStep,
};
pub use drum_sequencer::{
    DrumSequencer, DrumSequencerInputs, DrumSequencerParams, DrumSequencerOutputs,
    DrumStep, DRUM_TRACKS, DRUM_STEPS, DRUM_TRACK_NAMES,
};
pub use euclidean::{
    EuclideanSequencer, EuclideanInputs, EuclideanParams,
    EUCLIDEAN_MAX_STEPS,
};
pub use mario::{Mario, MarioOutputs, MARIO_CHANNELS};
pub use midi_file_sequencer::{
    MidiFileSequencer, MidiFileSequencerInputs, MidiFileSequencerParams, MidiFileSequencerOutputs,
    MidiNote, MidiTrack, MIDI_TRACKS, MAX_NOTES_PER_TRACK,
};
pub use turing::{TuringMachine, TuringInputs, TuringParams};
pub use sid_player::{SidPlayer, SidPlayerParams, SidPlayerInputs, SidPlayerOutputs, SidHeader};
