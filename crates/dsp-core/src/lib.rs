// =============================================================================
// DSP Core Library
// =============================================================================
//
// This crate provides digital signal processing modules for audio synthesis.
// All modules are designed to be sample-rate agnostic and work across
// Web (WASM), Standalone (Tauri), and Plugin (VST/CLAP) targets.
//
// ## Module Organization
//
// - `common` - Shared types (Sample, ProcessContext) and utilities
// - Oscillators: Vco, Supersaw, Karplus, NesOsc, SnesOsc, Tb303, FmOperator
// - Filters: Vcf (SVF/Ladder), Hpf
// - Effects: Delay, Reverb, Chorus, Ensemble, Phaser, Distortion, etc.
// - Modulators: Lfo, Adsr, SampleHold, SlewLimiter, Quantizer
// - Sequencers: StepSequencer, DrumSequencer, Arpeggiator, Euclidean, Clock
// - Drums: TR-909 emulations (Kick, Snare, HiHat, Clap, Tom, Rimshot)

pub mod common;
pub mod oscillators;
pub mod filters;
pub mod effects;

// Re-export common types at crate root for convenience
pub use common::{
    clamp, input_at, midi_to_freq, poly_blep, sample_at, saturate, freq_to_midi,
    Node, ProcessContext, Sample,
    A4_FREQ, A4_MIDI, SEMITONES_PER_OCTAVE,
};

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

pub struct VcoParams<'a> {
  pub base_freq: &'a [Sample],
  pub waveform: &'a [Sample],
  pub pwm: &'a [Sample],
  pub fm_lin_depth: &'a [Sample],
  pub fm_exp_depth: &'a [Sample],
  pub unison: &'a [Sample],
  pub detune: &'a [Sample],
  pub sub_mix: &'a [Sample],
  pub sub_oct: &'a [Sample],
}

pub struct VcoInputs<'a> {
  pub pitch: Option<&'a [Sample]>,
  pub fm_lin: Option<&'a [Sample]>,
  pub fm_audio: Option<&'a [Sample]>,
  pub fm_exp: Option<&'a [Sample]>,
  pub pwm: Option<&'a [Sample]>,
  pub sync: Option<&'a [Sample]>,
}

impl Vco {
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

        let voice_sample = if wave_index < 0.5 {
          (std::f32::consts::TAU * phase).sin()
        } else if wave_index < 1.5 {
          let mut square = if phase < 0.5 { 1.0 } else { -1.0 };
          square += poly_blep(phase, dt);
          square -= poly_blep((phase - 0.5).rem_euclid(1.0), dt);
          let tri = &mut self.tri_states[v];
          *tri += square * (2.0 * voice_freq / self.sample_rate);
          *tri = tri.clamp(-1.0, 1.0);
          *tri
        } else if wave_index < 2.5 {
          let mut saw = 2.0 * phase - 1.0;
          saw -= poly_blep(phase, dt);
          saw
        } else {
          let mut pulse = if phase < self.pwm_smooth { 1.0 } else { -1.0 };
          pulse += poly_blep(phase, dt);
          pulse -= poly_blep((phase - self.pwm_smooth).rem_euclid(1.0), dt);
          pulse
        };
        sample += voice_sample;

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

pub struct Noise {
  seed: u32,
  pink: [f32; 7],
  brown: f32,
}

pub struct NoiseParams<'a> {
  pub level: &'a [Sample],
  pub noise_type: &'a [Sample],
}

pub struct RingMod;

pub struct RingModParams<'a> {
  pub level: &'a [Sample],
}

pub struct SampleHold {
  last_trigger: f32,
  held: f32,
  seed: u32,
}

pub struct SampleHoldInputs<'a> {
  pub input: Option<&'a [Sample]>,
  pub trigger: Option<&'a [Sample]>,
}

pub struct SampleHoldParams<'a> {
  pub mode: &'a [Sample],
}

pub struct SlewLimiter {
  sample_rate: f32,
  value: f32,
}

pub struct SlewInputs<'a> {
  pub input: Option<&'a [Sample]>,
}

pub struct SlewParams<'a> {
  pub rise: &'a [Sample],
  pub fall: &'a [Sample],
}

pub struct Quantizer;

pub struct QuantizerInputs<'a> {
  pub input: Option<&'a [Sample]>,
}

pub struct QuantizerParams<'a> {
  pub root: &'a [Sample],
  pub scale: &'a [Sample],
}

impl Noise {
  pub fn new() -> Self {
    Self {
      seed: 0x1234_5678,
      pink: [0.0; 7],
      brown: 0.0,
    }
  }

  fn next_white(&mut self) -> f32 {
    self.seed = self
      .seed
      .wrapping_mul(1664525)
      .wrapping_add(1013904223);
    let raw = (self.seed >> 9) as f32 / 8_388_608.0;
    raw * 2.0 - 1.0
  }

  fn next_pink(&mut self) -> f32 {
    let white = self.next_white();
    self.pink[0] = 0.99886 * self.pink[0] + white * 0.0555179;
    self.pink[1] = 0.99332 * self.pink[1] + white * 0.0750759;
    self.pink[2] = 0.96900 * self.pink[2] + white * 0.1538520;
    self.pink[3] = 0.86650 * self.pink[3] + white * 0.3104856;
    self.pink[4] = 0.55000 * self.pink[4] + white * 0.5329522;
    self.pink[5] = -0.7616 * self.pink[5] - white * 0.0168980;
    let pink =
      self.pink[0]
        + self.pink[1]
        + self.pink[2]
        + self.pink[3]
        + self.pink[4]
        + self.pink[5]
        + self.pink[6]
        + white * 0.5362;
    self.pink[6] = white * 0.115926;
    pink * 0.11
  }

  fn next_brown(&mut self) -> f32 {
    let white = self.next_white();
    self.brown = (self.brown + white * 0.02).clamp(-1.0, 1.0);
    self.brown * 3.5
  }

  pub fn process_block(&mut self, output: &mut [Sample], params: NoiseParams<'_>) {
    if output.is_empty() {
      return;
    }
    for i in 0..output.len() {
      let level = sample_at(params.level, i, 0.4).clamp(0.0, 1.0);
      let color = sample_at(params.noise_type, i, 0.0);
      let noise = if color < 0.5 {
        self.next_white()
      } else if color < 1.5 {
        self.next_pink()
      } else {
        self.next_brown()
      };
      output[i] = noise * level;
    }
  }
}

impl RingMod {
  pub fn process_block(
    output: &mut [Sample],
    input_a: Option<&[Sample]>,
    input_b: Option<&[Sample]>,
    params: RingModParams<'_>,
  ) {
    if output.is_empty() {
      return;
    }
    for i in 0..output.len() {
      let a = input_at(input_a, i);
      let b = input_at(input_b, i);
      let level = sample_at(params.level, i, 1.0);
      output[i] = a * b * level;
    }
  }
}

impl SampleHold {
  pub fn new() -> Self {
    Self {
      last_trigger: 0.0,
      held: 0.0,
      seed: 0x1234_5678,
    }
  }

  fn next_random(&mut self) -> f32 {
    self.seed = self
      .seed
      .wrapping_mul(1664525)
      .wrapping_add(1013904223);
    let raw = (self.seed >> 9) as f32 / 8_388_608.0;
    raw * 2.0 - 1.0
  }

  pub fn process_block(
    &mut self,
    output: &mut [Sample],
    inputs: SampleHoldInputs<'_>,
    params: SampleHoldParams<'_>,
  ) {
    if output.is_empty() {
      return;
    }
    for i in 0..output.len() {
      let trigger = input_at(inputs.trigger, i);
      if trigger > 0.5 && self.last_trigger <= 0.5 {
        let mode = sample_at(params.mode, i, 0.0);
        if mode < 0.5 {
          self.held = input_at(inputs.input, i);
        } else {
          self.held = self.next_random();
        }
      }
      self.last_trigger = trigger;
      output[i] = self.held;
    }
  }
}

impl SlewLimiter {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      value: 0.0,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  pub fn process_block(
    &mut self,
    output: &mut [Sample],
    inputs: SlewInputs<'_>,
    params: SlewParams<'_>,
  ) {
    if output.is_empty() {
      return;
    }

    for i in 0..output.len() {
      let target = input_at(inputs.input, i);
      let rise = sample_at(params.rise, i, 0.05).max(0.0);
      let fall = sample_at(params.fall, i, 0.05).max(0.0);
      let time = if target >= self.value { rise } else { fall };
      let coeff = if time <= 0.0001 {
        1.0
      } else {
        1.0 - (-1.0 / (time * self.sample_rate)).exp()
      };
      self.value += (target - self.value) * coeff;
      output[i] = self.value;
    }
  }
}

const SCALE_CHROMATIC: [i32; 12] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const SCALE_MAJOR: [i32; 7] = [0, 2, 4, 5, 7, 9, 11];
const SCALE_MINOR: [i32; 7] = [0, 2, 3, 5, 7, 8, 10];
const SCALE_DORIAN: [i32; 7] = [0, 2, 3, 5, 7, 9, 10];
const SCALE_LYDIAN: [i32; 7] = [0, 2, 4, 6, 7, 9, 11];
const SCALE_MIXOLYDIAN: [i32; 7] = [0, 2, 4, 5, 7, 9, 10];
const SCALE_PENT_MAJOR: [i32; 5] = [0, 2, 4, 7, 9];
const SCALE_PENT_MINOR: [i32; 5] = [0, 3, 5, 7, 10];
const SCALES: [&[i32]; 8] = [
  &SCALE_CHROMATIC,
  &SCALE_MAJOR,
  &SCALE_MINOR,
  &SCALE_DORIAN,
  &SCALE_LYDIAN,
  &SCALE_MIXOLYDIAN,
  &SCALE_PENT_MAJOR,
  &SCALE_PENT_MINOR,
];

impl Quantizer {
  pub fn process_block(
    output: &mut [Sample],
    inputs: QuantizerInputs<'_>,
    params: QuantizerParams<'_>,
  ) {
    if output.is_empty() {
      return;
    }
    for i in 0..output.len() {
      let input = input_at(inputs.input, i);
      let root = sample_at(params.root, i, 0.0).round().clamp(0.0, 11.0) as i32;
      let scale_index = sample_at(params.scale, i, 0.0).round();
      let scale_index = if scale_index.is_finite() { scale_index as i32 } else { 0 };
      let scale_index = scale_index.clamp(0, (SCALES.len() - 1) as i32) as usize;
      let scale = SCALES[scale_index];

      let semitone = input * 12.0;
      let base_octave = (semitone / 12.0).floor() as i32;
      let mut best_note = semitone;
      let mut best_diff = f32::MAX;
      for oct in (base_octave - 1)..=(base_octave + 1) {
        for offset in scale {
          let candidate = (oct * 12 + root + offset) as f32;
          let diff = (candidate - semitone).abs();
          if diff < best_diff {
            best_diff = diff;
            best_note = candidate;
          }
        }
      }
      output[i] = best_note / 12.0;
    }
  }
}

pub struct Vca;

impl Vca {
  pub fn process_block(
    output: &mut [Sample],
    input: Option<&[Sample]>,
    cv: Option<&[Sample]>,
    gain: &[Sample],
  ) {
    if output.is_empty() {
      return;
    }

    for i in 0..output.len() {
      let source = input_at(input, i);
      let cv_value = match cv {
        Some(values) => sample_at(values, i, 1.0).max(0.0),
        None => 1.0,
      };
      let gain_value = sample_at(gain, i, 1.0);
      output[i] = source * gain_value * cv_value;
    }
  }
}

pub struct Lfo {
  sample_rate: f32,
  phase: f32,
  last_sync: f32,
}

pub struct LfoInputs<'a> {
  pub rate_cv: Option<&'a [Sample]>,
  pub sync: Option<&'a [Sample]>,
}

pub struct LfoParams<'a> {
  pub rate: &'a [Sample],
  pub shape: &'a [Sample],
  pub depth: &'a [Sample],
  pub offset: &'a [Sample],
  pub bipolar: &'a [Sample],
}

impl Lfo {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      phase: 0.0,
      last_sync: 0.0,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  pub fn process_block(&mut self, output: &mut [Sample], inputs: LfoInputs<'_>, params: LfoParams<'_>) {
    if output.is_empty() {
      return;
    }

    let shape_index = params.shape.get(0).copied().unwrap_or(0.0);
    let bipolar = params.bipolar.get(0).copied().unwrap_or(1.0) >= 0.5;
    let tau = std::f32::consts::TAU;

    for i in 0..output.len() {
      let rate_base = sample_at(params.rate, i, 2.0);
      let rate_cv = input_at(inputs.rate_cv, i);
      let sync = input_at(inputs.sync, i);
      let depth = sample_at(params.depth, i, 0.7);
      let offset = sample_at(params.offset, i, 0.0);

      if sync > 0.5 && self.last_sync <= 0.5 {
        self.phase = 0.0;
      }
      self.last_sync = sync;

      let mut rate = rate_base * 2.0_f32.powf(rate_cv);
      if !rate.is_finite() || rate < 0.0 {
        rate = 0.0;
      }
      self.phase += rate / self.sample_rate;
      if self.phase >= 1.0 {
        self.phase -= self.phase.floor();
      }

      let wave = if shape_index < 0.5 {
        (tau * self.phase).sin()
      } else if shape_index < 1.5 {
        2.0 * (2.0 * (self.phase - (self.phase + 0.5).floor())).abs() - 1.0
      } else if shape_index < 2.5 {
        2.0 * (self.phase - 0.5)
      } else if self.phase < 0.5 {
        1.0
      } else {
        -1.0
      };

      let mut sample = if bipolar {
        wave * depth + offset
      } else {
        (wave * 0.5 + 0.5) * depth + offset
      };
      sample = sample.clamp(-1.0, 1.0);
      output[i] = sample;
    }
  }
}

pub struct Adsr {
  sample_rate: f32,
  stage: u8,
  env: f32,
  last_gate: f32,
  release_step: f32,
}

pub struct AdsrInputs<'a> {
  pub gate: Option<&'a [Sample]>,
}

pub struct AdsrParams<'a> {
  pub attack: &'a [Sample],
  pub decay: &'a [Sample],
  pub sustain: &'a [Sample],
  pub release: &'a [Sample],
}

impl Adsr {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      stage: 0,
      env: 0.0,
      last_gate: 0.0,
      release_step: 0.0,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

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

      if gate > 0.5 && self.last_gate <= 0.5 {
        self.stage = 1;
        self.release_step = 0.0;
      } else if gate <= 0.5 && self.last_gate > 0.5 {
        if self.env > 0.0 {
          let release_time = release.max(0.001);
          self.release_step = self.env / (release_time * self.sample_rate);
          self.stage = 4;
        } else {
          self.stage = 0;
        }
      }
      self.last_gate = gate;

      if self.stage == 1 {
        let attack_time = attack.max(0.001);
        let attack_step = (1.0 - self.env) / (attack_time * self.sample_rate);
        self.env += attack_step;
        if self.env >= 1.0 {
          self.env = 1.0;
          self.stage = 2;
        }
      } else if self.stage == 2 {
        let decay_time = decay.max(0.001);
        let decay_step = (1.0 - sustain_level) / (decay_time * self.sample_rate);
        self.env -= decay_step;
        if self.env <= sustain_level {
          self.env = sustain_level;
          self.stage = 3;
        }
      } else if self.stage == 3 {
        self.env = sustain_level;
      } else if self.stage == 4 {
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
        self.env = 0.0;
      }

      output[i] = self.env;
    }
  }
}

pub struct Mixer;

impl Mixer {
  pub fn process_block(
    output: &mut [Sample],
    input_a: Option<&[Sample]>,
    input_b: Option<&[Sample]>,
    level_a: &[Sample],
    level_b: &[Sample],
  ) {
    if output.is_empty() {
      return;
    }

    for i in 0..output.len() {
      let level_a_value = sample_at(level_a, i, 0.6);
      let level_b_value = sample_at(level_b, i, 0.6);
      let a = input_at(input_a, i) * level_a_value;
      let b = input_at(input_b, i) * level_b_value;
      output[i] = (a + b) * 0.5;
    }
  }

  pub fn process_block_multi(
    output: &mut [Sample],
    inputs: &[Option<&[Sample]>],
    levels: &[&[Sample]],
  ) {
    if output.is_empty() {
      return;
    }
    if inputs.len() != levels.len() {
      return;
    }

    let mut active_count = 0;
    for input in inputs {
      if input.is_some() {
        active_count += 1;
      }
    }
    let scale = if active_count > 0 {
      1.0 / active_count as Sample
    } else {
      0.0
    };

    for i in 0..output.len() {
      let mut sum = 0.0;
      for (index, input) in inputs.iter().enumerate() {
        let level = sample_at(levels[index], i, 0.6);
        sum += input_at(*input, i) * level;
      }
      output[i] = sum * scale;
    }
  }
}

pub struct Delay {
  sample_rate: f32,
  buffer_l: Vec<Sample>,
  buffer_r: Vec<Sample>,
  write_index: usize,
  damp_state_l: f32,
  damp_state_r: f32,
}

pub struct DelayInputs<'a> {
  pub input_l: Option<&'a [Sample]>,
  pub input_r: Option<&'a [Sample]>,
}

pub struct DelayParams<'a> {
  pub time_ms: &'a [Sample],
  pub feedback: &'a [Sample],
  pub mix: &'a [Sample],
  pub tone: &'a [Sample],
  pub ping_pong: &'a [Sample],
}

impl Delay {
  pub fn new(sample_rate: f32) -> Self {
    let mut delay = Self {
      sample_rate: sample_rate.max(1.0),
      buffer_l: Vec::new(),
      buffer_r: Vec::new(),
      write_index: 0,
      damp_state_l: 0.0,
      damp_state_r: 0.0,
    };
    delay.allocate_buffers();
    delay
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
    self.allocate_buffers();
  }

  fn allocate_buffers(&mut self) {
    let max_delay_ms = 2000.0;
    let max_samples = ((max_delay_ms / 1000.0) * self.sample_rate).ceil() as usize + 2;
    if self.buffer_l.len() != max_samples {
      self.buffer_l = vec![0.0; max_samples];
      self.buffer_r = vec![0.0; max_samples];
      self.write_index = 0;
      self.damp_state_l = 0.0;
      self.damp_state_r = 0.0;
    }
  }

  fn read_delay(&self, buffer: &[Sample], delay_samples: f32) -> f32 {
    let size = buffer.len() as i32;
    let read_pos = self.write_index as f32 - delay_samples;
    let base_index = read_pos.floor();
    let mut index_a = base_index as i32 % size;
    if index_a < 0 {
      index_a += size;
    }
    let index_b = (index_a + 1) % size;
    let frac = read_pos - base_index;
    let a = buffer[index_a as usize];
    let b = buffer[index_b as usize];
    a + (b - a) * frac
  }

  pub fn process_block(
    &mut self,
    out_l: &mut [Sample],
    out_r: &mut [Sample],
    inputs: DelayInputs<'_>,
    params: DelayParams<'_>,
  ) {
    if out_l.is_empty() || out_r.is_empty() {
      return;
    }

    let buffer_size = self.buffer_l.len();
    let max_delay = (buffer_size as f32 - 2.0).max(1.0);

    for i in 0..out_l.len() {
      let time_ms = sample_at(params.time_ms, i, 360.0);
      let feedback = sample_at(params.feedback, i, 0.35).clamp(0.0, 0.9);
      let mix = sample_at(params.mix, i, 0.25).clamp(0.0, 1.0);
      let tone = sample_at(params.tone, i, 0.55).clamp(0.0, 1.0);
      let ping = sample_at(params.ping_pong, i, 0.0) >= 0.5;

      let delay_samples = ((time_ms * self.sample_rate) / 1000.0).clamp(1.0, max_delay);
      let in_l = input_at(inputs.input_l, i);
      let in_r = match inputs.input_r {
        Some(values) => input_at(Some(values), i),
        None => in_l,
      };

      let delayed_l = self.read_delay(&self.buffer_l, delay_samples);
      let delayed_r = self.read_delay(&self.buffer_r, delay_samples);

      let fb_source_l = if ping { delayed_r } else { delayed_l };
      let fb_source_r = if ping { delayed_l } else { delayed_r };
      let damp = 0.05 + (1.0 - tone) * 0.9;

      self.damp_state_l =
        fb_source_l * feedback * (1.0 - damp) + self.damp_state_l * damp;
      self.damp_state_r =
        fb_source_r * feedback * (1.0 - damp) + self.damp_state_r * damp;

      self.buffer_l[self.write_index] = in_l + self.damp_state_l;
      self.buffer_r[self.write_index] = in_r + self.damp_state_r;

      let dry = 1.0 - mix;
      out_l[i] = in_l * dry + delayed_l * mix;
      out_r[i] = in_r * dry + delayed_r * mix;

      self.write_index = (self.write_index + 1) % buffer_size;
    }
  }
}

pub struct Chorus {
  sample_rate: f32,
  phase: f32,
  buffer_l: Vec<Sample>,
  buffer_r: Vec<Sample>,
  write_index: usize,
}

pub struct ChorusInputs<'a> {
  pub input_l: Option<&'a [Sample]>,
  pub input_r: Option<&'a [Sample]>,
}

pub struct ChorusParams<'a> {
  pub rate: &'a [Sample],
  pub depth_ms: &'a [Sample],
  pub delay_ms: &'a [Sample],
  pub mix: &'a [Sample],
  pub feedback: &'a [Sample],
  pub spread: &'a [Sample],
}

pub struct TapeDelay {
  sample_rate: f32,
  buffer_l: Vec<Sample>,
  buffer_r: Vec<Sample>,
  write_index: usize,
  wow_phase: f32,
  flutter_phase: f32,
  damp_state_l: f32,
  damp_state_r: f32,
}

pub struct TapeDelayInputs<'a> {
  pub input_l: Option<&'a [Sample]>,
  pub input_r: Option<&'a [Sample]>,
}

pub struct TapeDelayParams<'a> {
  pub time_ms: &'a [Sample],
  pub feedback: &'a [Sample],
  pub mix: &'a [Sample],
  pub tone: &'a [Sample],
  pub wow: &'a [Sample],
  pub flutter: &'a [Sample],
  pub drive: &'a [Sample],
}

pub struct GranularDelay {
  sample_rate: f32,
  buffer_l: Vec<Sample>,
  buffer_r: Vec<Sample>,
  write_index: usize,
  grains: Vec<Grain>,
  spawn_phase: f32,
  seed: u32,
}

#[derive(Clone, Copy)]
struct Grain {
  active: bool,
  pos: f32,
  step: f32,
  age: usize,
  length: usize,
  pan: f32,
}

pub struct GranularDelayInputs<'a> {
  pub input_l: Option<&'a [Sample]>,
  pub input_r: Option<&'a [Sample]>,
}

pub struct GranularDelayParams<'a> {
  pub time_ms: &'a [Sample],
  pub size_ms: &'a [Sample],
  pub density: &'a [Sample],
  pub pitch: &'a [Sample],
  pub feedback: &'a [Sample],
  pub mix: &'a [Sample],
}

pub struct SpringReverb {
  sample_rate: f32,
  combs_l: Vec<CombFilter>,
  combs_r: Vec<CombFilter>,
  allpass_l: Vec<AllpassFilter>,
  allpass_r: Vec<AllpassFilter>,
}

pub struct SpringReverbInputs<'a> {
  pub input_l: Option<&'a [Sample]>,
  pub input_r: Option<&'a [Sample]>,
}

pub struct SpringReverbParams<'a> {
  pub decay: &'a [Sample],
  pub tone: &'a [Sample],
  pub mix: &'a [Sample],
  pub drive: &'a [Sample],
}

pub struct Ensemble {
  sample_rate: f32,
  phases: [f32; 3],
  buffer_l: Vec<Sample>,
  buffer_r: Vec<Sample>,
  write_index: usize,
}

pub struct EnsembleInputs<'a> {
  pub input_l: Option<&'a [Sample]>,
  pub input_r: Option<&'a [Sample]>,
}

pub struct EnsembleParams<'a> {
  pub rate: &'a [Sample],
  pub depth_ms: &'a [Sample],
  pub delay_ms: &'a [Sample],
  pub mix: &'a [Sample],
  pub spread: &'a [Sample],
}

impl Chorus {
  pub fn new(sample_rate: f32) -> Self {
    let mut chorus = Self {
      sample_rate: sample_rate.max(1.0),
      phase: 0.0,
      buffer_l: Vec::new(),
      buffer_r: Vec::new(),
      write_index: 0,
    };
    chorus.allocate_buffers();
    chorus
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
    self.allocate_buffers();
  }

