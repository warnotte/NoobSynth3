use dsp_core::{
  Adsr, AdsrInputs, AdsrParams, Chorus, ChorusInputs, ChorusParams, Delay, DelayInputs, DelayParams,
  Lfo, LfoInputs, LfoParams, Mixer, Node, Reverb, ReverbInputs, ReverbParams, Sample, SineOsc,
  Vca, Vcf, VcfInputs, VcfParams, Vco, VcoInputs, VcoParams,
};
use js_sys::Float32Array;
use wasm_bindgen::prelude::*;
mod graph;

#[wasm_bindgen]
pub struct WasmOsc {
  osc: SineOsc,
  buffer: Vec<Sample>,
}

#[wasm_bindgen]
impl WasmOsc {
  #[wasm_bindgen(constructor)]
  pub fn new(sample_rate: f32) -> WasmOsc {
    let mut osc = SineOsc::new(220.0);
    osc.reset(sample_rate);
    WasmOsc {
      osc,
      buffer: Vec::new(),
    }
  }

  pub fn reset(&mut self, sample_rate: f32) {
    self.osc.reset(sample_rate);
  }

  pub fn set_frequency(&mut self, freq_hz: f32) {
    self.osc.set_frequency(freq_hz);
  }

  pub fn render(&mut self, frames: usize) -> Float32Array {
    if self.buffer.len() != frames {
      self.buffer.resize(frames, 0.0);
    }
    self.osc.process(&mut self.buffer);
    Float32Array::from(self.buffer.as_slice())
  }
}

#[wasm_bindgen]
pub struct WasmVco {
  vco: Vco,
  buffer: Vec<Sample>,
}

#[wasm_bindgen]
impl WasmVco {
  #[wasm_bindgen(constructor)]
  pub fn new(sample_rate: f32) -> WasmVco {
    WasmVco {
      vco: Vco::new(sample_rate),
      buffer: Vec::new(),
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.vco.set_sample_rate(sample_rate);
  }

  #[allow(clippy::too_many_arguments)]
  pub fn render(
    &mut self,
    pitch: Float32Array,
    fm_lin: Float32Array,
    fm_exp: Float32Array,
    pwm_in: Float32Array,
    sync: Float32Array,
    base_freq: Float32Array,
    waveform: Float32Array,
    pwm: Float32Array,
    fm_lin_depth: Float32Array,
    fm_exp_depth: Float32Array,
    unison: Float32Array,
    detune: Float32Array,
    frames: usize,
  ) -> Float32Array {
    if self.buffer.len() != frames {
      self.buffer.resize(frames, 0.0);
    }

    let pitch_vec = pitch.to_vec();
    let fm_lin_vec = fm_lin.to_vec();
    let fm_exp_vec = fm_exp.to_vec();
    let pwm_in_vec = pwm_in.to_vec();
    let sync_vec = sync.to_vec();
    let base_vec = base_freq.to_vec();
    let waveform_vec = waveform.to_vec();
    let pwm_vec = pwm.to_vec();
    let fm_lin_depth_vec = fm_lin_depth.to_vec();
    let fm_exp_depth_vec = fm_exp_depth.to_vec();
    let unison_vec = unison.to_vec();
    let detune_vec = detune.to_vec();

    let inputs = VcoInputs {
      pitch: if pitch_vec.is_empty() { None } else { Some(pitch_vec.as_slice()) },
      fm_lin: if fm_lin_vec.is_empty() { None } else { Some(fm_lin_vec.as_slice()) },
      fm_exp: if fm_exp_vec.is_empty() { None } else { Some(fm_exp_vec.as_slice()) },
      pwm: if pwm_in_vec.is_empty() { None } else { Some(pwm_in_vec.as_slice()) },
      sync: if sync_vec.is_empty() { None } else { Some(sync_vec.as_slice()) },
    };

    let params = VcoParams {
      base_freq: &base_vec,
      waveform: &waveform_vec,
      pwm: &pwm_vec,
      fm_lin_depth: &fm_lin_depth_vec,
      fm_exp_depth: &fm_exp_depth_vec,
      unison: &unison_vec,
      detune: &detune_vec,
    };

    self.vco.process_block(&mut self.buffer, inputs, params);
    Float32Array::from(self.buffer.as_slice())
  }
}

#[wasm_bindgen]
pub struct WasmGain {
  buffer: Vec<Sample>,
}

#[wasm_bindgen]
impl WasmGain {
  #[wasm_bindgen(constructor)]
  pub fn new(_sample_rate: f32) -> WasmGain {
    WasmGain { buffer: Vec::new() }
  }

