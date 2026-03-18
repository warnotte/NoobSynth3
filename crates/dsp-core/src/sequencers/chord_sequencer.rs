//! Chord Sequencer module.
//!
//! 8-step chord progression sequencer with 4 voice outputs,
//! strum, inversions, and voicing modes.

use crate::common::{sample_at, Sample};
use super::RATE_DIVISIONS;

/// Chord type definitions — intervals in semitones from root.
const CHORD_TYPES: [[i8; 4]; 10] = [
    [0, 4, 7, -1],    // 0: Major
    [0, 3, 7, -1],    // 1: Minor
    [0, 4, 7, 10],    // 2: Dom7
    [0, 3, 7, 10],    // 3: Min7
    [0, 4, 7, 11],    // 4: Maj7
    [0, 3, 6, -1],    // 5: Dim
    [0, 4, 8, -1],    // 6: Aug
    [0, 2, 7, -1],    // 7: Sus2
    [0, 5, 7, -1],    // 8: Sus4
    [0, 7, -1, -1],   // 9: Power
];

/// Number of actual notes in each chord type.
const CHORD_NOTE_COUNTS: [usize; 10] = [3, 3, 4, 4, 4, 3, 3, 3, 3, 2];

/// Single step in the chord sequence.
#[derive(Clone, Copy)]
pub struct ChordStep {
    /// Root note (MIDI note number, 0-127)
    pub root: u8,
    /// Chord type index (0-9)
    pub chord_type: u8,
    /// Inversion (0-3)
    pub inversion: u8,
    /// Step active
    pub gate: bool,
}

impl Default for ChordStep {
    fn default() -> Self {
        Self {
            root: 60,       // C4
            chord_type: 0,  // Major
            inversion: 0,
            gate: true,
        }
    }
}

/// 8-step chord progression sequencer.
pub struct ChordSequencer {
    sample_rate: f32,

    // Step data — 8 steps
    steps: [ChordStep; 8],

    // Playback state
    current_step: usize,
    phase: f64,
    prev_rate_idx: usize,

    // Gate timing
    gate_on: bool,
    gate_samples: usize,
    gate_length_samples: usize,

    // Strum state — per voice delay
    strum_delays: [usize; 4],
    strum_pending: [bool; 4],
    strum_alt_down: bool, // for alternating strum direction

    // Swing state
    swing_pending: bool,
    swing_delay_remaining: usize,
    swing_step_data: ChordStep,
    swing_gate_length: usize,

    // Current output values (4 voices)
    current_cv: [f32; 4],
    current_gate: [f32; 4],

    // Clock state
    prev_clock: f32,
    prev_reset: f32,

    // Global transport state (set by graph engine before process_block)
    pub transport_beats: f64,
    pub transport_bps: f64,
    pub last_transport_step: usize,
}

/// Input signals for ChordSequencer.
pub struct ChordSequencerInputs<'a> {
    pub clock: Option<&'a [Sample]>,
    pub reset: Option<&'a [Sample]>,
}

/// Parameters for ChordSequencer.
pub struct ChordSequencerParams<'a> {
    pub enabled: &'a [Sample],
    pub tempo: &'a [Sample],
    pub rate: &'a [Sample],
    pub gate_length: &'a [Sample],
    pub swing: &'a [Sample],
    pub length: &'a [Sample],
    pub strum_speed: &'a [Sample],
    pub strum_direction: &'a [Sample],
    pub voicing: &'a [Sample],
}

/// Output signals for ChordSequencer.
pub struct ChordSequencerOutputs<'a> {
    pub cv_1: &'a mut [Sample],
    pub gate_1: &'a mut [Sample],
    pub cv_2: &'a mut [Sample],
    pub gate_2: &'a mut [Sample],
    pub cv_3: &'a mut [Sample],
    pub gate_3: &'a mut [Sample],
    pub cv_4: &'a mut [Sample],
    pub gate_4: &'a mut [Sample],
    pub step_out: &'a mut [Sample],
    pub root_cv: &'a mut [Sample],
}