  fn allocate_buffers(&mut self) {
    let max_delay_ms = 50.0;
    let max_samples = ((max_delay_ms / 1000.0) * self.sample_rate).ceil() as usize + 2;
    if self.buffer_l.len() != max_samples {
      self.buffer_l = vec![0.0; max_samples];
      self.buffer_r = vec![0.0; max_samples];
      self.write_index = 0;
      self.phase = 0.0;
    }
  }

  fn read_delay(&self, buffer: &[Sample], delay_samples: f32) -> f32 {
    let size = buffer.len() as i32;
    let read_pos = self.write_index as f32 - delay_samples;
    let base_index = read_pos.floor();
    let mut index_a = base_index as i32 % size;
    if index_a < 0 {
      index_a += size;
    }
    let index_b = (index_a + 1) % size;
    let frac = read_pos - base_index;
    let a = buffer[index_a as usize];
    let b = buffer[index_b as usize];
    a + (b - a) * frac
  }

  pub fn process_block(
    &mut self,
    out_l: &mut [Sample],
    out_r: &mut [Sample],
    inputs: ChorusInputs<'_>,
    params: ChorusParams<'_>,
  ) {
    if out_l.is_empty() || out_r.is_empty() {
      return;
    }

    let buffer_size = self.buffer_l.len();
    let tau = std::f32::consts::TAU;

    for i in 0..out_l.len() {
      let rate = sample_at(params.rate, i, 0.3);
      let depth_ms = sample_at(params.depth_ms, i, 8.0);
      let delay_ms = sample_at(params.delay_ms, i, 18.0);
      let mix = sample_at(params.mix, i, 0.45);
      let feedback = sample_at(params.feedback, i, 0.15);
      let spread = sample_at(params.spread, i, 0.6);

      let phase_offset = spread * std::f32::consts::PI * 0.9;
      let lfo_l = (self.phase).sin();
      let lfo_r = (self.phase + phase_offset).sin();

      let delay_l = (delay_ms + depth_ms * lfo_l) * self.sample_rate / 1000.0;
      let delay_r = (delay_ms + depth_ms * lfo_r) * self.sample_rate / 1000.0;

      let input_l = input_at(inputs.input_l, i);
      let input_r = match inputs.input_r {
        Some(values) => input_at(Some(values), i),
        None => input_l,
      };

      let delayed_l = self.read_delay(&self.buffer_l, delay_l);
      let delayed_r = self.read_delay(&self.buffer_r, delay_r);

      self.buffer_l[self.write_index] = input_l + delayed_l * feedback;
      self.buffer_r[self.write_index] = input_r + delayed_r * feedback;

      let wet = clamp(mix, 0.0, 1.0);
      let dry = 1.0 - wet;

      out_l[i] = input_l * dry + delayed_l * wet;
      out_r[i] = input_r * dry + delayed_r * wet;

      self.phase += (tau * rate) / self.sample_rate;
      if self.phase >= tau {
        self.phase -= tau;
      }
      self.write_index = (self.write_index + 1) % buffer_size;
    }
  }
}

impl TapeDelay {
  pub fn new(sample_rate: f32) -> Self {
    let mut delay = Self {
      sample_rate: sample_rate.max(1.0),
      buffer_l: Vec::new(),
      buffer_r: Vec::new(),
      write_index: 0,
      wow_phase: 0.0,
      flutter_phase: 0.0,
      damp_state_l: 0.0,
      damp_state_r: 0.0,
    };
    delay.allocate_buffers();
    delay
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
    self.allocate_buffers();
  }

  fn allocate_buffers(&mut self) {
    let max_delay_ms = 2000.0;
    let max_samples = ((max_delay_ms / 1000.0) * self.sample_rate).ceil() as usize + 2;
    if self.buffer_l.len() != max_samples {
      self.buffer_l = vec![0.0; max_samples];
      self.buffer_r = vec![0.0; max_samples];
      self.write_index = 0;
      self.wow_phase = 0.0;
      self.flutter_phase = 0.0;
      self.damp_state_l = 0.0;
      self.damp_state_r = 0.0;
    }
  }

  fn read_delay(&self, buffer: &[Sample], delay_samples: f32) -> f32 {
    let size = buffer.len() as i32;
    let read_pos = self.write_index as f32 - delay_samples;
    let base_index = read_pos.floor();
    let mut index_a = base_index as i32 % size;
    if index_a < 0 {
      index_a += size;
    }
    let index_b = (index_a + 1) % size;
    let frac = read_pos - base_index;
    let a = buffer[index_a as usize];
    let b = buffer[index_b as usize];
    a + (b - a) * frac
  }

  pub fn process_block(
    &mut self,
    out_l: &mut [Sample],
    out_r: &mut [Sample],
    inputs: TapeDelayInputs<'_>,
    params: TapeDelayParams<'_>,
  ) {
    if out_l.is_empty() || out_r.is_empty() {
      return;
    }

    let buffer_size = self.buffer_l.len();
    let tau = std::f32::consts::TAU;
    let max_delay = (buffer_size as f32 - 2.0).max(1.0);

    for i in 0..out_l.len() {
      let time_ms = sample_at(params.time_ms, i, 420.0).clamp(20.0, 2000.0);
      let feedback = sample_at(params.feedback, i, 0.35).clamp(0.0, 0.9);
      let mix = sample_at(params.mix, i, 0.35).clamp(0.0, 1.0);
      let tone = sample_at(params.tone, i, 0.55).clamp(0.0, 1.0);
      let wow = sample_at(params.wow, i, 0.2).clamp(0.0, 1.0);
      let flutter = sample_at(params.flutter, i, 0.2).clamp(0.0, 1.0);
      let drive = sample_at(params.drive, i, 0.2).clamp(0.0, 1.0);

      let wow_depth = wow * 6.0;
      let flutter_depth = flutter * 2.0;
      let wow_rate = 0.25;
      let flutter_rate = 6.0;
      let mod_ms =
        wow_depth * self.wow_phase.sin() + flutter_depth * self.flutter_phase.sin();

      let delay_samples = ((time_ms + mod_ms).clamp(5.0, 2000.0) * self.sample_rate / 1000.0)
        .clamp(1.0, max_delay);

      let input_l = input_at(inputs.input_l, i);
      let input_r = match inputs.input_r {
        Some(values) => input_at(Some(values), i),
        None => input_l,
      };

      let delayed_l = self.read_delay(&self.buffer_l, delay_samples);
      let delayed_r = self.read_delay(&self.buffer_r, delay_samples);

      let damp = 0.05 + (1.0 - tone) * 0.9;
      let drive_gain = 1.0 + drive * 6.0;
      let fb_l = saturate((input_l + delayed_l * feedback) * drive_gain);
      let fb_r = saturate((input_r + delayed_r * feedback) * drive_gain);
      self.damp_state_l = fb_l * (1.0 - damp) + self.damp_state_l * damp;
      self.damp_state_r = fb_r * (1.0 - damp) + self.damp_state_r * damp;

      self.buffer_l[self.write_index] = self.damp_state_l;
      self.buffer_r[self.write_index] = self.damp_state_r;

      let dry = 1.0 - mix;
      out_l[i] = input_l * dry + delayed_l * mix;
      out_r[i] = input_r * dry + delayed_r * mix;

      self.write_index = (self.write_index + 1) % buffer_size;
      self.wow_phase += (tau * wow_rate) / self.sample_rate;
      if self.wow_phase >= tau {
        self.wow_phase -= tau;
      }
      self.flutter_phase += (tau * flutter_rate) / self.sample_rate;
      if self.flutter_phase >= tau {
        self.flutter_phase -= tau;
      }
    }
  }
}

impl GranularDelay {
  pub fn new(sample_rate: f32) -> Self {
    let mut delay = Self {
      sample_rate: sample_rate.max(1.0),
      buffer_l: Vec::new(),
      buffer_r: Vec::new(),
      write_index: 0,
      grains: vec![
        Grain { active: false, pos: 0.0, step: 1.0, age: 0, length: 1, pan: 0.0 };
        6
      ],
      spawn_phase: 0.0,
      seed: 0x9876_5432,
    };
    delay.allocate_buffers();
    delay
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
    self.allocate_buffers();
  }

  fn allocate_buffers(&mut self) {
    let max_delay_ms = 2500.0;
    let max_samples = ((max_delay_ms / 1000.0) * self.sample_rate).ceil() as usize + 2;
    if self.buffer_l.len() != max_samples {
      self.buffer_l = vec![0.0; max_samples];
      self.buffer_r = vec![0.0; max_samples];
      self.write_index = 0;
      for grain in &mut self.grains {
        grain.active = false;
      }
    }
  }

  fn next_random(&mut self) -> f32 {
    self.seed = self
      .seed
      .wrapping_mul(1664525)
      .wrapping_add(1013904223);
    let raw = (self.seed >> 9) as f32 / 8_388_608.0;
    raw * 2.0 - 1.0
  }

  fn read_sample(buffer: &[Sample], index: f32) -> f32 {
    let size = buffer.len() as i32;
    let base = index.floor();
    let frac = index - base;
    let mut index_a = base as i32 % size;
    if index_a < 0 {
      index_a += size;
    }
    let index_b = (index_a + 1) % size;
    let a = buffer[index_a as usize];
    let b = buffer[index_b as usize];
    a + (b - a) * frac
  }

  fn spawn_grain(&mut self, delay_samples: f32, length: usize, pitch: f32, pan: f32) {
    if length == 0 {
      return;
    }
    let mut target = None;
    for (index, grain) in self.grains.iter().enumerate() {
      if !grain.active {
        target = Some(index);
        break;
      }
    }
    let index = target.unwrap_or(0);
    let grain = &mut self.grains[index];
    let mut start = self.write_index as f32 - delay_samples;
    let size = self.buffer_l.len() as f32;
    while start < 0.0 {
      start += size;
    }
    while start >= size {
      start -= size;
    }
    grain.active = true;
    grain.pos = start;
    grain.step = pitch;
    grain.age = 0;
    grain.length = length;
    grain.pan = pan;
  }

  pub fn process_block(
    &mut self,
    out_l: &mut [Sample],
    out_r: &mut [Sample],
    inputs: GranularDelayInputs<'_>,
    params: GranularDelayParams<'_>,
  ) {
    if out_l.is_empty() || out_r.is_empty() {
      return;
    }

    let buffer_size = self.buffer_l.len() as f32;

    for i in 0..out_l.len() {
      let time_ms = sample_at(params.time_ms, i, 420.0).clamp(40.0, 2000.0);
      let size_ms = sample_at(params.size_ms, i, 120.0).clamp(10.0, 500.0);
      let density = sample_at(params.density, i, 6.0).clamp(0.2, 40.0);
      let pitch = sample_at(params.pitch, i, 1.0).clamp(0.25, 2.0);
      let feedback = sample_at(params.feedback, i, 0.35).clamp(0.0, 0.85);
      let mix = sample_at(params.mix, i, 0.5).clamp(0.0, 1.0);

      let base_delay = (time_ms * self.sample_rate / 1000.0).clamp(1.0, buffer_size - 2.0);
      let grain_length = (size_ms * self.sample_rate / 1000.0).max(1.0) as usize;
      let jitter = size_ms * 0.5 * self.sample_rate / 1000.0;

      self.spawn_phase += density / self.sample_rate;
      while self.spawn_phase >= 1.0 {
        self.spawn_phase -= 1.0;
        let offset = base_delay + self.next_random() * jitter;
        let delay_samples = offset.clamp(1.0, buffer_size - 2.0);
        let pan = self.next_random().clamp(-1.0, 1.0);
        self.spawn_grain(delay_samples, grain_length, pitch, pan);
      }

      let input_l = input_at(inputs.input_l, i);
      let input_r = match inputs.input_r {
        Some(values) => input_at(Some(values), i),
        None => input_l,
      };

      let mut wet_l = 0.0;
      let mut wet_r = 0.0;
      for grain in &mut self.grains {
        if !grain.active {
          continue;
        }
        let phase = grain.age as f32 / grain.length as f32;
        let window = 1.0 - (phase * 2.0 - 1.0).abs();
        let sample_l = Self::read_sample(&self.buffer_l, grain.pos);
        let sample_r = Self::read_sample(&self.buffer_r, grain.pos);
        let pan = grain.pan;
        let pan_l = 0.5 * (1.0 - pan);
        let pan_r = 0.5 * (1.0 + pan);
        wet_l += sample_l * window * pan_l;
        wet_r += sample_r * window * pan_r;
        grain.pos += grain.step;
        if grain.pos >= buffer_size {
          grain.pos -= buffer_size;
        }
        grain.age += 1;
        if grain.age >= grain.length {
          grain.active = false;
        }
      }

      self.buffer_l[self.write_index] = input_l + wet_l * feedback;
      self.buffer_r[self.write_index] = input_r + wet_r * feedback;

      let dry = 1.0 - mix;
      out_l[i] = input_l * dry + wet_l * mix;
      out_r[i] = input_r * dry + wet_r * mix;

      self.write_index += 1;
      if self.write_index >= self.buffer_l.len() {
        self.write_index = 0;
      }
    }
  }
}

impl SpringReverb {
  pub fn new(sample_rate: f32) -> Self {
    let mut spring = Self {
      sample_rate: sample_rate.max(1.0),
      combs_l: Vec::new(),
      combs_r: Vec::new(),
      allpass_l: Vec::new(),
      allpass_r: Vec::new(),
    };
    spring.allocate_buffers();
    spring
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
    self.allocate_buffers();
  }

  fn allocate_buffers(&mut self) {
    let scale = self.sample_rate / 44100.0;
    let comb_tuning = [1687, 2053, 2389];
    let allpass_tuning = [347, 113];
    let stereo_spread = 17;

    self.combs_l = comb_tuning
      .iter()
      .map(|length| CombFilter::new(((*length as f32 * scale).round() as usize).max(1)))
      .collect();
    self.combs_r = comb_tuning
      .iter()
      .map(|length| CombFilter::new((((length + stereo_spread) as f32 * scale).round() as usize).max(1)))
      .collect();
    self.allpass_l = allpass_tuning
      .iter()
      .map(|length| AllpassFilter::new(((*length as f32 * scale).round() as usize).max(1), 0.5))
      .collect();
    self.allpass_r = allpass_tuning
      .iter()
      .map(|length| AllpassFilter::new((((length + stereo_spread) as f32 * scale).round() as usize).max(1), 0.5))
      .collect();
  }

  pub fn process_block(
    &mut self,
    out_l: &mut [Sample],
    out_r: &mut [Sample],
    inputs: SpringReverbInputs<'_>,
    params: SpringReverbParams<'_>,
  ) {
    if out_l.is_empty() || out_r.is_empty() {
      return;
    }

    let decay = clamp(sample_at(params.decay, 0, 0.6), 0.0, 0.98);
    let tone = clamp(sample_at(params.tone, 0, 0.4), 0.0, 1.0);
    let feedback = clamp(0.35 + decay * 0.6, 0.2, 0.98);
    let damp = 0.08 + (1.0 - tone) * 0.82;

    for comb in &mut self.combs_l {
      comb.set_feedback(feedback);
      comb.set_damp(damp);
    }
    for comb in &mut self.combs_r {
      comb.set_feedback(feedback);
      comb.set_damp(damp);
    }

    for i in 0..out_l.len() {
      let mix = clamp(sample_at(params.mix, i, 0.4), 0.0, 1.0);
      let drive = clamp(sample_at(params.drive, i, 0.2), 0.0, 1.0);

      let input_l = input_at(inputs.input_l, i);
      let input_r = match inputs.input_r {
        Some(values) => input_at(Some(values), i),
        None => input_l,
      };

      let drive_gain = 1.0 + drive * 4.0;
      let spring_in_l = saturate(input_l * drive_gain) * 0.35;
      let spring_in_r = saturate(input_r * drive_gain) * 0.35;

      let mut wet_l = 0.0;
      let mut wet_r = 0.0;
      for comb in &mut self.combs_l {
        wet_l += comb.process(spring_in_l);
      }
      for comb in &mut self.combs_r {
        wet_r += comb.process(spring_in_r);
      }
      for allpass in &mut self.allpass_l {
        wet_l = allpass.process(wet_l);
      }
      for allpass in &mut self.allpass_r {
        wet_r = allpass.process(wet_r);
      }

      let wet_scale = 0.4;
      wet_l *= wet_scale;
      wet_r *= wet_scale;

      let dry = 1.0 - mix;
      out_l[i] = input_l * dry + wet_l * mix;
      out_r[i] = input_r * dry + wet_r * mix;
    }
  }
}

impl Ensemble {
  pub fn new(sample_rate: f32) -> Self {
    let mut ensemble = Self {
      sample_rate: sample_rate.max(1.0),
      phases: [0.0, std::f32::consts::TAU / 3.0, (2.0 * std::f32::consts::TAU) / 3.0],
      buffer_l: Vec::new(),
      buffer_r: Vec::new(),
      write_index: 0,
    };
    ensemble.allocate_buffers();
    ensemble
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
    self.allocate_buffers();
  }

  fn allocate_buffers(&mut self) {
    let max_delay_ms = 60.0;
    let max_samples = ((max_delay_ms / 1000.0) * self.sample_rate).ceil() as usize + 2;
    if self.buffer_l.len() != max_samples {
      self.buffer_l = vec![0.0; max_samples];
      self.buffer_r = vec![0.0; max_samples];
      self.write_index = 0;
      self.phases = [0.0, std::f32::consts::TAU / 3.0, (2.0 * std::f32::consts::TAU) / 3.0];
    }
  }

  pub fn process_block(
    &mut self,
    out_l: &mut [Sample],
    out_r: &mut [Sample],
    inputs: EnsembleInputs<'_>,
    params: EnsembleParams<'_>,
  ) {
    if out_l.is_empty() || out_r.is_empty() {
      return;
    }

    let buffer_size = self.buffer_l.len();
    let tau = std::f32::consts::TAU;
    let rate_mults = [0.85, 1.0, 1.2];
    let max_delay = (buffer_size as f32 - 2.0).max(1.0);

    for i in 0..out_l.len() {
      let rate = sample_at(params.rate, i, 0.25).clamp(0.01, 5.0);
      let depth_ms = sample_at(params.depth_ms, i, 12.0).clamp(0.0, 25.0);
      let delay_ms = sample_at(params.delay_ms, i, 12.0).clamp(1.0, 30.0);
      let mix = sample_at(params.mix, i, 0.6).clamp(0.0, 1.0);
      let spread = sample_at(params.spread, i, 0.7).clamp(0.0, 1.0);
      let spread_offset = spread * tau * 0.25;

      let input_l = input_at(inputs.input_l, i);
      let input_r = match inputs.input_r {
        Some(values) => input_at(Some(values), i),
        None => input_l,
      };

      let mut delays_l = [0.0; 3];
      let mut delays_r = [0.0; 3];
      for (index, phase) in self.phases.iter_mut().enumerate() {
        let lfo_l = (*phase).sin();
        let lfo_r = (*phase + spread_offset).sin();
        delays_l[index] =
          ((delay_ms + depth_ms * lfo_l) * self.sample_rate / 1000.0).clamp(1.0, max_delay);
        delays_r[index] =
          ((delay_ms + depth_ms * lfo_r) * self.sample_rate / 1000.0).clamp(1.0, max_delay);
        *phase += (tau * rate * rate_mults[index]) / self.sample_rate;
        if *phase >= tau {
          *phase -= tau;
        }
      }

      let write_index = self.write_index;
      let read_delay = |buffer: &[Sample], delay_samples: f32| {
        let size = buffer.len() as i32;
        let read_pos = write_index as f32 - delay_samples;
        let base_index = read_pos.floor();
        let mut index_a = base_index as i32 % size;
        if index_a < 0 {
          index_a += size;
        }
        let index_b = (index_a + 1) % size;
        let frac = read_pos - base_index;
        let a = buffer[index_a as usize];
        let b = buffer[index_b as usize];
        a + (b - a) * frac
      };

      let mut sum_l = 0.0;
      let mut sum_r = 0.0;
      {
        let buffer_l = &self.buffer_l;
        let buffer_r = &self.buffer_r;
        for idx in 0..3 {
          sum_l += read_delay(buffer_l, delays_l[idx]);
          sum_r += read_delay(buffer_r, delays_r[idx]);
        }
      }

      let wet_l = sum_l / 3.0;
      let wet_r = sum_r / 3.0;
      let dry = 1.0 - mix;
      out_l[i] = input_l * dry + wet_l * mix;
      out_r[i] = input_r * dry + wet_r * mix;

      self.buffer_l[self.write_index] = input_l;
      self.buffer_r[self.write_index] = input_r;
      self.write_index = (self.write_index + 1) % buffer_size;
    }
  }
}

pub struct CombFilter {
  buffer: Vec<Sample>,
  index: usize,
  filter_store: f32,
  feedback: f32,
  damp1: f32,
  damp2: f32,
}

impl CombFilter {
  pub fn new(size: usize) -> Self {
    Self {
      buffer: vec![0.0; size],
      index: 0,
      filter_store: 0.0,
      feedback: 0.5,
      damp1: 0.2,
      damp2: 0.8,
    }
  }

  pub fn set_feedback(&mut self, value: f32) {
    self.feedback = value;
  }

  pub fn set_damp(&mut self, value: f32) {
    self.damp1 = clamp(value, 0.0, 0.99);
    self.damp2 = 1.0 - self.damp1;
  }

  pub fn process(&mut self, input: f32) -> f32 {
    let output = self.buffer[self.index];
    self.filter_store = output * self.damp2 + self.filter_store * self.damp1;
    self.buffer[self.index] = input + self.filter_store * self.feedback;
    self.index = (self.index + 1) % self.buffer.len();
    output
  }
}

pub struct AllpassFilter {
  buffer: Vec<Sample>,
  index: usize,
  feedback: f32,
}

impl AllpassFilter {
  pub fn new(size: usize, feedback: f32) -> Self {
    Self {
      buffer: vec![0.0; size],
      index: 0,
      feedback,
    }
  }

  pub fn process(&mut self, input: f32) -> f32 {
    let buffer_out = self.buffer[self.index];
    let output = -input + buffer_out;
    self.buffer[self.index] = input + buffer_out * self.feedback;
    self.index = (self.index + 1) % self.buffer.len();
    output
  }
}

pub struct Reverb {
  sample_rate: f32,
  combs_l: Vec<CombFilter>,
  combs_r: Vec<CombFilter>,
  allpass_l: Vec<AllpassFilter>,
  allpass_r: Vec<AllpassFilter>,
  pre_buffer_l: Vec<Sample>,
  pre_buffer_r: Vec<Sample>,
  pre_write_index: usize,
}

pub struct ReverbInputs<'a> {
  pub input_l: Option<&'a [Sample]>,
  pub input_r: Option<&'a [Sample]>,
}

pub struct ReverbParams<'a> {
  pub time: &'a [Sample],
  pub damp: &'a [Sample],
  pub pre_delay: &'a [Sample],
  pub mix: &'a [Sample],
}

impl Reverb {
  pub fn new(sample_rate: f32) -> Self {
    let mut reverb = Self {
      sample_rate: sample_rate.max(1.0),
      combs_l: Vec::new(),
      combs_r: Vec::new(),
      allpass_l: Vec::new(),
      allpass_r: Vec::new(),
      pre_buffer_l: Vec::new(),
      pre_buffer_r: Vec::new(),
      pre_write_index: 0,
    };
    reverb.allocate_buffers();
    reverb
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
    self.allocate_buffers();
  }

  fn allocate_buffers(&mut self) {
    let scale = self.sample_rate / 44100.0;
    let comb_tuning = [1116, 1188, 1277, 1356];
    let allpass_tuning = [556, 441];
    let stereo_spread = 23;

    self.combs_l = comb_tuning
      .iter()
      .map(|length| CombFilter::new(((*length as f32 * scale).round() as usize).max(1)))
      .collect();
    self.combs_r = comb_tuning
      .iter()
      .map(|length| CombFilter::new((((length + stereo_spread) as f32 * scale).round() as usize).max(1)))
      .collect();
    self.allpass_l = allpass_tuning
      .iter()
      .map(|length| AllpassFilter::new(((*length as f32 * scale).round() as usize).max(1), 0.5))
      .collect();
    self.allpass_r = allpass_tuning
      .iter()
      .map(|length| AllpassFilter::new((((length + stereo_spread) as f32 * scale).round() as usize).max(1), 0.5))
      .collect();

    let max_pre_delay_ms = 120.0;
    let pre_samples = ((max_pre_delay_ms / 1000.0) * self.sample_rate).ceil() as usize + 2;
    self.pre_buffer_l = vec![0.0; pre_samples];
    self.pre_buffer_r = vec![0.0; pre_samples];
    self.pre_write_index = 0;
  }

