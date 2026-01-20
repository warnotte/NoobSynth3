//! Modulation sources and utilities.
//!
//! This module provides control-rate signal generators and processors:
//!
//! ## Generators
//! - [`Lfo`] - Low Frequency Oscillator with multiple waveforms
//! - [`Adsr`] - Attack-Decay-Sustain-Release envelope
//!
//! ## Processors
//! - [`SampleHold`] - Sample and hold with random mode
//! - [`SlewLimiter`] - Slew rate limiter / portamento
//! - [`Quantizer`] - Pitch quantizer with multiple scales
//!
//! # Typical Usage
//!
//! Modulators generate or process control signals that modulate
//! audio parameters like:
//! - Filter cutoff frequency
//! - Oscillator pitch
//! - Amplitude (tremolo/VCA)
//! - Effect parameters
//!
//! # Example
//!
//! ```ignore
//! use dsp_core::modulators::{Lfo, LfoParams, LfoInputs};
//!
//! let mut lfo = Lfo::new(44100.0);
//! let mut mod_signal = [0.0f32; 128];
//!
//! // Generate sine LFO at 2Hz
//! lfo.process_block(&mut mod_signal, inputs, params);
//! // Use mod_signal to modulate filter cutoff, etc.
//! ```

pub mod lfo;
pub mod adsr;
pub mod sample_hold;
pub mod slew;
pub mod quantizer;
pub mod chaos;

pub use lfo::{Lfo, LfoInputs, LfoParams};
pub use adsr::{Adsr, AdsrInputs, AdsrParams};
pub use sample_hold::{SampleHold, SampleHoldInputs, SampleHoldParams};
pub use slew::{SlewLimiter, SlewInputs, SlewParams};
pub use quantizer::{Quantizer, QuantizerInputs, QuantizerParams};
pub use chaos::{Chaos, ChaosInputs, ChaosParams};