  pub fn render(
    &mut self,
    input: Float32Array,
    cv: Float32Array,
    gain: Float32Array,
    frames: usize,
  ) -> Float32Array {
    if self.buffer.len() != frames {
      self.buffer.resize(frames, 0.0);
    }

    let input_vec = input.to_vec();
    let cv_vec = cv.to_vec();
    let gain_vec = gain.to_vec();

    let input_ref = if input_vec.is_empty() {
      None
    } else {
      Some(input_vec.as_slice())
    };
    let cv_ref = if cv_vec.is_empty() { None } else { Some(cv_vec.as_slice()) };

    Vca::process_block(&mut self.buffer, input_ref, cv_ref, &gain_vec);
    Float32Array::from(self.buffer.as_slice())
  }
}

#[wasm_bindgen]
pub struct WasmLfo {
  lfo: Lfo,
  buffer: Vec<Sample>,
}

#[wasm_bindgen]
impl WasmLfo {
  #[wasm_bindgen(constructor)]
  pub fn new(sample_rate: f32) -> WasmLfo {
    WasmLfo {
      lfo: Lfo::new(sample_rate),
      buffer: Vec::new(),
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.lfo.set_sample_rate(sample_rate);
  }

  pub fn render(
    &mut self,
    rate_cv: Float32Array,
    sync: Float32Array,
    rate: Float32Array,
    shape: Float32Array,
    depth: Float32Array,
    offset: Float32Array,
    bipolar: Float32Array,
    frames: usize,
  ) -> Float32Array {
    if self.buffer.len() != frames {
      self.buffer.resize(frames, 0.0);
    }

    let rate_cv_vec = rate_cv.to_vec();
    let sync_vec = sync.to_vec();
    let rate_vec = rate.to_vec();
    let shape_vec = shape.to_vec();
    let depth_vec = depth.to_vec();
    let offset_vec = offset.to_vec();
    let bipolar_vec = bipolar.to_vec();

    let inputs = LfoInputs {
      rate_cv: if rate_cv_vec.is_empty() {
        None
      } else {
        Some(rate_cv_vec.as_slice())
      },
      sync: if sync_vec.is_empty() { None } else { Some(sync_vec.as_slice()) },
    };

    let params = LfoParams {
      rate: &rate_vec,
      shape: &shape_vec,
      depth: &depth_vec,
      offset: &offset_vec,
      bipolar: &bipolar_vec,
    };

    self.lfo.process_block(&mut self.buffer, inputs, params);
    Float32Array::from(self.buffer.as_slice())
  }
}

#[wasm_bindgen]
pub struct WasmAdsr {
  adsr: Adsr,
  buffer: Vec<Sample>,
}

#[wasm_bindgen]
impl WasmAdsr {
  #[wasm_bindgen(constructor)]
  pub fn new(sample_rate: f32) -> WasmAdsr {
    WasmAdsr {
      adsr: Adsr::new(sample_rate),
      buffer: Vec::new(),
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.adsr.set_sample_rate(sample_rate);
  }

  pub fn render(
    &mut self,
    gate: Float32Array,
    attack: Float32Array,
    decay: Float32Array,
    sustain: Float32Array,
    release: Float32Array,
    frames: usize,
  ) -> Float32Array {
    if self.buffer.len() != frames {
      self.buffer.resize(frames, 0.0);
    }

    let gate_vec = gate.to_vec();
    let attack_vec = attack.to_vec();
    let decay_vec = decay.to_vec();
    let sustain_vec = sustain.to_vec();
    let release_vec = release.to_vec();

    let inputs = AdsrInputs {
      gate: if gate_vec.is_empty() { None } else { Some(gate_vec.as_slice()) },
    };

    let params = AdsrParams {
      attack: &attack_vec,
      decay: &decay_vec,
      sustain: &sustain_vec,
      release: &release_vec,
    };

    self.adsr.process_block(&mut self.buffer, inputs, params);
    Float32Array::from(self.buffer.as_slice())
  }
}

#[wasm_bindgen]
pub struct WasmVcf {
  vcf: Vcf,
  buffer: Vec<Sample>,
}

#[wasm_bindgen]
impl WasmVcf {
  #[wasm_bindgen(constructor)]
  pub fn new(sample_rate: f32) -> WasmVcf {
    WasmVcf {
      vcf: Vcf::new(sample_rate),
      buffer: Vec::new(),
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.vcf.set_sample_rate(sample_rate);
  }

  #[allow(clippy::too_many_arguments)]
  pub fn render(
    &mut self,
    audio: Float32Array,
    mod_in: Float32Array,
    env: Float32Array,
    key: Float32Array,
    cutoff: Float32Array,
    resonance: Float32Array,
    drive: Float32Array,
    env_amount: Float32Array,
    mod_amount: Float32Array,
    key_track: Float32Array,
    mode: Float32Array,
    slope: Float32Array,
    frames: usize,
  ) -> Float32Array {
    if self.buffer.len() != frames {
      self.buffer.resize(frames, 0.0);
    }

    let audio_vec = audio.to_vec();
    let mod_vec = mod_in.to_vec();
    let env_vec = env.to_vec();
    let key_vec = key.to_vec();
    let cutoff_vec = cutoff.to_vec();
    let resonance_vec = resonance.to_vec();
    let drive_vec = drive.to_vec();
    let env_amount_vec = env_amount.to_vec();
    let mod_amount_vec = mod_amount.to_vec();
    let key_track_vec = key_track.to_vec();
    let mode_vec = mode.to_vec();
    let slope_vec = slope.to_vec();

    let inputs = VcfInputs {
      audio: if audio_vec.is_empty() { None } else { Some(audio_vec.as_slice()) },
      mod_in: if mod_vec.is_empty() { None } else { Some(mod_vec.as_slice()) },
      env: if env_vec.is_empty() { None } else { Some(env_vec.as_slice()) },
      key: if key_vec.is_empty() { None } else { Some(key_vec.as_slice()) },
    };

    let params = VcfParams {
      cutoff: &cutoff_vec,
      resonance: &resonance_vec,
      drive: &drive_vec,
      env_amount: &env_amount_vec,
      mod_amount: &mod_amount_vec,
      key_track: &key_track_vec,
      mode: &mode_vec,
      slope: &slope_vec,
    };

    self.vcf.process_block(&mut self.buffer, inputs, params);
    Float32Array::from(self.buffer.as_slice())
  }
}

#[wasm_bindgen]
pub struct WasmMixer {
  buffer: Vec<Sample>,
}

#[wasm_bindgen]
impl WasmMixer {
  #[wasm_bindgen(constructor)]
  pub fn new(_sample_rate: f32) -> WasmMixer {
    WasmMixer { buffer: Vec::new() }
  }