  fn read_delay(&self, buffer: &[Sample], delay_samples: f32) -> f32 {
    let size = buffer.len() as i32;
    let read_pos = self.pre_write_index as f32 - delay_samples;
    let base_index = read_pos.floor();
    let mut index_a = base_index as i32 % size;
    if index_a < 0 {
      index_a += size;
    }
    let index_b = (index_a + 1) % size;
    let frac = read_pos - base_index;
    let a = buffer[index_a as usize];
    let b = buffer[index_b as usize];
    a + (b - a) * frac
  }

  pub fn process_block(
    &mut self,
    out_l: &mut [Sample],
    out_r: &mut [Sample],
    inputs: ReverbInputs<'_>,
    params: ReverbParams<'_>,
  ) {
    if out_l.is_empty() || out_r.is_empty() {
      return;
    }

    let time = clamp(sample_at(params.time, 0, 0.62), 0.1, 0.98);
    let damp = clamp(sample_at(params.damp, 0, 0.4), 0.0, 1.0);
    let room_size = clamp(0.2 + time * 0.78, 0.2, 0.98);
    let damp_value = 0.05 + damp * 0.9;

    for comb in &mut self.combs_l {
      comb.set_feedback(room_size);
      comb.set_damp(damp_value);
    }
    for comb in &mut self.combs_r {
      comb.set_feedback(room_size);
      comb.set_damp(damp_value);
    }

    let pre_buffer_size = self.pre_buffer_l.len();
    let max_pre_delay = (pre_buffer_size as f32 - 2.0) / self.sample_rate * 1000.0;

    for i in 0..out_l.len() {
      let mix = clamp(sample_at(params.mix, i, 0.25), 0.0, 1.0);
      let pre_delay_ms = sample_at(params.pre_delay, i, 0.0);
      let pre_delay_samples =
        clamp((pre_delay_ms * self.sample_rate) / 1000.0, 0.0, max_pre_delay);

      let in_l = input_at(inputs.input_l, i);
      let in_r = match inputs.input_r {
        Some(values) => input_at(Some(values), i),
        None => in_l,
      };

      let pre_l = self.read_delay(&self.pre_buffer_l, pre_delay_samples);
      let pre_r = self.read_delay(&self.pre_buffer_r, pre_delay_samples);

      self.pre_buffer_l[self.pre_write_index] = in_l;
      self.pre_buffer_r[self.pre_write_index] = in_r;
      self.pre_write_index = (self.pre_write_index + 1) % pre_buffer_size;

      let input_gain = 0.35;
      let reverb_in_l = pre_l * input_gain;
      let reverb_in_r = pre_r * input_gain;

      let mut wet_l = 0.0;
      let mut wet_r = 0.0;
      for comb in &mut self.combs_l {
        wet_l += comb.process(reverb_in_l);
      }
      for comb in &mut self.combs_r {
        wet_r += comb.process(reverb_in_r);
      }
      for allpass in &mut self.allpass_l {
        wet_l = allpass.process(wet_l);
      }
      for allpass in &mut self.allpass_r {
        wet_r = allpass.process(wet_r);
      }

      let wet_scale = 0.3;
      wet_l *= wet_scale;
      wet_r *= wet_scale;

      let dry = 1.0 - mix;
      out_l[i] = in_l * dry + wet_l * mix;
      out_r[i] = in_r * dry + wet_r * mix;
    }
  }
}

#[derive(Clone, Copy, Debug)]
pub struct SvfState {
  ic1: f32,
  ic2: f32,
}

#[derive(Clone, Copy, Debug)]
pub struct LadderState {
  stage1: f32,
  stage2: f32,
  stage3: f32,
  stage4: f32,
}

pub struct Vcf {
  sample_rate: f32,
  stage_a: SvfState,
  stage_b: SvfState,
  ladder: LadderState,
  cutoff_smooth: f32,
  res_smooth: f32,
}

pub struct VcfInputs<'a> {
  pub audio: Option<&'a [Sample]>,
  pub mod_in: Option<&'a [Sample]>,
  pub env: Option<&'a [Sample]>,
  pub key: Option<&'a [Sample]>,
}

pub struct VcfParams<'a> {
  pub cutoff: &'a [Sample],
  pub resonance: &'a [Sample],
  pub drive: &'a [Sample],
  pub env_amount: &'a [Sample],
  pub mod_amount: &'a [Sample],
  pub key_track: &'a [Sample],
  pub model: &'a [Sample],
  pub mode: &'a [Sample],
  pub slope: &'a [Sample],
}

impl Vcf {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      stage_a: SvfState { ic1: 0.0, ic2: 0.0 },
      stage_b: SvfState { ic1: 0.0, ic2: 0.0 },
      ladder: LadderState {
        stage1: 0.0,
        stage2: 0.0,
        stage3: 0.0,
        stage4: 0.0,
      },
      cutoff_smooth: 800.0,
      res_smooth: 0.4,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  fn process_svf_stage(input: f32, g: f32, k: f32, state: &mut SvfState) -> (f32, f32, f32) {
    let a1 = 1.0 / (1.0 + g * (g + k));
    let a2 = g * a1;
    let a3 = g * a2;
    let v3 = input - state.ic2;
    let v1 = a1 * state.ic1 + a2 * v3;
    let v2 = state.ic2 + a2 * state.ic1 + a3 * v3;
    state.ic1 = 2.0 * v1 - state.ic1;
    state.ic2 = 2.0 * v2 - state.ic2;
    let lp = v2;
    let bp = v1;
    let hp = input - k * v1 - v2;
    (lp, bp, hp)
  }

  fn select_mode(stage: (f32, f32, f32), mode: f32) -> f32 {
    if mode < 0.5 {
      stage.0
    } else if mode < 1.5 {
      stage.2
    } else if mode < 2.5 {
      stage.1
    } else {
      stage.2 + stage.0
    }
  }

  fn process_svf(&mut self, input: f32, cutoff: f32, resonance: f32, mode: f32, slope: f32, drive: f32) -> f32 {
    let clamped_cutoff = cutoff.min(self.sample_rate * 0.45);
    let g = (std::f32::consts::PI * clamped_cutoff / self.sample_rate).tan();
    let slope24 = slope >= 0.5;
    let resonance_scaled = resonance * if slope24 { 0.38 } else { 1.0 };
    let q = 0.7 + resonance_scaled * if slope24 { 3.8 } else { 8.0 };
    let k = 1.0 / q;

    let drive_gain = 1.0 + drive * if slope24 { 1.0 } else { 2.6 };
    let shaped_input = saturate(input * drive_gain);

    let stage1 = Self::process_svf_stage(shaped_input, g, k, &mut self.stage_a);
    if slope24 {
      let stage1_out = saturate(stage1.0 * (1.0 + drive * 0.2));
      let stage2 = Self::process_svf_stage(stage1_out, g, k, &mut self.stage_b);
      let out = Self::select_mode(stage2, mode);
      let res_comp = 1.0 / (1.0 + resonance_scaled * 1.5);
      return saturate(out * 0.52 * res_comp);
    }
    let out = Self::select_mode(stage1, mode);
    let res_comp = 1.0 / (1.0 + resonance_scaled * 0.6);
    saturate(out * 0.85 * res_comp)
  }

  fn process_ladder(&mut self, input: f32, cutoff: f32, resonance: f32, slope: f32, drive: f32) -> f32 {
    let f = (cutoff / self.sample_rate).min(0.49);
    let p = f * (1.8 - 0.8 * f);
    let t1 = (1.0 - p) * 1.386249;
    let t2 = 12.0 + t1 * t1;
    let r = resonance * (t2 + 6.0 * t1) / (t2 - 6.0 * t1);

    let drive_gain = 1.0 + drive * 1.7;
    let input_drive = saturate(input * drive_gain - r * self.ladder.stage4);
    self.ladder.stage1 = input_drive * p + self.ladder.stage1 * (1.0 - p);
    self.ladder.stage2 = self.ladder.stage1 * p + self.ladder.stage2 * (1.0 - p);
    self.ladder.stage3 = self.ladder.stage2 * p + self.ladder.stage3 * (1.0 - p);
    self.ladder.stage4 = self.ladder.stage3 * p + self.ladder.stage4 * (1.0 - p);

    let output = if slope >= 0.5 {
      self.ladder.stage4
    } else {
      self.ladder.stage2
    };
    let res_comp = 1.0 / (1.0 + resonance * 0.85);
    saturate(output * 0.9 * res_comp)
  }

  pub fn process_block(&mut self, output: &mut [Sample], inputs: VcfInputs<'_>, params: VcfParams<'_>) {
    if output.is_empty() {
      return;
    }

    let mode = params.mode.get(0).copied().unwrap_or(0.0);
    let slope = params.slope.get(0).copied().unwrap_or(1.0);
    let model = params.model.get(0).copied().unwrap_or(0.0);
    let smooth_coeff = 1.0 - (-1.0 / (0.01 * self.sample_rate)).exp();

    for i in 0..output.len() {
      let input_sample = input_at(inputs.audio, i);
      let base_cutoff = sample_at(params.cutoff, i, 800.0);
      let base_res = sample_at(params.resonance, i, 0.4);
      let drive = sample_at(params.drive, i, 0.2);
      let env_amount = sample_at(params.env_amount, i, 0.0);
      let mod_amount = sample_at(params.mod_amount, i, 0.0);
      let key_track = sample_at(params.key_track, i, 0.0);
      let mod_signal = input_at(inputs.mod_in, i);
      let env = input_at(inputs.env, i);
      let key = input_at(inputs.key, i);

      let cutoff = base_cutoff
        * 2.0_f32.powf(key * key_track + mod_signal * mod_amount + env * env_amount);
      self.cutoff_smooth += (cutoff - self.cutoff_smooth) * smooth_coeff;
      self.res_smooth += (base_res - self.res_smooth) * smooth_coeff;

      let cutoff_hz = self.cutoff_smooth.clamp(20.0, 20000.0);
      let resonance = self.res_smooth.clamp(0.0, 1.0);

      let use_ladder = model >= 0.5 && mode < 0.5;
      output[i] = if use_ladder {
        self.process_ladder(input_sample, cutoff_hz, resonance, slope, drive)
      } else {
        self.process_svf(input_sample, cutoff_hz, resonance, mode, slope, drive)
      };
    }
  }
}

pub struct SineOsc {
  freq_hz: f32,
  gain: f32,
  phase: f32,
  sample_rate: f32,
}

impl SineOsc {
  pub fn new(freq_hz: f32) -> Self {
    Self {
      freq_hz,
      gain: 0.8,
      phase: 0.0,
      sample_rate: 48_000.0,
    }
  }

  pub fn set_frequency(&mut self, freq_hz: f32) {
    self.freq_hz = freq_hz.max(0.0);
  }

  pub fn set_gain(&mut self, gain: f32) {
    self.gain = gain.clamp(0.0, 1.0);
  }
}

impl Node for SineOsc {
  fn reset(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
    self.phase = 0.0;
  }

  fn process(&mut self, output: &mut [Sample]) {
    if output.is_empty() {
      return;
    }
    let phase_step = (self.freq_hz / self.sample_rate) * std::f32::consts::TAU;
    for sample in output.iter_mut() {
      *sample = self.gain * self.phase.sin();
      self.phase += phase_step;
      if self.phase >= std::f32::consts::TAU {
        self.phase -= std::f32::consts::TAU;
      }
    }
  }
}

// ============================================================================
// Supersaw Oscillator (7 detuned sawtooth voices)
// ============================================================================

pub struct Supersaw {
  sample_rate: f32,
  phases: [f32; 7],
}

pub struct SupersawParams<'a> {
  pub base_freq: &'a [Sample],
  pub detune: &'a [Sample],
  pub mix: &'a [Sample],
}

pub struct SupersawInputs<'a> {
  pub pitch: Option<&'a [Sample]>,
}

impl Supersaw {
  pub fn new(sample_rate: f32) -> Self {
    let mut phases = [0.0; 7];
    for (i, phase) in phases.iter_mut().enumerate() {
      *phase = i as f32 / 7.0;
    }
    Self {
      sample_rate: sample_rate.max(1.0),
      phases,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  pub fn process_block(
    &mut self,
    output: &mut [Sample],
    inputs: SupersawInputs<'_>,
    params: SupersawParams<'_>,
  ) {
    if output.is_empty() {
      return;
    }

    // Voice detune offsets (symmetric around center)
    const OFFSETS: [f32; 7] = [-1.0, -0.666, -0.333, 0.0, 0.333, 0.666, 1.0];
    // Voice mix levels (center louder)
    const LEVELS: [f32; 7] = [0.7, 0.8, 0.9, 1.0, 0.9, 0.8, 0.7];

    for i in 0..output.len() {
      let base = sample_at(params.base_freq, i, 220.0);
      let pitch = input_at(inputs.pitch, i);
      let detune_cents = sample_at(params.detune, i, 25.0).clamp(0.0, 100.0);
      let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);

      let frequency = base * 2.0_f32.powf(pitch);
      let mut sample = 0.0;
      let mut total_level = 0.0;

      for v in 0..7 {
        let offset = OFFSETS[v];
        let level = LEVELS[v];
        let detune_factor = 2.0_f32.powf((detune_cents * offset) / 1200.0);
        let voice_freq = frequency * detune_factor;
        let dt = (voice_freq / self.sample_rate).min(1.0);

        self.phases[v] += voice_freq / self.sample_rate;
        if self.phases[v] >= 1.0 {
          self.phases[v] -= self.phases[v].floor();
        }

        let phase = self.phases[v];
        let mut saw = 2.0 * phase - 1.0;
        saw -= poly_blep(phase, dt);
        sample += saw * level;
        total_level += level;
      }

      output[i] = (sample / total_level) * mix;
    }
  }
}

// ============================================================================
// Phaser Effect (4-stage allpass with LFO)
// ============================================================================

pub struct Phaser {
  sample_rate: f32,
  allpass_l: [f32; 4],
  allpass_r: [f32; 4],
  lfo_phase: f32,
}

pub struct PhaserInputs<'a> {
  pub input_l: Option<&'a [Sample]>,
  pub input_r: Option<&'a [Sample]>,
}

pub struct PhaserParams<'a> {
  pub rate: &'a [Sample],
  pub depth: &'a [Sample],
  pub feedback: &'a [Sample],
  pub mix: &'a [Sample],
}

impl Phaser {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      allpass_l: [0.0; 4],
      allpass_r: [0.0; 4],
      lfo_phase: 0.0,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  fn allpass(input: f32, coeff: f32, state: &mut f32) -> f32 {
    let output = *state - input * coeff;
    *state = input + output * coeff;
    output
  }

  pub fn process_block(
    &mut self,
    out_l: &mut [Sample],
    out_r: &mut [Sample],
    inputs: PhaserInputs<'_>,
    params: PhaserParams<'_>,
  ) {
    if out_l.is_empty() || out_r.is_empty() {
      return;
    }

    let base_freqs: [f32; 4] = [200.0, 400.0, 800.0, 1600.0];

    for i in 0..out_l.len() {
      let rate = sample_at(params.rate, i, 0.5).clamp(0.05, 5.0);
      let depth = sample_at(params.depth, i, 0.7).clamp(0.0, 1.0);
      let feedback = sample_at(params.feedback, i, 0.3).clamp(0.0, 0.9);
      let mix = sample_at(params.mix, i, 0.5).clamp(0.0, 1.0);

      // LFO
      self.lfo_phase += rate / self.sample_rate;
      if self.lfo_phase >= 1.0 {
        self.lfo_phase -= 1.0;
      }
      let lfo = (self.lfo_phase * std::f32::consts::TAU).sin();
      let mod_amount = 0.5 + lfo * 0.5 * depth;

      let in_l = input_at(inputs.input_l, i);
      let in_r = match inputs.input_r {
        Some(values) => input_at(Some(values), i),
        None => in_l,
      };

      // Process allpass chain
      let mut proc_l = in_l + self.allpass_l[3] * feedback;
      let mut proc_r = in_r + self.allpass_r[3] * feedback;

      for stage in 0..4 {
        let freq = base_freqs[stage] * mod_amount;
        let coeff = (1.0 - freq / self.sample_rate).clamp(-0.99, 0.99);
        proc_l = Self::allpass(proc_l, coeff, &mut self.allpass_l[stage]);
        proc_r = Self::allpass(proc_r, coeff, &mut self.allpass_r[stage]);
      }

      let dry = 1.0 - mix;
      out_l[i] = in_l * dry + proc_l * mix;
      out_r[i] = in_r * dry + proc_r * mix;
    }
  }
}

// ============================================================================
// Distortion / Waveshaper
// ============================================================================

pub struct Distortion;

pub struct DistortionParams<'a> {
  pub drive: &'a [Sample],
  pub tone: &'a [Sample],
  pub mix: &'a [Sample],
  pub mode: &'a [Sample],
}

pub struct Wavefolder;

pub struct WavefolderParams<'a> {
  pub drive: &'a [Sample],
  pub fold: &'a [Sample],
  pub bias: &'a [Sample],
  pub mix: &'a [Sample],
}

pub struct Choir {
  sample_rate: f32,
  phase: f32,
  filters_l: [FormantFilter; 3],
  filters_r: [FormantFilter; 3],
}

#[derive(Clone, Copy)]
struct FormantFilter {
  ic1: f32,
  ic2: f32,
}

pub struct ChoirInputs<'a> {
  pub input_l: Option<&'a [Sample]>,
  pub input_r: Option<&'a [Sample]>,
}

pub struct ChoirParams<'a> {
  pub vowel: &'a [Sample],
  pub rate: &'a [Sample],
  pub depth: &'a [Sample],
  pub mix: &'a [Sample],
}

const VOCODER_BANDS: usize = 16;

pub struct Vocoder {
  sample_rate: f32,
  mod_filters: [FormantFilter; VOCODER_BANDS],
  car_filters: [FormantFilter; VOCODER_BANDS],
  envelopes: [f32; VOCODER_BANDS],
  unvoiced_env: f32,
  hp_state: f32,
  hp_prev: f32,
  rng: u32,
}

pub struct VocoderInputs<'a> {
  pub modulator: Option<&'a [Sample]>,
  pub carrier: Option<&'a [Sample]>,
}

pub struct VocoderParams<'a> {
  pub attack: &'a [Sample],
  pub release: &'a [Sample],
  pub low: &'a [Sample],
  pub high: &'a [Sample],
  pub q: &'a [Sample],
  pub formant: &'a [Sample],
  pub emphasis: &'a [Sample],
  pub unvoiced: &'a [Sample],
  pub mix: &'a [Sample],
  pub mod_gain: &'a [Sample],
  pub car_gain: &'a [Sample],
}

impl Distortion {
  pub fn process_block(
    output: &mut [Sample],
    input: Option<&[Sample]>,
    params: DistortionParams<'_>,
  ) {
    if output.is_empty() {
      return;
    }

    for i in 0..output.len() {
      let drive = sample_at(params.drive, i, 0.5).clamp(0.0, 1.0);
      let tone = sample_at(params.tone, i, 0.5).clamp(0.0, 1.0);
      let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);
      let mode = sample_at(params.mode, i, 0.0);

      let in_sample = input_at(input, i);
      let gain = 1.0 + drive * 20.0;
      let driven = in_sample * gain;

      // Mode: 0 = soft clip (tanh), 1 = hard clip, 2 = foldback
      let shaped = if mode < 0.5 {
        // Soft clip (tanh approximation)
        let x = driven.clamp(-3.0, 3.0);
        x * (27.0 + x * x) / (27.0 + 9.0 * x * x)
      } else if mode < 1.5 {
        // Hard clip
        driven.clamp(-1.0, 1.0)
      } else {
        // Foldback
        let mut x = driven;
        while x > 1.0 || x < -1.0 {
          if x > 1.0 {
            x = 2.0 - x;
          }
          if x < -1.0 {
            x = -2.0 - x;
          }
        }
        x
      };

      // Simple tone control (lowpass)
      let output_sample = shaped * tone + shaped * (1.0 - tone) * 0.7;
      let dry = 1.0 - mix;
      output[i] = in_sample * dry + output_sample * mix;
    }
  }
}

impl FormantFilter {
  fn process(&mut self, input: f32, cutoff: f32, q: f32, sample_rate: f32) -> f32 {
    let cutoff = cutoff.min(sample_rate * 0.45).max(20.0);
    let g = (std::f32::consts::PI * cutoff / sample_rate).tan();
    let k = 1.0 / q.max(0.1);
    let a1 = 1.0 / (1.0 + g * (g + k));
    let a2 = g * a1;
    let a3 = g * a2;
    let v3 = input - self.ic2;
    let v1 = a1 * self.ic1 + a2 * v3;
    let v2 = self.ic2 + a2 * self.ic1 + a3 * v3;
    self.ic1 = 2.0 * v1 - self.ic1;
    self.ic2 = 2.0 * v2 - self.ic2;
    v1
  }
}

impl Choir {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      phase: 0.0,
      filters_l: [FormantFilter { ic1: 0.0, ic2: 0.0 }; 3],
      filters_r: [FormantFilter { ic1: 0.0, ic2: 0.0 }; 3],
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  pub fn process_block(
    &mut self,
    out_l: &mut [Sample],
    out_r: &mut [Sample],
    inputs: ChoirInputs<'_>,
    params: ChoirParams<'_>,
  ) {
    if out_l.is_empty() || out_r.is_empty() {
      return;
    }

    let vowels: [[f32; 3]; 5] = [
      [800.0, 1150.0, 2900.0],
      [400.0, 1700.0, 2600.0],
      [350.0, 1700.0, 2700.0],
      [450.0, 800.0, 2830.0],
      [325.0, 700.0, 2530.0],
    ];
    let q_values = [5.0, 4.5, 4.0];
    let weights = [0.55, 0.45, 0.35];
    let tau = std::f32::consts::TAU;

    for i in 0..out_l.len() {
      let vowel = sample_at(params.vowel, i, 0.0).round().clamp(0.0, 4.0) as usize;
      let rate = sample_at(params.rate, i, 0.25).clamp(0.05, 2.0);
      let depth = sample_at(params.depth, i, 0.35).clamp(0.0, 1.0);
      let mix = sample_at(params.mix, i, 0.5).clamp(0.0, 1.0);

      let input_l = input_at(inputs.input_l, i);
      let input_r = match inputs.input_r {
        Some(values) => input_at(Some(values), i),
        None => input_l,
      };

      let lfo_l = self.phase.sin();
      let lfo_r = (self.phase + 0.7).sin();
      let mod_l = 1.0 + depth * 0.04 * lfo_l;
      let mod_r = 1.0 + depth * 0.04 * lfo_r;

      let mut wet_l = 0.0;
      let mut wet_r = 0.0;
      for band in 0..3 {
        let freq = vowels[vowel][band];
        wet_l += self.filters_l[band].process(input_l, freq * mod_l, q_values[band], self.sample_rate)
          * weights[band];
        wet_r += self.filters_r[band].process(input_r, freq * mod_r, q_values[band], self.sample_rate)
          * weights[band];
      }

      let dry = 1.0 - mix;
      out_l[i] = input_l * dry + wet_l * mix;
      out_r[i] = input_r * dry + wet_r * mix;

      self.phase += (tau * rate) / self.sample_rate;
      if self.phase >= tau {
        self.phase -= tau;
      }
    }
  }
}

