//! Polyrhythm Sequencer module.
//!
//! 4 independent tracks with different lengths (1-16 steps each),
//! sharing a common clock for polyrhythmic patterns.

use crate::common::{sample_at, Sample};
use super::RATE_DIVISIONS;

/// Maximum steps per track.
pub const POLY_MAX_STEPS: usize = 16;
/// Number of tracks.
pub const POLY_TRACKS: usize = 4;

/// Single step in a polyrhythm track.
#[derive(Clone, Copy)]
pub struct PolyStep {
    /// Pitch in semitones (-24 to +24)
    pub pitch: f32,
    /// Step active
    pub gate: bool,
    /// Velocity (0.0 to 1.0)
    pub velocity: f32,
}

impl Default for PolyStep {
    fn default() -> Self {
        Self {
            pitch: 0.0,
            gate: true,
            velocity: 1.0,
        }
    }
}

/// A single track with its own length and step position.
struct PolyTrack {
    steps: [PolyStep; POLY_MAX_STEPS],
    current_step: usize,
    current_cv: f32,
    current_gate: f32,
    current_velocity: f32,
    gate_on: bool,
    gate_samples: usize,
}

impl Default for PolyTrack {
    fn default() -> Self {
        Self {
            steps: [PolyStep::default(); POLY_MAX_STEPS],
            current_step: 0,
            current_cv: 0.0,
            current_gate: 0.0,
            current_velocity: 1.0,
            gate_on: false,
            gate_samples: 0,
        }
    }
}

/// 4-track polyrhythm sequencer.
pub struct PolyrhythmSequencer {
    sample_rate: f32,
    tracks: [PolyTrack; POLY_TRACKS],

    // Timing
    phase: f64,

    // Swing
    swing_pending: [bool; POLY_TRACKS],
    swing_delay_remaining: [usize; POLY_TRACKS],
    swing_step_data: [PolyStep; POLY_TRACKS],
    swing_gate_length: [usize; POLY_TRACKS],

    // Clock
    prev_clock: f32,
    prev_reset: f32,
}

/// Input signals.
pub struct PolyrhythmInputs<'a> {
    pub clock: Option<&'a [Sample]>,
    pub reset: Option<&'a [Sample]>,
}

/// Parameters.
pub struct PolyrhythmParams<'a> {
    pub enabled: &'a [Sample],
    pub tempo: &'a [Sample],
    pub rate: &'a [Sample],
    pub gate_length: &'a [Sample],
    pub swing: &'a [Sample],
    pub track1_length: &'a [Sample],
    pub track2_length: &'a [Sample],
    pub track3_length: &'a [Sample],
    pub track4_length: &'a [Sample],
    pub track1_mute: &'a [Sample],
    pub track2_mute: &'a [Sample],
    pub track3_mute: &'a [Sample],
    pub track4_mute: &'a [Sample],
}

/// Output signals.
pub struct PolyrhythmOutputs<'a> {
    pub cv_1: &'a mut [Sample],
    pub gate_1: &'a mut [Sample],
    pub cv_2: &'a mut [Sample],
    pub gate_2: &'a mut [Sample],
    pub cv_3: &'a mut [Sample],
    pub gate_3: &'a mut [Sample],
    pub cv_4: &'a mut [Sample],
    pub gate_4: &'a mut [Sample],
    pub step_out: &'a mut [Sample],
}

impl PolyrhythmSequencer {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            tracks: Default::default(),
            phase: 0.0,
            swing_pending: [false; POLY_TRACKS],
            swing_delay_remaining: [0; POLY_TRACKS],
            swing_step_data: [PolyStep::default(); POLY_TRACKS],
            swing_gate_length: [0; POLY_TRACKS],
            prev_clock: 0.0,
            prev_reset: 0.0,
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Get current step of track 0 (primary track for UI playhead).
    pub fn current_step(&self) -> usize {
        self.tracks[0].current_step
    }

