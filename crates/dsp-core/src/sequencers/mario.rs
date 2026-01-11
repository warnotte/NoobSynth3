//! Mario Song Player.
//!
//! A CV/gate holder module controlled by the host (JavaScript).
//! Used to play Mario theme songs and other melodies.

use crate::common::Sample;

/// Number of channels in the Mario module.
pub const MARIO_CHANNELS: usize = 5;

/// Mario Song Player.
///
/// A simple module that holds CV and gate values for 5 channels.
/// The values are set externally by the host (JavaScript) and
/// output as constant CV/gate signals.
///
/// This module has no internal sequencing logic - it's purely
/// a bridge between the JS song player and the audio graph.
///
/// # Outputs
///
/// - 5 CV outputs (pitch as V/oct)
/// - 5 Gate outputs (0 or 1)
///
/// # Example
///
/// ```ignore
/// use dsp_core::sequencers::{Mario, MarioOutputs, MARIO_CHANNELS};
///
/// let mut mario = Mario::new();
///
/// // Set channel 0 to play middle C with gate on
/// mario.set_cv(0, 0.0);  // Middle C = 0V in V/oct
/// mario.set_gate(0, 1.0);
///
/// // Process a block
/// let mut cv_outs = [[0.0f32; 128]; MARIO_CHANNELS];
/// let mut gate_outs = [[0.0f32; 128]; MARIO_CHANNELS];
///
/// mario.process_block(
///     MarioOutputs {
///         cv: &mut cv_outs.each_mut().map(|a| a.as_mut_slice()),
///         gate: &mut gate_outs.each_mut().map(|a| a.as_mut_slice()),
///     },
///     128,
/// );
/// ```
pub struct Mario {
    cv: [f32; MARIO_CHANNELS],
    gate: [f32; MARIO_CHANNELS],
}

/// Output buffers for Mario.
pub struct MarioOutputs<'a> {
    /// CV outputs for each channel (V/oct pitch)
    pub cv: [&'a mut [Sample]; MARIO_CHANNELS],
    /// Gate outputs for each channel (0 or 1)
    pub gate: [&'a mut [Sample]; MARIO_CHANNELS],
}

impl Mario {
    /// Create a new Mario module.
    pub fn new() -> Self {
        Self {
            cv: [0.0; MARIO_CHANNELS],
            gate: [0.0; MARIO_CHANNELS],
        }
    }

    /// Set the CV value for a channel (0-4).
    ///
    /// CV is in V/oct format where 0V = middle C (MIDI 60).
    pub fn set_cv(&mut self, channel: usize, value: f32) {
        if channel < MARIO_CHANNELS {
            self.cv[channel] = value;
        }
    }

    /// Set the gate value for a channel (0-4).
    ///
    /// Gate should be 0.0 (off) or 1.0 (on).
    pub fn set_gate(&mut self, channel: usize, value: f32) {
        if channel < MARIO_CHANNELS {
            self.gate[channel] = value;
        }
    }

    /// Get the current CV value for a channel.
    pub fn cv(&self, channel: usize) -> f32 {
        if channel < MARIO_CHANNELS {
            self.cv[channel]
        } else {
            0.0
        }
    }

    /// Get the current gate value for a channel.
    pub fn gate(&self, channel: usize) -> f32 {
        if channel < MARIO_CHANNELS {
            self.gate[channel]
        } else {
            0.0
        }
    }

    /// Process a block of samples.
    ///
    /// Fills the output buffers with the current CV and gate values.
    pub fn process_block(&self, outputs: MarioOutputs, frames: usize) {
        for channel in 0..MARIO_CHANNELS {
            let cv_value = self.cv[channel];
            let gate_value = self.gate[channel];

            for i in 0..frames.min(outputs.cv[channel].len()) {
                outputs.cv[channel][i] = cv_value;
            }
            for i in 0..frames.min(outputs.gate[channel].len()) {
                outputs.gate[channel][i] = gate_value;
            }
        }
    }
}

impl Default for Mario {
    fn default() -> Self {
        Self::new()
    }
}
