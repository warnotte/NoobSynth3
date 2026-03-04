//! Speech Synth — robotic voice synthesis via formant sequencing.
//!
//! Converts text into a sequence of phonemes, each defined by 3 formant
//! frequencies and a voiced/noise ratio. Excitation is a buzz (sawtooth)
//! for voiced sounds and white noise for unvoiced sounds.
//!
//! Designed for Daft Punk / Kraftwerk style robotic singing.

use crate::common::{input_at, sample_at, Sample};
use crate::effects::choir::FormantFilter;

// ---------------------------------------------------------------------------
// Phoneme table
// ---------------------------------------------------------------------------

/// A single phoneme descriptor.
#[derive(Clone, Copy)]
struct PhonemeData {
    f1: f32,
    f2: f32,
    f3: f32,
    voiced: f32,    // 0 = noise only, 1 = fully voiced
    dur_mult: f32,  // duration multiplier relative to base speed
}

const SILENCE: PhonemeData = PhonemeData { f1: 0.0, f2: 0.0, f3: 0.0, voiced: 0.0, dur_mult: 0.5 };

fn char_to_phoneme(c: char) -> PhonemeData {
    match c {
        // Vowels
        'A' => PhonemeData { f1: 800.0, f2: 1150.0, f3: 2900.0, voiced: 1.0, dur_mult: 1.0 },
        'E' => PhonemeData { f1: 400.0, f2: 1700.0, f3: 2600.0, voiced: 1.0, dur_mult: 1.0 },
        'I' => PhonemeData { f1: 350.0, f2: 1700.0, f3: 2700.0, voiced: 1.0, dur_mult: 1.0 },
        'O' => PhonemeData { f1: 450.0, f2: 800.0,  f3: 2830.0, voiced: 1.0, dur_mult: 1.0 },
        'U' => PhonemeData { f1: 325.0, f2: 700.0,  f3: 2530.0, voiced: 1.0, dur_mult: 1.0 },
        // Plosives
        'B' => PhonemeData { f1: 200.0, f2: 1000.0, f3: 2500.0, voiced: 0.6, dur_mult: 0.3 },
        'D' => PhonemeData { f1: 300.0, f2: 1600.0, f3: 2600.0, voiced: 0.5, dur_mult: 0.3 },
        'G' => PhonemeData { f1: 250.0, f2: 1200.0, f3: 2500.0, voiced: 0.5, dur_mult: 0.3 },
        'K' => PhonemeData { f1: 300.0, f2: 1500.0, f3: 2700.0, voiced: 0.1, dur_mult: 0.3 },
        'P' => PhonemeData { f1: 200.0, f2: 900.0,  f3: 2400.0, voiced: 0.1, dur_mult: 0.3 },
        'T' => PhonemeData { f1: 350.0, f2: 1700.0, f3: 2800.0, voiced: 0.1, dur_mult: 0.3 },
        // Fricatives
        'F' => PhonemeData { f1: 300.0, f2: 1400.0, f3: 2800.0, voiced: 0.0, dur_mult: 0.6 },
        'S' => PhonemeData { f1: 400.0, f2: 1800.0, f3: 4500.0, voiced: 0.0, dur_mult: 0.6 },
        'V' => PhonemeData { f1: 300.0, f2: 1400.0, f3: 2800.0, voiced: 0.4, dur_mult: 0.6 },
        'Z' => PhonemeData { f1: 400.0, f2: 1800.0, f3: 4500.0, voiced: 0.4, dur_mult: 0.6 },
        // Nasals
        'M' => PhonemeData { f1: 280.0, f2: 900.0,  f3: 2300.0, voiced: 1.0, dur_mult: 0.8 },
        'N' => PhonemeData { f1: 300.0, f2: 1500.0, f3: 2500.0, voiced: 1.0, dur_mult: 0.8 },
        // Liquids
        'L' => PhonemeData { f1: 350.0, f2: 1100.0, f3: 2900.0, voiced: 0.9, dur_mult: 0.7 },
        'R' => PhonemeData { f1: 400.0, f2: 1300.0, f3: 2700.0, voiced: 0.8, dur_mult: 0.7 },
        // Aspirate
        'H' => PhonemeData { f1: 500.0, f2: 1500.0, f3: 2500.0, voiced: 0.0, dur_mult: 0.4 },
        // Space / unknown = silence
        _ => SILENCE,
    }
}

// Tighter Q than Choir for more robotic sound
const FORMANT_Q: [f32; 3] = [8.0, 6.0, 5.0];
const FORMANT_WEIGHTS: [f32; 3] = [0.50, 0.40, 0.30];

// ---------------------------------------------------------------------------
// SpeechSynth
// ---------------------------------------------------------------------------

