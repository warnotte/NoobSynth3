//! Theremin — an expressive XY-pad performance instrument that is also a
//! modular control node.
//!
//! "Played without touching it": the host UI maps mouse X → pitch and
//! mouse Y → volume. But the theremin can equally be **driven by CV inputs**
//! (pitch / volume / gate) — by a sequencer, an LFO, or even another theremin.
//!
//! Priority per sample: **mouse touch > CV inputs > silent**. While the user
//! holds the pad (`touch` param), the mouse overrides any incoming signal.
//! Otherwise, connected CV inputs drive the voice; the UI polls
//! [`Theremin::display_state`] to draw the cursor at the CV-driven position.
//!
//! Voicing: multi-waveform oscillator (sine/tri/saw/sqr, saw & square
//! anti-aliased with polyBLEP), portamento glide, vibrato (pitch LFO),
//! tremolo (amp LFO), a volume-tracking tone filter, and a click-free gate
//! envelope. It emits pitch / gate / volume CVs reflecting whatever is
//! actually being played, so theremin → theremin chains pass through.

use crate::common::{input_at, poly_blep, sample_at, freq_to_midi, Sample};
use std::f32::consts::TAU;

const WAVE_TRIANGLE: u8 = 1;
const WAVE_SAW: u8 = 2;
const WAVE_SQUARE: u8 = 3;

/// Convert a 1V/oct CV (project convention: MIDI 60 = C4 = 0 V) to Hz.
/// Inverse of the pitch CV the theremin emits.
#[inline]
fn cv_to_freq(cv: f32) -> f32 {
    440.0 * 2.0_f32.powf((cv * 12.0 - 9.0) / 12.0)
}

/// Theremin voice state.
pub struct Theremin {
    sample_rate: f32,
    inv_sr: f32,
    phase: f32,
    glided_freq: f32,
    vibrato_phase: f32,
    tremolo_phase: f32,
    env: f32,
    lp_z1: f32,
    // Last displayed position (for the UI cursor): normalized X/Y + gate.
    vis_x: f32,
    vis_y: f32,
    vis_gate: f32,
}

/// Per-block parameters (one slice each; constant or per-sample).
pub struct ThereminParams<'a> {
    /// Mouse-target pitch in Hz (XY pad X)
    pub frequency: &'a [Sample],
    /// Mouse-target volume 0..1 (XY pad Y)
    pub volume: &'a [Sample],
    /// Mouse touch 0/1 — while 1, the mouse overrides CV inputs
    pub touch: &'a [Sample],
    /// Waveform: 0=sine, 1=triangle, 2=saw, 3=square
    pub waveform: &'a [Sample],
    pub vibrato_rate: &'a [Sample],
    pub vibrato_depth: &'a [Sample],
    pub tremolo_rate: &'a [Sample],
    pub tremolo_depth: &'a [Sample],
    pub tone: &'a [Sample],
    pub glide: &'a [Sample],
    pub level: &'a [Sample],
    /// Gate-envelope attack time in seconds (note swell-in)
    pub attack: &'a [Sample],
    /// Gate-envelope release time in seconds (note fade-out)
    pub release: &'a [Sample],
    /// X-axis low frequency (for normalizing the display position)
    pub lo_freq: &'a [Sample],
    /// X-axis high frequency
    pub hi_freq: &'a [Sample],
}

/// CV inputs that can drive the theremin when the mouse isn't touching.
pub struct ThereminInputs<'a> {
    /// Pitch CV (1V/oct). `None` = not connected.
    pub pitch: Option<&'a [Sample]>,
    /// Volume CV 0..1
    pub volume: Option<&'a [Sample]>,
    /// Gate 0/1
    pub gate: Option<&'a [Sample]>,
}

/// Buffers the theremin writes to: stereo audio + three CVs.
pub struct ThereminOutputs<'a> {
    pub out_l: &'a mut [Sample],
    pub out_r: &'a mut [Sample],
    pub pitch_cv: &'a mut [Sample],
    pub gate_cv: &'a mut [Sample],
    pub vol_cv: &'a mut [Sample],
}

