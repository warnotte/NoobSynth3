//! Shepard/Risset Tone generator - creates auditory illusions of endlessly rising/falling pitch.
//!
//! The Shepard tone works by layering multiple waves separated by octaves.
//! As each voice rises in pitch, its amplitude follows a Gaussian curve - loud in
//! the middle register, fading at the extremes. When a voice reaches the top,
//! it wraps to the bottom at near-zero amplitude, creating the illusion of
//! continuous ascent (or descent).
//!
//! Risset mode quantizes positions to semitones for a discrete stepped glissando effect.

use crate::common::{sample_at, input_at, Sample};
use std::f32::consts::PI;

/// Maximum number of voices for Shepard tone
const MAX_VOICES: usize = 12;

/// Waveform types
const _WAVE_SINE: u8 = 0;
const WAVE_TRIANGLE: u8 = 1;
const WAVE_SAW: u8 = 2;
const WAVE_SQUARE: u8 = 3;

/// Direction modes
const _DIR_UP: u8 = 0;
const DIR_DOWN: u8 = 1;
const DIR_ALTERNATE: u8 = 2;
const DIR_RANDOM: u8 = 3;

/// Harmonic interval modes
const _INTERVAL_OCTAVE: u8 = 0;
const INTERVAL_FIFTH: u8 = 1;
const INTERVAL_FOURTH: u8 = 2;
const INTERVAL_THIRD: u8 = 3;

/// Feedback buffer size (enough for short delay)
const FEEDBACK_BUFFER_SIZE: usize = 4096;

/// Base vibrato LFO rate in Hz
const VIBRATO_BASE_RATE: f32 = 5.0;

/// Shepard tone generator with configurable voices, waveforms, and stereo spread.
pub struct Shepard {
    sample_rate: f32,
    /// Current position of each voice (0.0 to 1.0, representing octave position)
    positions: [f32; MAX_VOICES],
    /// Phase accumulator for each voice's oscillator
    phases: [f32; MAX_VOICES],
    /// Per-voice phase offset for phase spread feature
    phase_offsets: [f32; MAX_VOICES],
    /// Per-voice detune offset (fixed at init, based on voice index)
    detune_offsets: [f32; MAX_VOICES],
    /// Per-voice direction multiplier for alternate/random modes
    direction_mult: [f32; MAX_VOICES],
    /// Last known voice count (to detect changes and redistribute)
    last_voice_count: usize,
    /// Last known direction mode (to detect changes)
    last_direction: u8,
    /// Simple LCG random state for random direction mode
    random_state: u32,
    /// Feedback buffer (stereo interleaved)
    feedback_buffer: Vec<f32>,
    /// Feedback buffer write position
    feedback_pos: usize,
    /// Per-voice vibrato LFO phases
    vibrato_phases: [f32; MAX_VOICES],
    /// Per-voice vibrato rate multipliers for organic variation
    vibrato_rate_mults: [f32; MAX_VOICES],
    /// Per-voice shimmer noise state (simple noise LFO)
    shimmer_values: [f32; MAX_VOICES],
    /// Per-voice shimmer targets for smooth interpolation
    shimmer_targets: [f32; MAX_VOICES],
}

