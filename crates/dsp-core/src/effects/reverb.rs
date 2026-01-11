//! Freeverb-style stereo reverb.
//!
//! Algorithmic reverb using parallel comb filters followed
//! by series allpass filters with pre-delay.

use crate::common::{clamp, input_at, sample_at, Sample};

/// Comb filter for reverb.
pub struct CombFilter {
    buffer: Vec<Sample>,
    index: usize,
    filter_store: f32,
    feedback: f32,
    damp1: f32,
    damp2: f32,
}

impl CombFilter {
    /// Create a new comb filter with the given size.
    pub fn new(size: usize) -> Self {
        Self {
            buffer: vec![0.0; size],
            index: 0,
            filter_store: 0.0,
            feedback: 0.5,
            damp1: 0.2,
            damp2: 0.8,
        }
    }

    /// Set the feedback amount.
    pub fn set_feedback(&mut self, value: f32) {
        self.feedback = value;
    }

    /// Set the damping amount.
    pub fn set_damp(&mut self, value: f32) {
        self.damp1 = clamp(value, 0.0, 0.99);
        self.damp2 = 1.0 - self.damp1;
    }

    /// Process a single sample.
    pub fn process(&mut self, input: f32) -> f32 {
        let output = self.buffer[self.index];
        self.filter_store = output * self.damp2 + self.filter_store * self.damp1;
        self.buffer[self.index] = input + self.filter_store * self.feedback;
        self.index = (self.index + 1) % self.buffer.len();
        output
    }
}

/// Allpass filter for reverb diffusion.
pub struct AllpassFilter {
    buffer: Vec<Sample>,
    index: usize,
    feedback: f32,
}

impl AllpassFilter {
    /// Create a new allpass filter.
    pub fn new(size: usize, feedback: f32) -> Self {
        Self {
            buffer: vec![0.0; size],
            index: 0,
            feedback,
        }
    }

    /// Process a single sample.
    pub fn process(&mut self, input: f32) -> f32 {
        let buffer_out = self.buffer[self.index];
        let output = -input + buffer_out;
        self.buffer[self.index] = input + buffer_out * self.feedback;
        self.index = (self.index + 1) % self.buffer.len();
        output
    }
}

/// Freeverb-style stereo reverb.
///
/// Uses 4 parallel comb filters and 2 series allpass filters
/// per channel with pre-delay for spaciousness.
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{Reverb, ReverbParams, ReverbInputs};
///
/// let mut reverb = Reverb::new(44100.0);
/// let mut out_l = [0.0f32; 128];
/// let mut out_r = [0.0f32; 128];
///
/// reverb.process_block(&mut out_l, &mut out_r, inputs, params);
/// ```
pub struct Reverb {
    sample_rate: f32,
    combs_l: Vec<CombFilter>,
    combs_r: Vec<CombFilter>,
    allpass_l: Vec<AllpassFilter>,
    allpass_r: Vec<AllpassFilter>,
    pre_buffer_l: Vec<Sample>,
    pre_buffer_r: Vec<Sample>,
    pre_write_index: usize,
}

/// Input signals for Reverb.
pub struct ReverbInputs<'a> {
    /// Left audio input
    pub input_l: Option<&'a [Sample]>,
    /// Right audio input
    pub input_r: Option<&'a [Sample]>,
}

/// Parameters for Reverb.
pub struct ReverbParams<'a> {
    /// Reverb time (0.1-0.98)
    pub time: &'a [Sample],
    /// Damping (0-1, higher = darker)
    pub damp: &'a [Sample],
    /// Pre-delay in ms (0-120)
    pub pre_delay: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
}

impl Reverb {
    /// Create a new reverb.
    pub fn new(sample_rate: f32) -> Self {
        let mut reverb = Self {
            sample_rate: sample_rate.max(1.0),
            combs_l: Vec::new(),
            combs_r: Vec::new(),
            allpass_l: Vec::new(),
            allpass_r: Vec::new(),
            pre_buffer_l: Vec::new(),
            pre_buffer_r: Vec::new(),
            pre_write_index: 0,
        };
        reverb.allocate_buffers();
        reverb
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        self.allocate_buffers();
    }

