mod types;
mod buffer;
mod state;
mod ports;
mod process;
mod instantiate;
mod module_type;

use dsp_core::{Sample, MARIO_CHANNELS};
use dsp_core::effects::eq3::{Eq3, Eq3Inputs, Eq3Params};
use dsp_core::effects::compressor::{Compressor, CompressorParams};

// Re-export types from our modules
pub use types::{ModuleType, PortInfo, ConnectionEdge, TapSource, ParamBuffer, TransportContext};
pub use buffer::{Buffer, mix_buffers, downmix_to_mono};
pub use state::*;
pub use ports::{input_ports, output_ports, input_port_index, output_port_index};
use module_type::normalize_module_type;
use serde::Deserialize;
use std::collections::{HashMap, VecDeque};

#[derive(Deserialize)]
struct GraphPayload {
  modules: Vec<ModuleSpecJson>,
  connections: Vec<ConnectionJson>,
  taps: Option<Vec<TapJson>>,
}

#[derive(Deserialize)]
struct ModuleSpecJson {
  id: String,
  #[serde(rename = "type")]
  kind: String,
  params: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Deserialize)]
struct ConnectionJson {
  from: PortRefJson,
  to: PortRefJson,
  kind: String,
}

#[derive(Deserialize)]
struct PortRefJson {
  #[serde(rename = "moduleId")]
  module_id: String,
  #[serde(rename = "portId")]
  port_id: String,
}

#[derive(Deserialize)]
struct TapJson {
  #[serde(rename = "moduleId")]
  module_id: String,
  #[serde(rename = "portId")]
  port_id: String,
}

struct ModuleNode {
  voice_index: Option<usize>,
  module_type: ModuleType,
  inputs: Vec<PortInfo>,
  outputs: Vec<PortInfo>,
  connections: Vec<Vec<ConnectionEdge>>,
  state: ModuleState,
}

pub struct GraphEngine {
  sample_rate: f32,
  voice_count: usize,
  modules: Vec<ModuleNode>,
  input_buffers: Vec<Vec<Buffer>>,
  output_buffers: Vec<Vec<Buffer>>,
  module_map: HashMap<String, Vec<usize>>,
  order: Vec<usize>,
  output_indices: Vec<usize>,
  taps: Vec<TapSource>,
  main_buffer: Buffer,
  output_data: Vec<Sample>,
  output_channels: usize,
  external_input: Vec<Sample>,
  external_input_frames: usize,
  transport_beats: f64,
  transport_tempo: f32,
  // Master bus FX
  master_eq: Eq3,
  master_comp: Compressor,
  master_eq_low: f32,
  master_eq_mid: f32,
  master_eq_high: f32,
  master_comp_threshold: f32,
  master_comp_ratio: f32,
  master_comp_attack: f32,
  master_comp_release: f32,
  master_fx_enabled: bool,
  // Master bus peak levels (post-FX, i.e. the final output) for the mixer's
  // master VU — queried via get_meter_level("__master__")
  master_peak_l: f32,
  master_peak_r: f32,
}

impl GraphEngine {
  pub fn new(sample_rate: f32) -> Self {
    Self {
      sample_rate,
      voice_count: 1,
      modules: Vec::new(),
      input_buffers: Vec::new(),
      output_buffers: Vec::new(),
      module_map: HashMap::new(),
      order: Vec::new(),
      output_indices: Vec::new(),
      taps: Vec::new(),
      main_buffer: Buffer::new(2, 0),
      output_data: Vec::new(),
      output_channels: 2,
      external_input: Vec::new(),
      external_input_frames: 0,
      transport_beats: 0.0,
      transport_tempo: 120.0,
      master_eq: Eq3::new(sample_rate),
      master_comp: Compressor::new(sample_rate),
      master_eq_low: 0.0,
      master_eq_mid: 0.0,
      master_eq_high: 0.0,
      master_comp_threshold: 0.0,
      master_comp_ratio: 1.0,
      master_comp_attack: 10.0,
      master_comp_release: 100.0,
      master_fx_enabled: true,
      master_peak_l: 0.0,
      master_peak_r: 0.0,
    }
  }

  pub fn set_graph_json(&mut self, payload: &str) -> Result<(), String> {
    let graph: GraphPayload =
      serde_json::from_str(payload).map_err(|err| format!("Invalid graph JSON: {err}"))?;
    self.set_graph(graph);
    Ok(())
  }

  /// Set graph with fresh state (no preservation). Used for preset switches.
  pub fn set_graph_json_fresh(&mut self, payload: &str) -> Result<(), String> {
    let graph: GraphPayload =
      serde_json::from_str(payload).map_err(|err| format!("Invalid graph JSON: {err}"))?;
    self.set_graph_fresh(graph);
    Ok(())
  }