  pub fn render(
    &mut self,
    input_a: Float32Array,
    input_b: Float32Array,
    level_a: Float32Array,
    level_b: Float32Array,
    frames: usize,
  ) -> Float32Array {
    if self.buffer.len() != frames {
      self.buffer.resize(frames, 0.0);
    }

    let input_a_vec = input_a.to_vec();
    let input_b_vec = input_b.to_vec();
    let level_a_vec = level_a.to_vec();
    let level_b_vec = level_b.to_vec();

    let input_a_ref = if input_a_vec.is_empty() {
      None
    } else {
      Some(input_a_vec.as_slice())
    };
    let input_b_ref = if input_b_vec.is_empty() {
      None
    } else {
      Some(input_b_vec.as_slice())
    };

    Mixer::process_block(&mut self.buffer, input_a_ref, input_b_ref, &level_a_vec, &level_b_vec);
    Float32Array::from(self.buffer.as_slice())
  }
}

#[wasm_bindgen]
pub struct WasmDelay {
  delay: Delay,
  buffer: Vec<Sample>,
  temp_l: Vec<Sample>,
  temp_r: Vec<Sample>,
}

#[wasm_bindgen]
impl WasmDelay {
  #[wasm_bindgen(constructor)]
  pub fn new(sample_rate: f32) -> WasmDelay {
    WasmDelay {
      delay: Delay::new(sample_rate),
      buffer: Vec::new(),
      temp_l: Vec::new(),
      temp_r: Vec::new(),
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.delay.set_sample_rate(sample_rate);
  }

  #[allow(clippy::too_many_arguments)]
  pub fn render(
    &mut self,
    input_l: Float32Array,
    input_r: Float32Array,
    time_ms: Float32Array,
    feedback: Float32Array,
    mix: Float32Array,
    tone: Float32Array,
    ping_pong: Float32Array,
    frames: usize,
  ) -> Float32Array {
    if self.temp_l.len() != frames {
      self.temp_l.resize(frames, 0.0);
      self.temp_r.resize(frames, 0.0);
    }
    if self.buffer.len() != frames * 2 {
      self.buffer.resize(frames * 2, 0.0);
    }

    let input_l_vec = input_l.to_vec();
    let input_r_vec = input_r.to_vec();
    let time_vec = time_ms.to_vec();
    let feedback_vec = feedback.to_vec();
    let mix_vec = mix.to_vec();
    let tone_vec = tone.to_vec();
    let ping_vec = ping_pong.to_vec();

    let inputs = DelayInputs {
      input_l: if input_l_vec.is_empty() {
        None
      } else {
        Some(input_l_vec.as_slice())
      },
      input_r: if input_r_vec.is_empty() {
        None
      } else {
        Some(input_r_vec.as_slice())
      },
    };

    let params = DelayParams {
      time_ms: &time_vec,
      feedback: &feedback_vec,
      mix: &mix_vec,
      tone: &tone_vec,
      ping_pong: &ping_vec,
    };

    self.delay
      .process_block(&mut self.temp_l, &mut self.temp_r, inputs, params);

    for i in 0..frames {
      let idx = i * 2;
      self.buffer[idx] = self.temp_l[i];
      self.buffer[idx + 1] = self.temp_r[i];
    }

    Float32Array::from(self.buffer.as_slice())
  }
}

#[wasm_bindgen]
pub struct WasmChorus {
  chorus: Chorus,
  buffer: Vec<Sample>,
  temp_l: Vec<Sample>,
  temp_r: Vec<Sample>,
}

#[wasm_bindgen]
impl WasmChorus {
  #[wasm_bindgen(constructor)]
  pub fn new(sample_rate: f32) -> WasmChorus {
    WasmChorus {
      chorus: Chorus::new(sample_rate),
      buffer: Vec::new(),
      temp_l: Vec::new(),
      temp_r: Vec::new(),
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.chorus.set_sample_rate(sample_rate);
  }

  #[allow(clippy::too_many_arguments)]
  pub fn render(
    &mut self,
    input_l: Float32Array,
    input_r: Float32Array,
    rate: Float32Array,
    depth_ms: Float32Array,
    delay_ms: Float32Array,
    mix: Float32Array,
    feedback: Float32Array,
    spread: Float32Array,
    frames: usize,
  ) -> Float32Array {
    if self.temp_l.len() != frames {
      self.temp_l.resize(frames, 0.0);
      self.temp_r.resize(frames, 0.0);
    }
    if self.buffer.len() != frames * 2 {
      self.buffer.resize(frames * 2, 0.0);
    }

    let input_l_vec = input_l.to_vec();
    let input_r_vec = input_r.to_vec();
    let rate_vec = rate.to_vec();
    let depth_vec = depth_ms.to_vec();
    let delay_vec = delay_ms.to_vec();
    let mix_vec = mix.to_vec();
    let feedback_vec = feedback.to_vec();
    let spread_vec = spread.to_vec();

    let inputs = ChorusInputs {
      input_l: if input_l_vec.is_empty() {
        None
      } else {
        Some(input_l_vec.as_slice())
      },
      input_r: if input_r_vec.is_empty() {
        None
      } else {
        Some(input_r_vec.as_slice())
      },
    };

    let params = ChorusParams {
      rate: &rate_vec,
      depth_ms: &depth_vec,
      delay_ms: &delay_vec,
      mix: &mix_vec,
      feedback: &feedback_vec,
      spread: &spread_vec,
    };

    self.chorus
      .process_block(&mut self.temp_l, &mut self.temp_r, inputs, params);

    for i in 0..frames {
      let idx = i * 2;
      self.buffer[idx] = self.temp_l[i];
      self.buffer[idx + 1] = self.temp_r[i];
    }

    Float32Array::from(self.buffer.as_slice())
  }
}

#[wasm_bindgen]
pub struct WasmReverb {
  reverb: Reverb,
  buffer: Vec<Sample>,
  temp_l: Vec<Sample>,
  temp_r: Vec<Sample>,
}

#[wasm_bindgen]
impl WasmReverb {
  #[wasm_bindgen(constructor)]
  pub fn new(sample_rate: f32) -> WasmReverb {
    WasmReverb {
      reverb: Reverb::new(sample_rate),
      buffer: Vec::new(),
      temp_l: Vec::new(),
      temp_r: Vec::new(),
    }
  }

