//! TR-909 Hi-Hat.
//!
//! Metallic hi-hat with 6 square waves at inharmonic ratios.

use crate::common::Sample;

/// TR-909 Hi-Hat.
///
/// Classic 909-style metallic hi-hat with:
/// - 6 square wave oscillators at inharmonic ratios
/// - Bandpass filter for metallic character
/// - Open/closed modes with different decay times
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
    phases: [f32; 6],
    filter_state: [f32; 2], // Simple bandpass state
    amp_env: f32,
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
    // Metallic ratios from TR-909 analysis
    const RATIOS: [f32; 6] = [1.0, 1.4471, 1.6170, 1.9265, 2.5028, 2.6637];
    const BASE_FREQ: f32 = 320.0; // Base metallic frequency

    /// Create a new 909 hi-hat.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phases: [0.0; 6],
            filter_state: [0.0; 2],
            amp_env: 0.0,
            last_trig: 0.0,
            is_open: false,
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
        inputs: HiHat909Inputs,
        params: HiHat909Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(0.5, 2.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.02, 1.5);
            let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);
            let open = params.open.get(i).copied().unwrap_or(params.open[0]);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            // Trigger detection
            if trig > 0.5 && self.last_trig <= 0.5 {
                self.amp_env = 1.0;
                self.is_open = open > 0.5;
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
                // Square wave
                let square = if *phase < 0.5 { 1.0 } else { -1.0 };
                metallic += square;
            }
            metallic /= 6.0; // Normalize

            // Simple bandpass filter (resonant)
            let cutoff = 4000.0 + tone * 8000.0; // 4-12 kHz
            let f = (std::f32::consts::PI * cutoff / self.sample_rate).tan();
            let q = 0.5 + tone * 1.5;
            let k = 1.0 / q;
            let norm = 1.0 / (1.0 + k * f + f * f);

            let _filtered = metallic - self.filter_state[0] * 2.0;
            self.filter_state[0] += f * (metallic - self.filter_state[0] - self.filter_state[1] * k);
            self.filter_state[1] += f * self.filter_state[0];
            let bandpass = self.filter_state[0] * f * norm * 2.0;

            // Amplitude envelope
            let actual_decay = if self.is_open { decay } else { decay * 0.15 }; // Closed is much shorter
            let amp_decay_rate = 1.0 / (actual_decay * self.sample_rate);
            self.amp_env = (self.amp_env - amp_decay_rate).max(0.0);

            let mut sample = bandpass * self.amp_env * 0.8;

            // Apply accent (latched at trigger)
            sample *= 0.7 + self.latched_accent * 0.4;

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}
