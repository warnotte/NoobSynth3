//! Voltage Controlled Oscillator (VCO).
//!
//! The main oscillator module with support for multiple waveforms,
//! unison voices, FM synthesis, sync, and sub-oscillator.

use crate::common::{input_at, poly_blep, sample_at, Sample};

/// Main VCO (Voltage Controlled Oscillator).
///
/// Features:
/// - 4 waveforms: sine, triangle, sawtooth, pulse (with PWM)
/// - Up to 4 unison voices with detune
/// - Linear and exponential FM
/// - Hard sync input
/// - Sub-oscillator (1 or 2 octaves down)
/// - Anti-aliased using polyBLEP
///
/// # Example
///
/// ```ignore
/// use dsp_core::oscillators::{Vco, VcoParams, VcoInputs};
///
/// let mut vco = Vco::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// let freq = [440.0; 128];
/// let wave = [2.0; 128]; // sawtooth
/// // ... setup other params
///
/// vco.process_block(&mut output, None, None, inputs, params);
/// ```
pub struct Vco {
    sample_rate: f32,
    last_sync: f32,
    pwm_smooth: f32,
    phases: [f32; 4],
    sub_phases: [f32; 4],
    tri_states: [f32; 4],
    voice_count: usize,
    voice_offsets: [f32; 4],
}

/// Parameters for VCO processing.
///
/// All parameter buffers can be single-value (constant) or per-sample.
pub struct VcoParams<'a> {
    /// Base frequency in Hz
    pub base_freq: &'a [Sample],
    /// Waveform select: 0=sine, 1=triangle, 2=saw, 3=pulse
    pub waveform: &'a [Sample],
    /// Pulse width (0.05 to 0.95, only for pulse wave)
    pub pwm: &'a [Sample],
    /// Linear FM depth (Hz per unit input)
    pub fm_lin_depth: &'a [Sample],
    /// Exponential FM depth (octaves per unit input)
    pub fm_exp_depth: &'a [Sample],
    /// Number of unison voices (1-4)
    pub unison: &'a [Sample],
    /// Detune amount in cents for unison spread
    pub detune: &'a [Sample],
    /// Sub-oscillator mix (0.0 to 1.0)
    pub sub_mix: &'a [Sample],
    /// Sub-oscillator octave (1.0 = -1 oct, 2.0 = -2 oct)
    pub sub_oct: &'a [Sample],
}

/// Input signals for VCO modulation.
pub struct VcoInputs<'a> {
    /// Pitch CV (1V/octave, added to base frequency)
    pub pitch: Option<&'a [Sample]>,
    /// Linear FM input
    pub fm_lin: Option<&'a [Sample]>,
    /// Audio-rate FM input
    pub fm_audio: Option<&'a [Sample]>,
    /// Exponential FM input
    pub fm_exp: Option<&'a [Sample]>,
    /// PWM modulation input
    pub pwm: Option<&'a [Sample]>,
    /// Hard sync input (resets phase on rising edge)
    pub sync: Option<&'a [Sample]>,
}

