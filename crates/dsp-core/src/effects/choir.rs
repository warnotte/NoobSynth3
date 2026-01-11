//! Choir/formant effect using resonant bandpass filters.
//!
//! Simulates vocal formants by filtering audio through
//! tuned bandpass filters that correspond to vowel sounds.

use crate::common::{input_at, sample_at, Sample};

/// Bandpass filter for formant simulation.
#[derive(Clone, Copy)]
pub struct FormantFilter {
    ic1: f32,
    ic2: f32,
}

impl Default for FormantFilter {
    fn default() -> Self {
        Self { ic1: 0.0, ic2: 0.0 }
    }
}

impl FormantFilter {
    /// Process a sample through the bandpass filter.
    pub fn process(&mut self, input: f32, cutoff: f32, q: f32, sample_rate: f32) -> f32 {
        let cutoff = cutoff.min(sample_rate * 0.45).max(20.0);
        let g = (std::f32::consts::PI * cutoff / sample_rate).tan();
        let k = 1.0 / q.max(0.1);
        let a1 = 1.0 / (1.0 + g * (g + k));
        let a2 = g * a1;
        let a3 = g * a2;
        let v3 = input - self.ic2;
        let v1 = a1 * self.ic1 + a2 * v3;
        let v2 = self.ic2 + a2 * self.ic1 + a3 * v3;
        self.ic1 = 2.0 * v1 - self.ic1;
        self.ic2 = 2.0 * v2 - self.ic2;
        v1 // Bandpass output
    }
}

/// Choir/formant filter effect.
///
/// Uses three bandpass filters tuned to vowel formant frequencies
/// to create vowel-like sounds from any input.
///
/// # Vowels
///
/// - 0: A (as in "father")
/// - 1: E (as in "bed")
/// - 2: I (as in "see")
/// - 3: O (as in "go")
/// - 4: U (as in "blue")
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{Choir, ChoirParams, ChoirInputs};
///
/// let mut choir = Choir::new(44100.0);
/// let mut out_l = [0.0f32; 128];
/// let mut out_r = [0.0f32; 128];
///
/// choir.process_block(&mut out_l, &mut out_r, inputs, params);
/// ```
pub struct Choir {
    sample_rate: f32,
    phase: f32,
    filters_l: [FormantFilter; 3],
    filters_r: [FormantFilter; 3],
}

/// Input signals for Choir.
pub struct ChoirInputs<'a> {
    /// Left audio input
    pub input_l: Option<&'a [Sample]>,
    /// Right audio input
    pub input_r: Option<&'a [Sample]>,
}

/// Parameters for Choir.
pub struct ChoirParams<'a> {
    /// Vowel select (0-4: A, E, I, O, U)
    pub vowel: &'a [Sample],
    /// LFO rate for formant modulation (0.05-2.0 Hz)
    pub rate: &'a [Sample],
    /// Modulation depth (0-1)
    pub depth: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
}

impl Choir {
    /// Create a new choir effect.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phase: 0.0,
            filters_l: [FormantFilter::default(); 3],
            filters_r: [FormantFilter::default(); 3],
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Process a block of stereo audio.
    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: ChoirInputs<'_>,
        params: ChoirParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        // Formant frequencies for A, E, I, O, U (F1, F2, F3)
        let vowels: [[f32; 3]; 5] = [
            [800.0, 1150.0, 2900.0],  // A
            [400.0, 1700.0, 2600.0],  // E
            [350.0, 1700.0, 2700.0],  // I
            [450.0, 800.0, 2830.0],   // O
            [325.0, 700.0, 2530.0],   // U
        ];
        let q_values = [5.0, 4.5, 4.0];
        let weights = [0.55, 0.45, 0.35];
        let tau = std::f32::consts::TAU;

        for i in 0..out_l.len() {
            let vowel = sample_at(params.vowel, i, 0.0).round().clamp(0.0, 4.0) as usize;
            let rate = sample_at(params.rate, i, 0.25).clamp(0.05, 2.0);
            let depth = sample_at(params.depth, i, 0.35).clamp(0.0, 1.0);
            let mix = sample_at(params.mix, i, 0.5).clamp(0.0, 1.0);

            let input_l = input_at(inputs.input_l, i);
            let input_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => input_l,
            };

            let lfo_l = self.phase.sin();
            let lfo_r = (self.phase + 0.7).sin();
            let mod_l = 1.0 + depth * 0.04 * lfo_l;
            let mod_r = 1.0 + depth * 0.04 * lfo_r;

            let mut wet_l = 0.0;
            let mut wet_r = 0.0;
            for band in 0..3 {
                let freq = vowels[vowel][band];
                wet_l += self.filters_l[band]
                    .process(input_l, freq * mod_l, q_values[band], self.sample_rate)
                    * weights[band];
                wet_r += self.filters_r[band]
                    .process(input_r, freq * mod_r, q_values[band], self.sample_rate)
                    * weights[band];
            }

            let dry = 1.0 - mix;
            out_l[i] = input_l * dry + wet_l * mix;
            out_r[i] = input_r * dry + wet_r * mix;

            self.phase += (tau * rate) / self.sample_rate;
            if self.phase >= tau {
                self.phase -= tau;
            }
        }
    }
}
