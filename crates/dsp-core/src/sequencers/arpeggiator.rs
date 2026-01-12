//! Arpeggiator module.
//!
//! MIDI-style arpeggiator with multiple modes and patterns.

use crate::common::{sample_at, Sample};
use super::RATE_DIVISIONS;

/// Arpeggiator playback modes.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ArpMode {
    Up = 0,
    Down = 1,
    UpDown = 2,
    DownUp = 3,
    Converge = 4,
    Diverge = 5,
    Random = 6,
    RandomOnce = 7,
    AsPlayed = 8,
    Chord = 9,
    StrumUp = 10,
    StrumDown = 11,
}

impl ArpMode {
    fn from_index(i: usize) -> Self {
        match i {
            0 => ArpMode::Up,
            1 => ArpMode::Down,
            2 => ArpMode::UpDown,
            3 => ArpMode::DownUp,
            4 => ArpMode::Converge,
            5 => ArpMode::Diverge,
            6 => ArpMode::Random,
            7 => ArpMode::RandomOnce,
            8 => ArpMode::AsPlayed,
            9 => ArpMode::Chord,
            10 => ArpMode::StrumUp,
            11 => ArpMode::StrumDown,
            _ => ArpMode::Up,
        }
    }
}

// Rate divisions now imported from super::RATE_DIVISIONS

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

    fn next_float(&mut self) -> f32 {
        (self.next() as f32) / (u32::MAX as f32)
    }

    fn next_range(&mut self, max: usize) -> usize {
        if max == 0 { return 0; }
        (self.next() as usize) % max
    }
}

/// Generates Euclidean rhythm pattern using Bjorklund's algorithm.
fn euclidean_pattern(steps: usize, fills: usize, rotate: usize) -> Vec<bool> {
    if steps == 0 { return vec![]; }
    let fills = fills.min(steps);
    if fills == 0 { return vec![false; steps]; }
    if fills == steps { return vec![true; steps]; }

    let mut pattern: Vec<Vec<bool>> = Vec::new();
    for i in 0..steps {
        pattern.push(vec![i < fills]);
    }

    let mut divisor = steps - fills;
    let mut count = fills;

    while divisor > 1 {
        let split = count.min(divisor);
        for i in 0..split {
            if let Some(tail) = pattern.pop() {
                pattern[i].extend(tail);
            }
        }
        divisor -= split;
        count = split;
        if divisor <= 1 { break; }
    }

    let mut result: Vec<bool> = pattern.into_iter().flatten().collect();

    // Apply rotation
    if rotate > 0 && !result.is_empty() {
        let rot = rotate % result.len();
        result.rotate_left(rot);
    }

    result
}

/// Arpeggiator.
///
/// MIDI-style arpeggiator that sequences incoming notes through various patterns.
/// Supports multiple modes, octave spanning, euclidean gating, swing, and ratchets.
///
/// # Modes
///
/// - Up: Lowest to highest
/// - Down: Highest to lowest
/// - UpDown: Lowest to highest then back (no repeat at extremes)
/// - DownUp: Highest to lowest then back
/// - Converge: Outside notes toward middle
/// - Diverge: Middle notes toward outside
/// - Random: Random note each step
/// - RandomOnce: Shuffled once, then cycled
/// - AsPlayed: Order notes were received
/// - Chord: All notes at once
/// - StrumUp/StrumDown: Chord with staggered timing
///
/// # Example
///
/// ```ignore
/// use dsp_core::sequencers::{Arpeggiator, ArpeggiatorInputs, ArpeggiatorParams, ArpeggiatorOutputs};
///
/// let mut arp = Arpeggiator::new(44100.0);
/// let mut cv_out = [0.0f32; 128];
/// let mut gate_out = [0.0f32; 128];
/// let mut accent_out = [0.0f32; 128];
///
/// arp.process_block(
///     ArpeggiatorOutputs {
///         cv_out: &mut cv_out,
///         gate_out: &mut gate_out,
///         accent_out: &mut accent_out,
///     },
///     ArpeggiatorInputs { cv_in: None, gate_in: None, clock: None },
///     ArpeggiatorParams {
///         enabled: &[1.0], hold: &[0.0], mode: &[0.0], octaves: &[1.0],
///         rate: &[7.0], gate: &[75.0], swing: &[0.0], tempo: &[120.0],
///         ratchet: &[1.0], ratchet_decay: &[0.0], probability: &[100.0],
///         velocity_mode: &[0.0], accent_pattern: &[0.0],
///         euclid_steps: &[8.0], euclid_fill: &[4.0], euclid_rotate: &[0.0],
///         euclid_enabled: &[0.0], mutate: &[0.0],
///     },
/// );
/// ```
pub struct Arpeggiator {
    sample_rate: f32,

