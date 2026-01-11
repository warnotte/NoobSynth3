//! Euclidean Sequencer module.
//!
//! Distributes triggers evenly using Bjorklund's algorithm.

use crate::common::Sample;

/// Maximum number of steps.
pub const EUCLIDEAN_MAX_STEPS: usize = 32;

/// Euclidean Sequencer.
///
/// Distributes a specified number of pulses as evenly as possible
/// across a given number of steps, using Bjorklund's algorithm.
///
/// # Algorithm
///
/// The Euclidean algorithm finds the most evenly-spaced way to
/// distribute K pulses among N steps. This creates rhythms found
/// in traditional music from around the world.
///
/// # Examples of Euclidean Rhythms
///
/// - E(3,8) = [x . . x . . x .] - Cuban tresillo
/// - E(4,12) = [x . . x . . x . . x . .] - Afro-Cuban bembe
/// - E(5,8) = [x . x x . x x .] - Cuban cinquillo
/// - E(7,16) = Brazilian samba
///
/// # Example
///
/// ```ignore
/// use dsp_core::sequencers::{EuclideanSequencer, EuclideanInputs, EuclideanParams};
///
/// let mut seq = EuclideanSequencer::new(44100.0);
/// let mut gate_out = [0.0f32; 128];
/// let mut step_out = [0.0f32; 128];
///
/// seq.process_block(
///     &mut gate_out,
///     &mut step_out,
///     EuclideanInputs { clock: None, reset: None },
///     EuclideanParams {
///         enabled: &[1.0], tempo: &[120.0], rate: &[7.0],
///         steps: &[8.0], pulses: &[3.0], rotation: &[0.0],
///         gate_length: &[50.0], swing: &[0.0],
///     },
/// );
/// ```
pub struct EuclideanSequencer {
    sample_rate: f32,

    // Pattern state (computed from pulses/steps)
    pattern: [bool; EUCLIDEAN_MAX_STEPS],
    pattern_length: usize,

    // Playback state
    current_step: usize,
    phase: f64,
    samples_per_step: f64,

    // Gate timing
    gate_on: bool,
    gate_samples: usize,
    gate_length_samples: usize,

    // Swing state
    swing_pending: bool,
    swing_delay_remaining: usize,

    // Edge detection
    prev_clock: f32,
    prev_reset: f32,

    // Cached params to detect changes
    cached_steps: usize,
    cached_pulses: usize,
    cached_rotation: usize,

    // Output
    current_gate: f32,
}

/// Input signals for EuclideanSequencer.
pub struct EuclideanInputs<'a> {
    /// External clock input
    pub clock: Option<&'a [Sample]>,
    /// Reset trigger input
    pub reset: Option<&'a [Sample]>,
}

/// Parameters for EuclideanSequencer.
pub struct EuclideanParams<'a> {
    /// Enable sequencer (0 = off, 1 = on)
    pub enabled: &'a [Sample],
    /// Tempo in BPM (40-300)
    pub tempo: &'a [Sample],
    /// Rate division index
    pub rate: &'a [Sample],
    /// Total number of steps (2-32)
    pub steps: &'a [Sample],
    /// Number of trigger pulses (1-steps)
    pub pulses: &'a [Sample],
    /// Pattern rotation (0-steps)
    pub rotation: &'a [Sample],
    /// Gate length (10-100%)
    pub gate_length: &'a [Sample],
    /// Swing amount (0-90%)
    pub swing: &'a [Sample],
}

