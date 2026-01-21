//! TR-808 Snare Drum.
//!
//! Distinctive snappy snare with clear tonal component.

use crate::common::Sample;

/// TR-808 Snare Drum.
///
/// Classic 808-style snare with:
/// - Two detuned tone oscillators with pitch envelope
/// - High-passed noise for snap
/// - Snappier and more tonal than 909
/// - Distinctive "crack" sound
///
/// # Parameters
///
/// - `tune`: Tone pitch (100-350 Hz)
/// - `tone`: Tone vs noise mix (0-1, 808 is typically more tonal)
/// - `snappy`: High-frequency snap amount (0-1)
/// - `decay`: Decay time (0.05-0.8 seconds)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{Snare808, Snare808Params, Snare808Inputs};
///
/// let mut snare = Snare808::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// snare.process_block(
///     &mut output,
///     Snare808Inputs { trigger: Some(&[1.0]), accent: None },
///     Snare808Params {
///         tune: &[180.0],
///         tone: &[0.6],
///         snappy: &[0.7],
///         decay: &[0.2],
///     },
/// );
/// ```
pub struct Snare808 {
    sample_rate: f32,
    phase1: f32,
    phase2: f32,
    pitch_env: f32,
    amp_env: f32,
    noise_env: f32,
    noise_state: u32,
    hp_state: f32, // High-pass filter state
    last_trig: f32,
    latched_accent: f32,
}

/// Parameters for Snare808.
pub struct Snare808Params<'a> {
    /// Tone pitch (100-350 Hz)
    pub tune: &'a [Sample],
    /// Tone vs noise mix (0-1)
    pub tone: &'a [Sample],
    /// High-frequency snap amount (0-1)
    pub snappy: &'a [Sample],
    /// Decay time (0.05-0.8 seconds)
    pub decay: &'a [Sample],
}

/// Input signals for Snare808.
pub struct Snare808Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Snare808 {
    /// Create a new 808 snare drum.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phase1: 0.0,
            phase2: 0.0,
            pitch_env: 0.0,
            amp_env: 0.0,
            noise_env: 0.0,
            noise_state: 0xDEADBEEF,
            hp_state: 0.0,
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
        inputs: Snare808Inputs,
        params: Snare808Params,
    ) {
        let len = output.len();

        for i in 0..len {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(100.0, 350.0);
            let tone_mix = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);
            let snappy = params.snappy.get(i).copied().unwrap_or(params.snappy[0]).clamp(0.0, 1.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.05, 0.8);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            // Trigger detection
            if trig > 0.5 && self.last_trig <= 0.5 {
                self.pitch_env = 1.0;
                self.amp_env = 1.0;
                self.noise_env = 1.0;
                self.phase1 = 0.0;
                self.phase2 = 0.0;
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            // Pitch envelope: 808 snare has a distinctive pitch drop
            let pitch_decay_rate = 0.001;
            self.pitch_env *= 1.0 - pitch_decay_rate * (self.sample_rate / 48000.0);

            // Two detuned oscillators
            let freq1 = tune * (1.0 + self.pitch_env * 1.5);
            let freq2 = tune * 1.5 * (1.0 + self.pitch_env * 0.8); // Higher harmonic

            let dt1 = freq1 / self.sample_rate;
            let dt2 = freq2 / self.sample_rate;

            self.phase1 += dt1;
            self.phase2 += dt2;
            if self.phase1 >= 1.0 { self.phase1 -= 1.0; }
            if self.phase2 >= 1.0 { self.phase2 -= 1.0; }

            // Triangle waves for more harmonic content
            let tri1 = if self.phase1 < 0.5 {
                4.0 * self.phase1 - 1.0
            } else {
                3.0 - 4.0 * self.phase1
            };
            let tri2 = if self.phase2 < 0.5 {
                4.0 * self.phase2 - 1.0
            } else {
                3.0 - 4.0 * self.phase2
            };

            let tone_signal = (tri1 + tri2 * 0.4) * 0.6;

            // Noise with high-pass filter for snap
            let noise = self.white_noise();

            // Simple high-pass filter
            let hp_cutoff = 2000.0 + snappy * 4000.0;
            let hp_coeff = 1.0 - (std::f32::consts::PI * hp_cutoff / self.sample_rate).min(0.99);
            self.hp_state = hp_coeff * (self.hp_state + noise);
            let hp_noise = noise - self.hp_state;

            // Noise envelope decays faster than tone
            let noise_decay_rate = 1.0 / (decay * 0.3 * self.sample_rate);
            self.noise_env = (self.noise_env - noise_decay_rate).max(0.0);

            let noise_signal = hp_noise * self.noise_env * (0.4 + snappy * 0.6);

            // Amplitude envelope for tone
            let amp_decay_rate = 1.0 / (decay * self.sample_rate);
            self.amp_env = (self.amp_env - amp_decay_rate).max(0.0);

            // Mix tone and noise (808 is typically more tonal)
            let tone_amount = tone_signal * self.amp_env * (0.4 + tone_mix * 0.6);
            let noise_amount = noise_signal * (0.3 + (1.0 - tone_mix) * 0.4);
            let mut sample = (tone_amount + noise_amount) * 0.8;

            // Apply accent
            sample *= 0.7 + self.latched_accent * 0.5;

            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}
