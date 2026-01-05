use dsp_graph::GraphEngine;
use js_sys::Float32Array;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmGraphEngine {
  engine: GraphEngine,
}

#[wasm_bindgen]
impl WasmGraphEngine {
  #[wasm_bindgen(constructor)]
  pub fn new(sample_rate: f32) -> WasmGraphEngine {
    WasmGraphEngine {
      engine: GraphEngine::new(sample_rate),
    }
  }

  pub fn set_graph(&mut self, graph_json: &str) -> Result<(), JsValue> {
    self.engine
      .set_graph_json(graph_json)
      .map_err(|err| JsValue::from_str(&err))
  }

  pub fn set_param(&mut self, module_id: &str, param_id: &str, value: f32) {
    self.engine.set_param(module_id, param_id, value);
  }

  pub fn set_param_string(&mut self, module_id: &str, param_id: &str, value: &str) {
    self.engine.set_param_string(module_id, param_id, value);
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

  pub fn set_external_input(&mut self, input: &[f32]) {
    self.engine.set_external_input(input);
  }

  pub fn clear_external_input(&mut self) {
    self.engine.clear_external_input();
  }

  pub fn render(&mut self, frames: usize) -> Float32Array {
    let data = self.engine.render(frames);
    unsafe { Float32Array::view(data) }
  }
}
