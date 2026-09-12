//! Koshi chime — modal model of the 8-rod Koshi wind chime.
//!
//! Every constant below was measured on the four factory recordings
//! (koshi.fr/sound/{Terra,Aqua,Aria,Ignis}.mp3) with the spectrogram bench:
//!
//! - each rod rings like a FREE-FREE bar (not a cantilever): partials 1 : 2.79 : 5.55 : 8.9
//! - the tuning is stretched ≈ 28 cents/octave around 1250 Hz (low rods ~40 c flat,
//!   top rods ~15 c sharp) — that shimmer is part of the instrument
//! - the second partial of the low rods is LOUDER than their fundamental; the balance
//!   of partials follows the absolute frequency (radiation of the tube), see `mode_level_db`
//! - T60 ≈ 6 s below 2.5 kHz, ≈ 1 s at 5 kHz, ≈ 0.3 s at 8 kHz, see `t60_for`
//! - three tube/plate resonances between 150 and 330 Hz, ≈ -10 dB, T60 2-5 s
//! - strikes come in clusters (IOI 60-250 ms inside a cluster, 0.3-2 s between clusters):
//!   a clapper swings inside the tube. The 2D pendulum in `Clapper` reproduces that.
//!
//! The module is autonomous (wind mode: the clapper plays by itself) AND playable
//! (gate input strikes a rod, chosen by the pitch CV or at random). It also reports
//! every strike on a gate + V/oct CV output so the wind can drive other modules.

use std::f32::consts::PI;

pub const KOSHI_NUM_RODS: usize = 8;
const NUM_RODS: usize = KOSHI_NUM_RODS;
pub const NUM_TUNINGS: usize = 4;
const NUM_MODES: usize = 4;
const NUM_BODY: usize = 3;

/// Free-free bar partials (measured median over 32 rods: 2.789 / 5.55 / 8.9).
const MODE_RATIOS: [f32; NUM_MODES] = [1.0, 2.79, 5.55, 8.9];

/// MIDI notes of the 8 rods for the 4 factory tunings.
const TUNINGS: [[u8; NUM_RODS]; NUM_TUNINGS] = [
  [67, 72, 76, 77, 79, 84, 88, 91], // Terra  G4 C5 E5 F5 G5 C6 E6 G6
  [69, 74, 77, 79, 81, 86, 89, 93], // Aqua   A4 D5 F5 G5 A5 D6 F6 A6
  [69, 72, 76, 81, 83, 84, 88, 95], // Aria   A4 C5 E5 A5 B5 C6 E6 B6
  [67, 71, 74, 79, 83, 86, 91, 93], // Ignis  G4 B4 D5 G5 B5 D6 G6 A6
];
pub const KOSHI_TUNING_NAMES: [&str; NUM_TUNINGS] = ["Terra", "Aqua", "Aria", "Ignis"];

/// Tube/plate resonances measured on each instrument (Hz).
const BODY_FREQS: [[f32; NUM_BODY]; NUM_TUNINGS] = [
  [167.0, 213.0, 253.0],
  [187.0, 224.0, 284.0],
  [168.0, 212.0, 321.0],
  [188.0, 251.0, 284.0],
];
const BODY_LEVEL_DB: [f32; NUM_BODY] = [-24.0, -21.0, -18.0];
const BODY_T60: [f32; NUM_BODY] = [3.0, 2.0, 2.5];

/// Stretched tuning: cents = STRETCH_CENTS_PER_OCT * log2(f / STRETCH_CENTER_HZ).
const STRETCH_CENTS_PER_OCT: f32 = 28.0;
const STRETCH_CENTER_HZ: f32 = 1250.0;

const STRIKE_PULSE_MS: f32 = 0.1;
const TICK_MS: f32 = 2.0;
const GATE_OUT_MS: f32 = 10.0;
const LN_1000: f32 = 6.907_755;