impl Vocoder {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      mod_filters: [FormantFilter { ic1: 0.0, ic2: 0.0 }; VOCODER_BANDS],
      car_filters: [FormantFilter { ic1: 0.0, ic2: 0.0 }; VOCODER_BANDS],
      envelopes: [0.0; VOCODER_BANDS],
      unvoiced_env: 0.0,
      hp_state: 0.0,
      hp_prev: 0.0,
      rng: 0x1234_5678,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  pub fn process_block(
    &mut self,
    output: &mut [Sample],
    inputs: VocoderInputs<'_>,
    params: VocoderParams<'_>,
  ) {
    if output.is_empty() {
      return;
    }

    let bands = VOCODER_BANDS as f32;
    for i in 0..output.len() {
      let attack_ms = sample_at(params.attack, i, 25.0).clamp(2.0, 300.0);
      let release_ms = sample_at(params.release, i, 140.0).clamp(10.0, 1200.0);
      let low = sample_at(params.low, i, 120.0).clamp(40.0, 2000.0);
      let mut high = sample_at(params.high, i, 5000.0).clamp(400.0, 12000.0);
      if high <= low {
        high = (low * 1.5).min(12000.0);
      }
      let q = sample_at(params.q, i, 2.5).clamp(0.4, 8.0);
      let formant = sample_at(params.formant, i, 0.0).clamp(-12.0, 12.0);
      let emphasis = sample_at(params.emphasis, i, 0.4).clamp(0.0, 1.0);
      let unvoiced = sample_at(params.unvoiced, i, 0.0).clamp(0.0, 1.0);
      let mix = sample_at(params.mix, i, 0.8).clamp(0.0, 1.0);
      let mod_gain = sample_at(params.mod_gain, i, 1.0).clamp(0.0, 4.0);
      let car_gain = sample_at(params.car_gain, i, 1.0).clamp(0.0, 4.0);

      let mod_input = input_at(inputs.modulator, i) * mod_gain;
      let car_input = input_at(inputs.carrier, i) * car_gain;

      let attack = attack_ms * 0.001;
      let release = release_ms * 0.001;
      let attack_coeff = 1.0 - (-1.0 / (attack * self.sample_rate)).exp();
      let release_coeff = 1.0 - (-1.0 / (release * self.sample_rate)).exp();
      let shift = 2.0_f32.powf(formant / 12.0);
      let ratio = high / low;

      let emphasis_cutoff = 600.0 + emphasis * 3400.0;
      let hp_coeff = (-2.0 * std::f32::consts::PI * emphasis_cutoff / self.sample_rate).exp();
      let hp_out = mod_input - self.hp_prev + hp_coeff * self.hp_state;
      self.hp_prev = mod_input;
      self.hp_state = hp_out;
      let mod_emph = mod_input + hp_out * (emphasis * 0.7);

      let unvoiced_attack = 0.004;
      let unvoiced_release = 0.06;
      let unvoiced_attack_coeff =
        1.0 - (-1.0 / (unvoiced_attack * self.sample_rate)).exp();
      let unvoiced_release_coeff =
        1.0 - (-1.0 / (unvoiced_release * self.sample_rate)).exp();
      let unvoiced_target = hp_out.abs();
      let unvoiced_coeff = if unvoiced_target > self.unvoiced_env {
        unvoiced_attack_coeff
      } else {
        unvoiced_release_coeff
      };
      self.unvoiced_env += unvoiced_coeff * (unvoiced_target - self.unvoiced_env);
      self.rng = self.rng.wrapping_mul(1664525).wrapping_add(1013904223);
      let noise = ((self.rng >> 9) as f32 / 8_388_607.0) * 2.0 - 1.0;
      let unvoiced_mix = noise * self.unvoiced_env * unvoiced * 0.45;

      let mut wet = 0.0;
      for band in 0..VOCODER_BANDS {
        let t = band as f32 / (VOCODER_BANDS as f32 - 1.0);
        let freq = low * ratio.powf(t) * shift;
        let mod_band = self
          .mod_filters[band]
          .process(mod_emph, freq, q, self.sample_rate);
        let car_band = self.car_filters[band].process(car_input, freq, q, self.sample_rate);
        let env = self.envelopes[band];
        let rectified = mod_band.abs();
        let coeff = if rectified > env {
          attack_coeff
        } else {
          release_coeff
        };
        let next_env = env + coeff * (rectified - env);
        self.envelopes[band] = next_env;
        wet += car_band * next_env;
      }

      let scaled = wet * (1.0 / bands);
      let dry = 1.0 - mix;
      output[i] = car_input * dry + (scaled + unvoiced_mix) * mix;
    }
  }
}

impl Wavefolder {
  fn foldback(value: f32, threshold: f32) -> f32 {
    if threshold <= 0.0 {
      return value;
    }
    let limit = threshold.abs();
    if value <= limit && value >= -limit {
      return value;
    }
    let range = 4.0 * limit;
    let mut folded = (value + limit).rem_euclid(range);
    if folded > 2.0 * limit {
      folded = range - folded;
    }
    folded - limit
  }

  pub fn process_block(
    output: &mut [Sample],
    input: Option<&[Sample]>,
    params: WavefolderParams<'_>,
  ) {
    if output.is_empty() {
      return;
    }

    for i in 0..output.len() {
      let drive = sample_at(params.drive, i, 0.4).clamp(0.0, 1.0);
      let fold = sample_at(params.fold, i, 0.5).clamp(0.0, 1.0);
      let bias = sample_at(params.bias, i, 0.0).clamp(-1.0, 1.0);
      let mix = sample_at(params.mix, i, 0.8).clamp(0.0, 1.0);

      let input_sample = input_at(input, i);
      let pre = input_sample * (1.0 + drive * 8.0) + bias;
      let threshold = (1.0 - fold * 0.85).clamp(0.1, 1.0);
      let folded = Self::foldback(pre, threshold);
      let shaped = saturate(folded * (1.0 + fold * 0.5));

      let dry = 1.0 - mix;
      output[i] = input_sample * dry + shaped * mix;
    }
  }
}


// =============================================================================
// NES OSCILLATOR (2A03 chip emulation)
// =============================================================================

pub struct NesOsc {
  sample_rate: f32,
  phases: [f32; 8],
  lfsrs: [u16; 8],
  noise_timers: [f32; 8],
}

pub struct NesOscParams<'a> {
  pub base_freq: &'a [Sample],
  pub fine: &'a [Sample],
  pub volume: &'a [Sample],
  pub mode: &'a [Sample],
  pub duty: &'a [Sample],
  pub noise_mode: &'a [Sample],
  pub bitcrush: &'a [Sample],
}

pub struct NesOscInputs<'a> {
  pub pitch: Option<&'a [Sample]>,
}

impl NesOsc {
  pub fn new(sample_rate: f32) -> Self {
    let mut phases = [0.0; 8];
    for (i, phase) in phases.iter_mut().enumerate() {
      *phase = i as f32 / 8.0;
    }
    Self {
      sample_rate: sample_rate.max(1.0),
      phases,
      lfsrs: [1; 8],
      noise_timers: [0.0; 8],
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  fn nes_pulse(phase: f32, duty: u8) -> f32 {
    let threshold = match duty {
      0 => 0.125,
      1 => 0.25,
      2 => 0.5,
      3 => 0.75,
      _ => 0.5,
    };
    if phase < threshold { 1.0 } else { -1.0 }
  }

  fn nes_triangle(step: u8) -> f32 {
    let level = if step < 16 { step } else { 31 - step };
    (level as f32 / 7.5) - 1.0
  }

  fn nes_noise(lfsr: &mut u16, loop_mode: bool) -> f32 {
    let feedback = if loop_mode {
      ((*lfsr & 1) ^ ((*lfsr >> 6) & 1)) as u16
    } else {
      ((*lfsr & 1) ^ ((*lfsr >> 1) & 1)) as u16
    };
    *lfsr = (*lfsr >> 1) | (feedback << 14);
    if *lfsr & 1 == 1 { 1.0 } else { -1.0 }
  }

  fn dac_7bit(sample: f32, amount: f32) -> f32 {
    if amount <= 0.0 { return sample; }
    let t = 1.0 - amount;
    let levels = 64.0 + t * (128.0 - 64.0);
    let quantized = (sample * levels).round() / levels;
    sample * (1.0 - amount) + quantized * amount
  }

  pub fn process_block(&mut self, output: &mut [Sample], inputs: NesOscInputs, params: NesOscParams) {
    for i in 0..output.len() {
      let base = sample_at(params.base_freq, i, 220.0);
      let fine_cents = sample_at(params.fine, i, 0.0);
      let pitch_cv = inputs.pitch.map_or(0.0, |p| sample_at(p, i, 0.0));
      let freq = base * (2.0_f32).powf(pitch_cv + fine_cents / 1200.0);
      let freq = freq.clamp(20.0, 20000.0);
      let vol = sample_at(params.volume, i, 1.0).clamp(0.0, 1.0);
      let mode_val = sample_at(params.mode, i, 0.0) as u8;
      let duty_val = sample_at(params.duty, i, 1.0) as u8;
      let noise_loop = sample_at(params.noise_mode, i, 0.0) >= 0.5;
      let crush = sample_at(params.bitcrush, i, 1.0).clamp(0.0, 1.0);

      let sample = match mode_val {
        0 | 1 => {
          let phase_inc = freq / self.sample_rate;
          self.phases[0] += phase_inc;
          if self.phases[0] >= 1.0 { self.phases[0] -= 1.0; }
          Self::nes_pulse(self.phases[0], duty_val)
        }
        2 => {
          // NES Triangle: 4-bit stepped waveform (32 steps per cycle)
          let phase_inc = freq / self.sample_rate;
          self.phases[0] += phase_inc;
          if self.phases[0] >= 1.0 { self.phases[0] -= 1.0; }
          // Calculate step directly from phase (0-31)
          let step = (self.phases[0] * 32.0) as u8;
          Self::nes_triangle(step)
        }
        3 => {
          let noise_freq = freq * 8.0;
          let phase_inc = noise_freq / self.sample_rate;
          self.noise_timers[0] += phase_inc;
          if self.noise_timers[0] >= 1.0 {
            self.noise_timers[0] -= 1.0;
            Self::nes_noise(&mut self.lfsrs[0], noise_loop);
          }
          if self.lfsrs[0] & 1 == 1 { 1.0 } else { -1.0 }
        }
        _ => 0.0,
      };
      output[i] = Self::dac_7bit(sample * vol, crush);
    }
  }
}

// =============================================================================
// SNES OSCILLATOR (S-DSP emulation with wavetables)
// =============================================================================

const WAVE_SQUARE: [f32; 32] = [
  1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
  -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0,
];
const WAVE_SAW: [f32; 32] = [
  -1.0, -0.9375, -0.875, -0.8125, -0.75, -0.6875, -0.625, -0.5625,
  -0.5, -0.4375, -0.375, -0.3125, -0.25, -0.1875, -0.125, -0.0625,
  0.0, 0.0625, 0.125, 0.1875, 0.25, 0.3125, 0.375, 0.4375,
  0.5, 0.5625, 0.625, 0.6875, 0.75, 0.8125, 0.875, 0.9375,
];
const WAVE_STRINGS: [f32; 32] = [
  0.0, 0.4, 0.7, 0.9, 1.0, 0.9, 0.7, 0.4, 0.0, -0.3, -0.5, -0.6, -0.5, -0.3, 0.0, 0.2,
  0.3, 0.2, 0.0, -0.2, -0.4, -0.5, -0.4, -0.2, 0.0, 0.1, 0.2, 0.1, 0.0, -0.1, -0.2, -0.1,
];
const WAVE_BELL: [f32; 32] = [
  0.0, 0.7, 1.0, 0.7, 0.0, -0.5, -0.7, -0.5, 0.0, 0.3, 0.5, 0.3, 0.0, -0.2, -0.3, -0.2,
  0.0, 0.15, 0.2, 0.15, 0.0, -0.1, -0.15, -0.1, 0.0, 0.05, 0.1, 0.05, 0.0, -0.05, -0.1, -0.05,
];
const WAVE_ORGAN: [f32; 32] = [
  0.0, 0.5, 0.87, 1.0, 0.87, 0.5, 0.0, -0.5, -0.87, -1.0, -0.87, -0.5, 0.0, 0.25, 0.43, 0.5,
  0.43, 0.25, 0.0, -0.25, -0.43, -0.5, -0.43, -0.25, 0.0, 0.17, 0.29, 0.33, 0.29, 0.17, 0.0, -0.17,
];
const WAVE_PAD: [f32; 32] = [
  0.0, 0.2, 0.4, 0.55, 0.65, 0.7, 0.72, 0.7, 0.65, 0.55, 0.4, 0.2, 0.0, -0.2, -0.35, -0.45,
  -0.5, -0.45, -0.35, -0.2, 0.0, 0.15, 0.25, 0.3, 0.25, 0.15, 0.0, -0.1, -0.15, -0.15, -0.1, 0.0,
];
const WAVE_BASS: [f32; 32] = [
  0.0, 0.6, 1.0, 1.0, 0.8, 0.5, 0.2, 0.0, -0.2, -0.4, -0.5, -0.6, -0.6, -0.5, -0.4, -0.3,
  -0.2, -0.1, 0.0, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.05, 0.0, -0.05, -0.1, -0.1, -0.05, 0.0,
];
const WAVE_SYNTH: [f32; 32] = [
  1.0, 0.9, 0.6, 0.2, -0.2, -0.5, -0.7, -0.8, -0.8, -0.7, -0.5, -0.2, 0.1, 0.4, 0.6, 0.7,
  0.7, 0.6, 0.4, 0.1, -0.1, -0.3, -0.4, -0.4, -0.3, -0.2, -0.1, 0.0, 0.1, 0.15, 0.15, 0.1,
];
const SNES_WAVETABLES: [&[f32; 32]; 8] = [
  &WAVE_SQUARE, &WAVE_SAW, &WAVE_STRINGS, &WAVE_BELL,
  &WAVE_ORGAN, &WAVE_PAD, &WAVE_BASS, &WAVE_SYNTH,
];

pub struct SnesOsc {
  sample_rate: f32,
  phases: [f32; 8],
  decim_counters: [f32; 8],
  last_samples: [f32; 8],
}

pub struct SnesOscParams<'a> {
  pub base_freq: &'a [Sample],
  pub fine: &'a [Sample],
  pub volume: &'a [Sample],
  pub wave: &'a [Sample],
  pub gauss: &'a [Sample],
  pub color: &'a [Sample],
  pub lofi: &'a [Sample],
}

pub struct SnesOscInputs<'a> {
  pub pitch: Option<&'a [Sample]>,
}

impl SnesOsc {
  pub fn new(sample_rate: f32) -> Self {
    let mut phases = [0.0; 8];
    for (i, phase) in phases.iter_mut().enumerate() {
      *phase = i as f32 / 8.0;
    }
    Self {
      sample_rate: sample_rate.max(1.0),
      phases,
      decim_counters: [0.0; 8],
      last_samples: [0.0; 8],
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  fn gaussian_interpolate(samples: &[f32; 4], frac: f32) -> f32 {
    let t = frac;
    let t2 = t * t;
    let t3 = t2 * t;
    let c0 = -0.5 * t3 + t2 - 0.5 * t;
    let c1 = 1.5 * t3 - 2.5 * t2 + 1.0;
    let c2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
    let c3 = 0.5 * t3 - 0.5 * t2;
    samples[0] * c0 + samples[1] * c1 + samples[2] * c2 + samples[3] * c3
  }

  pub fn process_block(&mut self, output: &mut [Sample], inputs: SnesOscInputs, params: SnesOscParams) {
    for i in 0..output.len() {
      let base = sample_at(params.base_freq, i, 220.0);
      let fine_cents = sample_at(params.fine, i, 0.0);
      let pitch_cv = inputs.pitch.map_or(0.0, |p| sample_at(p, i, 0.0));
      let freq = base * (2.0_f32).powf(pitch_cv + fine_cents / 1200.0);
      let freq = freq.clamp(20.0, 20000.0);
      let vol = sample_at(params.volume, i, 1.0).clamp(0.0, 1.0);
      let wave_idx = (sample_at(params.wave, i, 0.0) as usize).min(7);
      let gauss_amt = sample_at(params.gauss, i, 0.7).clamp(0.0, 1.0);
      let color_amt = sample_at(params.color, i, 0.5).clamp(0.0, 1.0);
      let lofi_amt = sample_at(params.lofi, i, 0.5).clamp(0.0, 1.0);

      let wavetable = SNES_WAVETABLES[wave_idx];
      let phase_inc = freq / self.sample_rate;
      self.phases[0] += phase_inc;
      if self.phases[0] >= 1.0 { self.phases[0] -= 1.0; }

      let table_pos = self.phases[0] * 32.0;
      let idx = table_pos as usize;
      let frac = table_pos - idx as f32;

      let s0 = wavetable[(idx + 31) % 32];
      let s1 = wavetable[idx % 32];
      let s2 = wavetable[(idx + 1) % 32];
      let s3 = wavetable[(idx + 2) % 32];
      let samples_arr = [s0, s1, s2, s3];
      let gauss_sample = Self::gaussian_interpolate(&samples_arr, frac);
      let linear_sample = s1 + frac * (s2 - s1);
      let mut sample = linear_sample * (1.0 - gauss_amt) + gauss_sample * gauss_amt;

      if color_amt > 0.5 {
        let t = (color_amt - 0.5) * 2.0;
        sample = sample * (1.0 - t) + s1 * t;
      }

      if lofi_amt > 0.0 {
        let decim_rate = 32000.0 / self.sample_rate;
        self.decim_counters[0] += decim_rate * lofi_amt;
        if self.decim_counters[0] >= 1.0 {
          self.decim_counters[0] -= 1.0;
          self.last_samples[0] = sample;
        }
        sample = sample * (1.0 - lofi_amt) + self.last_samples[0] * lofi_amt;
      }

      output[i] = sample * vol;
    }
  }
}

// ============================================================================
// ARPEGGIATOR
// ============================================================================

/// Arpeggio pattern modes
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ArpMode {
  Up = 0,
  Down = 1,
  UpDown = 2,
  DownUp = 3,
  Converge = 4,
  Diverge = 5,
  Random = 6,
  RandomOnce = 7,
  AsPlayed = 8,
  Chord = 9,
  StrumUp = 10,
  StrumDown = 11,
}

impl ArpMode {
  fn from_index(i: usize) -> Self {
    match i {
      0 => ArpMode::Up,
      1 => ArpMode::Down,
      2 => ArpMode::UpDown,
      3 => ArpMode::DownUp,
      4 => ArpMode::Converge,
      5 => ArpMode::Diverge,
      6 => ArpMode::Random,
      7 => ArpMode::RandomOnce,
      8 => ArpMode::AsPlayed,
      9 => ArpMode::Chord,
      10 => ArpMode::StrumUp,
      11 => ArpMode::StrumDown,
      _ => ArpMode::Up,
    }
  }
}

/// Rate divisions (tempo-synced)
const RATE_DIVISIONS: [f32; 16] = [
  1.0,      // 1/1
  0.5,      // 1/2
  0.333,    // 1/2T (triplet)
  0.75,     // 1/2. (dotted)
  0.25,     // 1/4
  0.167,    // 1/4T
  0.375,    // 1/4.
  0.125,    // 1/8
  0.083,    // 1/8T
  0.1875,   // 1/8.
  0.0625,   // 1/16
  0.042,    // 1/16T
  0.09375,  // 1/16.
  0.03125,  // 1/32
  0.021,    // 1/32T
  0.015625, // 1/64
];

/// Simple xorshift32 RNG
struct Xorshift32 {
  state: u32,
}

impl Xorshift32 {
  fn new(seed: u32) -> Self {
    Self { state: seed.max(1) }
  }

  fn next(&mut self) -> u32 {
    let mut x = self.state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    self.state = x;
    x
  }

  fn next_float(&mut self) -> f32 {
    (self.next() as f32) / (u32::MAX as f32)
  }

  fn next_range(&mut self, max: usize) -> usize {
    if max == 0 { return 0; }
    (self.next() as usize) % max
  }
}

/// Generates Euclidean rhythm pattern using Bjorklund's algorithm
fn euclidean_pattern(steps: usize, fills: usize, rotate: usize) -> Vec<bool> {
  if steps == 0 { return vec![]; }
  let fills = fills.min(steps);
  if fills == 0 { return vec![false; steps]; }
  if fills == steps { return vec![true; steps]; }

  let mut pattern: Vec<Vec<bool>> = Vec::new();
  for i in 0..steps {
    pattern.push(vec![i < fills]);
  }

  let mut divisor = steps - fills;
  let mut count = fills;

  while divisor > 1 {
    let split = count.min(divisor);
    for i in 0..split {
      if let Some(tail) = pattern.pop() {
        pattern[i].extend(tail);
      }
    }
    divisor -= split;
    count = split;
    if divisor <= 1 { break; }
  }

  let mut result: Vec<bool> = pattern.into_iter().flatten().collect();

  // Apply rotation
  if rotate > 0 && !result.is_empty() {
    let rot = rotate % result.len();
    result.rotate_left(rot);
  }

  result
}

pub struct Arpeggiator {
  sample_rate: f32,

  // Note buffer
  notes: Vec<f32>,           // Notes as pitch CV values
  play_order: Vec<f32>,      // Notes in order played (for AsPlayed mode)
  pattern: Vec<usize>,       // Current pattern indices
  random_pattern: Vec<usize>,// For RandomOnce mode

  // Timing state
  phase: f64,
  samples_per_beat: f64,
  current_step: usize,
  pattern_length: usize,
  #[allow(dead_code)]
  direction: i32,            // 1 or -1 for ping-pong

  // Gate state
  gate_on: bool,
  gate_samples: usize,
  gate_length_samples: usize,

  // Ratchet state
  ratchet_count: usize,
  ratchet_current: usize,
  #[allow(dead_code)]
  ratchet_phase: f64,

  // Strum state (for guitar-like strum)
  #[allow(dead_code)]
  strum_index: usize,
  #[allow(dead_code)]
  strum_delay_samples: usize,
  #[allow(dead_code)]
  strum_counter: usize,

  // Output values
  current_cv: f32,
  current_gate: f32,
  current_accent: f32,

  // Previous gate input (edge detection)
  prev_gate_in: f32,
  prev_clock: f32,
  gate_low_samples: usize,

  // Euclidean pattern cache
  euclid_pattern: Vec<bool>,
  euclid_step: usize,

  // Swing: pending gate info for swung notes
  swing_pending: bool,
  swing_delay_remaining: usize,
  swing_gate_length: usize,
  swing_cv: f32,
  swing_accent: f32,
  swing_ratchet_count: usize,

  // RNG
  rng: Xorshift32,
}

pub struct ArpeggiatorInputs<'a> {
  pub cv_in: Option<&'a [Sample]>,
  pub gate_in: Option<&'a [Sample]>,
  pub clock: Option<&'a [Sample]>,
}

pub struct ArpeggiatorParams<'a> {
  pub enabled: &'a [Sample],
  pub hold: &'a [Sample],
  pub mode: &'a [Sample],
  pub octaves: &'a [Sample],
  pub rate: &'a [Sample],
  pub gate: &'a [Sample],
  pub swing: &'a [Sample],
  pub tempo: &'a [Sample],
  pub ratchet: &'a [Sample],
  pub ratchet_decay: &'a [Sample],
  pub probability: &'a [Sample],
  pub velocity_mode: &'a [Sample],
  pub accent_pattern: &'a [Sample],
  pub euclid_steps: &'a [Sample],
  pub euclid_fill: &'a [Sample],
  pub euclid_rotate: &'a [Sample],
  pub euclid_enabled: &'a [Sample],
  pub mutate: &'a [Sample],
}

pub struct ArpeggiatorOutputs<'a> {
  pub cv_out: &'a mut [Sample],
  pub gate_out: &'a mut [Sample],
  pub accent_out: &'a mut [Sample],
}

