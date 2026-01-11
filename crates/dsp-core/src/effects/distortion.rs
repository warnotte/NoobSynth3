//! Distortion effect with multiple modes.
//!
//! Provides soft clip, hard clip, and foldback distortion types.

use crate::common::{input_at, sample_at, Sample};

/// Multi-mode distortion effect.
///
/// # Modes
///
/// - 0: Soft clip (tanh-style)
/// - 1: Hard clip
/// - 2: Foldback distortion
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{Distortion, DistortionParams};
///
/// let mut output = [0.0f32; 128];
/// Distortion::process_block(&mut output, input, params);
/// ```
pub struct Distortion;

/// Parameters for Distortion.
pub struct DistortionParams<'a> {
    /// Drive amount (0-1)
    pub drive: &'a [Sample],
    /// Tone/brightness (0-1)
    pub tone: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
    /// Distortion mode (0=soft, 1=hard, 2=foldback)
    pub mode: &'a [Sample],
}

impl Distortion {
    /// Process a block of audio.
    pub fn process_block(
        output: &mut [Sample],
        input: Option<&[Sample]>,
        params: DistortionParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        for i in 0..output.len() {
            let drive = sample_at(params.drive, i, 0.5).clamp(0.0, 1.0);
            let tone = sample_at(params.tone, i, 0.5).clamp(0.0, 1.0);
            let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);
            let mode = sample_at(params.mode, i, 0.0);

            let in_sample = input_at(input, i);
            let gain = 1.0 + drive * 20.0;
            let driven = in_sample * gain;

            // Mode: 0 = soft clip (tanh), 1 = hard clip, 2 = foldback
            let shaped = if mode < 0.5 {
                // Soft clip (tanh approximation)
                let x = driven.clamp(-3.0, 3.0);
                x * (27.0 + x * x) / (27.0 + 9.0 * x * x)
            } else if mode < 1.5 {
                // Hard clip
                driven.clamp(-1.0, 1.0)
            } else {
                // Foldback
                let mut x = driven;
                while x > 1.0 || x < -1.0 {
                    if x > 1.0 {
                        x = 2.0 - x;
                    }
                    if x < -1.0 {
                        x = -2.0 - x;
                    }
                }
                x
            };

            // Simple tone control (lowpass)
            let output_sample = shaped * tone + shaped * (1.0 - tone) * 0.7;
            let dry = 1.0 - mix;
            output[i] = in_sample * dry + output_sample * mix;
        }
    }
}
