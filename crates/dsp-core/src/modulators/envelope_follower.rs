//! Envelope Follower module.
//!
//! Detects the amplitude envelope of an audio signal
//! and outputs a control voltage.

use crate::common::{input_at, sample_at, Sample};

/// Envelope Follower.
///
/// Detects the amplitude of an input signal and outputs a smooth CV
/// that tracks the signal's loudness. Useful for:
/// - Ducking effects (sidechain compression)
/// - Auto-wah (envelope -> filter cutoff)
/// - Dynamics-driven modulation
///
/// # Parameters
///
/// - Attack: How quickly the envelope rises (seconds)
/// - Release: How quickly the envelope falls (seconds)
/// - Gain: Output scaling factor
///
/// # Example
///
/// ```ignore
/// use dsp_core::modulators::{EnvelopeFollower, EnvelopeFollowerParams, EnvelopeFollowerInputs};
///
/// let mut env = EnvelopeFollower::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// env.process_block(&mut output, inputs, params);
/// ```
pub struct EnvelopeFollower {
    sample_rate: f32,
    envelope: f32,
}

/// Input signals for EnvelopeFollower.
pub struct EnvelopeFollowerInputs<'a> {
    /// Audio input signal to follow
    pub input: Option<&'a [Sample]>,
}

/// Parameters for EnvelopeFollower.
pub struct EnvelopeFollowerParams<'a> {
    /// Attack time in seconds (how fast envelope rises)
    pub attack: &'a [Sample],
    /// Release time in seconds (how fast envelope falls)
    pub release: &'a [Sample],
    /// Output gain multiplier
    pub gain: &'a [Sample],
}

impl EnvelopeFollower {
    /// Create a new envelope follower.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            envelope: 0.0,
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
        inputs: EnvelopeFollowerInputs<'_>,
        params: EnvelopeFollowerParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        for i in 0..output.len() {
            let signal = input_at(inputs.input, i).abs();
            let attack = sample_at(params.attack, i, 0.01).max(0.0);
            let release = sample_at(params.release, i, 0.1).max(0.0);
            let gain = sample_at(params.gain, i, 1.0);

            let time = if signal >= self.envelope { attack } else { release };
            let coeff = if time <= 0.0001 {
                1.0
            } else {
                1.0 - (-1.0 / (time * self.sample_rate)).exp()
            };

            self.envelope += (signal - self.envelope) * coeff;
            output[i] = (self.envelope * gain).min(1.0);
        }
    }
}
