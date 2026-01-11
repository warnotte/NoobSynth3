//! Stereo delay effect with ping-pong mode.
//!
//! A versatile delay effect with feedback, tone control, and optional
//! ping-pong stereo bouncing.

use crate::common::{input_at, sample_at, Sample};

/// Stereo delay effect.
///
/// Features include:
/// - Variable delay time up to 2 seconds
/// - Feedback with damping
/// - Ping-pong stereo mode
/// - Tone control for darker repeats
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{Delay, DelayParams, DelayInputs};
///
/// let mut delay = Delay::new(44100.0);
/// let mut out_l = [0.0f32; 128];
/// let mut out_r = [0.0f32; 128];
///
/// delay.process_block(&mut out_l, &mut out_r, inputs, params);
/// ```
pub struct Delay {
    sample_rate: f32,
    buffer_l: Vec<Sample>,
    buffer_r: Vec<Sample>,
    write_index: usize,
    damp_state_l: f32,
    damp_state_r: f32,
}

/// Input signals for Delay.
pub struct DelayInputs<'a> {
    /// Left audio input
    pub input_l: Option<&'a [Sample]>,
    /// Right audio input (uses left if None)
    pub input_r: Option<&'a [Sample]>,
}

/// Parameters for Delay.
pub struct DelayParams<'a> {
    /// Delay time in milliseconds (0-2000)
    pub time_ms: &'a [Sample],
    /// Feedback amount (0-0.9)
    pub feedback: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
    /// Tone control (0 = dark, 1 = bright)
    pub tone: &'a [Sample],
    /// Ping-pong mode (>= 0.5 = enabled)
    pub ping_pong: &'a [Sample],
}

impl Delay {
    /// Create a new delay effect.
    pub fn new(sample_rate: f32) -> Self {
        let mut delay = Self {
            sample_rate: sample_rate.max(1.0),
            buffer_l: Vec::new(),
            buffer_r: Vec::new(),
            write_index: 0,
            damp_state_l: 0.0,
            damp_state_r: 0.0,
        };
        delay.allocate_buffers();
        delay
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        self.allocate_buffers();
    }

    fn allocate_buffers(&mut self) {
        let max_delay_ms = 2000.0;
        let max_samples = ((max_delay_ms / 1000.0) * self.sample_rate).ceil() as usize + 2;
        if self.buffer_l.len() != max_samples {
            self.buffer_l = vec![0.0; max_samples];
            self.buffer_r = vec![0.0; max_samples];
            self.write_index = 0;
            self.damp_state_l = 0.0;
            self.damp_state_r = 0.0;
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
        inputs: DelayInputs<'_>,
        params: DelayParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        let buffer_size = self.buffer_l.len();
        let max_delay = (buffer_size as f32 - 2.0).max(1.0);

        for i in 0..out_l.len() {
            let time_ms = sample_at(params.time_ms, i, 360.0);
            let feedback = sample_at(params.feedback, i, 0.35).clamp(0.0, 0.9);
            let mix = sample_at(params.mix, i, 0.25).clamp(0.0, 1.0);
            let tone = sample_at(params.tone, i, 0.55).clamp(0.0, 1.0);
            let ping = sample_at(params.ping_pong, i, 0.0) >= 0.5;

            let delay_samples = ((time_ms * self.sample_rate) / 1000.0).clamp(1.0, max_delay);
            let in_l = input_at(inputs.input_l, i);
            let in_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => in_l,
            };

            let delayed_l = self.read_delay(&self.buffer_l, delay_samples);
            let delayed_r = self.read_delay(&self.buffer_r, delay_samples);

            let fb_source_l = if ping { delayed_r } else { delayed_l };
            let fb_source_r = if ping { delayed_l } else { delayed_r };
            let damp = 0.05 + (1.0 - tone) * 0.9;

            self.damp_state_l = fb_source_l * feedback * (1.0 - damp) + self.damp_state_l * damp;
            self.damp_state_r = fb_source_r * feedback * (1.0 - damp) + self.damp_state_r * damp;

            self.buffer_l[self.write_index] = in_l + self.damp_state_l;
            self.buffer_r[self.write_index] = in_r + self.damp_state_r;

            let dry = 1.0 - mix;
            out_l[i] = in_l * dry + delayed_l * mix;
            out_r[i] = in_r * dry + delayed_r * mix;

            self.write_index = (self.write_index + 1) % buffer_size;
        }
    }
}
