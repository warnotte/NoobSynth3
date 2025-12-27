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
}

pub struct VcoInputs<'a> {
  pub pitch: Option<&'a [Sample]>,
  pub fm_lin: Option<&'a [Sample]>,
  pub fm_exp: Option<&'a [Sample]>,
  pub pwm: Option<&'a [Sample]>,
  pub sync: Option<&'a [Sample]>,
}

impl Vco {
  pub fn new(sample_rate: f32) -> Self {
    let mut phases = [0.0; 4];
    let len = phases.len() as f32;
    for (index, phase) in phases.iter_mut().enumerate() {
      *phase = index as f32 / len;
    }
    let mut vco = Self {
      sample_rate: sample_rate.max(1.0),
      last_sync: 0.0,
      pwm_smooth: 0.5,
      phases,
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

      if sync > 0.5 && self.last_sync <= 0.5 {
        for phase in self.phases.iter_mut().take(self.voice_count) {
          *phase = 0.0;
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

      let mut sample = 0.0;
      for v in 0..self.voice_count {
        let offset = self.voice_offsets[v];
        let detune_factor = 2.0_f32.powf((detune_cents * offset) / 1200.0);
        let voice_freq = frequency * detune_factor;
        self.phases[v] += voice_freq / self.sample_rate;
        if self.phases[v] >= 1.0 {
          self.phases[v] -= self.phases[v].floor();
        }
        let phase = self.phases[v];
        let voice_sample = if wave_index < 0.5 {
          (std::f32::consts::TAU * phase).sin()
        } else if wave_index < 1.5 {
          2.0 * (2.0 * (phase - (phase + 0.5).floor())).abs() - 1.0
        } else if wave_index < 2.5 {
          2.0 * (phase - 0.5)
        } else if phase < self.pwm_smooth {
          1.0
        } else {
          -1.0
        };
        sample += voice_sample;
      }
      sample /= self.voice_count as f32;
      output[i] = sample;
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
    let params = VcoParams {
      base_freq: &[220.0],
      waveform: &[0.0],
      pwm: &[0.5],
      fm_lin_depth: &[0.0],
      fm_exp_depth: &[0.0],
      unison: &[1.0],
      detune: &[0.0],
    };
    let inputs = VcoInputs {
      pitch: None,
      fm_lin: None,
      fm_exp: None,
      pwm: None,
      sync: None,
    };
    vco.process_block(&mut output, inputs, params);
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
}