  pub fn set_param(&mut self, module_id: &str, param: &str, value: f32) {
    if let Some(indices) = self.module_map.get(module_id) {
      for &index in indices {
        if let Some(module) = self.modules.get_mut(index) {
          module.apply_param(param, value);
        }
      }
    }
  }

  pub fn set_param_string(&mut self, module_id: &str, param: &str, value: &str) {
    if let Some(indices) = self.module_map.get(module_id) {
      for &index in indices {
        if let Some(module) = self.modules.get_mut(index) {
          module.apply_param_str(param, value);
        }
      }
    }
  }

  pub fn set_external_input(&mut self, input: &[Sample]) {
    self.external_input.clear();
    self.external_input.extend_from_slice(input);
    self.external_input_frames = input.len();
  }

  pub fn clear_external_input(&mut self) {
    self.external_input.clear();
    self.external_input_frames = 0;
  }

  pub fn set_transport_tempo(&mut self, tempo: f32) {
    self.transport_tempo = tempo.clamp(1.0, 999.0);
  }

  pub fn reset_transport(&mut self) {
    self.transport_beats = 0.0;
  }

  pub fn get_transport_beats(&self) -> f64 {
    self.transport_beats
  }

  pub fn set_master_fx_param(&mut self, param: &str, value: f32) {
    match param {
      "eqLow" => self.master_eq_low = value.clamp(-12.0, 12.0),
      "eqMid" => self.master_eq_mid = value.clamp(-12.0, 12.0),
      "eqHigh" => self.master_eq_high = value.clamp(-12.0, 12.0),
      "compThreshold" => self.master_comp_threshold = value.clamp(-60.0, 0.0),
      "compRatio" => self.master_comp_ratio = value.clamp(1.0, 20.0),
      "compAttack" => self.master_comp_attack = value.clamp(0.5, 200.0),
      "compRelease" => self.master_comp_release = value.clamp(10.0, 2000.0),
      "masterFxEnabled" => self.master_fx_enabled = value > 0.5,
      _ => {}
    }
  }

  pub fn set_control_voice_cv(&mut self, module_id: &str, voice: usize, value: f32) {
    if let Some(index) = self.find_voice_instance(module_id, voice) {
      if let Some(ModuleState::Control(state)) = self.modules.get_mut(index).map(|m| &mut m.state) {
        if state.glide_seconds > 0.0 {
          let total = (state.glide_seconds * self.sample_rate).max(1.0);
          state.cv_target = value;
          state.cv_remaining = total as usize;
          state.cv_step = (state.cv_target - state.cv) / total;
        } else {
          state.cv = value;
          state.cv_target = value;
          state.cv_remaining = 0;
        }
      }
    }
  }

  pub fn set_control_voice_gate(&mut self, module_id: &str, voice: usize, value: f32) {
    if let Some(index) = self.find_voice_instance(module_id, voice) {
      if let Some(ModuleState::Control(state)) = self.modules.get_mut(index).map(|m| &mut m.state) {
        state.gate = value;
      }
    }
  }

  pub fn trigger_control_voice_gate(&mut self, module_id: &str, voice: usize) {
    if let Some(index) = self.find_voice_instance(module_id, voice) {
      if let Some(ModuleState::Control(state)) = self.modules.get_mut(index).map(|m| &mut m.state) {
        // Force a brief gate=0 period to guarantee rising edge for ADSR retrigger
        // 8 samples at 48kHz = ~0.17ms, imperceptible but ensures proper envelope restart
        state.retrigger_samples = 8;
        state.gate = 1.0;
      }
    }
  }

  pub fn trigger_control_voice_sync(&mut self, module_id: &str, voice: usize) {
    if let Some(index) = self.find_voice_instance(module_id, voice) {
      if let Some(ModuleState::Control(state)) = self.modules.get_mut(index).map(|m| &mut m.state) {
        let samples = (0.02 * self.sample_rate).max(1.0);
        state.sync_remaining = samples as usize;
      }
    }
  }

  pub fn set_control_voice_velocity(
    &mut self,
    module_id: &str,
    voice: usize,
    value: f32,
    slew_seconds: f32,
  ) {
    if let Some(index) = self.find_voice_instance(module_id, voice) {
      if let Some(ModuleState::Control(state)) = self.modules.get_mut(index).map(|m| &mut m.state) {
        let clamped = value.clamp(0.0, 1.0);
        if slew_seconds > 0.0 {
          let total = (slew_seconds * self.sample_rate).max(1.0);
          state.velocity_target = clamped;
          state.velocity_remaining = total as usize;
          state.velocity_step = (state.velocity_target - state.velocity) / total;
        } else {
          state.velocity = clamped;
          state.velocity_target = clamped;
          state.velocity_remaining = 0;
        }
      }
    }
  }