impl Arpeggiator {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      notes: Vec::with_capacity(16),
      play_order: Vec::with_capacity(16),
      pattern: Vec::with_capacity(64),
      random_pattern: Vec::with_capacity(64),
      phase: 0.0,
      samples_per_beat: (sample_rate as f64) / 2.0, // 120 BPM default
      current_step: 0,
      pattern_length: 0,
      direction: 1,
      gate_on: false,
      gate_samples: 0,
      gate_length_samples: 0,
      ratchet_count: 1,
      ratchet_current: 0,
      ratchet_phase: 0.0,
      strum_index: 0,
      strum_delay_samples: 0,
      strum_counter: 0,
      current_cv: 0.0,
      current_gate: 0.0,
      current_accent: 0.0,
      prev_gate_in: 0.0,
      prev_clock: 0.0,
      gate_low_samples: 0,
      euclid_pattern: vec![true; 8],
      euclid_step: 0,
      swing_pending: false,
      swing_delay_remaining: 0,
      swing_gate_length: 0,
      swing_cv: 0.0,
      swing_accent: 0.0,
      swing_ratchet_count: 1,
      rng: Xorshift32::new(12345),
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  fn build_pattern(&mut self, mode: ArpMode, octaves: usize) {
    self.pattern.clear();

    if self.notes.is_empty() {
      self.pattern_length = 0;
      return;
    }

    // Sort notes for most modes
    let mut sorted_notes: Vec<(usize, f32)> = self.notes.iter()
      .enumerate()
      .map(|(i, &n)| (i, n))
      .collect();
    sorted_notes.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    let note_count = self.notes.len();
    let _total_notes = note_count * octaves;

    match mode {
      ArpMode::Up => {
        for oct in 0..octaves {
          for &(idx, _) in &sorted_notes {
            self.pattern.push(idx + oct * note_count);
          }
        }
      }
      ArpMode::Down => {
        for oct in (0..octaves).rev() {
          for &(idx, _) in sorted_notes.iter().rev() {
            self.pattern.push(idx + oct * note_count);
          }
        }
      }
      ArpMode::UpDown => {
        // Up
        for oct in 0..octaves {
          for &(idx, _) in &sorted_notes {
            self.pattern.push(idx + oct * note_count);
          }
        }
        // Down (skip first and last to avoid repeats)
        for oct in (0..octaves).rev() {
          let notes_iter: Vec<_> = sorted_notes.iter().rev().collect();
          for (i, &(idx, _)) in notes_iter.iter().enumerate() {
            if (oct == octaves - 1 && i == 0) || (oct == 0 && i == notes_iter.len() - 1) {
              continue;
            }
            self.pattern.push(*idx + oct * note_count);
          }
        }
      }
      ArpMode::DownUp => {
        // Down
        for oct in (0..octaves).rev() {
          for &(idx, _) in sorted_notes.iter().rev() {
            self.pattern.push(idx + oct * note_count);
          }
        }
        // Up (skip first and last)
        for oct in 0..octaves {
          for (i, &(idx, _)) in sorted_notes.iter().enumerate() {
            if (oct == 0 && i == 0) || (oct == octaves - 1 && i == sorted_notes.len() - 1) {
              continue;
            }
            self.pattern.push(idx + oct * note_count);
          }
        }
      }
      ArpMode::Converge => {
        for oct in 0..octaves {
          let len = sorted_notes.len();
          for i in 0..(len + 1) / 2 {
            self.pattern.push(sorted_notes[i].0 + oct * note_count);
            if len - 1 - i != i {
              self.pattern.push(sorted_notes[len - 1 - i].0 + oct * note_count);
            }
          }
        }
      }
      ArpMode::Diverge => {
        for oct in 0..octaves {
          let len = sorted_notes.len();
          let mid = len / 2;
          for i in 0..(len + 1) / 2 {
            if mid >= i && mid - i < len {
              self.pattern.push(sorted_notes[mid - i].0 + oct * note_count);
            }
            if mid + i + 1 < len {
              self.pattern.push(sorted_notes[mid + i + 1].0 + oct * note_count);
            }
          }
        }
      }
      ArpMode::Random | ArpMode::RandomOnce => {
        for oct in 0..octaves {
          for i in 0..note_count {
            self.pattern.push(i + oct * note_count);
          }
        }
        // For RandomOnce, shuffle once
        if mode == ArpMode::RandomOnce {
          self.random_pattern = self.pattern.clone();
          for i in (1..self.random_pattern.len()).rev() {
            let j = self.rng.next_range(i + 1);
            self.random_pattern.swap(i, j);
          }
        }
      }
      ArpMode::AsPlayed => {
        for oct in 0..octaves {
          for i in 0..self.play_order.len().min(note_count) {
            self.pattern.push(i + oct * note_count);
          }
        }
      }
      ArpMode::Chord => {
        // All notes at once - just one step
        self.pattern.push(0);
      }
      ArpMode::StrumUp | ArpMode::StrumDown => {
        for oct in 0..octaves {
          if mode == ArpMode::StrumUp {
            for &(idx, _) in &sorted_notes {
              self.pattern.push(idx + oct * note_count);
            }
          } else {
            for &(idx, _) in sorted_notes.iter().rev() {
              self.pattern.push(idx + oct * note_count);
            }
          }
        }
      }
    }

    self.pattern_length = self.pattern.len().max(1);
  }

  fn get_note_cv(&self, pattern_idx: usize, _octaves: usize) -> f32 {
    if self.notes.is_empty() || self.pattern.is_empty() {
      return 0.0;
    }

    let idx = self.pattern.get(pattern_idx % self.pattern.len()).copied().unwrap_or(0);
    let note_count = self.notes.len();
    let octave = idx / note_count;
    let note_idx = idx % note_count;

    let base_cv = self.notes.get(note_idx).copied().unwrap_or(0.0);
    base_cv + (octave as f32) // Each octave is +1.0 CV
  }

  fn check_accent(&self, step: usize, pattern: usize) -> bool {
    match pattern {
      1 => step % 2 == 0,           // Every 2nd
      2 => step % 3 == 0,           // Every 3rd
      3 => step % 4 == 0,           // Every 4th
      4 => step % 4 == 0 || step % 4 == 2, // 1 and 3
      5 => matches!(step % 8, 0 | 3 | 6),  // Syncopated
      6 => step % 8 == 0 || step % 8 == 4, // Trance
      7 => step % 4 == 0,           // Custom (fallback to 4)
      _ => false,
    }
  }

  pub fn process_block(
    &mut self,
    outputs: ArpeggiatorOutputs<'_>,
    inputs: ArpeggiatorInputs<'_>,
    params: ArpeggiatorParams<'_>,
  ) {
    let len = outputs.cv_out.len();
    if len == 0 { return; }

    let enabled = sample_at(params.enabled, 0, 1.0) >= 0.5;
    let hold = sample_at(params.hold, 0, 0.0) >= 0.5;
    let mode_idx = sample_at(params.mode, 0, 0.0) as usize;
    let mode = ArpMode::from_index(mode_idx);
    let octaves = (sample_at(params.octaves, 0, 1.0) as usize).clamp(1, 4);
    let rate_idx = (sample_at(params.rate, 0, 7.0) as usize).min(15);
    let gate_pct = sample_at(params.gate, 0, 75.0).clamp(10.0, 100.0) / 100.0;
    let swing = sample_at(params.swing, 0, 0.0).clamp(0.0, 100.0) / 100.0;
    let tempo = sample_at(params.tempo, 0, 120.0).clamp(40.0, 300.0);
    let ratchet = (sample_at(params.ratchet, 0, 1.0) as usize).clamp(1, 8);
    let probability = sample_at(params.probability, 0, 100.0).clamp(0.0, 100.0) / 100.0;
    let accent_pattern = sample_at(params.accent_pattern, 0, 0.0) as usize;
    let euclid_enabled = sample_at(params.euclid_enabled, 0, 0.0) >= 0.5;
    let euclid_steps = (sample_at(params.euclid_steps, 0, 8.0) as usize).clamp(2, 16);
    let euclid_fill = (sample_at(params.euclid_fill, 0, 4.0) as usize).clamp(1, 16);
    let euclid_rotate = sample_at(params.euclid_rotate, 0, 0.0) as usize;
    let mutate = sample_at(params.mutate, 0, 0.0).clamp(0.0, 100.0) / 100.0;
    let gate_release_threshold = (self.sample_rate * 0.001).max(1.0) as usize;

    // Calculate timing
    let beats_per_second = tempo / 60.0;
    let rate_mult = RATE_DIVISIONS[rate_idx];
    let step_duration_seconds = rate_mult / beats_per_second;
    let step_duration_samples = step_duration_seconds as f64 * self.sample_rate as f64;
    self.samples_per_beat = step_duration_samples;

    // Update euclidean pattern if needed
    if euclid_enabled {
      self.euclid_pattern = euclidean_pattern(euclid_steps, euclid_fill, euclid_rotate);
    }

    for i in 0..len {
      let cv_in = inputs.cv_in.map_or(0.0, |b| sample_at(b, i, 0.0));
      let gate_in = inputs.gate_in.map_or(0.0, |b| sample_at(b, i, 0.0));
      let clock_in = inputs.clock.map_or(-1.0, |b| sample_at(b, i, 0.0));

      // Detect note on/off with a small debounce to ignore retrigger dips.
      let gate_high = gate_in > 0.5;
      if gate_high {
        self.gate_low_samples = 0;
      } else {
        self.gate_low_samples = self.gate_low_samples.saturating_add(1);
      }
      let gate_rising = gate_high && self.prev_gate_in <= 0.5;
      let gate_released = !gate_high && self.gate_low_samples == gate_release_threshold;

      if gate_rising {
        // Add note
        let is_new_note = !self.notes.contains(&cv_in);
        if is_new_note {
          self.notes.push(cv_in);
          self.play_order.push(cv_in);
          if self.notes.len() > 16 {
            self.notes.remove(0);
          }
          if self.play_order.len() > 16 {
            self.play_order.remove(0);
          }
        }
        self.build_pattern(mode, octaves);

        // Reset phase on first note to start immediately
        if self.notes.len() == 1 {
          self.phase = 0.999; // Will trigger on next sample
          self.current_step = 0;
        }
      }

      if gate_released && !hold {
        self.clear_notes();
      }

      self.prev_gate_in = gate_in;

      // If not enabled or no notes, output silence
      if !enabled || self.notes.is_empty() {
        outputs.cv_out[i] = self.current_cv;
        outputs.gate_out[i] = 0.0;
        outputs.accent_out[i] = 0.0;
        continue;
      }

      // Check for clock input or use internal timing
      let clock_trigger = clock_in > 0.5 && self.prev_clock <= 0.5;
      self.prev_clock = clock_in;

      // Advance phase
      let use_external_clock = clock_in >= 0.0;
      let step_advance = if use_external_clock {
        clock_trigger
      } else {
        self.phase += 1.0 / step_duration_samples;
        if self.phase >= 1.0 {
          self.phase -= 1.0;
          true
        } else {
          false
        }
      };

      // Handle pending swing gate FIRST (before new step can overwrite)
      if self.swing_pending && self.swing_delay_remaining > 0 {
        self.swing_delay_remaining -= 1;
        if self.swing_delay_remaining == 0 {
          // Swing delay finished - force start the swung gate
          self.swing_pending = false;
          self.current_cv = self.swing_cv;
          self.current_accent = self.swing_accent;
          self.gate_on = true;
          self.gate_length_samples = self.swing_gate_length;
          self.gate_samples = 0;
          self.ratchet_count = self.swing_ratchet_count;
          self.ratchet_current = 0;
        }
      }

      if step_advance {
        // Cancel any pending swing that didn't fire (shouldn't happen normally)
        self.swing_pending = false;

        // Calculate swing for odd steps (limited to 45% to prevent overlap)
        let is_odd_step = self.current_step % 2 == 1;
        let swing_clamped = swing.min(0.9); // Max 90% swing = 45% delay
        let swing_delay_samples = if is_odd_step && swing_clamped > 0.0 && !use_external_clock {
          (swing_clamped as f64 * 0.5 * step_duration_samples) as usize
        } else {
          0
        };

        // Euclidean gate check
        let euclid_gate = if euclid_enabled {
          let step = self.euclid_step % self.euclid_pattern.len().max(1);
          self.euclid_step = (self.euclid_step + 1) % self.euclid_pattern.len().max(1);
          self.euclid_pattern.get(step).copied().unwrap_or(true)
        } else {
          true
        };

        // Probability check
        let prob_pass = self.rng.next_float() <= probability;

        // Check if we should play this step
        if euclid_gate && prob_pass {
          // Get the note for this step
          let pattern_idx = if mode == ArpMode::Random {
            self.rng.next_range(self.pattern_length.max(1))
          } else if mode == ArpMode::RandomOnce {
            self.current_step % self.random_pattern.len().max(1)
          } else {
            self.current_step % self.pattern_length.max(1)
          };

          // Apply mutation
          let mutated_idx = if mutate > 0.0 && self.rng.next_float() < mutate {
            self.rng.next_range(self.pattern_length.max(1))
          } else {
            pattern_idx
          };

          let note_cv = self.get_note_cv(mutated_idx, octaves);
          let note_accent = if self.check_accent(self.current_step, accent_pattern) { 1.0 } else { 0.0 };
          let gate_samples = (step_duration_samples * gate_pct as f64) as usize;

          if swing_delay_samples == 0 {
            // No swing - start gate immediately
            self.current_cv = note_cv;
            self.current_accent = note_accent;
            self.gate_on = true;
            self.gate_length_samples = gate_samples / ratchet;
            self.gate_samples = 0;
            self.ratchet_count = ratchet;
            self.ratchet_current = 0;
          } else {
            // Swing delay - store note info for later
            self.swing_pending = true;
            self.swing_delay_remaining = swing_delay_samples;
            self.swing_cv = note_cv;
            self.swing_accent = note_accent;
            self.swing_gate_length = gate_samples / ratchet;
            self.swing_ratchet_count = ratchet;
          }
        }

        // Advance step
        self.current_step = (self.current_step + 1) % self.pattern_length.max(1);
      }

      // Handle gate timing with ratchets
      if self.gate_on {
        self.gate_samples += 1;

        // Check for ratchet retrigs
        if self.ratchet_count > 1 {
          let ratchet_period = self.gate_length_samples * 2;
          if self.gate_samples >= ratchet_period && self.ratchet_current < self.ratchet_count - 1 {
            self.ratchet_current += 1;
            self.gate_samples = 0;
          }
        }

        // Gate on/off within step
        if self.gate_samples < self.gate_length_samples {
          self.current_gate = 1.0;
        } else {
          self.current_gate = 0.0;
          if self.ratchet_current >= self.ratchet_count - 1 {
            self.gate_on = false;
          }
        }
      } else {
        self.current_gate = 0.0;
      }

      // Special handling for Chord mode - all notes play together
      if mode == ArpMode::Chord && !self.notes.is_empty() {
        self.current_cv = self.notes[0]; // Just output first note CV-wise
        self.current_gate = if self.gate_on { 1.0 } else { 0.0 };
      }

      outputs.cv_out[i] = self.current_cv;
      outputs.gate_out[i] = self.current_gate;
      outputs.accent_out[i] = self.current_accent;
    }
  }

  /// Clear all held notes
  pub fn clear_notes(&mut self) {
    self.notes.clear();
    self.play_order.clear();
    self.pattern.clear();
    self.pattern_length = 0;
    self.current_step = 0;
    self.phase = 0.0;
    self.gate_on = false;
    self.current_gate = 0.0;
    self.swing_pending = false;
    self.swing_delay_remaining = 0;
  }
}

// ============================================================================
// Step Sequencer - 16-step sequencer with pitch/gate/velocity/slide per step
// ============================================================================

/// Single step in the sequence
#[derive(Clone, Copy)]
pub struct SeqStep {
  pub pitch: f32,      // Semitone offset (-24 to +24)
  pub gate: bool,      // Step active (on/off)
  pub velocity: f32,   // 0.0 to 1.0
  pub slide: bool,     // Glide to next note
}

impl Default for SeqStep {
  fn default() -> Self {
    Self {
      pitch: 0.0,
      gate: true,
      velocity: 1.0,
      slide: false,
    }
  }
}

/// Rate divisions for tempo sync (same as Arpeggiator)
const SEQ_RATE_DIVISIONS: [f64; 12] = [
  4.0,    // 0: 1 bar
  2.0,    // 1: 1/2
  1.0,    // 2: 1/4
  0.5,    // 3: 1/8
  0.25,   // 4: 1/16
  0.125,  // 5: 1/32
  1.333,  // 6: 1/4 triplet (1/4 * 2/3)
  0.667,  // 7: 1/8 triplet
  0.333,  // 8: 1/16 triplet
  1.5,    // 9: 1/4 dotted
  0.75,   // 10: 1/8 dotted
  0.375,  // 11: 1/16 dotted
];

/// 16-step sequencer
pub struct StepSequencer {
  sample_rate: f32,

  // Step data - 16 steps
  steps: [SeqStep; 16],

  // Playback state
  current_step: usize,
  phase: f64,
  samples_per_beat: f64,
  #[allow(dead_code)]
  direction: i32,        // 1 or -1 for ping-pong
  ping_pong_forward: bool,

  // Gate timing
  gate_on: bool,
  gate_samples: usize,
  gate_length_samples: usize,

  // Slide (portamento) state
  slide_active: bool,
  slide_source_cv: f32,
  slide_target_cv: f32,
  slide_samples: usize,
  slide_total_samples: usize,

  // Swing state
  swing_pending: bool,
  swing_delay_remaining: usize,
  swing_cv: f32,
  swing_velocity: f32,
  swing_gate_length: usize,

  // Output values
  current_cv: f32,
  current_gate: f32,
  current_velocity: f32,

  // Clock state
  prev_clock: f32,
  prev_reset: f32,

  // RNG for random mode and humanize
  rng: Xorshift32,
}

pub struct StepSequencerInputs<'a> {
  pub clock: Option<&'a [Sample]>,      // External clock input
  pub reset: Option<&'a [Sample]>,      // Reset to step 1
  pub cv_offset: Option<&'a [Sample]>,  // Base pitch CV offset
}

pub struct StepSequencerParams<'a> {
  pub enabled: &'a [Sample],
  pub tempo: &'a [Sample],           // 40-300 BPM
  pub rate: &'a [Sample],            // Rate division index
  pub gate_length: &'a [Sample],     // 10-100%
  pub swing: &'a [Sample],           // 0-90%
  pub slide_time: &'a [Sample],      // 0-500ms global slide time
  pub length: &'a [Sample],          // 1-16 active steps
  pub direction: &'a [Sample],       // 0=fwd, 1=rev, 2=pingpong, 3=random
}

pub struct StepSequencerOutputs<'a> {
  pub cv_out: &'a mut [Sample],
  pub gate_out: &'a mut [Sample],
  pub velocity_out: &'a mut [Sample],
  pub step_out: &'a mut [Sample],
}

impl StepSequencer {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      steps: [SeqStep::default(); 16],
      current_step: 0,
      phase: 0.0,
      samples_per_beat: sample_rate as f64 * 0.5, // Default 1/8 at 120 BPM
      direction: 1,
      ping_pong_forward: true,
      gate_on: false,
      gate_samples: 0,
      gate_length_samples: 0,
      slide_active: false,
      slide_source_cv: 0.0,
      slide_target_cv: 0.0,
      slide_samples: 0,
      slide_total_samples: 0,
      swing_pending: false,
      swing_delay_remaining: 0,
      swing_cv: 0.0,
      swing_velocity: 1.0,
      swing_gate_length: 0,
      current_cv: 0.0,
      current_gate: 0.0,
      current_velocity: 1.0,
      prev_clock: 0.0,
      prev_reset: 0.0,
      rng: Xorshift32::new(42),
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  /// Get current step position (0-15)
  pub fn current_step(&self) -> usize {
    self.current_step
  }

  /// Set step data from parsed values
  pub fn set_step(&mut self, index: usize, pitch: f32, gate: bool, velocity: f32, slide: bool) {
    if index < 16 {
      self.steps[index] = SeqStep {
        pitch: pitch.clamp(-24.0, 24.0),
        gate,
        velocity: velocity.clamp(0.0, 1.0),
        slide,
      };
    }
  }

  /// Parse JSON step data string and update all steps
  pub fn parse_step_data(&mut self, json: &str) {
    // Simple JSON parser for step data array
    // Format: [{"pitch":0,"gate":true,"velocity":100,"slide":false},...]
    if !json.starts_with('[') {
      return;
    }

    let mut step_idx = 0;
    let mut in_object = false;
    let mut current_pitch: f32 = 0.0;
    let mut current_gate = true;
    let mut current_velocity: f32 = 1.0;
    let mut current_slide = false;

    let mut key = String::new();
    let mut value = String::new();
    let mut reading_key = false;
    let mut reading_value = false;
    let mut in_string = false;

    for c in json.chars() {
      match c {
        '{' => {
          in_object = true;
          current_pitch = 0.0;
          current_gate = true;
          current_velocity = 1.0;
          current_slide = false;
          key.clear();
          value.clear();
        }
        '}' => {
          if in_object {
            // Apply last key-value pair
            if !key.is_empty() {
              match key.as_str() {
                "pitch" => current_pitch = value.parse().unwrap_or(0.0),
                "gate" => current_gate = value == "true",
                "velocity" => {
                  let v: f32 = value.parse().unwrap_or(100.0);
                  current_velocity = v / 100.0; // Convert 0-100 to 0-1
                }
                "slide" => current_slide = value == "true",
                _ => {}
              }
            }
            // Save step
            if step_idx < 16 {
              self.steps[step_idx] = SeqStep {
                pitch: current_pitch.clamp(-24.0, 24.0),
                gate: current_gate,
                velocity: current_velocity.clamp(0.0, 1.0),
                slide: current_slide,
              };
              step_idx += 1;
            }
            in_object = false;
          }
        }
        '"' => {
          if !in_string {
            in_string = true;
            if !reading_key && !reading_value {
              reading_key = true;
              key.clear();
            }
          } else {
            in_string = false;
            reading_key = false;
          }
        }
        ':' if !in_string => {
          reading_value = true;
          value.clear();
        }
        ',' if !in_string => {
          if reading_value && !key.is_empty() {
            match key.as_str() {
              "pitch" => current_pitch = value.trim().parse().unwrap_or(0.0),
              "gate" => current_gate = value.trim() == "true",
              "velocity" => {
                let v: f32 = value.trim().parse().unwrap_or(100.0);
                current_velocity = v / 100.0;
              }
              "slide" => current_slide = value.trim() == "true",
              _ => {}
            }
          }
          reading_value = false;
          key.clear();
          value.clear();
        }
        _ => {
          if in_string && reading_key {
            key.push(c);
          } else if reading_value && !in_string {
            if !c.is_whitespace() {
              value.push(c);
            }
          }
        }
      }
    }
  }

  pub fn process_block(
    &mut self,
    outputs: StepSequencerOutputs<'_>,
    inputs: StepSequencerInputs<'_>,
    params: StepSequencerParams<'_>,
  ) {
    let frames = outputs.cv_out.len();
    if frames == 0 {
      return;
    }

    // Read params
    let enabled = sample_at(params.enabled, 0, 1.0) > 0.5;
    let tempo = sample_at(params.tempo, 0, 120.0).clamp(40.0, 300.0);
    let rate_idx = (sample_at(params.rate, 0, 3.0) as usize).min(SEQ_RATE_DIVISIONS.len() - 1);
    let gate_pct = sample_at(params.gate_length, 0, 50.0).clamp(10.0, 100.0) / 100.0;
    let swing = sample_at(params.swing, 0, 0.0).clamp(0.0, 90.0) / 100.0;
    let slide_time_ms = sample_at(params.slide_time, 0, 50.0).clamp(0.0, 500.0);
    let length = (sample_at(params.length, 0, 16.0) as usize).clamp(1, 16);
    let dir_mode = (sample_at(params.direction, 0, 0.0) as usize).min(3);

    // Calculate timing
    let beats_per_second = tempo as f64 / 60.0;
    let rate_mult = SEQ_RATE_DIVISIONS[rate_idx];
    let step_duration_seconds = rate_mult / beats_per_second;
    let step_duration_samples = step_duration_seconds * self.sample_rate as f64;
    self.samples_per_beat = step_duration_samples;

    let gate_length_samples = (step_duration_samples * gate_pct as f64) as usize;
    let slide_samples = ((slide_time_ms / 1000.0) * self.sample_rate) as usize;

    // Use external clock if connected
    let use_external_clock = inputs.clock.is_some()
      && inputs.clock.map_or(false, |c| c.iter().any(|&v| v >= 0.0));

    for i in 0..frames {
      if !enabled {
        outputs.cv_out[i] = 0.0;
        outputs.gate_out[i] = 0.0;
        outputs.velocity_out[i] = 0.0;
        outputs.step_out[i] = 0.0;
        continue;
      }

      let cv_offset = inputs.cv_offset.map_or(0.0, |b| sample_at(b, i, 0.0));

      // Check for reset
      let reset_in = inputs.reset.map_or(0.0, |b| sample_at(b, i, 0.0));
      let reset_trigger = reset_in > 0.5 && self.prev_reset <= 0.5;
      self.prev_reset = reset_in;

      if reset_trigger {
        self.current_step = 0;
        self.phase = 0.0;
        self.ping_pong_forward = true;
        self.gate_on = false;
        self.swing_pending = false;
      }

      // Process pending swing step
      if self.swing_pending {
        if self.swing_delay_remaining > 0 {
          self.swing_delay_remaining -= 1;
        } else {
          // Fire the swung step
          self.swing_pending = false;
          self.current_cv = self.swing_cv;
          self.current_velocity = self.swing_velocity;
          self.gate_on = true;
          self.gate_samples = 0;
          self.gate_length_samples = self.swing_gate_length;
        }
      }

      // Determine step advance
      let clock_in = inputs.clock.map_or(-1.0, |b| sample_at(b, i, 0.0));
      let clock_trigger = clock_in > 0.5 && self.prev_clock <= 0.5;
      self.prev_clock = clock_in;

      let step_advance = if use_external_clock {
        clock_trigger
      } else {
        self.phase += 1.0 / step_duration_samples;
        if self.phase >= 1.0 {
          self.phase -= 1.0;
          true
        } else {
          false
        }
      };

      if step_advance && !self.swing_pending {
        // Calculate next step based on direction mode
        let next_step = match dir_mode {
          0 => (self.current_step + 1) % length, // Forward
          1 => {
            // Reverse
            if self.current_step == 0 {
              length - 1
            } else {
              self.current_step - 1
            }
          }
          2 => {
            // Ping-pong
            if self.ping_pong_forward {
              if self.current_step >= length - 1 {
                self.ping_pong_forward = false;
                self.current_step.saturating_sub(1)
              } else {
                self.current_step + 1
              }
            } else {
              if self.current_step == 0 {
                self.ping_pong_forward = true;
                1.min(length - 1)
              } else {
                self.current_step - 1
              }
            }
          }
          _ => self.rng.next() as usize % length, // Random
        };

        // Get step data
        let step = &self.steps[next_step];
        let step_cv = step.pitch / 12.0; // Semitones to V/oct

        // Check for slide from previous step
        let prev_step = &self.steps[self.current_step];
        if prev_step.slide && step.gate {
          // Start slide
          self.slide_active = true;
          self.slide_source_cv = self.current_cv;
          self.slide_target_cv = step_cv;
          self.slide_samples = 0;
          self.slide_total_samples = slide_samples.max(1);
        } else {
          self.slide_active = false;
        }

        // Check for swing (apply to odd steps)
        let is_odd_step = next_step % 2 == 1;
        let swing_delay = if is_odd_step && swing > 0.0 {
          let max_swing = 0.45; // Cap at 45%
          let clamped_swing = (swing as f64).min(max_swing);
          (step_duration_samples * clamped_swing) as usize
        } else {
          0
        };

        if step.gate {
          if swing_delay > 0 {
            // Queue the step for later
            self.swing_pending = true;
            self.swing_delay_remaining = swing_delay;
            self.swing_cv = step_cv;
            self.swing_velocity = step.velocity;
            self.swing_gate_length = gate_length_samples;
          } else {
            // Immediate step
            if !self.slide_active {
              self.current_cv = step_cv;
            }
            self.current_velocity = step.velocity;
            self.gate_on = true;
            self.gate_samples = 0;
            self.gate_length_samples = gate_length_samples;
          }
        } else {
          // Step is off
          self.gate_on = false;
        }

        self.current_step = next_step;
      }

      // Update slide interpolation
      if self.slide_active {
        self.slide_samples += 1;
        let t = (self.slide_samples as f32) / (self.slide_total_samples as f32).max(1.0);
        let t = t.min(1.0);
        self.current_cv = self.slide_source_cv + (self.slide_target_cv - self.slide_source_cv) * t;
        if t >= 1.0 {
          self.slide_active = false;
        }
      }

      // Update gate
      if self.gate_on {
        self.gate_samples += 1;
        if self.gate_samples >= self.gate_length_samples {
          self.current_gate = 0.0;
          self.gate_on = false;
        } else {
          self.current_gate = 1.0;
        }
      } else {
        self.current_gate = 0.0;
      }

      // Write outputs
      outputs.cv_out[i] = self.current_cv + cv_offset;
      outputs.gate_out[i] = self.current_gate;
      outputs.velocity_out[i] = self.current_velocity;
      outputs.step_out[i] = self.current_step as f32;
    }
  }
}

