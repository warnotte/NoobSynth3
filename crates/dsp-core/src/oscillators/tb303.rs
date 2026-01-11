//! Roland TB-303 bass synthesizer emulation.
//!
//! Emulates the iconic acid bass sound with its characteristic
//! diode ladder filter, accent, and glide features.

use crate::common::{input_at, poly_blep, sample_at, Sample};

/// Roland TB-303 bass synthesizer emulation.
///
/// The TB-303 "Bassline" is famous for its squelchy acid sound,
/// created by its unique 3-pole diode ladder filter and envelope.
///
/// # Features
///
/// - Sawtooth or square wave oscillator with polyBLEP
/// - 3-pole (18dB/oct) diode ladder filter
/// - Decay envelope with filter modulation
/// - Accent for extra punch and brightness
/// - Glide (portamento) for sliding notes
///
/// # Accent Behavior
///
/// When velocity > 0.7, the accent is triggered, which:
/// - Boosts the filter envelope
/// - Increases output amplitude
/// - Creates the characteristic "squelch"
///
/// # Example
///
/// ```ignore
/// use dsp_core::oscillators::{Tb303, Tb303Params, Tb303Inputs, Tb303Outputs};
///
/// let mut tb = Tb303::new(44100.0);
/// let mut audio = [0.0f32; 128];
/// let mut env = [0.0f32; 128];
///
/// tb.process_block(
///     Tb303Outputs { audio: &mut audio, env_out: &mut env },
///     inputs,
///     params,
/// );
/// ```
pub struct Tb303 {
    sample_rate: f32,

    // Oscillator
    phase: f32,
    current_freq: f32,
    target_freq: f32,

    // Filter (3-pole diode ladder = 18dB/oct)
    stage1: f32,
    stage2: f32,
    stage3: f32,

    // Envelopes
    filter_env: f32,
    accent_env: f32,
    amp_env: f32,

    // Gate state
    gate_on: bool,
    last_gate: f32,
    last_velocity: f32,
}

/// Parameters for TB-303.
pub struct Tb303Params<'a> {
    /// Waveform: 0 = sawtooth, 1 = square
    pub waveform: &'a [Sample],
    /// Filter cutoff frequency in Hz
    pub cutoff: &'a [Sample],
    /// Filter resonance (0-1)
    pub resonance: &'a [Sample],
    /// Envelope decay time in seconds
    pub decay: &'a [Sample],
    /// Filter envelope modulation depth (0-1)
    pub envmod: &'a [Sample],
    /// Accent amount (0-1)
    pub accent: &'a [Sample],
    /// Glide time in seconds
    pub glide: &'a [Sample],
}

/// Input signals for TB-303.
pub struct Tb303Inputs<'a> {
    /// Pitch CV (1V/octave, 0V = A2 = 110Hz)
    pub pitch: Option<&'a [Sample]>,
    /// Gate signal (triggers envelope)
    pub gate: Option<&'a [Sample]>,
    /// Velocity (>0.7 triggers accent)
    pub velocity: Option<&'a [Sample]>,
    /// External cutoff CV modulation
    pub cutoff_cv: Option<&'a [Sample]>,
}

/// Output buffers for TB-303.
pub struct Tb303Outputs<'a> {
    /// Main audio output
    pub audio: &'a mut [Sample],
    /// Filter envelope output (for visualization or modulation)
    pub env_out: &'a mut [Sample],
}

impl Tb303 {
    /// Create a new TB-303 synthesizer.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            phase: 0.0,
            current_freq: 110.0,
            target_freq: 110.0,
            stage1: 0.0,
            stage2: 0.0,
            stage3: 0.0,
            filter_env: 0.0,
            accent_env: 0.0,
            amp_env: 0.0,
            gate_on: false,
            last_gate: 0.0,
            last_velocity: 0.0,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Process 3-pole diode ladder filter (18dB/oct).
    ///
    /// This is the characteristic TB-303 filter sound.
    fn process_diode_ladder(&mut self, input: f32, cutoff: f32, reso: f32) -> f32 {
        // Normalize cutoff to coefficient
        let f = (std::f32::consts::PI * cutoff / self.sample_rate).tan();
        let f = f / (1.0 + f); // One-pole coefficient

        // Feedback for resonance (3-pole feedback)
        let feedback = reso * 3.8 * self.stage3;

        // Input with feedback and saturation
        let x = (input - feedback).tanh();

        // Three cascaded one-pole filters (18dB/oct)
        self.stage1 += f * (x - self.stage1);
        self.stage2 += f * (self.stage1 - self.stage2);
        self.stage3 += f * (self.stage2 - self.stage3);

        // Soft saturation on output
        (self.stage3 * 1.2).tanh()
    }

