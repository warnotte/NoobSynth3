//! Speech Synth — robotic voice synthesis via formant sequencing.
//!
//! Converts text into a sequence of phonemes, each defined by 3 formant
//! frequencies and a voiced/noise ratio. Excitation is a buzz (sawtooth)
//! for voiced sounds and white noise for unvoiced sounds.
//!
//! Design philosophy: vowels are the star, consonants are brief transitional
//! colourings. This gives the clean Daft Punk / Kraftwerk robotic vocal sound.

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
    amp: f32,       // relative amplitude
    dur_mult: f32,  // duration multiplier relative to base speed
}

const SILENCE: PhonemeData = PhonemeData {
    f1: 400.0, f2: 1200.0, f3: 2500.0,
    voiced: 0.0, amp: 0.0, dur_mult: 0.4,
};

/// Map character to phoneme. Philosophy: keep consonants very short and quiet,
/// with high voiced ratio so the buzz carries through (robotic voice = buzz
/// through formants, not noise through formants).
fn char_to_phoneme(c: char) -> PhonemeData {
    match c {
        // ---- Vowels (loud, long, fully voiced) ----
        'A' => PhonemeData { f1: 800.0, f2: 1150.0, f3: 2900.0, voiced: 1.0, amp: 1.0, dur_mult: 1.0 },
        'E' => PhonemeData { f1: 400.0, f2: 1700.0, f3: 2600.0, voiced: 1.0, amp: 1.0, dur_mult: 1.0 },
        'I' => PhonemeData { f1: 350.0, f2: 1700.0, f3: 2700.0, voiced: 1.0, amp: 1.0, dur_mult: 1.0 },
        'O' => PhonemeData { f1: 450.0, f2: 800.0,  f3: 2830.0, voiced: 1.0, amp: 1.0, dur_mult: 1.0 },
        'U' => PhonemeData { f1: 325.0, f2: 700.0,  f3: 2530.0, voiced: 1.0, amp: 1.0, dur_mult: 1.0 },

        // ---- Semi-vowels / Glides (voiced, medium) ----
        'W' => PhonemeData { f1: 300.0, f2: 750.0,  f3: 2500.0, voiced: 1.0, amp: 0.8, dur_mult: 0.4 },
        'Y' => PhonemeData { f1: 280.0, f2: 2200.0, f3: 3000.0, voiced: 1.0, amp: 0.8, dur_mult: 0.4 },

        // ---- Nasals (voiced, warm, medium-long) ----
        'M' => PhonemeData { f1: 280.0, f2: 900.0,  f3: 2300.0, voiced: 1.0, amp: 0.75, dur_mult: 0.6 },
        'N' => PhonemeData { f1: 300.0, f2: 1500.0, f3: 2500.0, voiced: 1.0, amp: 0.75, dur_mult: 0.6 },

        // ---- Liquids (voiced, medium) ----
        'L' => PhonemeData { f1: 350.0, f2: 1100.0, f3: 2900.0, voiced: 1.0, amp: 0.8, dur_mult: 0.5 },
        'R' => PhonemeData { f1: 400.0, f2: 1300.0, f3: 2700.0, voiced: 1.0, amp: 0.75, dur_mult: 0.5 },

        // ---- Voiced plosives (brief buzz burst, minimal noise) ----
        'B' => PhonemeData { f1: 200.0, f2: 1000.0, f3: 2500.0, voiced: 0.85, amp: 0.5, dur_mult: 0.15 },
        'D' => PhonemeData { f1: 300.0, f2: 1600.0, f3: 2600.0, voiced: 0.80, amp: 0.5, dur_mult: 0.15 },
        'G' => PhonemeData { f1: 250.0, f2: 1200.0, f3: 2500.0, voiced: 0.80, amp: 0.5, dur_mult: 0.15 },

        // ---- Unvoiced plosives (very brief, quiet burst) ----
        'K' | 'C' | 'Q' => PhonemeData { f1: 300.0, f2: 1500.0, f3: 2700.0, voiced: 0.4, amp: 0.3, dur_mult: 0.12 },
        'P' => PhonemeData { f1: 200.0, f2: 900.0,  f3: 2400.0, voiced: 0.4, amp: 0.3, dur_mult: 0.12 },
        'T' => PhonemeData { f1: 350.0, f2: 1700.0, f3: 2800.0, voiced: 0.4, amp: 0.3, dur_mult: 0.12 },

        // ---- Fricatives (very quiet, brief — just enough colouring) ----
        'F' => PhonemeData { f1: 350.0, f2: 1400.0, f3: 2700.0, voiced: 0.3, amp: 0.2, dur_mult: 0.2 },
        'S' => PhonemeData { f1: 400.0, f2: 1700.0, f3: 3200.0, voiced: 0.2, amp: 0.15, dur_mult: 0.2 },
        'V' => PhonemeData { f1: 350.0, f2: 1400.0, f3: 2700.0, voiced: 0.7, amp: 0.4, dur_mult: 0.25 },
        'Z' => PhonemeData { f1: 400.0, f2: 1700.0, f3: 3200.0, voiced: 0.6, amp: 0.35, dur_mult: 0.25 },
        'J' => PhonemeData { f1: 300.0, f2: 1800.0, f3: 2800.0, voiced: 0.6, amp: 0.35, dur_mult: 0.2 },
        'X' => PhonemeData { f1: 350.0, f2: 1700.0, f3: 3200.0, voiced: 0.2, amp: 0.15, dur_mult: 0.25 },

        // ---- Aspirate (very soft breath, mostly buzz at low amp) ----
        'H' => PhonemeData { f1: 500.0, f2: 1500.0, f3: 2500.0, voiced: 0.3, amp: 0.15, dur_mult: 0.15 },

        // ---- Space = brief silence ----
        ' ' => SILENCE,
        _ => SILENCE,
    }
}

