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
    click_env: f32, // fast noise transient (the "knock" of stick on rim)
    click_hp: f32,  // highpass state for the click
    noise_state: u32,
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
            click_env: 0.0,
            click_hp: 0.0,
            noise_state: 0xC0FF_EE11,
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
                self.click_env = 1.0;
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

            // Stick-on-rim "knock": a very short, bright, highpassed noise click layered on
            // top of the tonal body. A rimshot is mostly transient - two pure triangles alone
            // (weak, fast-rolling-off harmonics) read as a soft low tone, not a percussive knock.
            self.noise_state = self.noise_state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let white = (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0;
            let hp_coeff = 1.0 - (std::f32::consts::PI * 4500.0 / self.sample_rate).min(0.99);
            self.click_hp = hp_coeff * (self.click_hp + white);
            let click_hp_signal = white - self.click_hp;
            let click_decay_rate = 1.0 / (0.016 * self.sample_rate); // ~16ms - a knock, not a tick
            self.click_env = (self.click_env - click_decay_rate).max(0.0);

            let mut sample = (tri1 + tri2 * 0.5) * self.amp_env * 0.4
                + click_hp_signal * self.click_env * 0.8;

            // Apply accent (use latched value from trigger time)
            sample *= 0.7 + self.latched_accent * 0.5;

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rimshot_triggers_and_decays() {
        let mut rim = Rimshot909::new(48_000.0);
        let mut peak = 0.0f32;
        let mut tail = 0.0f32;
        for block in 0..20 {
            let mut out = [0.0f32; 128];
            let trig: [f32; 128] = if block == 0 {
                let mut t = [0.0f32; 128];
                t[0] = 1.0;
                t
            } else {
                [0.0f32; 128]
            };
            rim.process_block(
                &mut out,
                Rimshot909Inputs { trigger: Some(&trig), accent: Some(&[1.0]) },
                Rimshot909Params { tune: &[400.0] },
            );
            for &s in &out {
                assert!(s.is_finite(), "non-finite sample");
                let a = s.abs();
                if block < 3 {
                    peak = peak.max(a);
                }
                if block > 15 {
                    tail = tail.max(a);
                }
            }
        }
        assert!(peak > 1e-3, "rimshot should produce audible output (peak {peak})");
        assert!(tail < peak, "rimshot should decay (tail {tail} >= peak {peak})");
    }
}
