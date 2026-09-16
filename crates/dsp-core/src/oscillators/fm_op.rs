//! FM synthesis operator module.
//!
//! A single FM operator with sine oscillator, ADSR envelope,
//! and self-feedback capability for complex timbres.

use crate::common::Sample;

/// Envelope stage for FM operator.
#[derive(Clone, Copy, PartialEq)]
enum FmEnvStage {
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
}

/// FM synthesis operator.
///
/// A single operator that can be used as a carrier (output) or
/// modulator (modulates another operator's phase).
///
/// # Features
///
/// - Sine wave oscillator with phase modulation input
/// - ADSR envelope with millisecond timing
/// - Self-feedback for richer timbres
/// - Frequency ratio for harmonic relationships
///
/// # FM Synthesis Basics
///
/// Connect multiple operators to create FM patches:
/// - **Carrier**: Operator whose output you hear
/// - **Modulator**: Operator that modulates a carrier's frequency
///
/// # Example
///
/// ```ignore
/// use dsp_core::oscillators::{FmOperator, FmOperatorParams, FmOperatorInputs};
///
/// let mut op = FmOperator::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// op.process_block(&mut output, inputs, params);
/// ```
pub struct FmOperator {
    sample_rate: f32,
    phase: f64,

    // Envelope state
    env_stage: FmEnvStage,
    env_level: f32,
    env_time: f32,

    // Feedback (2-sample buffer for stability)
    feedback_out: [f32; 2],
    feedback_idx: usize,

    // Gate edge detection
    prev_gate: f32,
}

/// Input signals for FM operator.
pub struct FmOperatorInputs<'a> {
    /// Pitch CV (1 V/octave from base frequency, like every sequencer and oscillator)
    pub pitch: Option<&'a [Sample]>,
    /// Gate signal for envelope
    pub gate: Option<&'a [Sample]>,
    /// FM input (audio-rate phase modulation)
    pub fm_in: Option<&'a [Sample]>,
    /// Modulation index CV, added directly to the `level` param (bipolar, ~-1..1)
    pub index_cv: Option<&'a [Sample]>,
}

/// Parameters for FM operator.
pub struct FmOperatorParams<'a> {
    /// Base frequency in Hz
    pub frequency: &'a [Sample],
    /// Frequency ratio (1.0 = unison, 2.0 = octave up)
    pub ratio: &'a [Sample],
    /// Output level (0-1, acts as modulation index when modulator)
    pub level: &'a [Sample],
    /// Self-feedback amount (0-1)
    pub feedback: &'a [Sample],
    /// Attack time in milliseconds
    pub attack: &'a [Sample],
    /// Decay time in milliseconds
    pub decay: &'a [Sample],
    /// Sustain level (0-1)
    pub sustain: &'a [Sample],
    /// Release time in milliseconds
    pub release: &'a [Sample],
}

