//! Sampler — a pitched one-shot .wav player.
//!
//! Loads a sample buffer (via `load_buffer`, fed from the UI's decoded audio) and plays it back
//! on a rising-edge trigger at a pitch-CV-controlled rate (1 V/oct), with a short attack fade-in,
//! the sample's own natural tail, and an end fade-out (anti-click). Optional loop between
//! loop-start/end. Mirrors the Granular buffer plumbing; linear interpolation like `read_sample_from`.

use crate::common::{input_at, sample_at, Sample};

const MAX_BUFFER_SAMPLES: usize = 480_000; // ~10 s @ 48k (same cap as Granular)

/// Parameters for the Sampler.
pub struct SamplerParams<'a> {
    /// Base playback rate (1.0 = original pitch).
    pub pitch: &'a [Sample],
    /// Output level (0-1).
    pub level: &'a [Sample],
    /// Attack fade-in (seconds) — anti-click on trigger.
    pub attack: &'a [Sample],
    /// End fade-out (seconds) — anti-click at the sample tail.
    pub release: &'a [Sample],
    /// Loop mode: 0 = one-shot, >0.5 = loop between loop-start/end.
    pub loop_mode: &'a [Sample],
    /// Loop start (0-1 of buffer).
    pub loop_start: &'a [Sample],
    /// Loop end (0-1 of buffer).
    pub loop_end: &'a [Sample],
}

/// Input signals for the Sampler.
pub struct SamplerInputs<'a> {
    /// Trigger (rising edge starts playback).
    pub trigger: Option<&'a [Sample]>,
    /// Pitch CV (1 V/oct), summed with the `pitch` param ratio.
    pub pitch_cv: Option<&'a [Sample]>,
}

/// Pitched one-shot sample player.
pub struct Sampler {
    sample_rate: f32,
    buffer: Vec<Sample>,
    buffer_length: usize,
    file_sr: f32, // sample rate the buffer was decoded at (== engine SR via decodeAudioData)
    pos: f32,     // fractional read index
    playing: bool,
    env: f32,
    last_trigger: f32,
    enabled: bool,
}

