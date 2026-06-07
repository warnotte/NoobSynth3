//! TR-909 Crash Cymbal.
//!
//! Bright, wide, explosive metallic wash. Synthesized (the real 909 used a 6-bit sample),
//! but with a *dense additive* engine rather than a few square oscillators: 32 inharmonic
//! SINE partials (no aliasing), each with its own decay rate so the spectrum shimmers and
//! darkens naturally as it rings out, plus a high-passed noise "sizzle" and a bright attack
//! transient. An output high-pass keeps it cymbal-bright (no low thump).

use crate::common::Sample;

const N: usize = 32; // inharmonic sine partials

/// TR-909 Crash Cymbal (dense additive synthesis).
///
/// # Parameters
/// - `tune`: Base frequency multiplier (0.5-2.0)
/// - `decay`: Tail decay time in seconds (0.3-4.0)
/// - `tone`: Brightness / sizzle (0-1)
pub struct Crash909 {
    sample_rate: f32,
    ratios: [f32; N],    // inharmonic frequency ratios (precomputed)
    amps: [f32; N],      // per-partial amplitude (precomputed, normalized)
    decay_mul: [f32; N], // per-partial decay rate multiplier (precomputed)
    phases: [f32; N],    // running phase per partial
    env: [f32; N],       // per-partial decay envelope
    noise_state: u32,
    noise_lp: f32,   // one-pole LP state (for high-passing the noise)
    noise_env: f32,  // sizzle envelope
    attack_env: f32, // fast bright transient
    hp_state: f32,   // output high-pass state
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
    const BASE_FREQ: f32 = 320.0;

    /// Create a new 909 crash cymbal.
    pub fn new(sample_rate: f32) -> Self {
        let (ratios, amps, decay_mul) = Self::build_partials();
        Self {
            sample_rate: sample_rate.max(1.0),
            ratios,
            amps,
            decay_mul,
            phases: [0.0; N],
            env: [0.0; N],
            noise_state: 0x1234_5678,
            noise_lp: 0.0,
            noise_env: 0.0,
            attack_env: 0.0,
            hp_state: 0.0,
            last_trig: 0.0,
            latched_accent: 0.5,
        }
    }

    /// Precompute the inharmonic partial bank (deterministic, so every instance is identical).
    fn build_partials() -> ([f32; N], [f32; N], [f32; N]) {
        let mut ratios = [0.0f32; N];
        let mut amps = [0.0f32; N];
        let mut decay_mul = [0.0f32; N];
        let mut seed: u32 = 0x9E37_79B9;
        let mut rng = || {
            seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            (seed >> 8) as f32 / 16_777_216.0 // 0..1
        };
        // top ratio ~40 → ~12.8 kHz at BASE 320 / tune 1.0
        let f_hi = 40.0f32;
        let mut amp_sum = 0.0f32;
        for j in 0..N {
            let t = j as f32 / (N - 1) as f32;
            let base_ratio = f_hi.powf(t); // log-spaced 1..40
            let jitter = 1.0 + (rng() - 0.5) * 0.35; // ±17% → inharmonic
            ratios[j] = base_ratio * jitter;
            amps[j] = 0.55 + 0.45 * t; // near-flat, gentle high tilt for brightness
            amp_sum += amps[j];
            decay_mul[j] = 0.5 + rng() * 1.1; // per-partial decay spread → shimmer
        }
        for a in amps.iter_mut() {
            *a /= amp_sum;
        }
        (ratios, amps, decay_mul)
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
        let sr = self.sample_rate;
        let nyq = sr * 0.47;
        let tau = std::f32::consts::TAU;

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(0.5, 2.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.3, 4.0);
            let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            if trig > 0.5 && self.last_trig <= 0.5 {
                for j in 0..N {
                    self.env[j] = self.amps[j];
                }
                self.noise_env = 1.0;
                self.attack_env = 1.0;
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Dense inharmonic sine partials, each on its own decay → shimmer.
            let base = Self::BASE_FREQ * tune;
            let base_rate = 1.0 / (decay * sr);
            let mut partials = 0.0_f32;
            for j in 0..N {
                let freq = base * self.ratios[j];
                self.phases[j] += freq / sr;
                if self.phases[j] >= 1.0 {
                    self.phases[j] -= 1.0;
                }
                if freq < nyq {
                    partials += (self.phases[j] * tau).sin() * self.env[j];
                }
                self.env[j] = (self.env[j] - base_rate * self.decay_mul[j]).max(0.0);
            }

            // Noise sizzle: white → one-pole high-pass → its own decay.
            self.noise_state = self.noise_state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let white = (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0;
            self.noise_lp += 0.35 * (white - self.noise_lp);
            let noise_hp = white - self.noise_lp;
            let noise_rate = 1.0 / ((decay * 0.5).max(0.05) * sr);
            self.noise_env = (self.noise_env - noise_rate).max(0.0);

            // Bright attack transient (~50 ms).
            let attack_rate = 1.0 / (0.05 * sr);
            self.attack_env = (self.attack_env - attack_rate).max(0.0);

            let bright = 0.5 + tone * 0.5;
            let mut sample = partials * 2.6
                + noise_hp * self.noise_env * (0.18 + tone * 0.28)
                + (partials * 2.0 + noise_hp) * self.attack_env * 0.28 * bright;

            // Output high-pass (one-pole) to keep it cymbal-bright (remove low thump).
            let hp_cut = 700.0 + tone * 1500.0;
            let hp_a = (tau * hp_cut / sr).min(0.9);
            self.hp_state += hp_a * (sample - self.hp_state);
            sample -= self.hp_state;

            // Accent (latched at trigger)
            sample *= 0.7 + self.latched_accent * 0.4;

            output[i] = (sample * 0.42).clamp(-1.0, 1.0);
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
                if block < 40 && a > peak {
                    peak = a;
                }
                if block > 500 {
                    tail = tail.max(a);
                }
            }
        }
        assert!(peak > 1e-3, "crash should produce audible output (peak {peak})");
        assert!(tail < peak, "crash should decay (tail {tail} >= peak {peak})");
    }
}