/// Speech synthesiser — phoneme-sequencing formant source.
pub struct SpeechSynth {
    sample_rate: f32,
    filters: [FormantFilter; 3],

    // Phoneme sequence
    phonemes: Vec<PhonemeData>,
    phoneme_index: usize,

    // Interpolated formant state (current)
    cur_f: [f32; 3],
    cur_voiced: f32,
    // Target formant state
    tgt_f: [f32; 3],
    tgt_voiced: f32,

    // Internal timer (samples remaining in current phoneme)
    timer_samples: f32,
    samples_elapsed: f32,

    // Buzz oscillator
    buzz_phase: f32,

    // Noise LFSR
    noise_state: u32,

    // Edge detection
    prev_gate: f32,
    prev_clock: f32,
}

/// Parameters for SpeechSynth.
pub struct SpeechSynthParams<'a> {
    /// Phonemes per second (1-20)
    pub speed: &'a [Sample],
    /// Formant shift in semitones (-12 to +12)
    pub formant_shift: &'a [Sample],
    /// Smoothing between phonemes (0-1)
    pub smoothing: &'a [Sample],
    /// Buzz brightness / harmonic content (0-1)
    pub buzz: &'a [Sample],
    /// Additional noise mix (0-1)
    pub noise_mix: &'a [Sample],
}

/// Input signals for SpeechSynth.
pub struct SpeechSynthInputs<'a> {
    /// Pitch CV (CV 0 = C4 = 261.63 Hz)
    pub pitch: Option<&'a [Sample]>,
    /// Gate input — rising edge resets to beginning of text
    pub gate: Option<&'a [Sample]>,
    /// Clock input — rising edge advances to next phoneme
    pub clock: Option<&'a [Sample]>,
}

impl SpeechSynth {
    pub fn new(sample_rate: f32) -> Self {
        let default_text = "HELLO WORLD";
        let phonemes: Vec<PhonemeData> = default_text.chars().map(char_to_phoneme).collect();
        let first = phonemes.first().copied().unwrap_or(SILENCE);

        Self {
            sample_rate: sample_rate.max(1.0),
            filters: [FormantFilter::default(); 3],
            phonemes,
            phoneme_index: 0,
            cur_f: [first.f1, first.f2, first.f3],
            cur_voiced: first.voiced,
            tgt_f: [first.f1, first.f2, first.f3],
            tgt_voiced: first.voiced,
            timer_samples: 0.0,
            samples_elapsed: 0.0,
            buzz_phase: 0.0,
            noise_state: 0x7FFF_FFFF,
            prev_gate: 0.0,
            prev_clock: 0.0,
        }
    }

    pub fn set_sample_rate(&mut self, sr: f32) {
        self.sample_rate = sr.max(1.0);
    }

    /// Parse text into phoneme sequence.
    pub fn set_text(&mut self, text: &str) {
        let upper = text.to_uppercase();
        self.phonemes = upper.chars().map(char_to_phoneme).collect();
        if self.phonemes.is_empty() {
            self.phonemes.push(SILENCE);
        }
        // Reset to start
        self.phoneme_index = 0;
        self.load_current_phoneme();
        self.timer_samples = 0.0;
        self.samples_elapsed = 0.0;
    }

    fn load_current_phoneme(&mut self) {
        let p = self.phonemes[self.phoneme_index % self.phonemes.len()];
        self.tgt_f = [p.f1, p.f2, p.f3];
        self.tgt_voiced = p.voiced;
    }

    fn advance_phoneme(&mut self) {
        if self.phonemes.is_empty() { return; }
        self.phoneme_index = (self.phoneme_index + 1) % self.phonemes.len();
        self.load_current_phoneme();
    }

    fn reset_to_start(&mut self) {
        self.phoneme_index = 0;
        self.load_current_phoneme();
        self.timer_samples = 0.0;
        self.samples_elapsed = 0.0;
        // Snap current to target immediately
        self.cur_f = self.tgt_f;
        self.cur_voiced = self.tgt_voiced;
    }

