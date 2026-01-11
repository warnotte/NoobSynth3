//! Granular pitch shifter effect.
//!
//! Uses overlapping grains with Hann windowing to shift pitch
//! without changing the tempo.

use crate::common::{input_at, sample_at, Sample};

const PITCH_SHIFTER_MAX_GRAINS: usize = 4;
const PITCH_SHIFTER_BUFFER_MS: f32 = 200.0;

/// A single pitch-shifting grain.
#[derive(Clone, Copy)]
struct PitchGrain {
    active: bool,
    read_pos: f32,
    age: usize,
    length: usize,
}

/// Granular pitch shifter effect.
///
/// Shifts pitch by playing back grains at different speeds
/// while maintaining the original duration.
///
/// # Features
///
/// - ±24 semitones shift range
/// - Fine tuning in cents
/// - CV modulation input
/// - Adjustable grain size (10-100ms)
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{PitchShifter, PitchShifterParams, PitchShifterInputs};
///
/// let mut shifter = PitchShifter::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// shifter.process_block(&mut output, inputs, params);
/// ```
pub struct PitchShifter {
    sample_rate: f32,
    buffer: Vec<Sample>,
    write_index: usize,
    grains: [PitchGrain; PITCH_SHIFTER_MAX_GRAINS],
    next_grain: usize,
    spawn_phase: f32,
}

/// Input signals for PitchShifter.
pub struct PitchShifterInputs<'a> {
    /// Audio input
    pub input: Option<&'a [Sample]>,
    /// Pitch CV modulation (1V/octave)
    pub pitch_cv: Option<&'a [Sample]>,
}

/// Parameters for PitchShifter.
pub struct PitchShifterParams<'a> {
    /// Pitch shift in semitones (-24 to +24)
    pub pitch: &'a [Sample],
    /// Fine tuning in cents (-100 to +100)
    pub fine: &'a [Sample],
    /// Grain size in ms (10-100)
    pub grain_ms: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
}

impl PitchShifter {
    /// Create a new pitch shifter.
    pub fn new(sample_rate: f32) -> Self {
        let sr = sample_rate.max(1.0);
        let buffer_size = ((PITCH_SHIFTER_BUFFER_MS / 1000.0) * sr).ceil() as usize + 2;
        Self {
            sample_rate: sr,
            buffer: vec![0.0; buffer_size],
            write_index: 0,
            grains: [PitchGrain {
                active: false,
                read_pos: 0.0,
                age: 0,
                length: 1,
            }; PITCH_SHIFTER_MAX_GRAINS],
            next_grain: 0,
            spawn_phase: 0.0,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        let sr = sample_rate.max(1.0);
        if (sr - self.sample_rate).abs() > 0.1 {
            self.sample_rate = sr;
            let buffer_size = ((PITCH_SHIFTER_BUFFER_MS / 1000.0) * sr).ceil() as usize + 2;
            self.buffer = vec![0.0; buffer_size];
            self.write_index = 0;
            for grain in &mut self.grains {
                grain.active = false;
            }
        }
    }

    fn read_interpolated(buffer: &[Sample], pos: f32) -> f32 {
        let size = buffer.len() as i32;
        let base = pos.floor();
        let frac = pos - base;
        let mut idx_a = base as i32 % size;
        if idx_a < 0 {
            idx_a += size;
        }
        let idx_b = (idx_a + 1) % size;
        let a = buffer[idx_a as usize];
        let b = buffer[idx_b as usize];
        a + (b - a) * frac
    }

    fn hann_window(phase: f32) -> f32 {
        0.5 * (1.0 - (std::f32::consts::TAU * phase).cos())
    }

    fn spawn_grain(&mut self, grain_length: usize) {
        let grain = &mut self.grains[self.next_grain];
        // Start reading from half a grain back from write position
        let offset = grain_length as f32 * 0.5;
        let mut start_pos = self.write_index as f32 - offset;
        let size = self.buffer.len() as f32;
        while start_pos < 0.0 {
            start_pos += size;
        }

        grain.active = true;
        grain.read_pos = start_pos;
        grain.age = 0;
        grain.length = grain_length;

        self.next_grain = (self.next_grain + 1) % PITCH_SHIFTER_MAX_GRAINS;
    }

    /// Process a block of audio.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: PitchShifterInputs<'_>,
        params: PitchShifterParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        let buffer_size = self.buffer.len() as f32;

        for i in 0..output.len() {
            // Get input sample
            let input_sample = input_at(inputs.input, i);

            // Write to circular buffer
            self.buffer[self.write_index] = input_sample;
            self.write_index = (self.write_index + 1) % self.buffer.len();

            // Get params
            let pitch_semi = sample_at(params.pitch, i, 0.0).clamp(-24.0, 24.0);
            let fine_cents = sample_at(params.fine, i, 0.0).clamp(-100.0, 100.0);
            let pitch_cv = input_at(inputs.pitch_cv, i) * 12.0; // 1V/oct = 12 semitones

            let total_semitones = pitch_semi + fine_cents / 100.0 + pitch_cv;
            let pitch_ratio = (2.0_f32).powf(total_semitones / 12.0);

            let grain_ms = sample_at(params.grain_ms, i, 50.0).clamp(10.0, 100.0);
            let grain_length = (grain_ms * self.sample_rate / 1000.0).max(1.0) as usize;
            let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);

            // Spawn new grains at regular intervals (every half grain)
            let spawn_interval = grain_length as f32 * 0.5;
            self.spawn_phase += 1.0;
            if self.spawn_phase >= spawn_interval {
                self.spawn_phase -= spawn_interval;
                self.spawn_grain(grain_length);
            }

            // Process all active grains
            let mut wet = 0.0;
            for idx in 0..PITCH_SHIFTER_MAX_GRAINS {
                let grain = &self.grains[idx];
                if !grain.active {
                    continue;
                }

                // Calculate window (Hann)
                let phase = grain.age as f32 / grain.length as f32;
                let window = Self::hann_window(phase);

                // Read from buffer with interpolation
                let sample = Self::read_interpolated(&self.buffer, grain.read_pos);
                wet += sample * window;

                // Update grain state
                let grain = &mut self.grains[idx];
                // Advance read position based on pitch ratio
                grain.read_pos += pitch_ratio;
                // Wrap around buffer
                while grain.read_pos >= buffer_size {
                    grain.read_pos -= buffer_size;
                }
                while grain.read_pos < 0.0 {
                    grain.read_pos += buffer_size;
                }

                // Advance age
                grain.age += 1;
                if grain.age >= grain.length {
                    grain.active = false;
                }
            }

            // Mix dry/wet
            output[i] = input_sample * (1.0 - mix) + wet * mix;
        }
    }
}
