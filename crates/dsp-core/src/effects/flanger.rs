//! Stereo flanger effect with modulated delay and feedback.
//!
//! Creates a jet-like sweeping effect using very short modulated
//! delays with feedback. Negative feedback produces a hollow sound.

use crate::common::{clamp, input_at, sample_at, Sample};

/// Stereo flanger effect.
///
/// Uses an LFO to modulate a short delay time with feedback,
/// creating the classic flanging sweep.
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{Flanger, FlangerParams, FlangerInputs};
///
/// let mut flanger = Flanger::new(44100.0);
/// let mut out_l = [0.0f32; 128];
/// let mut out_r = [0.0f32; 128];
///
/// flanger.process_block(&mut out_l, &mut out_r, inputs, params);
/// ```
pub struct Flanger {
    sample_rate: f32,
    phase: f32,
    buffer_l: Vec<Sample>,
    buffer_r: Vec<Sample>,
    write_index: usize,
    feedback_l: f32,
    feedback_r: f32,
}

/// Input signals for Flanger.
pub struct FlangerInputs<'a> {
    /// Left audio input
    pub input_l: Option<&'a [Sample]>,
    /// Right audio input
    pub input_r: Option<&'a [Sample]>,
}

/// Parameters for Flanger.
pub struct FlangerParams<'a> {
    /// LFO rate in Hz (0.01-5.0)
    pub rate: &'a [Sample],
    /// Modulation depth in ms (0-5)
    pub depth_ms: &'a [Sample],
    /// Feedback amount (-0.95 to 0.95)
    pub feedback: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
}

impl Flanger {
    /// Create a new flanger effect.
    pub fn new(sample_rate: f32) -> Self {
        let mut flanger = Self {
            sample_rate: sample_rate.max(1.0),
            phase: 0.0,
            buffer_l: Vec::new(),
            buffer_r: Vec::new(),
            write_index: 0,
            feedback_l: 0.0,
            feedback_r: 0.0,
        };
        flanger.allocate_buffers();
        flanger
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        self.allocate_buffers();
    }

    fn allocate_buffers(&mut self) {
        let max_delay_ms = 10.0;
        let max_samples = ((max_delay_ms / 1000.0) * self.sample_rate).ceil() as usize + 2;
        if self.buffer_l.len() != max_samples {
            self.buffer_l = vec![0.0; max_samples];
            self.buffer_r = vec![0.0; max_samples];
            self.write_index = 0;
            self.phase = 0.0;
            self.feedback_l = 0.0;
            self.feedback_r = 0.0;
        }
    }

    fn read_delay(&self, buffer: &[Sample], delay_samples: f32) -> f32 {
        let size = buffer.len() as i32;
        let read_pos = self.write_index as f32 - delay_samples;
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
        inputs: FlangerInputs<'_>,
        params: FlangerParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        let buffer_size = self.buffer_l.len();
        let tau = std::f32::consts::TAU;
        let phase_offset = std::f32::consts::FRAC_PI_2;

        for i in 0..out_l.len() {
            let rate = sample_at(params.rate, i, 0.3);
            let depth_ms = sample_at(params.depth_ms, i, 2.0);
            let feedback = sample_at(params.feedback, i, 0.5).clamp(-0.95, 0.95);
            let mix = sample_at(params.mix, i, 0.5);

            let base_ms = 1.0;
            let lfo_l = (self.phase).sin();
            let lfo_r = (self.phase + phase_offset).sin();

            let delay_l = (base_ms + depth_ms * lfo_l) * self.sample_rate / 1000.0;
            let delay_r = (base_ms + depth_ms * lfo_r) * self.sample_rate / 1000.0;

            let input_l = input_at(inputs.input_l, i);
            let input_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => input_l,
            };

            let delayed_l = self.read_delay(&self.buffer_l, delay_l);
            let delayed_r = self.read_delay(&self.buffer_r, delay_r);

            // Use tanh on feedback to prevent instability
            self.feedback_l = (delayed_l * feedback).tanh();
            self.feedback_r = (delayed_r * feedback).tanh();

            self.buffer_l[self.write_index] = input_l + self.feedback_l;
            self.buffer_r[self.write_index] = input_r + self.feedback_r;

            let wet = clamp(mix, 0.0, 1.0);
            let dry = 1.0 - wet;

            out_l[i] = input_l * dry + delayed_l * wet;
            out_r[i] = input_r * dry + delayed_r * wet;

            self.phase += (tau * rate) / self.sample_rate;
            if self.phase >= tau {
                self.phase -= tau;
            }
            self.write_index = (self.write_index + 1) % buffer_size;
        }
    }
}