  pub fn set_mario_channel_cv(&mut self, module_id: &str, channel: usize, value: f32) {
    if channel == 0 || channel > MARIO_CHANNELS {
      return;
    }
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(ModuleState::Mario(state)) = self.modules.get_mut(*index).map(|m| &mut m.state) {
        state.mario.set_cv(channel - 1, value);
      }
    }
  }

  pub fn set_mario_channel_gate(&mut self, module_id: &str, channel: usize, value: f32) {
    if channel == 0 || channel > MARIO_CHANNELS {
      return;
    }
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(ModuleState::Mario(state)) = self.modules.get_mut(*index).map(|m| &mut m.state) {
        state.mario.set_gate(channel - 1, value);
      }
    }
  }

  /// Get current step position for a sequencer module (StepSequencer, DrumSequencer, MidiFileSequencer)
  /// Returns -1 if module not found or not a sequencer
  pub fn get_sequencer_step(&self, module_id: &str) -> i32 {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        match &module.state {
          ModuleState::StepSequencer(state) => return state.seq.current_step() as i32,
          ModuleState::DrumSequencer(state) => return state.seq.current_step() as i32,
          ModuleState::DrumMachine909(state) => return state.seq.current_step() as i32,
          ModuleState::MidiFileSequencer(state) => return state.seq.current_tick() as i32,
          ModuleState::ChordSequencer(state) => return state.seq.current_step() as i32,
          ModuleState::PolyrhythmSequencer(state) => return state.seq.current_step() as i32,
          ModuleState::GameOfLife(state) => return state.gol.current_step() as i32,
          _ => {}
        }
      }
    }
    -1
  }

  /// Get Game of Life grid state for UI visualization
  /// Returns 16 u16 values (one per row, each bit = one column)
  pub fn get_gol_grid(&self, module_id: &str) -> Vec<u16> {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::GameOfLife(state) = &module.state {
          return state.gol.grid_state().to_vec();
        }
      }
    }
    Vec::new()
  }

  /// Get meter peak levels as [peak_l, peak_r] encoded in a single u32.
  /// High 16 bits = left (0..10000 = 0.0..1.0), low 16 bits = right.
  pub fn get_meter_level(&self, module_id: &str) -> u32 {
    // Reserved ID: the master bus (post-FX engine output). Lets the master
    // VU reuse the whole meter pipeline (worklet poll + native command)
    // without any new plumbing. Leading '_' also exempts it from the
    // rack-prefix id mapping on the JS side.
    if module_id == "__master__" {
      let l = (self.master_peak_l.clamp(0.0, 2.0) * 10000.0) as u32;
      let r = (self.master_peak_r.clamp(0.0, 2.0) * 10000.0) as u32;
      return (l << 16) | r;
    }
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::Meter(state) = &module.state {
          let l = (state.peak_l.clamp(0.0, 2.0) * 10000.0) as u32;
          let r = (state.peak_r.clamp(0.0, 2.0) * 10000.0) as u32;
          return (l << 16) | r;
        }
      }
    }
    0
  }

  /// Get the theremin's current display position (for the UI cursor) packed
  /// into a u32: bit 24 = gate, bits 12..24 = x (0..4095), bits 0..12 = y.
  /// x/y are the normalized pad position (0..1) of whatever is being played
  /// (mouse or incoming CV).
  pub fn get_theremin_state(&self, module_id: &str) -> u32 {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::Theremin(state) = &module.state {
          let (x, y, gate) = state.theremin.display_state();
          let xq = (x.clamp(0.0, 1.0) * 4095.0) as u32;
          let yq = (y.clamp(0.0, 1.0) * 4095.0) as u32;
          let g = if gate > 0.5 { 1u32 } else { 0u32 };
          return (g << 24) | (xq << 12) | yq;
        }
      }
    }
    0
  }

  /// Get total ticks for a MIDI file sequencer module
  /// Returns 0 if module not found or not a MIDI file sequencer
  pub fn get_midi_total_ticks(&self, module_id: &str) -> i32 {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::MidiFileSequencer(state) = &module.state {
          return state.seq.total_ticks() as i32;
        }
      }
    }
    0
  }

  /// Get effective position for a Granular module (after CV modulation)
  /// Returns -1.0 if module not found or not a granular
  pub fn get_granular_position(&self, module_id: &str) -> f32 {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::Granular(state) = &module.state {
          return state.granular.effective_position();
        }
      }
    }
    -1.0
  }

  /// Get particle positions for a ParticleCloud module
  /// Returns flattened array: [x0, y0, x1, y1, ..., x31, y31, active_count]
  /// Returns empty vec if module not found or not a particle cloud
  pub fn get_particle_positions(&self, module_id: &str) -> Vec<f32> {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::ParticleCloud(state) = &module.state {
          let positions = state.cloud.get_positions();
          let active = state.cloud.get_active_count();
          let mut result = Vec::with_capacity(65);
          result.extend_from_slice(positions);
          result.push(active as f32);
          return result;
        }
      }
    }
    Vec::new()
  }

  /// Load sample buffer into a ParticleCloud module
  pub fn load_particle_buffer(&mut self, module_id: &str, data: &[f32]) {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first().copied()) {
      if let Some(module) = self.modules.get_mut(index) {
        if let ModuleState::ParticleCloud(ref mut state) = module.state {
          state.cloud.load_buffer(data);
        }
      }
    }
  }

  /// Seek MIDI file sequencer to a specific tick position
  pub fn seek_midi_sequencer(&mut self, module_id: &str, tick: u32) {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first().copied()) {
      if let Some(module) = self.modules.get_mut(index) {
        if let ModuleState::MidiFileSequencer(ref mut state) = module.state {
          state.seq.seek_to_tick(tick);
        }
      }
    }
  }

  /// Get SID voice states for visualization
  /// Returns [freq0, gate0, wave0, freq1, gate1, wave1, freq2, gate2, wave2]
  pub fn get_sid_voice_states(&self, module_id: &str) -> Vec<u16> {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::SidPlayer(state) = &module.state {
          let voices = state.sid_player.get_voice_states();
          return vec![
            voices[0].0, voices[0].1 as u16, voices[0].2 as u16,
            voices[1].0, voices[1].1 as u16, voices[1].2 as u16,
            voices[2].0, voices[2].1 as u16, voices[2].2 as u16,
          ];
        }
      }
    }
    vec![0; 9]
  }

  /// Drain MIDI events from a sequencer. Returns flat array: [track, note, velocity, is_on, ...]
  pub fn drain_midi_events(&mut self, module_id: &str) -> Vec<u8> {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first().copied()) {
      if let Some(module) = self.modules.get_mut(index) {
        if let ModuleState::MidiFileSequencer(ref mut state) = module.state {
          let events = state.seq.drain_events();
          let mut out = Vec::with_capacity(events.len() * 4);
          for e in events {
            out.push(e.track);
            out.push(e.note);
            out.push(e.velocity);
            out.push(if e.is_note_on { 1 } else { 0 });
          }
          return out;
        }
      }
    }
    Vec::new()
  }

  /// Load sample data into a Granular module's buffer
  pub fn load_granular_buffer(&mut self, module_id: &str, data: &[Sample]) {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first().copied()) {
      if let Some(module) = self.modules.get_mut(index) {
        if let ModuleState::Granular(ref mut state) = module.state {
          state.granular.load_buffer(data);
        }
      }
    }
  }

  /// Get the buffer length of a Granular module in samples
  pub fn get_granular_buffer_length(&self, module_id: &str) -> usize {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::Granular(ref state) = module.state {
          return state.granular.buffer_length();
        }
      }
    }
    0
  }

  /// Load a sample buffer into a Sampler module (mono, at engine SR via the UI's decodeAudioData).
  pub fn load_sampler_buffer(&mut self, module_id: &str, data: &[Sample], file_sr: f32) {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first().copied()) {
      if let Some(module) = self.modules.get_mut(index) {
        if let ModuleState::Sampler(ref mut state) = module.state {
          state.sampler.load_buffer(data, file_sr);
        }
      }
    }
  }

  /// Get the buffer length of a Sampler module in samples.
  pub fn get_sampler_buffer_length(&self, module_id: &str) -> usize {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::Sampler(ref state) = module.state {
          return state.sampler.buffer_length();
        }
      }
    }
    0
  }

  /// Get waveform data from a Granular module for visualization
  /// Returns downsampled data (max 512 points) for efficient display
  pub fn get_granular_waveform(&self, module_id: &str, max_points: usize) -> Vec<Sample> {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::Granular(ref state) = module.state {
          let buffer = state.granular.buffer_data();
          if buffer.is_empty() {
            return Vec::new();
          }
          let step = (buffer.len() / max_points).max(1);
          let mut result = Vec::with_capacity(max_points);
          for i in (0..buffer.len()).step_by(step) {
            // Find min/max in this segment for accurate waveform
            let end = (i + step).min(buffer.len());
            let mut min_val = buffer[i];
            let mut max_val = buffer[i];
            for j in i..end {
              if buffer[j] < min_val { min_val = buffer[j]; }
              if buffer[j] > max_val { max_val = buffer[j]; }
            }
            // Store the value with largest absolute magnitude
            result.push(if max_val.abs() > min_val.abs() { max_val } else { min_val });
          }
          return result;
        }
      }
    }
    Vec::new()
  }

  /// Load a SID file into a SidPlayer module
  pub fn load_sid_file(&mut self, module_id: &str, data: &[u8]) {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first().copied()) {
      if let Some(module) = self.modules.get_mut(index) {
        if let ModuleState::SidPlayer(ref mut state) = module.state {
          state.sid_player.load_sid(data);
        }
      }
    }
  }

  /// Get AY voice states for visualization
  /// Returns [period0, active0, flags0, period1, active1, flags1, period2, active2, flags2]
  pub fn get_ay_voice_states(&self, module_id: &str) -> Vec<u16> {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::AyPlayer(state) = &module.state {
          let voices = state.ay_player.voice_states();
          return vec![
            voices[0].0, voices[0].1 as u16, voices[0].2 as u16,
            voices[1].0, voices[1].1 as u16, voices[1].2 as u16,
            voices[2].0, voices[2].1 as u16, voices[2].2 as u16,
          ];
        }
      }
    }
    vec![0; 9]
  }

  /// Load a YM file into an AyPlayer module
  pub fn load_ym_file(&mut self, module_id: &str, data: &[u8]) {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first().copied()) {
      if let Some(module) = self.modules.get_mut(index) {
        if let ModuleState::AyPlayer(ref mut state) = module.state {
          if let Err(e) = state.ay_player.load_ym(data) {
            // Log error but don't crash
            #[cfg(debug_assertions)]
            eprintln!("Failed to load YM file: {}", e);
          }
        }
      }
    }
  }

  /// Get elapsed time in seconds for a SID player
  pub fn get_sid_elapsed(&self, module_id: &str) -> f32 {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::SidPlayer(state) = &module.state {
          return state.sid_player.elapsed_seconds();
        }
      }
    }
    0.0
  }

  /// Get elapsed time in seconds for an AY player
  pub fn get_ay_elapsed(&self, module_id: &str) -> f32 {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        if let ModuleState::AyPlayer(state) = &module.state {
          return state.ay_player.elapsed_seconds();
        }
      }
    }
    0.0
  }

  pub fn render(&mut self, frames: usize) -> &[Sample] {
    if frames == 0 {
      return &[];
    }
    if self.modules.is_empty() {
      self.ensure_output(frames);
      self.output_data.fill(0.0);
      return &self.output_data;
    }

    let transport = TransportContext {
      beats: self.transport_beats,
      beats_per_sample: self.transport_tempo as f64 / 60.0 / self.sample_rate as f64,
    };

    for &module_index in &self.order {
      {
        let module = &self.modules[module_index];
        for (input_index, info) in module.inputs.iter().enumerate() {
          let buffer = &mut self.input_buffers[module_index][input_index];
          buffer.resize(info.channels, frames);
          buffer.clear();
          for edge in &module.connections[input_index] {
            let source = &self.output_buffers[edge.source_module][edge.source_port];
            mix_buffers(buffer, source, edge.gain);
          }
        }
        for (output_index, info) in module.outputs.iter().enumerate() {
          let buffer = &mut self.output_buffers[module_index][output_index];
          buffer.resize(info.channels, frames);
          buffer.clear();
        }
      }

      let inputs = &self.input_buffers[module_index];
      let outputs = &mut self.output_buffers[module_index];
      let module = &mut self.modules[module_index];
        if let ModuleState::AudioIn(state) = &mut module.state {
          let output = outputs[0].channel_mut(0);
          if self.external_input_frames == 0 {
            output.fill(0.0);
          } else {
            let gain = state.gain.slice(frames);
            let available = self.external_input_frames.min(frames);
            for i in 0..available {
              output[i] = self.external_input[i] * gain[i];
            }
            if available < frames {
              output[available..frames].fill(0.0);
            }
          }
          continue;
        }
      module.process(inputs, outputs, frames, self.sample_rate, transport);
    }

    self.transport_beats += frames as f64 * (self.transport_tempo as f64 / 60.0 / self.sample_rate as f64);

    self.main_buffer.resize(2, frames);
    self.main_buffer.clear();
    for &index in &self.output_indices {
      let outputs = &self.output_buffers[index];
      if let Some(out_port) = outputs.get(0) {
        mix_buffers(&mut self.main_buffer, out_port, 1.0);
      }
    }

    // Master bus FX: EQ → Compressor (process in-place on main_buffer)
    if self.master_fx_enabled && frames > 0 {
      // EQ3: needs separate input slices, so copy first
      let needs_eq = self.master_eq_low.abs() > 0.01 || self.master_eq_mid.abs() > 0.01 || self.master_eq_high.abs() > 0.01;
      if needs_eq {
        let mut tmp_l = vec![0.0f32; frames];
        let mut tmp_r = vec![0.0f32; frames];
        tmp_l.copy_from_slice(&self.main_buffer.channel(0)[..frames]);
        tmp_r.copy_from_slice(&self.main_buffer.channel(1)[..frames]);
        let (out_l, out_r) = self.main_buffer.channels_mut_2();
        self.master_eq.process_block(
          out_l, out_r,
          Eq3Inputs { input_l: Some(&tmp_l), input_r: Some(&tmp_r) },
          Eq3Params {
            low_gain: &[self.master_eq_low],
            mid_gain: &[self.master_eq_mid],
            high_gain: &[self.master_eq_high],
            low_freq: &[200.0],
            mid_freq: &[1000.0],
            high_freq: &[5000.0],
            mid_q: &[1.0],
          },
        );
      }
      // Compressor (only if ratio > 1)
      if self.master_comp_ratio > 1.01 {
        let (left, right) = self.main_buffer.channels_mut_2();
        self.master_comp.process_block_stereo(
          left, right,
          None, None,
          CompressorParams {
            threshold: &[self.master_comp_threshold],
            ratio: &[self.master_comp_ratio],
            attack: &[self.master_comp_attack],
            release: &[self.master_comp_release],
            makeup: &[0.0],
            mix: &[1.0],
          },
          None, None,
        );
      }
    }

    // Master bus peak (post-FX = final output) — same decay law as the
    // Meter module (process/io.rs)
    if frames > 0 {
      let left = self.main_buffer.channel(0);
      let right = self.main_buffer.channel(1);
      let mut peak_l = 0.0_f32;
      let mut peak_r = 0.0_f32;
      for i in 0..frames {
        peak_l = peak_l.max(left[i].abs());
        peak_r = peak_r.max(right[i].abs());
      }
      let decay = 0.95_f32;
      self.master_peak_l = (self.master_peak_l * decay).max(peak_l);
      self.master_peak_r = (self.master_peak_r * decay).max(peak_r);
    }

    self.ensure_output(frames);
    let channel_span = frames;
    let main_left = self.main_buffer.channel(0);
    let main_right = self.main_buffer.channel(1);
    self.output_data[0..channel_span].copy_from_slice(main_left);
    self.output_data[channel_span..(2 * channel_span)].copy_from_slice(main_right);

    for (tap_index, tap) in self.taps.iter().enumerate() {
      let offset = (2 + tap_index) * channel_span;
      let dest = &mut self.output_data[offset..offset + channel_span];
      let source = &self.input_buffers[tap.module_index][tap.input_port];
      downmix_to_mono(source, dest);
    }

    &self.output_data
  }

  fn set_graph(&mut self, graph: GraphPayload) {
    self.set_graph_inner(graph, true);
  }

  fn set_graph_fresh(&mut self, graph: GraphPayload) {
    self.set_graph_inner(graph, false);
    self.transport_beats = 0.0;
  }

  fn set_graph_inner(&mut self, graph: GraphPayload, preserve_state: bool) {
    let voice_count = resolve_voice_count(&graph.modules);
    self.voice_count = voice_count;

    // Save all module states keyed by (module_id, voice_index, module_type)
    let mut saved_states: HashMap<(String, Option<usize>), (ModuleType, ModuleState)> = HashMap::new();
    if preserve_state {
      for (module_id, indices) in &self.module_map {
        for &idx in indices {
          let node = &self.modules[idx];
          // Use std::mem::replace to take ownership without Clone
          saved_states.insert(
            (module_id.clone(), node.voice_index),
            (node.module_type, std::mem::replace(
              &mut self.modules[idx].state,
              ModuleState::Empty,
            )),
          );
        }
      }
    }

    self.modules.clear();
    self.input_buffers.clear();
    self.output_buffers.clear();
    self.module_map.clear();
    self.output_indices.clear();

    let mut modules = Vec::new();
    let mut module_map: HashMap<String, Vec<usize>> = HashMap::new();

    for module in &graph.modules {
      let module_type = normalize_module_type(&module.kind);
      let params = module.params.clone().unwrap_or_default();
      let is_poly = is_poly_type(module_type);
      let instance_count = if is_poly { voice_count } else { 1 };
      for voice_index in 0..instance_count {
        let voice = if is_poly { Some(voice_index) } else { None };
        let mut node = ModuleNode::new(
          module_type,
          voice,
          &params,
          self.sample_rate,
        );

        // Restore state if same module id + same type still exists.
        // NOTE: this deliberately discards the freshly-parsed state from ModuleNode::new
        // (including any string param like patternData/stepData/midiData re-parsed from
        // `params`). In preserve mode the live DSP state wins, so after updateGraph the
        // caller MUST re-send string params via set_param_string to apply edits — see
        // App.tsx STRING_PARAMS / the undo-sync loop.
        if let Some((saved_type, saved_state)) = saved_states.remove(&(module.id.clone(), voice)) {
          if saved_type == module_type {
            node.state = saved_state;
          }
        }

        let index = modules.len();
        modules.push(node);
        module_map.entry(module.id.clone()).or_default().push(index);
      }
    }


    let mut input_buffers = Vec::new();
    let mut output_buffers = Vec::new();

    for node in &modules {
      let mut inputs = Vec::new();
      let mut outputs = Vec::new();
      for port in &node.inputs {
        inputs.push(Buffer::new(port.channels, 0));
      }
      for port in &node.outputs {
        outputs.push(Buffer::new(port.channels, 0));
      }
      input_buffers.push(inputs);
      output_buffers.push(outputs);
    }

    for connection in &graph.connections {
      let from_indices = module_map.get(&connection.from.module_id);
      let to_indices = module_map.get(&connection.to.module_id);
      let Some(from_list) = from_indices else { continue };
      let Some(to_list) = to_indices else { continue };
      let from_type = modules[from_list[0]].module_type;
      let to_type = modules[to_list[0]].module_type;
      let source_port = match output_port_index(from_type, &connection.from.port_id) {
        Some(index) => index,
        None => continue,
      };
      let target_port = match input_port_index(to_type, &connection.to.port_id) {
        Some(index) => index,
        None => continue,
      };

      let source_is_poly = is_poly_type(from_type);
      let target_is_poly = is_poly_type(to_type);
      let is_audio = connection.kind == "audio";

      if source_is_poly && target_is_poly {
        let count = from_list.len().min(to_list.len());
        for i in 0..count {
          let target = to_list[i];
          let edge = ConnectionEdge {
            source_module: from_list[i],
            source_port,
            gain: 1.0,
          };
          modules[target].connections[target_port].push(edge);
        }
      } else if source_is_poly && !target_is_poly {
        if is_audio {
          let gain = 1.0 / from_list.len().max(1) as f32;
          let target = to_list[0];
          for &source in from_list {
            modules[target].connections[target_port].push(ConnectionEdge {
              source_module: source,
              source_port,
              gain,
            });
          }
        } else {
          let target = to_list[0];
          modules[target].connections[target_port].push(ConnectionEdge {
            source_module: from_list[0],
            source_port,
            gain: 1.0,
          });
        }
      } else if !source_is_poly && target_is_poly {
        for &target in to_list {
          modules[target].connections[target_port].push(ConnectionEdge {
            source_module: from_list[0],
            source_port,
            gain: 1.0,
          });
        }
      } else {
        let target = to_list[0];
        modules[target].connections[target_port].push(ConnectionEdge {
          source_module: from_list[0],
          source_port,
          gain: 1.0,
        });
      }
    }

    let order = compute_order(&modules);
    let output_indices = modules
      .iter()
      .enumerate()
      .filter_map(|(idx, node)| if node.module_type == ModuleType::Output { Some(idx) } else { None })
      .collect::<Vec<_>>();

    let taps = build_taps(&graph.taps, &modules, &module_map);

    self.modules = modules;
    self.input_buffers = input_buffers;
    self.output_buffers = output_buffers;
    self.module_map = module_map;
    self.order = order;
    self.output_indices = output_indices;
    self.taps = taps;
    self.output_channels = 2 + self.taps.len();
  }

  fn ensure_output(&mut self, frames: usize) {
    let required = self.output_channels * frames;
    if self.output_data.len() != required {
      self.output_data.resize(required, 0.0);
    }
  }

  fn find_voice_instance(&self, module_id: &str, voice: usize) -> Option<usize> {
    self
      .module_map
      .get(module_id)
      .and_then(|indices| indices.iter().find(|&&idx| self.modules[idx].voice_index == Some(voice)))
      .copied()
  }
}
impl ModuleNode {
  fn new(
    module_type: ModuleType,
    voice_index: Option<usize>,
    params: &HashMap<String, serde_json::Value>,
    sample_rate: f32,
  ) -> Self {
    let inputs = input_ports(module_type);
    let outputs = output_ports(module_type);
    let connections = (0..inputs.len()).map(|_| Vec::new()).collect();
    let state = instantiate::create_state(module_type, params, sample_rate, voice_index);

    Self {
      voice_index,
      module_type,
      inputs,
      outputs,
      connections,
      state,
    }
  }

