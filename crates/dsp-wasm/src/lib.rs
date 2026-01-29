use dsp_graph::GraphEngine;
use js_sys::{Float32Array, Uint8Array};
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

  /// Get current step position for a sequencer module
  /// Returns -1 if module not found or not a sequencer
  pub fn get_sequencer_step(&self, module_id: &str) -> i32 {
    self.engine.get_sequencer_step(module_id)
  }

  /// Get total ticks for a MIDI file sequencer module
  /// Returns 0 if module not found or not a MIDI file sequencer
  pub fn get_midi_total_ticks(&self, module_id: &str) -> i32 {
    self.engine.get_midi_total_ticks(module_id)
  }

  /// Seek MIDI file sequencer to a specific tick position
  pub fn seek_midi_sequencer(&mut self, module_id: &str, tick: u32) {
    self.engine.seek_midi_sequencer(module_id, tick);
  }

  /// Drain MIDI events from a sequencer. Returns [track, note, velocity, is_on, ...]
  pub fn drain_midi_events(&mut self, module_id: &str) -> Uint8Array {
    let data = self.engine.drain_midi_events(module_id);
    Uint8Array::from(&data[..])
  }

  /// Load sample data into a Granular module's buffer
  pub fn load_granular_buffer(&mut self, module_id: &str, data: &[f32]) {
    self.engine.load_granular_buffer(module_id, data);
  }

  /// Get the buffer length of a Granular module in samples
  pub fn get_granular_buffer_length(&self, module_id: &str) -> usize {
    self.engine.get_granular_buffer_length(module_id)
  }

  /// Get effective position for a Granular module (after CV modulation)
  /// Returns -1.0 if module not found or not a granular
  pub fn get_granular_position(&self, module_id: &str) -> f32 {
    self.engine.get_granular_position(module_id)
  }

  /// Get SID voice states for visualization
  /// Returns [freq0, gate0, wave0, freq1, gate1, wave1, freq2, gate2, wave2]
  pub fn get_sid_voice_states(&self, module_id: &str) -> Vec<u16> {
    self.engine.get_sid_voice_states(module_id)
  }

  /// Get waveform data from a Granular module for visualization
  pub fn get_granular_waveform(&self, module_id: &str, max_points: usize) -> Float32Array {
    let data = self.engine.get_granular_waveform(module_id, max_points);
    Float32Array::from(&data[..])
  }

  /// Load a SID file into a SidPlayer module
  pub fn load_sid_file(&mut self, module_id: &str, data: &[u8]) {
    self.engine.load_sid_file(module_id, data);
  }

  /// Get AY voice states for visualization
  /// Returns [period0, active0, flags0, period1, active1, flags1, period2, active2, flags2]
  pub fn get_ay_voice_states(&self, module_id: &str) -> Vec<u16> {
    self.engine.get_ay_voice_states(module_id)
  }

  /// Load a YM file into an AyPlayer module
  pub fn load_ym_file(&mut self, module_id: &str, data: &[u8]) {
    self.engine.load_ym_file(module_id, data);
  }

  /// Get elapsed playback time for a SID player (in seconds)
  pub fn get_sid_elapsed(&self, module_id: &str) -> f32 {
    self.engine.get_sid_elapsed(module_id)
  }

  /// Get elapsed playback time for an AY player (in seconds)
  pub fn get_ay_elapsed(&self, module_id: &str) -> f32 {
    self.engine.get_ay_elapsed(module_id)
  }
}
