//! Turing Machine - Shift register based random looping sequencer
//!
//! Inspired by Music Thing Modular's Turing Machine.
//! Generates semi-random sequences that can be "locked" to repeat.

use crate::common::{sample_at, get_scale_notes};

/// Parameters for the Turing Machine
#[derive(Debug, Clone)]
pub struct TuringParams<'a> {
    /// Probability of flipping the feedback bit (0 = locked, 0.5 = evolving, 1 = random)
    pub probability: &'a [f32],
    /// Loop length in bits (2-16)
    pub length: &'a [f32],
    /// Output voltage range in octaves (1-5)
    pub range: &'a [f32],
    /// Scale index for quantization (0 = off)
    pub scale: &'a [f32],
    /// Root note for quantization (0-11)
    pub root: &'a [f32],
}

impl<'a> Default for TuringParams<'a> {
    fn default() -> Self {
        Self {
            probability: &[0.5],
            length: &[8.0],
            range: &[2.0],
            scale: &[0.0],
            root: &[0.0],
        }
    }
}

/// Inputs for the Turing Machine
pub struct TuringInputs<'a> {
    pub clock: Option<&'a [f32]>,
    pub reset: Option<&'a [f32]>,
}

/// Turing Machine shift register sequencer
#[derive(Debug, Clone)]
pub struct TuringMachine {
    /// 16-bit shift register
    register: u16,
    /// Sample rate
    sample_rate: f32,
    /// Previous clock value for edge detection
    last_clock: f32,
    /// Previous reset value for edge detection
    last_reset: f32,
    /// Current step position
    step: usize,
    /// Simple RNG state (LCG)
    rng_state: u32,
    /// Trigger timer for pulse output
    trigger_timer: i32,
    /// Current CV output (smoothed)
    current_cv: f32,
    /// Gate state
    gate_state: f32,
}

impl TuringMachine {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            register: 0b1010_0110_1001_0101, // Initial pattern
            sample_rate,
            last_clock: 0.0,
            last_reset: 0.0,
            step: 0,
            rng_state: 12345,
            trigger_timer: 0,
            current_cv: 0.0,
            gate_state: 0.0,
        }
    }

    /// Simple LCG random number generator
    fn next_random(&mut self) -> f32 {
        self.rng_state = self.rng_state.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.rng_state as f32) / (u32::MAX as f32)
    }

    pub fn process_block(
        &mut self,
        out_cv: &mut [f32],
        out_gate: &mut [f32],
        out_pulse: &mut [f32],
        inputs: TuringInputs,
        params: TuringParams,
    ) {
        let clock_in = inputs.clock.unwrap_or(&[]);
        let reset_in = inputs.reset.unwrap_or(&[]);
        let pulse_samples = (0.005 * self.sample_rate) as i32; // 5ms pulse

        for i in 0..out_cv.len() {
            let clock = sample_at(clock_in, i, 0.0);
            let reset = sample_at(reset_in, i, 0.0);
            let prob = sample_at(params.probability, i, 0.5).clamp(0.0, 1.0);
            let length = sample_at(params.length, i, 8.0).clamp(2.0, 16.0) as usize;
            let range = sample_at(params.range, i, 2.0).clamp(1.0, 5.0);
            let scale_idx = sample_at(params.scale, i, 0.0) as i32;
            let root = sample_at(params.root, i, 0.0) as i32;

            // Reset detection (rising edge)
            if reset > 0.5 && self.last_reset <= 0.5 {
                self.step = 0;
                self.register = 0b1010_0110_1001_0101; // Reset pattern
            }
            self.last_reset = reset;

            // Clock detection (rising edge)
            if clock > 0.5 && self.last_clock <= 0.5 {
                // Get the bit that will be shifted out
                let feedback_bit = (self.register >> (length - 1)) & 1;

                // Decide whether to flip it based on probability
                let new_bit = if self.next_random() < prob {
                    // Flip: random bit
                    if self.next_random() < 0.5 { 0 } else { 1 }
                } else {
                    // Keep: feedback bit stays the same
                    feedback_bit
                };

                // Shift register left and insert new bit at position 0
                self.register = ((self.register << 1) | (new_bit as u16)) & 0xFFFF;

                // Advance step
                self.step = (self.step + 1) % length;

                // Calculate CV from register
                // Use lower 'length' bits, normalize to 0-1
                let mask = (1u16 << length) - 1;
                let value = (self.register & mask) as f32 / mask as f32;

                // Scale to voltage range (in octaves, centered around 0)
                let cv_raw = (value - 0.5) * range;

                // Quantize if scale is set
                if scale_idx > 0 {
                    self.current_cv = self.quantize(cv_raw, scale_idx, root);
                } else {
                    self.current_cv = cv_raw;
                }

                // Trigger pulse
                self.trigger_timer = pulse_samples;
            }
            self.last_clock = clock;

            // Gate follows clock (high when clock is high)
            self.gate_state = if clock > 0.5 { 1.0 } else { 0.0 };

            // Output CV
            out_cv[i] = self.current_cv;

            // Output gate
            out_gate[i] = self.gate_state;

            // Output pulse
            if self.trigger_timer > 0 {
                out_pulse[i] = 1.0;
                self.trigger_timer -= 1;
            } else {
                out_pulse[i] = 0.0;
            }
        }
    }

    fn quantize(&self, value: f32, scale_idx: i32, root: i32) -> f32 {
        // Value is in octaves, convert to semitones
        let note_in = value * 12.0;
        let scale_notes = get_scale_notes(scale_idx);
        if scale_notes.is_empty() {
            return value;
        }

        let root_note = root as f32;
        let mut best_note = 0.0;
        let mut min_dist = 1000.0;
        let base_octave = (note_in / 12.0).floor() as i32;

        for oct in (base_octave - 1)..=(base_octave + 1) {
            for &interval in scale_notes {
                let candidate = (oct * 12) as f32 + interval as f32 + root_note;
                let dist = (note_in - candidate).abs();
                if dist < min_dist {
                    min_dist = dist;
                    best_note = candidate;
                }
            }
        }

        // Convert back to octaves
        best_note / 12.0
    }

    /// Get current step (for UI visualization)
    pub fn current_step(&self) -> usize {
        self.step
    }

    /// Get register value (for UI visualization)
    pub fn register_value(&self) -> u16 {
        self.register
    }
}