// ============================================================================
// TB-303 Synthesizer Module
// ============================================================================

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

pub struct Tb303Params<'a> {
  pub waveform: &'a [Sample],    // 0 = saw, 1 = square
  pub cutoff: &'a [Sample],      // Hz
  pub resonance: &'a [Sample],   // 0-1
  pub decay: &'a [Sample],       // seconds
  pub envmod: &'a [Sample],      // 0-1 filter env amount
  pub accent: &'a [Sample],      // 0-1 accent boost
  pub glide: &'a [Sample],       // seconds
}

pub struct Tb303Inputs<'a> {
  pub pitch: Option<&'a [Sample]>,    // V/oct CV
  pub gate: Option<&'a [Sample]>,     // Gate signal
  pub velocity: Option<&'a [Sample]>, // Velocity (>0.7 = accent)
  pub cutoff_cv: Option<&'a [Sample]>,// External cutoff modulation
}

pub struct Tb303Outputs<'a> {
  pub audio: &'a mut [Sample],
  pub env_out: &'a mut [Sample],
}

impl Tb303 {
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

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  /// 3-pole diode ladder filter (18dB/oct) - TB-303 character
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
    let accent_decay_coeff = (-1.0 / (0.05 * self.sample_rate)).exp(); // Fast accent decay (50ms)
    let amp_attack_coeff = 1.0 - (-1.0 / (0.003 * self.sample_rate)).exp(); // 3ms attack
    let amp_release_coeff = (-1.0 / (0.01 * self.sample_rate)).exp(); // 10ms release

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

      // Filter envelope decay
      self.filter_env *= decay_coeff;

      // Accent envelope decay (faster)
      self.accent_env *= accent_decay_coeff;

      // Amp envelope
      if self.gate_on {
        self.amp_env += (1.0 - self.amp_env) * amp_attack_coeff;
      } else {
        self.amp_env *= amp_release_coeff;
      }

      // Calculate oscillator
      let dt = self.current_freq / self.sample_rate;
      self.phase += dt;
      if self.phase >= 1.0 {
        self.phase -= 1.0;
      }

      // Waveform selection with polyBLEP anti-aliasing
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
      // env_mod in octaves: envmod * 4 octaves range
      let accent_boost = self.accent_env * accent_amount * 2.0; // 2 octaves accent boost
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

// ============================================================================
// TR-909 DRUM SYNTHESIS
// ============================================================================

/// TR-909 Kick Drum
/// Analog synthesis: sine oscillator with pitch envelope + click + drive
pub struct Kick909 {
  sample_rate: f32,
  phase: f32,
  pitch_env: f32,
  amp_env: f32,
  click_env: f32,
  triggered: bool,
  last_trig: f32,
  noise_state: u32,  // For click noise generation
  latched_accent: f32,  // Accent value captured at trigger
}

pub struct Kick909Params<'a> {
  pub tune: &'a [f32],      // Base pitch (Hz), typically 40-80
  pub attack: &'a [f32],    // Click/punch amount 0-1 (adds transient click)
  pub decay: &'a [f32],     // Amp decay time 0.1-2.0 seconds
  pub drive: &'a [f32],     // Saturation amount 0-1
}

pub struct Kick909Inputs<'a> {
  pub trigger: Option<&'a [f32]>,
  pub accent: Option<&'a [f32]>,
}

impl Kick909 {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      phase: 0.0,
      pitch_env: 0.0,
      amp_env: 0.0,
      click_env: 0.0,
      triggered: false,
      last_trig: 0.0,
      noise_state: 0x12345678,
      latched_accent: 0.5,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  pub fn process_block(
    &mut self,
    output: &mut [f32],
    inputs: Kick909Inputs,
    params: Kick909Params,
  ) {
    let len = output.len();

    for i in 0..len {
      let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(30.0, 120.0);
      let attack = params.attack.get(i).copied().unwrap_or(params.attack[0]).clamp(0.0, 1.0);
      let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.1, 2.0);
      let drive = params.drive.get(i).copied().unwrap_or(params.drive[0]).clamp(0.0, 1.0);

      let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
      let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

      // Trigger detection (rising edge)
      if trig > 0.5 && self.last_trig <= 0.5 {
        self.triggered = true;
        self.pitch_env = 1.0;
        self.amp_env = 1.0;
        self.click_env = 1.0;
        self.phase = 0.0;
        // Latch accent at trigger time
        self.latched_accent = accent_in;
      }
      self.last_trig = trig;

      // Pitch envelope: fast exponential decay (gives the "thump")
      // Higher pitch at start, drops to base tune
      let pitch_decay_rate = 0.0003; // Very fast
      self.pitch_env *= 1.0 - pitch_decay_rate * (self.sample_rate / 48000.0);

      // Current frequency: base + pitch envelope sweep (up to +3 octaves at trigger)
      let freq = tune * (1.0 + self.pitch_env * 8.0);

      // Oscillator (sine wave)
      let dt = freq / self.sample_rate;
      self.phase += dt;
      if self.phase >= 1.0 {
        self.phase -= 1.0;
      }
      let sine = (self.phase * std::f32::consts::TAU).sin();

      // Click (short noise burst for punch/attack)
      // Use proper noise generator for better transient
      self.noise_state = self.noise_state.wrapping_mul(1664525).wrapping_add(1013904223);
      let noise = (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0;

      // Click envelope decays quickly (about 5-10ms)
      let click_decay = 1.0 - 0.003 * (self.sample_rate / 48000.0);
      self.click_env *= click_decay;

      // Mix noise with high-frequency component for punch
      let click = noise * self.click_env * attack * 0.8;

      // Amplitude envelope
      let amp_decay_rate = 1.0 / (decay * self.sample_rate);
      self.amp_env = (self.amp_env - amp_decay_rate).max(0.0);

      // Mix sine + click
      let mut sample = (sine + click) * self.amp_env;

      // Apply accent (louder + more punch) - use latched value from trigger
      sample *= 0.7 + self.latched_accent * 0.6;

      // Drive/saturation
      if drive > 0.0 {
        let gain = 1.0 + drive * 4.0;
        sample = (sample * gain).tanh();
      }

      output[i] = sample.clamp(-1.0, 1.0);
    }
  }
}

/// TR-909 Snare Drum
/// Analog synthesis: tone oscillator + filtered noise
pub struct Snare909 {
  sample_rate: f32,
  phase: f32,
  noise_state: u32,
  amp_env: f32,
  noise_env: f32,
  last_trig: f32,
  latched_accent: f32,
}

pub struct Snare909Params<'a> {
  pub tune: &'a [f32],      // Tone pitch 100-400 Hz
  pub tone: &'a [f32],      // Tone vs noise mix 0-1
  pub snappy: &'a [f32],    // Noise brightness/snap 0-1
  pub decay: &'a [f32],     // Decay time 0.1-1.0 seconds
}

pub struct Snare909Inputs<'a> {
  pub trigger: Option<&'a [f32]>,
  pub accent: Option<&'a [f32]>,
}

impl Snare909 {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      phase: 0.0,
      noise_state: 0x12345678,
      amp_env: 0.0,
      noise_env: 0.0,
      last_trig: 0.0,
      latched_accent: 0.5,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  fn white_noise(&mut self) -> f32 {
    // Simple LFSR noise
    self.noise_state ^= self.noise_state << 13;
    self.noise_state ^= self.noise_state >> 17;
    self.noise_state ^= self.noise_state << 5;
    (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0
  }

  pub fn process_block(
    &mut self,
    output: &mut [f32],
    inputs: Snare909Inputs,
    params: Snare909Params,
  ) {
    let len = output.len();

    for i in 0..len {
      let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(100.0, 400.0);
      let tone_mix = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);
      let snappy = params.snappy.get(i).copied().unwrap_or(params.snappy[0]).clamp(0.0, 1.0);
      let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.05, 1.0);

      let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
      let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

      // Trigger detection
      if trig > 0.5 && self.last_trig <= 0.5 {
        self.amp_env = 1.0;
        self.noise_env = 1.0;
        self.phase = 0.0;
        self.latched_accent = accent_in;
      }
      self.last_trig = trig;

      // Tone oscillator (two detuned oscillators for thickness)
      let dt1 = tune / self.sample_rate;
      let _dt2 = (tune * 1.5) / self.sample_rate; // Fifth harmonic (reserved)
      self.phase += dt1;
      if self.phase >= 1.0 {
        self.phase -= 1.0;
      }
      let tone1 = (self.phase * std::f32::consts::TAU).sin();
      let tone2 = (self.phase * 1.5 * std::f32::consts::TAU).sin() * 0.5;
      let tone_signal = (tone1 + tone2) * 0.6;

      // Noise with envelope (decays faster than tone)
      let noise_decay_rate = 1.0 / (decay * 0.4 * self.sample_rate);
      self.noise_env = (self.noise_env - noise_decay_rate).max(0.0);
      let noise = self.white_noise();

      // Snappy control affects noise high-pass (simple approximation)
      let noise_signal = noise * self.noise_env * (0.3 + snappy * 0.7);

      // Amplitude envelope for tone
      let amp_decay_rate = 1.0 / (decay * self.sample_rate);
      self.amp_env = (self.amp_env - amp_decay_rate).max(0.0);

      // Mix tone and noise
      let tone_amount = tone_signal * self.amp_env * tone_mix;
      let noise_amount = noise_signal * (1.0 - tone_mix * 0.3);
      let mut sample = (tone_amount + noise_amount) * 0.7;

      // Apply accent (latched at trigger)
      sample *= 0.7 + self.latched_accent * 0.5;

      output[i] = sample.clamp(-1.0, 1.0);
    }
  }
}

/// TR-909 Hi-Hat
/// Metallic noise: 6 square waves at inharmonic ratios + bandpass filter
pub struct HiHat909 {
  sample_rate: f32,
  phases: [f32; 6],
  filter_state: [f32; 2], // Simple bandpass state
  amp_env: f32,
  last_trig: f32,
  is_open: bool,
  latched_accent: f32,
}

pub struct HiHat909Params<'a> {
  pub tune: &'a [f32],      // Base frequency multiplier 0.5-2.0
  pub decay: &'a [f32],     // Decay time 0.05-1.0 seconds
  pub tone: &'a [f32],      // Filter brightness 0-1
  pub open: &'a [f32],      // 0 = closed, 1 = open
}

pub struct HiHat909Inputs<'a> {
  pub trigger: Option<&'a [f32]>,
  pub accent: Option<&'a [f32]>,
}

impl HiHat909 {
  // Metallic ratios from TR-909 analysis
  const RATIOS: [f32; 6] = [1.0, 1.4471, 1.6170, 1.9265, 2.5028, 2.6637];
  const BASE_FREQ: f32 = 320.0; // Base metallic frequency

  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      phases: [0.0; 6],
      filter_state: [0.0; 2],
      amp_env: 0.0,
      last_trig: 0.0,
      is_open: false,
      latched_accent: 0.5,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  pub fn process_block(
    &mut self,
    output: &mut [f32],
    inputs: HiHat909Inputs,
    params: HiHat909Params,
  ) {
    let len = output.len();

    for i in 0..len {
      let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(0.5, 2.0);
      let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.02, 1.5);
      let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);
      let open = params.open.get(i).copied().unwrap_or(params.open[0]);

      let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
      let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

      // Trigger detection
      if trig > 0.5 && self.last_trig <= 0.5 {
        self.amp_env = 1.0;
        self.is_open = open > 0.5;
        self.latched_accent = accent_in;
      }
      self.last_trig = trig;

      // Generate metallic noise from 6 square waves
      let base_freq = Self::BASE_FREQ * tune;
      let mut metallic = 0.0_f32;

      for (j, phase) in self.phases.iter_mut().enumerate() {
        let freq = base_freq * Self::RATIOS[j];
        let dt = freq / self.sample_rate;
        *phase += dt;
        if *phase >= 1.0 {
          *phase -= 1.0;
        }
        // Square wave
        let square = if *phase < 0.5 { 1.0 } else { -1.0 };
        metallic += square;
      }
      metallic /= 6.0; // Normalize

      // Simple bandpass filter (resonant)
      let cutoff = 4000.0 + tone * 8000.0; // 4-12 kHz
      let f = (std::f32::consts::PI * cutoff / self.sample_rate).tan();
      let q = 0.5 + tone * 1.5;
      let k = 1.0 / q;
      let norm = 1.0 / (1.0 + k * f + f * f);

      let _filtered = metallic - self.filter_state[0] * 2.0;
      self.filter_state[0] += f * (metallic - self.filter_state[0] - self.filter_state[1] * k);
      self.filter_state[1] += f * self.filter_state[0];
      let bandpass = self.filter_state[0] * f * norm * 2.0;

      // Amplitude envelope
      let actual_decay = if self.is_open { decay } else { decay * 0.15 }; // Closed is much shorter
      let amp_decay_rate = 1.0 / (actual_decay * self.sample_rate);
      self.amp_env = (self.amp_env - amp_decay_rate).max(0.0);

      let mut sample = bandpass * self.amp_env * 0.8;

      // Apply accent (latched at trigger)
      sample *= 0.7 + self.latched_accent * 0.4;

      output[i] = sample.clamp(-1.0, 1.0);
    }
  }
}

/// TR-909 Clap
/// Filtered noise with multi-trigger envelope for that "clap" character
pub struct Clap909 {
  sample_rate: f32,
  noise_state: u32,
  filter_state: [f32; 2],
  amp_env: f32,
  clap_stage: u8, // 0-3 for multi-trigger effect
  stage_counter: u32,
  last_trig: f32,
  latched_accent: f32,
}

pub struct Clap909Params<'a> {
  pub tone: &'a [f32],      // Filter brightness 0-1
  pub decay: &'a [f32],     // Tail decay 0.1-1.0 seconds
}

pub struct Clap909Inputs<'a> {
  pub trigger: Option<&'a [f32]>,
  pub accent: Option<&'a [f32]>,
}

impl Clap909 {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      noise_state: 0xABCDEF01,
      filter_state: [0.0; 2],
      amp_env: 0.0,
      clap_stage: 3, // Start at 3 to prevent auto-trigger on creation
      stage_counter: 0,
      last_trig: 0.0,
      latched_accent: 0.5,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  fn white_noise(&mut self) -> f32 {
    self.noise_state ^= self.noise_state << 13;
    self.noise_state ^= self.noise_state >> 17;
    self.noise_state ^= self.noise_state << 5;
    (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0
  }

  pub fn process_block(
    &mut self,
    output: &mut [f32],
    inputs: Clap909Inputs,
    params: Clap909Params,
  ) {
    let len = output.len();
    let stage_samples = (self.sample_rate * 0.012) as u32; // ~12ms between claps

    for i in 0..len {
      let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);
      let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.1, 1.0);

      let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
      let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

      // Trigger detection - start multi-clap sequence
      if trig > 0.5 && self.last_trig <= 0.5 {
        self.clap_stage = 0;
        self.stage_counter = 0;
        self.amp_env = 1.0;
        self.latched_accent = accent_in;
      }
      self.last_trig = trig;

      // Multi-clap stages (3 quick hits then decay)
      self.stage_counter += 1;
      if self.clap_stage < 3 && self.stage_counter >= stage_samples {
        self.clap_stage += 1;
        self.stage_counter = 0;
        self.amp_env = 0.8; // Re-trigger envelope
      }

      // Generate filtered noise
      let noise = self.white_noise();

      // Bandpass filter around 1-3 kHz
      let cutoff = 1000.0 + tone * 2000.0;
      let f = (std::f32::consts::PI * cutoff / self.sample_rate).tan();
      let q = 2.0 + tone * 4.0; // Higher Q for more resonant clap
      let k = 1.0 / q;

      self.filter_state[0] += f * (noise - self.filter_state[0] - self.filter_state[1] * k);
      self.filter_state[1] += f * self.filter_state[0];
      let bandpass = self.filter_state[0] * 3.0;

      // Envelope
      let env_decay = if self.clap_stage < 3 { 0.002 } else { 1.0 / (decay * self.sample_rate) };
      self.amp_env = (self.amp_env - env_decay).max(0.0);

      let mut sample = bandpass * self.amp_env * 0.7;

      // Apply accent (latched at trigger)
      sample *= 0.7 + self.latched_accent * 0.5;

      output[i] = sample.clamp(-1.0, 1.0);
    }
  }
}

/// TR-909 Toms (Low/Mid/High)
/// Sine wave with pitch envelope + slight noise
pub struct Tom909 {
  sample_rate: f32,
  phase: f32,
  pitch_env: f32,
  amp_env: f32,
  noise_state: u32,
  last_trig: f32,
  latched_accent: f32,
}

pub struct Tom909Params<'a> {
  pub tune: &'a [f32],      // Base pitch 60-300 Hz
  pub decay: &'a [f32],     // Decay time 0.1-1.5 seconds
}

pub struct Tom909Inputs<'a> {
  pub trigger: Option<&'a [f32]>,
  pub accent: Option<&'a [f32]>,
}

impl Tom909 {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      phase: 0.0,
      pitch_env: 0.0,
      amp_env: 0.0,
      noise_state: 0x87654321,
      last_trig: 0.0,
      latched_accent: 0.5,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  pub fn process_block(
    &mut self,
    output: &mut [f32],
    inputs: Tom909Inputs,
    params: Tom909Params,
  ) {
    let len = output.len();

    for i in 0..len {
      let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(60.0, 300.0);
      let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.1, 1.5);

      let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
      let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

      // Trigger detection
      if trig > 0.5 && self.last_trig <= 0.5 {
        self.pitch_env = 1.0;
        self.amp_env = 1.0;
        self.phase = 0.0;
        self.latched_accent = accent_in;
      }
      self.last_trig = trig;

      // Pitch envelope (subtle drop)
      let pitch_decay = 0.001;
      self.pitch_env *= 1.0 - pitch_decay * (self.sample_rate / 48000.0);

      let freq = tune * (1.0 + self.pitch_env * 1.5);
      let dt = freq / self.sample_rate;
      self.phase += dt;
      if self.phase >= 1.0 {
        self.phase -= 1.0;
      }
      let sine = (self.phase * std::f32::consts::TAU).sin();

      // Slight noise for attack
      self.noise_state ^= self.noise_state << 13;
      self.noise_state ^= self.noise_state >> 17;
      self.noise_state ^= self.noise_state << 5;
      let noise = (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0;
      let noise_env = (self.amp_env * 2.0 - 1.0).max(0.0); // Quick noise burst

      // Amplitude envelope
      let amp_decay_rate = 1.0 / (decay * self.sample_rate);
      self.amp_env = (self.amp_env - amp_decay_rate).max(0.0);

      let mut sample = (sine + noise * noise_env * 0.1) * self.amp_env * 0.8;

      // Apply accent (latched at trigger)
      sample *= 0.7 + self.latched_accent * 0.5;

      output[i] = sample.clamp(-1.0, 1.0);
    }
  }
}

/// TR-909 Rimshot
/// Short metallic ping
pub struct Rimshot909 {
  sample_rate: f32,
  phases: [f32; 2],
  amp_env: f32,
  last_trig: f32,
  latched_accent: f32,
}

pub struct Rimshot909Params<'a> {
  pub tune: &'a [f32],      // Pitch 200-600 Hz
}

pub struct Rimshot909Inputs<'a> {
  pub trigger: Option<&'a [f32]>,
  pub accent: Option<&'a [f32]>,
}

impl Rimshot909 {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      phases: [0.0; 2],
      amp_env: 0.0,
      last_trig: 0.0,
      latched_accent: 0.5,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  pub fn process_block(
    &mut self,
    output: &mut [f32],
    inputs: Rimshot909Inputs,
    params: Rimshot909Params,
  ) {
    let len = output.len();

    for i in 0..len {
      let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(200.0, 600.0);

      let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
      let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

      // Trigger detection
      if trig > 0.5 && self.last_trig <= 0.5 {
        self.amp_env = 1.0;
        self.phases = [0.0; 2];
        self.latched_accent = accent_in;
      }
      self.last_trig = trig;

      // Two detuned triangle waves for metallic character
      let freq1 = tune;
      let freq2 = tune * 1.47; // Inharmonic ratio

      let dt1 = freq1 / self.sample_rate;
      let dt2 = freq2 / self.sample_rate;

      self.phases[0] += dt1;
      self.phases[1] += dt2;
      if self.phases[0] >= 1.0 { self.phases[0] -= 1.0; }
      if self.phases[1] >= 1.0 { self.phases[1] -= 1.0; }

      // Triangle waves
      let tri1 = 4.0 * (self.phases[0] - (self.phases[0] + 0.5).floor()).abs() - 1.0;
      let tri2 = 4.0 * (self.phases[1] - (self.phases[1] + 0.5).floor()).abs() - 1.0;

      // Very fast decay for sharp transient
      let amp_decay_rate = 1.0 / (0.02 * self.sample_rate); // 20ms
      self.amp_env = (self.amp_env - amp_decay_rate).max(0.0);

      let mut sample = (tri1 + tri2 * 0.5) * self.amp_env * 0.6;

      // Apply accent (use latched value from trigger time)
      sample *= 0.7 + self.latched_accent * 0.5;

      output[i] = sample.clamp(-1.0, 1.0);
    }
  }
}

// ============================================================================
// Drum Sequencer - 8-track x 16-step drum pattern sequencer (x0x style)
// ============================================================================

pub const DRUM_TRACKS: usize = 8;
pub const DRUM_STEPS: usize = 16;

/// Single step in a drum track
#[derive(Clone, Copy)]
pub struct DrumStep {
  pub gate: bool,   // Step active
  pub accent: bool, // Accent (high velocity)
}

impl Default for DrumStep {
  fn default() -> Self {
    Self {
      gate: false,
      accent: false,
    }
  }
}

/// Track names for reference
pub const DRUM_TRACK_NAMES: [&str; DRUM_TRACKS] = [
  "kick", "snare", "hhc", "hho", "clap", "tom", "rim", "aux"
];

