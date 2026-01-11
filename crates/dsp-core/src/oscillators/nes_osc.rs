//! NES 2A03 APU oscillator emulation.
//!
//! Emulates the sound chip from the Nintendo Entertainment System,
//! including pulse waves, triangle waves, and noise channels.

use crate::common::{sample_at, Sample};

/// NES 2A03 APU oscillator emulation.
///
/// Provides authentic 8-bit NES sounds including:
/// - Pulse waves with 4 duty cycle options (12.5%, 25%, 50%, 75%)
/// - 4-bit stepped triangle wave (32 steps per cycle)
/// - Pseudo-random noise with loop mode option
/// - Optional bit-crushing for lo-fi character
///
/// # Example
///
/// ```ignore
/// use dsp_core::oscillators::{NesOsc, NesOscParams, NesOscInputs};
///
/// let mut osc = NesOsc::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// osc.process_block(&mut output, inputs, params);
/// ```
pub struct NesOsc {
    sample_rate: f32,
    phases: [f32; 8],
    lfsrs: [u16; 8],
    noise_timers: [f32; 8],
}

/// Parameters for NES oscillator.
pub struct NesOscParams<'a> {
    /// Base frequency in Hz
    pub base_freq: &'a [Sample],
    /// Fine tuning in cents
    pub fine: &'a [Sample],
    /// Output volume (0.0 to 1.0)
    pub volume: &'a [Sample],
    /// Mode: 0/1=pulse, 2=triangle, 3=noise
    pub mode: &'a [Sample],
    /// Pulse duty cycle: 0=12.5%, 1=25%, 2=50%, 3=75%
    pub duty: &'a [Sample],
    /// Noise loop mode (true = short loop)
    pub noise_mode: &'a [Sample],
    /// Bit-crush amount (0.0 to 1.0)
    pub bitcrush: &'a [Sample],
}

/// Input signals for NES oscillator.
pub struct NesOscInputs<'a> {
    /// Pitch CV (1V/octave)
    pub pitch: Option<&'a [Sample]>,
}

impl NesOsc {
    /// Create a new NES oscillator.
    pub fn new(sample_rate: f32) -> Self {
        let mut phases = [0.0; 8];
        for (i, phase) in phases.iter_mut().enumerate() {
            *phase = i as f32 / 8.0;
        }
        Self {
            sample_rate: sample_rate.max(1.0),
            phases,
            lfsrs: [1; 8],
            noise_timers: [0.0; 8],
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Generate NES pulse wave with specified duty cycle.
    fn nes_pulse(phase: f32, duty: u8) -> f32 {
        let threshold = match duty {
            0 => 0.125,
            1 => 0.25,
            2 => 0.5,
            3 => 0.75,
            _ => 0.5,
        };
        if phase < threshold { 1.0 } else { -1.0 }
    }

    /// Generate NES 4-bit triangle wave (32 steps).
    fn nes_triangle(step: u8) -> f32 {
        let level = if step < 16 { step } else { 31 - step };
        (level as f32 / 7.5) - 1.0
    }

    /// Generate NES noise using LFSR.
    fn nes_noise(lfsr: &mut u16, loop_mode: bool) -> f32 {
        let feedback = if loop_mode {
            ((*lfsr & 1) ^ ((*lfsr >> 6) & 1)) as u16
        } else {
            ((*lfsr & 1) ^ ((*lfsr >> 1) & 1)) as u16
        };
        *lfsr = (*lfsr >> 1) | (feedback << 14);
        if *lfsr & 1 == 1 { 1.0 } else { -1.0 }
    }

    /// Apply 7-bit DAC quantization for lo-fi effect.
    fn dac_7bit(sample: f32, amount: f32) -> f32 {
        if amount <= 0.0 { return sample; }
        let t = 1.0 - amount;
        let levels = 64.0 + t * (128.0 - 64.0);
        let quantized = (sample * levels).round() / levels;
        sample * (1.0 - amount) + quantized * amount
    }

    /// Process a block of audio.
    pub fn process_block(&mut self, output: &mut [Sample], inputs: NesOscInputs, params: NesOscParams) {
        for i in 0..output.len() {
            let base = sample_at(params.base_freq, i, 220.0);
            let fine_cents = sample_at(params.fine, i, 0.0);
            let pitch_cv = inputs.pitch.map_or(0.0, |p| sample_at(p, i, 0.0));
            let freq = base * (2.0_f32).powf(pitch_cv + fine_cents / 1200.0);
            let freq = freq.clamp(20.0, 20000.0);
            let vol = sample_at(params.volume, i, 1.0).clamp(0.0, 1.0);
            let mode_val = sample_at(params.mode, i, 0.0) as u8;
            let duty_val = sample_at(params.duty, i, 1.0) as u8;
            let noise_loop = sample_at(params.noise_mode, i, 0.0) >= 0.5;
            let crush = sample_at(params.bitcrush, i, 1.0).clamp(0.0, 1.0);

            let sample = match mode_val {
                0 | 1 => {
                    let phase_inc = freq / self.sample_rate;
                    self.phases[0] += phase_inc;
                    if self.phases[0] >= 1.0 { self.phases[0] -= 1.0; }
                    Self::nes_pulse(self.phases[0], duty_val)
                }
                2 => {
                    // NES Triangle: 4-bit stepped waveform (32 steps per cycle)
                    let phase_inc = freq / self.sample_rate;
                    self.phases[0] += phase_inc;
                    if self.phases[0] >= 1.0 { self.phases[0] -= 1.0; }
                    let step = (self.phases[0] * 32.0) as u8;
                    Self::nes_triangle(step)
                }
                3 => {
                    let noise_freq = freq * 8.0;
                    let phase_inc = noise_freq / self.sample_rate;
                    self.noise_timers[0] += phase_inc;
                    if self.noise_timers[0] >= 1.0 {
                        self.noise_timers[0] -= 1.0;
                        Self::nes_noise(&mut self.lfsrs[0], noise_loop);
                    }
                    if self.lfsrs[0] & 1 == 1 { 1.0 } else { -1.0 }
                }
                _ => 0.0,
            };
            output[i] = Self::dac_7bit(sample * vol, crush);
        }
    }
}
