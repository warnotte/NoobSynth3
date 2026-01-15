//! Shepard Tone generator - creates an auditory illusion of endlessly rising/falling pitch.
//!
//! The Shepard tone works by layering multiple sine waves separated by octaves.
//! As each voice rises in pitch, its amplitude follows a Gaussian curve - loud in
//! the middle register, fading at the extremes. When a voice reaches the top,
//! it wraps to the bottom at near-zero amplitude, creating the illusion of
//! continuous ascent (or descent).

use crate::common::{sample_at, input_at, Sample};
use std::f32::consts::PI;

/// Maximum number of voices for Shepard tone
const MAX_VOICES: usize = 12;

/// Shepard tone generator with configurable voices and rate.
pub struct Shepard {
    sample_rate: f32,
    /// Current position of each voice (0.0 to 1.0, representing octave position)
    positions: [f32; MAX_VOICES],
    /// Phase accumulator for each voice's oscillator
    phases: [f32; MAX_VOICES],
    /// Last known voice count (to detect changes and redistribute)
    last_voice_count: usize,
}

/// Parameters for Shepard tone processing.
pub struct ShepardParams<'a> {
    /// Number of voices (2-12)
    pub voices: &'a [Sample],
    /// Rate of pitch change per second (-1.0 to 1.0, negative = descending)
    pub rate: &'a [Sample],
    /// Base frequency in Hz (center frequency)
    pub base_freq: &'a [Sample],
    /// Spread of the Gaussian envelope (0.1 to 2.0, lower = narrower)
    pub spread: &'a [Sample],
    /// Output mix level (0.0 to 1.0)
    pub mix: &'a [Sample],
}

/// Input signals for Shepard tone modulation.
pub struct ShepardInputs<'a> {
    /// Rate CV modulation
    pub rate_cv: Option<&'a [Sample]>,
    /// Sync trigger (resets all voices to initial positions)
    pub sync: Option<&'a [Sample]>,
}

impl Shepard {
    /// Create a new Shepard tone generator at the given sample rate.
    pub fn new(sample_rate: f32) -> Self {
        let mut positions = [0.0; MAX_VOICES];
        let phases = [0.0; MAX_VOICES];

        // Initialize voices spread across the octave range (default 8 voices)
        let default_voices = 8;
        for i in 0..MAX_VOICES {
            positions[i] = i as f32 / default_voices as f32;
        }

        Self {
            sample_rate: sample_rate.max(1.0),
            positions,
            phases,
            last_voice_count: default_voices,
        }
    }

    /// Redistribute voice positions evenly for the given voice count.
    fn redistribute_voices(&mut self, num_voices: usize) {
        for i in 0..num_voices {
            self.positions[i] = i as f32 / num_voices as f32;
        }
        self.last_voice_count = num_voices;
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
        let sigma = spread * 0.25; // Scale spread to reasonable range
        (-x * x / (2.0 * sigma * sigma)).exp()
    }

    /// Process a block of audio.
    ///
    /// # Arguments
    ///
    /// * `output` - Output buffer to fill
    /// * `inputs` - Modulation inputs
    /// * `params` - Processing parameters
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: ShepardInputs<'_>,
        params: ShepardParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        let inv_sr = 1.0 / self.sample_rate;

        for i in 0..output.len() {
            // Get parameters for this sample
            let num_voices = (sample_at(params.voices, i, 8.0) as usize).clamp(2, MAX_VOICES);

            // Redistribute voices if count changed
            if num_voices != self.last_voice_count {
                self.redistribute_voices(num_voices);
            }

            let base_rate = sample_at(params.rate, i, 0.1).clamp(-4.0, 4.0);
            let rate_cv = input_at(inputs.rate_cv, i);
            let rate = (base_rate + rate_cv).clamp(-4.0, 4.0);
            let base_freq = sample_at(params.base_freq, i, 220.0).clamp(20.0, 2000.0);
            let spread = sample_at(params.spread, i, 1.0).clamp(0.1, 2.0);
            let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);

            // Check for sync trigger
            if let Some(sync) = inputs.sync {
                if i < sync.len() && sync[i] > 0.5 {
                    self.reset();
                }
            }

            // Rate of position change per sample
            // At rate=1.0, complete one octave cycle in ~10 seconds
            let position_delta = rate * 0.1 * inv_sr;

            let mut sample = 0.0;
            let mut total_amp = 0.0;

            for v in 0..num_voices {
                // Update voice position
                self.positions[v] += position_delta;

                // Wrap position to 0-1 range
                if self.positions[v] >= 1.0 {
                    self.positions[v] -= 1.0;
                } else if self.positions[v] < 0.0 {
                    self.positions[v] += 1.0;
                }

                // Calculate frequency for this voice
                // Position 0.0 = 2 octaves below base, 0.5 = base, 1.0 = 2 octaves above
                let octave_offset = (self.positions[v] - 0.5) * 4.0; // ±2 octaves
                let freq = base_freq * 2.0_f32.powf(octave_offset);

                // Calculate amplitude using Gaussian envelope
                let amp = Self::gaussian(self.positions[v], spread);

                // Update oscillator phase
                self.phases[v] += freq * inv_sr;
                if self.phases[v] >= 1.0 {
                    self.phases[v] -= self.phases[v].floor();
                }

                // Generate sine wave
                let sine = (self.phases[v] * 2.0 * PI).sin();

                sample += sine * amp;
                total_amp += amp;
            }

            // Normalize by total amplitude to maintain consistent level
            if total_amp > 0.001 {
                output[i] = (sample / total_amp) * mix;
            } else {
                output[i] = 0.0;
            }
        }
    }
}
