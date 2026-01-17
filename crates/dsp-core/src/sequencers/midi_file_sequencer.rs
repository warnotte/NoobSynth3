//! MIDI File Sequencer module.
//!
//! Plays back MIDI files with 8 output tracks.

use crate::common::{sample_at, Sample, A4_MIDI};

/// Number of output tracks.
pub const MIDI_TRACKS: usize = 8;

/// Maximum notes per track.
pub const MAX_NOTES_PER_TRACK: usize = 8192;

/// A single MIDI note event.
#[derive(Clone, Copy, Default)]
pub struct MidiNote {
    /// Position in ticks from start
    pub tick: u32,
    /// MIDI note number (0-127)
    pub note: u8,
    /// Velocity (0-127)
    pub velocity: u8,
    /// Duration in ticks
    pub duration: u32,
}

/// A MIDI track containing notes.
#[derive(Clone)]
pub struct MidiTrack {
    /// Notes in this track, sorted by tick
    pub notes: Vec<MidiNote>,
    /// Current note index during playback
    pub note_index: usize,
    /// Active notes (for polyphony tracking - simplified: track last triggered note)
    pub active_note: Option<MidiNote>,
    /// Remaining duration for active note (in samples)
    pub note_remaining: usize,
}

impl Default for MidiTrack {
    fn default() -> Self {
        Self {
            notes: Vec::new(),
            note_index: 0,
            active_note: None,
            note_remaining: 0,
        }
    }
}

/// MIDI File Sequencer.
///
/// Plays back MIDI files with up to 8 tracks. Each track outputs CV (pitch),
/// Gate, and Velocity signals.
///
/// # Outputs
///
/// Per track (x8):
/// - CV: Pitch in V/Oct (A4 = 0V)
/// - Gate: 1.0 while note active, 0.0 otherwise
/// - Velocity: 0.0-1.0 based on note velocity
///
/// Plus:
/// - Tick position output (normalized 0-1 for progress display)
///
/// # Data Format
///
/// MIDI data is passed as JSON string via `parse_midi_data()`.
pub struct MidiFileSequencer {
    sample_rate: f32,

    // Track data
    tracks: [MidiTrack; MIDI_TRACKS],

    // Timing
    ticks_per_beat: u32,
    total_ticks: u32,
    current_tick: f64,
    samples_per_tick: f64,

    // Gate timing
    gate_on: [bool; MIDI_TRACKS],
    gate_samples: [usize; MIDI_TRACKS],
    gate_length_samples: [usize; MIDI_TRACKS],

    // Current output values
    current_cv: [f32; MIDI_TRACKS],
    current_gate: [f32; MIDI_TRACKS],
    current_velocity: [f32; MIDI_TRACKS],

    // Edge detection for reset input
    prev_reset: f32,

    // State
    playing: bool,
}

/// Input signals for MidiFileSequencer.
pub struct MidiFileSequencerInputs<'a> {
    /// External clock input (optional)
    pub clock: Option<&'a [Sample]>,
    /// Reset trigger input
    pub reset: Option<&'a [Sample]>,
}

/// Parameters for MidiFileSequencer.
pub struct MidiFileSequencerParams<'a> {
    /// Enable sequencer (0 = off, 1 = on)
    pub enabled: &'a [Sample],
    /// Tempo in BPM (40-300)
    pub tempo: &'a [Sample],
    /// Gate length percentage (10-100%)
    pub gate_length: &'a [Sample],
    /// Loop playback (0 = off, 1 = on)
    pub loop_enabled: &'a [Sample],
    /// Mute flags for each track (0 = unmuted, 1 = muted)
    pub mute: [&'a [Sample]; MIDI_TRACKS],
}

/// Output signals for MidiFileSequencer.
pub struct MidiFileSequencerOutputs<'a> {
    // Per track outputs (8 tracks x 3 outputs each)
    pub cv_1: &'a mut [Sample],
    pub gate_1: &'a mut [Sample],
    pub vel_1: &'a mut [Sample],
    pub cv_2: &'a mut [Sample],
    pub gate_2: &'a mut [Sample],
    pub vel_2: &'a mut [Sample],
    pub cv_3: &'a mut [Sample],
    pub gate_3: &'a mut [Sample],
    pub vel_3: &'a mut [Sample],
    pub cv_4: &'a mut [Sample],
    pub gate_4: &'a mut [Sample],
    pub vel_4: &'a mut [Sample],
    pub cv_5: &'a mut [Sample],
    pub gate_5: &'a mut [Sample],
    pub vel_5: &'a mut [Sample],
    pub cv_6: &'a mut [Sample],
    pub gate_6: &'a mut [Sample],
    pub vel_6: &'a mut [Sample],
    pub cv_7: &'a mut [Sample],
    pub gate_7: &'a mut [Sample],
    pub vel_7: &'a mut [Sample],
    pub cv_8: &'a mut [Sample],
    pub gate_8: &'a mut [Sample],
    pub vel_8: &'a mut [Sample],
    // Tick position (normalized 0-1)
    pub tick_out: &'a mut [Sample],
}

