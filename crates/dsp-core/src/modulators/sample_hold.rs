//! Sample and Hold module.
//!
//! Captures the input value on trigger edges, holding it
//! until the next trigger.

use crate::common::{input_at, sample_at, Sample};

/// Sample and Hold module.
///
/// On each trigger rising edge, captures either:
/// - The current input value (track mode)
/// - A random value (random mode)
///
/// The captured value is held until the next trigger.
///
/// # Modes
///
/// - 0: Track - samples the input signal
/// - 1: Random - generates random values on each trigger
///
/// # Example
///
/// ```ignore
/// use dsp_core::modulators::{SampleHold, SampleHoldParams, SampleHoldInputs};
///
/// let mut sh = SampleHold::new();
/// let mut output = [0.0f32; 128];
///
/// sh.process_block(&mut output, inputs, params);
/// ```
pub struct SampleHold {
    last_trigger: f32,
    held: f32,
    seed: u32,
}

/// Input signals for SampleHold.
pub struct SampleHoldInputs<'a> {
    /// Signal to sample (used in track mode)
    pub input: Option<&'a [Sample]>,
    /// Trigger input (samples on rising edge)
    pub trigger: Option<&'a [Sample]>,
}

/// Parameters for SampleHold.
pub struct SampleHoldParams<'a> {
    /// Mode (0 = track input, 1 = random)
    pub mode: &'a [Sample],
}

impl SampleHold {
    /// Create a new Sample and Hold module.
    pub fn new() -> Self {
        Self {
            last_trigger: 0.0,
            held: 0.0,
            seed: 0x1234_5678,
        }
    }

    /// Generate next random value using LCG.
    fn next_random(&mut self) -> f32 {
        self.seed = self
            .seed
            .wrapping_mul(1664525)
            .wrapping_add(1013904223);
        let raw = (self.seed >> 9) as f32 / 8_388_608.0;
        raw * 2.0 - 1.0
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: SampleHoldInputs<'_>,
        params: SampleHoldParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }
        for i in 0..output.len() {
            let trigger = input_at(inputs.trigger, i);
            // On trigger rising edge
            if trigger > 0.5 && self.last_trigger <= 0.5 {
                let mode = sample_at(params.mode, i, 0.0);
                if mode < 0.5 {
                    // Track mode: sample the input
                    self.held = input_at(inputs.input, i);
                } else {
                    // Random mode: generate random value
                    self.held = self.next_random();
                }
            }
            self.last_trigger = trigger;
            output[i] = self.held;
        }
    }
}

impl Default for SampleHold {
    fn default() -> Self {
        Self::new()
    }
}
