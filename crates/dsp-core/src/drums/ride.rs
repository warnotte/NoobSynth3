//! TR-909 Ride Cymbal.
//!
//! Defined metallic ride with a clear bell "ping" and a sustained shimmer. Synthesized
//! (the real 909 used a 6-bit sample): 24 inharmonic SINE partials (less jittered than the
//! crash → more tonal/defined shimmer), each on its own slow decay, plus a pitched BELL
//! cluster (fundamental + two overtones) on its own medium envelope, and a light high-passed
//! sizzle. More focused and longer-sustaining than the crash.

use crate::common::Sample;

const N: usize = 24; // shimmer partials

/// TR-909 Ride Cymbal (dense additive synthesis).
///
/// # Parameters
/// - `tune`: Base frequency multiplier (0.5-2.0)
/// - `decay`: Shimmer decay time in seconds (0.5-4.0)
/// - `bell`: Bell/ping prominence (0-1)
pub struct Ride909 {
    sample_rate: f32,
    ratios: [f32; N],
    amps: [f32; N],
    decay_mul: [f32; N],
    phases: [f32; N],
    env: [f32; N],
    bell_phase: [f32; 3], // pitched bell cluster (fundamental + 2 overtones)
    bell_env: f32,
    noise_state: u32,
    noise_lp: f32,
    hp_state: f32,
    last_trig: f32,
    latched_accent: f32,
}

/// Parameters for Ride909.
pub struct Ride909Params<'a> {
    /// Base frequency multiplier (0.5-2.0)
    pub tune: &'a [Sample],
    /// Shimmer decay time in seconds (0.5-4.0)
    pub decay: &'a [Sample],
    /// Bell/ping prominence (0-1)
    pub bell: &'a [Sample],
}

/// Input signals for Ride909.
pub struct Ride909Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Ride909 {
    const BASE_FREQ: f32 = 320.0;
    const BELL_RATIO: f32 = 5.0; // the ping sits well above the shimmer (~1.6 kHz at tune 1)
    // Bell cluster overtone ratios (inharmonic, bell-like).
    const BELL_OVERTONES: [f32; 3] = [1.0, 2.01, 2.76];

    /// Create a new 909 ride cymbal.
    pub fn new(sample_rate: f32) -> Self {
        let (ratios, amps, decay_mul) = Self::build_partials();
        Self {
            sample_rate: sample_rate.max(1.0),
            ratios,
            amps,
            decay_mul,
            phases: [0.0; N],
            env: [0.0; N],
            bell_phase: [0.0; 3],
            bell_env: 0.0,
            noise_state: 0x2545_F491,
            noise_lp: 0.0,
            hp_state: 0.0,
            last_trig: 0.0,
            latched_accent: 0.5,
        }
    }

    /// Precompute the inharmonic shimmer partials (deterministic).
    fn build_partials() -> ([f32; N], [f32; N], [f32; N]) {
        let mut ratios = [0.0f32; N];
        let mut amps = [0.0f32; N];
        let mut decay_mul = [0.0f32; N];
        let mut seed: u32 = 0x6D2B_79F5;
        let mut rng = || {
            seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            (seed >> 8) as f32 / 16_777_216.0
        };
        let f_hi = 34.0f32; // ~11 kHz top at BASE 320
        let mut amp_sum = 0.0f32;
        for j in 0..N {
            let t = j as f32 / (N - 1) as f32;
            let base_ratio = f_hi.powf(t);
            let jitter = 1.0 + (rng() - 0.5) * 0.18; // less jitter than crash → more tonal
            ratios[j] = base_ratio * jitter;
            // rising weight → the shimmer lives in the highs (a ride is bright, not muddy)
            amps[j] = 0.18 + 0.9 * t;
            amp_sum += amps[j];
            decay_mul[j] = 0.45 + rng() * 0.8; // slower spread → long shimmer
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
        inputs: Ride909Inputs,
        params: Ride909Params,
    ) {
        let len = output.len();
        let sr = self.sample_rate;
        let nyq = sr * 0.47;
        let tau = std::f32::consts::TAU;

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(0.5, 2.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.5, 4.0);
            let bell = params.bell.get(i).copied().unwrap_or(params.bell[0]).clamp(0.0, 1.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            if trig > 0.5 && self.last_trig <= 0.5 {
                for j in 0..N {
                    self.env[j] = self.amps[j];
                }
                self.bell_env = 1.0;
                self.bell_phase = [0.0; 3];
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            let base = Self::BASE_FREQ * tune;
            let base_rate = 1.0 / (decay * sr);

            // Shimmer body: inharmonic sine partials, slow per-partial decay.
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

            // Bell ping: a pitched cluster on its own medium envelope.
            let bell_base = base * Self::BELL_RATIO;
            let mut bell_sig = 0.0_f32;
            for k in 0..3 {
                let f = bell_base * Self::BELL_OVERTONES[k];
                self.bell_phase[k] += f / sr;
                if self.bell_phase[k] >= 1.0 {
                    self.bell_phase[k] -= 1.0;
                }
                if f < nyq {
                    let w = 1.0 / (k as f32 + 1.0); // fundamental loudest
                    bell_sig += (self.bell_phase[k] * tau).sin() * w;
                }
            }
            let bell_rate = 1.0 / (0.55 * sr); // ~550 ms ping
            self.bell_env = (self.bell_env - bell_rate).max(0.0);

            // Light sizzle.
            self.noise_state = self.noise_state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let white = (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0;
            self.noise_lp += 0.4 * (white - self.noise_lp);
            let noise_hp = white - self.noise_lp;

            let mut sample = partials * 2.4
                + bell_sig * self.bell_env * bell * 0.42
                + noise_hp * partials.abs().min(1.0) * 0.4; // sizzle gated by the shimmer body

            // Output high-pass — cut the low-mid mud so the ride reads bright, not dull.
            let hp_a = (tau * 1300.0 / sr).min(0.9);
            self.hp_state += hp_a * (sample - self.hp_state);
            sample -= self.hp_state;

            sample *= 0.7 + self.latched_accent * 0.4;

            output[i] = (sample * 0.45).clamp(-1.0, 1.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ride_triggers_and_decays() {
        let mut ride = Ride909::new(48_000.0);
        let mut peak = 0.0f32;
        let mut tail = 0.0f32;
        for block in 0..800 {
            let mut out = [0.0f32; 128];
            let trig: [f32; 128] = if block == 0 {
                let mut t = [0.0f32; 128];
                t[0] = 1.0;
                t
            } else {
                [0.0f32; 128]
            };
            ride.process_block(
                &mut out,
                Ride909Inputs { trigger: Some(&trig), accent: Some(&[1.0]) },
                Ride909Params { tune: &[1.0], decay: &[2.0], bell: &[0.7] },
            );
            for &s in &out {
                assert!(s.is_finite(), "non-finite sample");
                let a = s.abs();
                if block < 60 && a > peak {
                    peak = a;
                }
                if block > 750 {
                    tail = tail.max(a);
                }
            }
        }
        assert!(peak > 1e-3, "ride should produce audible output (peak {peak})");
        assert!(tail < peak, "ride should decay (tail {tail} >= peak {peak})");
    }
}