impl Theremin {
    pub fn new(sample_rate: f32) -> Self {
        let sr = sample_rate.max(1.0);
        Self {
            sample_rate: sr,
            inv_sr: 1.0 / sr,
            phase: 0.0,
            glided_freq: 440.0,
            vibrato_phase: 0.0,
            tremolo_phase: 0.0,
            env: 0.0,
            lp_z1: 0.0,
            vis_x: 0.5,
            vis_y: 1.0,
            vis_gate: 0.0,
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        self.inv_sr = 1.0 / self.sample_rate;
    }

    /// Current display position for the UI cursor: (x 0..1, y 0..1, gate 0/1).
    pub fn display_state(&self) -> (f32, f32, f32) {
        (self.vis_x, self.vis_y, self.vis_gate)
    }

    #[inline]
    fn generate_wave(phase: f32, dt: f32, waveform: u8) -> f32 {
        match waveform {
            WAVE_TRIANGLE => {
                let p = phase * 4.0;
                if p < 1.0 { p } else if p < 3.0 { 2.0 - p } else { p - 4.0 }
            }
            WAVE_SAW => (2.0 * phase - 1.0) - poly_blep(phase, dt),
            WAVE_SQUARE => {
                let naive = if phase < 0.5 { 1.0 } else { -1.0 };
                let mut p2 = phase + 0.5;
                if p2 >= 1.0 { p2 -= 1.0; }
                naive + poly_blep(phase, dt) - poly_blep(p2, dt)
            }
            _ => (phase * TAU).sin(),
        }
    }

    pub fn process_block(
        &mut self,
        outs: ThereminOutputs<'_>,
        inputs: ThereminInputs<'_>,
        params: ThereminParams<'_>,
    ) {
        let n = outs.out_l.len();
        if n == 0 {
            return;
        }
        let has_pitch_in = inputs.pitch.is_some();
        let has_vol_in = inputs.volume.is_some();
        let has_gate_in = inputs.gate.is_some();

        for i in 0..n {
            let touching = sample_at(params.touch, i, 0.0) > 0.5;
            let mouse_freq = sample_at(params.frequency, i, 440.0);
            let mouse_vol = sample_at(params.volume, i, 0.0).clamp(0.0, 1.0);
            let lo = sample_at(params.lo_freq, i, 130.81).max(8.0);
            let hi = sample_at(params.hi_freq, i, 1046.5).max(lo * 1.001);

            // Priority: mouse touch > CV inputs > hold/silent.
            let (target_freq, volume, gate_on) = if touching {
                (mouse_freq, mouse_vol, true)
            } else {
                let f = if has_pitch_in { cv_to_freq(input_at(inputs.pitch, i)) } else { mouse_freq };
                let v = if has_vol_in { input_at(inputs.volume, i).clamp(0.0, 1.0) } else { mouse_vol };
                let g = if has_gate_in {
                    input_at(inputs.gate, i) > 0.5
                } else {
                    has_pitch_in // pitch-driven drone when only pitch is patched
                };
                (f, v, g)
            };
            let target_freq = target_freq.clamp(16.0, 8000.0);

            let waveform = (sample_at(params.waveform, i, 0.0) as u8).min(3);
            let vib_rate = sample_at(params.vibrato_rate, i, 5.0).clamp(0.0, 20.0);
            let vib_depth = sample_at(params.vibrato_depth, i, 0.0).clamp(0.0, 1.0);
            let trem_rate = sample_at(params.tremolo_rate, i, 5.0).clamp(0.0, 20.0);
            let trem_depth = sample_at(params.tremolo_depth, i, 0.0).clamp(0.0, 1.0);
            let tone = sample_at(params.tone, i, 0.6).clamp(0.0, 1.0);
            let glide = sample_at(params.glide, i, 0.0).max(0.0);
            let level = sample_at(params.level, i, 1.0).clamp(0.0, 2.0);

            // Portamento.
            if glide <= 0.0001 {
                self.glided_freq = target_freq;
            } else {
                let coeff = 1.0 - (-self.inv_sr / glide).exp();
                self.glided_freq += (target_freq - self.glided_freq) * coeff;
            }

            // Vibrato.
            self.vibrato_phase += vib_rate * self.inv_sr;
            if self.vibrato_phase >= 1.0 { self.vibrato_phase -= 1.0; }
            let vib_lfo = (self.vibrato_phase * TAU).sin();
            let vib_mod = 2.0_f32.powf(vib_lfo * vib_depth * 2.0 / 12.0);
            let freq = (self.glided_freq * vib_mod).clamp(8.0, 0.45 * self.sample_rate);

            // Gate envelope with separate attack / release (notes swell in/out).
            let target_env = if gate_on { 1.0 } else { 0.0 };
            let env_time = if target_env > self.env {
                sample_at(params.attack, i, 0.02)
            } else {
                sample_at(params.release, i, 0.15)
            }.max(0.0005);
            let env_coeff = 1.0 - (-self.inv_sr / env_time).exp();
            self.env += (target_env - self.env) * env_coeff;

            // Oscillator.
            let dt = freq * self.inv_sr;
            self.phase += dt;
            if self.phase >= 1.0 { self.phase -= self.phase.floor(); }
            let raw = Self::generate_wave(self.phase, dt, waveform);

            // Tone filter.
            let cutoff_hz = (200.0 + tone * 11_800.0) * (0.6 + 0.4 * volume);
            let cutoff = cutoff_hz.clamp(60.0, 0.45 * self.sample_rate);
            let alpha = 1.0 - (-TAU * cutoff * self.inv_sr).exp();
            self.lp_z1 += alpha * (raw - self.lp_z1);
            let filtered = self.lp_z1;

            // Tremolo.
            self.tremolo_phase += trem_rate * self.inv_sr;
            if self.tremolo_phase >= 1.0 { self.tremolo_phase -= 1.0; }
            let trem_lfo = (self.tremolo_phase * TAU).sin();
            let trem_amp = 1.0 - trem_depth * (0.5 - 0.5 * trem_lfo);

            let amp = volume * self.env * trem_amp * level;
            let sample = filtered * amp;

            outs.out_l[i] = sample;
            outs.out_r[i] = sample;

            // CVs reflect whatever is actually played (mouse or incoming CV).
            outs.pitch_cv[i] = (freq_to_midi(target_freq) - 60.0) / 12.0;
            outs.gate_cv[i] = target_env;
            outs.vol_cv[i] = volume * self.env;

            // Display position (normalized) for the UI cursor.
            self.vis_x = ((target_freq / lo).ln() / (hi / lo).ln()).clamp(0.0, 1.0);
            self.vis_y = (1.0 - volume).clamp(0.0, 1.0);
            self.vis_gate = target_env;
        }
    }
}
