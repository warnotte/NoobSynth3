//! TR-808 Clap.
//!
//! Electronic handclap with multiple noise bursts.

use crate::common::Sample;

/// TR-808 Clap.
///
/// Classic 808-style electronic handclap with:
/// - Multiple rapid noise bursts (simulating multiple hands)
/// - Bandpass filtered noise
/// - Reverb-like decay tail
/// - More electronic/synthetic than 909 clap
///
/// # Parameters
///
/// - `tone`: Filter brightness (0-1)
/// - `decay`: Decay time (0.1-0.8 seconds)
/// - `spread`: Time spread between bursts (0-1)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{Clap808, Clap808Params, Clap808Inputs};
///
/// let mut clap = Clap808::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// clap.process_block(
///     &mut output,
///     Clap808Inputs { trigger: Some(&[1.0]), accent: None },
///     Clap808Params {
///         tone: &[0.5],
///         decay: &[0.3],
///         spread: &[0.5],
///     },
/// );
/// ```
pub struct Clap808 {
    sample_rate: f32,
    noise_state: u32,
    amp_env: f32,
    burst_env: [f32; 4],  // 4 individual bursts
    burst_index: usize,
    burst_timer: f32,
    bp_state: [f32; 2],
    last_trig: f32,
    latched_accent: f32,
}

/// Parameters for Clap808.
pub struct Clap808Params<'a> {
    /// Filter brightness (0-1)
    pub tone: &'a [Sample],
    /// Decay time (0.1-0.8 seconds)
    pub decay: &'a [Sample],
    /// Time spread between bursts (0-1)
    pub spread: &'a [Sample],
}

/// Input signals for Clap808.
pub struct Clap808Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Clap808 {
    /// Create a new 808 clap.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            noise_state: 0x12345678,
            amp_env: 0.0,
            burst_env: [0.0; 4],
            burst_index: 4,  // Start inactive
            burst_timer: 0.0,
            bp_state: [0.0; 2],
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
        inputs: Clap808Inputs,
        params: Clap808Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.1, 0.8);
            let spread = params.spread.get(i).copied().unwrap_or(params.spread[0]).clamp(0.0, 1.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            // Trigger detection - start the burst sequence
            if trig > 0.5 && self.last_trig <= 0.5 {
                self.amp_env = 1.0;
                self.burst_index = 0;
                self.burst_timer = 0.0;
                self.burst_env = [1.0, 0.0, 0.0, 0.0];
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Time between bursts (in samples)
            let burst_interval = (0.01 + spread * 0.02) * self.sample_rate;

            // Advance burst sequence
            if self.burst_index < 4 {
                self.burst_timer += 1.0;
                if self.burst_timer >= burst_interval && self.burst_index < 3 {
                    self.burst_index += 1;
                    self.burst_env[self.burst_index] = 0.8 - (self.burst_index as f32) * 0.15;
                    self.burst_timer = 0.0;
                }
            }

            // Generate noise
            let noise = self.white_noise();

            // Bandpass filter
            let bp_freq = 1000.0 + tone * 1500.0;
            let f = (std::f32::consts::PI * bp_freq / self.sample_rate).tan();
            let q = 1.5 + tone;
            let k = 1.0 / q;

            self.bp_state[0] += f * (noise - self.bp_state[0] - self.bp_state[1] * k);
            self.bp_state[1] += f * self.bp_state[0];
            let filtered = self.bp_state[0];

            // Sum all burst envelopes
            let mut burst_sum = 0.0;
            for env in &mut self.burst_env {
                if *env > 0.0 {
                    burst_sum += *env;
                    // Fast decay for individual bursts
                    *env = (*env - 0.002 * (self.sample_rate / 48000.0)).max(0.0);
                }
            }

            // Main amplitude envelope (reverb tail)
            let decay_rate = 1.0 / (decay * self.sample_rate);
            self.amp_env = (self.amp_env - decay_rate).max(0.0);

            // Combine bursts with reverb tail
            let burst_signal = filtered * burst_sum * 0.5;
            let tail_signal = filtered * self.amp_env * 0.3;
            let mut sample = burst_signal + tail_signal;

            // Apply accent
            sample *= 0.7 + self.latched_accent * 0.5;

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}