  fn apply_param(&mut self, param: &str, value: f32) {
    instantiate::apply_param(&mut self.state, param, value);
  }

  fn apply_param_str(&mut self, param: &str, value: &str) {
    instantiate::apply_param_str(&mut self.state, param, value);
  }

  fn process(&mut self, inputs: &[Buffer], outputs: &mut [Buffer], frames: usize, _sample_rate: f32, transport: TransportContext) {
    process::process_module(&mut self.state, &self.connections, inputs, outputs, frames, transport);
  }
}

fn is_poly_type(module_type: ModuleType) -> bool {
  matches!(
    module_type,
    ModuleType::Oscillator
      | ModuleType::Supersaw
      | ModuleType::Karplus
      | ModuleType::NesOsc
      | ModuleType::SnesOsc
      | ModuleType::Noise
      | ModuleType::PipeOrgan
      | ModuleType::ModRouter
      | ModuleType::SampleHold
      | ModuleType::Slew
      | ModuleType::Quantizer
      | ModuleType::Chaos
      | ModuleType::TuringMachine
      | ModuleType::RingMod
      | ModuleType::Gain
      | ModuleType::CvVca
      | ModuleType::Lfo
      | ModuleType::Adsr
      | ModuleType::Vcf
      | ModuleType::Hpf
      | ModuleType::Mixer
      | ModuleType::MixerWide
      | ModuleType::Distortion
      | ModuleType::Wavefolder
      | ModuleType::FmMatrix
      | ModuleType::Control
      | ModuleType::MidiFileSequencer
      | ModuleType::SpeechSynth
  )
}


