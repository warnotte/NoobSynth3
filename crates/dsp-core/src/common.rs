//! Common types and utilities for DSP processing.
//!
//! This module contains fundamental types used across all DSP modules:
//! - [`Sample`] - The audio sample type (f32)
//! - [`ProcessContext`] - Audio context with sample rate and block size
//! - [`Node`] - Trait for simple audio generators
//! - Utility functions for buffer access and signal processing

/// Audio sample type used throughout the DSP engine.
///
/// Using f32 provides a good balance between precision and performance,
/// especially for WASM targets where f64 operations can be slower.
pub type Sample = f32;

/// Audio processing context containing sample rate and block size.
///
/// This struct is passed to processing functions to provide timing information
/// needed for frequency calculations and buffer sizing.
///
/// # Example
///
/// ```
/// use dsp_core::ProcessContext;
///
/// let ctx = ProcessContext::new(44100.0, 128);
/// assert_eq!(ctx.sample_rate, 44100.0);
/// assert_eq!(ctx.block_size, 128);
/// ```
#[derive(Debug, Clone, Copy)]
pub struct ProcessContext {
    /// Sample rate in Hz (e.g., 44100.0, 48000.0)
    pub sample_rate: f32,
    /// Number of samples per processing block
    pub block_size: usize,
}

impl ProcessContext {
    /// Creates a new processing context.
    ///
    /// # Arguments
    ///
    /// * `sample_rate` - Audio sample rate in Hz
    /// * `block_size` - Number of samples per block
    pub fn new(sample_rate: f32, block_size: usize) -> Self {
        Self {
            sample_rate,
            block_size,
        }
    }
}

/// Trait for simple audio generator nodes.
///
/// This trait is used for basic oscillators and generators that don't require
/// external inputs or complex parameter structures.
///
/// For more complex modules, direct `process_block` methods are used instead.
pub trait Node {
    /// Reset the node's internal state for a new sample rate.
    ///
    /// Called when the audio engine starts or when sample rate changes.
    fn reset(&mut self, sample_rate: f32);

    /// Generate audio samples into the output buffer.
    ///
    /// # Arguments
    ///
    /// * `output` - Buffer to fill with generated samples
    fn process(&mut self, output: &mut [Sample]);
}

// =============================================================================
// Utility Functions
// =============================================================================

/// Clamp a value between min and max bounds.
///
/// # Arguments
///
/// * `value` - The value to clamp
/// * `min` - Minimum bound
/// * `max` - Maximum bound
///
/// # Note
///
/// This is a simple implementation for compatibility. Consider using
/// `f32::clamp()` from std when available.
#[inline]
pub fn clamp(value: f32, min: f32, max: f32) -> f32 {
    if value < min {
        min
    } else if value > max {
        max
    } else {
        value
    }
}

/// Get a sample from a parameter buffer with fallback.
///
/// Handles both single-value (constant) and per-sample parameter buffers.
/// If the buffer has only one element, that value is used for all indices.
///
/// # Arguments
///
/// * `values` - Parameter buffer
/// * `index` - Sample index
/// * `fallback` - Value to return if buffer is empty
#[inline]
pub fn sample_at(values: &[Sample], index: usize, fallback: Sample) -> Sample {
    if values.is_empty() {
        return fallback;
    }
    if values.len() > 1 {
        return values[index];
    }
    values[0]
}

/// Get a sample from an optional input buffer.
///
/// Returns 0.0 if the input is None or empty. Handles both single-value
/// and per-sample buffers like [`sample_at`].
///
/// # Arguments
///
/// * `values` - Optional input buffer
/// * `index` - Sample index
#[inline]
pub fn input_at(values: Option<&[Sample]>, index: usize) -> Sample {
    match values {
        Some(values) if !values.is_empty() => {
            if values.len() > 1 {
                values[index]
            } else {
                values[0]
            }
        }
        _ => 0.0,
    }
}

/// Soft saturation using hyperbolic tangent.
///
/// Provides gentle compression of signals exceeding [-1, 1] range.
/// Useful for analog-style warmth and preventing hard clipping.
#[inline]
pub fn saturate(value: f32) -> f32 {
    value.tanh()
}

/// Polynomial Band-Limited Step (polyBLEP) anti-aliasing.
///
/// Reduces aliasing artifacts in oscillators by smoothing discontinuities
/// at waveform transitions. This is applied at the points where the
/// waveform has sudden jumps (e.g., sawtooth reset, square wave edges).
///
/// # Arguments
///
/// * `phase` - Current oscillator phase (0.0 to 1.0)
/// * `dt` - Phase increment per sample (frequency / sample_rate)
///
/// # Returns
///
/// Correction value to add to the naive waveform output.
///
/// # Reference
///
/// Based on Välimäki & Huovilainen, "Antialiasing Oscillators in
/// Subtractive Synthesis" (IEEE Signal Processing Magazine, 2007)
#[inline]
pub fn poly_blep(phase: f32, dt: f32) -> f32 {
    if dt <= 0.0 {
        return 0.0;
    }
    if phase < dt {
        let x = phase / dt;
        return x + x - x * x - 1.0;
    }
    if phase > 1.0 - dt {
        let x = (phase - 1.0) / dt;
        return x * x + x + 1.0;
    }
    0.0
}

// =============================================================================
// Constants
// =============================================================================

/// Standard concert pitch A4 in Hz
pub const A4_FREQ: f32 = 440.0;

/// MIDI note number for A4
pub const A4_MIDI: i32 = 69;

/// Semitones per octave
pub const SEMITONES_PER_OCTAVE: f32 = 12.0;

/// Convert MIDI note number to frequency in Hz.
///
/// Uses standard 12-TET tuning with A4 = 440 Hz.
///
/// # Example
///
/// ```
/// use dsp_core::common::midi_to_freq;
///
/// let freq = midi_to_freq(69); // A4
/// assert!((freq - 440.0).abs() < 0.01);
/// ```
#[inline]
pub fn midi_to_freq(note: i32) -> f32 {
    A4_FREQ * 2.0_f32.powf((note - A4_MIDI) as f32 / SEMITONES_PER_OCTAVE)
}

/// Convert frequency in Hz to MIDI note number.
///
/// Returns fractional note numbers for pitches between semitones.
#[inline]
pub fn freq_to_midi(freq: f32) -> f32 {
    A4_MIDI as f32 + SEMITONES_PER_OCTAVE * (freq / A4_FREQ).log2()
}
