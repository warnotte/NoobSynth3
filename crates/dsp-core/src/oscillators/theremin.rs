//! Theremin — an expressive XY-pad performance instrument.
//!
//! "Played without touching it": the host UI maps mouse X → pitch and
//! mouse Y → volume, sending `frequency` / `volume` / `gate` params here.
//! This DSP turns that into a smooth, singing voice:
//!
//! - Multi-waveform oscillator (sine / triangle / saw / square), saw & square
//!   anti-aliased with polyBLEP.
//! - Portamento (`glide`) so pitch slides continuously like a real theremin.
//! - Vibrato (pitch LFO) and tremolo (amplitude LFO) for the eerie character.
//! - A one-pole tone (brightness) filter, opened slightly more as you play louder.
//! - A click-free gate envelope.
//!
//! It also emits control voltages (pitch / gate / volume) so the XY pad can
//! drive the rest of the patch, not just its own oscillator.

use crate::common::{poly_blep, sample_at, freq_to_midi, Sample};
use std::f32::consts::TAU;

const WAVE_TRIANGLE: u8 = 1;
const WAVE_SAW: u8 = 2;
const WAVE_SQUARE: u8 = 3;

/// Theremin voice state.
pub struct Theremin {
    sample_rate: f32,
    inv_sr: f32,
    /// Main oscillator phase (0..1)
    phase: f32,
    /// Smoothed (glided) frequency in Hz
    glided_freq: f32,
    /// Vibrato LFO phase (0..1)
    vibrato_phase: f32,
    /// Tremolo LFO phase (0..1)
    tremolo_phase: f32,
    /// Amplitude envelope (0..1), smooths the gate to avoid clicks
    env: f32,
    /// One-pole low-pass state (tone filter)
    lp_z1: f32,
}