    /// Parse JSON step data for all 4 tracks.
    /// Format: `[{"track":0,"step":0,"pitch":0,"gate":true,"velocity":100},...]`
    pub fn parse_step_data(&mut self, json: &str) {
        if !json.starts_with('[') {
            return;
        }

        let mut in_object = false;
        let mut cur_track: usize = 0;
        let mut cur_step_idx: usize = 0;
        let mut cur_pitch: f32 = 0.0;
        let mut cur_gate = true;
        let mut cur_velocity: f32 = 1.0;

        let mut key = String::new();
        let mut value = String::new();
        let mut reading_key = false;
        let mut reading_value = false;
        let mut in_string = false;

        for c in json.chars() {
            match c {
                '{' => {
                    in_object = true;
                    cur_track = 0;
                    cur_step_idx = 0;
                    cur_pitch = 0.0;
                    cur_gate = true;
                    cur_velocity = 1.0;
                    key.clear();
                    value.clear();
                }
                '}' => {
                    if in_object {
                        if !key.is_empty() {
                            Self::apply_kv(&key, &value, &mut cur_track, &mut cur_step_idx, &mut cur_pitch, &mut cur_gate, &mut cur_velocity);
                        }
                        if cur_track < POLY_TRACKS && cur_step_idx < POLY_MAX_STEPS {
                            self.tracks[cur_track].steps[cur_step_idx] = PolyStep {
                                pitch: cur_pitch.clamp(-24.0, 24.0),
                                gate: cur_gate,
                                velocity: cur_velocity.clamp(0.0, 1.0),
                            };
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
                        Self::apply_kv(&key, &value, &mut cur_track, &mut cur_step_idx, &mut cur_pitch, &mut cur_gate, &mut cur_velocity);
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

    fn apply_kv(key: &str, value: &str, track: &mut usize, step: &mut usize, pitch: &mut f32, gate: &mut bool, velocity: &mut f32) {
        let v = value.trim();
        match key {
            "track" => *track = v.parse().unwrap_or(0),
            "step" => *step = v.parse().unwrap_or(0),
            "pitch" => *pitch = v.parse().unwrap_or(0.0),
            "gate" => *gate = v == "true",
            "velocity" => *velocity = v.parse::<f32>().unwrap_or(100.0) / 100.0,
            _ => {}
        }
    }

    pub fn process_block(
        &mut self,
        outputs: PolyrhythmOutputs<'_>,
        inputs: PolyrhythmInputs<'_>,
        params: PolyrhythmParams<'_>,
    ) {
        let frames = outputs.cv_1.len();
        if frames == 0 {
            return;
        }

        let enabled = sample_at(params.enabled, 0, 1.0) > 0.5;
        let tempo = sample_at(params.tempo, 0, 120.0).clamp(40.0, 300.0);
        let rate_idx = (sample_at(params.rate, 0, 3.0) as usize).min(RATE_DIVISIONS.len() - 1);
        let gate_pct = sample_at(params.gate_length, 0, 50.0).clamp(10.0, 100.0) / 100.0;
        let swing = sample_at(params.swing, 0, 0.0).clamp(0.0, 90.0) / 100.0;

        let track_lengths = [
            (sample_at(params.track1_length, 0, 8.0) as usize).clamp(1, POLY_MAX_STEPS),
            (sample_at(params.track2_length, 0, 12.0) as usize).clamp(1, POLY_MAX_STEPS),
            (sample_at(params.track3_length, 0, 16.0) as usize).clamp(1, POLY_MAX_STEPS),
            (sample_at(params.track4_length, 0, 7.0) as usize).clamp(1, POLY_MAX_STEPS),
        ];

        let track_mutes = [
            sample_at(params.track1_mute, 0, 0.0) > 0.5,
            sample_at(params.track2_mute, 0, 0.0) > 0.5,
            sample_at(params.track3_mute, 0, 0.0) > 0.5,
            sample_at(params.track4_mute, 0, 0.0) > 0.5,
        ];

        let beats_per_second = tempo as f64 / 60.0;
        let rate_mult = RATE_DIVISIONS[rate_idx];
        let step_duration_samples = (rate_mult / beats_per_second) * self.sample_rate as f64;
        let gate_length_samples = (step_duration_samples * gate_pct as f64) as usize;

        let use_external_clock = inputs.clock.is_some()
            && inputs.clock.map_or(false, |c| c.iter().any(|&v| v >= 0.0));

        for i in 0..frames {
            if !enabled {
                outputs.cv_1[i] = 0.0; outputs.gate_1[i] = 0.0;
                outputs.cv_2[i] = 0.0; outputs.gate_2[i] = 0.0;
                outputs.cv_3[i] = 0.0; outputs.gate_3[i] = 0.0;
                outputs.cv_4[i] = 0.0; outputs.gate_4[i] = 0.0;
                outputs.step_out[i] = 0.0;
                continue;
            }

            // Reset
            let reset_in = inputs.reset.map_or(0.0, |b| sample_at(b, i, 0.0));
            let reset_trigger = reset_in > 0.5 && self.prev_reset <= 0.5;
            self.prev_reset = reset_in;

            if reset_trigger {
                self.phase = 0.0;
                for t in 0..POLY_TRACKS {
                    self.tracks[t].current_step = 0;
                    self.tracks[t].gate_on = false;
                    self.swing_pending[t] = false;
                }
            }

            // Swing processing per track
            for t in 0..POLY_TRACKS {
                if self.swing_pending[t] {
                    if self.swing_delay_remaining[t] > 0 {
                        self.swing_delay_remaining[t] -= 1;
                    } else {
                        self.swing_pending[t] = false;
                        let step = self.swing_step_data[t];
                        self.tracks[t].current_cv = step.pitch / 12.0;
                        self.tracks[t].current_velocity = step.velocity;
                        self.tracks[t].gate_on = true;
                        self.tracks[t].gate_samples = 0;
                    }
                }
            }

            // Clock
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

            if step_advance {
                for t in 0..POLY_TRACKS {
                    if self.swing_pending[t] {
                        continue;
                    }

                    let length = track_lengths[t];
                    let next_step = (self.tracks[t].current_step + 1) % length;
                    let step = self.tracks[t].steps[next_step];

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
                            self.swing_pending[t] = true;
                            self.swing_delay_remaining[t] = swing_delay;
                            self.swing_step_data[t] = step;
                            self.swing_gate_length[t] = gate_length_samples;
                        } else {
                            self.tracks[t].current_cv = step.pitch / 12.0;
                            self.tracks[t].current_velocity = step.velocity;
                            self.tracks[t].gate_on = true;
                            self.tracks[t].gate_samples = 0;
                        }
                    } else {
                        self.tracks[t].gate_on = false;
                    }

                    self.tracks[t].current_step = next_step;
                }
            }

            // Gate timing per track
            for t in 0..POLY_TRACKS {
                if self.tracks[t].gate_on {
                    self.tracks[t].gate_samples += 1;
                    let gl = if self.swing_pending[t] { self.swing_gate_length[t] } else { gate_length_samples };
                    if self.tracks[t].gate_samples >= gl {
                        self.tracks[t].current_gate = 0.0;
                        self.tracks[t].gate_on = false;
                    } else {
                        self.tracks[t].current_gate = if track_mutes[t] { 0.0 } else { 1.0 };
                    }
                } else {
                    self.tracks[t].current_gate = 0.0;
                }
            }

            // Write outputs
            outputs.cv_1[i] = self.tracks[0].current_cv;
            outputs.gate_1[i] = self.tracks[0].current_gate;
            outputs.cv_2[i] = self.tracks[1].current_cv;
            outputs.gate_2[i] = self.tracks[1].current_gate;
            outputs.cv_3[i] = self.tracks[2].current_cv;
            outputs.gate_3[i] = self.tracks[2].current_gate;
            outputs.cv_4[i] = self.tracks[3].current_cv;
            outputs.gate_4[i] = self.tracks[3].current_gate;
            outputs.step_out[i] = self.tracks[0].current_step as f32;
        }
    }
}
