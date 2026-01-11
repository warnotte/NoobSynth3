//! Spring reverb emulation.
//!
//! Simulates a spring reverb tank with comb and allpass filters
//! and optional saturation for vintage character.

use super::reverb::{AllpassFilter, CombFilter};
use crate::common::{clamp, input_at, sample_at, saturate, Sample};

/// Spring reverb effect.
///
/// Emulates the sound of vintage spring reverb tanks with
/// characteristic metallic ring and saturation.
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{SpringReverb, SpringReverbParams, SpringReverbInputs};
///
/// let mut spring = SpringReverb::new(44100.0);
/// let mut out_l = [0.0f32; 128];
/// let mut out_r = [0.0f32; 128];
///
/// spring.process_block(&mut out_l, &mut out_r, inputs, params);
/// ```
pub struct SpringReverb {
    sample_rate: f32,
    combs_l: Vec<CombFilter>,
    combs_r: Vec<CombFilter>,
    allpass_l: Vec<AllpassFilter>,
    allpass_r: Vec<AllpassFilter>,
}

/// Input signals for SpringReverb.
pub struct SpringReverbInputs<'a> {
    /// Left audio input
    pub input_l: Option<&'a [Sample]>,
    /// Right audio input
    pub input_r: Option<&'a [Sample]>,
}

/// Parameters for SpringReverb.
pub struct SpringReverbParams<'a> {
    /// Decay amount (0-0.98)
    pub decay: &'a [Sample],
    /// Tone/brightness (0-1)
    pub tone: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
    /// Input drive/saturation (0-1)
    pub drive: &'a [Sample],
}

impl SpringReverb {
    /// Create a new spring reverb.
    pub fn new(sample_rate: f32) -> Self {
        let mut spring = Self {
            sample_rate: sample_rate.max(1.0),
            combs_l: Vec::new(),
            combs_r: Vec::new(),
            allpass_l: Vec::new(),
            allpass_r: Vec::new(),
        };
        spring.allocate_buffers();
        spring
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        self.allocate_buffers();
    }

    fn allocate_buffers(&mut self) {
        let scale = self.sample_rate / 44100.0;
        let comb_tuning = [1687, 2053, 2389];
        let allpass_tuning = [347, 113];
        let stereo_spread = 17;

        self.combs_l = comb_tuning
            .iter()
            .map(|length| CombFilter::new(((*length as f32 * scale).round() as usize).max(1)))
            .collect();
        self.combs_r = comb_tuning
            .iter()
            .map(|length| {
                CombFilter::new((((length + stereo_spread) as f32 * scale).round() as usize).max(1))
            })
            .collect();
        self.allpass_l = allpass_tuning
            .iter()
            .map(|length| {
                AllpassFilter::new(((*length as f32 * scale).round() as usize).max(1), 0.5)
            })
            .collect();
        self.allpass_r = allpass_tuning
            .iter()
            .map(|length| {
                AllpassFilter::new(
                    (((length + stereo_spread) as f32 * scale).round() as usize).max(1),
                    0.5,
                )
            })
            .collect();
    }

    /// Process a block of stereo audio.
    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: SpringReverbInputs<'_>,
        params: SpringReverbParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        let decay = clamp(sample_at(params.decay, 0, 0.6), 0.0, 0.98);
        let tone = clamp(sample_at(params.tone, 0, 0.4), 0.0, 1.0);
        let feedback = clamp(0.35 + decay * 0.6, 0.2, 0.98);
        let damp = 0.08 + (1.0 - tone) * 0.82;

        for comb in &mut self.combs_l {
            comb.set_feedback(feedback);
            comb.set_damp(damp);
        }
        for comb in &mut self.combs_r {
            comb.set_feedback(feedback);
            comb.set_damp(damp);
        }

        for i in 0..out_l.len() {
            let mix = clamp(sample_at(params.mix, i, 0.4), 0.0, 1.0);
            let drive = clamp(sample_at(params.drive, i, 0.2), 0.0, 1.0);

            let input_l = input_at(inputs.input_l, i);
            let input_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => input_l,
            };

            let drive_gain = 1.0 + drive * 4.0;
            let spring_in_l = saturate(input_l * drive_gain) * 0.35;
            let spring_in_r = saturate(input_r * drive_gain) * 0.35;

            let mut wet_l = 0.0;
            let mut wet_r = 0.0;
            for comb in &mut self.combs_l {
                wet_l += comb.process(spring_in_l);
            }
            for comb in &mut self.combs_r {
                wet_r += comb.process(spring_in_r);
            }
            for allpass in &mut self.allpass_l {
                wet_l = allpass.process(wet_l);
            }
            for allpass in &mut self.allpass_r {
                wet_r = allpass.process(wet_r);
            }

            let wet_scale = 0.4;
            wet_l *= wet_scale;
            wet_r *= wet_scale;

            let dry = 1.0 - mix;
            out_l[i] = input_l * dry + wet_l * mix;
            out_r[i] = input_r * dry + wet_r * mix;
        }
    }
}
