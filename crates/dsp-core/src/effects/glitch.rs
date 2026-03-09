//! Glitch/stutter effect with clock-triggered slice repetition.
//!
//! Records incoming audio into a circular buffer and, on clock triggers,
//! captures slices that are repeated with optional reverse and pitch-shift.

use crate::common::{input_at, sample_at, Sample};

/// Maximum buffer duration in seconds.
const GLITCH_BUFFER_SECS: f32 = 2.0;

/// Glitch/stutter effect.
///
/// On each clock rising edge, rolls a probability dice and potentially
/// captures a slice of recent audio. The slice is then repeated with
/// optional reverse and random pitch-shifting.
///
/// # Features
///
/// - Clock-triggered slice capture
/// - Adjustable probability, slice length, and repeat count
/// - Random reverse and pitch-shift per trigger
/// - Stereo processing
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{Glitch, GlitchParams, GlitchInputs};
///
/// let mut glitch = Glitch::new(44100.0);
/// let mut out_l = [0.0f32; 128];
/// let mut out_r = [0.0f32; 128];
///
/// glitch.process_block(&mut out_l, &mut out_r, inputs, params);
/// ```
pub struct Glitch {
    sample_rate: f32,
    buffer_l: Vec<Sample>,
    buffer_r: Vec<Sample>,
    write_pos: usize,
    /// Fractional read position within the captured slice.
    read_pos: f32,
    /// Start offset of the captured slice in the circular buffer.
    slice_start: usize,
    /// Length of the captured slice in samples.
    slice_len_samples: usize,
    /// How many full slice repeats remain.
    repeats_remaining: u32,
    /// Whether a glitch is currently playing.
    is_glitching: bool,
    /// Whether the current slice plays in reverse.
    reverse: bool,
    /// Playback rate for pitch-shifting the slice.
    pitch_rate: f32,
    /// Previous clock sample for rising edge detection.
    prev_clock: f32,
    /// Simple xorshift32 RNG state.
    rng_state: u32,
}

/// Input signals for Glitch.
pub struct GlitchInputs<'a> {
    /// Left audio input
    pub input_l: Option<&'a [Sample]>,
    /// Right audio input (uses left if None)
    pub input_r: Option<&'a [Sample]>,
    /// Clock input for triggering glitch events
    pub clock: Option<&'a [Sample]>,
}

/// Parameters for Glitch.
pub struct GlitchParams<'a> {
    /// Probability of triggering on each clock edge (0-1)
    pub probability: &'a [Sample],
    /// Slice duration in milliseconds (10-500)
    pub slice_ms: &'a [Sample],
    /// Number of times to repeat the slice (1-8)
    pub repeats: &'a [Sample],
    /// Probability of reversing the slice (0-1)
    pub reverse_chance: &'a [Sample],
    /// Maximum pitch shift range in semitones (0-12)
    pub pitch_range: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
}