impl ChordSequencer {
    pub fn new(sample_rate: f32) -> Self {
        let mut steps = [ChordStep::default(); 8];
        // Default: C-Am-F-G progression
        steps[0] = ChordStep { root: 60, chord_type: 0, inversion: 0, gate: true }; // C
        steps[1] = ChordStep { root: 57, chord_type: 1, inversion: 0, gate: true }; // Am
        steps[2] = ChordStep { root: 65, chord_type: 0, inversion: 0, gate: true }; // F
        steps[3] = ChordStep { root: 67, chord_type: 0, inversion: 0, gate: true }; // G
        // Steps 4-7: off
        for s in &mut steps[4..] {
            s.gate = false;
        }

        Self {
            sample_rate: sample_rate.max(1.0),
            steps,
            current_step: 0,
            phase: 0.0,
            prev_rate_idx: 2,
            gate_on: false,
            gate_samples: 0,
            gate_length_samples: 0,
            strum_delays: [0; 4],
            strum_pending: [false; 4],
            strum_alt_down: true,
            swing_pending: false,
            swing_delay_remaining: 0,
            swing_step_data: ChordStep::default(),
            swing_gate_length: 0,
            current_cv: [0.0; 4],
            current_gate: [0.0; 4],
            prev_clock: 0.0,
            prev_reset: 0.0,
            transport_beats: 0.0,
            transport_bps: 0.0,
            last_transport_step: usize::MAX,
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    pub fn current_step(&self) -> usize {
        self.current_step
    }

    /// Build chord notes for a step, applying inversion and voicing.
    fn build_chord(step: &ChordStep, spread: bool) -> ([f32; 4], usize) {
        let intervals = &CHORD_TYPES[step.chord_type as usize % 10];
        let note_count = CHORD_NOTE_COUNTS[step.chord_type as usize % 10];
        let root = step.root as f32;

        // Gather raw intervals
        let mut notes = [0.0f32; 4];
        for i in 0..note_count {
            notes[i] = root + intervals[i] as f32;
        }

        // Apply inversion: move N bottom notes up an octave
        let inv = (step.inversion as usize).min(note_count.saturating_sub(1));
        for i in 0..inv {
            notes[i] += 12.0;
        }
        // Sort ascending after inversion
        let mut sorted = notes;
        for i in 0..note_count {
            for j in (i + 1)..note_count {
                if sorted[j] < sorted[i] {
                    sorted.swap(i, j);
                }
            }
        }

        // Spread voicing: alternate octave offsets for wider spacing
        if spread && note_count >= 3 {
            // Move voice 1 down an octave, voice 2 stays, voice 3 up an octave
            if note_count >= 3 {
                sorted[0] -= 12.0;
                if note_count >= 4 {
                    sorted[3] += 12.0;
                } else {
                    sorted[2] += 12.0;
                }
            }
        }

        // Convert to CV: (note - 60) / 12.0
        let mut cv = [0.0f32; 4];
        for i in 0..note_count {
            cv[i] = (sorted[i] - 60.0) / 12.0;
        }
        // Fill unused voices by doubling root an octave up
        for i in note_count..4 {
            cv[i] = (sorted[0] + 12.0 - 60.0) / 12.0;
        }

        (cv, note_count)
    }

    /// Parse JSON step data string.
    /// Format: `[{"root":60,"chordType":0,"inversion":0,"gate":true},...]`
    pub fn parse_step_data(&mut self, json: &str) {
        if !json.starts_with('[') {
            return;
        }

        let mut step_idx = 0;
        let mut in_object = false;
        let mut cur_root: u8 = 60;
        let mut cur_chord_type: u8 = 0;
        let mut cur_inversion: u8 = 0;
        let mut cur_gate = true;

        let mut key = String::new();
        let mut value = String::new();
        let mut reading_key = false;
        let mut reading_value = false;
        let mut in_string = false;

        for c in json.chars() {
            match c {
                '{' => {
                    in_object = true;
                    cur_root = 60;
                    cur_chord_type = 0;
                    cur_inversion = 0;
                    cur_gate = true;
                    key.clear();
                    value.clear();
                }
                '}' => {
                    if in_object {
                        if !key.is_empty() {
                            Self::apply_kv(&key, &value, &mut cur_root, &mut cur_chord_type, &mut cur_inversion, &mut cur_gate);
                        }
                        if step_idx < 8 {
                            self.steps[step_idx] = ChordStep {
                                root: cur_root.min(127),
                                chord_type: cur_chord_type.min(9),
                                inversion: cur_inversion.min(3),
                                gate: cur_gate,
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
                        Self::apply_kv(&key, &value, &mut cur_root, &mut cur_chord_type, &mut cur_inversion, &mut cur_gate);
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

    fn apply_kv(key: &str, value: &str, root: &mut u8, chord_type: &mut u8, inversion: &mut u8, gate: &mut bool) {
        let v = value.trim();
        match key {
            "root" => *root = v.parse().unwrap_or(60),
            "chordType" => *chord_type = v.parse().unwrap_or(0),
            "inversion" => *inversion = v.parse().unwrap_or(0),
            "gate" => *gate = v == "true",
            _ => {}
        }
    }

    /// Fire a new chord step, setting up strum delays.
    fn fire_step(&mut self, step: &ChordStep, strum_speed_ms: f32, strum_dir: usize, voicing: usize, gate_length_samples: usize) {
        let spread = voicing == 1;
        let (cv, note_count) = Self::build_chord(step, spread);

        // Strum delay in samples per voice
        let strum_delay_samples = ((strum_speed_ms / 1000.0) * self.sample_rate) as usize;

        // Determine voice order for strum
        let down = match strum_dir {
            1 => false,  // up
            2 => {       // alternate
                let d = self.strum_alt_down;
                self.strum_alt_down = !self.strum_alt_down;
                d
            }
            _ => true,   // down (default)
        };

        for v in 0..4 {
            self.current_cv[v] = cv[v];

            let voice_idx = if down { v } else { 3 - v };
            let delay = voice_idx * strum_delay_samples;

            if delay == 0 && v < note_count {
                self.current_gate[v] = 1.0;
                self.strum_pending[v] = false;
            } else if v < note_count {
                self.strum_delays[v] = delay;
                self.strum_pending[v] = true;
                self.current_gate[v] = 0.0;
            } else {
                // Unused voices: mirror first voice gate
                if strum_delay_samples == 0 {
                    self.current_gate[v] = 1.0;
                } else {
                    self.strum_delays[v] = delay;
                    self.strum_pending[v] = true;
                    self.current_gate[v] = 0.0;
                }
            }
        }

        self.gate_on = true;
        self.gate_samples = 0;
        self.gate_length_samples = gate_length_samples;
    }

    pub fn process_block(
        &mut self,
        outputs: ChordSequencerOutputs<'_>,
        inputs: ChordSequencerInputs<'_>,
        params: ChordSequencerParams<'_>,
    ) {
        let frames = outputs.cv_1.len();
        if frames == 0 {
            return;
        }

        let enabled = sample_at(params.enabled, 0, 1.0) > 0.5;
        let tempo = if self.transport_bps > 0.0 {
            (self.transport_bps * 60.0 * self.sample_rate as f64) as f32
        } else {
            sample_at(params.tempo, 0, 120.0).clamp(40.0, 300.0)
        };
        let rate_idx = (sample_at(params.rate, 0, 2.0) as usize).min(RATE_DIVISIONS.len() - 1);
        // Reset phase on rate change to avoid desync
        if rate_idx != self.prev_rate_idx {
            self.prev_rate_idx = rate_idx;
            self.phase = 0.0;
        }
        let gate_pct = sample_at(params.gate_length, 0, 50.0).clamp(10.0, 100.0) / 100.0;
        let swing = sample_at(params.swing, 0, 0.0).clamp(0.0, 90.0) / 100.0;
        let length = (sample_at(params.length, 0, 4.0) as usize).clamp(1, 8);
        let strum_speed = sample_at(params.strum_speed, 0, 0.0).clamp(0.0, 100.0);
        let strum_dir = (sample_at(params.strum_direction, 0, 0.0) as usize).min(2);
        let voicing = (sample_at(params.voicing, 0, 0.0) as usize).min(1);

        let beats_per_second = tempo as f64 / 60.0;
        let rate_mult = RATE_DIVISIONS[rate_idx];
        let step_duration_samples = (rate_mult / beats_per_second) * self.sample_rate as f64;
        let gate_length_samples = (step_duration_samples * gate_pct as f64) as usize;

        let use_external_clock = inputs.clock.is_some()
            && inputs.clock.map_or(false, |c| c.iter().any(|&v| v >= 0.0));
        // When using external clock, force swing to 0 to avoid double-swing
        // (the master clock already applies its own swing)
        let swing = if use_external_clock { 0.0 } else { swing };

        for i in 0..frames {
            if !enabled {
                outputs.cv_1[i] = 0.0; outputs.gate_1[i] = 0.0;
                outputs.cv_2[i] = 0.0; outputs.gate_2[i] = 0.0;
                outputs.cv_3[i] = 0.0; outputs.gate_3[i] = 0.0;
                outputs.cv_4[i] = 0.0; outputs.gate_4[i] = 0.0;
                outputs.step_out[i] = 0.0;
                outputs.root_cv[i] = 0.0;
                continue;
            }

            // Reset
            let reset_in = inputs.reset.map_or(0.0, |b| sample_at(b, i, 0.0));
            let reset_trigger = reset_in > 0.5 && self.prev_reset <= 0.5;
            self.prev_reset = reset_in;

            if reset_trigger {
                self.current_step = 0;
                self.phase = 0.0;
                self.gate_on = false;
                self.swing_pending = false;
                for v in 0..4 {
                    self.strum_pending[v] = false;
                }
            }

            // Swing processing
            if self.swing_pending {
                if self.swing_delay_remaining > 0 {
                    self.swing_delay_remaining -= 1;
                } else {
                    self.swing_pending = false;
                    let step = self.swing_step_data;
                    let gl = self.swing_gate_length;
                    self.fire_step(&step, strum_speed, strum_dir, voicing, gl);
                }
            }

            // Clock / internal timing
            let clock_in = inputs.clock.map_or(-1.0, |b| sample_at(b, i, 0.0));
            let clock_trigger = clock_in > 0.5 && self.prev_clock <= 0.5;
            self.prev_clock = clock_in;

            let step_advance = if use_external_clock {
                clock_trigger
            } else if self.transport_bps > 0.0 {
                // Derive step position from global transport (deterministic)
                let beat_now = self.transport_beats + i as f64 * self.transport_bps;
                let rate_beats = RATE_DIVISIONS[rate_idx];
                let step_idx = (beat_now / rate_beats).floor() as usize;
                if step_idx != self.last_transport_step {
                    self.last_transport_step = step_idx;
                    true
                } else {
                    false
                }
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
                let next_step = (self.current_step + 1) % length;
                let step = self.steps[next_step];

                // Swing on odd steps
                let is_odd = next_step % 2 == 1;
                let swing_delay = if is_odd && swing > 0.0 {
                    let clamped = (swing as f64).min(0.45);
                    (step_duration_samples * clamped) as usize
                } else {
                    0
                };

                if step.gate {
                    if swing_delay > 0 {
                        self.swing_pending = true;
                        self.swing_delay_remaining = swing_delay;
                        self.swing_step_data = step;
                        self.swing_gate_length = gate_length_samples;
                    } else {
                        self.fire_step(&step, strum_speed, strum_dir, voicing, gate_length_samples);
                    }
                } else {
                    self.gate_on = false;
                    for v in 0..4 {
                        self.current_gate[v] = 0.0;
                        self.strum_pending[v] = false;
                    }
                }

                self.current_step = next_step;
            }

            // Process strum delays
            for v in 0..4 {
                if self.strum_pending[v] {
                    if self.strum_delays[v] > 0 {
                        self.strum_delays[v] -= 1;
                    } else {
                        self.strum_pending[v] = false;
                        self.current_gate[v] = 1.0;
                    }
                }
            }

            // Gate timing
            if self.gate_on {
                self.gate_samples += 1;
                if self.gate_samples >= self.gate_length_samples {
                    self.gate_on = false;
                    for v in 0..4 {
                        self.current_gate[v] = 0.0;
                        self.strum_pending[v] = false;
                    }
                }
            }

            // Write outputs
            outputs.cv_1[i] = self.current_cv[0];
            outputs.gate_1[i] = self.current_gate[0];
            outputs.cv_2[i] = self.current_cv[1];
            outputs.gate_2[i] = self.current_gate[1];
            outputs.cv_3[i] = self.current_cv[2];
            outputs.gate_3[i] = self.current_gate[2];
            outputs.cv_4[i] = self.current_cv[3];
            outputs.gate_4[i] = self.current_gate[3];
            outputs.step_out[i] = self.current_step as f32;
            outputs.root_cv[i] = (self.steps[self.current_step].root as f32 - 60.0) / 12.0;
        }
    }
}
