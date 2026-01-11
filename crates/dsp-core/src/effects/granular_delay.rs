//! Granular delay effect with pitch-shifted grains.
//!
//! Creates textural delays by spawning overlapping grains
//! from the delay buffer with optional pitch shifting.

use crate::common::{input_at, sample_at, Sample};

/// A single grain for granular processing.
#[derive(Clone, Copy)]
struct Grain {
    active: bool,
    pos: f32,
    step: f32,
    age: usize,
    length: usize,
    pan: f32,
}

/// Granular delay effect.
///
/// Spawns multiple grains from a delay buffer, each with
/// independent position, pitch, and panning.
///
/// # Features
///
/// - Variable grain density
/// - Pitch shifting via playback rate
/// - Random panning for stereo width
/// - Jittered delay positions
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{GranularDelay, GranularDelayParams, GranularDelayInputs};
///
/// let mut granular = GranularDelay::new(44100.0);
/// let mut out_l = [0.0f32; 128];
/// let mut out_r = [0.0f32; 128];
///
/// granular.process_block(&mut out_l, &mut out_r, inputs, params);
/// ```
pub struct GranularDelay {
    sample_rate: f32,
    buffer_l: Vec<Sample>,
    buffer_r: Vec<Sample>,
    write_index: usize,
    grains: Vec<Grain>,
    spawn_phase: f32,
    seed: u32,
}

/// Input signals for GranularDelay.
pub struct GranularDelayInputs<'a> {
    /// Left audio input
    pub input_l: Option<&'a [Sample]>,
    /// Right audio input
    pub input_r: Option<&'a [Sample]>,
}

/// Parameters for GranularDelay.
pub struct GranularDelayParams<'a> {
    /// Base delay time in ms (40-2000)
    pub time_ms: &'a [Sample],
    /// Grain size in ms (10-500)
    pub size_ms: &'a [Sample],
    /// Grain density (grains per second, 0.2-40)
    pub density: &'a [Sample],
    /// Pitch ratio (0.25-2.0, 1.0 = original)
    pub pitch: &'a [Sample],
    /// Feedback amount (0-0.85)
    pub feedback: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
}

impl GranularDelay {
    /// Create a new granular delay.
    pub fn new(sample_rate: f32) -> Self {
        let mut delay = Self {
            sample_rate: sample_rate.max(1.0),
            buffer_l: Vec::new(),
            buffer_r: Vec::new(),
            write_index: 0,
            grains: vec![
                Grain {
                    active: false,
                    pos: 0.0,
                    step: 1.0,
                    age: 0,
                    length: 1,
                    pan: 0.0,
                };
                6
            ],
            spawn_phase: 0.0,
            seed: 0x9876_5432,
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
        let max_delay_ms = 2500.0;
        let max_samples = ((max_delay_ms / 1000.0) * self.sample_rate).ceil() as usize + 2;
        if self.buffer_l.len() != max_samples {
            self.buffer_l = vec![0.0; max_samples];
            self.buffer_r = vec![0.0; max_samples];
            self.write_index = 0;
            for grain in &mut self.grains {
                grain.active = false;
            }
        }
    }

    fn next_random(&mut self) -> f32 {
        self.seed = self
            .seed
            .wrapping_mul(1664525)
            .wrapping_add(1013904223);
        let raw = (self.seed >> 9) as f32 / 8_388_608.0;
        raw * 2.0 - 1.0
    }

    fn read_sample(buffer: &[Sample], index: f32) -> f32 {
        let size = buffer.len() as i32;
        let base = index.floor();
        let frac = index - base;
        let mut index_a = base as i32 % size;
        if index_a < 0 {
            index_a += size;
        }
        let index_b = (index_a + 1) % size;
        let a = buffer[index_a as usize];
        let b = buffer[index_b as usize];
        a + (b - a) * frac
    }

    fn spawn_grain(&mut self, delay_samples: f32, length: usize, pitch: f32, pan: f32) {
        if length == 0 {
            return;
        }
        let mut target = None;
        for (index, grain) in self.grains.iter().enumerate() {
            if !grain.active {
                target = Some(index);
                break;
            }
        }
        let index = target.unwrap_or(0);
        let grain = &mut self.grains[index];
        let mut start = self.write_index as f32 - delay_samples;
        let size = self.buffer_l.len() as f32;
        while start < 0.0 {
            start += size;
        }
        while start >= size {
            start -= size;
        }
        grain.active = true;
        grain.pos = start;
        grain.step = pitch;
        grain.age = 0;
        grain.length = length;
        grain.pan = pan;
    }

    /// Process a block of stereo audio.
    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: GranularDelayInputs<'_>,
        params: GranularDelayParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        let buffer_size = self.buffer_l.len() as f32;

        for i in 0..out_l.len() {
            let time_ms = sample_at(params.time_ms, i, 420.0).clamp(40.0, 2000.0);
            let size_ms = sample_at(params.size_ms, i, 120.0).clamp(10.0, 500.0);
            let density = sample_at(params.density, i, 6.0).clamp(0.2, 40.0);
            let pitch = sample_at(params.pitch, i, 1.0).clamp(0.25, 2.0);
            let feedback = sample_at(params.feedback, i, 0.35).clamp(0.0, 0.85);
            let mix = sample_at(params.mix, i, 0.5).clamp(0.0, 1.0);

            let base_delay = (time_ms * self.sample_rate / 1000.0).clamp(1.0, buffer_size - 2.0);
            let grain_length = (size_ms * self.sample_rate / 1000.0).max(1.0) as usize;
            let jitter = size_ms * 0.5 * self.sample_rate / 1000.0;

            self.spawn_phase += density / self.sample_rate;
            while self.spawn_phase >= 1.0 {
                self.spawn_phase -= 1.0;
                let offset = base_delay + self.next_random() * jitter;
                let delay_samples = offset.clamp(1.0, buffer_size - 2.0);
                let pan = self.next_random().clamp(-1.0, 1.0);
                self.spawn_grain(delay_samples, grain_length, pitch, pan);
            }

            let input_l = input_at(inputs.input_l, i);
            let input_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => input_l,
            };

            let mut wet_l = 0.0;
            let mut wet_r = 0.0;
            for grain in &mut self.grains {
                if !grain.active {
                    continue;
                }
                let phase = grain.age as f32 / grain.length as f32;
                let window = 1.0 - (phase * 2.0 - 1.0).abs();
                let sample_l = Self::read_sample(&self.buffer_l, grain.pos);
                let sample_r = Self::read_sample(&self.buffer_r, grain.pos);
                let pan = grain.pan;
                let pan_l = 0.5 * (1.0 - pan);
                let pan_r = 0.5 * (1.0 + pan);
                wet_l += sample_l * window * pan_l;
                wet_r += sample_r * window * pan_r;
                grain.pos += grain.step;
                if grain.pos >= buffer_size {
                    grain.pos -= buffer_size;
                }
                grain.age += 1;
                if grain.age >= grain.length {
                    grain.active = false;
                }
            }

            self.buffer_l[self.write_index] = input_l + wet_l * feedback;
            self.buffer_r[self.write_index] = input_r + wet_r * feedback;

            let dry = 1.0 - mix;
            out_l[i] = input_l * dry + wet_l * mix;
            out_r[i] = input_r * dry + wet_r * mix;

            self.write_index += 1;
            if self.write_index >= self.buffer_l.len() {
                self.write_index = 0;
            }
        }
    }
}
