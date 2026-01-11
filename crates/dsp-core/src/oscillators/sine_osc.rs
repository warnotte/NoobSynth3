//! Simple sine wave oscillator.
//!
//! A basic sine oscillator implementing the [`Node`] trait for simple
//! audio generation without external modulation inputs.

use crate::common::{Node, Sample};

/// Simple sine wave oscillator.
///
/// This oscillator generates a pure sine tone at a fixed frequency.
/// It implements the [`Node`] trait for basic audio generation.
///
/// For modulated oscillators with FM, sync, and other features,
/// use [`Vco`](super::vco::Vco) instead.
///
/// # Example
///
/// ```
/// use dsp_core::oscillators::SineOsc;
/// use dsp_core::Node;
///
/// let mut osc = SineOsc::new(440.0);
/// osc.reset(44100.0);
///
/// let mut buffer = [0.0f32; 128];
/// osc.process(&mut buffer);
/// ```
pub struct SineOsc {
    freq_hz: f32,
    gain: f32,
    phase: f32,
    sample_rate: f32,
}

impl SineOsc {
    /// Create a new sine oscillator at the given frequency.
    ///
    /// # Arguments
    ///
    /// * `freq_hz` - Frequency in Hz
    pub fn new(freq_hz: f32) -> Self {
        Self {
            freq_hz,
            gain: 0.8,
            phase: 0.0,
            sample_rate: 48_000.0,
        }
    }

    /// Set the oscillator frequency.
    ///
    /// # Arguments
    ///
    /// * `freq_hz` - New frequency in Hz (clamped to >= 0)
    pub fn set_frequency(&mut self, freq_hz: f32) {
        self.freq_hz = freq_hz.max(0.0);
    }

    /// Set the output gain.
    ///
    /// # Arguments
    ///
    /// * `gain` - Output amplitude (clamped to 0.0..1.0)
    pub fn set_gain(&mut self, gain: f32) {
        self.gain = gain.clamp(0.0, 1.0);
    }
}

impl Node for SineOsc {
    fn reset(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        self.phase = 0.0;
    }

    fn process(&mut self, output: &mut [Sample]) {
        if output.is_empty() {
            return;
        }
        let phase_step = (self.freq_hz / self.sample_rate) * std::f32::consts::TAU;
        for sample in output.iter_mut() {
            *sample = self.gain * self.phase.sin();
            self.phase += phase_step;
            if self.phase >= std::f32::consts::TAU {
                self.phase -= std::f32::consts::TAU;
            }
        }
    }
}
