//! Step Sequencer module.
//!
//! 16-step sequencer with pitch/gate/velocity/slide per step.

use crate::common::{sample_at, Sample};

/// Single step in the sequence.
#[derive(Clone, Copy)]
pub struct SeqStep {
    /// Semitone offset (-24 to +24)
    pub pitch: f32,
    /// Step active (on/off)
    pub gate: bool,
    /// Velocity (0.0 to 1.0)
    pub velocity: f32,
    /// Glide to next note
    pub slide: bool,
}

impl Default for SeqStep {
    fn default() -> Self {
        Self {
            pitch: 0.0,
            gate: true,
            velocity: 1.0,
            slide: false,
        }
    }
}

/// Rate divisions for tempo sync.
pub const SEQ_RATE_DIVISIONS: [f64; 12] = [
    4.0,    // 0: 1 bar
    2.0,    // 1: 1/2
    1.0,    // 2: 1/4
    0.5,    // 3: 1/8
    0.25,   // 4: 1/16
    0.125,  // 5: 1/32
    1.333,  // 6: 1/4 triplet (1/4 * 2/3)
    0.667,  // 7: 1/8 triplet
    0.333,  // 8: 1/16 triplet
    1.5,    // 9: 1/4 dotted
    0.75,   // 10: 1/8 dotted
    0.375,  // 11: 1/16 dotted
];

/// Simple xorshift32 RNG.
struct Xorshift32 {
    state: u32,
}

impl Xorshift32 {
    fn new(seed: u32) -> Self {
        Self { state: seed.max(1) }
    }

    fn next(&mut self) -> u32 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.state = x;
        x
    }
}

/// 16-step sequencer.
///
/// Classic step sequencer with pitch CV, gate, velocity, and slide per step.
/// Supports multiple direction modes and external clock sync.
///
/// # Features
///
/// - 16 programmable steps
/// - Pitch offset (-24 to +24 semitones per step)
/// - Per-step gate, velocity, and slide
/// - Forward, reverse, ping-pong, random directions
/// - Adjustable sequence length (1-16)
/// - Swing support
/// - External clock sync
///
/// # Example
///
/// ```ignore
/// use dsp_core::sequencers::{StepSequencer, StepSequencerInputs, StepSequencerParams, StepSequencerOutputs};
///
/// let mut seq = StepSequencer::new(44100.0);
/// let mut cv_out = [0.0f32; 128];
/// let mut gate_out = [0.0f32; 128];
/// let mut vel_out = [0.0f32; 128];
/// let mut step_out = [0.0f32; 128];
///
/// seq.process_block(
///     StepSequencerOutputs {
///         cv_out: &mut cv_out,
///         gate_out: &mut gate_out,
///         velocity_out: &mut vel_out,
///         step_out: &mut step_out,
///     },
///     StepSequencerInputs { clock: None, reset: None, cv_offset: None },
///     StepSequencerParams {
///         enabled: &[1.0], tempo: &[120.0], rate: &[3.0],
///         gate_length: &[50.0], swing: &[0.0], slide_time: &[50.0],
///         length: &[16.0], direction: &[0.0],
///     },
/// );
/// ```
pub struct StepSequencer {
    sample_rate: f32,

    // Step data - 16 steps
    steps: [SeqStep; 16],

    // Playback state
    current_step: usize,
    phase: f64,
    samples_per_beat: f64,
    #[allow(dead_code)]
    direction: i32,        // 1 or -1 for ping-pong
    ping_pong_forward: bool,

    // Gate timing
    gate_on: bool,
    gate_samples: usize,
    gate_length_samples: usize,

    // Slide (portamento) state
    slide_active: bool,
    slide_source_cv: f32,
    slide_target_cv: f32,
    slide_samples: usize,
    slide_total_samples: usize,

    // Swing state
    swing_pending: bool,
    swing_delay_remaining: usize,
    swing_cv: f32,
    swing_velocity: f32,
    swing_gate_length: usize,

    // Output values
    current_cv: f32,
    current_gate: f32,
    current_velocity: f32,

    // Clock state
    prev_clock: f32,
    prev_reset: f32,

    // RNG for random mode and humanize
    rng: Xorshift32,
}

