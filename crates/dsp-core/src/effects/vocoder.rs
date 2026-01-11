//! Vocoder effect with 16 frequency bands.
//!
//! Analyzes the spectrum of a modulator signal (voice) and applies
//! it to a carrier signal (synth), creating the classic robot voice.

use super::choir::FormantFilter;
use crate::common::{input_at, sample_at, Sample};

const VOCODER_BANDS: usize = 16;

/// 16-band vocoder effect.
///
/// Analyzes the modulator (typically voice) and applies its
/// spectral envelope to the carrier (typically a synth pad).
///
/// # Features
///
/// - 16 frequency bands from low to high
/// - Adjustable attack/release for envelope followers
/// - Formant shift for pitch adjustment
/// - Unvoiced detection for sibilants
/// - Emphasis control for presence
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{Vocoder, VocoderParams, VocoderInputs};
///
/// let mut vocoder = Vocoder::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// vocoder.process_block(&mut output, inputs, params);
/// ```
pub struct Vocoder {
    sample_rate: f32,
    mod_filters: [FormantFilter; VOCODER_BANDS],
    car_filters: [FormantFilter; VOCODER_BANDS],
    envelopes: [f32; VOCODER_BANDS],
    unvoiced_env: f32,
    hp_state: f32,
    hp_prev: f32,
    rng: u32,
}

/// Input signals for Vocoder.
pub struct VocoderInputs<'a> {
    /// Modulator input (voice/spectral source)
    pub modulator: Option<&'a [Sample]>,
    /// Carrier input (synth/tonal source)
    pub carrier: Option<&'a [Sample]>,
}

/// Parameters for Vocoder.
pub struct VocoderParams<'a> {
    /// Envelope attack in ms (2-300)
    pub attack: &'a [Sample],
    /// Envelope release in ms (10-1200)
    pub release: &'a [Sample],
    /// Low frequency bound in Hz (40-2000)
    pub low: &'a [Sample],
    /// High frequency bound in Hz (400-12000)
    pub high: &'a [Sample],
    /// Filter Q (0.4-8.0)
    pub q: &'a [Sample],
    /// Formant shift in semitones (-12 to +12)
    pub formant: &'a [Sample],
    /// High frequency emphasis (0-1)
    pub emphasis: &'a [Sample],
    /// Unvoiced (sibilant) mix (0-1)
    pub unvoiced: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
    /// Modulator input gain (0-4)
    pub mod_gain: &'a [Sample],
    /// Carrier input gain (0-4)
    pub car_gain: &'a [Sample],
}

impl Vocoder {
    /// Create a new vocoder.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            mod_filters: [FormantFilter::default(); VOCODER_BANDS],
            car_filters: [FormantFilter::default(); VOCODER_BANDS],
            envelopes: [0.0; VOCODER_BANDS],
            unvoiced_env: 0.0,
            hp_state: 0.0,
            hp_prev: 0.0,
            rng: 0x1234_5678,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Process a block of audio.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: VocoderInputs<'_>,
        params: VocoderParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        let bands = VOCODER_BANDS as f32;
        for i in 0..output.len() {
            let attack_ms = sample_at(params.attack, i, 25.0).clamp(2.0, 300.0);
            let release_ms = sample_at(params.release, i, 140.0).clamp(10.0, 1200.0);
            let low = sample_at(params.low, i, 120.0).clamp(40.0, 2000.0);
            let mut high = sample_at(params.high, i, 5000.0).clamp(400.0, 12000.0);
            if high <= low {
                high = (low * 1.5).min(12000.0);
            }
            let q = sample_at(params.q, i, 2.5).clamp(0.4, 8.0);
            let formant = sample_at(params.formant, i, 0.0).clamp(-12.0, 12.0);
            let emphasis = sample_at(params.emphasis, i, 0.4).clamp(0.0, 1.0);
            let unvoiced = sample_at(params.unvoiced, i, 0.0).clamp(0.0, 1.0);
            let mix = sample_at(params.mix, i, 0.8).clamp(0.0, 1.0);
            let mod_gain = sample_at(params.mod_gain, i, 1.0).clamp(0.0, 4.0);
            let car_gain = sample_at(params.car_gain, i, 1.0).clamp(0.0, 4.0);

            let mod_input = input_at(inputs.modulator, i) * mod_gain;
            let car_input = input_at(inputs.carrier, i) * car_gain;

            let attack = attack_ms * 0.001;
            let release = release_ms * 0.001;
            let attack_coeff = 1.0 - (-1.0 / (attack * self.sample_rate)).exp();
            let release_coeff = 1.0 - (-1.0 / (release * self.sample_rate)).exp();
            let shift = 2.0_f32.powf(formant / 12.0);
            let ratio = high / low;

            // Emphasis high-pass filter
            let emphasis_cutoff = 600.0 + emphasis * 3400.0;
            let hp_coeff = (-2.0 * std::f32::consts::PI * emphasis_cutoff / self.sample_rate).exp();
            let hp_out = mod_input - self.hp_prev + hp_coeff * self.hp_state;
            self.hp_prev = mod_input;
            self.hp_state = hp_out;
            let mod_emph = mod_input + hp_out * (emphasis * 0.7);

            // Unvoiced detection (high-frequency content)
            let unvoiced_attack = 0.004;
            let unvoiced_release = 0.06;
            let unvoiced_attack_coeff =
                1.0 - (-1.0 / (unvoiced_attack * self.sample_rate)).exp();
            let unvoiced_release_coeff =
                1.0 - (-1.0 / (unvoiced_release * self.sample_rate)).exp();
            let unvoiced_target = hp_out.abs();
            let unvoiced_coeff = if unvoiced_target > self.unvoiced_env {
                unvoiced_attack_coeff
            } else {
                unvoiced_release_coeff
            };
            self.unvoiced_env += unvoiced_coeff * (unvoiced_target - self.unvoiced_env);
            self.rng = self.rng.wrapping_mul(1664525).wrapping_add(1013904223);
            let noise = ((self.rng >> 9) as f32 / 8_388_607.0) * 2.0 - 1.0;
            let unvoiced_mix = noise * self.unvoiced_env * unvoiced * 0.45;

            // Process each band
            let mut wet = 0.0;
            for band in 0..VOCODER_BANDS {
                let t = band as f32 / (VOCODER_BANDS as f32 - 1.0);
                let freq = low * ratio.powf(t) * shift;
                let mod_band = self.mod_filters[band].process(mod_emph, freq, q, self.sample_rate);
                let car_band = self.car_filters[band].process(car_input, freq, q, self.sample_rate);
                let env = self.envelopes[band];
                let rectified = mod_band.abs();
                let coeff = if rectified > env {
                    attack_coeff
                } else {
                    release_coeff
                };
                let next_env = env + coeff * (rectified - env);
                self.envelopes[band] = next_env;
                wet += car_band * next_env;
            }

            let scaled = wet * (1.0 / bands);
            let dry = 1.0 - mix;
            output[i] = car_input * dry + (scaled + unvoiced_mix) * mix;
        }
    }
}
