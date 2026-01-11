//! TR-909 Rimshot.
//!
//! Short metallic ping.

use crate::common::Sample;

/// TR-909 Rimshot.
///
/// Short metallic ping with:
/// - Two detuned triangle oscillators at inharmonic ratio
/// - Very fast decay for sharp transient
///
/// # Parameters
///
/// - `tune`: Pitch (200-600 Hz)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{Rimshot909, Rimshot909Params, Rimshot909Inputs};
///
/// let mut rimshot = Rimshot909::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// rimshot.process_block(
///     &mut output,
///     Rimshot909Inputs { trigger: Some(&[1.0]), accent: None },
///     Rimshot909Params { tune: &[400.0] },
/// );
/// ```
pub struct Rimshot909 {
    sample_rate: f32,
    phases: [f32; 2],
    amp_env: f32,
    last_trig: f32,
    latched_accent: f32,
}

/// Parameters for Rimshot909.
pub struct Rimshot909Params<'a> {
    /// Pitch (200-600 Hz)
    pub tune: &'a [Sample],
}

/// Input signals for Rimshot909.
pub struct Rimshot909Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Rimshot909 {
    /// Create a new 909 rimshot.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phases: [0.0; 2],
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
        inputs: Rimshot909Inputs,
        params: Rimshot909Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(200.0, 600.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            // Trigger detection
            if trig > 0.5 && self.last_trig <= 0.5 {
                self.amp_env = 1.0;
                self.phases = [0.0; 2];
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Two detuned triangle waves for metallic character
            let freq1 = tune;
            let freq2 = tune * 1.47; // Inharmonic ratio

            let dt1 = freq1 / self.sample_rate;
            let dt2 = freq2 / self.sample_rate;

            self.phases[0] += dt1;
            self.phases[1] += dt2;
            if self.phases[0] >= 1.0 { self.phases[0] -= 1.0; }
            if self.phases[1] >= 1.0 { self.phases[1] -= 1.0; }

            // Triangle waves
            let tri1 = 4.0 * (self.phases[0] - (self.phases[0] + 0.5).floor()).abs() - 1.0;
            let tri2 = 4.0 * (self.phases[1] - (self.phases[1] + 0.5).floor()).abs() - 1.0;

            // Very fast decay for sharp transient
            let amp_decay_rate = 1.0 / (0.02 * self.sample_rate); // 20ms
            self.amp_env = (self.amp_env - amp_decay_rate).max(0.0);

            let mut sample = (tri1 + tri2 * 0.5) * self.amp_env * 0.6;

            // Apply accent (use latched value from trigger time)
            sample *= 0.7 + self.latched_accent * 0.5;

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}
