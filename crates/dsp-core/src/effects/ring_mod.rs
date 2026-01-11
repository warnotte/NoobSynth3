//! Ring modulator effect.
//!
//! Multiplies the input signal with a carrier signal,
//! creating sum and difference frequencies.

use crate::common::Sample;

/// Ring modulator effect.
///
/// A simple ring modulator that multiplies two signals together.
/// When used with a sine wave carrier, creates inharmonic sidebands.
///
/// Note: This is a minimal struct - the actual ring modulation
/// happens in dsp-graph where the carrier signal is available.
///
/// # Example
///
/// ```ignore
/// // Ring modulation is typically: output = carrier * modulator * level
/// let output = carrier_sample * input_sample * level;
/// ```
pub struct RingMod;

/// Parameters for RingMod.
pub struct RingModParams<'a> {
    /// Output level/mix (0-1)
    pub level: &'a [Sample],
}
