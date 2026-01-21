//! TR-808 Hi-Hat.
//!
//! Metallic hi-hat with distinctive 808 character.

use crate::common::Sample;

/// TR-808 Hi-Hat.
///
/// Classic 808-style metallic hi-hat with:
/// - 6 square wave oscillators at inharmonic ratios
/// - High-pass and bandpass filtering
/// - More metallic/thinner than 909
/// - Open/closed modes
///
/// # Parameters
///
/// - `tune`: Base frequency multiplier (0.5-2.0)
/// - `decay`: Decay time (0.02-2.0 seconds)
/// - `tone`: Filter brightness (0-1)
/// - `snap`: Attack sharpness (0-1)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{HiHat808, HiHat808Params, HiHat808Inputs};
///
/// let mut hihat = HiHat808::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// hihat.process_block(
///     &mut output,
///     HiHat808Inputs { trigger: Some(&[1.0]), accent: None },
///     HiHat808Params {
///         tune: &[1.0],
///         decay: &[0.15],
///         tone: &[0.6],
///         snap: &[0.5],
///     },
/// );
/// ```
pub struct HiHat808 {
    sample_rate: f32,
    phases: [f32; 6],
    hp_state: f32,
    bp_state: [f32; 2],
    amp_env: f32,
    last_trig: f32,
    latched_accent: f32,
}

/// Parameters for HiHat808.
pub struct HiHat808Params<'a> {
    /// Base frequency multiplier (0.5-2.0)
    pub tune: &'a [Sample],
    /// Decay time (0.02-2.0 seconds)
    pub decay: &'a [Sample],
    /// Filter brightness (0-1)
    pub tone: &'a [Sample],
    /// Attack sharpness/snap (0-1)
    pub snap: &'a [Sample],
}

/// Input signals for HiHat808.
pub struct HiHat808Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl HiHat808 {
    // Metallic ratios - 808 uses slightly different ratios than 909
    const RATIOS: [f32; 6] = [1.0, 1.3420, 1.5618, 1.9283, 2.5014, 2.6680];
    const BASE_FREQ: f32 = 400.0; // Slightly higher than 909

    /// Create a new 808 hi-hat.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phases: [0.0; 6],
            hp_state: 0.0,
            bp_state: [0.0; 2],
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
        inputs: HiHat808Inputs,
        params: HiHat808Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(0.5, 2.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.02, 2.0);
            let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);
            let snap = params.snap.get(i).copied().unwrap_or(params.snap[0]).clamp(0.0, 1.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            // Trigger detection
            if trig > 0.5 && self.last_trig <= 0.5 {
                self.amp_env = 1.0;
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Generate metallic noise from 6 square waves
            let base_freq = Self::BASE_FREQ * tune;
            let mut metallic = 0.0_f32;

            for (j, phase) in self.phases.iter_mut().enumerate() {
                let freq = base_freq * Self::RATIOS[j];
                let dt = freq / self.sample_rate;
                *phase += dt;
                if *phase >= 1.0 {
                    *phase -= 1.0;
                }
                // Square wave with varying duty cycle for more character
                let duty = 0.5 + (j as f32) * 0.02;
                let square = if *phase < duty { 1.0 } else { -1.0 };
                metallic += square;
            }
            metallic /= 6.0;

            // High-pass filter (808 hats are thinner)
            let hp_cutoff = 5000.0 + tone * 5000.0;
            let hp_coeff = 1.0 - (std::f32::consts::PI * hp_cutoff / self.sample_rate).min(0.99);
            self.hp_state = hp_coeff * (self.hp_state + metallic);
            let hp_signal = metallic - self.hp_state;

            // Bandpass for resonance
            let bp_cutoff = 8000.0 + tone * 6000.0;
            let f = (std::f32::consts::PI * bp_cutoff / self.sample_rate).tan();
            let q = 0.7 + tone;
            let k = 1.0 / q;

            self.bp_state[0] += f * (hp_signal - self.bp_state[0] - self.bp_state[1] * k);
            self.bp_state[1] += f * self.bp_state[0];
            let bandpass = self.bp_state[0];

            // Mix high-pass and bandpass
            let filtered = hp_signal * 0.4 + bandpass * 0.6;

            // Amplitude envelope with snap control
            // Snap affects the initial attack shape
            let env_shape = 1.0 + snap * 2.0;
            let amp_decay_rate = 1.0 / (decay * self.sample_rate);
            self.amp_env = (self.amp_env.powf(1.0 / env_shape) - amp_decay_rate).max(0.0).powf(env_shape);

            let mut sample = filtered * self.amp_env * 0.7;

            // Apply accent
            sample *= 0.7 + self.latched_accent * 0.4;

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}