    // Note buffer
    notes: Vec<f32>,           // Notes as pitch CV values
    play_order: Vec<f32>,      // Notes in order played (for AsPlayed mode)
    pattern: Vec<usize>,       // Current pattern indices
    random_pattern: Vec<usize>,// For RandomOnce mode

    // Timing state
    phase: f64,
    samples_per_beat: f64,
    current_step: usize,
    pattern_length: usize,
    #[allow(dead_code)]
    direction: i32,            // 1 or -1 for ping-pong

    // Gate state
    gate_on: bool,
    gate_samples: usize,
    gate_length_samples: usize,

    // Ratchet state
    ratchet_count: usize,
    ratchet_current: usize,
    #[allow(dead_code)]
    ratchet_phase: f64,

    // Strum state (for guitar-like strum)
    #[allow(dead_code)]
    strum_index: usize,
    #[allow(dead_code)]
    strum_delay_samples: usize,
    #[allow(dead_code)]
    strum_counter: usize,

    // Output values
    current_cv: f32,
    current_gate: f32,
    current_accent: f32,

    // Previous gate input (edge detection)
    prev_gate_in: f32,
    prev_clock: f32,
    gate_low_samples: usize,

    // Euclidean pattern cache
    euclid_pattern: Vec<bool>,
    euclid_step: usize,

    // Swing: pending gate info for swung notes
    swing_pending: bool,
    swing_delay_remaining: usize,
    swing_gate_length: usize,
    swing_cv: f32,
    swing_accent: f32,
    swing_ratchet_count: usize,

    // RNG
    rng: Xorshift32,
}

/// Input signals for Arpeggiator.
pub struct ArpeggiatorInputs<'a> {
    /// CV input (V/octave pitch)
    pub cv_in: Option<&'a [Sample]>,
    /// Gate input (note on/off)
    pub gate_in: Option<&'a [Sample]>,
    /// External clock input
    pub clock: Option<&'a [Sample]>,
}

/// Parameters for Arpeggiator.
pub struct ArpeggiatorParams<'a> {
    /// Enable arpeggiator (0 = off, 1 = on)
    pub enabled: &'a [Sample],
    /// Hold mode (0 = off, 1 = on)
    pub hold: &'a [Sample],
    /// Arpeggio mode (0-11)
    pub mode: &'a [Sample],
    /// Number of octaves (1-4)
    pub octaves: &'a [Sample],
    /// Rate division index (0-15)
    pub rate: &'a [Sample],
    /// Gate length percentage (10-100)
    pub gate: &'a [Sample],
    /// Swing amount (0-100%)
    pub swing: &'a [Sample],
    /// Tempo in BPM (40-300)
    pub tempo: &'a [Sample],
    /// Ratchet count (1-8)
    pub ratchet: &'a [Sample],
    /// Ratchet decay (0-1)
    pub ratchet_decay: &'a [Sample],
    /// Probability (0-100%)
    pub probability: &'a [Sample],
    /// Velocity mode
    pub velocity_mode: &'a [Sample],
    /// Accent pattern (0-7)
    pub accent_pattern: &'a [Sample],
    /// Euclidean steps (2-16)
    pub euclid_steps: &'a [Sample],
    /// Euclidean fills (1-16)
    pub euclid_fill: &'a [Sample],
    /// Euclidean rotation (0-steps)
    pub euclid_rotate: &'a [Sample],
    /// Enable euclidean gating (0 = off, 1 = on)
    pub euclid_enabled: &'a [Sample],
    /// Mutation amount (0-100%)
    pub mutate: &'a [Sample],
}

