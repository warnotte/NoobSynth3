//! SNES S-DSP oscillator emulation with wavetables.
//!
//! Emulates the sound chip from the Super Nintendo Entertainment System,
//! featuring 8 different wavetables and optional lo-fi processing.

use crate::common::{sample_at, Sample};

// =============================================================================
// SNES Wavetables (32 samples each)
// =============================================================================

const WAVE_SQUARE: [f32; 32] = [
    1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
    -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0,
];

const WAVE_SAW: [f32; 32] = [
    -1.0, -0.9375, -0.875, -0.8125, -0.75, -0.6875, -0.625, -0.5625,
    -0.5, -0.4375, -0.375, -0.3125, -0.25, -0.1875, -0.125, -0.0625,
    0.0, 0.0625, 0.125, 0.1875, 0.25, 0.3125, 0.375, 0.4375,
    0.5, 0.5625, 0.625, 0.6875, 0.75, 0.8125, 0.875, 0.9375,
];

const WAVE_STRINGS: [f32; 32] = [
    0.0, 0.4, 0.7, 0.9, 1.0, 0.9, 0.7, 0.4, 0.0, -0.3, -0.5, -0.6, -0.5, -0.3, 0.0, 0.2,
    0.3, 0.2, 0.0, -0.2, -0.4, -0.5, -0.4, -0.2, 0.0, 0.1, 0.2, 0.1, 0.0, -0.1, -0.2, -0.1,
];

const WAVE_BELL: [f32; 32] = [
    0.0, 0.7, 1.0, 0.7, 0.0, -0.5, -0.7, -0.5, 0.0, 0.3, 0.5, 0.3, 0.0, -0.2, -0.3, -0.2,
    0.0, 0.15, 0.2, 0.15, 0.0, -0.1, -0.15, -0.1, 0.0, 0.05, 0.1, 0.05, 0.0, -0.05, -0.1, -0.05,
];

const WAVE_ORGAN: [f32; 32] = [
    0.0, 0.5, 0.87, 1.0, 0.87, 0.5, 0.0, -0.5, -0.87, -1.0, -0.87, -0.5, 0.0, 0.25, 0.43, 0.5,
    0.43, 0.25, 0.0, -0.25, -0.43, -0.5, -0.43, -0.25, 0.0, 0.17, 0.29, 0.33, 0.29, 0.17, 0.0, -0.17,
];

const WAVE_PAD: [f32; 32] = [
    0.0, 0.2, 0.4, 0.55, 0.65, 0.7, 0.72, 0.7, 0.65, 0.55, 0.4, 0.2, 0.0, -0.2, -0.35, -0.45,
    -0.5, -0.45, -0.35, -0.2, 0.0, 0.15, 0.25, 0.3, 0.25, 0.15, 0.0, -0.1, -0.15, -0.15, -0.1, 0.0,
];

const WAVE_BASS: [f32; 32] = [
    0.0, 0.6, 1.0, 1.0, 0.8, 0.5, 0.2, 0.0, -0.2, -0.4, -0.5, -0.6, -0.6, -0.5, -0.4, -0.3,
    -0.2, -0.1, 0.0, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.05, 0.0, -0.05, -0.1, -0.1, -0.05, 0.0,
];

const WAVE_SYNTH: [f32; 32] = [
    1.0, 0.9, 0.6, 0.2, -0.2, -0.5, -0.7, -0.8, -0.8, -0.7, -0.5, -0.2, 0.1, 0.4, 0.6, 0.7,
    0.7, 0.6, 0.4, 0.1, -0.1, -0.3, -0.4, -0.4, -0.3, -0.2, -0.1, 0.0, 0.1, 0.15, 0.15, 0.1,
];

const SNES_WAVETABLES: [&[f32; 32]; 8] = [
    &WAVE_SQUARE, &WAVE_SAW, &WAVE_STRINGS, &WAVE_BELL,
    &WAVE_ORGAN, &WAVE_PAD, &WAVE_BASS, &WAVE_SYNTH,
];

/// SNES S-DSP oscillator with wavetable synthesis.
///
/// Provides authentic 16-bit SNES sounds using 8 pre-defined wavetables
/// with optional Gaussian interpolation and lo-fi processing.
///
/// # Wavetables
///
/// - 0: Square
/// - 1: Sawtooth
/// - 2: Strings
/// - 3: Bell
/// - 4: Organ
/// - 5: Pad
/// - 6: Bass
/// - 7: Synth
///
/// # Example
///
/// ```ignore
/// use dsp_core::oscillators::{SnesOsc, SnesOscParams, SnesOscInputs};
///
/// let mut osc = SnesOsc::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// osc.process_block(&mut output, inputs, params);
/// ```
pub struct SnesOsc {
    sample_rate: f32,
    phases: [f32; 8],
    decim_counters: [f32; 8],
    last_samples: [f32; 8],
}