/// Input signals for StepSequencer.
pub struct StepSequencerInputs<'a> {
    /// External clock input
    pub clock: Option<&'a [Sample]>,
    /// Reset to step 1
    pub reset: Option<&'a [Sample]>,
    /// Base pitch CV offset
    pub cv_offset: Option<&'a [Sample]>,
}

/// Parameters for StepSequencer.
pub struct StepSequencerParams<'a> {
    /// Enable sequencer (0 = off, 1 = on)
    pub enabled: &'a [Sample],
    /// Tempo in BPM (40-300)
    pub tempo: &'a [Sample],
    /// Rate division index
    pub rate: &'a [Sample],
    /// Gate length (10-100%)
    pub gate_length: &'a [Sample],
    /// Swing amount (0-90%)
    pub swing: &'a [Sample],
    /// Global slide time in ms (0-500)
    pub slide_time: &'a [Sample],
    /// Active step count (1-16)
    pub length: &'a [Sample],
    /// Direction mode (0=fwd, 1=rev, 2=pingpong, 3=random)
    pub direction: &'a [Sample],
}

/// Output signals for StepSequencer.
pub struct StepSequencerOutputs<'a> {
    /// CV output (V/octave pitch)
    pub cv_out: &'a mut [Sample],
    /// Gate output
    pub gate_out: &'a mut [Sample],
    /// Velocity output (0-1)
    pub velocity_out: &'a mut [Sample],
    /// Current step position (0-15)
    pub step_out: &'a mut [Sample],
}

impl StepSequencer {
    /// Create a new step sequencer.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            steps: [SeqStep::default(); 16],
            current_step: 0,
            phase: 0.0,
            samples_per_beat: sample_rate as f64 * 0.5, // Default 1/8 at 120 BPM
            direction: 1,
            ping_pong_forward: true,
            gate_on: false,
            gate_samples: 0,
            gate_length_samples: 0,
            slide_active: false,
            slide_source_cv: 0.0,
            slide_target_cv: 0.0,
            slide_samples: 0,
            slide_total_samples: 0,
            swing_pending: false,
            swing_delay_remaining: 0,
            swing_cv: 0.0,
            swing_velocity: 1.0,
            swing_gate_length: 0,
            current_cv: 0.0,
            current_gate: 0.0,
            current_velocity: 1.0,
            prev_clock: 0.0,
            prev_reset: 0.0,
            rng: Xorshift32::new(42),
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Get current step position (0-15).
    pub fn current_step(&self) -> usize {
        self.current_step
    }

    /// Set step data from parsed values.
    pub fn set_step(&mut self, index: usize, pitch: f32, gate: bool, velocity: f32, slide: bool) {
        if index < 16 {
            self.steps[index] = SeqStep {
                pitch: pitch.clamp(-24.0, 24.0),
                gate,
                velocity: velocity.clamp(0.0, 1.0),
                slide,
            };
        }
    }

