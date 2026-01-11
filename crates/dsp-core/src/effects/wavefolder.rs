//! Wavefolder effect for complex harmonic generation.
//!
//! Folds the waveform back on itself when it exceeds a threshold,
//! creating rich overtones.

use crate::common::{input_at, sample_at, saturate, Sample};

/// Wavefolder effect.
///
/// Creates complex harmonics by folding the waveform back when
/// it exceeds a threshold. Great for adding grit and texture.
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{Wavefolder, WavefolderParams};
///
/// let mut output = [0.0f32; 128];
/// Wavefolder::process_block(&mut output, input, params);
/// ```
pub struct Wavefolder;

/// Parameters for Wavefolder.
pub struct WavefolderParams<'a> {
    /// Input drive/gain (0-1)
    pub drive: &'a [Sample],
    /// Fold amount (0-1, lower threshold = more folding)
    pub fold: &'a [Sample],
    /// DC bias before folding (-1 to 1)
    pub bias: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
}

impl Wavefolder {
    /// Fold a value back when it exceeds the threshold.
    fn foldback(value: f32, threshold: f32) -> f32 {
        if threshold <= 0.0 {
            return value;
        }
        let limit = threshold.abs();
        if value <= limit && value >= -limit {
            return value;
        }
        let range = 4.0 * limit;
        let mut folded = (value + limit).rem_euclid(range);
        if folded > 2.0 * limit {
            folded = range - folded;
        }
        folded - limit
    }

    /// Process a block of audio.
    pub fn process_block(
        output: &mut [Sample],
        input: Option<&[Sample]>,
        params: WavefolderParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        for i in 0..output.len() {
            let drive = sample_at(params.drive, i, 0.4).clamp(0.0, 1.0);
            let fold = sample_at(params.fold, i, 0.5).clamp(0.0, 1.0);
            let bias = sample_at(params.bias, i, 0.0).clamp(-1.0, 1.0);
            let mix = sample_at(params.mix, i, 0.8).clamp(0.0, 1.0);

            let input_sample = input_at(input, i);
            let pre = input_sample * (1.0 + drive * 8.0) + bias;
            let threshold = (1.0 - fold * 0.85).clamp(0.1, 1.0);
            let folded = Self::foldback(pre, threshold);
            let shaped = saturate(folded * (1.0 + fold * 0.5));

            let dry = 1.0 - mix;
            output[i] = input_sample * dry + shaped * mix;
        }
    }
}
