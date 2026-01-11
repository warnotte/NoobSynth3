//! Drum Sequencer module.
//!
//! 8-track, 16-step drum pattern sequencer.

use crate::common::{sample_at, Sample};

use super::step_sequencer::SEQ_RATE_DIVISIONS;

/// Number of drum tracks.
pub const DRUM_TRACKS: usize = 8;

/// Number of steps per track.
pub const DRUM_STEPS: usize = 16;

/// Track names for reference.
pub const DRUM_TRACK_NAMES: [&str; DRUM_TRACKS] = [
    "kick", "snare", "hhc", "hho", "clap", "tom", "rim", "aux"
];

/// Single step in a drum track.
#[derive(Clone, Copy)]
pub struct DrumStep {
    /// Step active
    pub gate: bool,
    /// Accent (high velocity)
    pub accent: bool,
}

impl Default for DrumStep {
    fn default() -> Self {
        Self {
            gate: false,
            accent: false,
        }
    }
}

/// 8-track drum sequencer.
///
/// Classic drum machine pattern sequencer with 8 tracks and 16 steps.
/// Each step can have gate and accent. Outputs gate and accent CV for each track.
///
/// # Tracks
///
/// 1. Kick
/// 2. Snare
/// 3. Hi-Hat Closed
/// 4. Hi-Hat Open
/// 5. Clap
/// 6. Tom
/// 7. Rimshot
/// 8. Aux
///
/// # Outputs
///
/// - 8 gate outputs (one per track)
/// - 8 accent outputs (one per track, 0.5 = normal, 1.0 = accented)
/// - Step position output (0-15)
///
/// # Example
///
/// ```ignore
/// use dsp_core::sequencers::{DrumSequencer, DrumSequencerInputs, DrumSequencerParams, DrumSequencerOutputs};
///
/// let mut seq = DrumSequencer::new(44100.0);
///
/// // Set up a basic 4-on-the-floor pattern
/// seq.set_step(0, 0, true, false);  // Kick on step 1
/// seq.set_step(0, 4, true, false);  // Kick on step 5
/// seq.set_step(0, 8, true, false);  // Kick on step 9
/// seq.set_step(0, 12, true, false); // Kick on step 13
/// ```
pub struct DrumSequencer {
    sample_rate: f32,

    // Pattern data: 8 tracks x 16 steps
    steps: [[DrumStep; DRUM_STEPS]; DRUM_TRACKS],

    // Playback state
    current_step: usize,
    phase: f64,
    samples_per_step: f64,

    // Gate timing (per track)
    gate_on: [bool; DRUM_TRACKS],
    gate_samples: [usize; DRUM_TRACKS],
    gate_length_samples: usize,

    // Swing state
    swing_pending: bool,
    swing_delay_remaining: usize,
    swing_gates: [bool; DRUM_TRACKS],
    swing_accents: [bool; DRUM_TRACKS],

    // Edge detection
    prev_clock: f32,
    prev_reset: f32,

    // Output values (per track)
    current_gates: [f32; DRUM_TRACKS],
    current_accents: [f32; DRUM_TRACKS],
}

/// Input signals for DrumSequencer.
pub struct DrumSequencerInputs<'a> {
    /// External clock input
    pub clock: Option<&'a [Sample]>,
    /// Reset trigger input
    pub reset: Option<&'a [Sample]>,
}

/// Parameters for DrumSequencer.
pub struct DrumSequencerParams<'a> {
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
    /// Pattern length (4-16)
    pub length: &'a [Sample],
}

/// Output signals for DrumSequencer.
pub struct DrumSequencerOutputs<'a> {
    // 8 gate outputs
    pub gate_kick: &'a mut [Sample],
    pub gate_snare: &'a mut [Sample],
    pub gate_hhc: &'a mut [Sample],
    pub gate_hho: &'a mut [Sample],
    pub gate_clap: &'a mut [Sample],
    pub gate_tom: &'a mut [Sample],
    pub gate_rim: &'a mut [Sample],
    pub gate_aux: &'a mut [Sample],
    // 8 accent outputs
    pub acc_kick: &'a mut [Sample],
    pub acc_snare: &'a mut [Sample],
    pub acc_hhc: &'a mut [Sample],
    pub acc_hho: &'a mut [Sample],
    pub acc_clap: &'a mut [Sample],
    pub acc_tom: &'a mut [Sample],
    pub acc_rim: &'a mut [Sample],
    pub acc_aux: &'a mut [Sample],
    // Step position output
    pub step_out: &'a mut [Sample],
}

