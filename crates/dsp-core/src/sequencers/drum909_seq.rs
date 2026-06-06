//! Internal sequencer for the TR-909 drum machine (`DrumMachine909`).
//!
//! 11 voices, graded per-step VELOCITY (0..127, not a binary accent), selectable LENGTH 16/32/64,
//! A/B pattern banks + a FILL bank, swing, and global-transport sync (ported from `drum_sequencer`).
//! It does NOT generate audio: per block it writes, per voice, a 1-sample TRIGGER pulse + a held
//! VELOCITY CV (vel/127) into caller buffers, which the container feeds to the embedded 909 voices
//! via `voice.process_block(out, Inputs{trigger, accent}, ...)`.
//!
//! Pattern data is set via setters (`set_step` / `set_length` / `set_running_pattern`); the JSON
//! `patternData` is parsed in dsp-graph (which has serde) — dsp-core stays serde-free.

use crate::common::{sample_at, Sample};
use super::RATE_DIVISIONS;

/// Voice lanes (index order = the contract with the container + output-port order).
/// bd sd lt mt ht rs cp ch oh cr rd
pub const DM_VOICES: usize = 11;
pub const DM_MAX_STEPS: usize = 64;
pub const DM_BANKS: usize = 3;
pub const BANK_A: usize = 0;
pub const BANK_B: usize = 1;
pub const BANK_FILL: usize = 2;
pub const DM_VOICE_NAMES: [&str; DM_VOICES] =
    ["bd", "sd", "lt", "mt", "ht", "rs", "cp", "ch", "oh", "cr", "rd"];

/// One step in a voice lane: on/off + graded velocity (1..127 when on).
#[derive(Clone, Copy)]
pub struct Step909 {
    pub on: bool,
    pub vel: u8,
}
impl Default for Step909 {
    fn default() -> Self {
        Self { on: false, vel: 100 }
    }
}

/// Inputs (optional external clock/reset; when clock connected it overrides transport).
pub struct Seq909Inputs<'a> {
    pub clock: Option<&'a [Sample]>,
    pub reset: Option<&'a [Sample]>,
}

/// Live params (smoothed buffers, block-rate read at index 0 like the other sequencers).
pub struct Seq909Params<'a> {
    pub enabled: &'a [Sample],
    pub tempo: &'a [Sample],
    pub rate: &'a [Sample],
    pub swing: &'a [Sample],
    pub length: &'a [Sample],
    /// Running pattern: 0 = bank A, 1 = bank B (bar-latched).
    pub pattern: &'a [Sample],
    /// FILL: rising edge engages the FILL bank for the current bar (auto-clears at the next bar).
    pub fill: &'a [Sample],
}

/// Snap a length param to one of {16, 32, 64}.
fn snap_length(v: f32) -> usize {
    let v = v.max(1.0) as usize;
    if v <= 24 {
        16
    } else if v <= 48 {
        32
    } else {
        64
    }
}

pub struct Seq909 {
    sample_rate: f32,
    grid: [[[Step909; DM_MAX_STEPS]; DM_VOICES]; DM_BANKS], // [bank][voice][step]
    length: usize,

    // running playback state
    phase: f64,
    prev_rate_idx: usize,
    last_global_step: i64,
    ext_counter: i64,
    play_step: usize,

    // bank selection
    active_bank: usize,   // running A or B
    pending_bank: usize,  // bar-latched switch target
    prev_pattern_param: usize,
    fill_engaged: bool,
    fill_release_bar: i64,
    prev_fill: f32,
    last_bar: i64,

    // swing (odd steps delayed)
    swing_pending: bool,
    swing_delay_remaining: usize,
    swing_on: [bool; DM_VOICES],
    swing_vel: [u8; DM_VOICES],

    // held velocity CV (so the CV holds between hits)
    held_vel: [f32; DM_VOICES],

    prev_clock: f32,
    prev_reset: f32,

    // global transport (set by the container before process_block)
    pub transport_beats: f64,
    pub transport_bps: f64,
}

impl Seq909 {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            grid: [[[Step909::default(); DM_MAX_STEPS]; DM_VOICES]; DM_BANKS],
            length: 16,
            phase: 0.0,
            prev_rate_idx: 4,
            last_global_step: -1,
            ext_counter: -1,
            play_step: 0,
            active_bank: BANK_A,
            pending_bank: BANK_A,
            prev_pattern_param: 0,
            fill_engaged: false,
            fill_release_bar: 0,
            prev_fill: 0.0,
            last_bar: -1,
            swing_pending: false,
            swing_delay_remaining: 0,
            swing_on: [false; DM_VOICES],
            swing_vel: [0; DM_VOICES],
            held_vel: [0.0; DM_VOICES],
            prev_clock: 0.0,
            prev_reset: 0.0,
            transport_beats: 0.0,
            transport_bps: 0.0,
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Current step position (for the UI playhead).
    pub fn current_step(&self) -> usize {
        self.play_step
    }