impl Glitch {
    /// Create a new glitch effect.
    pub fn new(sample_rate: f32) -> Self {
        let sr = sample_rate.max(1.0);
        let buffer_size = (GLITCH_BUFFER_SECS * sr).ceil() as usize + 2;
        Self {
            sample_rate: sr,
            buffer_l: vec![0.0; buffer_size],
            buffer_r: vec![0.0; buffer_size],
            write_pos: 0,
            read_pos: 0.0,
            slice_start: 0,
            slice_len_samples: 0,
            repeats_remaining: 0,
            is_glitching: false,
            reverse: false,
            pitch_rate: 1.0,
            prev_clock: 0.0,
            rng_state: 0xDEAD_BEEF,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        let sr = sample_rate.max(1.0);
        if (sr - self.sample_rate).abs() > 0.1 {
            self.sample_rate = sr;
            let buffer_size = (GLITCH_BUFFER_SECS * sr).ceil() as usize + 2;
            self.buffer_l = vec![0.0; buffer_size];
            self.buffer_r = vec![0.0; buffer_size];
            self.write_pos = 0;
            self.is_glitching = false;
            self.repeats_remaining = 0;
        }
    }

    /// Xorshift32 random number generator, returns value in [0, 1).
    fn next_random(&mut self) -> f32 {
        self.rng_state ^= self.rng_state << 13;
        self.rng_state ^= self.rng_state >> 17;
        self.rng_state ^= self.rng_state << 5;
        (self.rng_state as f32) / (u32::MAX as f32)
    }

    /// Read from a circular buffer with linear interpolation.
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

    /// Process a block of stereo audio.
    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: GlitchInputs<'_>,
        params: GlitchParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        let buffer_size = self.buffer_l.len();

        for i in 0..out_l.len() {
            // Read dry input
            let in_l = input_at(inputs.input_l, i);
            let in_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => in_l,
            };

            // Always write incoming audio to the circular buffer
            self.buffer_l[self.write_pos] = in_l;
            self.buffer_r[self.write_pos] = in_r;

            // Detect clock rising edge
            let clock_val = input_at(inputs.clock, i);
            let rising_edge = self.prev_clock < 0.5 && clock_val >= 0.5;
            self.prev_clock = clock_val;

            // On clock trigger, roll probability dice
            if rising_edge {
                let probability = sample_at(params.probability, i, 0.5).clamp(0.0, 1.0);
                let roll = self.next_random();

                if roll < probability {
                    let slice_ms = sample_at(params.slice_ms, i, 100.0).clamp(10.0, 500.0);
                    let repeats = sample_at(params.repeats, i, 2.0).clamp(1.0, 8.0) as u32;
                    let reverse_chance = sample_at(params.reverse_chance, i, 0.3).clamp(0.0, 1.0);
                    let pitch_range = sample_at(params.pitch_range, i, 0.0).clamp(0.0, 12.0);

                    // Calculate slice length in samples
                    let slice_samples = (slice_ms * self.sample_rate / 1000.0).max(1.0) as usize;
                    let slice_samples = slice_samples.min(buffer_size - 1);

                    // Slice starts behind the current write position
                    let start = if self.write_pos >= slice_samples {
                        self.write_pos - slice_samples
                    } else {
                        buffer_size - (slice_samples - self.write_pos)
                    };

                    // Decide reverse
                    let do_reverse = self.next_random() < reverse_chance;

                    // Decide pitch rate: 2^(random * pitch_range / 12)
                    let pitch_rate = if pitch_range > 0.0 {
                        let random_semi = self.next_random() * pitch_range;
                        (2.0_f32).powf(random_semi / 12.0)
                    } else {
                        1.0
                    };

                    self.slice_start = start;
                    self.slice_len_samples = slice_samples;
                    self.repeats_remaining = repeats;
                    self.is_glitching = true;
                    self.reverse = do_reverse;
                    self.pitch_rate = pitch_rate;

                    // Start playback at beginning (or end if reversed)
                    self.read_pos = if do_reverse {
                        (slice_samples as f32) - 1.0
                    } else {
                        0.0
                    };
                }
            }

            // Get mix parameter
            let mix = sample_at(params.mix, i, 0.5).clamp(0.0, 1.0);

            // Generate glitch output
            if self.is_glitching && self.slice_len_samples > 0 {
                // Map read_pos within the slice to an absolute buffer position
                let slice_len = self.slice_len_samples as f32;
                let abs_pos = self.slice_start as f32 + self.read_pos;
                let wet_l = Self::read_interpolated(&self.buffer_l, abs_pos);
                let wet_r = Self::read_interpolated(&self.buffer_r, abs_pos);

                // Advance read position
                if self.reverse {
                    self.read_pos -= self.pitch_rate;
                    // Wrap: when we go past the slice start, loop back to end
                    if self.read_pos < 0.0 {
                        self.read_pos += slice_len;
                        self.repeats_remaining = self.repeats_remaining.saturating_sub(1);
                    }
                } else {
                    self.read_pos += self.pitch_rate;
                    // Wrap: when we go past the slice end, loop back to start
                    if self.read_pos >= slice_len {
                        self.read_pos -= slice_len;
                        self.repeats_remaining = self.repeats_remaining.saturating_sub(1);
                    }
                }

                // Check if repeats exhausted
                if self.repeats_remaining == 0 {
                    self.is_glitching = false;
                }

                // Mix glitch with dry
                let dry = 1.0 - mix;
                out_l[i] = in_l * dry + wet_l * mix;
                out_r[i] = in_r * dry + wet_r * mix;
            } else {
                // Pass through dry signal
                out_l[i] = in_l;
                out_r[i] = in_r;
            }

            // Advance write position
            self.write_pos = (self.write_pos + 1) % buffer_size;
        }
    }
}
