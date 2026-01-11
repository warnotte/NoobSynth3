//! Supersaw oscillator - 7 detuned sawtooth voices.
//!
//! Classic "supersaw" sound popularized by the Roland JP-8000.
//! Creates a thick, rich sound by layering 7 detuned sawtooth waves.

use crate::common::{input_at, poly_blep, sample_at, Sample};

/// Supersaw oscillator with 7 detuned voices.
///
/// The classic "supersaw" sound stacks 7 sawtooth oscillators with
/// symmetric detuning around the center frequency. The center voice
/// is loudest, with outer voices gradually quieter.
///
/// # Features
///
/// - 7 sawtooth voices with polyBLEP anti-aliasing
/// - Adjustable detune spread (0-100 cents)
/// - Symmetric voice distribution
/// - Level weighting (center louder than sides)
///
/// # Example
///
/// ```ignore
/// use dsp_core::oscillators::{Supersaw, SupersawParams, SupersawInputs};
///
/// let mut saw = Supersaw::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// saw.process_block(&mut output, inputs, params);
/// ```
pub struct Supersaw {
    sample_rate: f32,
    phases: [f32; 7],
}

/// Parameters for Supersaw processing.
pub struct SupersawParams<'a> {
    /// Base frequency in Hz
    pub base_freq: &'a [Sample],
    /// Detune spread in cents (0-100)
    pub detune: &'a [Sample],
    /// Output mix level (0.0 to 1.0)
    pub mix: &'a [Sample],
}

/// Input signals for Supersaw modulation.
pub struct SupersawInputs<'a> {
    /// Pitch CV (1V/octave)
    pub pitch: Option<&'a [Sample]>,
}

impl Supersaw {
    /// Voice detune offsets (symmetric around center)
    const OFFSETS: [f32; 7] = [-1.0, -0.666, -0.333, 0.0, 0.333, 0.666, 1.0];
    /// Voice mix levels (center louder)
    const LEVELS: [f32; 7] = [0.7, 0.8, 0.9, 1.0, 0.9, 0.8, 0.7];

    /// Create a new Supersaw at the given sample rate.
    pub fn new(sample_rate: f32) -> Self {
        let mut phases = [0.0; 7];
        for (i, phase) in phases.iter_mut().enumerate() {
            *phase = i as f32 / 7.0;
        }
        Self {
            sample_rate: sample_rate.max(1.0),
            phases,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
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
        inputs: SupersawInputs<'_>,
        params: SupersawParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        for i in 0..output.len() {
            let base = sample_at(params.base_freq, i, 220.0);
            let pitch = input_at(inputs.pitch, i);
            let detune_cents = sample_at(params.detune, i, 25.0).clamp(0.0, 100.0);
            let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);

            let frequency = base * 2.0_f32.powf(pitch);
            let mut sample = 0.0;
            let mut total_level = 0.0;

            for v in 0..7 {
                let offset = Self::OFFSETS[v];
                let level = Self::LEVELS[v];
                let detune_factor = 2.0_f32.powf((detune_cents * offset) / 1200.0);
                let voice_freq = frequency * detune_factor;
                let dt = (voice_freq / self.sample_rate).min(1.0);

                self.phases[v] += voice_freq / self.sample_rate;
                if self.phases[v] >= 1.0 {
                    self.phases[v] -= self.phases[v].floor();
                }

                let phase = self.phases[v];
                let mut saw = 2.0 * phase - 1.0;
                saw -= poly_blep(phase, dt);
                sample += saw * level;
                total_level += level;
            }

            output[i] = (sample / total_level) * mix;
        }
    }
}
