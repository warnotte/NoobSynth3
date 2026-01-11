//! Audio effects for signal processing.
//!
//! This module provides a variety of audio effects:
//!
//! ## Delays
//! - [`Delay`] - Standard stereo delay with ping-pong mode
//! - [`TapeDelay`] - Tape-style delay with wow, flutter, and saturation
//! - [`GranularDelay`] - Granular delay with pitch-shifted grains
//!
//! ## Modulation
//! - [`Chorus`] - Classic chorus with LFO modulation
//! - [`Ensemble`] - Tri-chorus for rich string sounds
//! - [`Phaser`] - 4-stage phaser with feedback
//!
//! ## Reverbs
//! - [`Reverb`] - Freeverb-style algorithmic reverb
//! - [`SpringReverb`] - Spring reverb emulation with drive
//!
//! ## Distortion
//! - [`Distortion`] - Multi-mode distortion (soft, hard, foldback)
//! - [`Wavefolder`] - Wavefolder for complex harmonics
//!
//! ## Spectral
//! - [`Choir`] - Formant filter for vowel sounds
//! - [`Vocoder`] - 16-band vocoder
//! - [`RingMod`] - Ring modulator
//! - [`PitchShifter`] - Granular pitch shifter
//!
//! # Shared Components
//!
//! Some effects share internal components:
//! - [`CombFilter`] and [`AllpassFilter`] - Used by reverbs
//! - [`FormantFilter`] - Used by choir and vocoder

pub mod delay;
pub mod chorus;
pub mod tape_delay;
pub mod granular_delay;
pub mod ensemble;
pub mod reverb;
pub mod spring_reverb;
pub mod phaser;
pub mod distortion;
pub mod wavefolder;
pub mod ring_mod;
pub mod choir;
pub mod vocoder;
pub mod pitch_shifter;

// Re-export all public types
pub use delay::{Delay, DelayInputs, DelayParams};
pub use chorus::{Chorus, ChorusInputs, ChorusParams};
pub use tape_delay::{TapeDelay, TapeDelayInputs, TapeDelayParams};
pub use granular_delay::{GranularDelay, GranularDelayInputs, GranularDelayParams};
pub use ensemble::{Ensemble, EnsembleInputs, EnsembleParams};
pub use reverb::{AllpassFilter, CombFilter, Reverb, ReverbInputs, ReverbParams};
pub use spring_reverb::{SpringReverb, SpringReverbInputs, SpringReverbParams};
pub use phaser::{Phaser, PhaserInputs, PhaserParams};
pub use distortion::{Distortion, DistortionParams};
pub use wavefolder::{Wavefolder, WavefolderParams};
pub use ring_mod::{RingMod, RingModParams};
pub use choir::{Choir, ChoirInputs, ChoirParams, FormantFilter};
pub use vocoder::{Vocoder, VocoderInputs, VocoderParams};
pub use pitch_shifter::{PitchShifter, PitchShifterInputs, PitchShifterParams};
