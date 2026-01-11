//! TR-909 Snare Drum.
//!
//! Analog-modeled snare with tone oscillator and filtered noise.

use crate::common::Sample;

/// TR-909 Snare Drum.
///
/// Classic 909-style snare drum with:
/// - Dual detuned tone oscillators (fundamental + fifth)
/// - Filtered noise for snare wires
/// - Adjustable tone/noise mix
/// - Snappy control for high-frequency response
///
/// # Parameters
///
/// - `tune`: Tone pitch (100-400 Hz)
/// - `tone`: Tone vs noise mix (0-1)
/// - `snappy`: Noise brightness/snap (0-1)
/// - `decay`: Decay time (0.05-1.0 seconds)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{Snare909, Snare909Params, Snare909Inputs};
///
/// let mut snare = Snare909::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// snare.process_block(
///     &mut output,
///     Snare909Inputs { trigger: Some(&[1.0]), accent: None },
///     Snare909Params {
///         tune: &[200.0],
///         tone: &[0.5],
///         snappy: &[0.5],
///         decay: &[0.3],
///     },
/// );
/// ```
pub struct Snare909 {
    sample_rate: f32,
    phase: f32,
    noise_state: u32,
    amp_env: f32,
    noise_env: f32,
    last_trig: f32,
    latched_accent: f32,
}

/// Parameters for Snare909.
pub struct Snare909Params<'a> {
    /// Tone pitch (100-400 Hz)
    pub tune: &'a [Sample],
    /// Tone vs noise mix (0-1)
    pub tone: &'a [Sample],
    /// Noise brightness/snap (0-1)
    pub snappy: &'a [Sample],
    /// Decay time (0.05-1.0 seconds)
    pub decay: &'a [Sample],
}

/// Input signals for Snare909.
pub struct Snare909Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Snare909 {
    /// Create a new 909 snare drum.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phase: 0.0,
            noise_state: 0x12345678,
            amp_env: 0.0,
            noise_env: 0.0,
            last_trig: 0.0,
            latched_accent: 0.5,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn white_noise(&mut self) -> f32 {
        // Simple LFSR noise
        self.noise_state ^= self.noise_state << 13;
        self.noise_state ^= self.noise_state >> 17;
        self.noise_state ^= self.noise_state << 5;
        (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: Snare909Inputs,
        params: Snare909Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(100.0, 400.0);
            let tone_mix = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);
            let snappy = params.snappy.get(i).copied().unwrap_or(params.snappy[0]).clamp(0.0, 1.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.05, 1.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            // Trigger detection
            if trig > 0.5 && self.last_trig <= 0.5 {
                self.amp_env = 1.0;
                self.noise_env = 1.0;
                self.phase = 0.0;
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Tone oscillator (two detuned oscillators for thickness)
            let dt1 = tune / self.sample_rate;
            let _dt2 = (tune * 1.5) / self.sample_rate; // Fifth harmonic (reserved)
            self.phase += dt1;
            if self.phase >= 1.0 {
                self.phase -= 1.0;
            }
            let tone1 = (self.phase * std::f32::consts::TAU).sin();
            let tone2 = (self.phase * 1.5 * std::f32::consts::TAU).sin() * 0.5;
            let tone_signal = (tone1 + tone2) * 0.6;

            // Noise with envelope (decays faster than tone)
            let noise_decay_rate = 1.0 / (decay * 0.4 * self.sample_rate);
            self.noise_env = (self.noise_env - noise_decay_rate).max(0.0);
            let noise = self.white_noise();

            // Snappy control affects noise high-pass (simple approximation)
            let noise_signal = noise * self.noise_env * (0.3 + snappy * 0.7);

            // Amplitude envelope for tone
            let amp_decay_rate = 1.0 / (decay * self.sample_rate);
            self.amp_env = (self.amp_env - amp_decay_rate).max(0.0);

            // Mix tone and noise
            let tone_amount = tone_signal * self.amp_env * tone_mix;
            let noise_amount = noise_signal * (1.0 - tone_mix * 0.3);
            let mut sample = (tone_amount + noise_amount) * 0.7;

            // Apply accent (latched at trigger)
            sample *= 0.7 + self.latched_accent * 0.5;

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}