/// Output signals for Arpeggiator.
pub struct ArpeggiatorOutputs<'a> {
    /// CV output (V/octave pitch)
    pub cv_out: &'a mut [Sample],
    /// Gate output
    pub gate_out: &'a mut [Sample],
    /// Accent output
    pub accent_out: &'a mut [Sample],
}

impl Arpeggiator {
    /// Create a new arpeggiator.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            notes: Vec::with_capacity(16),
            play_order: Vec::with_capacity(16),
            pattern: Vec::with_capacity(64),
            random_pattern: Vec::with_capacity(64),
            phase: 0.0,
            samples_per_beat: (sample_rate as f64) / 2.0, // 120 BPM default
            current_step: 0,
            pattern_length: 0,
            direction: 1,
            gate_on: false,
            gate_samples: 0,
            gate_length_samples: 0,
            ratchet_count: 1,
            ratchet_current: 0,
            ratchet_phase: 0.0,
            strum_index: 0,
            strum_delay_samples: 0,
            strum_counter: 0,
            current_cv: 0.0,
            current_gate: 0.0,
            current_accent: 0.0,
            prev_gate_in: 0.0,
            prev_clock: 0.0,
            gate_low_samples: 0,
            euclid_pattern: vec![true; 8],
            euclid_step: 0,
            swing_pending: false,
            swing_delay_remaining: 0,
            swing_gate_length: 0,
            swing_cv: 0.0,
            swing_accent: 0.0,
            swing_ratchet_count: 1,
            rng: Xorshift32::new(12345),
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn build_pattern(&mut self, mode: ArpMode, octaves: usize) {
        self.pattern.clear();

        if self.notes.is_empty() {
            self.pattern_length = 0;
            return;
        }

        // Sort notes for most modes
        let mut sorted_notes: Vec<(usize, f32)> = self.notes.iter()
            .enumerate()
            .map(|(i, &n)| (i, n))
            .collect();
        sorted_notes.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        let note_count = self.notes.len();
        let _total_notes = note_count * octaves;

        match mode {
            ArpMode::Up => {
                for oct in 0..octaves {
                    for &(idx, _) in &sorted_notes {
                        self.pattern.push(idx + oct * note_count);
                    }
                }
            }
            ArpMode::Down => {
                for oct in (0..octaves).rev() {
                    for &(idx, _) in sorted_notes.iter().rev() {
                        self.pattern.push(idx + oct * note_count);
                    }
                }
            }
            ArpMode::UpDown => {
                // Up
                for oct in 0..octaves {
                    for &(idx, _) in &sorted_notes {
                        self.pattern.push(idx + oct * note_count);
                    }
                }
                // Down (skip first and last to avoid repeats)
                for oct in (0..octaves).rev() {
                    let notes_iter: Vec<_> = sorted_notes.iter().rev().collect();
                    for (i, &(idx, _)) in notes_iter.iter().enumerate() {
                        if (oct == octaves - 1 && i == 0) || (oct == 0 && i == notes_iter.len() - 1) {
                            continue;
                        }
                        self.pattern.push(*idx + oct * note_count);
                    }
                }
            }
            ArpMode::DownUp => {
                // Down
                for oct in (0..octaves).rev() {
                    for &(idx, _) in sorted_notes.iter().rev() {
                        self.pattern.push(idx + oct * note_count);
                    }
                }
                // Up (skip first and last)
                for oct in 0..octaves {
                    for (i, &(idx, _)) in sorted_notes.iter().enumerate() {
                        if (oct == 0 && i == 0) || (oct == octaves - 1 && i == sorted_notes.len() - 1) {
                            continue;
                        }
                        self.pattern.push(idx + oct * note_count);
                    }
                }
            }
            ArpMode::Converge => {
                for oct in 0..octaves {
                    let len = sorted_notes.len();
                    for i in 0..(len + 1) / 2 {
                        self.pattern.push(sorted_notes[i].0 + oct * note_count);
                        if len - 1 - i != i {
                            self.pattern.push(sorted_notes[len - 1 - i].0 + oct * note_count);
                        }
                    }
                }
            }
            ArpMode::Diverge => {
                for oct in 0..octaves {
                    let len = sorted_notes.len();
                    let mid = len / 2;
                    for i in 0..(len + 1) / 2 {
                        if mid >= i && mid - i < len {
                            self.pattern.push(sorted_notes[mid - i].0 + oct * note_count);
                        }
                        if mid + i + 1 < len {
                            self.pattern.push(sorted_notes[mid + i + 1].0 + oct * note_count);
                        }
                    }
                }
            }
            ArpMode::Random | ArpMode::RandomOnce => {
                for oct in 0..octaves {
                    for i in 0..note_count {
                        self.pattern.push(i + oct * note_count);
                    }
                }
                // For RandomOnce, shuffle once
                if mode == ArpMode::RandomOnce {
                    self.random_pattern = self.pattern.clone();
                    for i in (1..self.random_pattern.len()).rev() {
                        let j = self.rng.next_range(i + 1);
                        self.random_pattern.swap(i, j);
                    }
                }
            }
            ArpMode::AsPlayed => {
                for oct in 0..octaves {
                    for i in 0..self.play_order.len().min(note_count) {
                        self.pattern.push(i + oct * note_count);
                    }
                }
            }
            ArpMode::Chord => {
                // All notes at once - just one step
                self.pattern.push(0);
            }
            ArpMode::StrumUp | ArpMode::StrumDown => {
                for oct in 0..octaves {
                    if mode == ArpMode::StrumUp {
                        for &(idx, _) in &sorted_notes {
                            self.pattern.push(idx + oct * note_count);
                        }
                    } else {
                        for &(idx, _) in sorted_notes.iter().rev() {
                            self.pattern.push(idx + oct * note_count);
                        }
                    }
                }
            }
        }

        self.pattern_length = self.pattern.len().max(1);
    }

