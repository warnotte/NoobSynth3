//! Low Frequency Oscillator (LFO) for modulation.
//!
//! Generates cyclic control signals at sub-audio frequencies
//! for modulating other parameters.

use crate::common::{input_at, sample_at, Sample};

/// Low Frequency Oscillator.
///
/// Generates periodic waveforms at low frequencies (typically 0.01-20 Hz)
/// for modulating filter cutoff, amplitude, pitch, and other parameters.
///
/// # Waveforms
///
/// - 0: Sine - smooth, natural modulation
/// - 1: Triangle - linear ramps up and down
/// - 2: Sawtooth - rises linearly, resets instantly
/// - 3: Square - alternates between +1 and -1
///
/// # Modes
///
/// - Bipolar: Output ranges from -depth to +depth
/// - Unipolar: Output ranges from 0 to +depth
///
/// # Example
///
/// ```ignore
/// use dsp_core::modulators::{Lfo, LfoParams, LfoInputs};
///
/// let mut lfo = Lfo::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// lfo.process_block(&mut output, inputs, params);
/// ```
pub struct Lfo {
    sample_rate: f32,
    phase: f32,
    last_sync: f32,
}

/// Input signals for LFO.
pub struct LfoInputs<'a> {
    /// Rate CV modulation (1V/octave of rate)
    pub rate_cv: Option<&'a [Sample]>,
    /// Sync/reset trigger (resets phase on rising edge)
    pub sync: Option<&'a [Sample]>,
}

/// Parameters for LFO.
pub struct LfoParams<'a> {
    /// Base rate in Hz (0.01-20)
    pub rate: &'a [Sample],
    /// Waveform shape (0=sine, 1=triangle, 2=saw, 3=square)
    pub shape: &'a [Sample],
    /// Output depth/amplitude (0-1)
    pub depth: &'a [Sample],
    /// DC offset (-1 to 1)
    pub offset: &'a [Sample],
    /// Bipolar mode (>= 0.5 = bipolar, < 0.5 = unipolar)
    pub bipolar: &'a [Sample],
}

impl Lfo {
    /// Create a new LFO.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phase: 0.0,
            last_sync: 0.0,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: LfoInputs<'_>,
        params: LfoParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        let shape_index = params.shape.get(0).copied().unwrap_or(0.0);
        let bipolar = params.bipolar.get(0).copied().unwrap_or(1.0) >= 0.5;
        let tau = std::f32::consts::TAU;

        for i in 0..output.len() {
            let rate_base = sample_at(params.rate, i, 2.0);
            let rate_cv = input_at(inputs.rate_cv, i);
            let sync = input_at(inputs.sync, i);
            let depth = sample_at(params.depth, i, 0.7);
            let offset = sample_at(params.offset, i, 0.0);

            // Reset phase on sync rising edge
            if sync > 0.5 && self.last_sync <= 0.5 {
                self.phase = 0.0;
            }
            self.last_sync = sync;

            // Calculate rate with CV modulation
            let mut rate = rate_base * 2.0_f32.powf(rate_cv);
            if !rate.is_finite() || rate < 0.0 {
                rate = 0.0;
            }
            self.phase += rate / self.sample_rate;
            if self.phase >= 1.0 {
                self.phase -= self.phase.floor();
            }

            // Generate waveform
            let wave = if shape_index < 0.5 {
                // Sine
                (tau * self.phase).sin()
            } else if shape_index < 1.5 {
                // Triangle
                2.0 * (2.0 * (self.phase - (self.phase + 0.5).floor())).abs() - 1.0
            } else if shape_index < 2.5 {
                // Sawtooth
                2.0 * (self.phase - 0.5)
            } else if self.phase < 0.5 {
                // Square (high)
                1.0
            } else {
                // Square (low)
                -1.0
            };

            // Apply depth, offset, and mode
            let mut sample = if bipolar {
                wave * depth + offset
            } else {
                (wave * 0.5 + 0.5) * depth + offset
            };
            sample = sample.clamp(-1.0, 1.0);
            output[i] = sample;
        }
    }
}
