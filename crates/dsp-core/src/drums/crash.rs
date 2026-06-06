//! TR-909 Crash Cymbal.
//!
//! Bright, wide, explosive metallic wash. Synthesized (the real 909 used a 6-bit sample):
//! 8 inharmonic square partials + white noise, a bright resonant bandpass, and a two-stage
//! envelope (sharp bright attack burst over a long noisy decay tail).

use crate::common::Sample;

/// TR-909 Crash Cymbal (synthesized).
///
/// # Parameters
/// - `tune`: Base frequency multiplier (0.5-2.0)
/// - `decay`: Tail decay time in seconds (0.3-4.0)
/// - `tone`: Brightness / filter openness (0-1)
pub struct Crash909 {
    sample_rate: f32,
    phases: [f32; 8],
    filter_state: [f32; 2],
    noise_state: u32,
    amp_env: f32,    // long decay tail
    attack_env: f32, // fast bright transient
    last_trig: f32,
    latched_accent: f32,
}

/// Parameters for Crash909.
pub struct Crash909Params<'a> {
    /// Base frequency multiplier (0.5-2.0)
    pub tune: &'a [Sample],
    /// Tail decay time in seconds (0.3-4.0)
    pub decay: &'a [Sample],
    /// Brightness (0-1)
    pub tone: &'a [Sample],
}

/// Input signals for Crash909.
pub struct Crash909Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Crash909 {
    // Dense, spread inharmonic ratios for a broad metallic wash (brighter/denser than the hat).
    const RATIOS: [f32; 8] = [1.0, 1.34, 1.66, 2.04, 2.53, 2.99, 3.47, 4.03];
    const BASE_FREQ: f32 = 280.0;

    /// Create a new 909 crash cymbal.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phases: [0.0; 8],
            filter_state: [0.0; 2],
            noise_state: 0x9E3779B9,
            amp_env: 0.0,
            attack_env: 0.0,
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
        inputs: Crash909Inputs,
        params: Crash909Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(0.5, 2.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.3, 4.0);
            let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            if trig > 0.5 && self.last_trig <= 0.5 {
                self.amp_env = 1.0;
                self.attack_env = 1.0;
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Metallic source: 8 inharmonic square partials
            let base_freq = Self::BASE_FREQ * tune;
            let mut metallic = 0.0_f32;
            for (j, phase) in self.phases.iter_mut().enumerate() {
                let freq = base_freq * Self::RATIOS[j];
                let dt = freq / self.sample_rate;
                *phase += dt;
                if *phase >= 1.0 {
                    *phase -= 1.0;
                }
                metallic += if *phase < 0.5 { 1.0 } else { -1.0 };
            }
            metallic /= 8.0;

            // White noise for the wash density
            self.noise_state = self.noise_state.wrapping_mul(1664525).wrapping_add(1013904223);
            let noise = (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0;

            // Source = metallic + noise wash
            let source = metallic * 0.6 + noise * 0.4;

            // Bright resonant bandpass (higher than the hat for a wide crash)
            let cutoff = 6000.0 + tone * 8000.0; // 6-14 kHz
            let f = (std::f32::consts::PI * cutoff / self.sample_rate).tan();
            let q = 0.7 + tone * 1.0;
            let k = 1.0 / q;
            let norm = 1.0 / (1.0 + k * f + f * f);
            self.filter_state[0] += f * (source - self.filter_state[0] - self.filter_state[1] * k);
            self.filter_state[1] += f * self.filter_state[0];
            let bandpass = self.filter_state[0] * f * norm * 2.0;

            // Two-stage envelope: fast bright attack burst + long decay tail
            let attack_rate = 1.0 / (0.04 * self.sample_rate); // ~40ms bright burst
            self.attack_env = (self.attack_env - attack_rate).max(0.0);
            let amp_rate = 1.0 / (decay * self.sample_rate);
            self.amp_env = (self.amp_env - amp_rate).max(0.0);

            // Mix: the long bandpass'd wash + a brighter raw burst at the attack
            let mut sample = (bandpass + source * self.attack_env * 0.5) * self.amp_env * 0.7;

            // Accent (latched at trigger)
            sample *= 0.7 + self.latched_accent * 0.4;

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crash_triggers_and_decays() {
        let mut crash = Crash909::new(48_000.0);
        let mut peak = 0.0f32;
        let mut tail = 0.0f32;
        // Trigger on the first sample, then render ~1.5s and confirm it sounds + decays.
        for block in 0..560 {
            let mut out = [0.0f32; 128];
            let trig: [f32; 128] = if block == 0 {
                let mut t = [0.0f32; 128];
                t[0] = 1.0;
                t
            } else {
                [0.0f32; 128]
            };
            crash.process_block(
                &mut out,
                Crash909Inputs { trigger: Some(&trig), accent: Some(&[1.0]) },
                Crash909Params { tune: &[1.0], decay: &[1.5], tone: &[0.6] },
            );
            for &s in &out {
                assert!(s.is_finite(), "non-finite sample");
                let a = s.abs();
                if block < 40 && a > peak { peak = a; } // early peak
                if block > 500 { tail = tail.max(a); }   // late tail
            }
        }
        assert!(peak > 1e-3, "crash should produce audible output (peak {peak})");
        assert!(tail < peak, "crash should decay (tail {tail} >= peak {peak})");
    }
}