// ---------------------------------------------------------------------------
// Clapper physics (2D pendulum inside the ring of rods, radius 1)
// ---------------------------------------------------------------------------
const PENDULUM_HZ: f32 = 1.7;
const PENDULUM_ZETA: f32 = 0.12;
const RESTITUTION: f32 = 0.3;
/// Force scale: F = WIND_FORCE * wind^WIND_EXP (units of pendulum acceleration).
/// The pendulum answers to the FLUCTUATIONS of the wind (turbulence std ≈ 1);
/// the steady component (WIND_STEADY) only displaces its rest point.
const WIND_FORCE: f32 = 90.0;
const WIND_EXP: f32 = 0.75;
const WIND_STEADY: f32 = 0.3;
/// Normal velocity that maps to a full-velocity strike; below VN_MIN the contact is a
/// graze: inelastic, silent (this is what kills bouncing-ball chatter on one rod).
const VN_FULL: f32 = 16.0;
const VN_MIN: f32 = 0.8;
const ROD_REFRACTORY_MS: f32 = 50.0;
/// Two rods cannot sound closer than this (measured p10 of inter-onset ≈ 80 ms).
const GLOBAL_REFRACTORY_MS: f32 = 35.0;

#[derive(Clone, Copy, Default)]
struct Mode {
  cos_w: f32,
  sin_w: f32,
  decay: f32,
  gain: f32,
  s1: f32,
  s2: f32,
}

impl Mode {
  #[inline]
  fn set(&mut self, freq: f32, t60: f32, gain: f32, sample_rate: f32) {
    let w = 2.0 * PI * freq / sample_rate;
    self.cos_w = w.cos();
    self.sin_w = w.sin();
    self.decay = (-LN_1000 / (t60.max(0.05) * sample_rate)).exp();
    self.gain = gain;
  }

  #[inline]
  fn tick(&mut self, exc: f32) -> f32 {
    let s1 = self.decay * (self.cos_w * self.s1 - self.sin_w * self.s2) + exc;
    let s2 = self.decay * (self.sin_w * self.s1 + self.cos_w * self.s2);
    self.s1 = s1;
    self.s2 = s2;
    // sine component: smooth onset (velocity excitation), no click
    s2
  }
}

#[derive(Clone, Copy, Default)]
struct Rod {
  modes: [Mode; NUM_MODES],
  midi: i32,
  pan_l: f32,
  pan_r: f32,
  pulse_left: u32,
  pulse_len: u32,
  pulse_vel: f32,
  refractory: u32,
}

/// Slow, normalised (std ≈ 1) low-passed noise.
#[derive(Clone, Copy, Default)]
struct SlowNoise {
  a: f32,
  norm: f32,
  y: f32,
}

impl SlowNoise {
  fn new(cutoff_hz: f32, sample_rate: f32) -> Self {
    let a = (2.0 * PI * cutoff_hz / sample_rate).min(1.0);
    // white noise in [-1,1] has var 1/3; one-pole LP output var ≈ var_in * a/2
    let norm = (6.0 / a).sqrt();
    Self { a, norm, y: 0.0 }
  }

  #[inline]
  fn tick(&mut self, white: f32) -> f32 {
    self.y += self.a * (white - self.y);
    self.y * self.norm
  }
}

#[derive(Clone, Copy)]
pub struct KoshiParams {
  pub tuning: i32,     // 0 Terra, 1 Aqua, 2 Aria, 3 Ignis
  pub wind: f32,       // 0-1 (added to the wind CV)
  pub gust: f32,       // 0-1 gust depth (0 = steady breeze)
  pub sustain: f32,    // T60 multiplier (0.25-2)
  pub brightness: f32, // 0-1 balance of upper partials
  pub body: f32,       // 0-1 tube resonance level
  pub tune: f32,       // cents
  pub octave: i32,     // -2..1
  pub seed: i32,       // random seed (two chimes in a patch must differ)
  pub level: f32,      // output level
}