    fn allocate_buffers(&mut self) {
        let scale = self.sample_rate / 44100.0;
        let comb_tuning = [1116, 1188, 1277, 1356];
        let allpass_tuning = [556, 441];
        let stereo_spread = 23;

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

        let max_pre_delay_ms = 120.0;
        let pre_samples = ((max_pre_delay_ms / 1000.0) * self.sample_rate).ceil() as usize + 2;
        self.pre_buffer_l = vec![0.0; pre_samples];
        self.pre_buffer_r = vec![0.0; pre_samples];
        self.pre_write_index = 0;
    }

    fn read_delay(&self, buffer: &[Sample], delay_samples: f32) -> f32 {
        let size = buffer.len() as i32;
        let read_pos = self.pre_write_index as f32 - delay_samples;
        let base_index = read_pos.floor();
        let mut index_a = base_index as i32 % size;
        if index_a < 0 {
            index_a += size;
        }
        let index_b = (index_a + 1) % size;
        let frac = read_pos - base_index;
        let a = buffer[index_a as usize];
        let b = buffer[index_b as usize];
        a + (b - a) * frac
    }

    /// Process a block of stereo audio.
    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: ReverbInputs<'_>,
        params: ReverbParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        let time = clamp(sample_at(params.time, 0, 0.62), 0.1, 0.98);
        let damp = clamp(sample_at(params.damp, 0, 0.4), 0.0, 1.0);
        let room_size = clamp(0.2 + time * 0.78, 0.2, 0.98);
        let damp_value = 0.05 + damp * 0.9;

        for comb in &mut self.combs_l {
            comb.set_feedback(room_size);
            comb.set_damp(damp_value);
        }
        for comb in &mut self.combs_r {
            comb.set_feedback(room_size);
            comb.set_damp(damp_value);
        }

        let pre_buffer_size = self.pre_buffer_l.len();
        let max_pre_delay = (pre_buffer_size as f32 - 2.0) / self.sample_rate * 1000.0;

        for i in 0..out_l.len() {
            let mix = clamp(sample_at(params.mix, i, 0.25), 0.0, 1.0);
            let pre_delay_ms = sample_at(params.pre_delay, i, 0.0);
            let pre_delay_samples =
                clamp((pre_delay_ms * self.sample_rate) / 1000.0, 0.0, max_pre_delay);

            let in_l = input_at(inputs.input_l, i);
            let in_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => in_l,
            };

            let pre_l = self.read_delay(&self.pre_buffer_l, pre_delay_samples);
            let pre_r = self.read_delay(&self.pre_buffer_r, pre_delay_samples);

            self.pre_buffer_l[self.pre_write_index] = in_l;
            self.pre_buffer_r[self.pre_write_index] = in_r;
            self.pre_write_index = (self.pre_write_index + 1) % pre_buffer_size;

            let input_gain = 0.35;
            let reverb_in_l = pre_l * input_gain;
            let reverb_in_r = pre_r * input_gain;

            let mut wet_l = 0.0;
            let mut wet_r = 0.0;
            for comb in &mut self.combs_l {
                wet_l += comb.process(reverb_in_l);
            }
            for comb in &mut self.combs_r {
                wet_r += comb.process(reverb_in_r);
            }
            for allpass in &mut self.allpass_l {
                wet_l = allpass.process(wet_l);
            }
            for allpass in &mut self.allpass_r {
                wet_r = allpass.process(wet_r);
            }

            let wet_scale = 0.3;
            wet_l *= wet_scale;
            wet_r *= wet_scale;

            let dry = 1.0 - mix;
            out_l[i] = in_l * dry + wet_l * mix;
            out_r[i] = in_r * dry + wet_r * mix;
        }
    }
}
