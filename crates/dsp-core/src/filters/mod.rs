//! Filter modules for audio processing.
//!
//! This module provides various filter types for shaping audio:
//!
//! - [`Vcf`]: Voltage Controlled Filter with SVF and Ladder models
//!
//! # Filter Models
//!
//! ## State Variable Filter (SVF)
//!
//! The SVF uses trapezoidal integration for excellent numerical stability
//! and supports multiple modes (lowpass, highpass, bandpass, notch) at
//! both 12dB and 24dB per octave slopes.
//!
//! ## Moog Ladder Filter
//!
//! A classic 4-pole cascade filter with rich resonance character.
//! Only supports lowpass mode but provides the iconic Moog sound.
//!
//! # Example
//!
//! ```ignore
//! use dsp_core::filters::{Vcf, VcfParams, VcfInputs};
//!
//! let mut vcf = Vcf::new(44100.0);
//! let mut output = [0.0f32; 128];
//!
//! // Create a lowpass filter with resonance
//! let params = VcfParams {
//!     cutoff: &[1000.0],
//!     resonance: &[0.6],
//!     // ... other params
//! };
//!
//! vcf.process_block(&mut output, inputs, params);
//! ```

pub mod vcf;

pub use vcf::{LadderState, SvfState, Vcf, VcfInputs, VcfParams};