impl Vco {
    /// Create a new VCO at the given sample rate.
    pub fn new(sample_rate: f32) -> Self {
        let mut phases = [0.0; 4];
        let mut sub_phases = [0.0; 4];
        let len = phases.len() as f32;
        for (index, phase) in phases.iter_mut().enumerate() {
            *phase = index as f32 / len;
            sub_phases[index] = *phase;
        }
        let mut vco = Self {
            sample_rate: sample_rate.max(1.0),
            last_sync: 0.0,
            pwm_smooth: 0.5,
            phases,
            sub_phases,
            tri_states: [0.0; 4],
            voice_count: 1,
            voice_offsets: [0.0; 4],
        };
        vco.update_voice_offsets(1.0);
        vco
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    fn update_voice_offsets(&mut self, voices: f32) {
        let count = voices.round().clamp(1.0, 4.0) as usize;
        self.voice_count = count;
        if count == 1 {
            self.voice_offsets[0] = 0.0;
            return;
        }
        let step = 2.0 / (count as f32 - 1.0);
        for i in 0..count {
            self.voice_offsets[i] = -1.0 + step * i as f32;
        }
    }

    /// Process a block of audio.
    ///
    /// # Arguments
    ///
    /// * `output` - Main audio output buffer
    /// * `sub_output` - Optional sub-oscillator output
    /// * `sync_output` - Optional sync pulse output
    /// * `inputs` - Modulation inputs
    /// * `params` - Processing parameters
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        mut sub_output: Option<&mut [Sample]>,
        mut sync_output: Option<&mut [Sample]>,
        inputs: VcoInputs<'_>,
        params: VcoParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        let wave_index = params.waveform.get(0).copied().unwrap_or(2.0);
        let requested_voices = params.unison.get(0).copied().unwrap_or(1.0);
        if requested_voices.round() as usize != self.voice_count {
            self.update_voice_offsets(requested_voices);
        }

        let pwm_coeff = 1.0 - (-1.0 / (0.004 * self.sample_rate)).exp();

        let mut sub_buffer = sub_output.as_deref_mut();
        let mut sync_buffer = sync_output.as_deref_mut();
        for i in 0..output.len() {
            let base = sample_at(params.base_freq, i, 220.0);
            let pitch = input_at(inputs.pitch, i);
            let fm_lin = input_at(inputs.fm_lin, i) + input_at(inputs.fm_audio, i);
            let fm_exp = input_at(inputs.fm_exp, i);
            let pwm_mod = input_at(inputs.pwm, i);
            let sync = input_at(inputs.sync, i);
            let pwm_base = sample_at(params.pwm, i, 0.5);
            let lin_depth = sample_at(params.fm_lin_depth, i, 0.0);
            let exp_depth = sample_at(params.fm_exp_depth, i, 0.0);
            let detune_cents = sample_at(params.detune, i, 0.0);
            let sub_mix = sample_at(params.sub_mix, i, 0.0).clamp(0.0, 1.0);
            let sub_oct = sample_at(params.sub_oct, i, 1.0).clamp(1.0, 2.0);

            // Hard sync detection
            if sync > 0.5 && self.last_sync <= 0.5 {
                for phase in self.phases.iter_mut().take(self.voice_count) {
                    *phase = 0.0;
                }
                for phase in self.sub_phases.iter_mut().take(self.voice_count) {
                    *phase = 0.0;
                }
                for state in self.tri_states.iter_mut().take(self.voice_count) {
                    *state = 0.0;
                }
            }
            self.last_sync = sync;

            // Calculate frequency with FM
            let exp_offset = pitch + fm_exp * exp_depth;
            let mut frequency = base * 2.0_f32.powf(exp_offset);
            frequency += fm_lin * lin_depth;
            if !frequency.is_finite() || frequency < 0.0 {
                frequency = 0.0;
            }
            let pwm_target = (pwm_base + pwm_mod * 0.5).clamp(0.05, 0.95);
            self.pwm_smooth += (pwm_target - self.pwm_smooth) * pwm_coeff;

            let sub_div = if sub_oct >= 1.5 { 4.0 } else { 2.0 };
            let mut sample = 0.0;
            let mut sub_sample = 0.0;
            let mut sync_pulse = 0.0;

            // Process each unison voice
            for v in 0..self.voice_count {
                let offset = self.voice_offsets[v];
                let detune_factor = 2.0_f32.powf((detune_cents * offset) / 1200.0);
                let voice_freq = frequency * detune_factor;
                let dt = (voice_freq / self.sample_rate).min(1.0);

                let mut next_phase = self.phases[v] + voice_freq / self.sample_rate;
                if next_phase >= 1.0 {
                    next_phase -= next_phase.floor();
                    sync_pulse = 1.0;
                }
                self.phases[v] = next_phase;
                let phase = next_phase;

                // Waveform generation with polyBLEP anti-aliasing
                let voice_sample = if wave_index < 0.5 {
                    // Sine
                    (std::f32::consts::TAU * phase).sin()
                } else if wave_index < 1.5 {
                    // Triangle (integrated square)
                    let mut square = if phase < 0.5 { 1.0 } else { -1.0 };
                    square += poly_blep(phase, dt);
                    square -= poly_blep((phase - 0.5).rem_euclid(1.0), dt);
                    let tri = &mut self.tri_states[v];
                    *tri += square * (2.0 * voice_freq / self.sample_rate);
                    *tri = tri.clamp(-1.0, 1.0);
                    *tri
                } else if wave_index < 2.5 {
                    // Sawtooth
                    let mut saw = 2.0 * phase - 1.0;
                    saw -= poly_blep(phase, dt);
                    saw
                } else {
                    // Pulse with PWM
                    let mut pulse = if phase < self.pwm_smooth { 1.0 } else { -1.0 };
                    pulse += poly_blep(phase, dt);
                    pulse -= poly_blep((phase - self.pwm_smooth).rem_euclid(1.0), dt);
                    pulse
                };
                sample += voice_sample;

                // Sub-oscillator (square wave)
                let sub_freq = voice_freq / sub_div;
                let sub_dt = (sub_freq / self.sample_rate).min(1.0);
                self.sub_phases[v] += sub_freq / self.sample_rate;
                if self.sub_phases[v] >= 1.0 {
                    self.sub_phases[v] -= self.sub_phases[v].floor();
                }
                let sub_phase = self.sub_phases[v];
                let mut sub_wave = if sub_phase < 0.5 { 1.0 } else { -1.0 };
                sub_wave += poly_blep(sub_phase, sub_dt);
                sub_wave -= poly_blep((sub_phase - 0.5).rem_euclid(1.0), sub_dt);
                sub_sample += sub_wave;
            }

            // Average voices and write outputs
            sample /= self.voice_count as f32;
            sub_sample /= self.voice_count as f32;
            output[i] = sample + sub_sample * sub_mix;
            if let Some(ref mut sub_buf) = sub_buffer {
                sub_buf[i] = sub_sample;
            }
            if let Some(ref mut sync_buf) = sync_buffer {
                sync_buf[i] = sync_pulse;
            }
        }
    }
}