/// 8-track drum sequencer
pub struct DrumSequencer {
  sample_rate: f32,

  // Pattern data: 8 tracks x 16 steps
  steps: [[DrumStep; DRUM_STEPS]; DRUM_TRACKS],

  // Playback state
  current_step: usize,
  phase: f64,
  samples_per_step: f64,

  // Gate timing (per track)
  gate_on: [bool; DRUM_TRACKS],
  gate_samples: [usize; DRUM_TRACKS],
  gate_length_samples: usize,

  // Swing state
  swing_pending: bool,
  swing_delay_remaining: usize,
  swing_gates: [bool; DRUM_TRACKS],
  swing_accents: [bool; DRUM_TRACKS],

  // Edge detection
  prev_clock: f32,
  prev_reset: f32,

  // Output values (per track)
  current_gates: [f32; DRUM_TRACKS],
  current_accents: [f32; DRUM_TRACKS],
}

pub struct DrumSequencerInputs<'a> {
  pub clock: Option<&'a [Sample]>,
  pub reset: Option<&'a [Sample]>,
}

pub struct DrumSequencerParams<'a> {
  pub enabled: &'a [Sample],
  pub tempo: &'a [Sample],
  pub rate: &'a [Sample],
  pub gate_length: &'a [Sample],
  pub swing: &'a [Sample],
  pub length: &'a [Sample],
}

pub struct DrumSequencerOutputs<'a> {
  // 8 gate outputs
  pub gate_kick: &'a mut [Sample],
  pub gate_snare: &'a mut [Sample],
  pub gate_hhc: &'a mut [Sample],
  pub gate_hho: &'a mut [Sample],
  pub gate_clap: &'a mut [Sample],
  pub gate_tom: &'a mut [Sample],
  pub gate_rim: &'a mut [Sample],
  pub gate_aux: &'a mut [Sample],
  // 8 accent outputs
  pub acc_kick: &'a mut [Sample],
  pub acc_snare: &'a mut [Sample],
  pub acc_hhc: &'a mut [Sample],
  pub acc_hho: &'a mut [Sample],
  pub acc_clap: &'a mut [Sample],
  pub acc_tom: &'a mut [Sample],
  pub acc_rim: &'a mut [Sample],
  pub acc_aux: &'a mut [Sample],
  // Step position output
  pub step_out: &'a mut [Sample],
}

impl DrumSequencer {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      steps: [[DrumStep::default(); DRUM_STEPS]; DRUM_TRACKS],
      current_step: 0,
      phase: 0.0,
      samples_per_step: sample_rate as f64 * 0.125, // Default 1/16 at 120 BPM
      gate_on: [false; DRUM_TRACKS],
      gate_samples: [0; DRUM_TRACKS],
      gate_length_samples: 0,
      swing_pending: false,
      swing_delay_remaining: 0,
      swing_gates: [false; DRUM_TRACKS],
      swing_accents: [false; DRUM_TRACKS],
      prev_clock: 0.0,
      prev_reset: 0.0,
      current_gates: [0.0; DRUM_TRACKS],
      current_accents: [0.0; DRUM_TRACKS],
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  /// Get current step position (0-15)
  pub fn current_step(&self) -> usize {
    self.current_step
  }

  /// Set a single step
  pub fn set_step(&mut self, track: usize, step: usize, gate: bool, accent: bool) {
    if track < DRUM_TRACKS && step < DRUM_STEPS {
      self.steps[track][step] = DrumStep { gate, accent };
    }
  }

  /// Parse JSON drum data string and update all steps
  /// Format: {"tracks":[[{"g":1,"a":0},...],...]]}
  pub fn parse_drum_data(&mut self, json: &str) {
    // Reset all steps first
    for track in 0..DRUM_TRACKS {
      for step in 0..DRUM_STEPS {
        self.steps[track][step] = DrumStep::default();
      }
    }

    // Find "tracks" array
    let tracks_start = json.find("\"tracks\"");
    if tracks_start.is_none() {
      return;
    }

    // Simple state machine parser
    let mut track_idx = 0;
    let mut step_idx = 0;
    let mut in_tracks = false;
    let mut track_depth = 0;
    let mut in_step_object = false;
    let mut current_gate = false;
    let mut current_accent = false;
    let mut key = String::new();
    let mut value = String::new();
    let mut reading_key = false;
    let mut reading_value = false;
    let mut in_string = false;

    for c in json.chars() {
      match c {
        '[' => {
          if !in_tracks {
            in_tracks = true;
          } else {
            track_depth += 1;
            if track_depth == 1 {
              step_idx = 0;
            }
          }
        }
        ']' => {
          if in_tracks && track_depth > 0 {
            track_depth -= 1;
            if track_depth == 0 {
              track_idx += 1;
            }
          } else {
            in_tracks = false;
          }
        }
        '{' => {
          if in_tracks && track_depth == 1 {
            in_step_object = true;
            current_gate = false;
            current_accent = false;
            key.clear();
            value.clear();
            // Reset parsing state for new step object - critical for first track!
            reading_key = false;
            reading_value = false;
          }
        }
        '}' => {
          if in_step_object {
            // Apply last key-value pair
            if !key.is_empty() {
              match key.as_str() {
                "g" => current_gate = value.trim() == "1" || value.trim() == "true",
                "a" => current_accent = value.trim() == "1" || value.trim() == "true",
                _ => {}
              }
            }
            // Save step
            if track_idx < DRUM_TRACKS && step_idx < DRUM_STEPS {
              self.steps[track_idx][step_idx] = DrumStep {
                gate: current_gate,
                accent: current_accent,
              };
              step_idx += 1;
            }
            in_step_object = false;
          }
        }
        '"' => {
          if !in_string {
            in_string = true;
            if !reading_key && !reading_value {
              reading_key = true;
              key.clear();
            }
          } else {
            in_string = false;
            reading_key = false;
          }
        }
        ':' if !in_string => {
          reading_value = true;
          value.clear();
        }
        ',' if !in_string => {
          if in_step_object && reading_value && !key.is_empty() {
            match key.as_str() {
              "g" => current_gate = value.trim() == "1" || value.trim() == "true",
              "a" => current_accent = value.trim() == "1" || value.trim() == "true",
              _ => {}
            }
          }
          reading_value = false;
          key.clear();
          value.clear();
        }
        _ => {
          if in_string && reading_key {
            key.push(c);
          } else if reading_value && !in_string && !c.is_whitespace() {
            value.push(c);
          }
        }
      }
    }
  }

  pub fn process_block(
    &mut self,
    outputs: DrumSequencerOutputs<'_>,
    inputs: DrumSequencerInputs<'_>,
    params: DrumSequencerParams<'_>,
  ) {
    let frames = outputs.step_out.len();
    if frames == 0 {
      return;
    }

    // Read params
    let enabled = sample_at(params.enabled, 0, 1.0) > 0.5;
    let tempo = sample_at(params.tempo, 0, 120.0).clamp(40.0, 300.0);
    let rate_idx = (sample_at(params.rate, 0, 4.0) as usize).min(SEQ_RATE_DIVISIONS.len() - 1);
    let gate_pct = sample_at(params.gate_length, 0, 50.0).clamp(10.0, 100.0) / 100.0;
    let swing = sample_at(params.swing, 0, 0.0).clamp(0.0, 90.0) / 100.0;
    let length = (sample_at(params.length, 0, 16.0) as usize).clamp(4, 16);

    // Calculate timing
    let beats_per_second = tempo as f64 / 60.0;
    let rate_mult = SEQ_RATE_DIVISIONS[rate_idx];
    let step_duration_seconds = rate_mult / beats_per_second;
    let step_duration_samples = step_duration_seconds * self.sample_rate as f64;
    self.samples_per_step = step_duration_samples;

    self.gate_length_samples = (step_duration_samples * gate_pct as f64) as usize;

    // Use external clock if connected
    let use_external_clock = inputs.clock.is_some()
      && inputs.clock.map_or(false, |c| c.iter().any(|&v| v >= 0.0));

    // Output slice references
    let out_gates: [&mut [Sample]; DRUM_TRACKS] = [
      outputs.gate_kick,
      outputs.gate_snare,
      outputs.gate_hhc,
      outputs.gate_hho,
      outputs.gate_clap,
      outputs.gate_tom,
      outputs.gate_rim,
      outputs.gate_aux,
    ];
    let out_accents: [&mut [Sample]; DRUM_TRACKS] = [
      outputs.acc_kick,
      outputs.acc_snare,
      outputs.acc_hhc,
      outputs.acc_hho,
      outputs.acc_clap,
      outputs.acc_tom,
      outputs.acc_rim,
      outputs.acc_aux,
    ];

    for i in 0..frames {
      if !enabled {
        for track in 0..DRUM_TRACKS {
          out_gates[track][i] = 0.0;
          out_accents[track][i] = 0.0;
        }
        outputs.step_out[i] = 0.0;
        continue;
      }

      // Check for reset
      let reset_in = inputs.reset.map_or(0.0, |b| sample_at(b, i, 0.0));
      let reset_trigger = reset_in > 0.5 && self.prev_reset <= 0.5;
      self.prev_reset = reset_in;

      if reset_trigger {
        self.current_step = 0;
        self.phase = 0.0;
        for track in 0..DRUM_TRACKS {
          self.gate_on[track] = false;
          self.current_gates[track] = 0.0;
        }
        self.swing_pending = false;
      }

      // Process pending swing step
      if self.swing_pending {
        if self.swing_delay_remaining > 0 {
          self.swing_delay_remaining -= 1;
        } else {
          // Fire the swung step
          self.swing_pending = false;
          for track in 0..DRUM_TRACKS {
            if self.swing_gates[track] {
              self.gate_on[track] = true;
              self.gate_samples[track] = 0;
              self.current_accents[track] = if self.swing_accents[track] { 1.0 } else { 0.5 };
            }
          }
        }
      }

      // Determine step advance
      let clock_in = inputs.clock.map_or(-1.0, |b| sample_at(b, i, 0.0));
      let clock_trigger = clock_in > 0.5 && self.prev_clock <= 0.5;
      self.prev_clock = clock_in;

      let step_advance = if use_external_clock {
        clock_trigger
      } else {
        self.phase += 1.0 / step_duration_samples;
        if self.phase >= 1.0 {
          self.phase -= 1.0;
          true
        } else {
          false
        }
      };

      if step_advance && !self.swing_pending {
        // Play current step first, then advance
        let play_step = self.current_step % length;

        // Check for swing (apply to odd steps)
        let is_odd_step = play_step % 2 == 1;
        let swing_delay = if is_odd_step && swing > 0.0 {
          let max_swing = 0.45;
          let clamped_swing = (swing as f64).min(max_swing);
          (step_duration_samples * clamped_swing) as usize
        } else {
          0
        };

        // Trigger gates for active steps on all tracks
        let mut any_gate = false;
        for track in 0..DRUM_TRACKS {
          let step = &self.steps[track][play_step];
          if step.gate {
            any_gate = true;
            if swing_delay > 0 {
              self.swing_gates[track] = true;
              self.swing_accents[track] = step.accent;
            } else {
              self.gate_on[track] = true;
              self.gate_samples[track] = 0;
              self.current_accents[track] = if step.accent { 1.0 } else { 0.5 };
            }
          } else {
            self.swing_gates[track] = false;
          }
        }

        if any_gate && swing_delay > 0 {
          self.swing_pending = true;
          self.swing_delay_remaining = swing_delay;
        }

        // Advance to next step after playing
        self.current_step = (self.current_step + 1) % length;
      }

      // Update gate outputs
      for track in 0..DRUM_TRACKS {
        if self.gate_on[track] {
          self.current_gates[track] = 1.0;
          self.gate_samples[track] += 1;
          if self.gate_samples[track] >= self.gate_length_samples {
            self.gate_on[track] = false;
            self.current_gates[track] = 0.0;
            self.current_accents[track] = 0.0; // Reset accent when gate ends
          }
        }
      }

      // Write outputs
      for track in 0..DRUM_TRACKS {
        out_gates[track][i] = self.current_gates[track];
        out_accents[track][i] = self.current_accents[track];
      }
      outputs.step_out[i] = self.current_step as f32;
    }
  }
}

// ============================================================================
// PitchShifter - Granular real-time pitch shifting
// ============================================================================

const PITCH_SHIFTER_MAX_GRAINS: usize = 4;
const PITCH_SHIFTER_BUFFER_MS: f32 = 200.0;

#[derive(Clone, Copy)]
struct PitchGrain {
  active: bool,
  read_pos: f32,      // Current read position in buffer
  age: usize,         // Samples since grain started
  length: usize,      // Total grain length in samples
}

pub struct PitchShifter {
  sample_rate: f32,
  buffer: Vec<Sample>,
  write_index: usize,
  grains: [PitchGrain; PITCH_SHIFTER_MAX_GRAINS],
  next_grain: usize,
  spawn_phase: f32,
}

pub struct PitchShifterInputs<'a> {
  pub input: Option<&'a [Sample]>,
  pub pitch_cv: Option<&'a [Sample]>,
}

pub struct PitchShifterParams<'a> {
  pub pitch: &'a [Sample],      // Semitones: -24 to +24
  pub fine: &'a [Sample],       // Cents: -100 to +100
  pub grain_ms: &'a [Sample],   // Grain size: 10-100ms
  pub mix: &'a [Sample],        // Dry/wet: 0-1
}

impl PitchShifter {
  pub fn new(sample_rate: f32) -> Self {
    let sr = sample_rate.max(1.0);
    let buffer_size = ((PITCH_SHIFTER_BUFFER_MS / 1000.0) * sr).ceil() as usize + 2;
    Self {
      sample_rate: sr,
      buffer: vec![0.0; buffer_size],
      write_index: 0,
      grains: [PitchGrain { active: false, read_pos: 0.0, age: 0, length: 1 }; PITCH_SHIFTER_MAX_GRAINS],
      next_grain: 0,
      spawn_phase: 0.0,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    let sr = sample_rate.max(1.0);
    if (sr - self.sample_rate).abs() > 0.1 {
      self.sample_rate = sr;
      let buffer_size = ((PITCH_SHIFTER_BUFFER_MS / 1000.0) * sr).ceil() as usize + 2;
      self.buffer = vec![0.0; buffer_size];
      self.write_index = 0;
      for grain in &mut self.grains {
        grain.active = false;
      }
    }
  }

  fn read_interpolated(buffer: &[Sample], pos: f32) -> f32 {
    let size = buffer.len() as i32;
    let base = pos.floor();
    let frac = pos - base;
    let mut idx_a = base as i32 % size;
    if idx_a < 0 { idx_a += size; }
    let idx_b = (idx_a + 1) % size;
    let a = buffer[idx_a as usize];
    let b = buffer[idx_b as usize];
    a + (b - a) * frac
  }

  fn hann_window(phase: f32) -> f32 {
    // phase: 0.0 to 1.0
    0.5 * (1.0 - (std::f32::consts::TAU * phase).cos())
  }

  fn spawn_grain(&mut self, grain_length: usize) {
    let grain = &mut self.grains[self.next_grain];
    // Start reading from half a grain back from write position
    let offset = grain_length as f32 * 0.5;
    let mut start_pos = self.write_index as f32 - offset;
    let size = self.buffer.len() as f32;
    while start_pos < 0.0 { start_pos += size; }

    grain.active = true;
    grain.read_pos = start_pos;
    grain.age = 0;
    grain.length = grain_length;

    self.next_grain = (self.next_grain + 1) % PITCH_SHIFTER_MAX_GRAINS;
  }

  pub fn process_block(
    &mut self,
    output: &mut [Sample],
    inputs: PitchShifterInputs<'_>,
    params: PitchShifterParams<'_>,
  ) {
    if output.is_empty() {
      return;
    }

    let buffer_size = self.buffer.len() as f32;

    for i in 0..output.len() {
      // Get input sample
      let input_sample = input_at(inputs.input, i);

      // Write to circular buffer
      self.buffer[self.write_index] = input_sample;
      self.write_index = (self.write_index + 1) % self.buffer.len();

      // Get params
      let pitch_semi = sample_at(params.pitch, i, 0.0).clamp(-24.0, 24.0);
      let fine_cents = sample_at(params.fine, i, 0.0).clamp(-100.0, 100.0);
      let pitch_cv = input_at(inputs.pitch_cv, i) * 12.0; // 1V/oct = 12 semitones

      let total_semitones = pitch_semi + fine_cents / 100.0 + pitch_cv;
      let pitch_ratio = (2.0_f32).powf(total_semitones / 12.0);

      let grain_ms = sample_at(params.grain_ms, i, 50.0).clamp(10.0, 100.0);
      let grain_length = (grain_ms * self.sample_rate / 1000.0).max(1.0) as usize;
      let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);

      // Spawn new grains at regular intervals (every half grain)
      let spawn_interval = grain_length as f32 * 0.5;
      self.spawn_phase += 1.0;
      if self.spawn_phase >= spawn_interval {
        self.spawn_phase -= spawn_interval;
        self.spawn_grain(grain_length);
      }

      // Process all active grains
      let mut wet = 0.0;
      for idx in 0..PITCH_SHIFTER_MAX_GRAINS {
        let grain = &self.grains[idx];
        if !grain.active {
          continue;
        }

        // Calculate window (Hann)
        let phase = grain.age as f32 / grain.length as f32;
        let window = Self::hann_window(phase);

        // Read from buffer with interpolation
        let sample = Self::read_interpolated(&self.buffer, grain.read_pos);
        wet += sample * window;

        // Update grain state
        let grain = &mut self.grains[idx];
        // Advance read position based on pitch ratio
        grain.read_pos += pitch_ratio;
        // Wrap around buffer
        while grain.read_pos >= buffer_size { grain.read_pos -= buffer_size; }
        while grain.read_pos < 0.0 { grain.read_pos += buffer_size; }

        // Advance age
        grain.age += 1;
        if grain.age >= grain.length {
          grain.active = false;
        }
      }

      // Mix dry/wet
      output[i] = input_sample * (1.0 - mix) + wet * mix;
    }
  }
}

// ============================================================================
// MasterClock - Global transport/clock generator for syncing sequencers
// ============================================================================

pub struct MasterClock {
  sample_rate: f32,
  phase: f64,
  samples_per_beat: f64,

  // Clock output state
  clock_on: bool,
  clock_samples: usize,
  clock_pulse_samples: usize,

  // Reset state
  reset_pending: bool,
  reset_on: bool,
  reset_samples: usize,

  // Run state
  was_running: bool,

  // Beat counter for bar output
  beat_count: usize,
  bar_on: bool,
  bar_samples: usize,

  // External trigger edge detection
  prev_start: f32,
  prev_stop: f32,
  prev_reset_in: f32,
}

pub struct MasterClockInputs<'a> {
  pub start: Option<&'a [Sample]>,   // External start trigger
  pub stop: Option<&'a [Sample]>,    // External stop trigger
  pub reset_in: Option<&'a [Sample]>, // External reset trigger
}

pub struct MasterClockParams<'a> {
  pub running: &'a [Sample],  // 0 = stopped, 1 = running
  pub tempo: &'a [Sample],    // BPM 40-300
  pub rate: &'a [Sample],     // Rate division: 0=1/1, 1=1/2, 2=1/4, 3=1/8, 4=1/16, 5=1/32
  pub swing: &'a [Sample],    // Swing 0-90%
}

pub struct MasterClockOutputs<'a> {
  pub clock: &'a mut [Sample],  // Clock pulse output
  pub reset: &'a mut [Sample],  // Reset pulse (on start)
  pub run: &'a mut [Sample],    // Run gate (high when playing)
  pub bar: &'a mut [Sample],    // Bar pulse (every 4 beats)
}

impl MasterClock {
  pub fn new(sample_rate: f32) -> Self {
    let sr = sample_rate.max(1.0);
    let pulse_ms = 10.0; // 10ms pulse width
    Self {
      sample_rate: sr,
      phase: 0.0,
      samples_per_beat: (sr as f64) * 60.0 / 120.0, // 120 BPM default
      clock_on: false,
      clock_samples: 0,
      clock_pulse_samples: ((pulse_ms / 1000.0) * sr) as usize,
      reset_pending: false,
      reset_on: false,
      reset_samples: 0,
      was_running: false,
      beat_count: 0,
      bar_on: false,
      bar_samples: 0,
      prev_start: 0.0,
      prev_stop: 0.0,
      prev_reset_in: 0.0,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    let sr = sample_rate.max(1.0);
    if (sr - self.sample_rate).abs() > 0.1 {
      self.sample_rate = sr;
      let pulse_ms = 10.0;
      self.clock_pulse_samples = ((pulse_ms / 1000.0) * sr) as usize;
    }
  }

  fn rate_divisor(rate: f32) -> f64 {
    // 0=1/1 (whole), 1=1/2 (half), 2=1/4 (quarter), 3=1/8, 4=1/16, 5=1/32
    match rate.round() as i32 {
      0 => 4.0,   // 1/1 = 4 beats
      1 => 2.0,   // 1/2 = 2 beats
      2 => 1.0,   // 1/4 = 1 beat
      3 => 0.5,   // 1/8 = half beat
      4 => 0.25,  // 1/16 = quarter beat
      5 => 0.125, // 1/32 = eighth beat
      _ => 0.25,  // default 1/16
    }
  }

  pub fn process_block(
    &mut self,
    outputs: MasterClockOutputs<'_>,
    inputs: MasterClockInputs<'_>,
    params: MasterClockParams<'_>,
  ) {
    let frames = outputs.clock.len();
    if frames == 0 {
      return;
    }

    for i in 0..frames {
      let running_param = sample_at(params.running, i, 0.0) > 0.5;
      let tempo = sample_at(params.tempo, i, 120.0).clamp(40.0, 300.0);
      let rate = sample_at(params.rate, i, 4.0); // default 1/16
      let swing = sample_at(params.swing, i, 0.0).clamp(0.0, 90.0);

      // Check for external triggers
      let start_in = inputs.start.map_or(0.0, |b| sample_at(b, i, 0.0));
      let stop_in = inputs.stop.map_or(0.0, |b| sample_at(b, i, 0.0));
      let reset_in = inputs.reset_in.map_or(0.0, |b| sample_at(b, i, 0.0));

      let start_trigger = start_in > 0.5 && self.prev_start <= 0.5;
      let stop_trigger = stop_in > 0.5 && self.prev_stop <= 0.5;
      let reset_trigger = reset_in > 0.5 && self.prev_reset_in <= 0.5;

      self.prev_start = start_in;
      self.prev_stop = stop_in;
      self.prev_reset_in = reset_in;

      // Determine running state
      let mut is_running = running_param;
      if start_trigger {
        is_running = true;
      }
      if stop_trigger {
        is_running = false;
      }

      // Handle start (transition from stopped to running)
      if is_running && !self.was_running {
        self.reset_pending = true;
        self.phase = 0.0;
        self.beat_count = 0;
      }

      // Handle external reset
      if reset_trigger && is_running {
        self.reset_pending = true;
        self.phase = 0.0;
        self.beat_count = 0;
      }

      // Fire reset pulse if pending
      if self.reset_pending {
        self.reset_on = true;
        self.reset_samples = 0;
        self.reset_pending = false;
      }

      // Update tempo
      let rate_div = Self::rate_divisor(rate);
      self.samples_per_beat = (self.sample_rate as f64) * 60.0 / (tempo as f64) * rate_div;

      // Process clock if running
      if is_running {
        self.phase += 1.0;

        // Check if we should trigger a clock pulse
        // Apply swing to odd beats (every other clock)
        let is_odd_beat = (self.beat_count % 2) == 1;
        let swing_delay = if is_odd_beat && swing > 0.0 {
          (self.samples_per_beat * (swing as f64) / 100.0 * 0.5) as usize
        } else {
          0
        };

        let trigger_point = self.samples_per_beat + swing_delay as f64;

        if self.phase >= trigger_point {
          self.phase -= self.samples_per_beat; // Keep fractional part
          self.clock_on = true;
          self.clock_samples = 0;
          self.beat_count += 1;

          // Bar pulse every 4 quarter notes
          // Since rate affects clock speed, we need to count actual beats
          // At 1/16, 16 clocks = 4 beats = 1 bar
          let clocks_per_bar = (4.0 / rate_div).round() as usize;
          if self.beat_count % clocks_per_bar.max(1) == 0 {
            self.bar_on = true;
            self.bar_samples = 0;
          }
        }
      } else {
        // When stopped, reset phase so next start is immediate
        self.phase = self.samples_per_beat; // Will trigger on first sample when started
      }

      // Update clock pulse
      let clock_out = if self.clock_on {
        self.clock_samples += 1;
        if self.clock_samples >= self.clock_pulse_samples {
          self.clock_on = false;
        }
        1.0
      } else {
        0.0
      };

      // Update reset pulse
      let reset_out = if self.reset_on {
        self.reset_samples += 1;
        if self.reset_samples >= self.clock_pulse_samples {
          self.reset_on = false;
        }
        1.0
      } else {
        0.0
      };

      // Update bar pulse
      let bar_out = if self.bar_on {
        self.bar_samples += 1;
        if self.bar_samples >= self.clock_pulse_samples {
          self.bar_on = false;
        }
        1.0
      } else {
        0.0
      };

      // Run gate
      let run_out = if is_running { 1.0 } else { 0.0 };

      // Write outputs
      outputs.clock[i] = clock_out;
      outputs.reset[i] = reset_out;
      outputs.run[i] = run_out;
      outputs.bar[i] = bar_out;

      self.was_running = is_running;
    }
  }
}

// ============================================================================
// Karplus-Strong Synthesis (Physical Modeling - Plucked Strings)
// ============================================================================

const KARPLUS_MAX_DELAY: usize = 2048; // Supports down to ~23 Hz at 48kHz

pub struct KarplusStrong {
  sample_rate: f32,
  delay_line: [f32; KARPLUS_MAX_DELAY],
  write_pos: usize,
  delay_length: f32,
  last_output: f32,
  prev_gate: f32,
  noise_state: u32,
  is_active: bool,
  // Fractional delay interpolation
  frac_delay: f32,
}

pub struct KarplusParams<'a> {
  pub frequency: &'a [Sample],
  pub damping: &'a [Sample],    // 0 = bright/long, 1 = dull/short
  pub decay: &'a [Sample],      // 0.9-0.999 feedback
  pub brightness: &'a [Sample], // Initial noise brightness
  pub pluck_pos: &'a [Sample],  // Pluck position (affects harmonics)
}