    fn get_note_cv(&self, pattern_idx: usize, _octaves: usize) -> f32 {
        if self.notes.is_empty() || self.pattern.is_empty() {
            return 0.0;
        }

        let idx = self.pattern.get(pattern_idx % self.pattern.len()).copied().unwrap_or(0);
        let note_count = self.notes.len();
        let octave = idx / note_count;
        let note_idx = idx % note_count;

        let base_cv = self.notes.get(note_idx).copied().unwrap_or(0.0);
        base_cv + (octave as f32) // Each octave is +1.0 CV
    }

    fn check_accent(&self, step: usize, pattern: usize) -> bool {
        match pattern {
            1 => step % 2 == 0,           // Every 2nd
            2 => step % 3 == 0,           // Every 3rd
            3 => step % 4 == 0,           // Every 4th
            4 => step % 4 == 0 || step % 4 == 2, // 1 and 3
            5 => matches!(step % 8, 0 | 3 | 6),  // Syncopated
            6 => step % 8 == 0 || step % 8 == 4, // Trance
            7 => step % 4 == 0,           // Custom (fallback to 4)
            _ => false,
        }
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        outputs: ArpeggiatorOutputs<'_>,
        inputs: ArpeggiatorInputs<'_>,
        params: ArpeggiatorParams<'_>,
    ) {
        let len = outputs.cv_out.len();
        if len == 0 { return; }

        let enabled = sample_at(params.enabled, 0, 1.0) >= 0.5;
        let hold = sample_at(params.hold, 0, 0.0) >= 0.5;
        let mode_idx = sample_at(params.mode, 0, 0.0) as usize;
        let mode = ArpMode::from_index(mode_idx);
        let octaves = (sample_at(params.octaves, 0, 1.0) as usize).clamp(1, 4);
        let rate_idx = (sample_at(params.rate, 0, 7.0) as usize).min(15);
        let gate_pct = sample_at(params.gate, 0, 75.0).clamp(10.0, 100.0) / 100.0;
        let swing = sample_at(params.swing, 0, 0.0).clamp(0.0, 100.0) / 100.0;
        let tempo = sample_at(params.tempo, 0, 120.0).clamp(40.0, 300.0);
        let ratchet = (sample_at(params.ratchet, 0, 1.0) as usize).clamp(1, 8);
        let probability = sample_at(params.probability, 0, 100.0).clamp(0.0, 100.0) / 100.0;
        let accent_pattern = sample_at(params.accent_pattern, 0, 0.0) as usize;
        let euclid_enabled = sample_at(params.euclid_enabled, 0, 0.0) >= 0.5;
        let euclid_steps = (sample_at(params.euclid_steps, 0, 8.0) as usize).clamp(2, 16);
        let euclid_fill = (sample_at(params.euclid_fill, 0, 4.0) as usize).clamp(1, 16);
        let euclid_rotate = sample_at(params.euclid_rotate, 0, 0.0) as usize;
        let mutate = sample_at(params.mutate, 0, 0.0).clamp(0.0, 100.0) / 100.0;
        let gate_release_threshold = (self.sample_rate * 0.001).max(1.0) as usize;

        // Calculate timing
        let beats_per_second = tempo as f64 / 60.0;
        let rate_mult = RATE_DIVISIONS[rate_idx];
        let step_duration_seconds = rate_mult / beats_per_second;
        let step_duration_samples = step_duration_seconds * self.sample_rate as f64;
        self.samples_per_beat = step_duration_samples;

        // Update euclidean pattern if needed
        if euclid_enabled {
            self.euclid_pattern = euclidean_pattern(euclid_steps, euclid_fill, euclid_rotate);
        }

        for i in 0..len {
            let cv_in = inputs.cv_in.map_or(0.0, |b| sample_at(b, i, 0.0));
            let gate_in = inputs.gate_in.map_or(0.0, |b| sample_at(b, i, 0.0));
            let clock_in = inputs.clock.map_or(-1.0, |b| sample_at(b, i, 0.0));

            // Detect note on/off with a small debounce to ignore retrigger dips.
            let gate_high = gate_in > 0.5;
            if gate_high {
                self.gate_low_samples = 0;
            } else {
                self.gate_low_samples = self.gate_low_samples.saturating_add(1);
            }
            let gate_rising = gate_high && self.prev_gate_in <= 0.5;
            let gate_released = !gate_high && self.gate_low_samples == gate_release_threshold;

            if gate_rising {
                // Add note
                let is_new_note = !self.notes.contains(&cv_in);
                if is_new_note {
                    self.notes.push(cv_in);
                    self.play_order.push(cv_in);
                    if self.notes.len() > 16 {
                        self.notes.remove(0);
                    }
                    if self.play_order.len() > 16 {
                        self.play_order.remove(0);
                    }
                }
                self.build_pattern(mode, octaves);

                // Reset phase on first note to start immediately
                if self.notes.len() == 1 {
                    self.phase = 0.999; // Will trigger on next sample
                    self.current_step = 0;
                }
            }

            if gate_released && !hold {
                self.clear_notes();
            }

            self.prev_gate_in = gate_in;

            // If not enabled or no notes, output silence
            if !enabled || self.notes.is_empty() {
                outputs.cv_out[i] = self.current_cv;
                outputs.gate_out[i] = 0.0;
                outputs.accent_out[i] = 0.0;
                continue;
            }

            // Check for clock input or use internal timing
            let clock_trigger = clock_in > 0.5 && self.prev_clock <= 0.5;
            self.prev_clock = clock_in;

            // Advance phase
            let use_external_clock = clock_in >= 0.0;
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

            // Handle pending swing gate FIRST (before new step can overwrite)
            if self.swing_pending && self.swing_delay_remaining > 0 {
                self.swing_delay_remaining -= 1;
                if self.swing_delay_remaining == 0 {
                    // Swing delay finished - force start the swung gate
                    self.swing_pending = false;
                    self.current_cv = self.swing_cv;
                    self.current_accent = self.swing_accent;
                    self.gate_on = true;
                    self.gate_length_samples = self.swing_gate_length;
                    self.gate_samples = 0;
                    self.ratchet_count = self.swing_ratchet_count;
                    self.ratchet_current = 0;
                }
            }

            if step_advance {
                // Cancel any pending swing that didn't fire (shouldn't happen normally)
                self.swing_pending = false;

                // Calculate swing for odd steps (limited to 45% to prevent overlap)
                let is_odd_step = self.current_step % 2 == 1;
                let swing_clamped = swing.min(0.9); // Max 90% swing = 45% delay
                let swing_delay_samples = if is_odd_step && swing_clamped > 0.0 && !use_external_clock {
                    (swing_clamped as f64 * 0.5 * step_duration_samples) as usize
                } else {
                    0
                };

                // Euclidean gate check
                let euclid_gate = if euclid_enabled {
                    let step = self.euclid_step % self.euclid_pattern.len().max(1);
                    self.euclid_step = (self.euclid_step + 1) % self.euclid_pattern.len().max(1);
                    self.euclid_pattern.get(step).copied().unwrap_or(true)
                } else {
                    true
                };

                // Probability check
                let prob_pass = self.rng.next_float() <= probability;

                // Check if we should play this step
                if euclid_gate && prob_pass {
                    // Get the note for this step
                    let pattern_idx = if mode == ArpMode::Random {
                        self.rng.next_range(self.pattern_length.max(1))
                    } else if mode == ArpMode::RandomOnce {
                        self.current_step % self.random_pattern.len().max(1)
                    } else {
                        self.current_step % self.pattern_length.max(1)
                    };

                    // Apply mutation
                    let mutated_idx = if mutate > 0.0 && self.rng.next_float() < mutate {
                        self.rng.next_range(self.pattern_length.max(1))
                    } else {
                        pattern_idx
                    };

                    let note_cv = self.get_note_cv(mutated_idx, octaves);
                    let note_accent = if self.check_accent(self.current_step, accent_pattern) { 1.0 } else { 0.0 };
                    let gate_samples = (step_duration_samples * gate_pct as f64) as usize;

                    if swing_delay_samples == 0 {
                        // No swing - start gate immediately
                        self.current_cv = note_cv;
                        self.current_accent = note_accent;
                        self.gate_on = true;
                        self.gate_length_samples = gate_samples / ratchet;
                        self.gate_samples = 0;
                        self.ratchet_count = ratchet;
                        self.ratchet_current = 0;
                    } else {
                        // Swing delay - store note info for later
                        self.swing_pending = true;
                        self.swing_delay_remaining = swing_delay_samples;
                        self.swing_cv = note_cv;
                        self.swing_accent = note_accent;
                        self.swing_gate_length = gate_samples / ratchet;
                        self.swing_ratchet_count = ratchet;
                    }
                }

                // Advance step
                self.current_step = (self.current_step + 1) % self.pattern_length.max(1);
            }

            // Handle gate timing with ratchets
            if self.gate_on {
                self.gate_samples += 1;

                // Check for ratchet retrigs
                if self.ratchet_count > 1 {
                    let ratchet_period = self.gate_length_samples * 2;
                    if self.gate_samples >= ratchet_period && self.ratchet_current < self.ratchet_count - 1 {
                        self.ratchet_current += 1;
                        self.gate_samples = 0;
                    }
                }

                // Gate on/off within step
                if self.gate_samples < self.gate_length_samples {
                    self.current_gate = 1.0;
                } else {
                    self.current_gate = 0.0;
                    if self.ratchet_current >= self.ratchet_count - 1 {
                        self.gate_on = false;
                    }
                }
            } else {
                self.current_gate = 0.0;
            }

            // Special handling for Chord mode - all notes play together
            if mode == ArpMode::Chord && !self.notes.is_empty() {
                self.current_cv = self.notes[0]; // Just output first note CV-wise
                self.current_gate = if self.gate_on { 1.0 } else { 0.0 };
            }

            outputs.cv_out[i] = self.current_cv;
            outputs.gate_out[i] = self.current_gate;
            outputs.accent_out[i] = self.current_accent;
        }
    }

    /// Clear all held notes.
    pub fn clear_notes(&mut self) {
        self.notes.clear();
        self.play_order.clear();
        self.pattern.clear();
        self.pattern_length = 0;
        self.current_step = 0;
        self.phase = 0.0;
        self.gate_on = false;
        self.current_gate = 0.0;
        self.swing_pending = false;
        self.swing_delay_remaining = 0;
    }
}
