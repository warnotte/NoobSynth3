//! TR-909 Ride Cymbal.
//!
//! Defined metallic ride with a clear bell/ping and a sustained shimmer tail. Synthesized
//! (the real 909 used a 6-bit sample): 6 inharmonic square partials through a mid bandpass for
//! the shimmer body, plus a prominent resonant bell partial (the "ping") on its own envelope.

use crate::common::Sample;

/// TR-909 Ride Cymbal (synthesized).
///
/// # Parameters
/// - `tune`: Base frequency multiplier (0.5-2.0)
/// - `decay`: Shimmer decay time in seconds (0.5-4.0)
/// - `bell`: Bell/ping prominence (0-1)
pub struct Ride909 {
    sample_rate: f32,
    phases: [f32; 6],
    filter_state: [f32; 2],
    amp_env: f32,    // shimmer body
    bell_env: f32,   // the ping
    bell_phase: f32,
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
    // Inharmonic ratios for the metallic shimmer body.
    const RATIOS: [f32; 6] = [1.0, 1.4471, 1.6170, 1.9265, 2.5028, 2.6637];
    const BASE_FREQ: f32 = 340.0;
    const BELL_RATIO: f32 = 6.0; // the ping sits well above the shimmer (~2 kHz at tune 1)

    /// Create a new 909 ride cymbal.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phases: [0.0; 6],
            filter_state: [0.0; 2],
            amp_env: 0.0,
            bell_env: 0.0,
            bell_phase: 0.0,
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
        inputs: Ride909Inputs,
        params: Ride909Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(0.5, 2.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.5, 4.0);
            let bell = params.bell.get(i).copied().unwrap_or(params.bell[0]).clamp(0.0, 1.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            if trig > 0.5 && self.last_trig <= 0.5 {
                self.amp_env = 1.0;
                self.bell_env = 1.0;
                self.bell_phase = 0.0;
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Metallic shimmer: 6 inharmonic square partials
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
            metallic /= 6.0;

            // Mid bandpass for a defined shimmer (narrower than the crash)
            let cutoff = 4500.0 * tune;
            let f = (std::f32::consts::PI * cutoff.min(self.sample_rate * 0.45) / self.sample_rate).tan();
            let q = 1.6;
            let k = 1.0 / q;
            let norm = 1.0 / (1.0 + k * f + f * f);
            self.filter_state[0] += f * (metallic - self.filter_state[0] - self.filter_state[1] * k);
            self.filter_state[1] += f * self.filter_state[0];
            let bandpass = self.filter_state[0] * f * norm * 2.0;

            // Bell/ping: a resonant sine partial with its own (medium) envelope
            let bell_freq = base_freq * Self::BELL_RATIO;
            self.bell_phase += bell_freq / self.sample_rate;
            if self.bell_phase >= 1.0 {
                self.bell_phase -= 1.0;
            }
            let bell_sine = (self.bell_phase * std::f32::consts::TAU).sin();
            let bell_rate = 1.0 / (0.45 * self.sample_rate); // ~450ms ping
            self.bell_env = (self.bell_env - bell_rate).max(0.0);

            // Shimmer body: long decay
            let amp_rate = 1.0 / (decay * self.sample_rate);
            self.amp_env = (self.amp_env - amp_rate).max(0.0);

            // Mix shimmer + ping
            let mut sample = bandpass * self.amp_env * 0.55 + bell_sine * self.bell_env * bell * 0.6;

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
                if block < 60 && a > peak { peak = a; }
                if block > 750 { tail = tail.max(a); }
            }
        }
        assert!(peak > 1e-3, "ride should produce audible output (peak {peak})");
        assert!(tail < peak, "ride should decay (tail {tail} >= peak {peak})");
    }
}