    /// Process a block of audio.
    pub fn process_block(
        &mut self,
        outputs: Tb303Outputs<'_>,
        inputs: Tb303Inputs<'_>,
        params: Tb303Params<'_>,
    ) {
        let len = outputs.audio.len().min(outputs.env_out.len());
        if len == 0 {
            return;
        }

        let base_cutoff = sample_at(params.cutoff, 0, 800.0).clamp(40.0, 12000.0);
        let resonance = sample_at(params.resonance, 0, 0.3).clamp(0.0, 1.0);
        let decay_time = sample_at(params.decay, 0, 0.3).clamp(0.01, 2.0);
        let envmod = sample_at(params.envmod, 0, 0.5).clamp(0.0, 1.0);
        let accent_amount = sample_at(params.accent, 0, 0.6).clamp(0.0, 1.0);
        let glide_time = sample_at(params.glide, 0, 0.02).clamp(0.0, 0.5);
        let waveform = sample_at(params.waveform, 0, 0.0);

        // Envelope coefficients
        let decay_coeff = (-1.0 / (decay_time * self.sample_rate)).exp();
        let accent_decay_coeff = (-1.0 / (0.05 * self.sample_rate)).exp(); // 50ms
        let amp_attack_coeff = 1.0 - (-1.0 / (0.003 * self.sample_rate)).exp(); // 3ms
        let amp_release_coeff = (-1.0 / (0.01 * self.sample_rate)).exp(); // 10ms

        // Glide coefficient
        let glide_coeff = if glide_time > 0.001 {
            1.0 - (-1.0 / (glide_time * self.sample_rate)).exp()
        } else {
            1.0
        };

        for i in 0..len {
            let pitch_cv = input_at(inputs.pitch, i);
            let gate = input_at(inputs.gate, i);
            let velocity = input_at(inputs.velocity, i).clamp(0.0, 1.0);
            let cutoff_cv = input_at(inputs.cutoff_cv, i);

            // Gate edge detection
            let gate_rising = gate > 0.5 && self.last_gate <= 0.5;
            let gate_falling = gate <= 0.5 && self.last_gate > 0.5;
            self.last_gate = gate;

            // On gate rising: set target frequency and trigger envelopes
            if gate_rising {
                // Convert V/oct to Hz (A2 = 110Hz at 0V)
                self.target_freq = 110.0 * 2.0_f32.powf(pitch_cv);
                self.gate_on = true;
                self.last_velocity = velocity;

                // Trigger filter envelope
                self.filter_env = 1.0;

                // Trigger accent envelope if velocity > 0.7
                if velocity > 0.7 {
                    self.accent_env = 1.0;
                }
            }

            if gate_falling {
                self.gate_on = false;
            }

            // Glide (portamento)
            self.current_freq += (self.target_freq - self.current_freq) * glide_coeff;
            self.current_freq = self.current_freq.clamp(20.0, 20000.0);

            // Envelope decays
            self.filter_env *= decay_coeff;
            self.accent_env *= accent_decay_coeff;

            // Amp envelope
            if self.gate_on {
                self.amp_env += (1.0 - self.amp_env) * amp_attack_coeff;
            } else {
                self.amp_env *= amp_release_coeff;
            }

            // Oscillator
            let dt = self.current_freq / self.sample_rate;
            self.phase += dt;
            if self.phase >= 1.0 {
                self.phase -= 1.0;
            }

            // Waveform with polyBLEP anti-aliasing
            let osc_out = if waveform < 0.5 {
                // Sawtooth
                let mut saw = 2.0 * self.phase - 1.0;
                saw -= poly_blep(self.phase, dt);
                saw
            } else {
                // Square (50% duty)
                let mut square = if self.phase < 0.5 { 1.0 } else { -1.0 };
                square += poly_blep(self.phase, dt);
                square -= poly_blep((self.phase + 0.5).fract(), dt);
                square
            };

            // Calculate filter cutoff with envelope modulation
            let accent_boost = self.accent_env * accent_amount * 2.0; // 2 octaves
            let env_mod_octaves = self.filter_env * envmod * 4.0 + accent_boost;
            let modulated_cutoff = base_cutoff * 2.0_f32.powf(env_mod_octaves + cutoff_cv);
            let final_cutoff = modulated_cutoff.clamp(40.0, 18000.0);

            // Apply filter
            let filtered = self.process_diode_ladder(osc_out, final_cutoff, resonance);

            // Apply VCA with accent amplitude boost
            let accent_amp_boost = if self.last_velocity > 0.7 { 1.0 + accent_amount * 0.5 } else { 1.0 };
            let audio_out = filtered * self.amp_env * accent_amp_boost;

            outputs.audio[i] = audio_out.clamp(-1.0, 1.0);
            outputs.env_out[i] = self.filter_env;
        }
    }
}