impl Sampler {
    pub fn new(sample_rate: f32) -> Self {
        let sr = sample_rate.max(1.0);
        Self {
            sample_rate: sr,
            buffer: vec![0.0; MAX_BUFFER_SAMPLES],
            buffer_length: 0,
            file_sr: sr,
            pos: 0.0,
            playing: false,
            env: 0.0,
            last_trigger: 0.0,
            enabled: true,
        }
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Load sample data (mono, already at engine SR via the UI's `decodeAudioData`).
    pub fn load_buffer(&mut self, data: &[Sample], file_sr: f32) {
        let len = data.len().min(MAX_BUFFER_SAMPLES);
        self.buffer[..len].copy_from_slice(&data[..len]);
        for s in &mut self.buffer[len..] {
            *s = 0.0;
        }
        self.buffer_length = len;
        self.file_sr = file_sr.max(1.0);
        self.pos = 0.0;
        self.playing = false;
        self.env = 0.0;
    }

    pub fn buffer_length(&self) -> usize {
        self.buffer_length
    }

    pub fn has_buffer(&self) -> bool {
        self.buffer_length > 0
    }

    /// Normalized playback position 0-1 (for a UI playhead).
    pub fn get_position(&self) -> f32 {
        if self.buffer_length == 0 || !self.playing {
            return 0.0;
        }
        (self.pos / self.buffer_length as f32).clamp(0.0, 1.0)
    }

    fn read_interp(buffer: &[Sample], buffer_length: usize, index: f32) -> f32 {
        if buffer_length == 0 {
            return 0.0;
        }
        let base = index.floor() as usize;
        if base >= buffer_length {
            return 0.0;
        }
        let next = base + 1;
        let frac = index - base as f32;
        let a = buffer[base];
        let b = if next < buffer_length { buffer[next] } else { 0.0 };
        a + (b - a) * frac
    }

    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: SamplerInputs<'_>,
        params: SamplerParams<'_>,
    ) {
        let n = out_l.len();
        for i in 0..n {
            let trig = input_at(inputs.trigger, i);
            // rising edge → (re)start one-shot
            if trig > 0.5 && self.last_trigger <= 0.5 {
                self.pos = 0.0;
                self.playing = true;
                self.env = 0.0;
            }
            self.last_trigger = trig;

            if !self.enabled || !self.playing || self.buffer_length == 0 {
                out_l[i] = 0.0;
                out_r[i] = 0.0;
                continue;
            }

            let pitch = sample_at(params.pitch, i, 1.0).max(0.01);
            let pcv = input_at(inputs.pitch_cv, i);
            let ratio = if pcv.abs() > 1e-4 { 2.0_f32.powf(pcv) } else { 1.0 };
            let inc = pitch * ratio * (self.file_sr / self.sample_rate);

            let sample = Self::read_interp(&self.buffer, self.buffer_length, self.pos);

            // attack fade-in (anti-click)
            let attack = sample_at(params.attack, i, 0.003).max(0.0001);
            if self.env < 1.0 {
                self.env = (self.env + 1.0 / (attack * self.sample_rate)).min(1.0);
            }

            // end fade-out over the last `release` seconds (anti-click), one-shot only
            let looping = sample_at(params.loop_mode, i, 0.0) > 0.5;
            let release = sample_at(params.release, i, 0.01).max(0.0005);
            let mut end_env = 1.0;
            if !looping {
                let rel_samples = (release * self.sample_rate).max(1.0);
                let remaining = self.buffer_length as f32 - self.pos;
                if remaining < rel_samples {
                    end_env = (remaining / rel_samples).clamp(0.0, 1.0);
                }
            }

            let level = sample_at(params.level, i, 0.85);
            let out = sample * self.env * end_env * level;
            out_l[i] = out;
            out_r[i] = out;

            // advance
            self.pos += inc;
            if looping {
                let bl = self.buffer_length as f32;
                let ls = (sample_at(params.loop_start, i, 0.0).clamp(0.0, 1.0) * bl).min(bl - 1.0);
                let le = (sample_at(params.loop_end, i, 1.0).clamp(0.0, 1.0) * bl).max(ls + 1.0);
                if self.pos >= le {
                    self.pos = ls + (self.pos - le);
                }
            } else if self.pos >= self.buffer_length as f32 {
                self.playing = false;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plays_loaded_sample_then_stops() {
        let mut s = Sampler::new(48_000.0);
        // a 1000-sample ramp as the "sample"
        let data: Vec<f32> = (0..1000).map(|i| (i as f32 / 1000.0) * 2.0 - 1.0).collect();
        s.load_buffer(&data, 48_000.0);
        assert!(s.has_buffer());

        let trig_hi = [1.0f32; 64];
        let params = || SamplerParams {
            pitch: &[1.0], level: &[1.0], attack: &[0.001], release: &[0.001],
            loop_mode: &[0.0], loop_start: &[0.0], loop_end: &[1.0],
        };
        let (mut l, mut r) = ([0.0f32; 64], [0.0f32; 64]);
        // trigger
        s.process_block(&mut l, &mut r, SamplerInputs { trigger: Some(&trig_hi), pitch_cv: None }, params());
        let mut peak = 0.0f32;
        let trig_lo = [0.0f32; 64];
        for _ in 0..40 {
            s.process_block(&mut l, &mut r, SamplerInputs { trigger: Some(&trig_lo), pitch_cv: None }, params());
            for &x in &l { assert!(x.is_finite()); if x.abs() > peak { peak = x.abs(); } }
        }
        assert!(peak > 0.5, "sample should play back audibly (peak {peak})");
        // after the 1000-sample one-shot is done, output is silent
        let mut tail = 0.0f32;
        for _ in 0..10 {
            s.process_block(&mut l, &mut r, SamplerInputs { trigger: Some(&trig_lo), pitch_cv: None }, params());
            for &x in &l { tail = tail.max(x.abs()); }
        }
        assert!(tail < 1e-6, "one-shot should stop at sample end (tail {tail})");
    }
}
