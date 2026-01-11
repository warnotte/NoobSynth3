//! Ring modulator effect.
//!
//! Multiplies the input signal with a carrier signal,
//! creating sum and difference frequencies.

use crate::common::{sample_at, input_at, Sample};

/// Ring modulator effect.
///
/// A simple ring modulator that multiplies two signals together.
/// When used with a sine wave carrier, creates inharmonic sidebands.
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{RingMod, RingModParams};
///
/// let mut output = [0.0f32; 128];
/// let carrier = [0.5f32; 128];  // e.g., sine wave
/// let input = [0.3f32; 128];    // audio input
///
/// RingMod::process_block(
///     &mut output,
///     Some(&carrier),
///     Some(&input),
///     RingModParams { level: &[1.0] },
/// );
/// ```
pub struct RingMod;

/// Parameters for RingMod.
pub struct RingModParams<'a> {
    /// Output level/mix (0-1)
    pub level: &'a [Sample],
}

impl RingMod {
    /// Process a block of samples.
    ///
    /// Multiplies input_a (carrier) with input_b (modulator) and scales by level.
    pub fn process_block(
        output: &mut [Sample],
        input_a: Option<&[Sample]>,
        input_b: Option<&[Sample]>,
        params: RingModParams,
    ) {
        if output.is_empty() {
            return;
        }

        for i in 0..output.len() {
            let carrier = input_at(input_a, i);
            let modulator = input_at(input_b, i);
            let level = sample_at(params.level, i, 1.0);
            output[i] = carrier * modulator * level;
        }
    }
}