    /// Parse JSON step data string and update all steps.
    ///
    /// Format: `[{"pitch":0,"gate":true,"velocity":100,"slide":false},...]`
    pub fn parse_step_data(&mut self, json: &str) {
        // Simple JSON parser for step data array
        if !json.starts_with('[') {
            return;
        }

        let mut step_idx = 0;
        let mut in_object = false;
        let mut current_pitch: f32 = 0.0;
        let mut current_gate = true;
        let mut current_velocity: f32 = 1.0;
        let mut current_slide = false;

        let mut key = String::new();
        let mut value = String::new();
        let mut reading_key = false;
        let mut reading_value = false;
        let mut in_string = false;

        for c in json.chars() {
            match c {
                '{' => {
                    in_object = true;
                    current_pitch = 0.0;
                    current_gate = true;
                    current_velocity = 1.0;
                    current_slide = false;
                    key.clear();
                    value.clear();
                }
                '}' => {
                    if in_object {
                        // Apply last key-value pair
                        if !key.is_empty() {
                            match key.as_str() {
                                "pitch" => current_pitch = value.parse().unwrap_or(0.0),
                                "gate" => current_gate = value == "true",
                                "velocity" => {
                                    let v: f32 = value.parse().unwrap_or(100.0);
                                    current_velocity = v / 100.0; // Convert 0-100 to 0-1
                                }
                                "slide" => current_slide = value == "true",
                                _ => {}
                            }
                        }
                        // Save step
                        if step_idx < 16 {
                            self.steps[step_idx] = SeqStep {
                                pitch: current_pitch.clamp(-24.0, 24.0),
                                gate: current_gate,
                                velocity: current_velocity.clamp(0.0, 1.0),
                                slide: current_slide,
                            };
                            step_idx += 1;
                        }
                        in_object = false;
                    }
                }
                '"' => {
                    if !in_string {
                        in_string = true;
                        if !reading_key && !reading_value {
                            reading_key = true;
                            key.clear();
                        }
                    } else {
                        in_string = false;
                        reading_key = false;
                    }
                }
                ':' if !in_string => {
                    reading_value = true;
                    value.clear();
                }
                ',' if !in_string => {
                    if reading_value && !key.is_empty() {
                        match key.as_str() {
                            "pitch" => current_pitch = value.trim().parse().unwrap_or(0.0),
                            "gate" => current_gate = value.trim() == "true",
                            "velocity" => {
                                let v: f32 = value.trim().parse().unwrap_or(100.0);
                                current_velocity = v / 100.0;
                            }
                            "slide" => current_slide = value.trim() == "true",
                            _ => {}
                        }
                    }
                    reading_value = false;
                    key.clear();
                    value.clear();
                }
                _ => {
                    if in_string && reading_key {
                        key.push(c);
                    } else if reading_value && !in_string {
                        if !c.is_whitespace() {
                            value.push(c);
                        }
                    }
                }
            }
        }
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        outputs: StepSequencerOutputs<'_>,
        inputs: StepSequencerInputs<'_>,
        params: StepSequencerParams<'_>,
    ) {
        let frames = outputs.cv_out.len();
        if frames == 0 {
            return;
        }

        // Read params
        let enabled = sample_at(params.enabled, 0, 1.0) > 0.5;
        let tempo = sample_at(params.tempo, 0, 120.0).clamp(40.0, 300.0);
        let rate_idx = (sample_at(params.rate, 0, 3.0) as usize).min(SEQ_RATE_DIVISIONS.len() - 1);
        let gate_pct = sample_at(params.gate_length, 0, 50.0).clamp(10.0, 100.0) / 100.0;
        let swing = sample_at(params.swing, 0, 0.0).clamp(0.0, 90.0) / 100.0;
        let slide_time_ms = sample_at(params.slide_time, 0, 50.0).clamp(0.0, 500.0);
        let length = (sample_at(params.length, 0, 16.0) as usize).clamp(1, 16);
        let dir_mode = (sample_at(params.direction, 0, 0.0) as usize).min(3);

        // Calculate timing
        let beats_per_second = tempo as f64 / 60.0;
        let rate_mult = SEQ_RATE_DIVISIONS[rate_idx];
        let step_duration_seconds = rate_mult / beats_per_second;
        let step_duration_samples = step_duration_seconds * self.sample_rate as f64;
        self.samples_per_beat = step_duration_samples;

        let gate_length_samples = (step_duration_samples * gate_pct as f64) as usize;
        let slide_samples = ((slide_time_ms / 1000.0) * self.sample_rate) as usize;

        // Use external clock if connected
        let use_external_clock = inputs.clock.is_some()
            && inputs.clock.map_or(false, |c| c.iter().any(|&v| v >= 0.0));

        for i in 0..frames {
            if !enabled {
                outputs.cv_out[i] = 0.0;
                outputs.gate_out[i] = 0.0;
                outputs.velocity_out[i] = 0.0;
                outputs.step_out[i] = 0.0;
                continue;
            }

            let cv_offset = inputs.cv_offset.map_or(0.0, |b| sample_at(b, i, 0.0));

            // Check for reset
            let reset_in = inputs.reset.map_or(0.0, |b| sample_at(b, i, 0.0));
            let reset_trigger = reset_in > 0.5 && self.prev_reset <= 0.5;
            self.prev_reset = reset_in;

            if reset_trigger {
                self.current_step = 0;
                self.phase = 0.0;
                self.ping_pong_forward = true;
                self.gate_on = false;
                self.swing_pending = false;
            }

            // Process pending swing step
            if self.swing_pending {
                if self.swing_delay_remaining > 0 {
                    self.swing_delay_remaining -= 1;
                } else {
                    // Fire the swung step
                    self.swing_pending = false;
                    self.current_cv = self.swing_cv;
                    self.current_velocity = self.swing_velocity;
                    self.gate_on = true;
                    self.gate_samples = 0;
                    self.gate_length_samples = self.swing_gate_length;
                }
            }

            // Determine step advance
            let clock_in = inputs.clock.map_or(-1.0, |b| sample_at(b, i, 0.0));
            let clock_trigger = clock_in > 0.5 && self.prev_clock <= 0.5;
            self.prev_clock = clock_in;

            let step_advance = if use_external_clock {
                clock_trigger
            } else {
                self.phase += 1.0 / step_duration_samples;
                if self.phase >= 1.0 {
                    self.phase -= 1.0;
                    true
                } else {
                    false
                }
            };

            if step_advance && !self.swing_pending {
                // Calculate next step based on direction mode
                let next_step = match dir_mode {
                    0 => (self.current_step + 1) % length, // Forward
                    1 => {
                        // Reverse
                        if self.current_step == 0 {
                            length - 1
                        } else {
                            self.current_step - 1
                        }
                    }
                    2 => {
                        // Ping-pong
                        if self.ping_pong_forward {
                            if self.current_step >= length - 1 {
                                self.ping_pong_forward = false;
                                self.current_step.saturating_sub(1)
                            } else {
                                self.current_step + 1
                            }
                        } else {
                            if self.current_step == 0 {
                                self.ping_pong_forward = true;
                                1.min(length - 1)
                            } else {
                                self.current_step - 1
                            }
                        }
                    }
                    _ => self.rng.next() as usize % length, // Random
                };

                // Get step data
                let step = &self.steps[next_step];
                let step_cv = step.pitch / 12.0; // Semitones to V/oct

                // Check for slide from previous step
                let prev_step = &self.steps[self.current_step];
                if prev_step.slide && step.gate {
                    // Start slide
                    self.slide_active = true;
                    self.slide_source_cv = self.current_cv;
                    self.slide_target_cv = step_cv;
                    self.slide_samples = 0;
                    self.slide_total_samples = slide_samples.max(1);
                } else {
                    self.slide_active = false;
                }

                // Check for swing (apply to odd steps)
                let is_odd_step = next_step % 2 == 1;
                let swing_delay = if is_odd_step && swing > 0.0 {
                    let max_swing = 0.45; // Cap at 45%
                    let clamped_swing = (swing as f64).min(max_swing);
                    (step_duration_samples * clamped_swing) as usize
                } else {
                    0
                };

                if step.gate {
                    if swing_delay > 0 {
                        // Queue the step for later
                        self.swing_pending = true;
                        self.swing_delay_remaining = swing_delay;
                        self.swing_cv = step_cv;
                        self.swing_velocity = step.velocity;
                        self.swing_gate_length = gate_length_samples;
                    } else {
                        // Immediate step
                        if !self.slide_active {
                            self.current_cv = step_cv;
                        }
                        self.current_velocity = step.velocity;
                        self.gate_on = true;
                        self.gate_samples = 0;
                        self.gate_length_samples = gate_length_samples;
                    }
                } else {
                    // Step is off
                    self.gate_on = false;
                }

                self.current_step = next_step;
            }

            // Update slide interpolation
            if self.slide_active {
                self.slide_samples += 1;
                let t = (self.slide_samples as f32) / (self.slide_total_samples as f32).max(1.0);
                let t = t.min(1.0);
                self.current_cv = self.slide_source_cv + (self.slide_target_cv - self.slide_source_cv) * t;
                if t >= 1.0 {
                    self.slide_active = false;
                }
            }

            // Update gate
            if self.gate_on {
                self.gate_samples += 1;
                if self.gate_samples >= self.gate_length_samples {
                    self.current_gate = 0.0;
                    self.gate_on = false;
                } else {
                    self.current_gate = 1.0;
                }
            } else {
                self.current_gate = 0.0;
            }

            // Write outputs
            outputs.cv_out[i] = self.current_cv + cv_offset;
            outputs.gate_out[i] = self.current_gate;
            outputs.velocity_out[i] = self.current_velocity;
            outputs.step_out[i] = self.current_step as f32;
        }
    }
}
