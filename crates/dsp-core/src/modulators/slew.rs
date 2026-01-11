//! Slew Limiter / Portamento module.
//!
//! Smooths out abrupt changes in a signal by limiting
//! the rate of change (slew rate).

use crate::common::{input_at, sample_at, Sample};

/// Slew Limiter (Portamento/Glide).
///
/// Limits how fast a signal can change, creating smooth transitions.
/// Useful for:
/// - Portamento (pitch glide between notes)
/// - Smoothing control signals
/// - Envelope following
///
/// # Parameters
///
/// - Rise: Time constant for rising signals
/// - Fall: Time constant for falling signals
///
/// When rise != fall, creates asymmetric response useful for
/// attack/release type behavior.
///
/// # Example
///
/// ```ignore
/// use dsp_core::modulators::{SlewLimiter, SlewParams, SlewInputs};
///
/// let mut slew = SlewLimiter::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// slew.process_block(&mut output, inputs, params);
/// ```
pub struct SlewLimiter {
    sample_rate: f32,
    value: f32,
}

/// Input signals for SlewLimiter.
pub struct SlewInputs<'a> {
    /// Input signal to smooth
    pub input: Option<&'a [Sample]>,
}

/// Parameters for SlewLimiter.
pub struct SlewParams<'a> {
    /// Rise time in seconds (0-10)
    pub rise: &'a [Sample],
    /// Fall time in seconds (0-10)
    pub fall: &'a [Sample],
}

impl SlewLimiter {
    /// Create a new slew limiter.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            value: 0.0,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: SlewInputs<'_>,
        params: SlewParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        for i in 0..output.len() {
            let target = input_at(inputs.input, i);
            let rise = sample_at(params.rise, i, 0.05).max(0.0);
            let fall = sample_at(params.fall, i, 0.05).max(0.0);

            // Select rise or fall time based on direction
            let time = if target >= self.value { rise } else { fall };

            // Calculate smoothing coefficient
            let coeff = if time <= 0.0001 {
                1.0 // Instant change for very short times
            } else {
                1.0 - (-1.0 / (time * self.sample_rate)).exp()
            };

            // Apply exponential smoothing
            self.value += (target - self.value) * coeff;
            output[i] = self.value;
        }
    }
}
