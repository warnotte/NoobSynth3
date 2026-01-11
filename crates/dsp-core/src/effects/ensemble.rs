//! Ensemble effect with three modulated delay lines.
//!
//! Creates a rich string-ensemble type sound using three
//! delay lines with different LFO rates.

use crate::common::{input_at, sample_at, Sample};

/// Ensemble effect (tri-chorus).
///
/// Uses three modulated delay lines with slightly different
/// LFO rates to create a thick, orchestral sound.
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{Ensemble, EnsembleParams, EnsembleInputs};
///
/// let mut ensemble = Ensemble::new(44100.0);
/// let mut out_l = [0.0f32; 128];
/// let mut out_r = [0.0f32; 128];
///
/// ensemble.process_block(&mut out_l, &mut out_r, inputs, params);
/// ```
pub struct Ensemble {
    sample_rate: f32,
    phases: [f32; 3],
    buffer_l: Vec<Sample>,
    buffer_r: Vec<Sample>,
    write_index: usize,
}

/// Input signals for Ensemble.
pub struct EnsembleInputs<'a> {
    /// Left audio input
    pub input_l: Option<&'a [Sample]>,
    /// Right audio input
    pub input_r: Option<&'a [Sample]>,
}

/// Parameters for Ensemble.
pub struct EnsembleParams<'a> {
    /// LFO rate in Hz (0.01-5.0)
    pub rate: &'a [Sample],
    /// Modulation depth in ms (0-25)
    pub depth_ms: &'a [Sample],
    /// Base delay in ms (1-30)
    pub delay_ms: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
    /// Stereo spread (0-1)
    pub spread: &'a [Sample],
}

impl Ensemble {
    /// Create a new ensemble effect.
    pub fn new(sample_rate: f32) -> Self {
        let mut ensemble = Self {
            sample_rate: sample_rate.max(1.0),
            phases: [
                0.0,
                std::f32::consts::TAU / 3.0,
                (2.0 * std::f32::consts::TAU) / 3.0,
            ],
            buffer_l: Vec::new(),
            buffer_r: Vec::new(),
            write_index: 0,
        };
        ensemble.allocate_buffers();
        ensemble
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        self.allocate_buffers();
    }

    fn allocate_buffers(&mut self) {
        let max_delay_ms = 60.0;
        let max_samples = ((max_delay_ms / 1000.0) * self.sample_rate).ceil() as usize + 2;
        if self.buffer_l.len() != max_samples {
            self.buffer_l = vec![0.0; max_samples];
            self.buffer_r = vec![0.0; max_samples];
            self.write_index = 0;
            self.phases = [
                0.0,
                std::f32::consts::TAU / 3.0,
                (2.0 * std::f32::consts::TAU) / 3.0,
            ];
        }
    }

    /// Process a block of stereo audio.
    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: EnsembleInputs<'_>,
        params: EnsembleParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        let buffer_size = self.buffer_l.len();
        let tau = std::f32::consts::TAU;
        let rate_mults = [0.85, 1.0, 1.2];
        let max_delay = (buffer_size as f32 - 2.0).max(1.0);

        for i in 0..out_l.len() {
            let rate = sample_at(params.rate, i, 0.25).clamp(0.01, 5.0);
            let depth_ms = sample_at(params.depth_ms, i, 12.0).clamp(0.0, 25.0);
            let delay_ms = sample_at(params.delay_ms, i, 12.0).clamp(1.0, 30.0);
            let mix = sample_at(params.mix, i, 0.6).clamp(0.0, 1.0);
            let spread = sample_at(params.spread, i, 0.7).clamp(0.0, 1.0);
            let spread_offset = spread * tau * 0.25;

            let input_l = input_at(inputs.input_l, i);
            let input_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => input_l,
            };

            let mut delays_l = [0.0; 3];
            let mut delays_r = [0.0; 3];
            for (index, phase) in self.phases.iter_mut().enumerate() {
                let lfo_l = (*phase).sin();
                let lfo_r = (*phase + spread_offset).sin();
                delays_l[index] =
                    ((delay_ms + depth_ms * lfo_l) * self.sample_rate / 1000.0).clamp(1.0, max_delay);
                delays_r[index] =
                    ((delay_ms + depth_ms * lfo_r) * self.sample_rate / 1000.0).clamp(1.0, max_delay);
                *phase += (tau * rate * rate_mults[index]) / self.sample_rate;
                if *phase >= tau {
                    *phase -= tau;
                }
            }

            let write_index = self.write_index;
            let read_delay = |buffer: &[Sample], delay_samples: f32| {
                let size = buffer.len() as i32;
                let read_pos = write_index as f32 - delay_samples;
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
            };

            let mut sum_l = 0.0;
            let mut sum_r = 0.0;
            {
                let buffer_l = &self.buffer_l;
                let buffer_r = &self.buffer_r;
                for idx in 0..3 {
                    sum_l += read_delay(buffer_l, delays_l[idx]);
                    sum_r += read_delay(buffer_r, delays_r[idx]);
                }
            }

            let wet_l = sum_l / 3.0;
            let wet_r = sum_r / 3.0;
            let dry = 1.0 - mix;
            out_l[i] = input_l * dry + wet_l * mix;
            out_r[i] = input_r * dry + wet_r * mix;

            self.buffer_l[self.write_index] = input_l;
            self.buffer_r[self.write_index] = input_r;
            self.write_index = (self.write_index + 1) % buffer_size;
        }
    }
}
