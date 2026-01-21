//! TR-808 Cowbell.
//!
//! The legendary 808 cowbell - one of the most iconic sounds in electronic music.

use crate::common::Sample;

/// TR-808 Cowbell.
///
/// The unmistakable 808 cowbell with:
/// - Two square wave oscillators at ~540Hz and ~800Hz
/// - Bandpass filtering for metallic tone
/// - Very short, punchy decay
/// - The iconic "ting" that defined countless tracks
///
/// # Parameters
///
/// - `tune`: Pitch multiplier (0.5-2.0)
/// - `decay`: Decay time (0.01-0.5 seconds)
/// - `tone`: Filter brightness (0-1)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{Cowbell808, Cowbell808Params, Cowbell808Inputs};
///
/// let mut cowbell = Cowbell808::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// cowbell.process_block(
///     &mut output,
///     Cowbell808Inputs { trigger: Some(&[1.0]), accent: None },
///     Cowbell808Params {
///         tune: &[1.0],
///         decay: &[0.1],
///         tone: &[0.6],
///     },
/// );
/// ```
pub struct Cowbell808 {
    sample_rate: f32,
    phase1: f32,
    phase2: f32,
    amp_env: f32,
    bp_state: [f32; 2],
    last_trig: f32,
    latched_accent: f32,
}

/// Parameters for Cowbell808.
pub struct Cowbell808Params<'a> {
    /// Pitch multiplier (0.5-2.0)
    pub tune: &'a [Sample],
    /// Decay time (0.01-0.5 seconds)
    pub decay: &'a [Sample],
    /// Filter brightness (0-1)
    pub tone: &'a [Sample],
}

/// Input signals for Cowbell808.
pub struct Cowbell808Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Cowbell808 {
    // Classic 808 cowbell frequencies
    const FREQ1: f32 = 540.0;
    const FREQ2: f32 = 800.0;

    /// Create a new 808 cowbell.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phase1: 0.0,
            phase2: 0.0,
            amp_env: 0.0,
            bp_state: [0.0; 2],
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
        inputs: Cowbell808Inputs,
        params: Cowbell808Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(0.5, 2.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.01, 0.5);
            let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            // Trigger detection
            if trig > 0.5 && self.last_trig <= 0.5 {
                self.amp_env = 1.0;
                self.phase1 = 0.0;
                self.phase2 = 0.0;
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Two square wave oscillators at the classic 808 frequencies
            let freq1 = Self::FREQ1 * tune;
            let freq2 = Self::FREQ2 * tune;

            let dt1 = freq1 / self.sample_rate;
            let dt2 = freq2 / self.sample_rate;

            self.phase1 += dt1;
            self.phase2 += dt2;
            if self.phase1 >= 1.0 { self.phase1 -= 1.0; }
            if self.phase2 >= 1.0 { self.phase2 -= 1.0; }

            // Square waves
            let sq1 = if self.phase1 < 0.5 { 1.0 } else { -1.0 };
            let sq2 = if self.phase2 < 0.5 { 1.0 } else { -1.0 };

            // Mix the two oscillators
            let osc_mix = (sq1 + sq2) * 0.5;

            // Bandpass filter for metallic tone
            let bp_freq = 800.0 + tone * 400.0;
            let f = (std::f32::consts::PI * bp_freq / self.sample_rate).tan();
            let q = 2.0 + tone * 3.0;
            let k = 1.0 / q;

            self.bp_state[0] += f * (osc_mix - self.bp_state[0] - self.bp_state[1] * k);
            self.bp_state[1] += f * self.bp_state[0];
            let filtered = self.bp_state[0];

            // Fast exponential decay
            let decay_rate = 1.0 / (decay * self.sample_rate);
            self.amp_env = (self.amp_env - decay_rate * 2.0).max(0.0);

            let mut sample = filtered * self.amp_env * 0.8;

            // Apply accent
            sample *= 0.7 + self.latched_accent * 0.5;

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}
