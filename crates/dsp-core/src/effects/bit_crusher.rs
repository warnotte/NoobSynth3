//! Bit Crusher / Sample Rate Reducer effect.
//!
//! Reduces bit depth and sample rate for lo-fi,
//! chiptune, and glitch aesthetics.

use crate::common::{input_at, sample_at, Sample};

pub struct BitCrusher {
    hold_l: f32,
    hold_r: f32,
    phase: f32,
}

pub struct BitCrusherInputs<'a> {
    pub input_l: Option<&'a [Sample]>,
    pub input_r: Option<&'a [Sample]>,
}

pub struct BitCrusherParams<'a> {
    /// Bit depth (1-16, where 16 = clean)
    pub bits: &'a [Sample],
    /// Sample rate reduction factor (1-40, where 1 = clean)
    pub downsample: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
}

impl BitCrusher {
    pub fn new() -> Self {
        Self {
            hold_l: 0.0,
            hold_r: 0.0,
            phase: 0.0,
        }
    }

    fn crush(sample: f32, bits: f32) -> f32 {
        let bits = bits.clamp(1.0, 16.0);
        let steps = (2.0_f32).powf(bits);
        (sample * steps).round() / steps
    }

    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: BitCrusherInputs<'_>,
        params: BitCrusherParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        for i in 0..out_l.len() {
            let bits = sample_at(params.bits, i, 16.0).clamp(1.0, 16.0);
            let downsample = sample_at(params.downsample, i, 1.0).clamp(1.0, 40.0);
            let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);

            let in_l = input_at(inputs.input_l, i);
            let in_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => in_l,
            };

            // Sample rate reduction: only update held value every N samples
            self.phase += 1.0;
            if self.phase >= downsample {
                self.phase -= downsample;
                self.hold_l = Self::crush(in_l, bits);
                self.hold_r = Self::crush(in_r, bits);
            }

            let dry = 1.0 - mix;
            out_l[i] = in_l * dry + self.hold_l * mix;
            out_r[i] = in_r * dry + self.hold_r * mix;
        }
    }
}