/// Per-block parameters (one slice each; constant or per-sample).
pub struct ThereminParams<'a> {
    /// Target pitch in Hz (from the XY pad's X axis)
    pub frequency: &'a [Sample],
    /// Volume 0..1 (from the XY pad's Y axis)
    pub volume: &'a [Sample],
    /// Gate 0/1 (pointer down = playing)
    pub gate: &'a [Sample],
    /// Waveform: 0=sine, 1=triangle, 2=saw, 3=square
    pub waveform: &'a [Sample],
    /// Vibrato rate in Hz
    pub vibrato_rate: &'a [Sample],
    /// Vibrato depth 0..1 (scaled to ~2 semitones)
    pub vibrato_depth: &'a [Sample],
    /// Tremolo rate in Hz
    pub tremolo_rate: &'a [Sample],
    /// Tremolo depth 0..1
    pub tremolo_depth: &'a [Sample],
    /// Tone / brightness 0..1 (low-pass cutoff)
    pub tone: &'a [Sample],
    /// Portamento time in seconds
    pub glide: &'a [Sample],
    /// Master level 0..~1.5
    pub level: &'a [Sample],
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
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        self.inv_sr = 1.0 / self.sample_rate;
    }

    /// Band-limited waveform sample for the current phase / phase increment.
    #[inline]
    fn generate_wave(phase: f32, dt: f32, waveform: u8) -> f32 {
        match waveform {
            WAVE_TRIANGLE => {
                let p = phase * 4.0;
                if p < 1.0 { p } else if p < 3.0 { 2.0 - p } else { p - 4.0 }
            }
            WAVE_SAW => {
                // naive saw minus polyBLEP correction at the wrap discontinuity
                (2.0 * phase - 1.0) - poly_blep(phase, dt)
            }
            WAVE_SQUARE => {
                let naive = if phase < 0.5 { 1.0 } else { -1.0 };
                let mut p2 = phase + 0.5;
                if p2 >= 1.0 { p2 -= 1.0; }
                naive + poly_blep(phase, dt) - poly_blep(p2, dt)
            }
            _ => (phase * TAU).sin(), // sine
        }
    }

    pub fn process_block(&mut self, outs: ThereminOutputs<'_>, params: ThereminParams<'_>) {
        let n = outs.out_l.len();
        if n == 0 {
            return;
        }

        for i in 0..n {
            let target_freq = sample_at(params.frequency, i, 440.0).clamp(16.0, 8000.0);
            let volume = sample_at(params.volume, i, 0.0).clamp(0.0, 1.0);
            let gate = sample_at(params.gate, i, 0.0);
            let waveform = (sample_at(params.waveform, i, 0.0) as u8).min(3);
            let vib_rate = sample_at(params.vibrato_rate, i, 5.0).clamp(0.0, 20.0);
            let vib_depth = sample_at(params.vibrato_depth, i, 0.0).clamp(0.0, 1.0);
            let trem_rate = sample_at(params.tremolo_rate, i, 5.0).clamp(0.0, 20.0);
            let trem_depth = sample_at(params.tremolo_depth, i, 0.0).clamp(0.0, 1.0);
            let tone = sample_at(params.tone, i, 0.6).clamp(0.0, 1.0);
            let glide = sample_at(params.glide, i, 0.0).max(0.0);
            let level = sample_at(params.level, i, 1.0).clamp(0.0, 2.0);

            // Portamento: slide glided_freq toward target.
            if glide <= 0.0001 {
                self.glided_freq = target_freq;
            } else {
                let coeff = 1.0 - (-self.inv_sr / glide).exp();
                self.glided_freq += (target_freq - self.glided_freq) * coeff;
            }

            // Vibrato: pitch LFO in semitones (depth up to ~2 st).
            self.vibrato_phase += vib_rate * self.inv_sr;
            if self.vibrato_phase >= 1.0 { self.vibrato_phase -= 1.0; }
            let vib_lfo = (self.vibrato_phase * TAU).sin();
            let vib_mod = 2.0_f32.powf(vib_lfo * vib_depth * 2.0 / 12.0);
            let freq = (self.glided_freq * vib_mod).clamp(8.0, 0.45 * self.sample_rate);

            // Gate envelope: ~6ms attack/release for click-free notes.
            let target_env = if gate > 0.5 { 1.0 } else { 0.0 };
            let env_coeff = 1.0 - (-self.inv_sr / 0.006).exp();
            self.env += (target_env - self.env) * env_coeff;

            // Oscillator.
            let dt = freq * self.inv_sr;
            self.phase += dt;
            if self.phase >= 1.0 { self.phase -= self.phase.floor(); }
            let raw = Self::generate_wave(self.phase, dt, waveform);

            // Tone filter: cutoff from `tone`, opened a bit more when louder.
            let cutoff_hz = (200.0 + tone * 11_800.0) * (0.6 + 0.4 * volume);
            let cutoff = cutoff_hz.clamp(60.0, 0.45 * self.sample_rate);
            let alpha = 1.0 - (-TAU * cutoff * self.inv_sr).exp();
            self.lp_z1 += alpha * (raw - self.lp_z1);
            let filtered = self.lp_z1;

            // Tremolo: amplitude LFO, depth fraction off full.
            self.tremolo_phase += trem_rate * self.inv_sr;
            if self.tremolo_phase >= 1.0 { self.tremolo_phase -= 1.0; }
            let trem_lfo = (self.tremolo_phase * TAU).sin();
            let trem_amp = 1.0 - trem_depth * (0.5 - 0.5 * trem_lfo);

            let amp = volume * self.env * trem_amp * level;
            let sample = filtered * amp;

            outs.out_l[i] = sample;
            outs.out_r[i] = sample;

            // CV outputs (so the pad can drive the rest of the patch).
            // Pitch CV uses the project convention: MIDI 60 (C4) = 0 V/oct.
            outs.pitch_cv[i] = (freq_to_midi(freq) - 60.0) / 12.0;
            outs.gate_cv[i] = target_env;
            outs.vol_cv[i] = volume * self.env;
        }
    }
}