impl EuclideanSequencer {
    /// Create a new Euclidean sequencer.
    pub fn new(sample_rate: f32) -> Self {
        let mut seq = Self {
            sample_rate: sample_rate.max(1.0),
            pattern: [false; EUCLIDEAN_MAX_STEPS],
            pattern_length: 16,
            current_step: 0,
            phase: 0.0,
            samples_per_step: sample_rate as f64 * 0.5,
            gate_on: false,
            gate_samples: 0,
            gate_length_samples: 0,
            swing_pending: false,
            swing_delay_remaining: 0,
            prev_clock: 0.0,
            prev_reset: 0.0,
            cached_steps: 16,
            cached_pulses: 4,
            cached_rotation: 0,
            current_gate: 0.0,
        };
        seq.compute_pattern(16, 4, 0);
        seq
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Compute Euclidean rhythm using Bresenham-style distribution.
    fn compute_pattern(&mut self, steps: usize, pulses: usize, rotation: usize) {
        let steps = steps.clamp(2, EUCLIDEAN_MAX_STEPS);
        let pulses = pulses.clamp(0, steps);

        // Clear pattern
        for i in 0..EUCLIDEAN_MAX_STEPS {
            self.pattern[i] = false;
        }

        self.pattern_length = steps;

        if pulses == 0 {
            // All off - already cleared
            self.cached_steps = steps;
            self.cached_pulses = pulses;
            self.cached_rotation = rotation;
            return;
        }

        if pulses >= steps {
            // All on
            for i in 0..steps {
                self.pattern[i] = true;
            }
            self.cached_steps = steps;
            self.cached_pulses = pulses;
            self.cached_rotation = rotation;
            return;
        }

        // Bresenham-style Euclidean distribution
        // This distributes pulses as evenly as possible across steps
        let mut bucket: i32 = 0;
        let rot = rotation % steps;

        for i in 0..steps {
            bucket += pulses as i32;
            if bucket >= steps as i32 {
                bucket -= steps as i32;
                // Apply rotation
                let pos = (i + steps - rot) % steps;
                self.pattern[pos] = true;
            }
        }

        self.cached_steps = steps;
        self.cached_pulses = pulses;
        self.cached_rotation = rotation;
    }

    /// Get current pattern for UI display.
    pub fn get_pattern(&self) -> &[bool] {
        &self.pattern[..self.pattern_length]
    }

    /// Get current step position.
    pub fn current_step(&self) -> usize {
        self.current_step
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        gate_out: &mut [Sample],
        step_out: &mut [Sample],
        inputs: EuclideanInputs,
        params: EuclideanParams,
    ) {
        let frames = gate_out.len();
        let enabled = params.enabled[0] > 0.5;

        if !enabled {
            for i in 0..frames {
                gate_out[i] = 0.0;
                step_out[i] = self.current_step as f32;
            }
            self.current_gate = 0.0;
            self.gate_on = false;
            return;
        }

        let tempo = params.tempo[0].clamp(40.0, 300.0);
        let rate_idx = params.rate[0] as usize;
        let steps = params.steps[0] as usize;
        let pulses = params.pulses[0] as usize;
        let rotation = params.rotation[0] as usize;
        let gate_len_pct = params.gate_length[0].clamp(10.0, 100.0);
        let swing_pct = params.swing[0].clamp(0.0, 90.0);

        // Recompute pattern if params changed
        if steps != self.cached_steps || pulses != self.cached_pulses || rotation != self.cached_rotation {
            self.compute_pattern(steps, pulses, rotation);
        }

        // Rate divisions
        let rate_mult = match rate_idx {
            0 => 0.25,   // 1/1
            1 => 0.5,    // 1/2
            2 => 0.75,   // 1/2T
            3 => 1.0,    // 1/4
            4 => 1.5,    // 1/4T
            5 => 2.0,    // 1/8
            6 => 3.0,    // 1/8T
            7 => 4.0,    // 1/16
            8 => 6.0,    // 1/16T
            9 => 8.0,    // 1/32
            10 => 12.0,  // 1/32T
            11 => 16.0,  // 1/64
            _ => 4.0,
        };

        let beats_per_second = tempo / 60.0;
        let steps_per_second = beats_per_second * rate_mult;
        self.samples_per_step = self.sample_rate as f64 / steps_per_second as f64;
        self.gate_length_samples = ((self.samples_per_step * (gate_len_pct as f64 / 100.0)) as usize).max(1);

        let has_external_clock = inputs.clock.is_some();

        for i in 0..frames {
            // Handle reset
            if let Some(reset) = inputs.reset {
                let reset_val = reset[i.min(reset.len() - 1)];
                if reset_val > 0.5 && self.prev_reset <= 0.5 {
                    self.current_step = 0;
                    self.phase = 0.0;
                    self.swing_pending = false;
                    self.swing_delay_remaining = 0;
                }
                self.prev_reset = reset_val;
            }

            // Handle swing delay
            if self.swing_pending {
                if self.swing_delay_remaining > 0 {
                    self.swing_delay_remaining -= 1;
                } else {
                    // Execute delayed trigger (we already determined it should trigger)
                    self.swing_pending = false;
                    self.gate_on = true;
                    self.gate_samples = 0;
                    self.current_gate = 1.0;
                }
            }

            // Advance step
            let should_advance = if has_external_clock {
                let clock = inputs.clock.unwrap();
                let clock_val = clock[i.min(clock.len() - 1)];
                let rising = clock_val > 0.5 && self.prev_clock <= 0.5;
                self.prev_clock = clock_val;
                rising
            } else {
                self.phase += 1.0;
                if self.phase >= self.samples_per_step {
                    self.phase -= self.samples_per_step;
                    true
                } else {
                    false
                }
            };

            if should_advance && !self.swing_pending {
                // Check CURRENT step for trigger BEFORE advancing
                let trigger_step = self.current_step;
                let should_trigger = trigger_step < self.pattern_length && self.pattern[trigger_step];

                // Now advance to next step
                self.current_step = (self.current_step + 1) % self.pattern_length;

                // Swing on odd steps (of the trigger step)
                let is_odd_step = trigger_step % 2 == 1;
                if is_odd_step && swing_pct > 0.0 && should_trigger {
                    let swing_samples = (self.samples_per_step * (swing_pct as f64 / 200.0)) as usize;
                    if swing_samples > 0 {
                        self.swing_pending = true;
                        self.swing_delay_remaining = swing_samples;
                    } else {
                        // Trigger immediately
                        self.gate_on = true;
                        self.gate_samples = 0;
                        self.current_gate = 1.0;
                    }
                } else if should_trigger {
                    // Trigger immediately
                    self.gate_on = true;
                    self.gate_samples = 0;
                    self.current_gate = 1.0;
                }
            }

            // Update gate
            if self.gate_on {
                self.gate_samples += 1;
                if self.gate_samples >= self.gate_length_samples {
                    self.gate_on = false;
                    self.current_gate = 0.0;
                }
            }

            gate_out[i] = self.current_gate;
            step_out[i] = self.current_step as f32;
        }
    }
}
