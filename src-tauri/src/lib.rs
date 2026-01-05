use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat, StreamConfig};
use dsp_core::{Node, SineOsc};
use dsp_graph::GraphEngine;
use dsp_ipc::{SharedParams, TauriBridge};
use midir::MidiInput;
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use tauri::{Manager, State};

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
}

impl AudioThreadState {
  fn new(scope: Arc<Mutex<ScopeSnapshot>>) -> Self {
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

struct NativeAudioState {
  tx: mpsc::Sender<AudioCommand>,
  scope: Arc<Mutex<ScopeSnapshot>>,
}

impl NativeAudioState {
  fn new() -> Self {
    let (tx, rx) = mpsc::channel();
    let scope = Arc::new(Mutex::new(ScopeSnapshot::new(SCOPE_FRAMES)));
    let thread_scope = Arc::clone(&scope);
    thread::spawn(move || audio_thread(rx, thread_scope));
    Self { tx, scope }
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

fn audio_thread(rx: mpsc::Receiver<AudioCommand>, scope: Arc<Mutex<ScopeSnapshot>>) {
  let mut state = AudioThreadState::new(scope);
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
  let stream = match output_config.sample_format() {
    SampleFormat::F32 => {
      build_graph_stream::<f32>(
        &output_device,
        &stream_config,
        graph.clone(),
        scope,
        sample_rate,
        input_buffer.clone(),
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
    let data = engine.render(frames);
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
) -> Result<cpal::Stream, String> {
  let channels = config.channels as usize;
  let err_fn = |err| eprintln!("audio stream error: {err}");
  device
    .build_output_stream(
      config,
      move |data: &mut [T], _| {
        write_graph_output(data, channels, &graph, &scope, sample_rate, &input_buffer)
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

// ============================================================================
// VST Mode Support
// ============================================================================

/// State for VST bridge connection
struct VstBridgeState {
  bridge: Mutex<Option<TauriBridge>>,
  last_vst_graph_version: Mutex<u64>,
  last_vst_param_version: Mutex<u64>,
  instance_id: Option<String>,
}

impl VstBridgeState {
  fn new(instance_id: Option<String>) -> Self {
    Self {
      bridge: Mutex::new(None),
      last_vst_graph_version: Mutex::new(0),
      last_vst_param_version: Mutex::new(0),
      instance_id,
    }
  }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VstStatus {
  connected: bool,
  vst_connected: bool,
  sample_rate: u32,
}

/// Try to connect to VST shared memory
#[tauri::command]
fn vst_connect(state: State<VstBridgeState>) -> Result<VstStatus, String> {
  let mut bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  let instance_id = state.instance_id.as_deref();

  // If we already have a bridge, return its status
  if let Some(bridge) = bridge_lock.as_ref() {
    return Ok(VstStatus {
      connected: true,
      vst_connected: bridge.is_vst_connected(),
      sample_rate: bridge.sample_rate(),
    });
  }

  // Try to open existing shared memory (VST should have created it)
  match TauriBridge::open_with_id(instance_id) {
    Ok(bridge) => {
      eprintln!("[NoobSynth] VST IPC bridge opened successfully");
      let sample_rate = bridge.sample_rate();
      let vst_connected = bridge.is_vst_connected();
      *bridge_lock = Some(bridge);
      if let Ok(mut last) = state.last_vst_graph_version.lock() {
        *last = 0;
      }
      if let Ok(mut last) = state.last_vst_param_version.lock() {
        *last = 0;
      }
      Ok(VstStatus {
        connected: true,
        vst_connected,
        sample_rate,
      })
    }
    Err(open_err) => {
      eprintln!("[NoobSynth] TauriBridge::open failed: {:?}", open_err);
      // Try to create it (we might be starting before VST)
      match TauriBridge::new_with_id(instance_id) {
        Ok(bridge) => {
          eprintln!("[NoobSynth] VST IPC bridge created successfully");
          let sample_rate = bridge.sample_rate();
          let vst_connected = bridge.is_vst_connected();
          *bridge_lock = Some(bridge);
          if let Ok(mut last) = state.last_vst_graph_version.lock() {
            *last = 0;
          }
          if let Ok(mut last) = state.last_vst_param_version.lock() {
            *last = 0;
          }
          Ok(VstStatus {
            connected: true,
            vst_connected,
            sample_rate,
          })
        }
        Err(create_err) => {
          eprintln!("[NoobSynth] TauriBridge::new failed: {:?}", create_err);
          Err(format!("VST IPC failed - open: {:?}, create: {:?}", open_err, create_err))
        }
      }
    }
  }
}

/// Disconnect from VST
#[tauri::command]
fn vst_disconnect(state: State<VstBridgeState>) -> Result<(), String> {
  let mut bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  *bridge_lock = None;
  if let Ok(mut last) = state.last_vst_graph_version.lock() {
    *last = 0;
  }
  if let Ok(mut last) = state.last_vst_param_version.lock() {
    *last = 0;
  }
  Ok(())
}

/// Get VST connection status
#[tauri::command]
fn vst_status(state: State<VstBridgeState>) -> Result<VstStatus, String> {
  let bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  match &*bridge_lock {
    Some(bridge) => Ok(VstStatus {
      connected: true,
      vst_connected: bridge.is_vst_connected(),
      sample_rate: bridge.sample_rate(),
    }),
    None => Ok(VstStatus {
      connected: false,
      vst_connected: false,
      sample_rate: 0,
    }),
  }
}

/// Set graph via VST
#[tauri::command]
fn vst_set_graph(state: State<VstBridgeState>, graph_json: String) -> Result<(), String> {
  let mut bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  let bridge = bridge_lock.as_mut().ok_or("VST not connected")?;
  bridge.set_graph(&graph_json);
  Ok(())
}

/// Set parameter via VST
#[tauri::command]
fn vst_set_param(
  state: State<VstBridgeState>,
  module_id: String,
  param_id: String,
  value: f32,
) -> Result<(), String> {
  let mut bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  let bridge = bridge_lock.as_mut().ok_or("VST not connected")?;
  bridge.set_param(&module_id, &param_id, value);
  Ok(())
}

/// Fetch the current graph from the VST plugin (if available)
#[tauri::command]
fn vst_pull_graph(state: State<VstBridgeState>) -> Result<Option<String>, String> {
  let bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  let bridge = bridge_lock.as_ref().ok_or("VST not connected")?;
  let current = bridge.vst_graph_version();
  let mut last = state
    .last_vst_graph_version
    .lock()
    .map_err(|_| "lock error")?;
  if current == 0 {
    return Ok(None);
  }
  if current < *last {
    *last = 0;
  }
  if current == *last {
    return Ok(None);
  }
  *last = current;
  Ok(bridge.read_vst_graph())
}

#[tauri::command]
fn vst_set_macros(state: State<VstBridgeState>, macros: Vec<f32>) -> Result<(), String> {
  let mut bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  let bridge = bridge_lock.as_mut().ok_or("VST not connected")?;
  let mut values = [0.0_f32; 8];
  for (index, value) in macros.into_iter().enumerate().take(8) {
    values[index] = value.clamp(0.0, 1.0);
  }
  bridge.set_params(SharedParams {
    macros: values,
    _padding: [0.0; 8],
  });
  Ok(())
}

#[tauri::command]
fn vst_pull_macros(state: State<VstBridgeState>) -> Result<Option<Vec<f32>>, String> {
  let bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  let bridge = bridge_lock.as_ref().ok_or("VST not connected")?;
  let current = bridge.vst_param_version();
  let mut last = state
    .last_vst_param_version
    .lock()
    .map_err(|_| "lock error")?;
  if current == 0 {
    return Ok(None);
  }
  if current < *last {
    *last = 0;
  }
  if current == *last {
    return Ok(None);
  }
  *last = current;
  let params = bridge.params();
  Ok(Some(params.macros.to_vec()))
}

/// Set control voice CV via VST
#[tauri::command]
fn vst_set_control_voice_cv(
  state: State<VstBridgeState>,
  _module_id: String,
  voice: usize,
  value: f32,
) -> Result<(), String> {
  let mut bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  let bridge = bridge_lock.as_mut().ok_or("VST not connected")?;
  bridge.set_voice_cv(voice as u8, value);
  Ok(())
}

/// Trigger gate via VST
#[tauri::command]
fn vst_trigger_control_voice_gate(
  state: State<VstBridgeState>,
  _module_id: String,
  voice: usize,
) -> Result<(), String> {
  let mut bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  let bridge = bridge_lock.as_mut().ok_or("VST not connected")?;
  bridge.trigger_gate(voice as u8);
  Ok(())
}

/// Release gate via VST
#[tauri::command]
fn vst_release_control_voice_gate(
  state: State<VstBridgeState>,
  _module_id: String,
  voice: usize,
) -> Result<(), String> {
  let mut bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  let bridge = bridge_lock.as_mut().ok_or("VST not connected")?;
  bridge.release_gate(voice as u8);
  Ok(())
}

/// Set voice velocity via VST
#[tauri::command]
fn vst_set_control_voice_velocity(
  state: State<VstBridgeState>,
  _module_id: String,
  voice: usize,
  value: f32,
  _slew: f32,
) -> Result<(), String> {
  let mut bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  let bridge = bridge_lock.as_mut().ok_or("VST not connected")?;
  bridge.set_voice_velocity(voice as u8, value);
  Ok(())
}

/// Note on via VST
#[tauri::command]
fn vst_note_on(
  state: State<VstBridgeState>,
  voice: u8,
  note: u8,
  velocity: f32,
) -> Result<(), String> {
  let mut bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  let bridge = bridge_lock.as_mut().ok_or("VST not connected")?;
  bridge.note_on(voice, note, velocity);
  Ok(())
}

/// Note off via VST
#[tauri::command]
fn vst_note_off(
  state: State<VstBridgeState>,
  voice: u8,
  note: u8,
) -> Result<(), String> {
  let mut bridge_lock = state.bridge.lock().map_err(|_| "lock error")?;
  let bridge = bridge_lock.as_mut().ok_or("VST not connected")?;
  bridge.note_off(voice, note);
  Ok(())
}

/// State to track if we're in VST mode
struct VstModeState {
  enabled: bool,
}

/// Check if we're running in VST mode
#[tauri::command]
fn is_vst_mode(state: State<VstModeState>) -> bool {
  state.enabled
}

fn parse_vst_instance_id(args: &[String]) -> Option<String> {
  let mut iter = args.iter().enumerate();
  while let Some((index, arg)) = iter.next() {
    if let Some(value) = arg.strip_prefix("--vst-id=") {
      if !value.is_empty() {
        return Some(value.to_string());
      }
    }
    if arg == "--vst-id" {
      if let Some(next) = args.get(index + 1) {
        if !next.is_empty() && !next.starts_with("--") {
          return Some(next.to_string());
        }
      }
    }
  }
  None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Check for --vst-mode argument
  let args: Vec<String> = std::env::args().collect();
  let vst_mode = args.iter().any(|arg| arg == "--vst-mode");
  let vst_instance_id = parse_vst_instance_id(&args);
  let vst_instance_id_for_setup = vst_instance_id.clone();
  let vst_instance_id_for_window = vst_instance_id.clone();

  // Log startup info
  eprintln!("[NoobSynth] Starting with args: {:?}", args);
  eprintln!("[NoobSynth] VST mode: {}", vst_mode);

  tauri::Builder::default()
    .manage(NativeAudioState::new())
    .manage(VstBridgeState::new(vst_instance_id.clone()))
    .manage(VstModeState { enabled: vst_mode })
      .invoke_handler(tauri::generate_handler![
        dsp_ping,
        list_audio_outputs,
        list_audio_inputs,
        list_midi_inputs,
      native_set_graph,
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
      // VST mode commands
      is_vst_mode,
      vst_connect,
      vst_disconnect,
      vst_status,
      vst_set_graph,
      vst_set_param,
      vst_pull_graph,
      vst_set_macros,
      vst_pull_macros,
      vst_set_control_voice_cv,
      vst_trigger_control_voice_gate,
      vst_release_control_voice_gate,
      vst_set_control_voice_velocity,
      vst_note_on,
      vst_note_off
    ])
    .setup(move |app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // If VST mode, set a global flag that the frontend can check
      if vst_mode {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
          // Set global flag BEFORE the page loads React
          if let Some(instance_id) = &vst_instance_id_for_setup {
            let id_js = serde_json::to_string(instance_id).unwrap_or_else(|_| "\"\"".to_string());
            let script = format!(
              "window.__NOOBSYNTH_VST_MODE__ = true; window.__NOOBSYNTH_VST_INSTANCE_ID__ = {id_js}; console.log('VST mode enabled');"
            );
            let _ = window.eval(&script);
          } else {
            let _ = window.eval("window.__NOOBSYNTH_VST_MODE__ = true; console.log('VST mode enabled');");
          }
        }
      }

      Ok(())
    })
    .on_window_event({
      let vst_mode_flag = vst_mode;
      let vst_instance_id = vst_instance_id_for_window;
      move |window, event| {
        if !vst_mode_flag {
          return;
        }
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
          api.prevent_close();
          if let Ok(bridge) = TauriBridge::open_with_id(vst_instance_id.as_deref()) {
            drop(bridge);
          }
          let _ = window.app_handle().exit(0);
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