impl FmOperator {
    /// Create a new FM operator.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phase: 0.0,
            env_stage: FmEnvStage::Idle,
            env_level: 0.0,
            env_time: 0.0,
            feedback_out: [0.0; 2],
            feedback_idx: 0,
            prev_gate: 0.0,
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
        inputs: FmOperatorInputs,
        params: FmOperatorParams,
    ) {
        let frames = output.len();
        let two_pi = std::f64::consts::TAU;

        for i in 0..frames {
            // Get parameters
            let base_freq = params.frequency[0].max(1.0);
            let ratio = params.ratio[0].max(0.01);
            let index_cv = inputs.index_cv.map_or(0.0, |c| c[i.min(c.len() - 1)]);
            let level = (params.level[0] + index_cv).clamp(0.0, 1.0);
            let feedback = params.feedback[0].clamp(0.0, 1.0);
            let attack_ms = params.attack[0].max(0.1);
            let decay_ms = params.decay[0].max(0.1);
            let sustain = params.sustain[0].clamp(0.0, 1.0);
            let release_ms = params.release[0].max(0.1);

            // Get pitch CV (1 V/octave)
            let pitch_cv = inputs.pitch.map_or(0.0, |p| p[i.min(p.len() - 1)]);

            // Calculate frequency: base * ratio * 2^pitch
            let freq = base_freq * ratio * (2.0_f32).powf(pitch_cv);

            // Get gate and detect edges
            let gate = inputs.gate.map_or(0.0, |g| g[i.min(g.len() - 1)]);
            let gate_on = gate > 0.5;
            let gate_rising = gate > 0.5 && self.prev_gate <= 0.5;
            let gate_falling = gate <= 0.5 && self.prev_gate > 0.5;
            self.prev_gate = gate;

            // Envelope state machine
            if gate_rising {
                self.env_stage = FmEnvStage::Attack;
                self.env_time = 0.0;
            } else if gate_falling && self.env_stage != FmEnvStage::Idle {
                self.env_stage = FmEnvStage::Release;
                self.env_time = 0.0;
            }

            // Calculate envelope
            let dt = 1000.0 / self.sample_rate; // time step in ms
            match self.env_stage {
                FmEnvStage::Idle => {
                    self.env_level = 0.0;
                }
                FmEnvStage::Attack => {
                    self.env_time += dt;
                    let attack_rate = 1.0 / attack_ms;
                    self.env_level += attack_rate * dt;
                    if self.env_level >= 1.0 {
                        self.env_level = 1.0;
                        self.env_stage = FmEnvStage::Decay;
                        self.env_time = 0.0;
                    }
                }
                FmEnvStage::Decay => {
                    self.env_time += dt;
                    let decay_rate = (1.0 - sustain) / decay_ms;
                    self.env_level -= decay_rate * dt;
                    if self.env_level <= sustain {
                        self.env_level = sustain;
                        self.env_stage = FmEnvStage::Sustain;
                    }
                }
                FmEnvStage::Sustain => {
                    self.env_level = sustain;
                    if !gate_on {
                        self.env_stage = FmEnvStage::Release;
                        self.env_time = 0.0;
                    }
                }
                FmEnvStage::Release => {
                    self.env_time += dt;
                    let release_rate = self.env_level / release_ms.max(0.1);
                    self.env_level -= release_rate * dt;
                    if self.env_level <= 0.001 {
                        self.env_level = 0.0;
                        self.env_stage = FmEnvStage::Idle;
                    }
                }
            }

            // Get FM input
            let fm_mod = inputs.fm_in.map_or(0.0, |fm| fm[i.min(fm.len() - 1)]);

            // Get feedback (average of last 2 samples for stability)
            let fb = (self.feedback_out[0] + self.feedback_out[1]) * 0.5 * feedback * std::f32::consts::PI;

            // Calculate phase increment with FM
            let phase_inc = (freq as f64 / self.sample_rate as f64) * two_pi;
            let fm_amount = (fm_mod + fb) as f64;

            // Generate sine with FM
            let out = (self.phase + fm_amount).sin() as f32;

            // Update phase
            self.phase += phase_inc;
            if self.phase >= two_pi {
                self.phase -= two_pi;
            }

            // Store for feedback
            self.feedback_out[self.feedback_idx] = out;
            self.feedback_idx = (self.feedback_idx + 1) % 2;

            // Apply envelope and level
            output[i] = out * self.env_level * level;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SR: f32 = 48_000.0;

    /// Frequency of a sine from its rising zero crossings (linear interpolation).
    fn frequency(x: &[f32]) -> f32 {
        let crossings: Vec<f32> = x
            .windows(2)
            .enumerate()
            .filter(|(_, w)| w[0] < 0.0 && w[1] >= 0.0)
            .map(|(i, w)| i as f32 + w[0] / (w[0] - w[1]))
            .collect();
        (crossings.len() - 1) as f32 * SR / (crossings[crossings.len() - 1] - crossings[0])
    }

    fn tone(pitch_cv: f32) -> f32 {
        let mut op = FmOperator::new(SR);
        let mut out = vec![0.0; 24_000];
        let gate = vec![1.0; out.len()];
        let pitch = vec![pitch_cv; out.len()];
        op.process_block(
            &mut out,
            FmOperatorInputs { pitch: Some(&pitch), gate: Some(&gate), fm_in: None, index_cv: None },
            FmOperatorParams {
                frequency: &[220.0],
                ratio: &[1.0],
                level: &[1.0],
                feedback: &[0.0],
                attack: &[1.0],
                decay: &[1.0],
                sustain: &[1.0],
                release: &[10.0],
            },
        );
        frequency(&out[4_800..])
    }

    /// Pitch CV is 1 V/octave like every sequencer: +1 is one octave up, not one semitone.
    #[test]
    fn pitch_cv_is_one_volt_per_octave() {
        let (f0, f1, f12) = (tone(0.0), tone(1.0), tone(7.0 / 12.0));
        assert!((f0 - 220.0).abs() < 0.5, "base pitch {f0} Hz");
        assert!((f1 - 440.0).abs() < 1.0, "+1 V must be one octave up ({f1} Hz)");
        assert!((f12 - 329.63).abs() < 1.0, "+7/12 V must be a fifth up ({f12} Hz)");
    }
}
