mod types;
mod buffer;
mod state;
mod ports;
mod process;
mod instantiate;

use dsp_core::{Sample, MARIO_CHANNELS};

// Re-export types from our modules
pub use types::{ModuleType, PortInfo, ConnectionEdge, TapSource, ParamBuffer};
pub use buffer::{Buffer, mix_buffers, downmix_to_mono};
pub use state::*;
pub use ports::{input_ports, output_ports, input_port_index, output_port_index};
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
    }
  }

  pub fn set_graph_json(&mut self, payload: &str) -> Result<(), String> {
    let graph: GraphPayload =
      serde_json::from_str(payload).map_err(|err| format!("Invalid graph JSON: {err}"))?;
    self.set_graph(graph);
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
          ModuleState::MidiFileSequencer(state) => return state.seq.current_tick() as i32,
          _ => {}
        }
      }
    }
    -1
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
      module.process(inputs, outputs, frames, self.sample_rate);
    }

    self.main_buffer.resize(2, frames);
    self.main_buffer.clear();
    for &index in &self.output_indices {
      let outputs = &self.output_buffers[index];
      if let Some(out_port) = outputs.get(0) {
        mix_buffers(&mut self.main_buffer, out_port, 1.0);
      }
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
    let voice_count = resolve_voice_count(&graph.modules);
    self.voice_count = voice_count;

    // Preserve sequencer state before clearing (keyed by module_id + voice_index)
    let mut saved_sequencer_ticks: HashMap<(String, Option<usize>), f64> = HashMap::new();
    for (module_id, indices) in &self.module_map {
      for &idx in indices {
        if let ModuleState::MidiFileSequencer(ref state) = self.modules[idx].state {
          let voice = self.modules[idx].voice_index;
          let tick = state.seq.current_tick_precise();
          saved_sequencer_ticks.insert((module_id.clone(), voice), tick);
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
        let mut node = ModuleNode::new(
          module_type,
          if is_poly { Some(voice_index) } else { None },
          &params,
          self.sample_rate,
        );

        // Restore sequencer state if we have saved state for this module
        if let ModuleState::MidiFileSequencer(ref mut state) = node.state {
          let voice = if is_poly { Some(voice_index) } else { None };
          if let Some(&tick) = saved_sequencer_ticks.get(&(module.id.clone(), voice)) {
            state.seq.set_current_tick_precise(tick);
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

  fn process(&mut self, inputs: &[Buffer], outputs: &mut [Buffer], frames: usize, _sample_rate: f32) {
    process::process_module(&mut self.state, &self.connections, inputs, outputs, frames);
  }
}
fn normalize_module_type(raw: &str) -> ModuleType {
  match raw {
    "oscillator" => ModuleType::Oscillator,
    "supersaw" => ModuleType::Supersaw,
    "karplus" => ModuleType::Karplus,
    "nes-osc" => ModuleType::NesOsc,
    "snes-osc" => ModuleType::SnesOsc,
    "noise" => ModuleType::Noise,
    "mod-router" => ModuleType::ModRouter,
    "sample-hold" => ModuleType::SampleHold,
    "slew" => ModuleType::Slew,
    "quantizer" => ModuleType::Quantizer,
    "ring-mod" => ModuleType::RingMod,
    "gain" => ModuleType::Gain,
    "cv-vca" => ModuleType::CvVca,
    "output" => ModuleType::Output,
    "lab" => ModuleType::Lab,
    "lfo" => ModuleType::Lfo,
    "adsr" => ModuleType::Adsr,
    "vcf" => ModuleType::Vcf,
    "hpf" => ModuleType::Hpf,
    "mixer" => ModuleType::Mixer,
    "mixer-1x2" => ModuleType::MixerWide,
    "mixer-8" => ModuleType::Mixer8,
    "crossfader" => ModuleType::Crossfader,
    "chorus" => ModuleType::Chorus,
    "ensemble" => ModuleType::Ensemble,
    "choir" => ModuleType::Choir,
    "vocoder" => ModuleType::Vocoder,
    "audio-in" => ModuleType::AudioIn,
    "delay" => ModuleType::Delay,
    "granular-delay" => ModuleType::GranularDelay,
    "tape-delay" => ModuleType::TapeDelay,
    "spring-reverb" => ModuleType::SpringReverb,
    "reverb" => ModuleType::Reverb,
    "phaser" => ModuleType::Phaser,
    "distortion" => ModuleType::Distortion,
    "wavefolder" => ModuleType::Wavefolder,
    "control" => ModuleType::Control,
    "scope" => ModuleType::Scope,
    "mario" => ModuleType::Mario,
    "arpeggiator" => ModuleType::Arpeggiator,
    "step-sequencer" => ModuleType::StepSequencer,
    "tb-303" => ModuleType::Tb303,
    // TR-909 Drums
    "909-kick" => ModuleType::Kick909,
    "909-snare" => ModuleType::Snare909,
    "909-hihat" => ModuleType::HiHat909,
    "909-clap" => ModuleType::Clap909,
    "909-tom" => ModuleType::Tom909,
    "909-rimshot" => ModuleType::Rimshot909,
    // TR-808 Drums
    "808-kick" => ModuleType::Kick808,
    "808-snare" => ModuleType::Snare808,
    "808-hihat" => ModuleType::HiHat808,
    "808-cowbell" => ModuleType::Cowbell808,
    "808-clap" => ModuleType::Clap808,
    "808-tom" => ModuleType::Tom808,
    // Drum Sequencer
    "drum-sequencer" => ModuleType::DrumSequencer,
    "euclidean" => ModuleType::Euclidean,
    // MIDI File Sequencer
    "midi-file-sequencer" => ModuleType::MidiFileSequencer,
    // FM Synthesis
    "fm-op" => ModuleType::FmOp,
    "shepard" => ModuleType::Shepard,
    "pipe-organ" => ModuleType::PipeOrgan,
    "spectral-swarm" => ModuleType::SpectralSwarm,
    "resonator" => ModuleType::Resonator,
    "wavetable" => ModuleType::Wavetable,
    "granular" => ModuleType::Granular,
    // Documentation
    "notes" => ModuleType::Notes,
    // Effects
    "pitch-shifter" => ModuleType::PitchShifter,
    "clock" => ModuleType::Clock,
    "chaos" => ModuleType::Chaos,
    "turing-machine" | "turing" => ModuleType::TuringMachine,
    // SID Player
    "sid-player" => ModuleType::SidPlayer,
    // AY Player
    "ay-player" => ModuleType::AyPlayer,
    _ => ModuleType::Oscillator,
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
      | ModuleType::Control
      | ModuleType::MidiFileSequencer
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
