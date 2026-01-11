//! Pitch Quantizer module.
//!
//! Quantizes continuous pitch CV to discrete scale degrees,
//! ensuring notes stay in key.

use crate::common::{input_at, sample_at, Sample};

// Scale definitions (semitone offsets from root)
const SCALE_CHROMATIC: [i32; 12] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const SCALE_MAJOR: [i32; 7] = [0, 2, 4, 5, 7, 9, 11];
const SCALE_MINOR: [i32; 7] = [0, 2, 3, 5, 7, 8, 10];
const SCALE_DORIAN: [i32; 7] = [0, 2, 3, 5, 7, 9, 10];
const SCALE_LYDIAN: [i32; 7] = [0, 2, 4, 6, 7, 9, 11];
const SCALE_MIXOLYDIAN: [i32; 7] = [0, 2, 4, 5, 7, 9, 10];
const SCALE_PENT_MAJOR: [i32; 5] = [0, 2, 4, 7, 9];
const SCALE_PENT_MINOR: [i32; 5] = [0, 3, 5, 7, 10];

const SCALES: [&[i32]; 8] = [
    &SCALE_CHROMATIC,
    &SCALE_MAJOR,
    &SCALE_MINOR,
    &SCALE_DORIAN,
    &SCALE_LYDIAN,
    &SCALE_MIXOLYDIAN,
    &SCALE_PENT_MAJOR,
    &SCALE_PENT_MINOR,
];

/// Pitch quantizer.
///
/// Quantizes incoming pitch CV to the nearest note in a selected scale.
/// Input and output are in V/octave format (1.0 = 1 octave = 12 semitones).
///
/// # Scales
///
/// - 0: Chromatic (all 12 notes)
/// - 1: Major (Ionian)
/// - 2: Natural Minor (Aeolian)
/// - 3: Dorian
/// - 4: Lydian
/// - 5: Mixolydian
/// - 6: Major Pentatonic
/// - 7: Minor Pentatonic
///
/// # Example
///
/// ```ignore
/// use dsp_core::modulators::{Quantizer, QuantizerParams, QuantizerInputs};
///
/// let mut output = [0.0f32; 128];
/// Quantizer::process_block(&mut output, inputs, params);
/// ```
pub struct Quantizer;

/// Input signals for Quantizer.
pub struct QuantizerInputs<'a> {
    /// Pitch CV input (V/octave)
    pub input: Option<&'a [Sample]>,
}

/// Parameters for Quantizer.
pub struct QuantizerParams<'a> {
    /// Root note (0-11: C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
    pub root: &'a [Sample],
    /// Scale index (0-7)
    pub scale: &'a [Sample],
}

impl Quantizer {
    /// Process a block of samples.
    pub fn process_block(
        output: &mut [Sample],
        inputs: QuantizerInputs<'_>,
        params: QuantizerParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        for i in 0..output.len() {
            let input = input_at(inputs.input, i);
            let root = sample_at(params.root, i, 0.0).round().clamp(0.0, 11.0) as i32;
            let scale_index = sample_at(params.scale, i, 0.0).round();
            let scale_index = if scale_index.is_finite() {
                scale_index as i32
            } else {
                0
            };
            let scale_index = scale_index.clamp(0, (SCALES.len() - 1) as i32) as usize;
            let scale = SCALES[scale_index];

            // Convert V/oct to semitones
            let semitone = input * 12.0;
            let base_octave = (semitone / 12.0).floor() as i32;

            // Find nearest note in scale
            let mut best_note = semitone;
            let mut best_diff = f32::MAX;

            // Check notes in adjacent octaves to find true nearest
            for oct in (base_octave - 1)..=(base_octave + 1) {
                for offset in scale {
                    let candidate = (oct * 12 + root + offset) as f32;
                    let diff = (candidate - semitone).abs();
                    if diff < best_diff {
                        best_diff = diff;
                        best_note = candidate;
                    }
                }
            }

            // Convert back to V/oct
            output[i] = best_note / 12.0;
        }
    }
}