fn resolve_voice_count(modules: &[ModuleSpecJson]) -> usize {
  let mut voice_count = 1.0;
  for module in modules {
    if module.kind == "control" || module.kind == "midi-file-sequencer" {
      if let Some(params) = &module.params {
        let v = param_number(params, "voices", 1.0);
        if v > voice_count {
          voice_count = v;
        }
      }
    }
  }
  let rounded = voice_count.round().clamp(1.0, 8.0) as usize;
  rounded.max(1)
}

pub(crate) fn param_number(
  params: &HashMap<String, serde_json::Value>,
  key: &str,
  default: f32,
) -> f32 {
  let value = params.get(key);
  match value {
    Some(serde_json::Value::Number(number)) => {
      let raw = number.as_f64().unwrap_or(default as f64) as f32;
      if key == "slope" && raw > 1.0 {
        if raw >= 24.0 { 1.0 } else { 0.0 }
      } else {
        raw
      }
    }
    Some(serde_json::Value::Bool(flag)) => {
      if *flag {
        1.0
      } else {
        0.0
      }
    }
    Some(serde_json::Value::String(text)) => map_string_param(key, text, default),
    _ => default,
  }
}

fn map_string_param(key: &str, text: &str, default: f32) -> f32 {
  match key {
    "type" | "waveform" | "shape" => match text {
      "sine" => 0.0,
      "triangle" => 1.0,
      "saw" | "sawtooth" => 2.0,
      "square" => 3.0,
      _ => default,
    },
    "mode" => match text {
      "lp" => 0.0,
      "hp" => 1.0,
      "bp" => 2.0,
      "notch" => 3.0,
      _ => default,
    },
    "model" => match text {
      "svf" => 0.0,
      "ladder" => 1.0,
      _ => default,
    },
    "noiseType" => match text {
      "white" => 0.0,
      "pink" => 1.0,
      "brown" | "red" => 2.0,
      _ => default,
    },
    _ => default,
  }
}