pub struct KarplusInputs<'a> {
  pub pitch: Option<&'a [Sample]>,
  pub gate: Option<&'a [Sample]>,
}

impl KarplusStrong {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      delay_line: [0.0; KARPLUS_MAX_DELAY],
      write_pos: 0,
      delay_length: 100.0,
      last_output: 0.0,
      prev_gate: 0.0,
      noise_state: 12345,
      is_active: false,
      frac_delay: 0.0,
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  // Simple LCG noise generator
  fn next_noise(&mut self) -> f32 {
    self.noise_state = self.noise_state.wrapping_mul(1103515245).wrapping_add(12345);
    ((self.noise_state >> 16) as f32 / 32768.0) - 1.0
  }

  // Fill delay line with filtered noise (pluck excitation)
  fn pluck(&mut self, delay_samples: usize, brightness: f32, pluck_pos: f32) {
    // Generate noise burst
    let mut noise_buf = [0.0f32; KARPLUS_MAX_DELAY];
    for i in 0..delay_samples {
      noise_buf[i] = self.next_noise();
    }

    // Apply brightness filter (simple lowpass)
    let coeff = (1.0 - brightness).clamp(0.0, 0.99);
    let mut prev = 0.0f32;
    for i in 0..delay_samples {
      noise_buf[i] = noise_buf[i] * (1.0 - coeff) + prev * coeff;
      prev = noise_buf[i];
    }

    // Apply pluck position comb filter (simulates where string is plucked)
    // Pluck at position p creates a notch at frequency f/p
    let pluck_delay = ((pluck_pos.clamp(0.1, 0.9) * delay_samples as f32) as usize).max(1);
    for i in pluck_delay..delay_samples {
      noise_buf[i] -= noise_buf[i - pluck_delay] * 0.5;
    }

    // Copy to delay line
    for i in 0..delay_samples.min(KARPLUS_MAX_DELAY) {
      self.delay_line[i] = noise_buf[i] * 0.8; // Scale to avoid clipping
    }

    // Start writing after the filled portion so we read from position 0
    self.write_pos = delay_samples % KARPLUS_MAX_DELAY;
    self.last_output = 0.0;
    self.is_active = true;
  }

  pub fn process_block(
    &mut self,
    output: &mut [Sample],
    inputs: KarplusInputs,
    params: KarplusParams,
  ) {
    let frames = output.len();

    for i in 0..frames {
      // Get parameters
      let freq_param = params.frequency.get(i).copied().unwrap_or(params.frequency[0]);
      let damping = params.damping.get(i).copied().unwrap_or(params.damping[0]).clamp(0.0, 1.0);
      let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.5, 0.9999);
      let brightness = params.brightness.get(i).copied().unwrap_or(params.brightness[0]).clamp(0.0, 1.0);
      let pluck_pos = params.pluck_pos.get(i).copied().unwrap_or(params.pluck_pos[0]).clamp(0.1, 0.9);

      // Apply pitch CV (1V/octave style, 1 unit = 1 semitone)
      let pitch_cv = inputs.pitch.map(|p| p.get(i).copied().unwrap_or(0.0)).unwrap_or(0.0);
      let freq = freq_param * (2.0_f32).powf(pitch_cv / 12.0);
      let freq_clamped = freq.clamp(20.0, self.sample_rate / 2.0);

      // Calculate delay length in samples
      let delay_samples_f = self.sample_rate / freq_clamped;
      let delay_samples = (delay_samples_f as usize).min(KARPLUS_MAX_DELAY - 1).max(2);
      self.frac_delay = delay_samples_f - delay_samples as f32;

      // Check for gate trigger (rising edge)
      let gate = inputs.gate.map(|g| g.get(i).copied().unwrap_or(0.0)).unwrap_or(0.0);
      if gate > 0.5 && self.prev_gate <= 0.5 {
        self.pluck(delay_samples, brightness, pluck_pos);
      }
      self.prev_gate = gate;

      // Process Karplus-Strong algorithm
      let out = if self.is_active {
        // Read from delay line with linear interpolation
        let read_pos = (self.write_pos + KARPLUS_MAX_DELAY - delay_samples) % KARPLUS_MAX_DELAY;
        let read_pos_next = (read_pos + 1) % KARPLUS_MAX_DELAY;

        let sample_a = self.delay_line[read_pos];
        let sample_b = self.delay_line[read_pos_next];
        let current = sample_a + (sample_b - sample_a) * self.frac_delay;

        // Apply lowpass filter (averaging filter with damping control)
        // Higher damping = more filtering = duller/shorter sound
        let filter_coeff = 0.5 + damping * 0.4; // 0.5 to 0.9
        let filtered = current * (1.0 - filter_coeff) + self.last_output * filter_coeff;

        // Apply decay feedback
        let feedback = filtered * decay;

        // Write back to delay line
        self.delay_line[self.write_pos] = feedback;
        self.write_pos = (self.write_pos + 1) % KARPLUS_MAX_DELAY;

        self.last_output = filtered;

        // Check if sound has decayed
        if filtered.abs() < 0.0001 {
          self.is_active = false;
        }

        filtered
      } else {
        0.0
      };

      output[i] = out;
    }
  }
}

// =============================================================================
// Euclidean Sequencer - Distributes triggers evenly using Bjorklund's algorithm
// =============================================================================

pub const EUCLIDEAN_MAX_STEPS: usize = 32;

pub struct EuclideanSequencer {
  sample_rate: f32,

  // Pattern state (computed from pulses/steps)
  pattern: [bool; EUCLIDEAN_MAX_STEPS],
  pattern_length: usize,

  // Playback state
  current_step: usize,
  phase: f64,
  samples_per_step: f64,

  // Gate timing
  gate_on: bool,
  gate_samples: usize,
  gate_length_samples: usize,

  // Swing state
  swing_pending: bool,
  swing_delay_remaining: usize,

  // Edge detection
  prev_clock: f32,
  prev_reset: f32,

  // Cached params to detect changes
  cached_steps: usize,
  cached_pulses: usize,
  cached_rotation: usize,

  // Output
  current_gate: f32,
}

pub struct EuclideanInputs<'a> {
  pub clock: Option<&'a [Sample]>,
  pub reset: Option<&'a [Sample]>,
}

pub struct EuclideanParams<'a> {
  pub enabled: &'a [Sample],
  pub tempo: &'a [Sample],        // 40-300 BPM
  pub rate: &'a [Sample],         // Rate division index
  pub steps: &'a [Sample],        // 2-32 total steps
  pub pulses: &'a [Sample],       // 1-steps number of triggers
  pub rotation: &'a [Sample],     // 0-steps offset
  pub gate_length: &'a [Sample],  // 10-100%
  pub swing: &'a [Sample],        // 0-90%
}

impl EuclideanSequencer {
  pub fn new(sample_rate: f32) -> Self {
    let mut seq = Self {
      sample_rate: sample_rate.max(1.0),
      pattern: [false; EUCLIDEAN_MAX_STEPS],
      pattern_length: 16,
      current_step: 0,
      phase: 0.0,
      samples_per_step: sample_rate as f64 * 0.5,
      gate_on: false,
      gate_samples: 0,
      gate_length_samples: 0,
      swing_pending: false,
      swing_delay_remaining: 0,
      prev_clock: 0.0,
      prev_reset: 0.0,
      cached_steps: 16,
      cached_pulses: 4,
      cached_rotation: 0,
      current_gate: 0.0,
    };
    seq.compute_pattern(16, 4, 0);
    seq
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

  /// Simple Euclidean rhythm using Bresenham-style distribution
  fn compute_pattern(&mut self, steps: usize, pulses: usize, rotation: usize) {
    let steps = steps.clamp(2, EUCLIDEAN_MAX_STEPS);
    let pulses = pulses.clamp(0, steps);

    // Clear pattern
    for i in 0..EUCLIDEAN_MAX_STEPS {
      self.pattern[i] = false;
    }

    self.pattern_length = steps;

    if pulses == 0 {
      // All off - already cleared
      self.cached_steps = steps;
      self.cached_pulses = pulses;
      self.cached_rotation = rotation;
      return;
    }

    if pulses >= steps {
      // All on
      for i in 0..steps {
        self.pattern[i] = true;
      }
      self.cached_steps = steps;
      self.cached_pulses = pulses;
      self.cached_rotation = rotation;
      return;
    }

    // Bresenham-style Euclidean distribution
    // This distributes pulses as evenly as possible across steps
    let mut bucket: i32 = 0;
    let rot = rotation % steps;

    for i in 0..steps {
      bucket += pulses as i32;
      if bucket >= steps as i32 {
        bucket -= steps as i32;
        // Apply rotation
        let pos = (i + steps - rot) % steps;
        self.pattern[pos] = true;
      }
    }

    self.cached_steps = steps;
    self.cached_pulses = pulses;
    self.cached_rotation = rotation;
  }

  /// Get current pattern for UI display
  pub fn get_pattern(&self) -> &[bool] {
    &self.pattern[..self.pattern_length]
  }

  /// Get current step position
  pub fn current_step(&self) -> usize {
    self.current_step
  }

  pub fn process_block(
    &mut self,
    gate_out: &mut [Sample],
    step_out: &mut [Sample],
    inputs: EuclideanInputs,
    params: EuclideanParams,
  ) {
    let frames = gate_out.len();
    let enabled = params.enabled[0] > 0.5;

    if !enabled {
      for i in 0..frames {
        gate_out[i] = 0.0;
        step_out[i] = self.current_step as f32;
      }
      self.current_gate = 0.0;
      self.gate_on = false;
      return;
    }

    let tempo = params.tempo[0].clamp(40.0, 300.0);
    let rate_idx = params.rate[0] as usize;
    let steps = params.steps[0] as usize;
    let pulses = params.pulses[0] as usize;
    let rotation = params.rotation[0] as usize;
    let gate_len_pct = params.gate_length[0].clamp(10.0, 100.0);
    let swing_pct = params.swing[0].clamp(0.0, 90.0);

    // Recompute pattern if params changed
    if steps != self.cached_steps || pulses != self.cached_pulses || rotation != self.cached_rotation {
      self.compute_pattern(steps, pulses, rotation);
    }

    // Rate divisions
    let rate_mult = match rate_idx {
      0 => 0.25,   // 1/1
      1 => 0.5,    // 1/2
      2 => 0.75,   // 1/2T
      3 => 1.0,    // 1/4
      4 => 1.5,    // 1/4T
      5 => 2.0,    // 1/8
      6 => 3.0,    // 1/8T
      7 => 4.0,    // 1/16
      8 => 6.0,    // 1/16T
      9 => 8.0,    // 1/32
      10 => 12.0,  // 1/32T
      11 => 16.0,  // 1/64
      _ => 4.0,
    };

    let beats_per_second = tempo / 60.0;
    let steps_per_second = beats_per_second * rate_mult;
    self.samples_per_step = self.sample_rate as f64 / steps_per_second as f64;
    self.gate_length_samples = ((self.samples_per_step * (gate_len_pct as f64 / 100.0)) as usize).max(1);

    let has_external_clock = inputs.clock.is_some();

    for i in 0..frames {
      // Handle reset
      if let Some(reset) = inputs.reset {
        let reset_val = reset[i.min(reset.len() - 1)];
        if reset_val > 0.5 && self.prev_reset <= 0.5 {
          self.current_step = 0;
          self.phase = 0.0;
          self.swing_pending = false;
          self.swing_delay_remaining = 0;
        }
        self.prev_reset = reset_val;
      }

      // Handle swing delay
      if self.swing_pending {
        if self.swing_delay_remaining > 0 {
          self.swing_delay_remaining -= 1;
        } else {
          // Execute delayed trigger (we already determined it should trigger)
          self.swing_pending = false;
          self.gate_on = true;
          self.gate_samples = 0;
          self.current_gate = 1.0;
        }
      }

      // Advance step
      let should_advance = if has_external_clock {
        let clock = inputs.clock.unwrap();
        let clock_val = clock[i.min(clock.len() - 1)];
        let rising = clock_val > 0.5 && self.prev_clock <= 0.5;
        self.prev_clock = clock_val;
        rising
      } else {
        self.phase += 1.0;
        if self.phase >= self.samples_per_step {
          self.phase -= self.samples_per_step;
          true
        } else {
          false
        }
      };

      if should_advance && !self.swing_pending {
        // Check CURRENT step for trigger BEFORE advancing
        let trigger_step = self.current_step;
        let should_trigger = trigger_step < self.pattern_length && self.pattern[trigger_step];

        // Now advance to next step
        self.current_step = (self.current_step + 1) % self.pattern_length;

        // Swing on odd steps (of the trigger step)
        let is_odd_step = trigger_step % 2 == 1;
        if is_odd_step && swing_pct > 0.0 && should_trigger {
          let swing_samples = (self.samples_per_step * (swing_pct as f64 / 200.0)) as usize;
          if swing_samples > 0 {
            self.swing_pending = true;
            self.swing_delay_remaining = swing_samples;
          } else {
            // Trigger immediately
            self.gate_on = true;
            self.gate_samples = 0;
            self.current_gate = 1.0;
          }
        } else if should_trigger {
          // Trigger immediately
          self.gate_on = true;
          self.gate_samples = 0;
          self.current_gate = 1.0;
        }
      }

      // Update gate
      if self.gate_on {
        self.gate_samples += 1;
        if self.gate_samples >= self.gate_length_samples {
          self.gate_on = false;
          self.current_gate = 0.0;
        }
      }

      gate_out[i] = self.current_gate;
      step_out[i] = self.current_step as f32;
    }
  }
}

// =============================================================================
// FM Operator - Single operator for FM synthesis (DX7-style)
// =============================================================================

#[derive(Clone, Copy, PartialEq)]
enum FmEnvStage {
  Idle,
  Attack,
  Decay,
  Sustain,
  Release,
}

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

pub struct FmOperatorInputs<'a> {
  pub pitch: Option<&'a [Sample]>,   // Pitch CV (semitones from base)
  pub gate: Option<&'a [Sample]>,    // Gate for envelope
  pub fm_in: Option<&'a [Sample]>,   // FM input (audio rate modulation)
}

pub struct FmOperatorParams<'a> {
  pub frequency: &'a [Sample],  // Base frequency in Hz
  pub ratio: &'a [Sample],      // Frequency ratio (1.0 = unison, 2.0 = octave)
  pub level: &'a [Sample],      // Output level (0-1, also mod index when modulator)
  pub feedback: &'a [Sample],   // Self-feedback amount (0-1)
  pub attack: &'a [Sample],     // Attack time in ms
  pub decay: &'a [Sample],      // Decay time in ms
  pub sustain: &'a [Sample],    // Sustain level (0-1)
  pub release: &'a [Sample],    // Release time in ms
}

impl FmOperator {
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

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.sample_rate = sample_rate.max(1.0);
  }

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
      let level = params.level[0].clamp(0.0, 1.0);
      let feedback = params.feedback[0].clamp(0.0, 1.0);
      let attack_ms = params.attack[0].max(0.1);
      let decay_ms = params.decay[0].max(0.1);
      let sustain = params.sustain[0].clamp(0.0, 1.0);
      let release_ms = params.release[0].max(0.1);

      // Get pitch CV (semitones offset)
      let pitch_cv = inputs.pitch.map_or(0.0, |p| p[i.min(p.len() - 1)]);

      // Calculate frequency: base * ratio * 2^(pitch/12)
      let freq = base_freq * ratio * (2.0_f32).powf(pitch_cv / 12.0);

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

  #[test]
  fn sine_osc_produces_samples() {
    let mut osc = SineOsc::new(220.0);
    osc.reset(48_000.0);
    let mut buffer = [0.0_f32; 64];
    osc.process(&mut buffer);
    assert!(buffer.iter().any(|sample| sample.abs() > 0.0));
  }

  #[test]
  fn vco_produces_samples() {
    let mut vco = Vco::new(48_000.0);
    let mut output = [0.0_f32; 64];
    let mut sub_output = [0.0_f32; 64];
    let params = VcoParams {
      base_freq: &[220.0],
      waveform: &[0.0],
      pwm: &[0.5],
      fm_lin_depth: &[0.0],
      fm_exp_depth: &[0.0],
      unison: &[1.0],
      detune: &[0.0],
      sub_mix: &[0.0],
      sub_oct: &[1.0],
    };
    let inputs = VcoInputs {
      pitch: None,
      fm_lin: None,
      fm_audio: None,
      fm_exp: None,
      pwm: None,
      sync: None,
    };
    let mut sync_output = [0.0_f32; 64];
    vco.process_block(&mut output, Some(&mut sub_output), Some(&mut sync_output), inputs, params);
    assert!(output.iter().any(|sample| sample.abs() > 0.0));
  }

  #[test]
  fn vca_applies_gain_and_cv() {
    let mut output = [0.0_f32; 4];
    let input = [0.5_f32, -0.5, 1.0, -1.0];
    let cv = [0.5_f32, 2.0, -1.0, 1.0];
    let gain = [0.8_f32];
    Vca::process_block(&mut output, Some(&input), Some(&cv), &gain);
    assert!((output[0] - 0.2).abs() < 0.001);
    assert!((output[1] + 0.8).abs() < 0.001);
    assert!((output[2] - 0.0).abs() < 0.001);
    assert!((output[3] + 0.8).abs() < 0.001);
  }

  #[test]
  fn noise_outputs_signal() {
    let mut noise = Noise::new();
    let mut output = [0.0_f32; 64];
    let params = NoiseParams {
      level: &[0.6],
      noise_type: &[0.0],
    };
    noise.process_block(&mut output, params);
    assert!(output.iter().any(|sample| sample.abs() > 0.0));
  }

  #[test]
  fn ring_mod_multiplies_inputs() {
    let mut output = [0.0_f32; 4];
    let a = [0.5_f32, -0.5, 0.25, -0.25];
    let b = [0.5_f32, 0.5, -0.5, -0.5];
    let params = RingModParams { level: &[1.0] };
    RingMod::process_block(&mut output, Some(&a), Some(&b), params);
    assert!((output[0] - 0.25).abs() < 0.001);
    assert!((output[1] + 0.25).abs() < 0.001);
    assert!((output[2] + 0.125).abs() < 0.001);
    assert!((output[3] - 0.125).abs() < 0.001);
  }

  #[test]
  fn mixer_combines_inputs() {
    let mut output = [0.0_f32; 4];
    let input_a = [0.4_f32, 0.2, -0.2, -0.4];
    let input_b = [0.1_f32, -0.1, 0.3, -0.3];
    let level_a = [1.0_f32];
    let level_b = [0.5_f32];
    Mixer::process_block(&mut output, Some(&input_a), Some(&input_b), &level_a, &level_b);
    assert!((output[0] - 0.225).abs() < 0.001);
    assert!((output[1] - 0.025).abs() < 0.001);
    assert!((output[2] - 0.025).abs() < 0.001);
    assert!((output[3] + 0.275).abs() < 0.001);
  }

  #[test]
  fn delay_outputs_signal() {
    let mut delay = Delay::new(48_000.0);
    let mut out_l = [0.0_f32; 64];
    let mut out_r = [0.0_f32; 64];
    let input = [0.2_f32; 64];
    let params = DelayParams {
      time_ms: &[120.0],
      feedback: &[0.2],
      mix: &[0.3],
      tone: &[0.6],
      ping_pong: &[0.0],
    };
    let inputs = DelayInputs {
      input_l: Some(&input),
      input_r: None,
    };
    delay.process_block(&mut out_l, &mut out_r, inputs, params);
    assert!(out_l.iter().all(|sample| sample.is_finite()));
    assert!(out_r.iter().all(|sample| sample.is_finite()));
  }

  #[test]
  fn chorus_outputs_signal() {
    let mut chorus = Chorus::new(48_000.0);
    let mut out_l = [0.0_f32; 64];
    let mut out_r = [0.0_f32; 64];
    let input = [0.2_f32; 64];
    let params = ChorusParams {
      rate: &[0.3],
      depth_ms: &[8.0],
      delay_ms: &[18.0],
      mix: &[0.4],
      feedback: &[0.1],
      spread: &[0.6],
    };
    let inputs = ChorusInputs {
      input_l: Some(&input),
      input_r: None,
    };
    chorus.process_block(&mut out_l, &mut out_r, inputs, params);
    assert!(out_l.iter().all(|sample| sample.is_finite()));
    assert!(out_r.iter().all(|sample| sample.is_finite()));
  }

  #[test]
  fn reverb_outputs_signal() {
    let mut reverb = Reverb::new(48_000.0);
    let mut out_l = [0.0_f32; 64];
    let mut out_r = [0.0_f32; 64];
    let input = [0.2_f32; 64];
    let params = ReverbParams {
      time: &[0.62],
      damp: &[0.4],
      pre_delay: &[18.0],
      mix: &[0.3],
    };
    let inputs = ReverbInputs {
      input_l: Some(&input),
      input_r: None,
    };
    reverb.process_block(&mut out_l, &mut out_r, inputs, params);
    assert!(out_l.iter().all(|sample| sample.is_finite()));
    assert!(out_r.iter().all(|sample| sample.is_finite()));
  }

  #[test]
  fn lfo_outputs_signal() {
    let mut lfo = Lfo::new(48_000.0);
    let mut output = [0.0_f32; 64];
    let params = LfoParams {
      rate: &[2.0],
      shape: &[0.0],
      depth: &[1.0],
      offset: &[0.0],
      bipolar: &[1.0],
    };
    let inputs = LfoInputs {
      rate_cv: None,
      sync: None,
    };
    lfo.process_block(&mut output, inputs, params);
    assert!(output.iter().any(|sample| sample.abs() > 0.0));
  }

  #[test]
  fn adsr_rises_on_gate() {
    let mut adsr = Adsr::new(48_000.0);
    let mut output = [0.0_f32; 64];
    let gate = [1.0_f32; 64];
    let params = AdsrParams {
      attack: &[0.01],
      decay: &[0.1],
      sustain: &[0.7],
      release: &[0.2],
    };
    let inputs = AdsrInputs { gate: Some(&gate) };
    adsr.process_block(&mut output, inputs, params);
    assert!(output.iter().any(|sample| sample.abs() > 0.0));
  }

  #[test]
  fn vcf_filters_signal() {
    let mut vcf = Vcf::new(48_000.0);
    let mut output = [0.0_f32; 64];
    let input = [0.2_f32; 64];
    let params = VcfParams {
      cutoff: &[800.0],
      resonance: &[0.2],
      drive: &[0.1],
      env_amount: &[0.0],
      mod_amount: &[0.0],
      key_track: &[0.0],
      mode: &[0.0],
      slope: &[1.0],
    };
    let inputs = VcfInputs {
      audio: Some(&input),
      mod_in: None,
      env: None,
      key: None,
    };
    vcf.process_block(&mut output, inputs, params);
    assert!(output.iter().any(|sample| sample.is_finite()));
  }
}
