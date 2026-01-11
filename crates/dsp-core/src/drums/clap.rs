//! TR-909 Clap.
//!
//! Filtered noise with multi-trigger envelope.

use crate::common::Sample;

/// TR-909 Clap.
///
/// Classic 909-style hand clap with:
/// - Filtered noise source
/// - Multi-trigger envelope (3 quick hits then decay)
/// - Bandpass filter for characteristic sound
///
/// The clap uses a unique 3-stage re-trigger that creates the
/// characteristic "clapping hands" sound.
///
/// # Parameters
///
/// - `tone`: Filter brightness (0-1)
/// - `decay`: Tail decay time (0.1-1.0 seconds)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{Clap909, Clap909Params, Clap909Inputs};
///
/// let mut clap = Clap909::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// clap.process_block(
///     &mut output,
///     Clap909Inputs { trigger: Some(&[1.0]), accent: None },
///     Clap909Params {
///         tone: &[0.5],
///         decay: &[0.3],
///     },
/// );
/// ```
pub struct Clap909 {
    sample_rate: f32,
    noise_state: u32,
    filter_state: [f32; 2],
    amp_env: f32,
    clap_stage: u8, // 0-3 for multi-trigger effect
    stage_counter: u32,
    last_trig: f32,
    latched_accent: f32,
}

/// Parameters for Clap909.
pub struct Clap909Params<'a> {
    /// Filter brightness (0-1)
    pub tone: &'a [Sample],
    /// Tail decay time (0.1-1.0 seconds)
    pub decay: &'a [Sample],
}

/// Input signals for Clap909.
pub struct Clap909Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Clap909 {
    /// Create a new 909 clap.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            noise_state: 0xABCDEF01,
            filter_state: [0.0; 2],
            amp_env: 0.0,
            clap_stage: 3, // Start at 3 to prevent auto-trigger on creation
            stage_counter: 0,
            last_trig: 0.0,
            latched_accent: 0.5,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn white_noise(&mut self) -> f32 {
        self.noise_state ^= self.noise_state << 13;
        self.noise_state ^= self.noise_state >> 17;
        self.noise_state ^= self.noise_state << 5;
        (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: Clap909Inputs,
        params: Clap909Params,
    ) {
        let len = output.len();
        let stage_samples = (self.sample_rate * 0.012) as u32; // ~12ms between claps

        for i in 0..len {
            let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.1, 1.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            // Trigger detection - start multi-clap sequence
            if trig > 0.5 && self.last_trig <= 0.5 {
                self.clap_stage = 0;
                self.stage_counter = 0;
                self.amp_env = 1.0;
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Multi-clap stages (3 quick hits then decay)
            self.stage_counter += 1;
            if self.clap_stage < 3 && self.stage_counter >= stage_samples {
                self.clap_stage += 1;
                self.stage_counter = 0;
                self.amp_env = 0.8; // Re-trigger envelope
            }

            // Generate filtered noise
            let noise = self.white_noise();

            // Bandpass filter around 1-3 kHz
            let cutoff = 1000.0 + tone * 2000.0;
            let f = (std::f32::consts::PI * cutoff / self.sample_rate).tan();
            let q = 2.0 + tone * 4.0; // Higher Q for more resonant clap
            let k = 1.0 / q;

            self.filter_state[0] += f * (noise - self.filter_state[0] - self.filter_state[1] * k);
            self.filter_state[1] += f * self.filter_state[0];
            let bandpass = self.filter_state[0] * 3.0;

            // Envelope
            let env_decay = if self.clap_stage < 3 { 0.002 } else { 1.0 / (decay * self.sample_rate) };
            self.amp_env = (self.amp_env - env_decay).max(0.0);

            let mut sample = bandpass * self.amp_env * 0.7;

            // Apply accent (latched at trigger)
            sample *= 0.7 + self.latched_accent * 0.5;

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}
