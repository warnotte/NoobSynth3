//! 4-stage phaser effect.
//!
//! Creates sweeping, jet-like sounds using cascaded
//! allpass filters modulated by an LFO.

use crate::common::{input_at, sample_at, Sample};

/// 4-stage stereo phaser.
///
/// Uses four cascaded first-order allpass filters with
/// LFO modulation and feedback for classic phaser sound.
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{Phaser, PhaserParams, PhaserInputs};
///
/// let mut phaser = Phaser::new(44100.0);
/// let mut out_l = [0.0f32; 128];
/// let mut out_r = [0.0f32; 128];
///
/// phaser.process_block(&mut out_l, &mut out_r, inputs, params);
/// ```
pub struct Phaser {
    sample_rate: f32,
    allpass_l: [f32; 4],
    allpass_r: [f32; 4],
    lfo_phase: f32,
}

/// Input signals for Phaser.
pub struct PhaserInputs<'a> {
    /// Left audio input
    pub input_l: Option<&'a [Sample]>,
    /// Right audio input
    pub input_r: Option<&'a [Sample]>,
}

/// Parameters for Phaser.
pub struct PhaserParams<'a> {
    /// LFO rate in Hz (0.05-5.0)
    pub rate: &'a [Sample],
    /// Modulation depth (0-1)
    pub depth: &'a [Sample],
    /// Feedback amount (0-0.9)
    pub feedback: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
}

impl Phaser {
    /// Create a new phaser.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            allpass_l: [0.0; 4],
            allpass_r: [0.0; 4],
            lfo_phase: 0.0,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn allpass(input: f32, coeff: f32, state: &mut f32) -> f32 {
        let output = *state - input * coeff;
        *state = input + output * coeff;
        output
    }

    /// Process a block of stereo audio.
    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: PhaserInputs<'_>,
        params: PhaserParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        let base_freqs: [f32; 4] = [200.0, 400.0, 800.0, 1600.0];

        for i in 0..out_l.len() {
            let rate = sample_at(params.rate, i, 0.5).clamp(0.05, 5.0);
            let depth = sample_at(params.depth, i, 0.7).clamp(0.0, 1.0);
            let feedback = sample_at(params.feedback, i, 0.3).clamp(0.0, 0.9);
            let mix = sample_at(params.mix, i, 0.5).clamp(0.0, 1.0);

            // LFO
            self.lfo_phase += rate / self.sample_rate;
            if self.lfo_phase >= 1.0 {
                self.lfo_phase -= 1.0;
            }
            let lfo = (self.lfo_phase * std::f32::consts::TAU).sin();
            let mod_amount = 0.5 + lfo * 0.5 * depth;

            let in_l = input_at(inputs.input_l, i);
            let in_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => in_l,
            };

            // Process allpass chain
            let mut proc_l = in_l + self.allpass_l[3] * feedback;
            let mut proc_r = in_r + self.allpass_r[3] * feedback;

            for stage in 0..4 {
                let freq = base_freqs[stage] * mod_amount;
                let coeff = (1.0 - freq / self.sample_rate).clamp(-0.99, 0.99);
                proc_l = Self::allpass(proc_l, coeff, &mut self.allpass_l[stage]);
                proc_r = Self::allpass(proc_r, coeff, &mut self.allpass_r[stage]);
            }

            let dry = 1.0 - mix;
            out_l[i] = in_l * dry + proc_l * mix;
            out_r[i] = in_r * dry + proc_r * mix;
        }
    }
}
