// Resonator - Sympathetic resonance module inspired by Mutable Instruments Rings
// Modes: Modal (bells/plates), Sympathetic Strings, Inharmonic

use std::f32::consts::PI;

const MAX_VOICES: usize = 8;
const NUM_MODES: usize = 16;

#[derive(Clone, Copy, PartialEq)]
pub enum ResonatorMode {
    Modal,       // Bell/plate-like with harmonic partials
    Sympathetic, // Sympathetic strings
    Inharmonic,  // Metallic, inharmonic partials
}

pub struct Resonator {
    sample_rate: f32,

    // Modal resonators (pairs for each mode)
    modal_state: [[(f32, f32); NUM_MODES]; MAX_VOICES],

    // Comb filters for sympathetic mode
    comb_lines: [[f32; 2048]; MAX_VOICES],
    comb_pos: [usize; MAX_VOICES],

    // Envelope followers per voice
    env_followers: [f32; MAX_VOICES],

    // Damping state
    damper_state: f32,

    // Previous input for excitation detection
    prev_input: f32,
    excitation_env: f32,

    // Internal exciter
    noise_state: u32,
    click_phase: f32,
}

#[derive(Clone, Copy)]
pub struct ResonatorParams {
    pub frequency: f32,      // Base frequency (Hz)
    pub structure: f32,      // 0-1, harmonic structure/spread
    pub brightness: f32,     // 0-1, high frequency damping
    pub damping: f32,        // 0-1, overall decay time
    pub position: f32,       // 0-1, excitation position
    pub mode: i32,           // 0=Modal, 1=Sympathetic, 2=Inharmonic
    pub polyphony: i32,      // 1-4 voices
    pub internal_exc: f32,   // 0-1, internal exciter level
    pub chorus: f32,         // 0-1, detune between voices
}

pub struct ResonatorInputs {
    pub audio_in: f32,      // External excitation
    pub pitch_cv: f32,      // V/Oct pitch CV
    pub gate: f32,          // Gate for internal exciter
    pub strum: f32,         // Strum trigger for polyphonic
    pub damp: f32,          // Damper CV
}

