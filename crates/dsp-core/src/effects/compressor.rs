//! Dynamics compressor effect.
//!
//! Standard audio compressor with threshold, ratio, attack, release,
//! makeup gain, and dry/wet mix controls. Supports stereo with linked
//! detection (both channels share the same envelope for consistent imaging).

use crate::common::{input_at, sample_at, Sample};

/// Compressor state for envelope follower.
pub struct Compressor {
    envelope: f32,
    sample_rate: f32,
}

impl Compressor {
    /// Create a new compressor with the given sample rate.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            envelope: 0.0,
            sample_rate,
        }
    }
}

/// Parameters for the Compressor effect.
pub struct CompressorParams<'a> {
    /// Threshold in dB (-60 to 0)
    pub threshold: &'a [Sample],
    /// Compression ratio (1 to 20)
    pub ratio: &'a [Sample],
    /// Attack time in ms (0.5 to 200)
    pub attack: &'a [Sample],
    /// Release time in ms (10 to 2000)
    pub release: &'a [Sample],
    /// Makeup gain in dB (-24 to +24)
    pub makeup: &'a [Sample],
    /// Dry/wet mix (0 to 1)
    pub mix: &'a [Sample],
}

impl Compressor {
    /// Process a stereo block of audio through the compressor.
    /// Uses linked detection (max of both channels) to preserve stereo image.
    pub fn process_block_stereo(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        in_l: Option<&[Sample]>,
        in_r: Option<&[Sample]>,
        params: CompressorParams<'_>,
    ) {
        let frames = out_l.len().min(out_r.len());
        if frames == 0 {
            return;
        }

        for i in 0..frames {
            let threshold_db = sample_at(params.threshold, i, -20.0).clamp(-60.0, 0.0);
            let ratio = sample_at(params.ratio, i, 4.0).clamp(1.0, 20.0);
            let attack_ms = sample_at(params.attack, i, 10.0).clamp(0.5, 200.0);
            let release_ms = sample_at(params.release, i, 100.0).clamp(10.0, 2000.0);
            let makeup_db = sample_at(params.makeup, i, 0.0).clamp(-24.0, 24.0);
            let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);

            let sample_l = input_at(in_l, i);
            let sample_r = input_at(in_r, i);

            // Convert threshold and makeup from dB to linear
            let threshold_lin = db_to_linear(threshold_db);
            let makeup_lin = db_to_linear(makeup_db);

            // Calculate attack and release coefficients
            let attack_coeff = (-2.0 * std::f32::consts::PI * 1000.0 / (attack_ms * self.sample_rate)).exp();
            let release_coeff = (-2.0 * std::f32::consts::PI * 1000.0 / (release_ms * self.sample_rate)).exp();

            // Linked stereo detection - use max of both channels
            let input_peak = sample_l.abs().max(sample_r.abs());

            // Envelope follower (peak detection)
            if input_peak > self.envelope {
                // Attack phase
                self.envelope = attack_coeff * self.envelope + (1.0 - attack_coeff) * input_peak;
            } else {
                // Release phase
                self.envelope = release_coeff * self.envelope + (1.0 - release_coeff) * input_peak;
            }

            // Calculate gain reduction
            let gain = if self.envelope > threshold_lin {
                // Over threshold - apply compression
                let over_db = linear_to_db(self.envelope / threshold_lin);
                let reduced_db = over_db / ratio;
                let target_level = threshold_lin * db_to_linear(reduced_db);
                target_level / self.envelope.max(1e-10)
            } else {
                // Under threshold - no compression
                1.0
            };

            // Apply gain and makeup
            let compressed_l = sample_l * gain * makeup_lin;
            let compressed_r = sample_r * gain * makeup_lin;

            // Mix dry/wet
            let dry = 1.0 - mix;
            out_l[i] = sample_l * dry + compressed_l * mix;
            out_r[i] = sample_r * dry + compressed_r * mix;
        }
    }

    /// Process a mono block of audio through the compressor.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        input: Option<&[Sample]>,
        params: CompressorParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        for i in 0..output.len() {
            let threshold_db = sample_at(params.threshold, i, -20.0).clamp(-60.0, 0.0);
            let ratio = sample_at(params.ratio, i, 4.0).clamp(1.0, 20.0);
            let attack_ms = sample_at(params.attack, i, 10.0).clamp(0.5, 200.0);
            let release_ms = sample_at(params.release, i, 100.0).clamp(10.0, 2000.0);
            let makeup_db = sample_at(params.makeup, i, 0.0).clamp(-24.0, 24.0);
            let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);

            let in_sample = input_at(input, i);

            // Convert threshold and makeup from dB to linear
            let threshold_lin = db_to_linear(threshold_db);
            let makeup_lin = db_to_linear(makeup_db);

            // Calculate attack and release coefficients
            let attack_coeff = (-2.0 * std::f32::consts::PI * 1000.0 / (attack_ms * self.sample_rate)).exp();
            let release_coeff = (-2.0 * std::f32::consts::PI * 1000.0 / (release_ms * self.sample_rate)).exp();

            // Envelope follower (peak detection)
            let input_abs = in_sample.abs();
            if input_abs > self.envelope {
                // Attack phase
                self.envelope = attack_coeff * self.envelope + (1.0 - attack_coeff) * input_abs;
            } else {
                // Release phase
                self.envelope = release_coeff * self.envelope + (1.0 - release_coeff) * input_abs;
            }

            // Calculate gain reduction
            let gain = if self.envelope > threshold_lin {
                // Over threshold - apply compression
                let over_db = linear_to_db(self.envelope / threshold_lin);
                let reduced_db = over_db / ratio;
                let target_level = threshold_lin * db_to_linear(reduced_db);
                target_level / self.envelope.max(1e-10)
            } else {
                // Under threshold - no compression
                1.0
            };

            // Apply gain and makeup
            let compressed = in_sample * gain * makeup_lin;

            // Mix dry/wet
            let dry = 1.0 - mix;
            output[i] = in_sample * dry + compressed * mix;
        }
    }
}

/// Convert decibels to linear amplitude.
#[inline]
fn db_to_linear(db: f32) -> f32 {
    10.0_f32.powf(db / 20.0)
}

/// Convert linear amplitude to decibels.
#[inline]
fn linear_to_db(linear: f32) -> f32 {
    20.0 * linear.max(1e-10).log10()
}