    pub fn length(&self) -> usize {
        self.length
    }

    /// Program a single step (bank 0=A,1=B,2=FILL; voice 0..10; step 0..63).
    pub fn set_step(&mut self, bank: usize, voice: usize, step: usize, on: bool, vel: u8) {
        if bank < DM_BANKS && voice < DM_VOICES && step < DM_MAX_STEPS {
            self.grid[bank][voice][step] = Step909 { on, vel: vel.min(127) };
        }
    }

    /// Clear a whole bank (used before re-parsing patternData).
    pub fn clear_bank(&mut self, bank: usize) {
        if bank < DM_BANKS {
            self.grid[bank] = [[Step909::default(); DM_MAX_STEPS]; DM_VOICES];
        }
    }

    pub fn set_length(&mut self, len: usize) {
        self.length = snap_length(len as f32);
    }

    /// Set the running pattern bank directly (0=A,1=B), bar-latched via the param path normally.
    pub fn set_running_pattern(&mut self, bank: usize) {
        self.pending_bank = bank.min(1);
    }

    /// Process a block. `trig` and `vel_out` are FLATTENED [voice * frames + i] buffers
    /// (length >= DM_VOICES * frames); `step_out` has length == frames.
    pub fn process_block(
        &mut self,
        trig: &mut [Sample],
        vel_out: &mut [Sample],
        step_out: &mut [Sample],
        inputs: Seq909Inputs<'_>,
        params: Seq909Params<'_>,
    ) {
        let frames = step_out.len();
        if frames == 0 {
            return;
        }

        let enabled = sample_at(params.enabled, 0, 1.0) > 0.5;
        let tempo = if self.transport_bps > 0.0 {
            (self.transport_bps * 60.0 * self.sample_rate as f64) as f32
        } else {
            sample_at(params.tempo, 0, 120.0).clamp(40.0, 300.0)
        };
        let rate_idx = (sample_at(params.rate, 0, 4.0) as usize).min(RATE_DIVISIONS.len() - 1);
        if rate_idx != self.prev_rate_idx {
            self.prev_rate_idx = rate_idx;
            self.phase = 0.0;
        }
        let mut swing = sample_at(params.swing, 0, 0.0).clamp(0.0, 90.0) / 100.0;
        let length = snap_length(sample_at(params.length, 0, 16.0));
        self.length = length;
        let pattern_param = (sample_at(params.pattern, 0, 0.0) as usize).min(1);
        let fill_param = sample_at(params.fill, 0, 0.0);

        let beats_per_second = tempo as f64 / 60.0;
        let rate_mult = RATE_DIVISIONS[rate_idx];
        let step_duration_samples = (rate_mult / beats_per_second) * self.sample_rate as f64;

        let use_external_clock = inputs.clock.is_some()
            && inputs.clock.map_or(false, |c| c.iter().any(|&v| v >= 0.0));
        if use_external_clock {
            swing = 0.0; // master clock already swings; avoid double-swing
        }

        // Pattern A/B change → schedule a bar-latched switch.
        if pattern_param != self.prev_pattern_param {
            self.prev_pattern_param = pattern_param;
            self.pending_bank = pattern_param;
        }
        let fill_rising = fill_param > 0.5 && self.prev_fill <= 0.5;
        self.prev_fill = fill_param;

        for i in 0..frames {
            if !enabled {
                for v in 0..DM_VOICES {
                    trig[v * frames + i] = 0.0;
                    vel_out[v * frames + i] = 0.0;
                }
                step_out[i] = 0.0;
                continue;
            }

            // Reset
            let reset_in = inputs.reset.map_or(0.0, |b| sample_at(b, i, 0.0));
            let reset_trig = reset_in > 0.5 && self.prev_reset <= 0.5;
            self.prev_reset = reset_in;
            if reset_trig {
                self.last_global_step = -1;
                self.ext_counter = -1;
                self.play_step = 0;
                self.phase = 0.0;
                self.swing_pending = false;
                self.last_bar = -1;
                self.active_bank = self.pending_bank;
                self.fill_engaged = false;
            }

            let mut fire_now = [false; DM_VOICES];
            let mut fire_vel = [0u8; DM_VOICES];

            // Engage FILL on a rising edge (for the current bar; auto-clears next bar).
            if fill_rising && !self.fill_engaged {
                self.fill_engaged = true;
                let cur = if self.last_global_step < 0 { 0 } else { self.last_global_step };
                self.fill_release_bar = cur / length as i64 + 1;
            }

            // Pending swing release
            if self.swing_pending {
                if self.swing_delay_remaining > 0 {
                    self.swing_delay_remaining -= 1;
                } else {
                    self.swing_pending = false;
                    for v in 0..DM_VOICES {
                        if self.swing_on[v] {
                            fire_now[v] = true;
                            fire_vel[v] = self.swing_vel[v];
                        }
                    }
                }
            }

            // Step-edge detection
            let clock_in = inputs.clock.map_or(-1.0, |b| sample_at(b, i, 0.0));
            let clock_trig = clock_in > 0.5 && self.prev_clock <= 0.5;
            self.prev_clock = clock_in;

            let (edge, global_step) = if use_external_clock {
                if clock_trig {
                    self.ext_counter += 1;
                    (true, self.ext_counter)
                } else {
                    (false, self.ext_counter)
                }
            } else if self.transport_bps > 0.0 {
                let beat_now = self.transport_beats + i as f64 * self.transport_bps;
                let gs = (beat_now / rate_mult).floor() as i64;
                (gs != self.last_global_step, gs)
            } else {
                self.phase += 1.0 / step_duration_samples;
                if self.phase >= 1.0 {
                    self.phase -= 1.0;
                    self.last_global_step += 1;
                    (true, self.last_global_step)
                } else {
                    (false, self.last_global_step)
                }
            };

            if edge && !self.swing_pending {
                self.last_global_step = global_step;
                let gstep = if global_step < 0 { 0 } else { global_step };
                self.play_step = (gstep as usize) % length;
                let bar = gstep / length as i64;
                if bar != self.last_bar {
                    self.last_bar = bar;
                    self.active_bank = self.pending_bank;
                    if self.fill_engaged && bar >= self.fill_release_bar {
                        self.fill_engaged = false;
                    }
                }
                let bank = if self.fill_engaged { BANK_FILL } else { self.active_bank };

                let is_odd = self.play_step % 2 == 1;
                let swing_delay = if is_odd && swing > 0.0 {
                    (step_duration_samples * (swing as f64).min(0.45)) as usize
                } else {
                    0
                };

                let mut any = false;
                for v in 0..DM_VOICES {
                    let st = self.grid[bank][v][self.play_step];
                    if st.on {
                        any = true;
                        if swing_delay > 0 {
                            self.swing_on[v] = true;
                            self.swing_vel[v] = st.vel;
                        } else {
                            fire_now[v] = true;
                            fire_vel[v] = st.vel;
                        }
                    } else {
                        self.swing_on[v] = false;
                    }
                }
                if any && swing_delay > 0 {
                    self.swing_pending = true;
                    self.swing_delay_remaining = swing_delay;
                }
            }

            for v in 0..DM_VOICES {
                if fire_now[v] {
                    self.held_vel[v] = (fire_vel[v] as f32 / 127.0).clamp(0.0, 1.0);
                    trig[v * frames + i] = 1.0;
                } else {
                    trig[v * frames + i] = 0.0;
                }
                vel_out[v * frames + i] = self.held_vel[v];
            }
            step_out[i] = self.play_step as f32;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Drive `seq` for `blocks` blocks of `fr` frames at the given tempo, collecting, per voice,
    // the (global_sample, velocity) of each rising trigger edge.
    fn run(seq: &mut Seq909, sr: f32, tempo: f64, rate_idx: f32, swing: f32, length: f32,
           pattern: f32, fill: f32, blocks: usize, fr: usize) -> Vec<Vec<(usize, f32)>> {
        let bps = tempo / 60.0 / sr as f64;
        let mut hits: Vec<Vec<(usize, f32)>> = vec![Vec::new(); DM_VOICES];
        let mut trig = vec![0.0f32; DM_VOICES * fr];
        let mut vel = vec![0.0f32; DM_VOICES * fr];
        let mut step = vec![0.0f32; fr];
        let mut last = [0.0f32; DM_VOICES];
        for b in 0..blocks {
            seq.transport_beats = (b * fr) as f64 * bps;
            seq.transport_bps = bps;
            seq.process_block(&mut trig, &mut vel, &mut step,
                Seq909Inputs { clock: None, reset: None },
                Seq909Params {
                    enabled: &[1.0], tempo: &[tempo as f32], rate: &[rate_idx], swing: &[swing],
                    length: &[length], pattern: &[pattern], fill: &[fill],
                });
            for v in 0..DM_VOICES {
                for i in 0..fr {
                    let t = trig[v * fr + i];
                    if t > 0.5 && last[v] <= 0.5 {
                        hits[v].push((b * fr + i, vel[v * fr + i]));
                    }
                    last[v] = t;
                }
            }
        }
        hits
    }

    #[test]
    fn placement_and_velocity() {
        let sr = 48_000.0;
        let mut seq = Seq909::new(sr);
        // rate 4 = 1/16; tempo 120 → 1/16 step = 0.25 beat = 6000 samples. length 16 = 1 bar = 96000.
        seq.set_step(BANK_A, 0, 0, true, 120);
        seq.set_step(BANK_A, 0, 4, true, 80);
        seq.set_step(BANK_A, 0, 8, true, 120);
        seq.set_step(BANK_A, 0, 12, true, 80);
        let hits = run(&mut seq, sr, 120.0, 4.0, 0.0, 16.0, 0.0, 0.0, 800, 128); // ~2.1s > 1 bar
        let kick = &hits[0];
        assert!(kick.len() >= 4, "expected >=4 kicks in ~1 bar, got {}", kick.len());
        // first four hits at ~0, 24000, 48000, 72000 samples (steps 0,4,8,12)
        let expected = [0usize, 24000, 48000, 72000];
        for (k, &exp) in expected.iter().enumerate() {
            let (s, vcv) = kick[k];
            assert!((s as i64 - exp as i64).abs() <= 130, "kick {k} at {s}, expected ~{exp}");
            let exp_vel = if k % 2 == 0 { 120.0 / 127.0 } else { 80.0 / 127.0 };
            assert!((vcv - exp_vel).abs() < 0.02, "kick {k} vel {vcv}, expected {exp_vel}");
        }
    }

    #[test]
    fn length_32_reaches_second_bar_half() {
        let sr = 48_000.0;
        let mut seq = Seq909::new(sr);
        seq.set_step(BANK_A, 1, 20, true, 100); // snare on step 20 (only exists if length>=32)
        let hits = run(&mut seq, sr, 120.0, 4.0, 0.0, 32.0, 0.0, 0.0, 1200, 128); // ~3.2s, 2-bar(32) = 192000
        let snare = &hits[1];
        assert!(!snare.is_empty(), "snare on step 20 should fire with length 32");
        // step 20 → 20*6000 = 120000 samples
        assert!((snare[0].0 as i64 - 120000).abs() <= 200, "snare at {}", snare[0].0);
    }

    #[test]
    fn ab_bank_switch() {
        let sr = 48_000.0;
        let mut seq = Seq909::new(sr);
        // Bank A: kick on step 0 only. Bank B: kick on steps 0 AND 8.
        seq.set_step(BANK_A, 0, 0, true, 100);
        seq.set_step(BANK_B, 0, 0, true, 100);
        seq.set_step(BANK_B, 0, 8, true, 100);
        // pattern = 1 (bank B) from the start.
        let hits = run(&mut seq, sr, 120.0, 4.0, 0.0, 16.0, 1.0, 0.0, 800, 128); // ~1 bar
        let kick = &hits[0];
        assert!(kick.len() >= 2, "bank B should give >=2 kicks/bar (steps 0 & 8), got {}", kick.len());
    }

    #[test]
    fn fill_overrides_then_clears() {
        let sr = 48_000.0;
        let mut seq = Seq909::new(sr);
        seq.set_step(BANK_A, 0, 0, true, 100);          // normal: kick on 0
        for s in 0..16 { seq.set_step(BANK_FILL, 5, s, true, 100); } // FILL: tom on every step
        // Engage fill from the start: it should play the FILL bank for ~1 bar then clear.
        let hits = run(&mut seq, sr, 120.0, 4.0, 0.0, 16.0, 0.0, 1.0, 1600, 128); // ~4.3s = >2 bars
        let tom = &hits[5];
        assert!(tom.len() >= 8, "FILL bar should fire many toms, got {}", tom.len());
        // After fill clears (bar 2+), tom should stop (FILL not engaged) — total toms should be ~16 (one bar), not 32+
        assert!(tom.len() <= 20, "FILL should auto-clear after one bar, got {} toms", tom.len());
    }
}
