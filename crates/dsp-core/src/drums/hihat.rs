//! TR-909 Hi-Hat.
//!
//! Metallic hi-hat. Originally 6 square-wave oscillators through a single resonant filter;
//! rebuilt (see `crash.rs`/`ride.rs` for the same technique) as a *dense additive* engine -
//! inharmonic SINE partials spread log-scale up into the bright metallic register, plus a
//! high-passed noise sizzle for "air", plus an output high-pass so it never reads as dull.
//! The old 6-oscillator version measured centroid ~2.1-2.4 kHz (duller than this project's
//! own 808 hat, and than a real 909 hat) because 6 carriers capped at ~2.7x a few-hundred-Hz
//! base don't leave much real energy up where a resonant filter alone can find it — filtering
//! harder just removes more signal, it doesn't manufacture brightness that isn't there.

use crate::common::Sample;

const N: usize = 20; // inharmonic sine partials (fewer/tighter than crash's 32 - a hat, not a wash)

/// TR-909 Hi-Hat (dense additive synthesis).
///
/// # Parameters
///
/// - `tune`: Base frequency multiplier (0.5-2.0)
/// - `decay`: Decay time (0.02-1.5 seconds)
/// - `tone`: Filter brightness (0-1)
/// - `open`: Open/closed mode (0 = closed, 1 = open)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{HiHat909, HiHat909Params, HiHat909Inputs};
///
/// let mut hihat = HiHat909::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// // Closed hi-hat
/// hihat.process_block(
///     &mut output,
///     HiHat909Inputs { trigger: Some(&[1.0]), accent: None },
///     HiHat909Params {
///         tune: &[1.0],
///         decay: &[0.1],
///         tone: &[0.5],
///         open: &[0.0], // closed
///     },
/// );
/// ```
pub struct HiHat909 {
    sample_rate: f32,
    ratios: [f32; N],
    amps: [f32; N],
    decay_mul: [f32; N],
    phases: [f32; N],
    env: [f32; N],
    noise_state: u32,
    noise_hp: f32,
    noise_env: f32,
    hp_state: f32, // output high-pass state
    last_trig: f32,
    is_open: bool,
    latched_accent: f32,
}

/// Parameters for HiHat909.
pub struct HiHat909Params<'a> {
    /// Base frequency multiplier (0.5-2.0)
    pub tune: &'a [Sample],
    /// Decay time (0.02-1.5 seconds)
    pub decay: &'a [Sample],
    /// Filter brightness (0-1)
    pub tone: &'a [Sample],
    /// Open/closed mode (0 = closed, 1 = open)
    pub open: &'a [Sample],
}

/// Input signals for HiHat909.
pub struct HiHat909Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl HiHat909 {
    const BASE_FREQ: f32 = 400.0;

    /// Create a new 909 hi-hat.
    pub fn new(sample_rate: f32) -> Self {
        let (ratios, amps, decay_mul) = Self::build_partials();
        Self {
            sample_rate: sample_rate.max(1.0),
            ratios,
            amps,
            decay_mul,
            phases: [0.0; N],
            env: [0.0; N],
            noise_state: 0x5EED_1234,
            noise_hp: 0.0,
            noise_env: 0.0,
            hp_state: 0.0,
            last_trig: 0.0,
            is_open: false,
            latched_accent: 0.5,
        }
    }

    /// Precompute the inharmonic partial bank (deterministic - same on every instance).
    fn build_partials() -> ([f32; N], [f32; N], [f32; N]) {
        let mut ratios = [0.0f32; N];
        let mut amps = [0.0f32; N];
        let mut decay_mul = [0.0f32; N];
        let mut seed: u32 = 0x2545_F491;
        let mut rng = || {
            seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            (seed >> 8) as f32 / 16_777_216.0
        };
        // top ratio ~26 -> ~10.4 kHz at BASE 400 / tune 1.0 (bright metallic register)
        let f_hi = 26.0f32;
        let mut amp_sum = 0.0f32;
        for j in 0..N {
            let t = j as f32 / (N - 1) as f32;
            let base_ratio = f_hi.powf(t);
            let jitter = 1.0 + (rng() - 0.5) * 0.4; // +-20% -> inharmonic
            ratios[j] = base_ratio * jitter;
            amps[j] = 0.35 + 0.65 * t; // strong high tilt - a hat should read bright, not washy
            amp_sum += amps[j];
            decay_mul[j] = 0.6 + rng() * 1.0;
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
        inputs: HiHat909Inputs,
        params: HiHat909Params,
    ) {
        let len = output.len();
        let sr = self.sample_rate;
        let nyq = sr * 0.47;
        let tau = std::f32::consts::TAU;

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(0.5, 2.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.02, 1.5);
            let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);
            let open = params.open.get(i).copied().unwrap_or(params.open[0]);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            if trig > 0.5 && self.last_trig <= 0.5 {
                for j in 0..N {
                    self.env[j] = self.amps[j];
                }
                self.noise_env = 1.0;
                self.is_open = open > 0.5;
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Closed hats are much shorter than open ones (same knob as before); this rate
            // drives BOTH the per-partial and the noise decay below - no separate master gate.
            let actual_decay = if self.is_open { decay } else { decay * 0.15 };

            // Dense inharmonic sine partials, each on its own decay -> metallic shimmer.
            let base = Self::BASE_FREQ * tune;
            let base_rate = 1.0 / (actual_decay.max(0.02) * sr);
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

            // Noise sizzle: white -> one-pole high-pass -> its own (faster) decay - the "air".
            self.noise_state = self.noise_state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let white = (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0;
            let hp_a = 1.0 - (tau * 3000.0 / sr).min(0.99);
            self.noise_hp = hp_a * (self.noise_hp + white);
            let noise_hp_signal = white - self.noise_hp;
            let noise_rate = 1.0 / (actual_decay.max(0.02) * 0.6 * sr);
            self.noise_env = (self.noise_env - noise_rate).max(0.0);

            let bright = 0.5 + tone * 0.5;
            let mut sample =
                partials * 1.8 + noise_hp_signal * self.noise_env * (0.15 + tone * 0.35) * bright;

            // Output high-pass to keep it hat-bright (kills any residual low thump).
            let hp_cut = 900.0 + tone * 1400.0;
            let hp_a = (tau * hp_cut / sr).min(0.9);
            self.hp_state += hp_a * (sample - self.hp_state);
            sample -= self.hp_state;

            // Accent (latched at trigger)
            sample *= 0.7 + self.latched_accent * 0.4;

            output[i] = (sample * 0.55).clamp(-1.0, 1.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fire(open: f32, decay: f32) -> f32 {
        let mut hh = HiHat909::new(48_000.0);
        let mut peak = 0.0f32;
        for block in 0..40 {
            let mut out = [0.0f32; 128];
            let trig: [f32; 128] = if block == 0 {
                let mut t = [0.0f32; 128];
                t[0] = 1.0;
                t
            } else {
                [0.0f32; 128]
            };
            hh.process_block(
                &mut out,
                HiHat909Inputs { trigger: Some(&trig), accent: Some(&[1.0]) },
                HiHat909Params { tune: &[1.0], decay: &[decay], tone: &[0.5], open: &[open] },
            );
            for &s in &out {
                assert!(s.is_finite(), "non-finite sample");
                peak = peak.max(s.abs());
            }
        }
        peak
    }

    #[test]
    fn hihat_triggers_closed_and_open() {
        assert!(fire(0.0, 0.2) > 1e-3, "closed hat should produce audible output");
        assert!(fire(1.0, 0.9) > 1e-3, "open hat should produce audible output");
    }
}