/// Parameters for Shepard tone processing.
pub struct ShepardParams<'a> {
    /// Number of voices (2-12)
    pub voices: &'a [Sample],
    /// Rate of pitch change per second (-4.0 to 4.0, negative = descending)
    pub rate: &'a [Sample],
    /// Base frequency in Hz (center frequency)
    pub base_freq: &'a [Sample],
    /// Spread of the Gaussian envelope (0.5 to 2.0, lower = narrower)
    pub spread: &'a [Sample],
    /// Output mix level (0.0 to 1.0)
    pub mix: &'a [Sample],
    /// Waveform type (0=sine, 1=tri, 2=saw, 3=square)
    pub waveform: &'a [Sample],
    /// Stereo spread (0=mono, 1=full stereo)
    pub stereo: &'a [Sample],
    /// Detune amount in cents (0-50)
    pub detune: &'a [Sample],
    /// Direction mode (0=up, 1=down, 2=alternate, 3=random)
    pub direction: &'a [Sample],
    /// Risset mode (0=continuous Shepard, 1=discrete Risset)
    pub risset: &'a [Sample],
    /// Phase spread amount (0=coherent, 1=fully random phases)
    pub phase_spread: &'a [Sample],
    /// Harmonic interval mode (0=octave, 1=fifth, 2=fourth, 3=third)
    pub interval: &'a [Sample],
    /// Spectral tilt (-1=bass emphasis, 0=neutral, 1=treble emphasis)
    pub tilt: &'a [Sample],
    /// Feedback amount (0=none, 1=full)
    pub feedback: &'a [Sample],
    /// Vibrato depth in semitones (0=off, 1=full semitone)
    pub vibrato: &'a [Sample],
    /// Shimmer - random amplitude variations (0=off, 1=full)
    pub shimmer: &'a [Sample],
}

/// Input signals for Shepard tone modulation.
pub struct ShepardInputs<'a> {
    /// Rate CV modulation
    pub rate_cv: Option<&'a [Sample]>,
    /// Pitch CV modulation (1V/oct style)
    pub pitch_cv: Option<&'a [Sample]>,
    /// Sync trigger (resets all voices to initial positions)
    pub sync: Option<&'a [Sample]>,
}

impl Shepard {
    /// Create a new Shepard tone generator at the given sample rate.
    pub fn new(sample_rate: f32) -> Self {
        let mut positions = [0.0; MAX_VOICES];
        let phases = [0.0; MAX_VOICES];
        let mut phase_offsets = [0.0; MAX_VOICES];
        let mut detune_offsets = [0.0; MAX_VOICES];
        let direction_mult = [1.0; MAX_VOICES]; // All UP by default
        let mut vibrato_phases = [0.0; MAX_VOICES];
        let mut vibrato_rate_mults = [1.0; MAX_VOICES];
        let shimmer_values = [1.0; MAX_VOICES];
        let shimmer_targets = [1.0; MAX_VOICES];

        // Initialize voices spread across the octave range (default 8 voices)
        let default_voices = 8;
        for i in 0..MAX_VOICES {
            positions[i] = i as f32 / default_voices as f32;
            // Create consistent detune pattern using golden ratio for good spread
            detune_offsets[i] = ((i as f32 * 0.618033988749895) % 1.0 - 0.5) * 2.0;
            // Create phase offsets using different golden ratio multiple
            phase_offsets[i] = (i as f32 * 0.7548776662466927) % 1.0;
            // Stagger vibrato phases for organic feel
            vibrato_phases[i] = (i as f32 * 0.3819660112501052) % 1.0;
            // Vary vibrato rates slightly per voice (0.85 to 1.15)
            vibrato_rate_mults[i] = 0.85 + (i as f32 * 0.5236067977499790) % 0.30;
        }

        Self {
            sample_rate: sample_rate.max(1.0),
            positions,
            phases,
            phase_offsets,
            detune_offsets,
            direction_mult,
            last_voice_count: default_voices,
            last_direction: 0, // UP
            random_state: 12345,
            feedback_buffer: vec![0.0; FEEDBACK_BUFFER_SIZE * 2], // Stereo
            feedback_pos: 0,
            vibrato_phases,
            vibrato_rate_mults,
            shimmer_values,
            shimmer_targets,
        }
    }

    /// Simple LCG random for direction randomization
    fn next_random(&mut self) -> f32 {
        self.random_state = self.random_state.wrapping_mul(1103515245).wrapping_add(12345);
        ((self.random_state >> 16) & 0x7FFF) as f32 / 32767.0
    }

    /// Redistribute voice positions evenly for the given voice count.
    fn redistribute_voices(&mut self, num_voices: usize, direction: u8) {
        for i in 0..num_voices {
            self.positions[i] = i as f32 / num_voices as f32;
        }
        self.last_voice_count = num_voices;
        self.update_direction(num_voices, direction);
    }

