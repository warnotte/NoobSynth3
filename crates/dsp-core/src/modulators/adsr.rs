//! ADSR Envelope Generator.
//!
//! Classic four-stage envelope for shaping amplitude,
//! filter cutoff, or other parameters over time.

use crate::common::{input_at, sample_at, Sample};

/// ADSR envelope generator.
///
/// Generates a four-stage envelope triggered by a gate signal:
///
/// 1. **Attack**: Rise from 0 to 1
/// 2. **Decay**: Fall from 1 to sustain level
/// 3. **Sustain**: Hold at sustain level while gate is high
/// 4. **Release**: Fall from current level to 0 when gate goes low
///
/// # Example
///
/// ```ignore
/// use dsp_core::modulators::{Adsr, AdsrParams, AdsrInputs};
///
/// let mut adsr = Adsr::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// adsr.process_block(&mut output, inputs, params);
/// ```
pub struct Adsr {
    sample_rate: f32,
    stage: u8,
    env: f32,
    last_gate: f32,
    release_step: f32,
}

/// Input signals for ADSR.
pub struct AdsrInputs<'a> {
    /// Gate input (envelope active while > 0.5)
    pub gate: Option<&'a [Sample]>,
}

/// Parameters for ADSR.
pub struct AdsrParams<'a> {
    /// Attack time in seconds (0.001-10)
    pub attack: &'a [Sample],
    /// Decay time in seconds (0.001-10)
    pub decay: &'a [Sample],
    /// Sustain level (0-1)
    pub sustain: &'a [Sample],
    /// Release time in seconds (0.001-10)
    pub release: &'a [Sample],
}

impl Adsr {
    /// Create a new ADSR envelope.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            stage: 0, // 0=idle, 1=attack, 2=decay, 3=sustain, 4=release
            env: 0.0,
            last_gate: 0.0,
            release_step: 0.0,
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
        inputs: AdsrInputs<'_>,
        params: AdsrParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        for i in 0..output.len() {
            let gate = input_at(inputs.gate, i);
            let attack = sample_at(params.attack, i, 0.02);
            let decay = sample_at(params.decay, i, 0.2);
            let sustain = sample_at(params.sustain, i, 0.65);
            let release = sample_at(params.release, i, 0.4);

            let sustain_level = sustain.clamp(0.0, 1.0);

            // Gate rising edge -> start attack
            if gate > 0.5 && self.last_gate <= 0.5 {
                self.stage = 1;
                self.release_step = 0.0;
            }
            // Gate falling edge -> start release
            else if gate <= 0.5 && self.last_gate > 0.5 {
                if self.env > 0.0 {
                    let release_time = release.max(0.001);
                    self.release_step = self.env / (release_time * self.sample_rate);
                    self.stage = 4;
                } else {
                    self.stage = 0;
                }
            }
            self.last_gate = gate;

            // Process current stage
            if self.stage == 1 {
                // Attack
                let attack_time = attack.max(0.001);
                let attack_step = (1.0 - self.env) / (attack_time * self.sample_rate);
                self.env += attack_step;
                if self.env >= 1.0 {
                    self.env = 1.0;
                    self.stage = 2;
                }
            } else if self.stage == 2 {
                // Decay
                let decay_time = decay.max(0.001);
                let decay_step = (1.0 - sustain_level) / (decay_time * self.sample_rate);
                self.env -= decay_step;
                if self.env <= sustain_level {
                    self.env = sustain_level;
                    self.stage = 3;
                }
            } else if self.stage == 3 {
                // Sustain
                self.env = sustain_level;
            } else if self.stage == 4 {
                // Release
                if self.release_step <= 0.0 {
                    self.env = 0.0;
                    self.stage = 0;
                } else {
                    self.env -= self.release_step;
                    if self.env <= 0.0 {
                        self.env = 0.0;
                        self.stage = 0;
                    }
                }
            } else {
                // Idle
                self.env = 0.0;
            }

            output[i] = self.env;
        }
    }
}