pub struct KoshiInputs<'a> {
  pub wind_cv: Option<&'a [f32]>,
  pub gate: Option<&'a [f32]>,
  pub pitch_cv: Option<&'a [f32]>,
  pub vel_cv: Option<&'a [f32]>,
}

pub struct Koshi {
  sample_rate: f32,
  rods: [Rod; NUM_RODS],
  body: [Mode; NUM_BODY],
  body_gain: [f32; NUM_BODY],

  // cached coefficient inputs
  coef_key: (i32, i32, i32, i32, i32),

  // clapper
  px: f32,
  py: f32,
  vx: f32,
  vy: f32,
  theta: f32,
  gust_lp: SlowNoise,
  dir_lp: SlowNoise,
  turb_x: SlowNoise,
  turb_y: SlowNoise,

  // strike side-effects
  tick_left: u32,
  tick_len: u32,
  tick_vel: f32,
  tick_lp: f32,
  tick_pan_l: f32,
  tick_pan_r: f32,
  gate_left: u32,
  global_refractory: u32,
  last_cv: f32,
  last_rod: usize,
  strike_count: u32,

  noise_state: u32,
  seed: i32,
  prev_gate: f32,
  wind_force: f32,
}

impl Koshi {
  pub fn new(sample_rate: f32) -> Self {
    let mut k = Self {
      sample_rate,
      rods: [Rod::default(); NUM_RODS],
      body: [Mode::default(); NUM_BODY],
      body_gain: [0.0; NUM_BODY],
      coef_key: (i32::MIN, 0, 0, 0, 0),
      px: 0.0,
      py: 0.0,
      vx: 0.0,
      vy: 0.0,
      theta: 0.0,
      gust_lp: SlowNoise::new(0.2, sample_rate),
      dir_lp: SlowNoise::new(0.5, sample_rate),
      turb_x: SlowNoise::new(3.0, sample_rate),
      turb_y: SlowNoise::new(3.0, sample_rate),
      tick_left: 0,
      tick_len: 1,
      tick_vel: 0.0,
      tick_lp: 0.0,
      tick_pan_l: 0.7,
      tick_pan_r: 0.7,
      gate_left: 0,
      global_refractory: 0,
      last_cv: 0.0,
      last_rod: 0,
      strike_count: 0,
      noise_state: 0x9E37_79B9,
      seed: i32::MIN,
      prev_gate: 0.0,
      wind_force: WIND_FORCE,
    };
    for (i, rod) in k.rods.iter_mut().enumerate() {
      // rods sit on a circle; pan follows the horizontal position (equal power)
      let x = (2.0 * PI * i as f32 / NUM_RODS as f32).cos();
      let pan = 0.5 + 0.3 * x;
      rod.pan_l = (pan * PI * 0.5).cos();
      rod.pan_r = (pan * PI * 0.5).sin();
    }
    k
  }

  #[inline]
  fn noise(&mut self) -> f32 {
    self.noise_state = self.noise_state.wrapping_mul(1664525).wrapping_add(1013904223);
    (self.noise_state >> 8) as f32 / 8_388_608.0 - 1.0
  }

  /// Notes of a tuning (MIDI), for the UI and the tests.
  pub fn tuning_notes(tuning: i32) -> [u8; NUM_RODS] {
    TUNINGS[(tuning.clamp(0, NUM_TUNINGS as i32 - 1)) as usize]
  }

  pub fn sample_rate(&self) -> f32 {
    self.sample_rate
  }

  pub fn strike_count(&self) -> u32 {
    self.strike_count
  }

  pub fn last_rod(&self) -> usize {
    self.last_rod
  }

  // ---- measured curves ---------------------------------------------------

  /// Decay time vs absolute frequency (median of 32 rods × 4 partials).
  fn t60_for(f: f32) -> f32 {
    (6.0 / (1.0 + (f / 2800.0).powi(3))).max(0.15)
  }

