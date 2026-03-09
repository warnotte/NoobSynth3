//! Frequency shifter effect (Bode frequency shifter).
//!
//! Shifts all frequencies by a constant Hz offset using
//! Single Sideband (SSB) modulation via a Hilbert transform
//! approximation. Unlike a pitch shifter which multiplies
//! frequencies, this adds a fixed Hz offset to every partial.

use crate::common::{input_at, sample_at, Sample};

/// Allpass coefficients for Hilbert transform approximation (~15Hz-20kHz at 48kHz).
///
/// Chain A and Chain B produce two outputs that are ~90 degrees apart.
const HILBERT_COEFFS_A: [f32; 4] = [0.4021921162, 0.8561710882, 0.9722909545, 0.9952884791];
const HILBERT_COEFFS_B: [f32; 4] = [0.2024577506, 0.6890748679, 0.9360654323, 0.9882295227];

/// Allpass filter state: [x_prev, y_prev] for each stage.
type AllpassChain = [[f32; 2]; 4];

/// Bode frequency shifter effect.
///
/// Uses a Hilbert transform approximation (two chains of 4 allpass
/// filters each) to obtain a quadrature signal pair, then multiplies
/// by a quadrature oscillator to shift all frequencies by a constant
/// Hz offset.
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{FrequencyShifter, FrequencyShifterInputs, FrequencyShifterParams};
///
/// let mut shifter = FrequencyShifter::new(44100.0);
/// let mut out_l = [0.0f32; 128];
/// let mut out_r = [0.0f32; 128];
///
/// shifter.process_block(&mut out_l, &mut out_r, inputs, params);
/// ```
pub struct FrequencyShifter {
    sample_rate: f32,
    phase: f32,
    /// Allpass chains for left channel: [chain_a, chain_b]
    allpass_l_a: AllpassChain,
    allpass_l_b: AllpassChain,
    /// Allpass chains for right channel: [chain_a, chain_b]
    allpass_r_a: AllpassChain,
    allpass_r_b: AllpassChain,
}

/// Input signals for FrequencyShifter.
pub struct FrequencyShifterInputs<'a> {
    /// Left audio input
    pub input_l: Option<&'a [Sample]>,
    /// Right audio input
    pub input_r: Option<&'a [Sample]>,
}

/// Parameters for FrequencyShifter.
pub struct FrequencyShifterParams<'a> {
    /// Frequency shift in Hz (-500 to +500)
    pub shift: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
}

/// Process one sample through a 4-stage allpass chain.
///
/// Each stage: `y = coeff * (x - y_prev) + x_prev`
#[inline]
fn process_allpass_chain(input: f32, chain: &mut AllpassChain, coeffs: &[f32; 4]) -> f32 {
    let mut x = input;
    for (stage, coeff) in chain.iter_mut().zip(coeffs.iter()) {
        let x_prev = stage[0];
        let y_prev = stage[1];
        let y = coeff * (x - y_prev) + x_prev;
        stage[0] = x;
        stage[1] = y;
        x = y;
    }
    x
}

impl FrequencyShifter {
    /// Create a new frequency shifter.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phase: 0.0,
            allpass_l_a: [[0.0; 2]; 4],
            allpass_l_b: [[0.0; 2]; 4],
            allpass_r_a: [[0.0; 2]; 4],
            allpass_r_b: [[0.0; 2]; 4],
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        let sr = sample_rate.max(1.0);
        if (sr - self.sample_rate).abs() > 0.1 {
            self.sample_rate = sr;
            // Reset allpass state to avoid glitches
            self.allpass_l_a = [[0.0; 2]; 4];
            self.allpass_l_b = [[0.0; 2]; 4];
            self.allpass_r_a = [[0.0; 2]; 4];
            self.allpass_r_b = [[0.0; 2]; 4];
            self.phase = 0.0;
        }
    }

    /// Process a block of stereo audio.
    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: FrequencyShifterInputs<'_>,
        params: FrequencyShifterParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        let tau = std::f32::consts::TAU;

        for i in 0..out_l.len() {
            let shift = sample_at(params.shift, i, 0.0).clamp(-500.0, 500.0);
            let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);

            // Quadrature oscillator
            let cos_w = self.phase.cos();
            let sin_w = self.phase.sin();

            // --- Left channel ---
            let dry_l = input_at(inputs.input_l, i);
            let real_l = process_allpass_chain(dry_l, &mut self.allpass_l_a, &HILBERT_COEFFS_A);
            let imag_l = process_allpass_chain(dry_l, &mut self.allpass_l_b, &HILBERT_COEFFS_B);
            // Upper sideband (shift > 0 shifts up, shift < 0 shifts down)
            let wet_l = real_l * cos_w - imag_l * sin_w;
            out_l[i] = dry_l * (1.0 - mix) + wet_l * mix;

            // --- Right channel ---
            let dry_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => dry_l,
            };
            let real_r = process_allpass_chain(dry_r, &mut self.allpass_r_a, &HILBERT_COEFFS_A);
            let imag_r = process_allpass_chain(dry_r, &mut self.allpass_r_b, &HILBERT_COEFFS_B);
            let wet_r = real_r * cos_w - imag_r * sin_w;
            out_r[i] = dry_r * (1.0 - mix) + wet_r * mix;

            // Advance oscillator phase
            self.phase += tau * shift / self.sample_rate;
            // Keep phase in [0, TAU) to avoid float precision loss
            if self.phase >= tau {
                self.phase -= tau;
            } else if self.phase < 0.0 {
                self.phase += tau;
            }
        }
    }
}
