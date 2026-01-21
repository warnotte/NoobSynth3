//! TR-808 Tom.
//!
//! Classic 808 tom with pitch envelope - usable as low, mid, or high tom.

use crate::common::Sample;

/// TR-808 Tom.
///
/// Classic 808-style tom with:
/// - Sine/triangle oscillator with pitch envelope
/// - Adjustable tune for low/mid/high tom
/// - Punchy attack with smooth decay
/// - Similar to kick but higher pitched and shorter
///
/// # Parameters
///
/// - `tune`: Base pitch in Hz (60-400 Hz, covers low to high tom range)
/// - `decay`: Decay time (0.05-1.0 seconds)
/// - `pitch`: Pitch envelope depth (0-1)
/// - `tone`: Brightness (0-1)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{Tom808, Tom808Params, Tom808Inputs};
///
/// let mut tom = Tom808::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// tom.process_block(
///     &mut output,
///     Tom808Inputs { trigger: Some(&[1.0]), accent: None },
///     Tom808Params {
///         tune: &[150.0],   // Mid tom
///         decay: &[0.3],
///         pitch: &[0.5],
///         tone: &[0.4],
///     },
/// );
/// ```
pub struct Tom808 {
    sample_rate: f32,
    phase: f32,
    pitch_env: f32,
    amp_env: f32,
    last_trig: f32,
    latched_accent: f32,
}

/// Parameters for Tom808.
pub struct Tom808Params<'a> {
    /// Base pitch in Hz (60-400 Hz)
    pub tune: &'a [Sample],
    /// Decay time (0.05-1.0 seconds)
    pub decay: &'a [Sample],
    /// Pitch envelope depth (0-1)
    pub pitch: &'a [Sample],
    /// Brightness (0-1)
    pub tone: &'a [Sample],
}

/// Input signals for Tom808.
pub struct Tom808Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Tom808 {
    /// Create a new 808 tom.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phase: 0.0,
            pitch_env: 0.0,
            amp_env: 0.0,
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
        inputs: Tom808Inputs,
        params: Tom808Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(60.0, 400.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.05, 1.0);
            let pitch_depth = params.pitch.get(i).copied().unwrap_or(params.pitch[0]).clamp(0.0, 1.0);
            let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);

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

            // Pitch envelope: fast decay for the "doop" sound
            let pitch_decay_rate = 0.0008;
            self.pitch_env *= 1.0 - pitch_decay_rate * (self.sample_rate / 48000.0);

            // Current frequency with pitch sweep
            let freq = tune * (1.0 + self.pitch_env * pitch_depth * 3.0);

            // Oscillator
            let dt = freq / self.sample_rate;
            self.phase += dt;
            if self.phase >= 1.0 {
                self.phase -= 1.0;
            }

            // Sine wave (fundamental)
            let sine = (self.phase * std::f32::consts::TAU).sin();

            // Triangle wave (adds body)
            let triangle = if self.phase < 0.5 {
                4.0 * self.phase - 1.0
            } else {
                3.0 - 4.0 * self.phase
            };

            // Mix based on tone (0 = warm sine, 1 = brighter triangle)
            let osc = sine * (1.0 - tone * 0.6) + triangle * tone * 0.6;

            // Amplitude envelope
            let amp_decay_rate = 1.0 / (decay * self.sample_rate);
            self.amp_env = (self.amp_env - amp_decay_rate * self.amp_env.sqrt()).max(0.0);

            let mut sample = osc * self.amp_env * 0.9;

            // Apply accent
            sample *= 0.7 + self.latched_accent * 0.5;

            // Soft clipping
            sample = (sample * 1.1).tanh();

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}