  /// Long-term level of a rod's fundamental vs its frequency (dB, 0 = loudest ≈ 1.1 kHz).
  fn rod_level_db(f0: f32) -> f32 {
    let low = -10.0 + 7.0 * (f0 / 400.0).log2();
    let high = -12.0 * (f0 / 1100.0).log2();
    low.min(high)
  }

  /// Level of partial `k` relative to the fundamental of a rod at `f0` (dB, long-term).
  fn mode_level_db(k: usize, f0: f32) -> f32 {
    let l = (f0 / 400.0).log2();
    match k {
      0 => 0.0,
      1 => (6.0 - 11.0 * l).clamp(-12.0, 8.0),
      2 => (-10.0 * l).clamp(-50.0, 6.0),
      _ => (-8.0 - 14.0 * l).clamp(-60.0, 2.0),
    }
  }

  fn update_coefficients(&mut self, p: &KoshiParams) {
    let key = (
      p.tuning,
      p.octave,
      (p.tune * 10.0) as i32,
      (p.sustain * 1000.0) as i32,
      (p.brightness * 1000.0) as i32,
    );
    if key == self.coef_key {
      return;
    }
    self.coef_key = key;

    let tuning = p.tuning.clamp(0, NUM_TUNINGS as i32 - 1) as usize;
    let octave = p.octave.clamp(-2, 1);
    let sustain = p.sustain.clamp(0.25, 2.0);
    let sr = self.sample_rate;

    for (i, rod) in self.rods.iter_mut().enumerate() {
      let midi_nom = TUNINGS[tuning][i] as i32;
      rod.midi = midi_nom + 12 * octave;
      let f_nom = 440.0 * 2f32.powf((midi_nom - 69) as f32 / 12.0);
      // stretch is a property of the rod (computed on the unshifted note), octave transposes exactly
      let stretch = STRETCH_CENTS_PER_OCT * (f_nom / STRETCH_CENTER_HZ).log2();
      let f0 = f_nom * 2f32.powf((p.tune + stretch) / 1200.0 + octave as f32);

      let t60_1 = Self::t60_for(f0) * sustain;
      let rod_db = Self::rod_level_db(f0);
      for (k, mode) in rod.modes.iter_mut().enumerate() {
        let f = f0 * MODE_RATIOS[k];
        if f >= sr * 0.45 {
          mode.set(1000.0, 0.1, 0.0, sr);
          continue;
        }
        let t60 = Self::t60_for(f) * sustain;
        // measured levels are long-term averages: a fast-decaying partial needs a
        // higher initial amplitude to show the same average energy
        let decay_comp = 10.0 * (t60_1 / t60).log10();
        let bright = (p.brightness.clamp(0.0, 1.0) - 0.5) * 16.0 * (k as f32 / 3.0);
        let db = rod_db + Self::mode_level_db(k, f0) + decay_comp + bright;
        mode.set(f, t60, 10f32.powf(db / 20.0), sr);
      }
    }

    for (k, mode) in self.body.iter_mut().enumerate() {
      mode.set(BODY_FREQS[tuning][k], BODY_T60[k], 1.0, sr);
      self.body_gain[k] = 10f32.powf((BODY_LEVEL_DB[k] + 3.0) / 20.0);
    }
  }

