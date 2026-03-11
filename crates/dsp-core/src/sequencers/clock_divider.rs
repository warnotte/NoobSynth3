//! Clock Divider module.
//!
//! Divides an incoming clock signal by 2, 4, 8, and 16.
//! All outputs are synchronized to the same input clock.

use crate::common::{sample_at, Sample};

/// Clock Divider — takes a clock input and produces divided outputs.
///
/// Outputs /2, /4, /8, and /16 divisions of the input clock.
/// Includes a reset input to re-sync all dividers to step 0.
pub struct ClockDivider {
    prev_clock: f32,
    prev_reset: f32,
    count: u32,
    /// Output states (true = high)
    div2_high: bool,
    div4_high: bool,
    div8_high: bool,
    div16_high: bool,
    /// Gate duration tracking (samples remaining)
    div2_gate: usize,
    div4_gate: usize,
    div8_gate: usize,
    div16_gate: usize,
    sample_rate: f32,
}

/// Input signals for ClockDivider.
pub struct ClockDividerInputs<'a> {
    /// Clock input
    pub clock: Option<&'a [Sample]>,
    /// Reset input
    pub reset: Option<&'a [Sample]>,
}

/// Output signals for ClockDivider.
pub struct ClockDividerOutputs<'a> {
    /// Clock / 2
    pub div2: &'a mut [Sample],
    /// Clock / 4
    pub div4: &'a mut [Sample],
    /// Clock / 8
    pub div8: &'a mut [Sample],
    /// Clock / 16
    pub div16: &'a mut [Sample],
}

impl ClockDivider {
    /// Create a new clock divider.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            prev_clock: 0.0,
            prev_reset: 0.0,
            count: 0,
            div2_high: false,
            div4_high: false,
            div8_high: false,
            div16_high: false,
            div2_gate: 0,
            div4_gate: 0,
            div8_gate: 0,
            div16_gate: 0,
            sample_rate: sample_rate.max(1.0),
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Get the current tick count.
    pub fn current_step(&self) -> usize {
        self.count as usize
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        outputs: ClockDividerOutputs<'_>,
        inputs: ClockDividerInputs<'_>,
    ) {
        let frames = outputs.div2.len();
        // Gate pulse width: ~2ms
        let gate_width = (self.sample_rate * 0.002) as usize;

        for i in 0..frames {
            // Check reset
            let reset_in = inputs.reset.map_or(0.0, |b| sample_at(b, i, 0.0));
            let reset_trigger = reset_in > 0.5 && self.prev_reset <= 0.5;
            self.prev_reset = reset_in;

            if reset_trigger {
                self.count = 0;
                self.div2_high = false;
                self.div4_high = false;
                self.div8_high = false;
                self.div16_high = false;
                self.div2_gate = 0;
                self.div4_gate = 0;
                self.div8_gate = 0;
                self.div16_gate = 0;
            }

            // Check clock
            let clock_in = inputs.clock.map_or(0.0, |b| sample_at(b, i, 0.0));
            let clock_trigger = clock_in > 0.5 && self.prev_clock <= 0.5;
            self.prev_clock = clock_in;

            if clock_trigger {
                // /2: trigger every 2 clocks
                if self.count % 2 == 0 {
                    self.div2_gate = gate_width;
                }
                // /4: trigger every 4 clocks
                if self.count % 4 == 0 {
                    self.div4_gate = gate_width;
                }
                // /8: trigger every 8 clocks
                if self.count % 8 == 0 {
                    self.div8_gate = gate_width;
                }
                // /16: trigger every 16 clocks
                if self.count % 16 == 0 {
                    self.div16_gate = gate_width;
                }

                self.count = self.count.wrapping_add(1);
            }

            // Decrement gates and write outputs
            if self.div2_gate > 0 {
                self.div2_gate -= 1;
                outputs.div2[i] = 1.0;
            } else {
                outputs.div2[i] = 0.0;
            }

            if self.div4_gate > 0 {
                self.div4_gate -= 1;
                outputs.div4[i] = 1.0;
            } else {
                outputs.div4[i] = 0.0;
            }

            if self.div8_gate > 0 {
                self.div8_gate -= 1;
                outputs.div8[i] = 1.0;
            } else {
                outputs.div8[i] = 0.0;
            }

            if self.div16_gate > 0 {
                self.div16_gate -= 1;
                outputs.div16[i] = 1.0;
            } else {
                outputs.div16[i] = 0.0;
            }
        }
    }
}