impl Resonator {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            modal_state: [[(0.0, 0.0); NUM_MODES]; MAX_VOICES],
            comb_lines: [[0.0; 2048]; MAX_VOICES],
            comb_pos: [0; MAX_VOICES],
            env_followers: [0.0; MAX_VOICES],
            damper_state: 0.0,
            prev_input: 0.0,
            excitation_env: 0.0,
            noise_state: 54321,
            click_phase: 1.0,
        }
    }

    fn noise(&mut self) -> f32 {
        self.noise_state = self.noise_state.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0
    }

    fn get_mode_ratios(&self, mode: ResonatorMode, structure: f32) -> [f32; NUM_MODES] {
        let mut ratios = [1.0; NUM_MODES];

        match mode {
            ResonatorMode::Modal => {
                // Harmonic-ish ratios with structure control
                // Structure 0 = pure harmonics, 1 = bell-like
                for i in 0..NUM_MODES {
                    let harmonic = (i + 1) as f32;
                    let bell_ratio = (harmonic * harmonic * 0.5 + harmonic * 0.5).sqrt();
                    ratios[i] = harmonic * (1.0 - structure) + bell_ratio * structure;
                }
            }
            ResonatorMode::Sympathetic => {
                // String-like with octaves and fifths
                let intervals = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0,
                                 1.25, 1.75, 2.25, 3.5, 4.5, 5.5, 7.0, 8.0];
                for i in 0..NUM_MODES {
                    let spread = 1.0 + structure * (intervals[i] - 1.0);
                    ratios[i] = spread;
                }
            }
            ResonatorMode::Inharmonic => {
                // Metallic/inharmonic ratios (like a metal bar)
                for i in 0..NUM_MODES {
                    let n = (i + 1) as f32;
                    // Inharmonic formula based on stiffness
                    let inharmonic = n * (1.0 + structure * 0.1 * n * n);
                    ratios[i] = inharmonic;
                }
            }
        }

        ratios
    }

    fn get_mode_amplitudes(&self, position: f32) -> [f32; NUM_MODES] {
        let mut amps = [0.0; NUM_MODES];

        for i in 0..NUM_MODES {
            let mode_num = (i + 1) as f32;
            // Amplitude depends on excitation position (like striking a string)
            let node_pattern = (mode_num * PI * position).sin().abs();
            // Natural falloff for higher modes
            let falloff = 1.0 / (1.0 + i as f32 * 0.3);
            amps[i] = node_pattern * falloff;
        }

        amps
    }

    fn process_modal(&mut self,
                     voice: usize,
                     excitation: f32,
                     freq: f32,
                     ratios: &[f32; NUM_MODES],
                     amps: &[f32; NUM_MODES],
                     brightness: f32,
                     damping: f32) -> f32 {
        let mut output = 0.0;

        for i in 0..NUM_MODES {
            let mode_freq = freq * ratios[i];
            if mode_freq > self.sample_rate * 0.4 {
                continue; // Skip modes above Nyquist
            }

            let w = 2.0 * PI * mode_freq / self.sample_rate;
            let cos_w = w.cos();
            let sin_w = w.sin();

            // Decay depends on mode number and damping parameter
            let mode_damping = damping * (1.0 - (i as f32 * 0.02).min(0.3));
            // Brightness affects high mode damping
            let brightness_factor = 1.0 - (1.0 - brightness) * (i as f32 / NUM_MODES as f32);
            let decay = (0.9990 + mode_damping * 0.0009) * brightness_factor;

            let (s1, s2) = self.modal_state[voice][i];
            let new_s1 = decay * (cos_w * s1 - sin_w * s2) + excitation * amps[i];
            let new_s2 = decay * (sin_w * s1 + cos_w * s2);
            self.modal_state[voice][i] = (new_s1, new_s2);

            output += new_s1;
        }

        output * 0.15
    }

    fn process_comb(&mut self,
                    voice: usize,
                    excitation: f32,
                    freq: f32,
                    brightness: f32,
                    damping: f32) -> f32 {
        let delay_samples = (self.sample_rate / freq).max(2.0).min(2047.0);
        let delay_int = delay_samples as usize;
        let delay_frac = delay_samples - delay_int as f32;

        // Read with interpolation
        let pos = self.comb_pos[voice];
        let read_pos1 = (pos + 2048 - delay_int) % 2048;
        let read_pos2 = (pos + 2048 - delay_int - 1) % 2048;
        let delayed = self.comb_lines[voice][read_pos1] * (1.0 - delay_frac)
                    + self.comb_lines[voice][read_pos2] * delay_frac;

        // Feedback with damping
        let feedback = 0.95 + damping * 0.049;
        // Low-pass for brightness
        let lp_coef = 0.3 + brightness * 0.6;
        let filtered = delayed * lp_coef + self.env_followers[voice] * (1.0 - lp_coef);
        self.env_followers[voice] = filtered;

        let new_val = excitation + filtered * feedback;
        self.comb_lines[voice][pos] = new_val.clamp(-2.0, 2.0);
        self.comb_pos[voice] = (pos + 1) % 2048;

        delayed * 0.5
    }

    pub fn process(&mut self, params: ResonatorParams, inputs: ResonatorInputs) -> f32 {
        let mode = match params.mode {
            0 => ResonatorMode::Modal,
            1 => ResonatorMode::Sympathetic,
            _ => ResonatorMode::Inharmonic,
        };

        // Base frequency with CV
        let base_freq = params.frequency * (2.0_f32).powf(inputs.pitch_cv);

        // Damper
        let damp_cv = inputs.damp.max(0.0);
        let effective_damping = params.damping * (1.0 - damp_cv);

        // Excitation from input or internal
        let input_excitation = inputs.audio_in;

        // Internal exciter (click + noise burst on gate)
        let gate_on = inputs.gate > 0.5;
        if gate_on && self.click_phase >= 1.0 {
            self.click_phase = 0.0;
        }

        let mut internal_exc = 0.0;
        if self.click_phase < 1.0 {
            // Short click/impulse
            let click = if self.click_phase < 0.1 {
                (self.click_phase * 10.0 * PI).sin()
            } else {
                0.0
            };
            // Noise burst
            let noise_env = (-self.click_phase * 20.0).exp();
            let noise = self.noise() * noise_env * 0.5;

            internal_exc = (click + noise) * params.internal_exc;
            self.click_phase += 1.0 / (self.sample_rate * 0.05); // 50ms burst
        }

        let excitation = input_excitation + internal_exc;

        // Track excitation level
        let exc_level = excitation.abs();
        self.excitation_env = self.excitation_env * 0.999 + exc_level * 0.001;

        // Get mode ratios and amplitudes
        let ratios = self.get_mode_ratios(mode, params.structure);
        let amps = self.get_mode_amplitudes(params.position);

        // Process voices
        let num_voices = (params.polyphony as usize).clamp(1, MAX_VOICES);
        let mut output = 0.0;

        for v in 0..num_voices {
            // Detune for chorus effect
            let detune = if num_voices > 1 {
                let detune_amt = params.chorus * 0.02;
                let voice_offset = (v as f32 / (num_voices - 1) as f32) - 0.5;
                voice_offset * detune_amt
            } else {
                0.0
            };
            let voice_freq = base_freq * (2.0_f32).powf(detune);

            // Distribute excitation across voices
            let voice_exc = excitation / (num_voices as f32).sqrt();

            let voice_out = match mode {
                ResonatorMode::Modal | ResonatorMode::Inharmonic => {
                    self.process_modal(v, voice_exc, voice_freq, &ratios, &amps,
                                       params.brightness, effective_damping)
                }
                ResonatorMode::Sympathetic => {
                    // Use comb filter for sympathetic strings
                    let mut comb_out = 0.0;
                    for i in 0..4.min(NUM_MODES) {
                        let string_freq = voice_freq * ratios[i];
                        comb_out += self.process_comb(v, voice_exc * amps[i], string_freq,
                                                      params.brightness, effective_damping)
                                    * (1.0 / (i + 1) as f32);
                    }
                    comb_out
                }
            };

            output += voice_out;
        }

        // Apply damper
        if damp_cv > 0.1 {
            self.damper_state = self.damper_state * (1.0 - damp_cv * 0.1) + output * damp_cv * 0.1;
            output *= 1.0 - damp_cv * 0.8;
        }

        // Soft limit
        (output * 1.2).tanh()
    }

    pub fn reset(&mut self) {
        self.modal_state = [[(0.0, 0.0); NUM_MODES]; MAX_VOICES];
        self.comb_lines = [[0.0; 2048]; MAX_VOICES];
        self.comb_pos = [0; MAX_VOICES];
        self.env_followers = [0.0; MAX_VOICES];
        self.damper_state = 0.0;
        self.prev_input = 0.0;
        self.excitation_env = 0.0;
        self.click_phase = 1.0;
    }
}