  fn strike(&mut self, rod: usize, vel: f32, body: f32) {
    let vel = vel.clamp(0.0, 1.0);
    if vel <= 0.0 {
      return;
    }
    let rod_i = rod.min(NUM_RODS - 1);
    let pulse_len = ((STRIKE_PULSE_MS * 0.001 * self.sample_rate) as u32).max(2);
    {
      let r = &mut self.rods[rod_i];
      r.pulse_len = pulse_len;
      r.pulse_left = pulse_len;
      r.pulse_vel = vel;
      self.tick_pan_l = r.pan_l;
      self.tick_pan_r = r.pan_r;
      self.last_cv = (r.midi - 60) as f32 / 12.0;
    }
    // tube resonance: every strike kicks the body
    for k in 0..NUM_BODY {
      self.body[k].s1 += vel * self.body_gain[k] * body * 2.0;
    }
    // contact tick
    self.tick_len = ((TICK_MS * 0.001 * self.sample_rate) as u32).max(1);
    self.tick_left = self.tick_len;
    self.tick_vel = vel;
    self.gate_left = ((GATE_OUT_MS * 0.001 * self.sample_rate) as u32).max(1);
    self.last_rod = rod_i;
    self.strike_count = self.strike_count.wrapping_add(1);
  }

  fn nearest_rod(&self, midi: f32) -> usize {
    let mut best = 0;
    let mut best_d = f32::MAX;
    for (i, rod) in self.rods.iter().enumerate() {
      let d = (rod.midi as f32 - midi).abs();
      if d < best_d {
        best_d = d;
        best = i;
      }
    }
    best
  }

  /// One step of the clapper pendulum; returns a strike (rod, velocity) on contact.
  #[inline]
  fn clapper_step(&mut self, wind: f32, gust: f32) -> Option<(usize, f32)> {
    let dt = 1.0 / self.sample_rate;
    let w0 = 2.0 * PI * PENDULUM_HZ;

    // wind field: slowly turning direction, lognormal gusts, fast 2D turbulence
    let n_gust = self.noise();
    let n_dir = self.noise();
    let n_tx = self.noise();
    let n_ty = self.noise();
    let g = self.gust_lp.tick(n_gust);
    let env = (gust * 1.2 * g).exp();
    let turn = self.dir_lp.tick(n_dir);
    self.theta += turn * dt * 2.0 * (0.3 + gust);
    let tx = self.turb_x.tick(n_tx);
    let ty = self.turb_y.tick(n_ty);
    let force = self.wind_force * wind.powf(WIND_EXP) * env;
    let fx = force * (WIND_STEADY * self.theta.cos() + tx);
    let fy = force * (WIND_STEADY * self.theta.sin() + ty);

    // damped pendulum, semi-implicit Euler
    let ax = -w0 * w0 * self.px - 2.0 * PENDULUM_ZETA * w0 * self.vx + fx;
    let ay = -w0 * w0 * self.py - 2.0 * PENDULUM_ZETA * w0 * self.vy + fy;
    self.vx += ax * dt;
    self.vy += ay * dt;
    self.px += self.vx * dt;
    self.py += self.vy * dt;

    let r2 = self.px * self.px + self.py * self.py;
    if r2 < 1.0 {
      return None;
    }
    let r = r2.sqrt();
    let nx = self.px / r;
    let ny = self.py / r;
    let vn = self.vx * nx + self.vy * ny;
    self.px = nx * 0.995;
    self.py = ny * 0.995;
    if vn <= 0.0 {
      return None;
    }
    if vn < VN_MIN {
      // graze: inelastic contact, the clapper rests against the rod
      self.vx -= vn * nx;
      self.vy -= vn * ny;
      return None;
    }
    // reflect the normal velocity
    self.vx -= (1.0 + RESTITUTION) * vn * nx;
    self.vy -= (1.0 + RESTITUTION) * vn * ny;
    let angle = self.py.atan2(self.px);
    let idx = (angle / (2.0 * PI) * NUM_RODS as f32).round() as i32;
    let rod = idx.rem_euclid(NUM_RODS as i32) as usize;
    if self.rods[rod].refractory > 0 || self.global_refractory > 0 {
      return None;
    }
    self.rods[rod].refractory = (ROD_REFRACTORY_MS * 0.001 * self.sample_rate) as u32;
    self.global_refractory = (GLOBAL_REFRACTORY_MS * 0.001 * self.sample_rate) as u32;
    let vel = ((vn - VN_MIN) / (VN_FULL - VN_MIN)).clamp(0.0, 1.0).powf(0.7);
    Some((rod, vel.max(0.05)))
  }

