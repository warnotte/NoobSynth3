//! TR-909 Kick Drum.
//!
//! Analog-modeled bass drum with pitch envelope and click transient.

use crate::common::Sample;

/// TR-909 Kick Drum.
///
/// Classic 909-style bass drum with:
/// - Sine oscillator with pitch envelope (gives the "thump")
/// - Click transient for punch (filtered noise burst)
/// - Saturation/drive
/// - Accent support
///
/// # Parameters
///
/// - `tune`: Base pitch in Hz (typically 40-80 Hz)
/// - `attack`: Click/punch amount (0-1, adds transient)
/// - `decay`: Amplitude decay time (0.1-2.0 seconds)
/// - `drive`: Saturation amount (0-1)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{Kick909, Kick909Params, Kick909Inputs};
///
/// let mut kick = Kick909::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// kick.process_block(
///     &mut output,
///     Kick909Inputs { trigger: Some(&[1.0]), accent: None },
///     Kick909Params {
///         tune: &[55.0],
///         attack: &[0.5],
///         decay: &[0.5],
///         drive: &[0.0],
///     },
/// );
/// ```
pub struct Kick909 {
    sample_rate: f32,
    phase: f32,
    pitch_env: f32,
    amp_env: f32,
    click_env: f32,
    triggered: bool,
    last_trig: f32,
    noise_state: u32,  // For click noise generation
    latched_accent: f32,  // Accent value captured at trigger
}

/// Parameters for Kick909.
pub struct Kick909Params<'a> {
    /// Base pitch in Hz (typically 40-80)
    pub tune: &'a [Sample],
    /// Click/punch amount (0-1, adds transient)
    pub attack: &'a [Sample],
    /// Amplitude decay time (0.1-2.0 seconds)
    pub decay: &'a [Sample],
    /// Saturation amount (0-1)
    pub drive: &'a [Sample],
}

/// Input signals for Kick909.
pub struct Kick909Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Kick909 {
    /// Create a new 909 kick drum.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phase: 0.0,
            pitch_env: 0.0,
            amp_env: 0.0,
            click_env: 0.0,
            triggered: false,
            last_trig: 0.0,
            noise_state: 0x12345678,
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
        inputs: Kick909Inputs,
        params: Kick909Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(30.0, 120.0);
            let attack = params.attack.get(i).copied().unwrap_or(params.attack[0]).clamp(0.0, 1.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.1, 2.0);
            let drive = params.drive.get(i).copied().unwrap_or(params.drive[0]).clamp(0.0, 1.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            // Trigger detection (rising edge)
            if trig > 0.5 && self.last_trig <= 0.5 {
                self.triggered = true;
                self.pitch_env = 1.0;
                self.amp_env = 1.0;
                self.click_env = 1.0;
                self.phase = 0.0;
                // Latch accent at trigger time
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Pitch envelope: fast exponential decay (gives the "thump")
            // Higher pitch at start, drops to base tune
            let pitch_decay_rate = 0.0003; // Very fast
            self.pitch_env *= 1.0 - pitch_decay_rate * (self.sample_rate / 48000.0);

            // Current frequency: base + pitch envelope sweep (up to +3 octaves at trigger)
            let freq = tune * (1.0 + self.pitch_env * 8.0);

            // Oscillator (sine wave)
            let dt = freq / self.sample_rate;
            self.phase += dt;
            if self.phase >= 1.0 {
                self.phase -= 1.0;
            }
            let sine = (self.phase * std::f32::consts::TAU).sin();

            // Click (short noise burst for punch/attack)
            // Use proper noise generator for better transient
            self.noise_state = self.noise_state.wrapping_mul(1664525).wrapping_add(1013904223);
            let noise = (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0;

            // Click envelope decays quickly (about 5-10ms)
            let click_decay = 1.0 - 0.003 * (self.sample_rate / 48000.0);
            self.click_env *= click_decay;

            // Mix noise with high-frequency component for punch
            let click = noise * self.click_env * attack * 0.8;

            // Amplitude envelope
            let amp_decay_rate = 1.0 / (decay * self.sample_rate);
            self.amp_env = (self.amp_env - amp_decay_rate).max(0.0);

            // Mix sine + click
            let mut sample = (sine + click) * self.amp_env;

            // Apply accent (louder + more punch) - use latched value from trigger
            sample *= 0.7 + self.latched_accent * 0.6;

            // Drive/saturation
            if drive > 0.0 {
                let gain = 1.0 + drive * 4.0;
                sample = (sample * gain).tanh();
            }

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}
