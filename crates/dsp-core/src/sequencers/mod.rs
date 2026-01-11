//! Sequencer modules.
//!
//! This module provides various sequencer implementations:
//!
//! ## Clock
//! - [`MasterClock`] - Global transport/clock generator
//!
//! ## Note Sequencers
//! - [`Arpeggiator`] - Arpeggiator with multiple modes and patterns
//! - [`StepSequencer`] - 16-step CV/gate sequencer with slide
//!
//! ## Rhythm Sequencers
//! - [`DrumSequencer`] - 8-track, 16-step drum pattern sequencer
//! - [`EuclideanSequencer`] - Euclidean rhythm generator
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

pub use clock::{MasterClock, MasterClockInputs, MasterClockParams, MasterClockOutputs};
pub use arpeggiator::{
    Arpeggiator, ArpeggiatorInputs, ArpeggiatorParams, ArpeggiatorOutputs,
    ArpMode, RATE_DIVISIONS,
};
pub use step_sequencer::{
    StepSequencer, StepSequencerInputs, StepSequencerParams, StepSequencerOutputs,
    SeqStep, SEQ_RATE_DIVISIONS,
};
pub use drum_sequencer::{
    DrumSequencer, DrumSequencerInputs, DrumSequencerParams, DrumSequencerOutputs,
    DrumStep, DRUM_TRACKS, DRUM_STEPS, DRUM_TRACK_NAMES,
};
pub use euclidean::{
    EuclideanSequencer, EuclideanInputs, EuclideanParams,
    EUCLIDEAN_MAX_STEPS,
};