  pub fn process_block(
    &mut self,
    out_l: &mut [f32],
    out_r: &mut [f32],
    gate_out: &mut [f32],
    cv_out: &mut [f32],
    inputs: KoshiInputs,
    params: KoshiParams,
  ) {
    let frames = out_l.len().min(out_r.len()).min(gate_out.len()).min(cv_out.len());
    if params.seed != self.seed {
      self.seed = params.seed;
      self.noise_state = (params.seed as u32).wrapping_mul(2654435761).wrapping_add(0x9E37_79B9);
    }
    self.update_coefficients(&params);

    let gust = params.gust.clamp(0.0, 1.0);
    let body = params.body.clamp(0.0, 1.0);
    let level = params.level.clamp(0.0, 2.0) * 0.28;
    let tick_a = (2.0 * PI * 5000.0 / self.sample_rate).min(1.0);
    let body_pan = 0.7071;

    for i in 0..frames {
      // --- manual strike (gate rising edge) ---
      if let Some(gate) = inputs.gate {
        let g = gate[i];
        if g > 0.5 && self.prev_gate <= 0.5 {
          let rod = match inputs.pitch_cv {
            Some(cv) => self.nearest_rod(60.0 + 12.0 * cv[i]),
            None => {
              let n = self.noise();
              (((n + 1.0) * 0.5 * NUM_RODS as f32) as usize).min(NUM_RODS - 1)
            }
          };
          let vel = match inputs.vel_cv {
            Some(v) => v[i].clamp(0.0, 1.0),
            None => 0.8,
          };
          self.strike(rod, vel, body);
        }
        self.prev_gate = g;
      }

      // --- wind ---
      if self.global_refractory > 0 {
        self.global_refractory -= 1;
      }
      let wind = (params.wind + inputs.wind_cv.map_or(0.0, |w| w[i])).clamp(0.0, 1.0);
      if wind > 0.0 {
        if let Some((rod, vel)) = self.clapper_step(wind, gust) {
          self.strike(rod, vel, body);
        }
      }

      // --- rods ---
      let mut l = 0.0;
      let mut r = 0.0;
      for rod in self.rods.iter_mut() {
        if rod.refractory > 0 {
          rod.refractory -= 1;
        }
        let exc = if rod.pulse_left > 0 {
          let n = (rod.pulse_len - rod.pulse_left) as f32;
          rod.pulse_left -= 1;
          // raised cosine pulse, unit area
          let w = 0.5 * (1.0 - (2.0 * PI * n / rod.pulse_len as f32).cos());
          rod.pulse_vel * w * 2.0 / rod.pulse_len as f32
        } else {
          0.0
        };
        let mut s = 0.0;
        for mode in rod.modes.iter_mut() {
          s += mode.tick(exc * mode.gain);
        }
        l += s * rod.pan_l;
        r += s * rod.pan_r;
      }

      // --- body (tube) ---
      let mut b = 0.0;
      for mode in self.body.iter_mut() {
        b += mode.tick(0.0);
      }
      l += b * body_pan;
      r += b * body_pan;

      // --- contact tick ---
      if self.tick_left > 0 {
        let env = self.tick_left as f32 / self.tick_len as f32;
        self.tick_left -= 1;
        let n = self.noise();
        self.tick_lp += tick_a * (n - self.tick_lp);
        let t = self.tick_lp * env * self.tick_vel * 0.18;
        l += t * self.tick_pan_l;
        r += t * self.tick_pan_r;
      }

      out_l[i] = l * level;
      out_r[i] = r * level;

      // --- strike reporting ---
      if self.gate_left > 0 {
        self.gate_left -= 1;
        gate_out[i] = 1.0;
      } else {
        gate_out[i] = 0.0;
      }
      cv_out[i] = self.last_cv;
    }
  }