impl DrumSequencer {
    /// Create a new drum sequencer.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            steps: [[DrumStep::default(); DRUM_STEPS]; DRUM_TRACKS],
            current_step: 0,
            phase: 0.0,
            samples_per_step: sample_rate as f64 * 0.125, // Default 1/16 at 120 BPM
            gate_on: [false; DRUM_TRACKS],
            gate_samples: [0; DRUM_TRACKS],
            gate_length_samples: 0,
            swing_pending: false,
            swing_delay_remaining: 0,
            swing_gates: [false; DRUM_TRACKS],
            swing_accents: [false; DRUM_TRACKS],
            prev_clock: 0.0,
            prev_reset: 0.0,
            current_gates: [0.0; DRUM_TRACKS],
            current_accents: [0.0; DRUM_TRACKS],
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

    /// Set a single step.
    pub fn set_step(&mut self, track: usize, step: usize, gate: bool, accent: bool) {
        if track < DRUM_TRACKS && step < DRUM_STEPS {
            self.steps[track][step] = DrumStep { gate, accent };
        }
    }

    /// Parse JSON drum data string and update all steps.
    ///
    /// Format: `{"tracks":[[{"g":1,"a":0},...],...]}`
    pub fn parse_drum_data(&mut self, json: &str) {
        // Reset all steps first
        for track in 0..DRUM_TRACKS {
            for step in 0..DRUM_STEPS {
                self.steps[track][step] = DrumStep::default();
            }
        }

        // Find "tracks" array
        let tracks_start = json.find("\"tracks\"");
        if tracks_start.is_none() {
            return;
        }

        // Simple state machine parser
        let mut track_idx = 0;
        let mut step_idx = 0;
        let mut in_tracks = false;
        let mut track_depth = 0;
        let mut in_step_object = false;
        let mut current_gate = false;
        let mut current_accent = false;
        let mut key = String::new();
        let mut value = String::new();
        let mut reading_key = false;
        let mut reading_value = false;
        let mut in_string = false;

        for c in json.chars() {
            match c {
                '[' => {
                    if !in_tracks {
                        in_tracks = true;
                    } else {
                        track_depth += 1;
                        if track_depth == 1 {
                            step_idx = 0;
                        }
                    }
                }
                ']' => {
                    if in_tracks && track_depth > 0 {
                        track_depth -= 1;
                        if track_depth == 0 {
                            track_idx += 1;
                        }
                    } else {
                        in_tracks = false;
                    }
                }
                '{' => {
                    if in_tracks && track_depth == 1 {
                        in_step_object = true;
                        current_gate = false;
                        current_accent = false;
                        key.clear();
                        value.clear();
                        // Reset parsing state for new step object - critical for first track!
                        reading_key = false;
                        reading_value = false;
                    }
                }
                '}' => {
                    if in_step_object {
                        // Apply last key-value pair
                        if !key.is_empty() {
                            match key.as_str() {
                                "g" => current_gate = value.trim() == "1" || value.trim() == "true",
                                "a" => current_accent = value.trim() == "1" || value.trim() == "true",
                                _ => {}
                            }
                        }
                        // Save step
                        if track_idx < DRUM_TRACKS && step_idx < DRUM_STEPS {
                            self.steps[track_idx][step_idx] = DrumStep {
                                gate: current_gate,
                                accent: current_accent,
                            };
                            step_idx += 1;
                        }
                        in_step_object = false;
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
                    if in_step_object && reading_value && !key.is_empty() {
                        match key.as_str() {
                            "g" => current_gate = value.trim() == "1" || value.trim() == "true",
                            "a" => current_accent = value.trim() == "1" || value.trim() == "true",
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
                    } else if reading_value && !in_string && !c.is_whitespace() {
                        value.push(c);
                    }
                }
            }
        }
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        outputs: DrumSequencerOutputs<'_>,
        inputs: DrumSequencerInputs<'_>,
        params: DrumSequencerParams<'_>,
    ) {
        let frames = outputs.step_out.len();
        if frames == 0 {
            return;
        }

        // Read params
        let enabled = sample_at(params.enabled, 0, 1.0) > 0.5;
        let tempo = sample_at(params.tempo, 0, 120.0).clamp(40.0, 300.0);
        let rate_idx = (sample_at(params.rate, 0, 4.0) as usize).min(SEQ_RATE_DIVISIONS.len() - 1);
        let gate_pct = sample_at(params.gate_length, 0, 50.0).clamp(10.0, 100.0) / 100.0;
        let swing = sample_at(params.swing, 0, 0.0).clamp(0.0, 90.0) / 100.0;
        let length = (sample_at(params.length, 0, 16.0) as usize).clamp(4, 16);

        // Calculate timing
        let beats_per_second = tempo as f64 / 60.0;
        let rate_mult = SEQ_RATE_DIVISIONS[rate_idx];
        let step_duration_seconds = rate_mult / beats_per_second;
        let step_duration_samples = step_duration_seconds * self.sample_rate as f64;
        self.samples_per_step = step_duration_samples;

        self.gate_length_samples = (step_duration_samples * gate_pct as f64) as usize;

        // Use external clock if connected
        let use_external_clock = inputs.clock.is_some()
            && inputs.clock.map_or(false, |c| c.iter().any(|&v| v >= 0.0));

        // Output slice references
        let out_gates: [&mut [Sample]; DRUM_TRACKS] = [
            outputs.gate_kick,
            outputs.gate_snare,
            outputs.gate_hhc,
            outputs.gate_hho,
            outputs.gate_clap,
            outputs.gate_tom,
            outputs.gate_rim,
            outputs.gate_aux,
        ];
        let out_accents: [&mut [Sample]; DRUM_TRACKS] = [
            outputs.acc_kick,
            outputs.acc_snare,
            outputs.acc_hhc,
            outputs.acc_hho,
            outputs.acc_clap,
            outputs.acc_tom,
            outputs.acc_rim,
            outputs.acc_aux,
        ];

        for i in 0..frames {
            if !enabled {
                for track in 0..DRUM_TRACKS {
                    out_gates[track][i] = 0.0;
                    out_accents[track][i] = 0.0;
                }
                outputs.step_out[i] = 0.0;
                continue;
            }

            // Check for reset
            let reset_in = inputs.reset.map_or(0.0, |b| sample_at(b, i, 0.0));
            let reset_trigger = reset_in > 0.5 && self.prev_reset <= 0.5;
            self.prev_reset = reset_in;

            if reset_trigger {
                self.current_step = 0;
                self.phase = 0.0;
                for track in 0..DRUM_TRACKS {
                    self.gate_on[track] = false;
                    self.current_gates[track] = 0.0;
                }
                self.swing_pending = false;
            }

            // Process pending swing step
            if self.swing_pending {
                if self.swing_delay_remaining > 0 {
                    self.swing_delay_remaining -= 1;
                } else {
                    // Fire the swung step
                    self.swing_pending = false;
                    for track in 0..DRUM_TRACKS {
                        if self.swing_gates[track] {
                            self.gate_on[track] = true;
                            self.gate_samples[track] = 0;
                            self.current_accents[track] = if self.swing_accents[track] { 1.0 } else { 0.5 };
                        }
                    }
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
                // Play current step first, then advance
                let play_step = self.current_step % length;

                // Check for swing (apply to odd steps)
                let is_odd_step = play_step % 2 == 1;
                let swing_delay = if is_odd_step && swing > 0.0 {
                    let max_swing = 0.45;
                    let clamped_swing = (swing as f64).min(max_swing);
                    (step_duration_samples * clamped_swing) as usize
                } else {
                    0
                };

                // Trigger gates for active steps on all tracks
                let mut any_gate = false;
                for track in 0..DRUM_TRACKS {
                    let step = &self.steps[track][play_step];
                    if step.gate {
                        any_gate = true;
                        if swing_delay > 0 {
                            self.swing_gates[track] = true;
                            self.swing_accents[track] = step.accent;
                        } else {
                            self.gate_on[track] = true;
                            self.gate_samples[track] = 0;
                            self.current_accents[track] = if step.accent { 1.0 } else { 0.5 };
                        }
                    } else {
                        self.swing_gates[track] = false;
                    }
                }

                if any_gate && swing_delay > 0 {
                    self.swing_pending = true;
                    self.swing_delay_remaining = swing_delay;
                }

                // Advance to next step after playing
                self.current_step = (self.current_step + 1) % length;
            }

            // Update gate outputs
            for track in 0..DRUM_TRACKS {
                if self.gate_on[track] {
                    self.current_gates[track] = 1.0;
                    self.gate_samples[track] += 1;
                    if self.gate_samples[track] >= self.gate_length_samples {
                        self.gate_on[track] = false;
                        self.current_gates[track] = 0.0;
                        self.current_accents[track] = 0.0; // Reset accent when gate ends
                    }
                }
            }

            // Write outputs
            for track in 0..DRUM_TRACKS {
                out_gates[track][i] = self.current_gates[track];
                out_accents[track][i] = self.current_accents[track];
            }
            outputs.step_out[i] = self.current_step as f32;
        }
    }
}