  pub fn set_sample_rate(&mut self, sample_rate: f32) {
    self.reverb.set_sample_rate(sample_rate);
  }

  #[allow(clippy::too_many_arguments)]
  pub fn render(
    &mut self,
    input_l: Float32Array,
    input_r: Float32Array,
    time: Float32Array,
    damp: Float32Array,
    pre_delay: Float32Array,
    mix: Float32Array,
    frames: usize,
  ) -> Float32Array {
    if self.temp_l.len() != frames {
      self.temp_l.resize(frames, 0.0);
      self.temp_r.resize(frames, 0.0);
    }
    if self.buffer.len() != frames * 2 {
      self.buffer.resize(frames * 2, 0.0);
    }

    let input_l_vec = input_l.to_vec();
    let input_r_vec = input_r.to_vec();
    let time_vec = time.to_vec();
    let damp_vec = damp.to_vec();
    let pre_vec = pre_delay.to_vec();
    let mix_vec = mix.to_vec();

    let inputs = ReverbInputs {
      input_l: if input_l_vec.is_empty() {
        None
      } else {
        Some(input_l_vec.as_slice())
      },
      input_r: if input_r_vec.is_empty() {
        None
      } else {
        Some(input_r_vec.as_slice())
      },
    };

    let params = ReverbParams {
      time: &time_vec,
      damp: &damp_vec,
      pre_delay: &pre_vec,
      mix: &mix_vec,
    };

    self.reverb
      .process_block(&mut self.temp_l, &mut self.temp_r, inputs, params);

    for i in 0..frames {
      let idx = i * 2;
      self.buffer[idx] = self.temp_l[i];
      self.buffer[idx + 1] = self.temp_r[i];
    }

    Float32Array::from(self.buffer.as_slice())
  }
}

#[wasm_bindgen]
pub struct WasmGraphEngine {
  engine: graph::GraphEngine,
}

#[wasm_bindgen]
impl WasmGraphEngine {
  #[wasm_bindgen(constructor)]
  pub fn new(sample_rate: f32) -> WasmGraphEngine {
    WasmGraphEngine {
      engine: graph::GraphEngine::new(sample_rate),
    }
  }