fn compute_order(modules: &[ModuleNode]) -> Vec<usize> {
  let mut indegree = vec![0usize; modules.len()];
  let mut adjacency: Vec<Vec<usize>> = vec![Vec::new(); modules.len()];

  for (target_index, module) in modules.iter().enumerate() {
    for edges in &module.connections {
      for edge in edges {
        if edge.source_module == target_index {
          continue;
        }
        adjacency[edge.source_module].push(target_index);
        indegree[target_index] += 1;
      }
    }
  }

  let mut queue = VecDeque::new();
  for (index, degree) in indegree.iter().enumerate() {
    if *degree == 0 {
      queue.push_back(index);
    }
  }

  let mut order = Vec::with_capacity(modules.len());
  while let Some(node) = queue.pop_front() {
    order.push(node);
    for &next in &adjacency[node] {
      if indegree[next] > 0 {
        indegree[next] -= 1;
        if indegree[next] == 0 {
          queue.push_back(next);
        }
      }
    }
  }

  if order.len() < modules.len() {
    for index in 0..modules.len() {
      if !order.contains(&index) {
        order.push(index);
      }
    }
  }

  order
}

fn build_taps(
  taps: &Option<Vec<TapJson>>,
  modules: &[ModuleNode],
  map: &HashMap<String, Vec<usize>>,
) -> Vec<TapSource> {
  let mut results = Vec::new();
  let Some(tap_list) = taps else {
    return results;
  };
  for tap in tap_list {
    let Some(indices) = map.get(&tap.module_id) else {
      continue;
    };
    let index = indices.first().copied().unwrap_or(0);
    let module_type = modules[index].module_type;
    let Some(input_port) = input_port_index(module_type, &tap.port_id) else {
      continue;
    };
    results.push(TapSource { module_index: index, input_port });
  }
  results
}