  pub fn reset(&mut self) {
    for rod in self.rods.iter_mut() {
      for m in rod.modes.iter_mut() {
        m.s1 = 0.0;
        m.s2 = 0.0;
      }
      rod.pulse_left = 0;
    }
    for m in self.body.iter_mut() {
      m.s1 = 0.0;
      m.s2 = 0.0;
    }
    self.px = 0.0;
    self.py = 0.0;
    self.vx = 0.0;
    self.vy = 0.0;
    self.tick_left = 0;
    self.gate_left = 0;
    self.prev_gate = 0.0;
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn params(wind: f32, gust: f32) -> KoshiParams {
    KoshiParams {
      tuning: 0,
      wind,
      gust,
      sustain: 1.0,
      brightness: 0.5,
      body: 0.5,
      tune: 0.0,
      octave: 0,
      seed: 1,
      level: 1.0,
    }
  }

  /// Runs `seconds` of wind and returns strike times (s) and the output peak.
  fn simulate(wind: f32, gust: f32, seconds: f32) -> (Vec<f32>, f32) {
    simulate_force(wind, gust, seconds, WIND_FORCE)
  }

  fn simulate_force(wind: f32, gust: f32, seconds: f32, wind_force: f32) -> (Vec<f32>, f32) {
    let sr = 48000.0;
    let mut k = Koshi::new(sr);
    k.wind_force = wind_force;
    let frames = 128;
    let mut l = vec![0.0; frames];
    let mut r = vec![0.0; frames];
    let mut g = vec![0.0; frames];
    let mut cv = vec![0.0; frames];
    let blocks = (seconds * sr / frames as f32) as usize;
    let mut times = Vec::new();
    let mut prev_count = 0;
    let mut peak: f32 = 0.0;
    for b in 0..blocks {
      k.process_block(
        &mut l,
        &mut r,
        &mut g,
        &mut cv,
        KoshiInputs { wind_cv: None, gate: None, pitch_cv: None, vel_cv: None },
        params(wind, gust),
      );
      for &s in l.iter() {
        assert!(s.is_finite());
        peak = peak.max(s.abs());
      }
      if k.strike_count() != prev_count {
        times.push(b as f32 * frames as f32 / sr);
        prev_count = k.strike_count();
      }
    }
    (times, peak)
  }

  #[test]
  fn wind_strike_rates() {
    let secs = 40.0;
    for &wf in &[WIND_FORCE] {
      for &(wind, gust) in &[(0.15, 0.5), (0.3, 0.5), (0.5, 0.5), (0.5, 0.0), (0.7, 0.5), (1.0, 0.5)] {
        let (t, peak) = simulate_force(wind, gust, secs, wf);
        let n = t.len();
        let mut ioi: Vec<f32> = t.windows(2).map(|w| w[1] - w[0]).collect();
        ioi.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let med = if ioi.is_empty() { 0.0 } else { ioi[ioi.len() / 2] };
        let short = ioi.iter().filter(|&&d| d < 0.06).count();
        let gaps = ioi.iter().filter(|&&d| d > 0.6).count();
        eprintln!(
          "force={wf:.0} wind={wind:.2} gust={gust:.1}: {n} strikes = {:.2}/s  IOI med={:.0}ms  <60ms={short}  >600ms={gaps}  peak={peak:.3}",
          n as f32 / secs,
          med * 1000.0
        );
      }
    }
    let (t_low, _) = simulate(0.15, 0.5, 60.0);
    let (t_mid, _) = simulate(0.5, 0.5, 60.0);
    let (t_high, _) = simulate(1.0, 0.5, 60.0);
    assert!(t_low.len() < t_mid.len() && t_mid.len() < t_high.len(), "strike rate must grow with wind");
    assert!(t_mid.len() > 30, "medium wind should strike at least every 2 s on average");
  }

  /// Debug bench: KOSHI_DUMP=path strikes each rod once (3 s apart, wind 0) and writes raw f32.
  #[test]
  fn dump_isolated_strikes() {
    let Ok(path) = std::env::var("KOSHI_DUMP") else { return };
    let sr = 48000.0;
    let mut k = Koshi::new(sr);
    if let Ok(wind) = std::env::var("KOSHI_DUMP_WIND") {
      // wind mode instead: 45 s of autonomous playing, mono downmix
      let wind: f32 = wind.parse().unwrap();
      let frames = 512;
      let (mut l, mut r, mut g, mut cv) = (vec![0.0; frames], vec![0.0; frames], vec![0.0; frames], vec![0.0; frames]);
      let mut out: Vec<f32> = Vec::new();
      let mut strikes = 0;
      for _ in 0..(45.0 * sr / frames as f32) as usize {
        let before = k.strike_count();
        k.process_block(&mut l, &mut r, &mut g, &mut cv,
          KoshiInputs { wind_cv: None, gate: None, pitch_cv: None, vel_cv: None },
          KoshiParams { seed: 3, ..params(wind, 0.5) });
        if k.strike_count() != before { strikes += 1; }
        for i in 0..frames { out.push(0.5 * (l[i] + r[i])); }
      }
      eprintln!("wind dump: {strikes} strike-blocks in 45 s");
      let mut bytes = Vec::with_capacity(out.len() * 4);
      for &v in &out { bytes.extend_from_slice(&v.to_le_bytes()); }
      std::fs::write(&path, bytes).unwrap();
      return;
    }
    let frames = 128;
    let mut l = vec![0.0; frames];
    let mut r = vec![0.0; frames];
    let mut g = vec![0.0; frames];
    let mut cv = vec![0.0; frames];
    let mut out: Vec<f32> = Vec::new();
    let notes = Koshi::tuning_notes(0);
    for rod in 0..NUM_RODS {
      let pitch = vec![(notes[rod] as f32 - 60.0) / 12.0; frames];
      let blocks = (3.0 * sr / frames as f32) as usize;
      for b in 0..blocks {
        let gate_v = if b == 0 { 1.0 } else { 0.0 };
        let gate = vec![gate_v; frames];
        k.process_block(&mut l, &mut r, &mut g, &mut cv,
          KoshiInputs { wind_cv: None, gate: Some(&gate), pitch_cv: Some(&pitch), vel_cv: None },
          params(0.0, 0.0));
        for i in 0..frames { out.push(0.5 * (l[i] + r[i])); }
      }
    }
    let mut bytes = Vec::with_capacity(out.len() * 4);
    for &v in &out { bytes.extend_from_slice(&v.to_le_bytes()); }
    std::fs::write(&path, bytes).unwrap();
  }

  #[test]
  fn silent_without_wind_or_gate() {
    let (t, peak) = simulate(0.0, 0.5, 5.0);
    assert!(t.is_empty());
    assert!(peak == 0.0);
  }

  #[test]
  fn gate_strikes_nearest_rod() {
    let sr = 48000.0;
    let mut k = Koshi::new(sr);
    let frames = 64;
    let mut l = vec![0.0; frames];
    let mut r = vec![0.0; frames];
    let mut g = vec![0.0; frames];
    let mut cv = vec![0.0; frames];
    let gate = vec![1.0; frames];
    let pitch = vec![(84.0 - 60.0) / 12.0; frames]; // C6 → rod 5 of Terra
    k.process_block(
      &mut l,
      &mut r,
      &mut g,
      &mut cv,
      KoshiInputs { wind_cv: None, gate: Some(&gate), pitch_cv: Some(&pitch), vel_cv: None },
      params(0.0, 0.0),
    );
    assert_eq!(k.last_rod(), 5);
    assert_eq!(k.strike_count(), 1);
    assert!(g[0] == 1.0 && cv[0] == 2.0);
    assert!(l.iter().any(|&s| s != 0.0));
  }
}
