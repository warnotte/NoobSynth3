//! TR-909 Tom.
//!
//! Sine wave tom with pitch envelope and slight noise.

use crate::common::Sample;

/// TR-909 Tom (Low/Mid/High).
///
/// Classic 909-style tom with:
/// - Sine wave oscillator
/// - Pitch envelope for "boing" character
/// - Slight noise burst for attack
///
/// The tune parameter allows the same module to be used
/// for low, mid, or high tom sounds.
///
/// # Parameters
///
/// - `tune`: Base pitch (60-300 Hz)
/// - `decay`: Decay time (0.1-1.5 seconds)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{Tom909, Tom909Params, Tom909Inputs};
///
/// let mut tom = Tom909::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// // Low tom
/// tom.process_block(
///     &mut output,
///     Tom909Inputs { trigger: Some(&[1.0]), accent: None },
///     Tom909Params {
///         tune: &[80.0],
///         decay: &[0.5],
///     },
/// );
/// ```
pub struct Tom909 {
    sample_rate: f32,
    phase: f32,
    pitch_env: f32,
    amp_env: f32,
    noise_state: u32,
    last_trig: f32,
    latched_accent: f32,
}

/// Parameters for Tom909.
pub struct Tom909Params<'a> {
    /// Base pitch (60-300 Hz)
    pub tune: &'a [Sample],
    /// Decay time (0.1-1.5 seconds)
    pub decay: &'a [Sample],
}

/// Input signals for Tom909.
pub struct Tom909Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Tom909 {
    /// Create a new 909 tom.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phase: 0.0,
            pitch_env: 0.0,
            amp_env: 0.0,
            noise_state: 0x87654321,
            last_trig: 0.0,
            latched_accent: 0.5,
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
        inputs: Tom909Inputs,
        params: Tom909Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(60.0, 300.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.1, 1.5);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            // Trigger detection
            if trig > 0.5 && self.last_trig <= 0.5 {
                self.pitch_env = 1.0;
                self.amp_env = 1.0;
                self.phase = 0.0;
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Pitch envelope (subtle drop)
            let pitch_decay = 0.001;
            self.pitch_env *= 1.0 - pitch_decay * (self.sample_rate / 48000.0);

            let freq = tune * (1.0 + self.pitch_env * 1.5);
            let dt = freq / self.sample_rate;
            self.phase += dt;
            if self.phase >= 1.0 {
                self.phase -= 1.0;
            }
            let sine = (self.phase * std::f32::consts::TAU).sin();

            // Slight noise for attack
            self.noise_state ^= self.noise_state << 13;
            self.noise_state ^= self.noise_state >> 17;
            self.noise_state ^= self.noise_state << 5;
            let noise = (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0;
            let noise_env = (self.amp_env * 2.0 - 1.0).max(0.0); // Quick noise burst

            // Amplitude envelope
            let amp_decay_rate = 1.0 / (decay * self.sample_rate);
            self.amp_env = (self.amp_env - amp_decay_rate).max(0.0);

            let mut sample = (sine + noise * noise_env * 0.1) * self.amp_env * 0.8;

            // Apply accent (latched at trigger)
            sample *= 0.7 + self.latched_accent * 0.5;

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}