/// Parameters for SNES oscillator.
pub struct SnesOscParams<'a> {
    /// Base frequency in Hz
    pub base_freq: &'a [Sample],
    /// Fine tuning in cents
    pub fine: &'a [Sample],
    /// Output volume (0.0 to 1.0)
    pub volume: &'a [Sample],
    /// Wavetable index (0-7)
    pub wave: &'a [Sample],
    /// Gaussian interpolation amount (0-1)
    pub gauss: &'a [Sample],
    /// Color/character (0-1)
    pub color: &'a [Sample],
    /// Lo-fi amount (sample rate reduction, 0-1)
    pub lofi: &'a [Sample],
}

/// Input signals for SNES oscillator.
pub struct SnesOscInputs<'a> {
    /// Pitch CV (1V/octave)
    pub pitch: Option<&'a [Sample]>,
}

impl SnesOsc {
    /// Create a new SNES oscillator.
    pub fn new(sample_rate: f32) -> Self {
        let mut phases = [0.0; 8];
        for (i, phase) in phases.iter_mut().enumerate() {
            *phase = i as f32 / 8.0;
        }
        Self {
            sample_rate: sample_rate.max(1.0),
            phases,
            decim_counters: [0.0; 8],
            last_samples: [0.0; 8],
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Gaussian/cubic interpolation for smooth wavetable playback.
    fn gaussian_interpolate(samples: &[f32; 4], frac: f32) -> f32 {
        let t = frac;
        let t2 = t * t;
        let t3 = t2 * t;
        let c0 = -0.5 * t3 + t2 - 0.5 * t;
        let c1 = 1.5 * t3 - 2.5 * t2 + 1.0;
        let c2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
        let c3 = 0.5 * t3 - 0.5 * t2;
        samples[0] * c0 + samples[1] * c1 + samples[2] * c2 + samples[3] * c3
    }

    /// Process a block of audio.
    pub fn process_block(&mut self, output: &mut [Sample], inputs: SnesOscInputs, params: SnesOscParams) {
        for i in 0..output.len() {
            let base = sample_at(params.base_freq, i, 220.0);
            let fine_cents = sample_at(params.fine, i, 0.0);
            let pitch_cv = inputs.pitch.map_or(0.0, |p| sample_at(p, i, 0.0));
            let freq = base * (2.0_f32).powf(pitch_cv + fine_cents / 1200.0);
            let freq = freq.clamp(20.0, 20000.0);
            let vol = sample_at(params.volume, i, 1.0).clamp(0.0, 1.0);
            let wave_idx = (sample_at(params.wave, i, 0.0) as usize).min(7);
            let gauss_amt = sample_at(params.gauss, i, 0.7).clamp(0.0, 1.0);
            let color_amt = sample_at(params.color, i, 0.5).clamp(0.0, 1.0);
            let lofi_amt = sample_at(params.lofi, i, 0.5).clamp(0.0, 1.0);

            let wavetable = SNES_WAVETABLES[wave_idx];
            let phase_inc = freq / self.sample_rate;
            self.phases[0] += phase_inc;
            if self.phases[0] >= 1.0 { self.phases[0] -= 1.0; }

            let table_pos = self.phases[0] * 32.0;
            let idx = table_pos as usize;
            let frac = table_pos - idx as f32;

            // Get 4 samples for interpolation
            let s0 = wavetable[(idx + 31) % 32];
            let s1 = wavetable[idx % 32];
            let s2 = wavetable[(idx + 1) % 32];
            let s3 = wavetable[(idx + 2) % 32];
            let samples_arr = [s0, s1, s2, s3];

            // Blend between linear and Gaussian interpolation
            let gauss_sample = Self::gaussian_interpolate(&samples_arr, frac);
            let linear_sample = s1 + frac * (s2 - s1);
            let mut sample = linear_sample * (1.0 - gauss_amt) + gauss_sample * gauss_amt;

            // Color processing
            if color_amt > 0.5 {
                let t = (color_amt - 0.5) * 2.0;
                sample = sample * (1.0 - t) + s1 * t;
            }

            // Lo-fi processing (sample rate reduction)
            if lofi_amt > 0.0 {
                let decim_rate = 32000.0 / self.sample_rate;
                self.decim_counters[0] += decim_rate * lofi_amt;
                if self.decim_counters[0] >= 1.0 {
                    self.decim_counters[0] -= 1.0;
                    self.last_samples[0] = sample;
                }
                sample = sample * (1.0 - lofi_amt) + self.last_samples[0] * lofi_amt;
            }

            output[i] = sample * vol;
        }
    }
}