    /// Simple white noise via LFSR.
    fn next_noise(&mut self) -> f32 {
        // Galois LFSR
        let bit = self.noise_state & 1;
        self.noise_state >>= 1;
        if bit == 1 {
            self.noise_state ^= 0xB400_0000;
        }
        // Map to -1..+1
        (self.noise_state as f32 / 0x7FFF_FFFF as f32) * 2.0 - 1.0
    }

    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: SpeechSynthInputs<'_>,
        params: SpeechSynthParams<'_>,
    ) {
        if output.is_empty() || self.phonemes.is_empty() {
            return;
        }

        let has_clock = inputs.clock.is_some() && inputs.clock.map_or(true, |c| {
            // Check if clock is actually connected (not all zeros from default buffer)
            // We'll detect by edge in the loop
            let _ = c;
            true
        });

        for i in 0..output.len() {
            let speed = sample_at(params.speed, i, 8.0).clamp(1.0, 20.0);
            let formant_shift = sample_at(params.formant_shift, i, 0.0).clamp(-12.0, 12.0);
            let smoothing = sample_at(params.smoothing, i, 0.3).clamp(0.0, 1.0);
            let buzz_bright = sample_at(params.buzz, i, 0.7).clamp(0.0, 1.0);
            let noise_mix = sample_at(params.noise_mix, i, 0.15).clamp(0.0, 1.0);

            let pitch_cv = input_at(inputs.pitch, i);
            let gate = input_at(inputs.gate, i);
            let clock = input_at(inputs.clock, i);

            // Edge detection — gate rising edge = reset
            if gate > 0.5 && self.prev_gate <= 0.5 {
                self.reset_to_start();
            }
            self.prev_gate = gate;

            // Clock rising edge = advance phoneme
            let clock_edge = clock > 0.5 && self.prev_clock <= 0.5;
            self.prev_clock = clock;

            if clock_edge {
                self.advance_phoneme();
                self.timer_samples = 0.0;
                self.samples_elapsed = 0.0;
            }

            // Internal timer (only when no clock connected or no edges detected)
            if !has_clock || inputs.clock.map_or(true, |_| false) {
                // Actually, we always run the internal timer; clock overrides advance
                // but we should still advance on timer if no clock edges are happening.
            }

            // Timer-based advance (when not driven by clock)
            let cur_phoneme = &self.phonemes[self.phoneme_index % self.phonemes.len()];
            let dur = cur_phoneme.dur_mult;
            let samples_per_phoneme = self.sample_rate * dur / speed;

            self.samples_elapsed += 1.0;
            if !clock_edge && self.samples_elapsed >= samples_per_phoneme {
                self.advance_phoneme();
                self.samples_elapsed = 0.0;
            }

            // Interpolate formants (smoothing)
            // Convert smoothing 0-1 to a coefficient: higher smoothing = slower change
            let coeff = if smoothing > 0.0 {
                let tau = smoothing * 0.05; // ~50ms at max smoothing
                (-1.0 / (tau * self.sample_rate)).exp()
            } else {
                0.0 // Instant snap
            };

            for b in 0..3 {
                self.cur_f[b] = self.cur_f[b] * coeff + self.tgt_f[b] * (1.0 - coeff);
            }
            self.cur_voiced = self.cur_voiced * coeff + self.tgt_voiced * (1.0 - coeff);

            // Formant shift (semitones)
            let shift_ratio = (formant_shift / 12.0).exp2();

            // Buzz frequency from pitch CV: freq = 261.63 * 2^cv
            let freq = 261.63_f32 * (pitch_cv).exp2();

            // Generate buzz (sawtooth with variable harmonics)
            let phase_inc = freq / self.sample_rate;
            self.buzz_phase += phase_inc;
            if self.buzz_phase >= 1.0 {
                self.buzz_phase -= 1.0;
            }
            // Sawtooth: 2*phase - 1
            let raw_saw = 2.0 * self.buzz_phase - 1.0;
            // Brightness: blend between fundamental sine and sawtooth
            let fundamental = (self.buzz_phase * std::f32::consts::TAU).sin();
            let buzz = fundamental * (1.0 - buzz_bright) + raw_saw * buzz_bright;

            // Noise
            let noise = self.next_noise();

            // Excitation: blend voiced (buzz) and unvoiced (noise)
            let voiced_amount = self.cur_voiced;
            let excitation = buzz * voiced_amount + noise * (1.0 - voiced_amount);

            // Add extra noise mix
            let excitation = excitation * (1.0 - noise_mix) + noise * noise_mix;

            // Apply 3 formant bandpass filters
            let mut sample = 0.0_f32;
            let is_silence = self.cur_f[0] == 0.0 && self.cur_f[1] == 0.0 && self.cur_f[2] == 0.0;

            if !is_silence {
                for b in 0..3 {
                    let freq_shifted = (self.cur_f[b] * shift_ratio).min(self.sample_rate * 0.45);
                    if freq_shifted > 20.0 {
                        sample += self.filters[b].process(
                            excitation,
                            freq_shifted,
                            FORMANT_Q[b],
                            self.sample_rate,
                        ) * FORMANT_WEIGHTS[b];
                    }
                }
            }

            // Gate envelope: only produce sound when gate is high
            let env = if gate > 0.5 { 1.0 } else { 0.0 };
            output[i] = sample * env;
        }
    }
}