impl MidiFileSequencer {
    /// Create a new MIDI file sequencer.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            tracks: Default::default(),
            ticks_per_beat: 480,
            total_ticks: 0,
            current_tick: 0.0,
            samples_per_tick: sample_rate as f64 / 8.0, // Default: ~60 BPM at 480 PPQN
            gate_on: [false; MIDI_TRACKS],
            gate_samples: [0; MIDI_TRACKS],
            gate_length_samples: [0; MIDI_TRACKS],
            current_cv: [0.0; MIDI_TRACKS],
            current_gate: [0.0; MIDI_TRACKS],
            current_velocity: [0.0; MIDI_TRACKS],
            prev_reset: 0.0,
            playing: false,
        }
    }

    /// Update sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Get current tick position (for playhead UI).
    pub fn current_tick(&self) -> u32 {
        self.current_tick as u32
    }

    /// Get total ticks (for progress display).
    pub fn total_ticks(&self) -> u32 {
        self.total_ticks
    }

    /// Parse JSON MIDI data and load into tracks.
    ///
    /// Expected format:
    /// ```json
    /// {
    ///   "ticksPerBeat": 480,
    ///   "totalTicks": 9600,
    ///   "tracks": [
    ///     {
    ///       "notes": [
    ///         {"tick": 0, "note": 60, "velocity": 100, "duration": 240},
    ///         ...
    ///       ]
    ///     },
    ///     ...
    ///   ]
    /// }
    /// ```
    pub fn parse_midi_data(&mut self, json: &str) {
        // Reset all tracks
        for track in &mut self.tracks {
            track.notes.clear();
            track.note_index = 0;
            track.active_note = None;
            track.note_remaining = 0;
        }
        self.current_tick = 0.0;
        self.total_ticks = 0;
        self.ticks_per_beat = 480;

        // Parse ticksPerBeat
        if let Some(start) = json.find("\"ticksPerBeat\"") {
            if let Some(colon) = json[start..].find(':') {
                let value_start = start + colon + 1;
                let value_str: String = json[value_start..]
                    .chars()
                    .take_while(|c| c.is_ascii_digit() || c.is_whitespace())
                    .collect();
                if let Ok(v) = value_str.trim().parse::<u32>() {
                    self.ticks_per_beat = v.max(1);
                }
            }
        }

        // Parse totalTicks
        if let Some(start) = json.find("\"totalTicks\"") {
            if let Some(colon) = json[start..].find(':') {
                let value_start = start + colon + 1;
                let value_str: String = json[value_start..]
                    .chars()
                    .take_while(|c| c.is_ascii_digit() || c.is_whitespace())
                    .collect();
                if let Ok(v) = value_str.trim().parse::<u32>() {
                    self.total_ticks = v;
                }
            }
        }

        // Parse tracks array
        let tracks_start = match json.find("\"tracks\"") {
            Some(pos) => pos,
            None => return,
        };

        // Find the start of tracks array
        let array_start = match json[tracks_start..].find('[') {
            Some(pos) => tracks_start + pos,
            None => return,
        };

        // Parse each track
        let mut track_idx = 0;
        let mut depth = 0;
        let mut track_start = 0;

        for (i, c) in json[array_start..].char_indices() {
            match c {
                '[' => {
                    if depth == 1 {
                        // Start of notes array within a track
                    }
                    depth += 1;
                }
                '{' => {
                    if depth == 1 {
                        // Start of track object
                        track_start = array_start + i;
                    }
                }
                '}' => {
                    if depth == 1 && track_idx < MIDI_TRACKS {
                        // End of track object - parse it
                        let track_json = &json[track_start..=array_start + i];
                        self.parse_track(track_idx, track_json);
                        track_idx += 1;
                    }
                }
                ']' => {
                    depth -= 1;
                    if depth == 0 {
                        break; // End of tracks array
                    }
                }
                _ => {}
            }
        }

        // Reset playback state
        for track in &mut self.tracks {
            track.note_index = 0;
            track.active_note = None;
        }
        self.playing = true;
    }

    /// Parse a single track's notes from JSON.
    fn parse_track(&mut self, track_idx: usize, json: &str) {
        if track_idx >= MIDI_TRACKS {
            return;
        }

        // Find notes array
        let notes_start = match json.find("\"notes\"") {
            Some(pos) => pos,
            None => return,
        };

        let array_start = match json[notes_start..].find('[') {
            Some(pos) => notes_start + pos,
            None => return,
        };

        // Collect note JSON strings first to avoid borrow conflicts
        let mut note_jsons: Vec<(usize, usize)> = Vec::new();
        let mut depth = 0;
        let mut note_start = 0;
        let mut in_note = false;

        for (i, c) in json[array_start..].char_indices() {
            match c {
                '[' => depth += 1,
                ']' => {
                    depth -= 1;
                    if depth == 0 {
                        break;
                    }
                }
                '{' => {
                    if depth == 1 {
                        note_start = array_start + i;
                        in_note = true;
                    }
                }
                '}' => {
                    if in_note && depth == 1 {
                        note_jsons.push((note_start, array_start + i + 1));
                        in_note = false;
                    }
                }
                _ => {}
            }
        }

        // Now parse notes and add to track
        for (start, end) in note_jsons {
            if self.tracks[track_idx].notes.len() >= MAX_NOTES_PER_TRACK {
                break;
            }
            let note_json = &json[start..end];
            if let Some(note) = self.parse_note(note_json) {
                self.tracks[track_idx].notes.push(note);
            }
        }

        // Sort notes by tick
        self.tracks[track_idx].notes.sort_by_key(|n| n.tick);
    }

    /// Parse a single note object from JSON.
    fn parse_note(&self, json: &str) -> Option<MidiNote> {
        let mut note = MidiNote::default();
        let mut has_tick = false;
        let mut has_note = false;

        // Parse tick
        if let Some(v) = self.parse_number(json, "tick") {
            note.tick = v as u32;
            has_tick = true;
        }

        // Parse note number
        if let Some(v) = self.parse_number(json, "note") {
            note.note = (v as u8).min(127);
            has_note = true;
        }

        // Parse velocity
        if let Some(v) = self.parse_number(json, "velocity") {
            note.velocity = (v as u8).min(127);
        } else {
            note.velocity = 100; // Default velocity
        }

        // Parse duration
        if let Some(v) = self.parse_number(json, "duration") {
            note.duration = v as u32;
        } else {
            note.duration = self.ticks_per_beat / 4; // Default: 16th note
        }

        if has_tick && has_note {
            Some(note)
        } else {
            None
        }
    }

    /// Parse a numeric value from JSON.
    fn parse_number(&self, json: &str, key: &str) -> Option<f64> {
        let search = format!("\"{}\"", key);
        let key_pos = json.find(&search)?;
        let colon_pos = json[key_pos..].find(':')?;
        let value_start = key_pos + colon_pos + 1;

        let value_str: String = json[value_start..]
            .chars()
            .skip_while(|c| c.is_whitespace())
            .take_while(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
            .collect();

        value_str.parse().ok()
    }

    /// Convert MIDI note to CV (V/Oct, A4 = 0V).
    fn note_to_cv(note: u8) -> f32 {
        (note as f32 - A4_MIDI as f32) / 12.0
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        outputs: MidiFileSequencerOutputs<'_>,
        inputs: MidiFileSequencerInputs<'_>,
        params: MidiFileSequencerParams<'_>,
    ) {
        let frames = outputs.tick_out.len();
        if frames == 0 {
            return;
        }

        // Read params
        let enabled = sample_at(params.enabled, 0, 1.0) > 0.5;
        let tempo = sample_at(params.tempo, 0, 120.0).clamp(40.0, 300.0);
        let gate_pct = sample_at(params.gate_length, 0, 90.0).clamp(10.0, 100.0) / 100.0;
        let loop_enabled = sample_at(params.loop_enabled, 0, 1.0) > 0.5;

        // Read mute flags for each track
        let mut track_muted = [false; MIDI_TRACKS];
        for track_idx in 0..MIDI_TRACKS {
            track_muted[track_idx] = sample_at(params.mute[track_idx], 0, 0.0) > 0.5;
        }

        // Calculate timing: samples per tick based on tempo and PPQN
        // At 120 BPM with 480 PPQN: 1 beat = 0.5s, 1 tick = 0.5/480 = ~1.04ms
        let beats_per_second = tempo as f64 / 60.0;
        let ticks_per_second = beats_per_second * self.ticks_per_beat as f64;
        self.samples_per_tick = self.sample_rate as f64 / ticks_per_second;

        // Collect output slices into arrays for indexed access
        let out_cv: [&mut [Sample]; MIDI_TRACKS] = [
            outputs.cv_1,
            outputs.cv_2,
            outputs.cv_3,
            outputs.cv_4,
            outputs.cv_5,
            outputs.cv_6,
            outputs.cv_7,
            outputs.cv_8,
        ];
        let out_gate: [&mut [Sample]; MIDI_TRACKS] = [
            outputs.gate_1,
            outputs.gate_2,
            outputs.gate_3,
            outputs.gate_4,
            outputs.gate_5,
            outputs.gate_6,
            outputs.gate_7,
            outputs.gate_8,
        ];
        let out_vel: [&mut [Sample]; MIDI_TRACKS] = [
            outputs.vel_1,
            outputs.vel_2,
            outputs.vel_3,
            outputs.vel_4,
            outputs.vel_5,
            outputs.vel_6,
            outputs.vel_7,
            outputs.vel_8,
        ];

        for i in 0..frames {
            if !enabled {
                // Output silence when disabled
                for track in 0..MIDI_TRACKS {
                    out_cv[track][i] = 0.0;
                    out_gate[track][i] = 0.0;
                    out_vel[track][i] = 0.0;
                }
                outputs.tick_out[i] = 0.0;
                continue;
            }

            // Check for reset
            let reset_in = inputs.reset.map_or(0.0, |b| sample_at(b, i, 0.0));
            let reset_trigger = reset_in > 0.5 && self.prev_reset <= 0.5;
            self.prev_reset = reset_in;

            if reset_trigger {
                self.current_tick = 0.0;
                for track in &mut self.tracks {
                    track.note_index = 0;
                    track.active_note = None;
                    track.note_remaining = 0;
                }
                for track in 0..MIDI_TRACKS {
                    self.gate_on[track] = false;
                    self.current_gate[track] = 0.0;
                }
                self.playing = true;
            }

            // Advance tick position (internal timing)
            let tick_increment = 1.0 / self.samples_per_tick;
            self.current_tick += tick_increment;

            // Check for loop or end
            if self.total_ticks > 0 && self.current_tick >= self.total_ticks as f64 {
                if loop_enabled {
                    self.current_tick = 0.0;
                    for track in &mut self.tracks {
                        track.note_index = 0;
                    }
                } else {
                    self.playing = false;
                }
            }

            let current_tick_int = self.current_tick as u32;

            // Process each track
            for track_idx in 0..MIDI_TRACKS {
                let track = &mut self.tracks[track_idx];

                // Check for new notes to trigger
                while track.note_index < track.notes.len() {
                    let note = &track.notes[track.note_index];
                    if note.tick <= current_tick_int {
                        // Trigger this note
                        track.active_note = Some(*note);

                        // Calculate gate length in samples based on note duration and gate %
                        let note_duration_samples =
                            (note.duration as f64 * self.samples_per_tick) as usize;
                        self.gate_length_samples[track_idx] =
                            ((note_duration_samples as f64 * gate_pct as f64) as usize).max(1);

                        self.gate_on[track_idx] = true;
                        self.gate_samples[track_idx] = 0;
                        self.current_cv[track_idx] = Self::note_to_cv(note.note);
                        self.current_velocity[track_idx] = note.velocity as f32 / 127.0;
                        self.current_gate[track_idx] = 1.0;

                        track.note_index += 1;
                    } else {
                        break; // Notes are sorted, no more to trigger yet
                    }
                }

                // Update gate timing
                if self.gate_on[track_idx] {
                    self.gate_samples[track_idx] += 1;
                    if self.gate_samples[track_idx] >= self.gate_length_samples[track_idx] {
                        self.gate_on[track_idx] = false;
                        self.current_gate[track_idx] = 0.0;
                    }
                }

                // Write outputs (apply mute)
                if track_muted[track_idx] {
                    out_cv[track_idx][i] = 0.0;
                    out_gate[track_idx][i] = 0.0;
                    out_vel[track_idx][i] = 0.0;
                } else {
                    out_cv[track_idx][i] = self.current_cv[track_idx];
                    out_gate[track_idx][i] = self.current_gate[track_idx];
                    out_vel[track_idx][i] = self.current_velocity[track_idx];
                }
            }

            // Tick output (normalized 0-1 for progress bar)
            let progress = if self.total_ticks > 0 {
                (self.current_tick / self.total_ticks as f64).clamp(0.0, 1.0) as f32
            } else {
                0.0
            };
            outputs.tick_out[i] = progress;
        }
    }
}