// Gentler Q values for clean, warm formant peaks
const FORMANT_Q: [f32; 3] = [4.5, 3.5, 3.0];
// F1 dominant (body), F2 for colour, F3 very subtle (presence)
const FORMANT_WEIGHTS: [f32; 3] = [0.60, 0.30, 0.15];

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
    cur_amp: f32,
    // Target formant state
    tgt_f: [f32; 3],
    tgt_voiced: f32,
    tgt_amp: f32,

    // Internal timer
    samples_elapsed: f32,

    // Track whether clock is actively driving
    clock_detected: bool,

    // Buzz oscillator
    buzz_phase: f32,

    // Noise state
    noise_state: u32,
    noise_lp: f32, // 1-pole lowpass on noise to tame harshness

    // Gate envelope smoother (avoids clicks)
    gate_env: f32,

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
            cur_amp: first.amp,
            tgt_f: [first.f1, first.f2, first.f3],
            tgt_voiced: first.voiced,
            tgt_amp: first.amp,
            samples_elapsed: 0.0,
            clock_detected: false,
            buzz_phase: 0.0,
            noise_state: 0x7FFF_FFFF,
            noise_lp: 0.0,
            gate_env: 0.0,
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
        self.phoneme_index = 0;
        self.load_current_phoneme();
        self.samples_elapsed = 0.0;
        self.clock_detected = false;
    }

    fn load_current_phoneme(&mut self) {
        let p = self.phonemes[self.phoneme_index % self.phonemes.len()];
        self.tgt_f = [p.f1, p.f2, p.f3];
        self.tgt_voiced = p.voiced;
        self.tgt_amp = p.amp;
    }

    fn advance_phoneme(&mut self) {
        if self.phonemes.is_empty() { return; }
        self.phoneme_index = (self.phoneme_index + 1) % self.phonemes.len();
        self.load_current_phoneme();
    }

    fn reset_to_start(&mut self) {
        self.phoneme_index = 0;
        self.load_current_phoneme();
        self.samples_elapsed = 0.0;
        self.cur_f = self.tgt_f;
        self.cur_voiced = self.tgt_voiced;
        self.cur_amp = self.tgt_amp;
    }

    /// White noise via LFSR, then 1-pole lowpass to remove harsh highs.
    fn next_noise(&mut self) -> f32 {
        let bit = self.noise_state & 1;
        self.noise_state >>= 1;
        if bit == 1 {
            self.noise_state ^= 0xB400_0000;
        }
        let raw = (self.noise_state as f32 / 0x7FFF_FFFF as f32) * 2.0 - 1.0;
        // 1-pole lowpass at ~4kHz to soften the noise
        let cutoff = 4000.0;
        let rc = 1.0 / (std::f32::consts::TAU * cutoff);
        let dt = 1.0 / self.sample_rate;
        let alpha = dt / (rc + dt);
        self.noise_lp = self.noise_lp + alpha * (raw - self.noise_lp);
        self.noise_lp
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

        let clock_connected = inputs.clock.is_some();

        for i in 0..output.len() {
            let speed = sample_at(params.speed, i, 8.0).clamp(1.0, 20.0);
            let formant_shift = sample_at(params.formant_shift, i, 0.0).clamp(-12.0, 12.0);
            let smoothing = sample_at(params.smoothing, i, 0.3).clamp(0.0, 1.0);
            let buzz_bright = sample_at(params.buzz, i, 0.7).clamp(0.0, 1.0);
            let noise_mix = sample_at(params.noise_mix, i, 0.15).clamp(0.0, 1.0);

            let pitch_cv = input_at(inputs.pitch, i);
            let gate = input_at(inputs.gate, i);
            let clock = input_at(inputs.clock, i);

            // Gate rising edge = reset to start
            if gate > 0.5 && self.prev_gate <= 0.5 {
                self.reset_to_start();
            }
            self.prev_gate = gate;

            // Clock rising edge = advance phoneme
            let clock_edge = clock > 0.5 && self.prev_clock <= 0.5;
            self.prev_clock = clock;

            if clock_edge {
                self.clock_detected = true;
                self.advance_phoneme();
                self.samples_elapsed = 0.0;
            }

            // Timer-based advance only when no clock is driving
            if !clock_connected || !self.clock_detected {
                let cur_phoneme = &self.phonemes[self.phoneme_index % self.phonemes.len()];
                let samples_per_phoneme = self.sample_rate * cur_phoneme.dur_mult / speed;

                self.samples_elapsed += 1.0;
                if self.samples_elapsed >= samples_per_phoneme {
                    self.advance_phoneme();
                    self.samples_elapsed = 0.0;
                }
            }

            // Interpolate formants toward target
            // smoothing=0 → instant, smoothing=1 → ~200ms glide
            let coeff = if smoothing > 0.0 {
                let tau = smoothing * 0.2;
                (-1.0 / (tau * self.sample_rate)).exp()
            } else {
                0.0
            };

            for b in 0..3 {
                self.cur_f[b] = self.cur_f[b] * coeff + self.tgt_f[b] * (1.0 - coeff);
            }
            self.cur_voiced = self.cur_voiced * coeff + self.tgt_voiced * (1.0 - coeff);
            self.cur_amp = self.cur_amp * coeff + self.tgt_amp * (1.0 - coeff);

            // Formant shift (semitones)
            let shift_ratio = (formant_shift / 12.0).exp2();

            // Buzz: freq from pitch CV (CV 0 = C4 = 261.63 Hz)
            let freq = 261.63_f32 * pitch_cv.exp2();
            let phase_inc = freq / self.sample_rate;
            self.buzz_phase += phase_inc;
            if self.buzz_phase >= 1.0 {
                self.buzz_phase -= 1.0;
            }

            // Buzz waveform: blend sine → sawtooth via brightness
            let raw_saw = 2.0 * self.buzz_phase - 1.0;
            let fundamental = (self.buzz_phase * std::f32::consts::TAU).sin();
            let buzz = fundamental * (1.0 - buzz_bright) + raw_saw * buzz_bright;

            // Soft filtered noise
            let noise = self.next_noise();

            // Excitation: blend buzz/noise based on voiced ratio
            // For robotic voice, even "unvoiced" sounds carry some buzz
            let voiced_amount = self.cur_voiced;
            let excitation = buzz * voiced_amount + noise * (1.0 - voiced_amount) * 0.5;

            // Subtle breath/noise mix on top
            let excitation = excitation + noise * noise_mix * 0.15;

            // 3-band formant filtering
            let mut sample = 0.0_f32;
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

            // Phoneme amplitude envelope
            sample *= self.cur_amp;

            // Smooth gate (5ms rise/fall to avoid clicks)
            let gate_target = if gate > 0.5 { 1.0 } else { 0.0 };
            let gate_coeff = (-1.0 / (0.005 * self.sample_rate)).exp();
            self.gate_env = self.gate_env * gate_coeff + gate_target * (1.0 - gate_coeff);

            output[i] = sample * self.gate_env;
        }
    }
}
