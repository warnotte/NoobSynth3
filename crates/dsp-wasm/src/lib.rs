use dsp_core::{Node, Sample, SineOsc, Vca, Vco, VcoInputs, VcoParams};
use js_sys::Float32Array;
use wasm_bindgen::prelude::*;

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
