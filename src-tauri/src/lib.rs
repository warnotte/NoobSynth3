use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat, StreamConfig};
use dsp_core::{Node, SineOsc};
use dsp_graph::GraphEngine;
use midir::MidiInput;
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Instant;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeStatus {
  running: bool,
  device_name: Option<String>,
  sample_rate: u32,
  channels: u16,
  input_device_name: Option<String>,
  input_sample_rate: u32,
  input_channels: u16,
  input_error: Option<String>,
}

enum AudioCommand {
  Start {
    graph_json: Option<String>,
    device_name: Option<String>,
    input_device_name: Option<String>,
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  Stop {
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  SetGraph {
    graph_json: String,
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  SetGraphFresh {
    graph_json: String,
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  SetParam {
    module_id: String,
    param_id: String,
    value: f32,
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  SetParamString {
    module_id: String,
    param_id: String,
    value: String,
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  SetControlVoiceCv {
    module_id: String,
    voice: usize,
    value: f32,
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  SetControlVoiceGate {
    module_id: String,
    voice: usize,
    value: f32,
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  TriggerControlVoiceGate {
    module_id: String,
    voice: usize,
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  TriggerControlVoiceSync {
    module_id: String,
    voice: usize,
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  SetControlVoiceVelocity {
    module_id: String,
    voice: usize,
    value: f32,
    slew: f32,
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  SetMarioChannelCv {
    module_id: String,
    channel: usize,
    value: f32,
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  SetMarioChannelGate {
    module_id: String,
    channel: usize,
    value: f32,
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  Status {
    reply: mpsc::Sender<Result<NativeStatus, String>>,
  },
  // SID/AY Player commands
  LoadSidFile {
    module_id: String,
    data: Vec<u8>,
    reply: mpsc::Sender<Result<(), String>>,
  },
  LoadYmFile {
    module_id: String,
    data: Vec<u8>,
    reply: mpsc::Sender<Result<(), String>>,
  },
  GetSidVoiceStates {
    module_id: String,
    reply: mpsc::Sender<Result<Vec<u16>, String>>,
  },
  GetAyVoiceStates {
    module_id: String,
    reply: mpsc::Sender<Result<Vec<u16>, String>>,
  },
  GetSidElapsed {
    module_id: String,
    reply: mpsc::Sender<Result<f32, String>>,
  },
  GetAyElapsed {
    module_id: String,
    reply: mpsc::Sender<Result<f32, String>>,
  },
  // Sequencer commands
  GetSequencerStep {
    module_id: String,
    reply: mpsc::Sender<Result<i32, String>>,
  },
  GetGolGrid {
    module_id: String,
    reply: mpsc::Sender<Result<GolGridPacket, String>>,
  },
  GetParticlePositions {
    module_id: String,
    reply: mpsc::Sender<Result<Vec<f32>, String>>,
  },
  LoadParticleBuffer {
    module_id: String,
    data: Vec<f32>,
    reply: mpsc::Sender<Result<usize, String>>,
  },
  SeekMidiSequencer {
    module_id: String,
    tick: u32,
    reply: mpsc::Sender<Result<(), String>>,
  },
  // Granular commands
  GetGranularPosition {
    module_id: String,
    reply: mpsc::Sender<Result<f32, String>>,
  },
  LoadGranularBuffer {
    module_id: String,
    data: Vec<f32>,
    reply: mpsc::Sender<Result<usize, String>>,
  },
  // Sampler commands
  LoadSamplerBuffer {
    module_id: String,
    data: Vec<f32>,
    file_sr: f32,
    reply: mpsc::Sender<Result<usize, String>>,
  },
  // Meter
  GetMeterLevel {
    module_id: String,
    reply: mpsc::Sender<Result<u32, String>>,
  },
  GetThereminState {
    module_id: String,
    reply: mpsc::Sender<Result<u32, String>>,
  },
  // Master FX
  SetMasterFxParam {
    param: String,
    value: f32,
    reply: mpsc::Sender<Result<(), String>>,
  },
  // Transport commands
  SetTransportTempo {
    tempo: f32,
    reply: mpsc::Sender<Result<(), String>>,
  },
  ResetTransport {
    reply: mpsc::Sender<Result<(), String>>,
  },
}

const SCOPE_FRAMES: usize = 2048;

#[derive(Default)]
struct ScopeSnapshot {
  frames: usize,
  tap_count: usize,
  sample_rate: u32,
  data: Vec<Vec<f32>>,
  write_index: usize,
  filled: bool,
}

impl ScopeSnapshot {
  fn new(frames: usize) -> Self {
    Self {
      frames,
      tap_count: 0,
      sample_rate: 0,
      data: Vec::new(),
      write_index: 0,
      filled: false,
    }
  }

  fn reset(&mut self) {
    self.tap_count = 0;
    self.data.clear();
    self.write_index = 0;
    self.filled = false;
  }

  fn ensure_taps(&mut self, tap_count: usize) {
    if self.tap_count == tap_count && !self.data.is_empty() {
      return;
    }
    self.tap_count = tap_count;
    self.data = (0..tap_count)
      .map(|_| vec![0.0; self.frames])
      .collect();
    self.write_index = 0;
    self.filled = false;
  }

  fn push(&mut self, tap_slices: &[&[f32]], sample_rate: u32) {
    let tap_count = tap_slices.len();
    if tap_count == 0 {
      return;
    }
    self.sample_rate = sample_rate;
    self.ensure_taps(tap_count);
    let block_frames = tap_slices[0].len();
    if block_frames == 0 {
      return;
    }

    if block_frames >= self.frames {
      let start = block_frames - self.frames;
      for (tap_index, slice) in tap_slices.iter().enumerate() {
        self.data[tap_index].copy_from_slice(&slice[start..start + self.frames]);
      }
      self.write_index = 0;
      self.filled = true;
      return;
    }

    for i in 0..block_frames {
      let idx = (self.write_index + i) % self.frames;
      for (tap_index, slice) in tap_slices.iter().enumerate() {
        self.data[tap_index][idx] = slice[i];
      }
    }

    let end_index = self.write_index + block_frames;
    if !self.filled && end_index >= self.frames {
      self.filled = true;
    }
    self.write_index = end_index % self.frames;
  }

  fn export(&self) -> Option<ScopePacket> {
    if self.tap_count == 0 {
      return None;
    }
    let mut data = Vec::with_capacity(self.tap_count);
    for tap in 0..self.tap_count {
      let mut ordered = vec![0.0; self.frames];
      if self.filled {
        let head = &self.data[tap][self.write_index..];
        let tail = &self.data[tap][..self.write_index];
        ordered[..head.len()].copy_from_slice(head);
        ordered[head.len()..].copy_from_slice(tail);
      } else {
        ordered.copy_from_slice(&self.data[tap]);
      }
      data.push(ordered);
    }
    Some(ScopePacket {
      sample_rate: self.sample_rate,
      frames: self.frames,
      tap_count: self.tap_count,
      data,
    })
  }
}

struct InputRing {
  data: VecDeque<f32>,
  capacity: usize,
}

impl InputRing {
  fn new(capacity: usize) -> Self {
    Self {
      data: VecDeque::with_capacity(capacity),
      capacity,
    }
  }

  fn clear(&mut self) {
    self.data.clear();
  }

  fn push_samples(&mut self, samples: &[f32]) {
    if self.capacity == 0 {
      return;
    }
    for &sample in samples {
      if self.data.len() == self.capacity {
        self.data.pop_front();
      }
      self.data.push_back(sample);
    }
  }

  fn pop_samples(&mut self, output: &mut [f32]) -> bool {
    let mut has_data = false;
    for sample in output.iter_mut() {
      if let Some(value) = self.data.pop_front() {
        *sample = value;
        has_data = true;
      } else {
        *sample = 0.0;
      }
    }
    has_data
  }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScopePacket {
  sample_rate: u32,
  frames: usize,
  tap_count: usize,
  data: Vec<Vec<f32>>,
}

struct AudioThreadState {
  stream: Option<cpal::Stream>,
  input_stream: Option<cpal::Stream>,
  graph: Option<Arc<Mutex<GraphEngine>>>,
  graph_json: Option<String>,
  device_name: Option<String>,
  sample_rate: u32,
  channels: u16,
  input_device_name: Option<String>,
  input_sample_rate: u32,
  input_channels: u16,
  input_error: Option<String>,
  input_buffer: Arc<Mutex<InputRing>>,
  scope: Arc<Mutex<ScopeSnapshot>>,
  cpu_load: Arc<CpuLoadMetrics>,
}

impl AudioThreadState {
  fn new(scope: Arc<Mutex<ScopeSnapshot>>, cpu_load: Arc<CpuLoadMetrics>) -> Self {
    Self {
      stream: None,
      input_stream: None,
      graph: None,
      graph_json: None,
      device_name: None,
      sample_rate: 0,
      channels: 0,
      input_device_name: None,
      input_sample_rate: 0,
      input_channels: 0,
      input_error: None,
      input_buffer: Arc::new(Mutex::new(InputRing::new(0))),
      scope,
      cpu_load,
    }
  }
}

impl AudioThreadState {
  fn status(&self) -> NativeStatus {
    NativeStatus {
      running: self.stream.is_some(),
      device_name: self.device_name.clone(),
      sample_rate: self.sample_rate,
      channels: self.channels,
      input_device_name: self.input_device_name.clone(),
      input_sample_rate: self.input_sample_rate,
      input_channels: self.input_channels,
      input_error: self.input_error.clone(),
    }
  }
}

/// Atomic CPU load tracking for the audio thread (lock-free).
/// Values stored as load × 10 (e.g. 42 = 4.2%).
struct CpuLoadMetrics {
  avg: AtomicU32,
  peak: AtomicU32,
  // accumulator state (only touched from audio callback)
  accum: Mutex<CpuLoadAccum>,
}

struct CpuLoadAccum {
  sum: f64,
  peak: f64,
  count: u32,
  last_report: Instant,
}

impl CpuLoadMetrics {
  fn new() -> Self {
    Self {
      avg: AtomicU32::new(0),
      peak: AtomicU32::new(0),
      accum: Mutex::new(CpuLoadAccum {
        sum: 0.0,
        peak: 0.0,
        count: 0,
        last_report: Instant::now(),
      }),
    }
  }
}

struct NativeAudioState {
  tx: mpsc::Sender<AudioCommand>,
  scope: Arc<Mutex<ScopeSnapshot>>,
  cpu_load: Arc<CpuLoadMetrics>,
}

impl NativeAudioState {
  fn new() -> Self {
    let (tx, rx) = mpsc::channel();
    let scope = Arc::new(Mutex::new(ScopeSnapshot::new(SCOPE_FRAMES)));
    let thread_scope = Arc::clone(&scope);
    let cpu_load = Arc::new(CpuLoadMetrics::new());
    let thread_cpu = Arc::clone(&cpu_load);
    // Build the DSP graph (poly voices, SID 64KB RAM, etc.) on the audio
    // thread, which can use a lot of stack in debug builds — the default ~2 MB
    // thread stack overflows when GraphEngine::new constructs a polyphonic
    // graph. Reserve a large stack (virtual, only committed as used). Mirrors
    // the 8 MB test threads used by the preset integration tests.
    thread::Builder::new()
      .name("noobsynth-audio".to_string())
      .stack_size(64 * 1024 * 1024)
      .spawn(move || audio_thread(rx, thread_scope, thread_cpu))
      .expect("failed to spawn audio thread");
    Self { tx, scope, cpu_load }
  }
}

fn send_audio_command<F>(
  state: &State<NativeAudioState>,
  builder: F,
) -> Result<NativeStatus, String>
where
  F: FnOnce(mpsc::Sender<Result<NativeStatus, String>>) -> AudioCommand,
{
  let (reply_tx, reply_rx) = mpsc::channel();
  let command = builder(reply_tx);
  state
    .tx
    .send(command)
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

fn audio_thread(rx: mpsc::Receiver<AudioCommand>, scope: Arc<Mutex<ScopeSnapshot>>, cpu_load: Arc<CpuLoadMetrics>) {
  let mut state = AudioThreadState::new(scope, cpu_load);
  while let Ok(command) = rx.recv() {
    match command {
      AudioCommand::Start {
        graph_json,
        device_name,
        input_device_name,
        reply,
      } => {
        let result = start_audio(&mut state, graph_json, device_name, input_device_name);
        let _ = reply.send(result);
      }
      AudioCommand::Stop { reply } => {
        let result = stop_audio(&mut state);
        let _ = reply.send(result);
      }
      AudioCommand::SetGraph { graph_json, reply } => {
        let result = set_graph(&mut state, graph_json);
        let _ = reply.send(result);
      }
      AudioCommand::SetGraphFresh { graph_json, reply } => {
        let result = set_graph_fresh(&mut state, graph_json);
        let _ = reply.send(result);
      }
      AudioCommand::SetParam {
        module_id,
        param_id,
        value,
        reply,
      } => {
        let result = with_graph_mut(&mut state, |engine| {
          engine.set_param(&module_id, &param_id, value);
        });
        let _ = reply.send(result.map(|_| state.status()));
      }
      AudioCommand::SetParamString {
        module_id,
        param_id,
        value,
        reply,
      } => {
        let result = with_graph_mut(&mut state, |engine| {
          engine.set_param_string(&module_id, &param_id, &value);
        });
        let _ = reply.send(result.map(|_| state.status()));
      }
      AudioCommand::SetControlVoiceCv {
        module_id,
        voice,
        value,
        reply,
      } => {
        let result = with_graph_mut(&mut state, |engine| {
          engine.set_control_voice_cv(&module_id, voice, value);
        });
        let _ = reply.send(result.map(|_| state.status()));
      }
      AudioCommand::SetControlVoiceGate {
        module_id,
        voice,
        value,
        reply,
      } => {
        let result = with_graph_mut(&mut state, |engine| {
          engine.set_control_voice_gate(&module_id, voice, value);
        });
        let _ = reply.send(result.map(|_| state.status()));
      }
      AudioCommand::TriggerControlVoiceGate {
        module_id,
        voice,
        reply,
      } => {
        let result = with_graph_mut(&mut state, |engine| {
          engine.trigger_control_voice_gate(&module_id, voice);
        });
        let _ = reply.send(result.map(|_| state.status()));
      }
      AudioCommand::TriggerControlVoiceSync {
        module_id,
        voice,
        reply,
      } => {
        let result = with_graph_mut(&mut state, |engine| {
          engine.trigger_control_voice_sync(&module_id, voice);
        });
        let _ = reply.send(result.map(|_| state.status()));
      }
      AudioCommand::SetControlVoiceVelocity {
        module_id,
        voice,
        value,
        slew,
        reply,
      } => {
        let result = with_graph_mut(&mut state, |engine| {
          engine.set_control_voice_velocity(&module_id, voice, value, slew);
        });
        let _ = reply.send(result.map(|_| state.status()));
      }
      AudioCommand::SetMarioChannelCv {
        module_id,
        channel,
        value,
        reply,
      } => {
        let result = with_graph_mut(&mut state, |engine| {
          engine.set_mario_channel_cv(&module_id, channel, value);
        });
        let _ = reply.send(result.map(|_| state.status()));
      }
      AudioCommand::SetMarioChannelGate {
        module_id,
        channel,
        value,
        reply,
      } => {
        let result = with_graph_mut(&mut state, |engine| {
          engine.set_mario_channel_gate(&module_id, channel, value);
        });
        let _ = reply.send(result.map(|_| state.status()));
      }
      AudioCommand::Status { reply } => {
        let _ = reply.send(Ok(state.status()));
      }
      // SID/AY Player commands
      AudioCommand::LoadSidFile {
        module_id,
        data,
        reply,
      } => {
        let result = with_graph_mut(&mut state, |engine| {
          engine.load_sid_file(&module_id, &data);
        });
        let _ = reply.send(result);
      }
      AudioCommand::LoadYmFile {
        module_id,
        data,
        reply,
      } => {
        let result = with_graph_mut(&mut state, |engine| {
          engine.load_ym_file(&module_id, &data);
        });
        let _ = reply.send(result);
      }
      AudioCommand::GetSidVoiceStates { module_id, reply } => {
        let result = if let Some(graph) = &state.graph {
          match graph.lock() {
            Ok(engine) => Ok(engine.get_sid_voice_states(&module_id)),
            Err(_) => Err("graph engine unavailable".to_string()),
          }
        } else {
          Ok(vec![0; 9])
        };
        let _ = reply.send(result);
      }
      AudioCommand::GetAyVoiceStates { module_id, reply } => {
        let result = if let Some(graph) = &state.graph {
          match graph.lock() {
            Ok(engine) => Ok(engine.get_ay_voice_states(&module_id)),
            Err(_) => Err("graph engine unavailable".to_string()),
          }
        } else {
          Ok(vec![0; 9])
        };
        let _ = reply.send(result);
      }
      AudioCommand::GetSidElapsed { module_id, reply } => {
        let result = if let Some(graph) = &state.graph {
          match graph.lock() {
            Ok(engine) => Ok(engine.get_sid_elapsed(&module_id)),
            Err(_) => Err("graph engine unavailable".to_string()),
          }
        } else {
          Ok(0.0)
        };
        let _ = reply.send(result);
      }
      AudioCommand::GetAyElapsed { module_id, reply } => {
        let result = if let Some(graph) = &state.graph {
          match graph.lock() {
            Ok(engine) => Ok(engine.get_ay_elapsed(&module_id)),
            Err(_) => Err("graph engine unavailable".to_string()),
          }
        } else {
          Ok(0.0)
        };
        let _ = reply.send(result);
      }
      // Sequencer commands
      AudioCommand::GetSequencerStep { module_id, reply } => {
        let result = if let Some(graph) = &state.graph {
          match graph.lock() {
            Ok(engine) => Ok(engine.get_sequencer_step(&module_id)),
            Err(_) => Err("graph engine unavailable".to_string()),
          }
        } else {
          Ok(-1)
        };
        let _ = reply.send(result);
      }
      AudioCommand::GetGolGrid { module_id, reply } => {
        let result = if let Some(graph) = &state.graph {
          match graph.lock() {
            Ok(engine) => Ok(GolGridPacket {
              grid: engine.get_gol_grid(&module_id),
              step: engine.get_sequencer_step(&module_id),
            }),
            Err(_) => Err("graph engine unavailable".to_string()),
          }
        } else {
          Ok(GolGridPacket { grid: Vec::new(), step: -1 })
        };
        let _ = reply.send(result);
      }
      AudioCommand::GetParticlePositions { module_id, reply } => {
        let result = if let Some(graph) = &state.graph {
          match graph.lock() {
            Ok(engine) => Ok(engine.get_particle_positions(&module_id)),
            Err(_) => Err("graph engine unavailable".to_string()),
          }
        } else {
          Ok(Vec::new())
        };
        let _ = reply.send(result);
      }
      AudioCommand::LoadParticleBuffer { module_id, data, reply } => {
        let len = data.len();
        let result = with_graph_mut(&mut state, |engine| {
          engine.load_particle_buffer(&module_id, &data);
        })
        .map(|_| len);
        let _ = reply.send(result);
      }
      AudioCommand::SeekMidiSequencer { module_id, tick, reply } => {
        let result = with_graph_mut(&mut state, |engine| {
          engine.seek_midi_sequencer(&module_id, tick);
        });
        let _ = reply.send(result);
      }
      // Granular commands
      AudioCommand::GetGranularPosition { module_id, reply } => {
        let result = if let Some(graph) = &state.graph {
          match graph.lock() {
            Ok(engine) => Ok(engine.get_granular_position(&module_id)),
            Err(_) => Err("graph engine unavailable".to_string()),
          }
        } else {
          Ok(0.0)
        };
        let _ = reply.send(result);
      }
      AudioCommand::LoadGranularBuffer { module_id, data, reply } => {
        let result = if let Some(graph) = &state.graph {
          match graph.lock() {
            Ok(mut engine) => {
              engine.load_granular_buffer(&module_id, &data);
              Ok(engine.get_granular_buffer_length(&module_id))
            }
            Err(_) => Err("graph engine unavailable".to_string()),
          }
        } else {
          Err("no graph".to_string())
        };
        let _ = reply.send(result);
      }
      AudioCommand::LoadSamplerBuffer { module_id, data, file_sr, reply } => {
        let result = if let Some(graph) = &state.graph {
          match graph.lock() {
            Ok(mut engine) => {
              engine.load_sampler_buffer(&module_id, &data, file_sr);
              Ok(engine.get_sampler_buffer_length(&module_id))
            }
            Err(_) => Err("graph engine unavailable".to_string()),
          }
        } else {
          Err("no graph".to_string())
        };
        let _ = reply.send(result);
      }
      AudioCommand::GetMeterLevel { module_id, reply } => {
        let result = if let Some(graph) = &state.graph {
          match graph.lock() {
            Ok(engine) => Ok(engine.get_meter_level(&module_id)),
            Err(_) => Err("graph engine unavailable".to_string()),
          }
        } else {
          Ok(0)
        };
        let _ = reply.send(result);
      }
      AudioCommand::GetThereminState { module_id, reply } => {
        let result = if let Some(graph) = &state.graph {
          match graph.lock() {
            Ok(engine) => Ok(engine.get_theremin_state(&module_id)),
            Err(_) => Err("graph engine unavailable".to_string()),
          }
        } else {
          Ok(0)
        };
        let _ = reply.send(result);
      }
      AudioCommand::SetMasterFxParam { param, value, reply } => {
        if let Some(graph) = &state.graph {
          if let Ok(mut engine) = graph.lock() {
            engine.set_master_fx_param(&param, value);
          }
        }
        let _ = reply.send(Ok(()));
      }
      AudioCommand::SetTransportTempo { tempo, reply } => {
        if let Some(graph) = &state.graph {
          if let Ok(mut engine) = graph.lock() {
            engine.set_transport_tempo(tempo);
          }
        }
        let _ = reply.send(Ok(()));
      }
      AudioCommand::ResetTransport { reply } => {
        if let Some(graph) = &state.graph {
          if let Ok(mut engine) = graph.lock() {
            engine.reset_transport();
          }
        }
        let _ = reply.send(Ok(()));
      }
    }
  }
}

fn start_audio(
  state: &mut AudioThreadState,
  graph_json: Option<String>,
  device_name: Option<String>,
  input_device_name: Option<String>,
) -> Result<NativeStatus, String> {
  if state.stream.is_some() {
    return Ok(state.status());
  }

  if let Some(payload) = graph_json {
    state.graph_json = Some(payload);
  }
  let graph_payload = state
    .graph_json
    .clone()
    .ok_or_else(|| "graph JSON required".to_string())?;

  let output_device = find_output_device(device_name.as_deref())?;
  let output_default_config = output_device
    .default_output_config()
    .map_err(|err| err.to_string())?;
  let output_default_rate = output_default_config.sample_rate().0;
  let mut output_config = output_default_config;
  let mut input_device: Option<cpal::Device> = None;
  let mut input_config: Option<cpal::SupportedStreamConfig> = None;
  let mut input_error: Option<String> = None;

  if let Some(input_name) = input_device_name.as_deref() {
    match find_input_device(Some(input_name)) {
      Ok(device) => {
        let input_default_rate = device
          .default_input_config()
          .map(|cfg| cfg.sample_rate().0)
          .unwrap_or(output_default_rate);
        let mut candidate_rates = Vec::new();
        push_rate(&mut candidate_rates, output_default_rate);
        push_rate(&mut candidate_rates, input_default_rate);
        for rate in [48_000, 44_100, 96_000, 88_200, 32_000, 22_050] {
          push_rate(&mut candidate_rates, rate);
        }

        match find_common_config(&output_device, &device, &candidate_rates) {
          Ok(Some((matched_output, matched_input))) => {
            output_config = matched_output;
            input_device = Some(device);
            input_config = Some(matched_input);
          }
          Ok(None) => {
            input_error = Some("No common sample rate between input and output.".to_string());
          }
          Err(err) => {
            input_error = Some(err);
          }
        }
      }
      Err(err) => {
        input_error = Some(format!("Input device error: {err}"));
      }
    }
  }

  let sample_rate = output_config.sample_rate().0;
  let channels = output_config.channels();
  let stream_config = output_config.clone().into();
  let input_buffer = Arc::new(Mutex::new(InputRing::new(sample_rate as usize)));

  let mut input_stream: Option<cpal::Stream> = None;
  let mut input_device_name_actual: Option<String> = None;
  let mut input_sample_rate = 0;
  let mut input_channels = 0;

  if let (Some(device), Some(config)) = (input_device, input_config) {
    let input_stream_config = config.clone().into();
    let stream_result = match config.sample_format() {
      SampleFormat::F32 => build_input_stream::<f32>(&device, &input_stream_config, input_buffer.clone()),
      SampleFormat::I16 => build_input_stream::<i16>(&device, &input_stream_config, input_buffer.clone()),
      SampleFormat::U16 => build_input_stream::<u16>(&device, &input_stream_config, input_buffer.clone()),
      sample_format => Err(format!("Unsupported input sample format '{sample_format:?}'")),
    };
    match stream_result {
      Ok(stream) => {
        if let Err(err) = stream.play() {
          input_error = Some(format!("Input stream start error: {err}"));
        } else {
          input_device_name_actual = device.name().ok().or(input_device_name.clone());
          input_sample_rate = config.sample_rate().0;
          input_channels = config.channels();
          input_stream = Some(stream);
        }
      }
      Err(err) => {
        input_error = Some(format!("Input stream error: {err}"));
      }
    }
  }

  let mut engine = GraphEngine::new(sample_rate as f32);
  engine.set_graph_json(&graph_payload)?;
  let graph = Arc::new(Mutex::new(engine));
  let scope = Arc::clone(&state.scope);
  let cpu_load = Arc::clone(&state.cpu_load);
  let stream = match output_config.sample_format() {
    SampleFormat::F32 => {
      build_graph_stream::<f32>(
        &output_device,
        &stream_config,
        graph.clone(),
        scope,
        sample_rate,
        input_buffer.clone(),
        cpu_load,
      )?
    }
    SampleFormat::I16 => {
      build_graph_stream::<i16>(
        &output_device,
        &stream_config,
        graph.clone(),
        scope,
        sample_rate,
        input_buffer.clone(),
        cpu_load,
      )?
    }
    SampleFormat::U16 => {
      build_graph_stream::<u16>(
        &output_device,
        &stream_config,
        graph.clone(),
        scope,
        sample_rate,
        input_buffer.clone(),
        cpu_load,
      )?
    }
    sample_format => {
      return Err(format!("Unsupported sample format '{sample_format:?}'"))
    }
  };

  stream.play().map_err(|err| err.to_string())?;

  state.stream = Some(stream);
  state.input_stream = input_stream;
  state.graph = Some(graph);
  state.device_name = output_device.name().ok().or(device_name);
  state.sample_rate = sample_rate;
  state.channels = channels;
  state.input_device_name = input_device_name_actual;
  state.input_sample_rate = input_sample_rate;
  state.input_channels = input_channels;
  state.input_error = input_error;
  state.input_buffer = input_buffer;

  Ok(state.status())
}

fn stop_audio(state: &mut AudioThreadState) -> Result<NativeStatus, String> {
  state.stream = None;
  state.input_stream = None;
  state.graph = None;
  state.input_device_name = None;
  state.input_sample_rate = 0;
  state.input_channels = 0;
  state.input_error = None;
  if let Ok(mut buffer) = state.input_buffer.lock() {
    buffer.clear();
  }
  if let Ok(mut scope) = state.scope.lock() {
    scope.reset();
  }
  Ok(state.status())
}

fn with_graph_mut<F>(state: &mut AudioThreadState, f: F) -> Result<(), String>
where
  F: FnOnce(&mut GraphEngine),
{
  if let Some(graph) = &state.graph {
    let mut engine = graph.lock().map_err(|_| "graph engine unavailable")?;
    f(&mut engine);
  }
  Ok(())
}

fn set_graph(state: &mut AudioThreadState, graph_json: String) -> Result<NativeStatus, String> {
  state.graph_json = Some(graph_json.clone());
  if let Some(graph) = &state.graph {
    let mut engine = graph.lock().map_err(|_| "graph engine unavailable")?;
    engine.set_graph_json(&graph_json)?;
  }
  Ok(state.status())
}

fn set_graph_fresh(state: &mut AudioThreadState, graph_json: String) -> Result<NativeStatus, String> {
  state.graph_json = Some(graph_json.clone());
  if let Some(graph) = &state.graph {
    let mut engine = graph.lock().map_err(|_| "graph engine unavailable")?;
    engine.set_graph_json_fresh(&graph_json)?;
  }
  Ok(state.status())
}

fn find_output_device(name: Option<&str>) -> Result<cpal::Device, String> {
  let host = cpal::default_host();
  if let Some(name) = name {
    let devices = host.output_devices().map_err(|err| err.to_string())?;
    for device in devices {
      let device_name = device.name().unwrap_or_default();
      if device_name == name {
        return Ok(device);
      }
    }
  }
  host
    .default_output_device()
    .ok_or_else(|| "no default output device".to_string())
}

fn find_input_device(name: Option<&str>) -> Result<cpal::Device, String> {
  let host = cpal::default_host();
  if let Some(name) = name {
    let devices = host.input_devices().map_err(|err| err.to_string())?;
    for device in devices {
      let device_name = device.name().unwrap_or_default();
      if device_name == name {
        return Ok(device);
      }
    }
  }
  host
    .default_input_device()
    .ok_or_else(|| "no default input device".to_string())
}

fn is_supported_sample_format(format: SampleFormat) -> bool {
  matches!(format, SampleFormat::F32 | SampleFormat::I16 | SampleFormat::U16)
}

fn push_rate(rates: &mut Vec<u32>, rate: u32) {
  if rate == 0 {
    return;
  }
  if !rates.contains(&rate) {
    rates.push(rate);
  }
}

fn config_for_rate(
  configs: &[cpal::SupportedStreamConfigRange],
  rate: u32,
) -> Option<cpal::SupportedStreamConfig> {
  let target = cpal::SampleRate(rate);
  for config in configs {
    if config.min_sample_rate().0 <= rate && config.max_sample_rate().0 >= rate {
      if is_supported_sample_format(config.sample_format()) {
        return Some(config.with_sample_rate(target));
      }
    }
  }
  None
}

fn find_common_config(
  output_device: &cpal::Device,
  input_device: &cpal::Device,
  candidate_rates: &[u32],
) -> Result<Option<(cpal::SupportedStreamConfig, cpal::SupportedStreamConfig)>, String> {
  let output_configs: Vec<_> = output_device
    .supported_output_configs()
    .map_err(|err| err.to_string())?
    .collect();
  let input_configs: Vec<_> = input_device
    .supported_input_configs()
    .map_err(|err| err.to_string())?
    .collect();
  for &rate in candidate_rates {
    let output_config = config_for_rate(&output_configs, rate);
    let input_config = config_for_rate(&input_configs, rate);
    if let (Some(output_config), Some(input_config)) = (output_config, input_config) {
      return Ok(Some((output_config, input_config)));
    }
  }
  Ok(None)
}

fn push_input_samples<T>(data: &[T], channels: usize, input_buffer: &Arc<Mutex<InputRing>>)
where
  T: Sample,
  f32: FromSample<T>,
{
  if channels == 0 {
    return;
  }
  let mut mono = Vec::with_capacity(data.len() / channels);
  for frame in data.chunks(channels) {
    let mut sum = 0.0;
    for sample in frame {
      sum += f32::from_sample(*sample);
    }
    mono.push(sum / frame.len().max(1) as f32);
  }
  if let Ok(mut buffer) = input_buffer.lock() {
    buffer.push_samples(&mono);
  }
}

fn write_graph_output<T>(
  output: &mut [T],
  channels: usize,
  graph: &Arc<Mutex<GraphEngine>>,
  scope: &Arc<Mutex<ScopeSnapshot>>,
  sample_rate: u32,
  input_buffer: &Arc<Mutex<InputRing>>,
  cpu_load: &Arc<CpuLoadMetrics>,
) where
  T: Sample + FromSample<f32>,
{
  if channels == 0 {
    return;
  }
  let frames = output.len() / channels;
  if frames == 0 {
    return;
  }

  if let Ok(mut engine) = graph.try_lock() {
    let mut input_block = vec![0.0_f32; frames];
    let mut has_input = false;
    let mut locked = false;
    if let Ok(mut buffer) = input_buffer.try_lock() {
      locked = true;
      has_input = buffer.pop_samples(&mut input_block);
    }
    if has_input {
      engine.set_external_input(&input_block);
    } else if locked {
      engine.clear_external_input();
    }
    let t0 = Instant::now();
    let data = engine.render(frames);
    let elapsed_us = t0.elapsed().as_micros() as f64;
    let budget_us = (frames as f64 / sample_rate as f64) * 1_000_000.0;
    let load = if budget_us > 0.0 { elapsed_us / budget_us * 100.0 } else { 0.0 };
    if let Ok(mut acc) = cpu_load.accum.try_lock() {
      acc.sum += load;
      if load > acc.peak { acc.peak = load; }
      acc.count += 1;
      if acc.last_report.elapsed().as_millis() >= 500 {
        let avg = if acc.count > 0 { acc.sum / acc.count as f64 } else { 0.0 };
        cpu_load.avg.store((avg * 10.0) as u32, Ordering::Relaxed);
        cpu_load.peak.store((acc.peak * 10.0) as u32, Ordering::Relaxed);
        acc.sum = 0.0;
        acc.peak = 0.0;
        acc.count = 0;
        acc.last_report = Instant::now();
      }
    }

    let left = &data[0..frames];
    let right = if data.len() >= frames * 2 {
      &data[frames..frames * 2]
    } else {
      left
    };

    for (frame_index, frame) in output.chunks_mut(channels).enumerate() {
      let l = left[frame_index];
      let r = right[frame_index];
      for (channel_index, sample) in frame.iter_mut().enumerate() {
        let value = if channel_index == 0 { l } else if channel_index == 1 { r } else { l };
        *sample = T::from_sample(value);
      }
    }

    let tap_count = data.len() / frames;
    if tap_count > 2 {
      let taps = tap_count - 2;
      let mut tap_slices = Vec::with_capacity(taps);
      for tap_index in 0..taps {
        let start = (2 + tap_index) * frames;
        let end = start + frames;
        tap_slices.push(&data[start..end]);
      }
      if let Ok(mut snapshot) = scope.try_lock() {
        snapshot.push(&tap_slices, sample_rate);
      }
    }
  } else {
    for sample in output.iter_mut() {
      *sample = T::EQUILIBRIUM;
    }
  }
}

fn build_graph_stream<T: Sample + FromSample<f32> + cpal::SizedSample>(
  device: &cpal::Device,
  config: &StreamConfig,
  graph: Arc<Mutex<GraphEngine>>,
  scope: Arc<Mutex<ScopeSnapshot>>,
  sample_rate: u32,
  input_buffer: Arc<Mutex<InputRing>>,
  cpu_load: Arc<CpuLoadMetrics>,
) -> Result<cpal::Stream, String> {
  let channels = config.channels as usize;
  let err_fn = |err| eprintln!("audio stream error: {err}");
  device
    .build_output_stream(
      config,
      move |data: &mut [T], _| {
        write_graph_output(data, channels, &graph, &scope, sample_rate, &input_buffer, &cpu_load)
      },
      err_fn,
      None,
    )
    .map_err(|err| err.to_string())
}

fn build_input_stream<T>(
  device: &cpal::Device,
  config: &StreamConfig,
  input_buffer: Arc<Mutex<InputRing>>,
) -> Result<cpal::Stream, String>
where
  T: Sample + cpal::SizedSample,
  f32: FromSample<T>,
{
  let channels = config.channels as usize;
  let err_fn = |err| eprintln!("input stream error: {err}");
  device
    .build_input_stream(
      config,
      move |data: &[T], _| push_input_samples(data, channels, &input_buffer),
      err_fn,
      None,
    )
    .map_err(|err| err.to_string())
}

#[tauri::command]
fn dsp_ping() -> String {
  let mut osc = SineOsc::new(220.0);
  osc.reset(48_000.0);
  let mut buffer = [0.0_f32; 8];
  osc.process(&mut buffer);
  format!("dsp-core ok: {:.3}", buffer[0])
}

#[tauri::command]
fn list_audio_outputs() -> Result<Vec<String>, String> {
  let host = cpal::default_host();
  let devices = host.output_devices().map_err(|err| err.to_string())?;
  let mut names = Vec::new();
  for device in devices {
    let name = device.name().unwrap_or_else(|_| "Unknown Output".to_string());
    names.push(name);
  }
  Ok(names)
}

#[tauri::command]
fn list_audio_inputs() -> Result<Vec<String>, String> {
  let host = cpal::default_host();
  let devices = host.input_devices().map_err(|err| err.to_string())?;
  let mut names = Vec::new();
  for device in devices {
    let name = device.name().unwrap_or_else(|_| "Unknown Input".to_string());
    names.push(name);
  }
  Ok(names)
}

#[tauri::command]
fn list_midi_inputs() -> Result<Vec<String>, String> {
  let midi_in = MidiInput::new("noobsynth3-tauri").map_err(|err| err.to_string())?;
  let mut names = Vec::new();
  for port in midi_in.ports() {
    let name = midi_in.port_name(&port).unwrap_or_else(|_| "Unknown Input".to_string());
    names.push(name);
  }
  Ok(names)
}

#[tauri::command]
fn native_set_graph(state: State<NativeAudioState>, graph_json: String) -> Result<(), String> {
  send_audio_command(&state, |reply| AudioCommand::SetGraph { graph_json, reply }).map(|_| ())
}

#[tauri::command]
fn native_set_graph_fresh(state: State<NativeAudioState>, graph_json: String) -> Result<(), String> {
  send_audio_command(&state, |reply| AudioCommand::SetGraphFresh { graph_json, reply }).map(|_| ())
}

#[tauri::command]
fn native_set_param(
  state: State<NativeAudioState>,
  module_id: String,
  param_id: String,
  value: f32,
) -> Result<(), String> {
  send_audio_command(&state, |reply| AudioCommand::SetParam {
    module_id,
    param_id,
    value,
    reply,
  })
  .map(|_| ())
}

#[tauri::command]
fn native_set_param_string(
  state: State<NativeAudioState>,
  module_id: String,
  param_id: String,
  value: String,
) -> Result<(), String> {
  send_audio_command(&state, |reply| AudioCommand::SetParamString {
    module_id,
    param_id,
    value,
    reply,
  })
  .map(|_| ())
}

#[tauri::command]
fn native_set_control_voice_cv(
  state: State<NativeAudioState>,
  module_id: String,
  voice: usize,
  value: f32,
) -> Result<(), String> {
  send_audio_command(&state, |reply| AudioCommand::SetControlVoiceCv {
    module_id,
    voice,
    value,
    reply,
  })
  .map(|_| ())
}

#[tauri::command]
fn native_set_control_voice_gate(
  state: State<NativeAudioState>,
  module_id: String,
  voice: usize,
  value: f32,
) -> Result<(), String> {
  send_audio_command(&state, |reply| AudioCommand::SetControlVoiceGate {
    module_id,
    voice,
    value,
    reply,
  })
  .map(|_| ())
}

#[tauri::command]
fn native_trigger_control_voice_gate(
  state: State<NativeAudioState>,
  module_id: String,
  voice: usize,
) -> Result<(), String> {
  send_audio_command(&state, |reply| AudioCommand::TriggerControlVoiceGate {
    module_id,
    voice,
    reply,
  })
  .map(|_| ())
}

#[tauri::command]
fn native_trigger_control_voice_sync(
  state: State<NativeAudioState>,
  module_id: String,
  voice: usize,
) -> Result<(), String> {
  send_audio_command(&state, |reply| AudioCommand::TriggerControlVoiceSync {
    module_id,
    voice,
    reply,
  })
  .map(|_| ())
}

#[tauri::command]
fn native_set_control_voice_velocity(
  state: State<NativeAudioState>,
  module_id: String,
  voice: usize,
  value: f32,
  slew: f32,
) -> Result<(), String> {
  send_audio_command(&state, |reply| AudioCommand::SetControlVoiceVelocity {
    module_id,
    voice,
    value,
    slew,
    reply,
  })
  .map(|_| ())
}

#[tauri::command]
fn native_set_mario_channel_cv(
  state: State<NativeAudioState>,
  module_id: String,
  channel: usize,
  value: f32,
) -> Result<(), String> {
  send_audio_command(&state, |reply| AudioCommand::SetMarioChannelCv {
    module_id,
    channel,
    value,
    reply,
  })
  .map(|_| ())
}

#[tauri::command]
fn native_set_mario_channel_gate(
  state: State<NativeAudioState>,
  module_id: String,
  channel: usize,
  value: f32,
) -> Result<(), String> {
  send_audio_command(&state, |reply| AudioCommand::SetMarioChannelGate {
    module_id,
    channel,
    value,
    reply,
  })
  .map(|_| ())
}

#[tauri::command]
fn native_start_graph(
  state: State<NativeAudioState>,
  graph_json: Option<String>,
  device_name: Option<String>,
  input_device_name: Option<String>,
) -> Result<NativeStatus, String> {
  send_audio_command(&state, |reply| AudioCommand::Start {
    graph_json,
    device_name,
    input_device_name,
    reply,
  })
}

#[tauri::command]
fn native_stop_graph(state: State<NativeAudioState>) -> Result<NativeStatus, String> {
  send_audio_command(&state, |reply| AudioCommand::Stop { reply })
}

#[tauri::command]
fn native_status(state: State<NativeAudioState>) -> Result<NativeStatus, String> {
  send_audio_command(&state, |reply| AudioCommand::Status { reply })
}

#[tauri::command]
fn native_get_scope(state: State<NativeAudioState>) -> Result<ScopePacket, String> {
  let scope = state.scope.lock().map_err(|_| "scope unavailable")?;
  scope.export().ok_or_else(|| "scope not ready".to_string())
}

#[derive(Serialize)]
struct CpuLoadPacket {
  avg: f64,
  peak: f64,
}

#[tauri::command]
fn native_get_cpu_load(state: State<NativeAudioState>) -> CpuLoadPacket {
  let avg = state.cpu_load.avg.load(Ordering::Relaxed) as f64 / 10.0;
  let peak = state.cpu_load.peak.load(Ordering::Relaxed) as f64 / 10.0;
  CpuLoadPacket { avg, peak }
}

// ============================================================================
// SID/AY Player Support
// ============================================================================

#[tauri::command]
fn native_load_sid_file(
  state: State<NativeAudioState>,
  module_id: String,
  data: Vec<u8>,
) -> Result<(), String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::LoadSidFile {
      module_id,
      data,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_load_ym_file(
  state: State<NativeAudioState>,
  module_id: String,
  data: Vec<u8>,
) -> Result<(), String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::LoadYmFile {
      module_id,
      data,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_get_sid_voice_states(
  state: State<NativeAudioState>,
  module_id: String,
) -> Result<Vec<u16>, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::GetSidVoiceStates {
      module_id,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_get_ay_voice_states(
  state: State<NativeAudioState>,
  module_id: String,
) -> Result<Vec<u16>, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::GetAyVoiceStates {
      module_id,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_get_sid_elapsed(
  state: State<NativeAudioState>,
  module_id: String,
) -> Result<f32, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::GetSidElapsed {
      module_id,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_get_ay_elapsed(
  state: State<NativeAudioState>,
  module_id: String,
) -> Result<f32, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::GetAyElapsed {
      module_id,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_get_sequencer_step(
  state: State<NativeAudioState>,
  module_id: String,
) -> Result<i32, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::GetSequencerStep {
      module_id,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GolGridPacket {
  grid: Vec<u16>,
  step: i32,
}

#[tauri::command]
fn native_get_gol_grid(
  state: State<NativeAudioState>,
  module_id: String,
) -> Result<GolGridPacket, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::GetGolGrid {
      module_id,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_get_particle_positions(
  state: State<NativeAudioState>,
  module_id: String,
) -> Result<Vec<f32>, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::GetParticlePositions {
      module_id,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_load_particle_buffer(
  state: State<NativeAudioState>,
  module_id: String,
  data: Vec<f32>,
) -> Result<usize, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::LoadParticleBuffer {
      module_id,
      data,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_seek_midi_sequencer(
  state: State<NativeAudioState>,
  module_id: String,
  tick: u32,
) -> Result<(), String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::SeekMidiSequencer {
      module_id,
      tick,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_get_granular_position(
  state: State<NativeAudioState>,
  module_id: String,
) -> Result<f32, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::GetGranularPosition {
      module_id,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_load_granular_buffer(
  state: State<NativeAudioState>,
  module_id: String,
  data: Vec<f32>,
) -> Result<usize, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::LoadGranularBuffer {
      module_id,
      data,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_load_sampler_buffer(
  state: State<NativeAudioState>,
  module_id: String,
  data: Vec<f32>,
  file_sr: f32,
) -> Result<usize, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::LoadSamplerBuffer {
      module_id,
      data,
      file_sr,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_get_meter_level(
  state: State<NativeAudioState>,
  module_id: String,
) -> Result<u32, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::GetMeterLevel {
      module_id,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_get_theremin_state(
  state: State<NativeAudioState>,
  module_id: String,
) -> Result<u32, String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::GetThereminState {
      module_id,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_set_master_fx_param(
  state: State<NativeAudioState>,
  param: String,
  value: f32,
) -> Result<(), String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::SetMasterFxParam {
      param,
      value,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_set_transport_tempo(
  state: State<NativeAudioState>,
  tempo: f32,
) -> Result<(), String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::SetTransportTempo {
      tempo,
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[tauri::command]
fn native_reset_transport(
  state: State<NativeAudioState>,
) -> Result<(), String> {
  let (reply_tx, reply_rx) = mpsc::channel();
  state
    .tx
    .send(AudioCommand::ResetTransport {
      reply: reply_tx,
    })
    .map_err(|_| "native audio thread unavailable".to_string())?;
  reply_rx
    .recv()
    .map_err(|_| "native audio thread unavailable".to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let args: Vec<String> = std::env::args().collect();

  // Log startup info
  eprintln!("[NoobSynth] Starting with args: {:?}", args);

  tauri::Builder::default()
    .manage(NativeAudioState::new())
      .invoke_handler(tauri::generate_handler![
        dsp_ping,
        list_audio_outputs,
        list_audio_inputs,
        list_midi_inputs,
      native_set_graph,
      native_set_graph_fresh,
      native_set_param,
      native_set_param_string,
      native_set_control_voice_cv,
      native_set_control_voice_gate,
      native_trigger_control_voice_gate,
      native_trigger_control_voice_sync,
      native_set_control_voice_velocity,
      native_set_mario_channel_cv,
      native_set_mario_channel_gate,
      native_start_graph,
      native_stop_graph,
      native_status,
      native_get_scope,
      native_get_cpu_load,
      // SID/AY Player commands
      native_load_sid_file,
      native_load_ym_file,
      native_get_sid_voice_states,
      native_get_ay_voice_states,
      native_get_sid_elapsed,
      native_get_ay_elapsed,
      // Sequencer commands
      native_get_sequencer_step,
      native_get_gol_grid,
      native_get_particle_positions,
      native_load_particle_buffer,
      native_seek_midi_sequencer,
      // Granular commands
      native_get_granular_position,
      native_load_granular_buffer,
      native_load_sampler_buffer,
      // Meter
      native_get_meter_level,
      native_get_theremin_state,
      // Master FX
      native_set_master_fx_param,
      // Transport commands
      native_set_transport_tempo,
      native_reset_transport,
    ])
    .setup(move |app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
