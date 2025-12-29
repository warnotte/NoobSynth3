pub type Sample = f32;

#[derive(Debug, Clone, Copy)]
pub struct ProcessContext {
  pub sample_rate: f32,
  pub block_size: usize,
}

impl ProcessContext {
  pub fn new(sample_rate: f32, block_size: usize) -> Self {
    Self {
      sample_rate,
      block_size,
    }
  }
}

pub trait Node {
  fn reset(&mut self, sample_rate: f32);
  fn process(&mut self, output: &mut [Sample]);
}

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
  pub fm_exp: Option<&'a [Sample]>,
  pub pwm: Option<&'a [Sample]>,
  pub sync: Option<&'a [Sample]>,
}

fn poly_blep(phase: f32, dt: f32) -> f32 {
  if dt <= 0.0 {
    return 0.0;
  }
  if phase < dt {
    let x = phase / dt;
    return x + x - x * x - 1.0;
  }
  if phase > 1.0 - dt {
    let x = (phase - 1.0) / dt;
    return x * x + x + 1.0;
  }
  0.0
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
    for i in 0..output.len() {
      let base = sample_at(params.base_freq, i, 220.0);
      let pitch = input_at(inputs.pitch, i);
      let fm_lin = input_at(inputs.fm_lin, i);
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

      for v in 0..self.voice_count {
        let offset = self.voice_offsets[v];
        let detune_factor = 2.0_f32.powf((detune_cents * offset) / 1200.0);
        let voice_freq = frequency * detune_factor;
        let dt = (voice_freq / self.sample_rate).min(1.0);

        self.phases[v] += voice_freq / self.sample_rate;
        if self.phases[v] >= 1.0 {
          self.phases[v] -= self.phases[v].floor();
        }
        let phase = self.phases[v];

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

pub struct Vcf {
  sample_rate: f32,
  stage_a: SvfState,
  stage_b: SvfState,
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
  pub mode: &'a [Sample],
  pub slope: &'a [Sample],
}

impl Vcf {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate: sample_rate.max(1.0),
      stage_a: SvfState { ic1: 0.0, ic2: 0.0 },
      stage_b: SvfState { ic1: 0.0, ic2: 0.0 },
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
    let resonance_scaled = resonance * if slope24 { 0.45 } else { 1.0 };
    let q = 0.7 + resonance_scaled * if slope24 { 4.5 } else { 8.0 };
    let k = 1.0 / q;

    let drive_gain = 1.0 + drive * if slope24 { 1.2 } else { 2.6 };
    let shaped_input = saturate(input * drive_gain);

    let stage1 = Self::process_svf_stage(shaped_input, g, k, &mut self.stage_a);
    if slope24 {
      let stage1_out = saturate(stage1.0 * (1.0 + drive * 0.25));
      let stage2 = Self::process_svf_stage(stage1_out, g, k, &mut self.stage_b);
      let out = Self::select_mode(stage2, mode);
      let res_comp = 1.0 / (1.0 + resonance_scaled * 1.2);
      return saturate(out * 0.55 * res_comp);
    }
    let out = Self::select_mode(stage1, mode);
    let res_comp = 1.0 / (1.0 + resonance_scaled * 0.6);
    saturate(out * 0.85 * res_comp)
  }

  pub fn process_block(&mut self, output: &mut [Sample], inputs: VcfInputs<'_>, params: VcfParams<'_>) {
    if output.is_empty() {
      return;
    }

    let mode = params.mode.get(0).copied().unwrap_or(0.0);
    let slope = params.slope.get(0).copied().unwrap_or(1.0);
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

      output[i] = self.process_svf(input_sample, cutoff_hz, resonance, mode, slope, drive);
    }
  }
}

fn clamp(value: f32, min: f32, max: f32) -> f32 {
  if value < min {
    min
  } else if value > max {
    max
  } else {
    value
  }
}

fn sample_at(values: &[Sample], index: usize, fallback: Sample) -> Sample {
  if values.is_empty() {
    return fallback;
  }
  if values.len() > 1 {
    return values[index];
  }
  values[0]
}

fn input_at(values: Option<&[Sample]>, index: usize) -> Sample {
  match values {
    Some(values) if !values.is_empty() => {
      if values.len() > 1 {
        values[index]
      } else {
        values[0]
      }
    }
    _ => 0.0,
  }
}

fn saturate(value: f32) -> f32 {
  value.tanh()
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
      fm_exp: None,
      pwm: None,
      sync: None,
    };
    vco.process_block(&mut output, Some(&mut sub_output), inputs, params);
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