  pub fn set_graph(&mut self, graph_json: &str) -> Result<(), JsValue> {
    self.engine.set_graph_json(graph_json).map_err(|err| JsValue::from_str(&err))
  }

  pub fn set_param(&mut self, module_id: &str, param_id: &str, value: f32) {
    self.engine.set_param(module_id, param_id, value);
  }

  pub fn set_control_voice_cv(&mut self, module_id: &str, voice: usize, value: f32) {
    self.engine.set_control_voice_cv(module_id, voice, value);
  }

  pub fn set_control_voice_gate(&mut self, module_id: &str, voice: usize, value: f32) {
    self.engine.set_control_voice_gate(module_id, voice, value);
  }

  pub fn trigger_control_voice_gate(&mut self, module_id: &str, voice: usize) {
    self.engine.trigger_control_voice_gate(module_id, voice);
  }

  pub fn trigger_control_voice_sync(&mut self, module_id: &str, voice: usize) {
    self.engine.trigger_control_voice_sync(module_id, voice);
  }

  pub fn set_control_voice_velocity(
    &mut self,
    module_id: &str,
    voice: usize,
    value: f32,
    slew_seconds: f32,
  ) {
    self.engine
      .set_control_voice_velocity(module_id, voice, value, slew_seconds);
  }

  pub fn set_mario_channel_cv(&mut self, module_id: &str, channel: usize, value: f32) {
    self.engine.set_mario_channel_cv(module_id, channel, value);
  }

  pub fn set_mario_channel_gate(&mut self, module_id: &str, channel: usize, value: f32) {
    self.engine.set_mario_channel_gate(module_id, channel, value);
  }

  pub fn render(&mut self, frames: usize) -> Float32Array {
    let data = self.engine.render(frames);
    unsafe { Float32Array::view(data) }
  }
}