    /// Update direction multipliers for the given voice count and direction mode.
    fn update_direction(&mut self, num_voices: usize, direction: u8) {
        for i in 0..num_voices {
            match direction {
                DIR_DOWN => self.direction_mult[i] = -1.0,
                DIR_ALTERNATE => self.direction_mult[i] = if i % 2 == 0 { 1.0 } else { -1.0 },
                DIR_RANDOM => self.direction_mult[i] = if self.next_random() > 0.5 { 1.0 } else { -1.0 },
                _ => self.direction_mult[i] = 1.0, // DIR_UP
            }
        }
        self.last_direction = direction;
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Reset all voices to initial positions.
    pub fn reset(&mut self) {
        let num_voices = self.last_voice_count;
        for i in 0..MAX_VOICES {
            self.positions[i] = i as f32 / num_voices as f32;
            self.phases[i] = 0.0;
        }
    }

    /// Gaussian envelope function.
    /// Returns amplitude based on position (0-1) with peak at 0.5.
    #[inline]
    fn gaussian(position: f32, spread: f32) -> f32 {
        let x = position - 0.5;
        let sigma = spread * 0.25;
        (-x * x / (2.0 * sigma * sigma)).exp()
    }

    /// Generate waveform sample based on phase (0-1) and type
    #[inline]
    fn generate_wave(phase: f32, waveform: u8) -> f32 {
        match waveform {
            WAVE_TRIANGLE => {
                let p = phase * 4.0;
                if p < 1.0 { p }
                else if p < 3.0 { 2.0 - p }
                else { p - 4.0 }
            }
            WAVE_SAW => 2.0 * phase - 1.0,
            WAVE_SQUARE => if phase < 0.5 { 1.0 } else { -1.0 },
            _ => (phase * 2.0 * PI).sin(), // WAVE_SINE
        }
    }

    /// Quantize position to semitones for Risset effect
    #[inline]
    fn quantize_to_semitone(position: f32) -> f32 {
        // 4 octaves = 48 semitones
        let semitones = (position * 48.0).round();
        semitones / 48.0
    }

    /// Get the frequency ratio for a given interval mode
    #[inline]
    fn interval_ratio(interval: u8) -> f32 {
        match interval {
            INTERVAL_FIFTH => 1.5,    // Perfect fifth (3:2)
            INTERVAL_FOURTH => 1.333, // Perfect fourth (4:3)
            INTERVAL_THIRD => 1.25,   // Major third (5:4)
            _ => 2.0,                 // Octave (default)
        }
    }

    /// Apply spectral tilt to amplitude based on position
    /// tilt < 0: boost bass (low positions), tilt > 0: boost treble (high positions)
    #[inline]
    fn apply_tilt(amp: f32, position: f32, tilt: f32) -> f32 {
        if tilt.abs() < 0.001 {
            return amp;
        }
        // Position 0 = low freq, 1 = high freq
        // tilt_factor goes from (1-tilt) to (1+tilt) across the range
        let tilt_factor = 1.0 + tilt * (position - 0.5) * 2.0;
        amp * tilt_factor.max(0.1)
    }

    /// Process a block of stereo audio.
    pub fn process_block_stereo(
        &mut self,
        output_l: &mut [Sample],
        output_r: &mut [Sample],
        inputs: ShepardInputs<'_>,
        params: ShepardParams<'_>,
    ) {
        if output_l.is_empty() {
            return;
        }

        let inv_sr = 1.0 / self.sample_rate;

        for i in 0..output_l.len() {
            // Get parameters for this sample
            let num_voices = (sample_at(params.voices, i, 8.0) as usize).clamp(2, MAX_VOICES);
            let direction = (sample_at(params.direction, i, 0.0) as u8).min(3);

            // Redistribute voices if count changed
            if num_voices != self.last_voice_count {
                self.redistribute_voices(num_voices, direction);
            } else if direction != self.last_direction {
                // Update direction multipliers if direction changed
                self.update_direction(num_voices, direction);
            }

            let base_rate = sample_at(params.rate, i, 0.1).clamp(-4.0, 4.0);
            let rate_cv = input_at(inputs.rate_cv, i);
            let rate = (base_rate + rate_cv).clamp(-4.0, 4.0);

            // Base frequency with pitch CV (1V/oct)
            let pitch_cv = input_at(inputs.pitch_cv, i);
            let base_freq_param = sample_at(params.base_freq, i, 220.0).clamp(20.0, 2000.0);
            let base_freq = base_freq_param * 2.0_f32.powf(pitch_cv);

            let spread = sample_at(params.spread, i, 1.0).clamp(0.5, 2.0);
            let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);
            let waveform = (sample_at(params.waveform, i, 0.0) as u8).min(3);
            let stereo_spread = sample_at(params.stereo, i, 0.5).clamp(0.0, 1.0);
            let detune_amount = sample_at(params.detune, i, 0.0).clamp(0.0, 50.0);
            let risset_mode = sample_at(params.risset, i, 0.0) > 0.5;

            // New parameters
            let phase_spread = sample_at(params.phase_spread, i, 0.0).clamp(0.0, 1.0);
            let interval = (sample_at(params.interval, i, 0.0) as u8).min(3);
            let tilt = sample_at(params.tilt, i, 0.0).clamp(-1.0, 1.0);
            let feedback_amt = sample_at(params.feedback, i, 0.0).clamp(0.0, 0.9);
            let vibrato_depth = sample_at(params.vibrato, i, 0.0).clamp(0.0, 1.0);
            let shimmer_amt = sample_at(params.shimmer, i, 0.0).clamp(0.0, 1.0);

            // Get interval ratio for frequency calculation
            let interval_ratio = Self::interval_ratio(interval);

            // Check for sync trigger
            if let Some(sync) = inputs.sync {
                if i < sync.len() && sync[i] > 0.5 {
                    self.reset();
                }
            }

            // Read feedback from buffer (with some delay)
            let fb_delay = 512; // ~11ms at 44.1kHz
            let fb_read_pos = (self.feedback_pos + FEEDBACK_BUFFER_SIZE * 2 - fb_delay * 2) % (FEEDBACK_BUFFER_SIZE * 2);
            let fb_l = self.feedback_buffer[fb_read_pos];
            let fb_r = self.feedback_buffer[fb_read_pos + 1];

            // Rate of position change per sample
            let position_delta = rate * 0.1 * inv_sr;

            let mut sample_l = 0.0;
            let mut sample_r = 0.0;
            let mut total_amp = 0.0;

            for v in 0..num_voices {
                // Update voice position based on direction mode
                let voice_delta = position_delta * self.direction_mult[v];
                self.positions[v] += voice_delta;

                // Wrap position to 0-1 range
                if self.positions[v] >= 1.0 {
                    self.positions[v] -= 1.0;
                } else if self.positions[v] < 0.0 {
                    self.positions[v] += 1.0;
                }

                // Get position (quantized for Risset mode)
                let pos = if risset_mode {
                    Self::quantize_to_semitone(self.positions[v])
                } else {
                    self.positions[v]
                };

                // Calculate frequency for this voice using interval ratio
                // Position 0.0 = 2 intervals below base, 0.5 = base, 1.0 = 2 intervals above
                let interval_offset = (pos - 0.5) * 4.0;
                let freq_mult = interval_ratio.powf(interval_offset);

                // Apply detune (convert cents to frequency ratio)
                let detune_cents = self.detune_offsets[v] * detune_amount;
                let detune_ratio = 2.0_f32.powf(detune_cents / 1200.0);

                // Apply vibrato: per-voice LFO modulating pitch
                let mut vibrato_mod = 1.0;
                if vibrato_depth > 0.001 {
                    // Update vibrato LFO phase
                    let vib_rate = VIBRATO_BASE_RATE * self.vibrato_rate_mults[v];
                    self.vibrato_phases[v] += vib_rate * inv_sr;
                    if self.vibrato_phases[v] >= 1.0 {
                        self.vibrato_phases[v] -= 1.0;
                    }
                    // Sine LFO for vibrato
                    let vib_lfo = (self.vibrato_phases[v] * 2.0 * PI).sin();
                    // Convert depth in semitones to frequency ratio
                    let vib_semitones = vib_lfo * vibrato_depth;
                    vibrato_mod = 2.0_f32.powf(vib_semitones / 12.0);
                }

                let freq = base_freq * freq_mult * detune_ratio * vibrato_mod;

                // Calculate amplitude using Gaussian envelope
                let amp = Self::gaussian(pos, spread);
                // Apply spectral tilt
                let amp = Self::apply_tilt(amp, pos, tilt);

                // Apply shimmer: random amplitude modulation per voice
                let shimmer_mod = if shimmer_amt > 0.001 {
                    // Slowly interpolate toward random target
                    let interp_rate = 0.002; // Smooth interpolation
                    self.shimmer_values[v] += (self.shimmer_targets[v] - self.shimmer_values[v]) * interp_rate;

                    // Occasionally pick new random target
                    if self.next_random() < 0.001 {
                        self.shimmer_targets[v] = 0.5 + self.next_random() * 0.5; // 0.5 to 1.0
                    }

                    // Blend between 1.0 (no shimmer) and shimmer value
                    1.0 - shimmer_amt + shimmer_amt * self.shimmer_values[v]
                } else {
                    1.0
                };

                let amp = amp * shimmer_mod;

                // Update oscillator phase
                self.phases[v] += freq * inv_sr;
                if self.phases[v] >= 1.0 {
                    self.phases[v] -= self.phases[v].floor();
                }

                // Generate waveform with optional phase offset for spread
                let phase_with_offset = (self.phases[v] + self.phase_offsets[v] * phase_spread) % 1.0;
                let wave = Self::generate_wave(phase_with_offset, waveform);
                let voiced_sample = wave * amp;

                // Stereo panning based on voice index (stable, not moving with position)
                // Voice 0 = left, voice num_voices-1 = right, spread from center
                let voice_pan = if num_voices > 1 {
                    (v as f32 / (num_voices - 1) as f32 - 0.5) * 2.0 * stereo_spread
                } else {
                    0.0 // Mono if only one voice
                };
                // Equal power panning approximation
                let pan_l = ((1.0 - voice_pan) * 0.5).sqrt();
                let pan_r = ((1.0 + voice_pan) * 0.5).sqrt();

                sample_l += voiced_sample * pan_l;
                sample_r += voiced_sample * pan_r;
                total_amp += amp;
            }

            // Normalize by total amplitude to maintain consistent level
            let (out_l, out_r) = if total_amp > 0.001 {
                let norm_l = sample_l / total_amp;
                let norm_r = sample_r / total_amp;
                // Add feedback
                let with_fb_l = norm_l + fb_l * feedback_amt;
                let with_fb_r = norm_r + fb_r * feedback_amt;
                (with_fb_l * mix, with_fb_r * mix)
            } else {
                (0.0, 0.0)
            };

            output_l[i] = out_l;
            output_r[i] = out_r;

            // Write to feedback buffer (with soft clip to prevent runaway)
            let fb_write_l = (out_l * 0.7).tanh();
            let fb_write_r = (out_r * 0.7).tanh();
            self.feedback_buffer[self.feedback_pos] = fb_write_l;
            self.feedback_buffer[self.feedback_pos + 1] = fb_write_r;
            self.feedback_pos = (self.feedback_pos + 2) % (FEEDBACK_BUFFER_SIZE * 2);
        }
    }

    /// Process a block of mono audio (for backwards compatibility).
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: ShepardInputs<'_>,
        params: ShepardParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        // Create temporary right channel buffer
        let mut output_r = vec![0.0; output.len()];

        // Process stereo
        self.process_block_stereo(output, &mut output_r, inputs, params);

        // Mix to mono
        for i in 0..output.len() {
            output[i] = (output[i] + output_r[i]) * 0.5;
        }
    }
}
