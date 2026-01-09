use dsp_core::{
  Adsr, AdsrInputs, AdsrParams, Arpeggiator, ArpeggiatorInputs, ArpeggiatorOutputs, ArpeggiatorParams,
  Choir, ChoirInputs, ChoirParams, Chorus, ChorusInputs, ChorusParams, Clap909, Clap909Inputs,
  Clap909Params, Delay, DelayInputs, DelayParams, Distortion, DistortionParams, DrumSequencer,
  DrumSequencerInputs, DrumSequencerOutputs, DrumSequencerParams, Ensemble, EnsembleInputs,
  EnsembleParams, GranularDelay, GranularDelayInputs, GranularDelayParams, HiHat909, HiHat909Inputs,
  HiHat909Params, Kick909, Kick909Inputs, Kick909Params, Lfo, LfoInputs, LfoParams, Mixer, NesOsc,
  NesOscInputs, NesOscParams, Noise, NoiseParams, Phaser, PhaserInputs, PhaserParams, PitchShifter,
  PitchShifterInputs, PitchShifterParams, Quantizer, QuantizerInputs, QuantizerParams, Reverb,
  ReverbInputs, ReverbParams, Rimshot909, Rimshot909Inputs, Rimshot909Params, RingMod, RingModParams,
  Sample, SampleHold, SampleHoldInputs, SampleHoldParams, SlewInputs, SlewLimiter, SlewParams,
  Snare909, Snare909Inputs, Snare909Params, SnesOsc, SnesOscInputs, SnesOscParams, SpringReverb,
  SpringReverbInputs, SpringReverbParams, StepSequencer, StepSequencerInputs, StepSequencerOutputs,
  StepSequencerParams, Supersaw, SupersawInputs, SupersawParams, TapeDelay, TapeDelayInputs,
  TapeDelayParams, Tb303, Tb303Inputs, Tb303Outputs, Tb303Params, Tom909, Tom909Inputs, Tom909Params,
  Vca, Vcf, VcfInputs, VcfParams, Vco, VcoInputs, VcoParams, Vocoder, VocoderInputs, VocoderParams,
  Wavefolder, WavefolderParams,
};
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
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ModuleType {
  Oscillator,
  Supersaw,
  NesOsc,
  SnesOsc,
  Noise,
  ModRouter,
  SampleHold,
  Slew,
  Quantizer,
  RingMod,
  Gain,
  CvVca,
  Output,
  Lab,
  Lfo,
  Adsr,
  Vcf,
  Hpf,
  Mixer,
  MixerWide,
  Chorus,
  Ensemble,
  Choir,
  Vocoder,
  AudioIn,
  Delay,
  GranularDelay,
  TapeDelay,
  SpringReverb,
  Reverb,
  Phaser,
  Distortion,
  Wavefolder,
  Control,
  Scope,
  Mario,
  Arpeggiator,
  StepSequencer,
  Tb303,
  // TR-909 Drums
  Kick909,
  Snare909,
  HiHat909,
  Clap909,
  Tom909,
  Rimshot909,
  // Drum Sequencer
  DrumSequencer,
  // Effects
  PitchShifter,
}

#[derive(Clone, Copy)]
struct PortInfo {
  channels: usize,
}

struct ConnectionEdge {
  source_module: usize,
  source_port: usize,
  gain: f32,
}

struct TapSource {
  module_index: usize,
  input_port: usize,
}

struct ParamBuffer {
  value: f32,
  buffer: Vec<Sample>,
  dirty: bool,
}

impl ParamBuffer {
  fn new(value: f32) -> Self {
    Self {
      value,
      buffer: Vec::new(),
      dirty: true,
    }
  }

  fn set(&mut self, value: f32) {
    if value != self.value {
      self.value = value;
      self.dirty = true;
    }
  }

  fn slice(&mut self, frames: usize) -> &[Sample] {
    if self.buffer.len() != frames || self.dirty {
      self.buffer.resize(frames, self.value);
      if frames > 0 {
        self.buffer.fill(self.value);
      }
      self.dirty = false;
    }
    &self.buffer
  }
}

#[derive(Clone)]
struct Buffer {
  channels: Vec<Vec<Sample>>,
}

impl Buffer {
  fn new(channels: usize, frames: usize) -> Self {
    Self {
      channels: (0..channels).map(|_| vec![0.0; frames]).collect(),
    }
  }

  fn resize(&mut self, channels: usize, frames: usize) {
    if self.channels.len() != channels {
      self.channels = (0..channels).map(|_| vec![0.0; frames]).collect();
      return;
    }
    for channel in &mut self.channels {
      if channel.len() != frames {
        channel.resize(frames, 0.0);
      }
    }
  }

  fn clear(&mut self) {
    for channel in &mut self.channels {
      channel.fill(0.0);
    }
  }

  fn channel(&self, index: usize) -> &[Sample] {
    &self.channels[index]
  }

  fn channel_mut(&mut self, index: usize) -> &mut [Sample] {
    &mut self.channels[index]
  }

  fn channel_count(&self) -> usize {
    self.channels.len()
  }
}

fn mix_buffers(target: &mut Buffer, source: &Buffer, gain: f32) {
  if target.channel_count() == 0 {
    return;
  }
  match (target.channel_count(), source.channel_count()) {
    (1, 1) => {
      let tgt = target.channel_mut(0);
      let src = source.channel(0);
      for i in 0..tgt.len() {
        tgt[i] += src[i] * gain;
      }
    }
    (1, 2) => {
      let tgt = target.channel_mut(0);
      let src_l = source.channel(0);
      let src_r = source.channel(1);
      for i in 0..tgt.len() {
        tgt[i] += (src_l[i] + src_r[i]) * 0.5 * gain;
      }
    }
    (2, 1) => {
      let src = source.channel(0);
      for channel in 0..2 {
        let tgt = target.channel_mut(channel);
        for i in 0..tgt.len() {
          tgt[i] += src[i] * gain;
        }
      }
    }
    (2, 2) => {
      let src_l = source.channel(0);
      let src_r = source.channel(1);
      let (left, right) = target.channels.split_at_mut(1);
      let tgt_l = &mut left[0];
      let tgt_r = &mut right[0];
      for i in 0..tgt_l.len() {
        tgt_l[i] += src_l[i] * gain;
        tgt_r[i] += src_r[i] * gain;
      }
    }
    _ => {}
  }
}

fn downmix_to_mono(source: &Buffer, dest: &mut [Sample]) {
  if dest.is_empty() {
    return;
  }
  match source.channel_count() {
    1 => {
      dest.copy_from_slice(source.channel(0));
    }
    2 => {
      let left = source.channel(0);
      let right = source.channel(1);
      for i in 0..dest.len() {
        dest[i] = 0.5 * (left[i] + right[i]);
      }
    }
    _ => {
      dest.fill(0.0);
    }
  }
}
struct VcoState {
  vco: Vco,
  base_freq: ParamBuffer,
  waveform: ParamBuffer,
  pwm: ParamBuffer,
  fm_lin_depth: ParamBuffer,
  fm_exp_depth: ParamBuffer,
  unison: ParamBuffer,
  detune: ParamBuffer,
  sub_mix: ParamBuffer,
  sub_oct: ParamBuffer,
}

struct NoiseState {
  noise: Noise,
  level: ParamBuffer,
  noise_type: ParamBuffer,
}

struct ModRouterState {
  depth_pitch: ParamBuffer,
  depth_pwm: ParamBuffer,
  depth_vcf: ParamBuffer,
  depth_vca: ParamBuffer,
}

struct SampleHoldState {
  sample_hold: SampleHold,
  mode: ParamBuffer,
}

struct SlewState {
  slew: SlewLimiter,
  rise: ParamBuffer,
  fall: ParamBuffer,
}

struct QuantizerState {
  root: ParamBuffer,
  scale: ParamBuffer,
}

struct RingModState {
  level: ParamBuffer,
}

struct GainState {
  gain: ParamBuffer,
}

struct LfoState {
  lfo: Lfo,
  rate: ParamBuffer,
  shape: ParamBuffer,
  depth: ParamBuffer,
  offset: ParamBuffer,
  bipolar: ParamBuffer,
}

struct AdsrState {
  adsr: Adsr,
  attack: ParamBuffer,
  decay: ParamBuffer,
  sustain: ParamBuffer,
  release: ParamBuffer,
}

struct VcfState {
  vcf: Vcf,
  cutoff: ParamBuffer,
  resonance: ParamBuffer,
  drive: ParamBuffer,
  env_amount: ParamBuffer,
  mod_amount: ParamBuffer,
  key_track: ParamBuffer,
  model: ParamBuffer,
  mode: ParamBuffer,
  slope: ParamBuffer,
}

struct HpfState {
  hpf: Vcf,
  cutoff: ParamBuffer,
}

struct MixerState {
  level_a: ParamBuffer,
  level_b: ParamBuffer,
}

struct MixerWideState {
  level_a: ParamBuffer,
  level_b: ParamBuffer,
  level_c: ParamBuffer,
  level_d: ParamBuffer,
  level_e: ParamBuffer,
  level_f: ParamBuffer,
}

struct ChorusState {
  chorus: Chorus,
  rate: ParamBuffer,
  depth: ParamBuffer,
  delay: ParamBuffer,
  mix: ParamBuffer,
  feedback: ParamBuffer,
  spread: ParamBuffer,
}

struct EnsembleState {
  ensemble: Ensemble,
  rate: ParamBuffer,
  depth: ParamBuffer,
  delay: ParamBuffer,
  mix: ParamBuffer,
  spread: ParamBuffer,
}

struct ChoirState {
  choir: Choir,
  vowel: ParamBuffer,
  rate: ParamBuffer,
  depth: ParamBuffer,
  mix: ParamBuffer,
}

struct VocoderState {
  vocoder: Vocoder,
  attack: ParamBuffer,
  release: ParamBuffer,
  low: ParamBuffer,
  high: ParamBuffer,
  q: ParamBuffer,
  formant: ParamBuffer,
  emphasis: ParamBuffer,
  unvoiced: ParamBuffer,
  mix: ParamBuffer,
  mod_gain: ParamBuffer,
  car_gain: ParamBuffer,
}

struct AudioInState {
  gain: ParamBuffer,
}

struct DelayState {
  delay: Delay,
  time: ParamBuffer,
  feedback: ParamBuffer,
  mix: ParamBuffer,
  tone: ParamBuffer,
  ping_pong: ParamBuffer,
}

struct GranularDelayState {
  delay: GranularDelay,
  time: ParamBuffer,
  size: ParamBuffer,
  density: ParamBuffer,
  pitch: ParamBuffer,
  feedback: ParamBuffer,
  mix: ParamBuffer,
}

struct PitchShifterState {
  shifter: PitchShifter,
  pitch: ParamBuffer,
  fine: ParamBuffer,
  grain: ParamBuffer,
  mix: ParamBuffer,
}

struct TapeDelayState {
  delay: TapeDelay,
  time: ParamBuffer,
  feedback: ParamBuffer,
  mix: ParamBuffer,
  tone: ParamBuffer,
  wow: ParamBuffer,
  flutter: ParamBuffer,
  drive: ParamBuffer,
}

struct SpringReverbState {
  reverb: SpringReverb,
  decay: ParamBuffer,
  tone: ParamBuffer,
  mix: ParamBuffer,
  drive: ParamBuffer,
}

struct ReverbState {
  reverb: Reverb,
  time: ParamBuffer,
  damp: ParamBuffer,
  pre_delay: ParamBuffer,
  mix: ParamBuffer,
}

struct PhaserState {
  phaser: Phaser,
  rate: ParamBuffer,
  depth: ParamBuffer,
  feedback: ParamBuffer,
  mix: ParamBuffer,
}

struct DistortionState {
  drive: ParamBuffer,
  tone: ParamBuffer,
  mix: ParamBuffer,
  mode: ParamBuffer,
}

struct WavefolderState {
  drive: ParamBuffer,
  fold: ParamBuffer,
  bias: ParamBuffer,
  mix: ParamBuffer,
}

struct SupersawState {
  supersaw: Supersaw,
  base_freq: ParamBuffer,
  detune: ParamBuffer,
  mix: ParamBuffer,
}

struct NesOscState {
  nes_osc: NesOsc,
  base_freq: ParamBuffer,
  fine: ParamBuffer,
  volume: ParamBuffer,
  mode: ParamBuffer,
  duty: ParamBuffer,
  noise_mode: ParamBuffer,
  bitcrush: ParamBuffer,
}

struct SnesOscState {
  snes_osc: SnesOsc,
  base_freq: ParamBuffer,
  fine: ParamBuffer,
  volume: ParamBuffer,
  wave: ParamBuffer,
  gauss: ParamBuffer,
  color: ParamBuffer,
  lofi: ParamBuffer,
}

struct OutputState {
  level: ParamBuffer,
}

struct LabState {
  level: ParamBuffer,
}

struct ControlState {
  cv: f32,
  cv_target: f32,
  cv_step: f32,
  cv_remaining: usize,
  velocity: f32,
  velocity_target: f32,
  velocity_step: f32,
  velocity_remaining: usize,
  gate: f32,
  /// When > 0, output gate=0 for these samples to force a rising edge retrigger
  retrigger_samples: usize,
  sync_remaining: usize,
  glide_seconds: f32,
  sample_rate: f32,
}

struct MarioState {
  cv: [f32; 5],
  gate: [f32; 5],
}

struct ArpeggiatorState {
  arp: Arpeggiator,
  enabled: ParamBuffer,
  hold: ParamBuffer,
  mode: ParamBuffer,
  octaves: ParamBuffer,
  rate: ParamBuffer,
  gate_len: ParamBuffer,
  swing: ParamBuffer,
  tempo: ParamBuffer,
  ratchet: ParamBuffer,
  ratchet_decay: ParamBuffer,
  probability: ParamBuffer,
  velocity_mode: ParamBuffer,
  accent_pattern: ParamBuffer,
  euclid_steps: ParamBuffer,
  euclid_fill: ParamBuffer,
  euclid_rotate: ParamBuffer,
  euclid_enabled: ParamBuffer,
  mutate: ParamBuffer,
}

struct StepSequencerState {
  seq: StepSequencer,
  enabled: ParamBuffer,
  tempo: ParamBuffer,
  rate: ParamBuffer,
  gate_length: ParamBuffer,
  swing: ParamBuffer,
  slide_time: ParamBuffer,
  length: ParamBuffer,
  direction: ParamBuffer,
}

struct Tb303State {
  tb303: Tb303,
  waveform: ParamBuffer,
  cutoff: ParamBuffer,
  resonance: ParamBuffer,
  decay: ParamBuffer,
  envmod: ParamBuffer,
  accent: ParamBuffer,
  glide: ParamBuffer,
}

// TR-909 Drum States
struct Kick909State {
  kick: Kick909,
  tune: ParamBuffer,
  attack: ParamBuffer,
  decay: ParamBuffer,
  drive: ParamBuffer,
}

struct Snare909State {
  snare: Snare909,
  tune: ParamBuffer,
  tone: ParamBuffer,
  snappy: ParamBuffer,
  decay: ParamBuffer,
}

struct HiHat909State {
  hihat: HiHat909,
  tune: ParamBuffer,
  decay: ParamBuffer,
  tone: ParamBuffer,
  open: ParamBuffer,
}

struct Clap909State {
  clap: Clap909,
  tone: ParamBuffer,
  decay: ParamBuffer,
}

struct Tom909State {
  tom: Tom909,
  tune: ParamBuffer,
  decay: ParamBuffer,
}

struct Rimshot909State {
  rimshot: Rimshot909,
  tune: ParamBuffer,
}

struct DrumSequencerState {
  seq: DrumSequencer,
  enabled: ParamBuffer,
  tempo: ParamBuffer,
  rate: ParamBuffer,
  gate_length: ParamBuffer,
  swing: ParamBuffer,
  length: ParamBuffer,
}

enum ModuleState {
  Vco(VcoState),
  Supersaw(SupersawState),
  NesOsc(NesOscState),
  SnesOsc(SnesOscState),
  Noise(NoiseState),
  ModRouter(ModRouterState),
  SampleHold(SampleHoldState),
  Slew(SlewState),
  Quantizer(QuantizerState),
  RingMod(RingModState),
  Gain(GainState),
  CvVca(GainState),
  Lfo(LfoState),
  Adsr(AdsrState),
  Vcf(VcfState),
  Hpf(HpfState),
  Mixer(MixerState),
  MixerWide(MixerWideState),
  Chorus(ChorusState),
  Ensemble(EnsembleState),
  Choir(ChoirState),
  Vocoder(VocoderState),
  AudioIn(AudioInState),
  Delay(DelayState),
  GranularDelay(GranularDelayState),
  TapeDelay(TapeDelayState),
  SpringReverb(SpringReverbState),
  Reverb(ReverbState),
  Phaser(PhaserState),
  Distortion(DistortionState),
  Wavefolder(WavefolderState),
  Output(OutputState),
  Lab(LabState),
  Control(ControlState),
  Scope,
  Mario(MarioState),
  Arpeggiator(ArpeggiatorState),
  StepSequencer(StepSequencerState),
  Tb303(Tb303State),
  // TR-909 Drums
  Kick909(Kick909State),
  Snare909(Snare909State),
  HiHat909(HiHat909State),
  Clap909(Clap909State),
  Tom909(Tom909State),
  Rimshot909(Rimshot909State),
  DrumSequencer(DrumSequencerState),
  PitchShifter(PitchShifterState),
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
    if channel == 0 || channel > 5 {
      return;
    }
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(ModuleState::Mario(state)) = self.modules.get_mut(*index).map(|m| &mut m.state) {
        state.cv[channel - 1] = value;
      }
    }
  }

  pub fn set_mario_channel_gate(&mut self, module_id: &str, channel: usize, value: f32) {
    if channel == 0 || channel > 5 {
      return;
    }
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(ModuleState::Mario(state)) = self.modules.get_mut(*index).map(|m| &mut m.state) {
        state.gate[channel - 1] = value;
      }
    }
  }

  /// Get current step position for a sequencer module (StepSequencer or DrumSequencer)
  /// Returns -1 if module not found or not a sequencer
  pub fn get_sequencer_step(&self, module_id: &str) -> i32 {
    if let Some(index) = self.module_map.get(module_id).and_then(|list| list.first()) {
      if let Some(module) = self.modules.get(*index) {
        match &module.state {
          ModuleState::StepSequencer(state) => return state.seq.current_step() as i32,
          ModuleState::DrumSequencer(state) => return state.seq.current_step() as i32,
          _ => {}
        }
      }
    }
    -1
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
        let node = ModuleNode::new(
          module_type,
          if is_poly { Some(voice_index) } else { None },
          &params,
          self.sample_rate,
        );
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

    let state = match module_type {
      ModuleType::Oscillator => ModuleState::Vco(VcoState {
        vco: Vco::new(sample_rate),
        base_freq: ParamBuffer::new(param_number(params, "frequency", 220.0)),
        waveform: ParamBuffer::new(param_number(params, "type", 2.0)),
        pwm: ParamBuffer::new(param_number(params, "pwm", 0.5)),
        fm_lin_depth: ParamBuffer::new(param_number(params, "fmLin", 0.0)),
        fm_exp_depth: ParamBuffer::new(param_number(params, "fmExp", 0.0)),
        unison: ParamBuffer::new(param_number(params, "unison", 1.0)),
        detune: ParamBuffer::new(param_number(params, "detune", 0.0)),
        sub_mix: ParamBuffer::new(param_number(params, "subMix", 0.0)),
        sub_oct: ParamBuffer::new(param_number(params, "subOct", 1.0)),
      }),
      ModuleType::Noise => ModuleState::Noise(NoiseState {
        noise: Noise::new(),
        level: ParamBuffer::new(param_number(params, "level", 0.4)),
        noise_type: ParamBuffer::new(param_number(params, "noiseType", 0.0)),
      }),
      ModuleType::ModRouter => ModuleState::ModRouter(ModRouterState {
        depth_pitch: ParamBuffer::new(param_number(params, "depthPitch", 0.0)),
        depth_pwm: ParamBuffer::new(param_number(params, "depthPwm", 0.0)),
        depth_vcf: ParamBuffer::new(param_number(params, "depthVcf", 0.0)),
        depth_vca: ParamBuffer::new(param_number(params, "depthVca", 0.0)),
      }),
      ModuleType::SampleHold => ModuleState::SampleHold(SampleHoldState {
        sample_hold: SampleHold::new(),
        mode: ParamBuffer::new(param_number(params, "mode", 0.0)),
      }),
      ModuleType::Slew => ModuleState::Slew(SlewState {
        slew: SlewLimiter::new(sample_rate),
        rise: ParamBuffer::new(param_number(params, "rise", 0.05)),
        fall: ParamBuffer::new(param_number(params, "fall", 0.05)),
      }),
      ModuleType::Quantizer => ModuleState::Quantizer(QuantizerState {
        root: ParamBuffer::new(param_number(params, "root", 0.0)),
        scale: ParamBuffer::new(param_number(params, "scale", 0.0)),
      }),
      ModuleType::RingMod => ModuleState::RingMod(RingModState {
        level: ParamBuffer::new(param_number(params, "level", 0.9)),
      }),
      ModuleType::Gain => ModuleState::Gain(GainState {
        gain: ParamBuffer::new(param_number(params, "gain", 0.2)),
      }),
      ModuleType::CvVca => ModuleState::CvVca(GainState {
        gain: ParamBuffer::new(param_number(params, "gain", 1.0)),
      }),
      ModuleType::Output => ModuleState::Output(OutputState {
        level: ParamBuffer::new(param_number(params, "level", 0.8)),
      }),
      ModuleType::Lab => ModuleState::Lab(LabState {
        level: ParamBuffer::new(param_number(params, "level", 0.8)),
      }),
      ModuleType::Lfo => ModuleState::Lfo(LfoState {
        lfo: Lfo::new(sample_rate),
        rate: ParamBuffer::new(param_number(params, "rate", 2.0)),
        shape: ParamBuffer::new(param_number(params, "shape", 0.0)),
        depth: ParamBuffer::new(param_number(params, "depth", 0.7)),
        offset: ParamBuffer::new(param_number(params, "offset", 0.0)),
        bipolar: ParamBuffer::new(param_number(params, "bipolar", 1.0)),
      }),
      ModuleType::Adsr => ModuleState::Adsr(AdsrState {
        adsr: Adsr::new(sample_rate),
        attack: ParamBuffer::new(param_number(params, "attack", 0.02)),
        decay: ParamBuffer::new(param_number(params, "decay", 0.2)),
        sustain: ParamBuffer::new(param_number(params, "sustain", 0.65)),
        release: ParamBuffer::new(param_number(params, "release", 0.4)),
      }),
      ModuleType::Vcf => ModuleState::Vcf(VcfState {
        vcf: Vcf::new(sample_rate),
        cutoff: ParamBuffer::new(param_number(params, "cutoff", 800.0)),
        resonance: ParamBuffer::new(param_number(params, "resonance", 0.4)),
        drive: ParamBuffer::new(param_number(params, "drive", 0.2)),
        env_amount: ParamBuffer::new(param_number(params, "envAmount", 0.0)),
        mod_amount: ParamBuffer::new(param_number(params, "modAmount", 0.0)),
        key_track: ParamBuffer::new(param_number(params, "keyTrack", 0.0)),
        model: ParamBuffer::new(param_number(params, "model", 0.0)),
        mode: ParamBuffer::new(param_number(params, "mode", 0.0)),
        slope: ParamBuffer::new(param_number(params, "slope", 1.0)),
      }),
      ModuleType::Hpf => ModuleState::Hpf(HpfState {
        hpf: Vcf::new(sample_rate),
        cutoff: ParamBuffer::new(param_number(params, "cutoff", 280.0)),
      }),
      ModuleType::Mixer => ModuleState::Mixer(MixerState {
        level_a: ParamBuffer::new(param_number(params, "levelA", 0.6)),
        level_b: ParamBuffer::new(param_number(params, "levelB", 0.6)),
      }),
      ModuleType::MixerWide => ModuleState::MixerWide(MixerWideState {
        level_a: ParamBuffer::new(param_number(params, "levelA", 0.6)),
        level_b: ParamBuffer::new(param_number(params, "levelB", 0.6)),
        level_c: ParamBuffer::new(param_number(params, "levelC", 0.6)),
        level_d: ParamBuffer::new(param_number(params, "levelD", 0.6)),
        level_e: ParamBuffer::new(param_number(params, "levelE", 0.6)),
        level_f: ParamBuffer::new(param_number(params, "levelF", 0.6)),
      }),
      ModuleType::Chorus => ModuleState::Chorus(ChorusState {
        chorus: Chorus::new(sample_rate),
        rate: ParamBuffer::new(param_number(params, "rate", 0.3)),
        depth: ParamBuffer::new(param_number(params, "depth", 8.0)),
        delay: ParamBuffer::new(param_number(params, "delay", 18.0)),
        mix: ParamBuffer::new(param_number(params, "mix", 0.45)),
        feedback: ParamBuffer::new(param_number(params, "feedback", 0.15)),
        spread: ParamBuffer::new(param_number(params, "spread", 0.6)),
      }),
      ModuleType::Ensemble => ModuleState::Ensemble(EnsembleState {
        ensemble: Ensemble::new(sample_rate),
        rate: ParamBuffer::new(param_number(params, "rate", 0.25)),
        depth: ParamBuffer::new(param_number(params, "depth", 12.0)),
        delay: ParamBuffer::new(param_number(params, "delay", 12.0)),
        mix: ParamBuffer::new(param_number(params, "mix", 0.6)),
        spread: ParamBuffer::new(param_number(params, "spread", 0.7)),
      }),
      ModuleType::Choir => ModuleState::Choir(ChoirState {
        choir: Choir::new(sample_rate),
        vowel: ParamBuffer::new(param_number(params, "vowel", 0.0)),
        rate: ParamBuffer::new(param_number(params, "rate", 0.25)),
        depth: ParamBuffer::new(param_number(params, "depth", 0.35)),
        mix: ParamBuffer::new(param_number(params, "mix", 0.5)),
      }),
      ModuleType::Vocoder => ModuleState::Vocoder(VocoderState {
        vocoder: Vocoder::new(sample_rate),
        attack: ParamBuffer::new(param_number(params, "attack", 25.0)),
        release: ParamBuffer::new(param_number(params, "release", 140.0)),
        low: ParamBuffer::new(param_number(params, "low", 120.0)),
        high: ParamBuffer::new(param_number(params, "high", 5000.0)),
        q: ParamBuffer::new(param_number(params, "q", 2.5)),
        formant: ParamBuffer::new(param_number(params, "formant", 0.0)),
        emphasis: ParamBuffer::new(param_number(params, "emphasis", 0.4)),
        unvoiced: ParamBuffer::new(param_number(params, "unvoiced", 0.0)),
        mix: ParamBuffer::new(param_number(params, "mix", 0.8)),
        mod_gain: ParamBuffer::new(param_number(params, "modGain", 1.0)),
        car_gain: ParamBuffer::new(param_number(params, "carGain", 1.0)),
      }),
      ModuleType::AudioIn => ModuleState::AudioIn(AudioInState {
        gain: ParamBuffer::new(param_number(params, "gain", 1.0)),
      }),
      ModuleType::Delay => ModuleState::Delay(DelayState {
        delay: Delay::new(sample_rate),
        time: ParamBuffer::new(param_number(params, "time", 360.0)),
        feedback: ParamBuffer::new(param_number(params, "feedback", 0.35)),
        mix: ParamBuffer::new(param_number(params, "mix", 0.25)),
        tone: ParamBuffer::new(param_number(params, "tone", 0.55)),
        ping_pong: ParamBuffer::new(param_number(params, "pingPong", 0.0)),
      }),
      ModuleType::GranularDelay => ModuleState::GranularDelay(GranularDelayState {
        delay: GranularDelay::new(sample_rate),
        time: ParamBuffer::new(param_number(params, "time", 420.0)),
        size: ParamBuffer::new(param_number(params, "size", 120.0)),
        density: ParamBuffer::new(param_number(params, "density", 6.0)),
        pitch: ParamBuffer::new(param_number(params, "pitch", 1.0)),
        feedback: ParamBuffer::new(param_number(params, "feedback", 0.35)),
        mix: ParamBuffer::new(param_number(params, "mix", 0.5)),
      }),
      ModuleType::TapeDelay => ModuleState::TapeDelay(TapeDelayState {
        delay: TapeDelay::new(sample_rate),
        time: ParamBuffer::new(param_number(params, "time", 420.0)),
        feedback: ParamBuffer::new(param_number(params, "feedback", 0.35)),
        mix: ParamBuffer::new(param_number(params, "mix", 0.35)),
        tone: ParamBuffer::new(param_number(params, "tone", 0.55)),
        wow: ParamBuffer::new(param_number(params, "wow", 0.2)),
        flutter: ParamBuffer::new(param_number(params, "flutter", 0.2)),
        drive: ParamBuffer::new(param_number(params, "drive", 0.2)),
      }),
      ModuleType::SpringReverb => ModuleState::SpringReverb(SpringReverbState {
        reverb: SpringReverb::new(sample_rate),
        decay: ParamBuffer::new(param_number(params, "decay", 0.6)),
        tone: ParamBuffer::new(param_number(params, "tone", 0.4)),
        mix: ParamBuffer::new(param_number(params, "mix", 0.4)),
        drive: ParamBuffer::new(param_number(params, "drive", 0.2)),
      }),
      ModuleType::Reverb => ModuleState::Reverb(ReverbState {
        reverb: Reverb::new(sample_rate),
        time: ParamBuffer::new(param_number(params, "time", 0.62)),
        damp: ParamBuffer::new(param_number(params, "damp", 0.4)),
        pre_delay: ParamBuffer::new(param_number(params, "preDelay", 18.0)),
        mix: ParamBuffer::new(param_number(params, "mix", 0.25)),
      }),
      ModuleType::Phaser => ModuleState::Phaser(PhaserState {
        phaser: Phaser::new(sample_rate),
        rate: ParamBuffer::new(param_number(params, "rate", 0.5)),
        depth: ParamBuffer::new(param_number(params, "depth", 0.7)),
        feedback: ParamBuffer::new(param_number(params, "feedback", 0.3)),
        mix: ParamBuffer::new(param_number(params, "mix", 0.5)),
      }),
      ModuleType::Distortion => ModuleState::Distortion(DistortionState {
        drive: ParamBuffer::new(param_number(params, "drive", 0.5)),
        tone: ParamBuffer::new(param_number(params, "tone", 0.5)),
        mix: ParamBuffer::new(param_number(params, "mix", 1.0)),
        mode: ParamBuffer::new(param_number(params, "mode", 0.0)),
      }),
      ModuleType::Wavefolder => ModuleState::Wavefolder(WavefolderState {
        drive: ParamBuffer::new(param_number(params, "drive", 0.4)),
        fold: ParamBuffer::new(param_number(params, "fold", 0.5)),
        bias: ParamBuffer::new(param_number(params, "bias", 0.0)),
        mix: ParamBuffer::new(param_number(params, "mix", 0.8)),
      }),
      ModuleType::Supersaw => ModuleState::Supersaw(SupersawState {
        supersaw: Supersaw::new(sample_rate),
        base_freq: ParamBuffer::new(param_number(params, "frequency", 220.0)),
        detune: ParamBuffer::new(param_number(params, "detune", 25.0)),
        mix: ParamBuffer::new(param_number(params, "mix", 1.0)),
      }),
      ModuleType::NesOsc => ModuleState::NesOsc(NesOscState {
        nes_osc: NesOsc::new(sample_rate),
        base_freq: ParamBuffer::new(param_number(params, "frequency", 220.0)),
        fine: ParamBuffer::new(param_number(params, "fine", 0.0)),
        volume: ParamBuffer::new(param_number(params, "volume", 1.0)),
        mode: ParamBuffer::new(param_number(params, "mode", 0.0)),
        duty: ParamBuffer::new(param_number(params, "duty", 1.0)),
        noise_mode: ParamBuffer::new(param_number(params, "noiseMode", 0.0)),
        bitcrush: ParamBuffer::new(param_number(params, "bitcrush", 1.0)),
      }),
      ModuleType::SnesOsc => ModuleState::SnesOsc(SnesOscState {
        snes_osc: SnesOsc::new(sample_rate),
        base_freq: ParamBuffer::new(param_number(params, "frequency", 220.0)),
        fine: ParamBuffer::new(param_number(params, "fine", 0.0)),
        volume: ParamBuffer::new(param_number(params, "volume", 1.0)),
        wave: ParamBuffer::new(param_number(params, "wave", 0.0)),
        gauss: ParamBuffer::new(param_number(params, "gauss", 0.7)),
        color: ParamBuffer::new(param_number(params, "color", 0.5)),
        lofi: ParamBuffer::new(param_number(params, "lofi", 0.5)),
      }),
      ModuleType::Control => ModuleState::Control(ControlState {
        cv: param_number(params, "cv", 0.0),
        cv_target: param_number(params, "cv", 0.0),
        cv_step: 0.0,
        cv_remaining: 0,
        velocity: param_number(params, "velocity", 1.0).clamp(0.0, 1.0),
        velocity_target: param_number(params, "velocity", 1.0).clamp(0.0, 1.0),
        velocity_step: 0.0,
        velocity_remaining: 0,
        gate: param_number(params, "gate", 0.0),
        retrigger_samples: 0,
        sync_remaining: 0,
        glide_seconds: param_number(params, "glide", 0.0).max(0.0),
        sample_rate,
      }),
      ModuleType::Scope => ModuleState::Scope,
      ModuleType::Mario => ModuleState::Mario(MarioState {
        cv: [0.0; 5],
        gate: [0.0; 5],
      }),
      ModuleType::Arpeggiator => ModuleState::Arpeggiator(ArpeggiatorState {
        arp: Arpeggiator::new(sample_rate),
        enabled: ParamBuffer::new(param_number(params, "enabled", 1.0)),
        hold: ParamBuffer::new(param_number(params, "hold", 0.0)),
        mode: ParamBuffer::new(param_number(params, "mode", 0.0)),
        octaves: ParamBuffer::new(param_number(params, "octaves", 1.0)),
        rate: ParamBuffer::new(param_number(params, "rate", 7.0)),
        gate_len: ParamBuffer::new(param_number(params, "gate", 75.0)),
        swing: ParamBuffer::new(param_number(params, "swing", 0.0)),
        tempo: ParamBuffer::new(param_number(params, "tempo", 120.0)),
        ratchet: ParamBuffer::new(param_number(params, "ratchet", 1.0)),
        ratchet_decay: ParamBuffer::new(param_number(params, "ratchetDecay", 0.0)),
        probability: ParamBuffer::new(param_number(params, "probability", 100.0)),
        velocity_mode: ParamBuffer::new(param_number(params, "velocityMode", 0.0)),
        accent_pattern: ParamBuffer::new(param_number(params, "accentPattern", 0.0)),
        euclid_steps: ParamBuffer::new(param_number(params, "euclidSteps", 8.0)),
        euclid_fill: ParamBuffer::new(param_number(params, "euclidFill", 4.0)),
        euclid_rotate: ParamBuffer::new(param_number(params, "euclidRotate", 0.0)),
        euclid_enabled: ParamBuffer::new(param_number(params, "euclidEnabled", 0.0)),
        mutate: ParamBuffer::new(param_number(params, "mutate", 0.0)),
      }),
      ModuleType::StepSequencer => {
        let mut seq = StepSequencer::new(sample_rate);
        // Parse initial step data if provided
        if let Some(step_data) = params.get("stepData") {
          if let Some(s) = step_data.as_str() {
            seq.parse_step_data(s);
          }
        }
        ModuleState::StepSequencer(StepSequencerState {
          seq,
          enabled: ParamBuffer::new(param_number(params, "enabled", 1.0)),
          tempo: ParamBuffer::new(param_number(params, "tempo", 120.0)),
          rate: ParamBuffer::new(param_number(params, "rate", 3.0)), // Default 1/8
          gate_length: ParamBuffer::new(param_number(params, "gateLength", 50.0)),
          swing: ParamBuffer::new(param_number(params, "swing", 0.0)),
          slide_time: ParamBuffer::new(param_number(params, "slideTime", 50.0)),
          length: ParamBuffer::new(param_number(params, "length", 16.0)),
          direction: ParamBuffer::new(param_number(params, "direction", 0.0)),
        })
      }
      ModuleType::Tb303 => ModuleState::Tb303(Tb303State {
        tb303: Tb303::new(sample_rate),
        waveform: ParamBuffer::new(param_number(params, "waveform", 0.0)),
        cutoff: ParamBuffer::new(param_number(params, "cutoff", 800.0)),
        resonance: ParamBuffer::new(param_number(params, "resonance", 0.3)),
        decay: ParamBuffer::new(param_number(params, "decay", 0.3)),
        envmod: ParamBuffer::new(param_number(params, "envmod", 0.5)),
        accent: ParamBuffer::new(param_number(params, "accent", 0.6)),
        glide: ParamBuffer::new(param_number(params, "glide", 0.02)),
      }),
      // TR-909 Drums
      ModuleType::Kick909 => ModuleState::Kick909(Kick909State {
        kick: Kick909::new(sample_rate),
        tune: ParamBuffer::new(param_number(params, "tune", 55.0)),
        attack: ParamBuffer::new(param_number(params, "attack", 0.5)),
        decay: ParamBuffer::new(param_number(params, "decay", 0.5)),
        drive: ParamBuffer::new(param_number(params, "drive", 0.3)),
      }),
      ModuleType::Snare909 => ModuleState::Snare909(Snare909State {
        snare: Snare909::new(sample_rate),
        tune: ParamBuffer::new(param_number(params, "tune", 200.0)),
        tone: ParamBuffer::new(param_number(params, "tone", 0.5)),
        snappy: ParamBuffer::new(param_number(params, "snappy", 0.5)),
        decay: ParamBuffer::new(param_number(params, "decay", 0.3)),
      }),
      ModuleType::HiHat909 => ModuleState::HiHat909(HiHat909State {
        hihat: HiHat909::new(sample_rate),
        tune: ParamBuffer::new(param_number(params, "tune", 1.0)),
        decay: ParamBuffer::new(param_number(params, "decay", 0.2)),
        tone: ParamBuffer::new(param_number(params, "tone", 0.5)),
        open: ParamBuffer::new(param_number(params, "open", 0.0)),
      }),
      ModuleType::Clap909 => ModuleState::Clap909(Clap909State {
        clap: Clap909::new(sample_rate),
        tone: ParamBuffer::new(param_number(params, "tone", 0.5)),
        decay: ParamBuffer::new(param_number(params, "decay", 0.4)),
      }),
      ModuleType::Tom909 => ModuleState::Tom909(Tom909State {
        tom: Tom909::new(sample_rate),
        tune: ParamBuffer::new(param_number(params, "tune", 120.0)),
        decay: ParamBuffer::new(param_number(params, "decay", 0.4)),
      }),
      ModuleType::Rimshot909 => ModuleState::Rimshot909(Rimshot909State {
        rimshot: Rimshot909::new(sample_rate),
        tune: ParamBuffer::new(param_number(params, "tune", 400.0)),
      }),
      ModuleType::DrumSequencer => {
        let mut seq = DrumSequencer::new(sample_rate);
        // Parse initial drum data if provided
        if let Some(drum_data) = params.get("drumData") {
          if let Some(s) = drum_data.as_str() {
            seq.parse_drum_data(s);
          }
        }
        ModuleState::DrumSequencer(DrumSequencerState {
          seq,
          enabled: ParamBuffer::new(param_number(params, "enabled", 1.0)),
          tempo: ParamBuffer::new(param_number(params, "tempo", 120.0)),
          rate: ParamBuffer::new(param_number(params, "rate", 4.0)),
          gate_length: ParamBuffer::new(param_number(params, "gateLength", 50.0)),
          swing: ParamBuffer::new(param_number(params, "swing", 0.0)),
          length: ParamBuffer::new(param_number(params, "length", 16.0)),
        })
      }
      ModuleType::PitchShifter => ModuleState::PitchShifter(PitchShifterState {
        shifter: PitchShifter::new(sample_rate),
        pitch: ParamBuffer::new(param_number(params, "pitch", 0.0)),
        fine: ParamBuffer::new(param_number(params, "fine", 0.0)),
        grain: ParamBuffer::new(param_number(params, "grain", 50.0)),
        mix: ParamBuffer::new(param_number(params, "mix", 1.0)),
      }),
    };

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
    match &mut self.state {
      ModuleState::Vco(state) => match param {
        "frequency" => state.base_freq.set(value),
        "type" => state.waveform.set(value),
        "pwm" => state.pwm.set(value),
        "fmLin" => state.fm_lin_depth.set(value),
        "fmExp" => state.fm_exp_depth.set(value),
        "unison" => state.unison.set(value),
        "detune" => state.detune.set(value),
        "subMix" => state.sub_mix.set(value),
        "subOct" => state.sub_oct.set(value),
        _ => {}
      },
      ModuleState::Noise(state) => match param {
        "level" => state.level.set(value),
        "noiseType" => state.noise_type.set(value),
        _ => {}
      },
      ModuleState::ModRouter(state) => match param {
        "depthPitch" => state.depth_pitch.set(value),
        "depthPwm" => state.depth_pwm.set(value),
        "depthVcf" => state.depth_vcf.set(value),
        "depthVca" => state.depth_vca.set(value),
        _ => {}
      },
      ModuleState::SampleHold(state) => {
        if param == "mode" {
          state.mode.set(value);
        }
      }
      ModuleState::Slew(state) => match param {
        "rise" => state.rise.set(value),
        "fall" => state.fall.set(value),
        _ => {}
      },
      ModuleState::Quantizer(state) => match param {
        "root" => state.root.set(value),
        "scale" => state.scale.set(value),
        _ => {}
      },
      ModuleState::RingMod(state) => {
        if param == "level" {
          state.level.set(value);
        }
      }
      ModuleState::Gain(state) | ModuleState::CvVca(state) => {
        if param == "gain" {
          state.gain.set(value);
        }
      }
      ModuleState::Output(state) => {
        if param == "level" {
          state.level.set(value);
        }
      }
      ModuleState::Lab(state) => {
        if param == "level" {
          state.level.set(value);
        }
      }
      ModuleState::Lfo(state) => match param {
        "rate" => state.rate.set(value),
        "shape" => state.shape.set(value),
        "depth" => state.depth.set(value),
        "offset" => state.offset.set(value),
        "bipolar" => state.bipolar.set(value),
        _ => {}
      },
      ModuleState::Adsr(state) => match param {
        "attack" => state.attack.set(value),
        "decay" => state.decay.set(value),
        "sustain" => state.sustain.set(value),
        "release" => state.release.set(value),
        _ => {}
      },
      ModuleState::Vcf(state) => match param {
        "cutoff" => state.cutoff.set(value),
        "resonance" => state.resonance.set(value),
        "drive" => state.drive.set(value),
        "envAmount" => state.env_amount.set(value),
        "modAmount" => state.mod_amount.set(value),
        "keyTrack" => state.key_track.set(value),
        "model" => state.model.set(value),
        "mode" => state.mode.set(value),
        "slope" => state.slope.set(value),
        _ => {}
      },
      ModuleState::Hpf(state) => {
        if param == "cutoff" {
          state.cutoff.set(value);
        }
      }
      ModuleState::Mixer(state) => match param {
        "levelA" => state.level_a.set(value),
        "levelB" => state.level_b.set(value),
        _ => {}
      },
      ModuleState::MixerWide(state) => match param {
        "levelA" => state.level_a.set(value),
        "levelB" => state.level_b.set(value),
        "levelC" => state.level_c.set(value),
        "levelD" => state.level_d.set(value),
        "levelE" => state.level_e.set(value),
        "levelF" => state.level_f.set(value),
        _ => {}
      },
      ModuleState::Chorus(state) => match param {
        "rate" => state.rate.set(value),
        "depth" => state.depth.set(value),
        "delay" => state.delay.set(value),
        "mix" => state.mix.set(value),
        "feedback" => state.feedback.set(value),
        "spread" => state.spread.set(value),
        _ => {}
      },
      ModuleState::Ensemble(state) => match param {
        "rate" => state.rate.set(value),
        "depth" => state.depth.set(value),
        "delay" => state.delay.set(value),
        "mix" => state.mix.set(value),
        "spread" => state.spread.set(value),
        _ => {}
      },
      ModuleState::Choir(state) => match param {
        "vowel" => state.vowel.set(value),
        "rate" => state.rate.set(value),
        "depth" => state.depth.set(value),
        "mix" => state.mix.set(value),
        _ => {}
      },
      ModuleState::Vocoder(state) => match param {
        "attack" => state.attack.set(value),
        "release" => state.release.set(value),
        "low" => state.low.set(value),
        "high" => state.high.set(value),
        "q" => state.q.set(value),
        "formant" => state.formant.set(value),
        "emphasis" => state.emphasis.set(value),
        "unvoiced" => state.unvoiced.set(value),
        "mix" => state.mix.set(value),
        "modGain" => state.mod_gain.set(value),
        "carGain" => state.car_gain.set(value),
        _ => {}
      },
      ModuleState::AudioIn(state) => {
        if param == "gain" {
          state.gain.set(value);
        }
      }
      ModuleState::Delay(state) => match param {
        "time" => state.time.set(value),
        "feedback" => state.feedback.set(value),
        "mix" => state.mix.set(value),
        "tone" => state.tone.set(value),
        "pingPong" => state.ping_pong.set(value),
        _ => {}
      },
      ModuleState::GranularDelay(state) => match param {
        "time" => state.time.set(value),
        "size" => state.size.set(value),
        "density" => state.density.set(value),
        "pitch" => state.pitch.set(value),
        "feedback" => state.feedback.set(value),
        "mix" => state.mix.set(value),
        _ => {}
      },
      ModuleState::TapeDelay(state) => match param {
        "time" => state.time.set(value),
        "feedback" => state.feedback.set(value),
        "mix" => state.mix.set(value),
        "tone" => state.tone.set(value),
        "wow" => state.wow.set(value),
        "flutter" => state.flutter.set(value),
        "drive" => state.drive.set(value),
        _ => {}
      },
      ModuleState::SpringReverb(state) => match param {
        "decay" => state.decay.set(value),
        "tone" => state.tone.set(value),
        "mix" => state.mix.set(value),
        "drive" => state.drive.set(value),
        _ => {}
      },
      ModuleState::Reverb(state) => match param {
        "time" => state.time.set(value),
        "damp" => state.damp.set(value),
        "preDelay" => state.pre_delay.set(value),
        "mix" => state.mix.set(value),
        _ => {}
      },
      ModuleState::Phaser(state) => match param {
        "rate" => state.rate.set(value),
        "depth" => state.depth.set(value),
        "feedback" => state.feedback.set(value),
        "mix" => state.mix.set(value),
        _ => {}
      },
      ModuleState::Distortion(state) => match param {
        "drive" => state.drive.set(value),
        "tone" => state.tone.set(value),
        "mix" => state.mix.set(value),
        "mode" => state.mode.set(value),
        _ => {}
      },
      ModuleState::Wavefolder(state) => match param {
        "drive" => state.drive.set(value),
        "fold" => state.fold.set(value),
        "bias" => state.bias.set(value),
        "mix" => state.mix.set(value),
        _ => {}
      },
      ModuleState::Supersaw(state) => match param {
        "frequency" => state.base_freq.set(value),
        "detune" => state.detune.set(value),
        "mix" => state.mix.set(value),
        _ => {}
      },
      ModuleState::NesOsc(state) => match param {
        "frequency" => state.base_freq.set(value),
        "fine" => state.fine.set(value),
        "volume" => state.volume.set(value),
        "mode" => state.mode.set(value),
        "duty" => state.duty.set(value),
        "noiseMode" => state.noise_mode.set(value),
        "bitcrush" => state.bitcrush.set(value),
        _ => {}
      },
      ModuleState::SnesOsc(state) => match param {
        "frequency" => state.base_freq.set(value),
        "fine" => state.fine.set(value),
        "volume" => state.volume.set(value),
        "wave" => state.wave.set(value),
        "gauss" => state.gauss.set(value),
        "color" => state.color.set(value),
        "lofi" => state.lofi.set(value),
        _ => {}
      },
      ModuleState::Control(state) => {
        match param {
          "glide" => {
            state.glide_seconds = value.max(0.0);
          }
          "cv" => {
            if state.glide_seconds > 0.0 {
              let total = (state.glide_seconds * state.sample_rate).max(1.0);
              state.cv_target = value;
              state.cv_remaining = total as usize;
              state.cv_step = (state.cv_target - state.cv) / total;
            } else {
              state.cv = value;
              state.cv_target = value;
              state.cv_remaining = 0;
            }
          }
          "velocity" => {
            let clamped = value.clamp(0.0, 1.0);
            state.velocity = clamped;
            state.velocity_target = clamped;
            state.velocity_remaining = 0;
          }
          "gate" => {
            state.gate = value;
          }
          _ => {}
        }
      }
      ModuleState::Arpeggiator(state) => match param {
        "enabled" => state.enabled.set(value),
        "hold" => state.hold.set(value),
        "mode" => state.mode.set(value),
        "octaves" => state.octaves.set(value),
        "rate" => state.rate.set(value),
        "gate" => state.gate_len.set(value),
        "swing" => state.swing.set(value),
        "tempo" => state.tempo.set(value),
        "ratchet" => state.ratchet.set(value),
        "ratchetDecay" => state.ratchet_decay.set(value),
        "probability" => state.probability.set(value),
        "velocityMode" => state.velocity_mode.set(value),
        "accentPattern" => state.accent_pattern.set(value),
        "euclidSteps" => state.euclid_steps.set(value),
        "euclidFill" => state.euclid_fill.set(value),
        "euclidRotate" => state.euclid_rotate.set(value),
        "euclidEnabled" => state.euclid_enabled.set(value),
        "mutate" => state.mutate.set(value),
        _ => {}
      },
      ModuleState::StepSequencer(state) => match param {
        "enabled" => state.enabled.set(value),
        "tempo" => state.tempo.set(value),
        "rate" => state.rate.set(value),
        "gateLength" => state.gate_length.set(value),
        "swing" => state.swing.set(value),
        "slideTime" => state.slide_time.set(value),
        "length" => state.length.set(value),
        "direction" => state.direction.set(value),
        _ => {}
      },
      ModuleState::Tb303(state) => match param {
        "waveform" => state.waveform.set(value),
        "cutoff" => state.cutoff.set(value),
        "resonance" => state.resonance.set(value),
        "decay" => state.decay.set(value),
        "envmod" => state.envmod.set(value),
        "accent" => state.accent.set(value),
        "glide" => state.glide.set(value),
        _ => {}
      },
      // TR-909 Drums
      ModuleState::Kick909(state) => match param {
        "tune" => state.tune.set(value),
        "attack" => state.attack.set(value),
        "decay" => state.decay.set(value),
        "drive" => state.drive.set(value),
        _ => {}
      },
      ModuleState::Snare909(state) => match param {
        "tune" => state.tune.set(value),
        "tone" => state.tone.set(value),
        "snappy" => state.snappy.set(value),
        "decay" => state.decay.set(value),
        _ => {}
      },
      ModuleState::HiHat909(state) => match param {
        "tune" => state.tune.set(value),
        "decay" => state.decay.set(value),
        "tone" => state.tone.set(value),
        "open" => state.open.set(value),
        _ => {}
      },
      ModuleState::Clap909(state) => match param {
        "tone" => state.tone.set(value),
        "decay" => state.decay.set(value),
        _ => {}
      },
      ModuleState::Tom909(state) => match param {
        "tune" => state.tune.set(value),
        "decay" => state.decay.set(value),
        _ => {}
      },
      ModuleState::Rimshot909(state) => match param {
        "tune" => state.tune.set(value),
        _ => {}
      },
      ModuleState::DrumSequencer(state) => match param {
        "enabled" => state.enabled.set(value),
        "tempo" => state.tempo.set(value),
        "rate" => state.rate.set(value),
        "gateLength" => state.gate_length.set(value),
        "swing" => state.swing.set(value),
        "length" => state.length.set(value),
        _ => {}
      },
      ModuleState::PitchShifter(state) => match param {
        "pitch" => state.pitch.set(value),
        "fine" => state.fine.set(value),
        "grain" => state.grain.set(value),
        "mix" => state.mix.set(value),
        _ => {}
      },
      _ => {}
    }
  }

  fn apply_param_str(&mut self, param: &str, value: &str) {
    match &mut self.state {
      ModuleState::StepSequencer(state) => {
        if param == "stepData" {
          state.seq.parse_step_data(value);
        }
      }
      ModuleState::DrumSequencer(state) => {
        if param == "drumData" {
          state.seq.parse_drum_data(value);
        }
      }
      _ => {}
    }
  }

  fn process(&mut self, inputs: &[Buffer], outputs: &mut [Buffer], frames: usize, _sample_rate: f32) {
    match &mut self.state {
      ModuleState::Vco(state) => {
        let pitch = inputs[0].channel(0);
        let fm_lin = inputs[1].channel(0);
        let fm_exp = inputs[2].channel(0);
        let pwm_in = inputs[3].channel(0);
        let sync = inputs[4].channel(0);
        let fm_audio = inputs[5].channel(0);
        let (main_group, rest) = outputs.split_at_mut(1);
        let out = main_group[0].channel_mut(0);
        let (sub_group, sync_group) = rest.split_at_mut(1);
        let sub_out = sub_group.get_mut(0).map(|buffer| buffer.channel_mut(0));
        let sync_out = sync_group.get_mut(0).map(|buffer| buffer.channel_mut(0));
        let params = VcoParams {
          base_freq: state.base_freq.slice(frames),
          waveform: state.waveform.slice(frames),
          pwm: state.pwm.slice(frames),
          fm_lin_depth: state.fm_lin_depth.slice(frames),
          fm_exp_depth: state.fm_exp_depth.slice(frames),
          unison: state.unison.slice(frames),
          detune: state.detune.slice(frames),
          sub_mix: state.sub_mix.slice(frames),
          sub_oct: state.sub_oct.slice(frames),
        };
        let inputs = VcoInputs {
          pitch: Some(pitch),
          fm_lin: Some(fm_lin),
          fm_audio: Some(fm_audio),
          fm_exp: Some(fm_exp),
          pwm: Some(pwm_in),
          sync: Some(sync),
        };
        state.vco.process_block(out, sub_out, sync_out, inputs, params);
      }
      ModuleState::Noise(state) => {
        let out = outputs[0].channel_mut(0);
        let params = NoiseParams {
          level: state.level.slice(frames),
          noise_type: state.noise_type.slice(frames),
        };
        state.noise.process_block(out, params);
      }
      ModuleState::ModRouter(state) => {
        let input = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let (pitch_group, rest) = outputs.split_at_mut(1);
        let (pwm_group, rest) = rest.split_at_mut(1);
        let (vcf_group, vca_group) = rest.split_at_mut(1);
        let out_pitch = pitch_group[0].channel_mut(0);
        let out_pwm = pwm_group[0].channel_mut(0);
        let out_vcf = vcf_group[0].channel_mut(0);
        let out_vca = vca_group[0].channel_mut(0);
        let depth_pitch = state.depth_pitch.slice(frames);
        let depth_pwm = state.depth_pwm.slice(frames);
        let depth_vcf = state.depth_vcf.slice(frames);
        let depth_vca = state.depth_vca.slice(frames);
        for i in 0..frames {
          let source = match input {
            Some(values) => {
              if values.len() > 1 {
                values[i]
              } else {
                values[0]
              }
            }
            None => 0.0,
          };
          out_pitch[i] = source * depth_pitch[i];
          out_pwm[i] = source * depth_pwm[i];
          out_vcf[i] = source * depth_vcf[i];
          out_vca[i] = source * depth_vca[i];
        }
      }
      ModuleState::SampleHold(state) => {
        let input = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let trigger = if self.connections[1].is_empty() {
          None
        } else {
          Some(inputs[1].channel(0))
        };
        let params = SampleHoldParams {
          mode: state.mode.slice(frames),
        };
        let inputs = SampleHoldInputs { input, trigger };
        let output = outputs[0].channel_mut(0);
        state.sample_hold.process_block(output, inputs, params);
      }
      ModuleState::Slew(state) => {
        let input = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let params = SlewParams {
          rise: state.rise.slice(frames),
          fall: state.fall.slice(frames),
        };
        let inputs = SlewInputs { input };
        let output = outputs[0].channel_mut(0);
        state.slew.process_block(output, inputs, params);
      }
      ModuleState::Quantizer(state) => {
        let input = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let params = QuantizerParams {
          root: state.root.slice(frames),
          scale: state.scale.slice(frames),
        };
        let inputs = QuantizerInputs { input };
        let output = outputs[0].channel_mut(0);
        Quantizer::process_block(output, inputs, params);
      }
      ModuleState::RingMod(state) => {
        let input_a = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let input_b = if self.connections[1].is_empty() {
          None
        } else {
          Some(inputs[1].channel(0))
        };
        let output = outputs[0].channel_mut(0);
        let params = RingModParams {
          level: state.level.slice(frames),
        };
        RingMod::process_block(output, input_a, input_b, params);
      }
      ModuleState::Gain(state) => {
        let input_connected = !self.connections[0].is_empty();
        let cv_connected = !self.connections[1].is_empty();
        let gain = state.gain.slice(frames);
        let cv = if cv_connected { Some(inputs[1].channel(0)) } else { None };
        for channel in 0..2 {
          let src = if input_connected {
            if inputs[0].channel_count() == 1 {
              inputs[0].channel(0)
            } else {
              inputs[0].channel(channel)
            }
          } else {
            &[]
          };
          let output = outputs[0].channel_mut(channel);
          let input = if input_connected { Some(src) } else { None };
          Vca::process_block(output, input, cv, gain);
        }
      }
      ModuleState::CvVca(state) => {
        let input_connected = !self.connections[0].is_empty();
        let cv_connected = !self.connections[1].is_empty();
        let gain = state.gain.slice(frames);
        let input = if input_connected {
          Some(inputs[0].channel(0))
        } else {
          None
        };
        let cv = if cv_connected { Some(inputs[1].channel(0)) } else { None };
        let output = outputs[0].channel_mut(0);
        Vca::process_block(output, input, cv, gain);
      }
      ModuleState::Output(state) => {
        let input_connected = !self.connections[0].is_empty();
        let gain = state.level.slice(frames);
        for channel in 0..2 {
          let src = if input_connected {
            if inputs[0].channel_count() == 1 {
              inputs[0].channel(0)
            } else {
              inputs[0].channel(channel)
            }
          } else {
            &[]
          };
          let output = outputs[0].channel_mut(channel);
          if input_connected {
            for i in 0..frames {
              output[i] = src[i] * gain[i];
            }
          } else {
            output.fill(0.0);
          }
        }
      }
      ModuleState::Lab(state) => {
        let gain = state.level.slice(frames);
        let in_a_connected = !self.connections[0].is_empty();
        let in_b_connected = !self.connections[1].is_empty();
        let (out_a_group, out_b_group) = outputs.split_at_mut(1);
        let out_a_group = &mut out_a_group[0];
        let out_b_group = &mut out_b_group[0];
        for channel in 0..2 {
          let out_a = out_a_group.channel_mut(channel);
          let out_b = out_b_group.channel_mut(channel);
          let in_a = if in_a_connected {
            if inputs[0].channel_count() == 1 {
              inputs[0].channel(0)
            } else {
              inputs[0].channel(channel)
            }
          } else {
            &[]
          };
          let in_b = if in_b_connected {
            if inputs[1].channel_count() == 1 {
              inputs[1].channel(0)
            } else {
              inputs[1].channel(channel)
            }
          } else {
            &[]
          };
          for i in 0..frames {
            let mut sample = 0.0;
            if in_a_connected {
              sample += in_a[i];
            }
            if in_b_connected {
              sample += in_b[i];
            }
            let value = sample * gain[i];
            out_a[i] = value;
            out_b[i] = value;
          }
        }
      }
      ModuleState::Lfo(state) => {
        let rate_cv = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let sync = if self.connections[1].is_empty() {
          None
        } else {
          Some(inputs[1].channel(0))
        };
        let params = LfoParams {
          rate: state.rate.slice(frames),
          shape: state.shape.slice(frames),
          depth: state.depth.slice(frames),
          offset: state.offset.slice(frames),
          bipolar: state.bipolar.slice(frames),
        };
        let inputs = LfoInputs { rate_cv, sync };
        let output = outputs[0].channel_mut(0);
        state.lfo.process_block(output, inputs, params);
      }
      ModuleState::Adsr(state) => {
        let gate = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let params = AdsrParams {
          attack: state.attack.slice(frames),
          decay: state.decay.slice(frames),
          sustain: state.sustain.slice(frames),
          release: state.release.slice(frames),
        };
        let inputs = AdsrInputs { gate };
        let output = outputs[0].channel_mut(0);
        state.adsr.process_block(output, inputs, params);
      }
      ModuleState::Vcf(state) => {
        let audio = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let mod_in = if self.connections[1].is_empty() {
          None
        } else {
          Some(inputs[1].channel(0))
        };
        let env = if self.connections[2].is_empty() {
          None
        } else {
          Some(inputs[2].channel(0))
        };
        let key = if self.connections[3].is_empty() {
          None
        } else {
          Some(inputs[3].channel(0))
        };
        let params = VcfParams {
          cutoff: state.cutoff.slice(frames),
          resonance: state.resonance.slice(frames),
          drive: state.drive.slice(frames),
          env_amount: state.env_amount.slice(frames),
          mod_amount: state.mod_amount.slice(frames),
          key_track: state.key_track.slice(frames),
          model: state.model.slice(frames),
          mode: state.mode.slice(frames),
          slope: state.slope.slice(frames),
        };
        let inputs = VcfInputs {
          audio,
          mod_in,
          env,
          key,
        };
        let output = outputs[0].channel_mut(0);
        state.vcf.process_block(output, inputs, params);
      }
      ModuleState::Hpf(state) => {
        let audio = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let zero = [0.0_f32];
        let one = [1.0_f32];
        let params = VcfParams {
          cutoff: state.cutoff.slice(frames),
          resonance: &zero,
          drive: &zero,
          env_amount: &zero,
          mod_amount: &zero,
          key_track: &zero,
          model: &zero,
          mode: &one,
          slope: &zero,
        };
        let inputs = VcfInputs {
          audio,
          mod_in: None,
          env: None,
          key: None,
        };
        let output = outputs[0].channel_mut(0);
        state.hpf.process_block(output, inputs, params);
      }
      ModuleState::Mixer(state) => {
        let input_a = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let input_b = if self.connections[1].is_empty() {
          None
        } else {
          Some(inputs[1].channel(0))
        };
        let output = outputs[0].channel_mut(0);
        Mixer::process_block(
          output,
          input_a,
          input_b,
          state.level_a.slice(frames),
          state.level_b.slice(frames),
        );
      }
      ModuleState::MixerWide(state) => {
        let input_a = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let input_b = if self.connections[1].is_empty() {
          None
        } else {
          Some(inputs[1].channel(0))
        };
        let input_c = if self.connections[2].is_empty() {
          None
        } else {
          Some(inputs[2].channel(0))
        };
        let input_d = if self.connections[3].is_empty() {
          None
        } else {
          Some(inputs[3].channel(0))
        };
        let input_e = if self.connections[4].is_empty() {
          None
        } else {
          Some(inputs[4].channel(0))
        };
        let input_f = if self.connections[5].is_empty() {
          None
        } else {
          Some(inputs[5].channel(0))
        };
        let output = outputs[0].channel_mut(0);
        let inputs = [input_a, input_b, input_c, input_d, input_e, input_f];
        let levels = [
          state.level_a.slice(frames),
          state.level_b.slice(frames),
          state.level_c.slice(frames),
          state.level_d.slice(frames),
          state.level_e.slice(frames),
          state.level_f.slice(frames),
        ];
        Mixer::process_block_multi(output, &inputs, &levels);
      }
      ModuleState::Chorus(state) => {
        let input_connected = !self.connections[0].is_empty();
        let input_l = if input_connected {
          Some(inputs[0].channel(0))
        } else {
          None
        };
        let input_r = if input_connected {
          Some(if inputs[0].channel_count() == 1 {
            inputs[0].channel(0)
          } else {
            inputs[0].channel(1)
          })
        } else {
          None
        };
        let params = ChorusParams {
          rate: state.rate.slice(frames),
          depth_ms: state.depth.slice(frames),
          delay_ms: state.delay.slice(frames),
          mix: state.mix.slice(frames),
          feedback: state.feedback.slice(frames),
          spread: state.spread.slice(frames),
        };
        let inputs = ChorusInputs { input_l, input_r };
        let (left, right) = outputs[0].channels.split_at_mut(1);
        let out_l = &mut left[0];
        let out_r = &mut right[0];
        state.chorus.process_block(out_l, out_r, inputs, params);
      }
      ModuleState::Ensemble(state) => {
        let input_connected = !self.connections[0].is_empty();
        let input_l = if input_connected {
          Some(inputs[0].channel(0))
        } else {
          None
        };
        let input_r = if input_connected {
          Some(if inputs[0].channel_count() == 1 {
            inputs[0].channel(0)
          } else {
            inputs[0].channel(1)
          })
        } else {
          None
        };
        let params = EnsembleParams {
          rate: state.rate.slice(frames),
          depth_ms: state.depth.slice(frames),
          delay_ms: state.delay.slice(frames),
          mix: state.mix.slice(frames),
          spread: state.spread.slice(frames),
        };
        let inputs = EnsembleInputs { input_l, input_r };
        let (left, right) = outputs[0].channels.split_at_mut(1);
        let out_l = &mut left[0];
        let out_r = &mut right[0];
        state.ensemble.process_block(out_l, out_r, inputs, params);
      }
      ModuleState::Choir(state) => {
        let input_connected = !self.connections[0].is_empty();
        let input_l = if input_connected {
          Some(inputs[0].channel(0))
        } else {
          None
        };
        let input_r = if input_connected {
          Some(if inputs[0].channel_count() == 1 {
            inputs[0].channel(0)
          } else {
            inputs[0].channel(1)
          })
        } else {
          None
        };
        let params = ChoirParams {
          vowel: state.vowel.slice(frames),
          rate: state.rate.slice(frames),
          depth: state.depth.slice(frames),
          mix: state.mix.slice(frames),
        };
        let inputs = ChoirInputs { input_l, input_r };
        let (left, right) = outputs[0].channels.split_at_mut(1);
        let out_l = &mut left[0];
        let out_r = &mut right[0];
        state.choir.process_block(out_l, out_r, inputs, params);
      }
      ModuleState::AudioIn(_) => {
        // Handled in GraphEngine::render via external input injection.
      }
      ModuleState::Vocoder(state) => {
        let mod_input = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let car_input = if self.connections[1].is_empty() {
          None
        } else {
          Some(inputs[1].channel(0))
        };
        let params = VocoderParams {
          attack: state.attack.slice(frames),
          release: state.release.slice(frames),
          low: state.low.slice(frames),
          high: state.high.slice(frames),
          q: state.q.slice(frames),
          formant: state.formant.slice(frames),
          emphasis: state.emphasis.slice(frames),
          unvoiced: state.unvoiced.slice(frames),
          mix: state.mix.slice(frames),
          mod_gain: state.mod_gain.slice(frames),
          car_gain: state.car_gain.slice(frames),
        };
        let inputs = VocoderInputs {
          modulator: mod_input,
          carrier: car_input,
        };
        let output = outputs[0].channel_mut(0);
        state.vocoder.process_block(output, inputs, params);
      }
      ModuleState::Delay(state) => {
        let input_connected = !self.connections[0].is_empty();
        let input_l = if input_connected {
          Some(inputs[0].channel(0))
        } else {
          None
        };
        let input_r = if input_connected {
          Some(if inputs[0].channel_count() == 1 {
            inputs[0].channel(0)
          } else {
            inputs[0].channel(1)
          })
        } else {
          None
        };
        let params = DelayParams {
          time_ms: state.time.slice(frames),
          feedback: state.feedback.slice(frames),
          mix: state.mix.slice(frames),
          tone: state.tone.slice(frames),
          ping_pong: state.ping_pong.slice(frames),
        };
        let inputs = DelayInputs { input_l, input_r };
        let (left, right) = outputs[0].channels.split_at_mut(1);
        let out_l = &mut left[0];
        let out_r = &mut right[0];
        state.delay.process_block(out_l, out_r, inputs, params);
      }
      ModuleState::GranularDelay(state) => {
        let input_connected = !self.connections[0].is_empty();
        let input_l = if input_connected {
          Some(inputs[0].channel(0))
        } else {
          None
        };
        let input_r = if input_connected {
          Some(if inputs[0].channel_count() == 1 {
            inputs[0].channel(0)
          } else {
            inputs[0].channel(1)
          })
        } else {
          None
        };
        let params = GranularDelayParams {
          time_ms: state.time.slice(frames),
          size_ms: state.size.slice(frames),
          density: state.density.slice(frames),
          pitch: state.pitch.slice(frames),
          feedback: state.feedback.slice(frames),
          mix: state.mix.slice(frames),
        };
        let inputs = GranularDelayInputs { input_l, input_r };
        let (left, right) = outputs[0].channels.split_at_mut(1);
        let out_l = &mut left[0];
        let out_r = &mut right[0];
        state.delay.process_block(out_l, out_r, inputs, params);
      }
      ModuleState::TapeDelay(state) => {
        let input_connected = !self.connections[0].is_empty();
        let input_l = if input_connected {
          Some(inputs[0].channel(0))
        } else {
          None
        };
        let input_r = if input_connected {
          Some(if inputs[0].channel_count() == 1 {
            inputs[0].channel(0)
          } else {
            inputs[0].channel(1)
          })
        } else {
          None
        };
        let params = TapeDelayParams {
          time_ms: state.time.slice(frames),
          feedback: state.feedback.slice(frames),
          mix: state.mix.slice(frames),
          tone: state.tone.slice(frames),
          wow: state.wow.slice(frames),
          flutter: state.flutter.slice(frames),
          drive: state.drive.slice(frames),
        };
        let inputs = TapeDelayInputs { input_l, input_r };
        let (left, right) = outputs[0].channels.split_at_mut(1);
        let out_l = &mut left[0];
        let out_r = &mut right[0];
        state.delay.process_block(out_l, out_r, inputs, params);
      }
      ModuleState::SpringReverb(state) => {
        let input_connected = !self.connections[0].is_empty();
        let input_l = if input_connected {
          Some(inputs[0].channel(0))
        } else {
          None
        };
        let input_r = if input_connected {
          Some(if inputs[0].channel_count() == 1 {
            inputs[0].channel(0)
          } else {
            inputs[0].channel(1)
          })
        } else {
          None
        };
        let params = SpringReverbParams {
          decay: state.decay.slice(frames),
          tone: state.tone.slice(frames),
          mix: state.mix.slice(frames),
          drive: state.drive.slice(frames),
        };
        let inputs = SpringReverbInputs { input_l, input_r };
        let (left, right) = outputs[0].channels.split_at_mut(1);
        let out_l = &mut left[0];
        let out_r = &mut right[0];
        state.reverb.process_block(out_l, out_r, inputs, params);
      }
      ModuleState::Reverb(state) => {
        let input_connected = !self.connections[0].is_empty();
        let input_l = if input_connected {
          Some(inputs[0].channel(0))
        } else {
          None
        };
        let input_r = if input_connected {
          Some(if inputs[0].channel_count() == 1 {
            inputs[0].channel(0)
          } else {
            inputs[0].channel(1)
          })
        } else {
          None
        };
        let params = ReverbParams {
          time: state.time.slice(frames),
          damp: state.damp.slice(frames),
          pre_delay: state.pre_delay.slice(frames),
          mix: state.mix.slice(frames),
        };
        let inputs = ReverbInputs { input_l, input_r };
        let (left, right) = outputs[0].channels.split_at_mut(1);
        let out_l = &mut left[0];
        let out_r = &mut right[0];
        state.reverb.process_block(out_l, out_r, inputs, params);
      }
      ModuleState::Phaser(state) => {
        let input_connected = !self.connections[0].is_empty();
        let input_l = if input_connected {
          Some(inputs[0].channel(0))
        } else {
          None
        };
        let input_r = if input_connected {
          Some(if inputs[0].channel_count() == 1 {
            inputs[0].channel(0)
          } else {
            inputs[0].channel(1)
          })
        } else {
          None
        };
        let params = PhaserParams {
          rate: state.rate.slice(frames),
          depth: state.depth.slice(frames),
          feedback: state.feedback.slice(frames),
          mix: state.mix.slice(frames),
        };
        let inputs = PhaserInputs { input_l, input_r };
        let (left, right) = outputs[0].channels.split_at_mut(1);
        let out_l = &mut left[0];
        let out_r = &mut right[0];
        state.phaser.process_block(out_l, out_r, inputs, params);
      }
      ModuleState::Distortion(state) => {
        let input_connected = !self.connections[0].is_empty();
        let input = if input_connected {
          Some(inputs[0].channel(0))
        } else {
          None
        };
        let params = DistortionParams {
          drive: state.drive.slice(frames),
          tone: state.tone.slice(frames),
          mix: state.mix.slice(frames),
          mode: state.mode.slice(frames),
        };
        let output = outputs[0].channel_mut(0);
        Distortion::process_block(output, input, params);
      }
      ModuleState::Wavefolder(state) => {
        let input_connected = !self.connections[0].is_empty();
        let input = if input_connected {
          Some(inputs[0].channel(0))
        } else {
          None
        };
        let params = WavefolderParams {
          drive: state.drive.slice(frames),
          fold: state.fold.slice(frames),
          bias: state.bias.slice(frames),
          mix: state.mix.slice(frames),
        };
        let output = outputs[0].channel_mut(0);
        Wavefolder::process_block(output, input, params);
      }
      ModuleState::Supersaw(state) => {
        let pitch = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let params = SupersawParams {
          base_freq: state.base_freq.slice(frames),
          detune: state.detune.slice(frames),
          mix: state.mix.slice(frames),
        };
        let inputs = SupersawInputs { pitch };
        let output = outputs[0].channel_mut(0);
        state.supersaw.process_block(output, inputs, params);
      }
      ModuleState::NesOsc(state) => {
        let pitch = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let params = NesOscParams {
          base_freq: state.base_freq.slice(frames),
          fine: state.fine.slice(frames),
          volume: state.volume.slice(frames),
          mode: state.mode.slice(frames),
          duty: state.duty.slice(frames),
          noise_mode: state.noise_mode.slice(frames),
          bitcrush: state.bitcrush.slice(frames),
        };
        let inputs = NesOscInputs { pitch };
        let output = outputs[0].channel_mut(0);
        state.nes_osc.process_block(output, inputs, params);
      }
      ModuleState::SnesOsc(state) => {
        let pitch = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let params = SnesOscParams {
          base_freq: state.base_freq.slice(frames),
          fine: state.fine.slice(frames),
          volume: state.volume.slice(frames),
          wave: state.wave.slice(frames),
          gauss: state.gauss.slice(frames),
          color: state.color.slice(frames),
          lofi: state.lofi.slice(frames),
        };
        let inputs = SnesOscInputs { pitch };
        let output = outputs[0].channel_mut(0);
        state.snes_osc.process_block(output, inputs, params);
      }
      ModuleState::Control(state) => {
        let (cv_group, rest) = outputs.split_at_mut(1);
        let (vel_group, rest) = rest.split_at_mut(1);
        let (gate_group, rest) = rest.split_at_mut(1);
        let cv_out = cv_group[0].channel_mut(0);
        let vel_out = vel_group[0].channel_mut(0);
        let gate_out = gate_group[0].channel_mut(0);
        let sync_out = rest[0].channel_mut(0);
        for i in 0..frames {
          if state.cv_remaining > 0 {
            state.cv += state.cv_step;
            state.cv_remaining -= 1;
          }
          if state.velocity_remaining > 0 {
            state.velocity += state.velocity_step;
            state.velocity_remaining -= 1;
          }
          cv_out[i] = state.cv;
          vel_out[i] = state.velocity;
          // During retrigger period, output gate=0 to force rising edge
          if state.retrigger_samples > 0 {
            gate_out[i] = 0.0;
            state.retrigger_samples -= 1;
          } else {
            gate_out[i] = state.gate;
          }
          if state.sync_remaining > 0 {
            sync_out[i] = 1.0;
            state.sync_remaining -= 1;
          } else {
            sync_out[i] = 0.0;
          }
        }
      }
      ModuleState::Scope => {
        let in_a_connected = !self.connections[0].is_empty();
        let in_b_connected = !self.connections[1].is_empty();
        let (out_a_group, out_b_group) = outputs.split_at_mut(1);
        let out_a = &mut out_a_group[0];
        let out_b = &mut out_b_group[0];
        out_a.resize(2, frames);
        out_b.resize(2, frames);
        out_a.clear();
        out_b.clear();
        if in_a_connected {
          mix_buffers(out_a, &inputs[0], 1.0);
        }
        if in_b_connected {
          mix_buffers(out_b, &inputs[1], 1.0);
        }
      }
      ModuleState::Mario(state) => {
        for channel in 0..5 {
          let split_index = channel * 2 + 1;
          let (before, after) = outputs.split_at_mut(split_index);
          let cv_out = before[channel * 2].channel_mut(0);
          let gate_out = after[0].channel_mut(0);
          for i in 0..frames {
            cv_out[i] = state.cv[channel];
            gate_out[i] = state.gate[channel];
          }
        }
      }
      ModuleState::Arpeggiator(state) => {
        let cv_in = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let gate_in = if self.connections[1].is_empty() {
          None
        } else {
          Some(inputs[1].channel(0))
        };
        let clock = if self.connections[2].is_empty() {
          None
        } else {
          Some(inputs[2].channel(0))
        };
        let (cv_group, rest) = outputs.split_at_mut(1);
        let (gate_group, accent_group) = rest.split_at_mut(1);
        let cv_out = cv_group[0].channel_mut(0);
        let gate_out = gate_group[0].channel_mut(0);
        let accent_out = accent_group[0].channel_mut(0);
        let arp_inputs = ArpeggiatorInputs { cv_in, gate_in, clock };
        let params = ArpeggiatorParams {
          enabled: state.enabled.slice(frames),
          hold: state.hold.slice(frames),
          mode: state.mode.slice(frames),
          octaves: state.octaves.slice(frames),
          rate: state.rate.slice(frames),
          gate: state.gate_len.slice(frames),
          swing: state.swing.slice(frames),
          tempo: state.tempo.slice(frames),
          ratchet: state.ratchet.slice(frames),
          ratchet_decay: state.ratchet_decay.slice(frames),
          probability: state.probability.slice(frames),
          velocity_mode: state.velocity_mode.slice(frames),
          accent_pattern: state.accent_pattern.slice(frames),
          euclid_steps: state.euclid_steps.slice(frames),
          euclid_fill: state.euclid_fill.slice(frames),
          euclid_rotate: state.euclid_rotate.slice(frames),
          euclid_enabled: state.euclid_enabled.slice(frames),
          mutate: state.mutate.slice(frames),
        };
        let arp_outputs = ArpeggiatorOutputs { cv_out, gate_out, accent_out };
        state.arp.process_block(arp_outputs, arp_inputs, params);
      }
      ModuleState::StepSequencer(state) => {
        let clock = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let reset = if self.connections[1].is_empty() {
          None
        } else {
          Some(inputs[1].channel(0))
        };
        let cv_offset = if self.connections[2].is_empty() {
          None
        } else {
          Some(inputs[2].channel(0))
        };
        let (cv_group, rest) = outputs.split_at_mut(1);
        let (gate_group, rest2) = rest.split_at_mut(1);
        let (vel_group, step_group) = rest2.split_at_mut(1);
        let cv_out = cv_group[0].channel_mut(0);
        let gate_out = gate_group[0].channel_mut(0);
        let velocity_out = vel_group[0].channel_mut(0);
        let step_out = step_group[0].channel_mut(0);
        let seq_inputs = StepSequencerInputs { clock, reset, cv_offset };
        let params = StepSequencerParams {
          enabled: state.enabled.slice(frames),
          tempo: state.tempo.slice(frames),
          rate: state.rate.slice(frames),
          gate_length: state.gate_length.slice(frames),
          swing: state.swing.slice(frames),
          slide_time: state.slide_time.slice(frames),
          length: state.length.slice(frames),
          direction: state.direction.slice(frames),
        };
        let seq_outputs = StepSequencerOutputs { cv_out, gate_out, velocity_out, step_out };
        state.seq.process_block(seq_outputs, seq_inputs, params);
      }
      ModuleState::Tb303(state) => {
        let pitch = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let gate = if self.connections[1].is_empty() {
          None
        } else {
          Some(inputs[1].channel(0))
        };
        let velocity = if self.connections[2].is_empty() {
          None
        } else {
          Some(inputs[2].channel(0))
        };
        let cutoff_cv = if self.connections[3].is_empty() {
          None
        } else {
          Some(inputs[3].channel(0))
        };
        let (audio_group, env_group) = outputs.split_at_mut(1);
        let audio = audio_group[0].channel_mut(0);
        let env_out = env_group[0].channel_mut(0);
        let tb_inputs = Tb303Inputs { pitch, gate, velocity, cutoff_cv };
        let params = Tb303Params {
          waveform: state.waveform.slice(frames),
          cutoff: state.cutoff.slice(frames),
          resonance: state.resonance.slice(frames),
          decay: state.decay.slice(frames),
          envmod: state.envmod.slice(frames),
          accent: state.accent.slice(frames),
          glide: state.glide.slice(frames),
        };
        let tb_outputs = Tb303Outputs { audio, env_out };
        state.tb303.process_block(tb_outputs, tb_inputs, params);
      }
      // TR-909 Drums
      ModuleState::Kick909(state) => {
        let trigger = if self.connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
        let accent = if self.connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
        let out = outputs[0].channel_mut(0);
        let inputs = Kick909Inputs { trigger, accent };
        let params = Kick909Params {
          tune: state.tune.slice(frames),
          attack: state.attack.slice(frames),
          decay: state.decay.slice(frames),
          drive: state.drive.slice(frames),
        };
        state.kick.process_block(out, inputs, params);
      }
      ModuleState::Snare909(state) => {
        let trigger = if self.connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
        let accent = if self.connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
        let out = outputs[0].channel_mut(0);
        let inputs = Snare909Inputs { trigger, accent };
        let params = Snare909Params {
          tune: state.tune.slice(frames),
          tone: state.tone.slice(frames),
          snappy: state.snappy.slice(frames),
          decay: state.decay.slice(frames),
        };
        state.snare.process_block(out, inputs, params);
      }
      ModuleState::HiHat909(state) => {
        let trigger = if self.connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
        let accent = if self.connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
        let out = outputs[0].channel_mut(0);
        let inputs = HiHat909Inputs { trigger, accent };
        let params = HiHat909Params {
          tune: state.tune.slice(frames),
          decay: state.decay.slice(frames),
          tone: state.tone.slice(frames),
          open: state.open.slice(frames),
        };
        state.hihat.process_block(out, inputs, params);
      }
      ModuleState::Clap909(state) => {
        let trigger = if self.connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
        let accent = if self.connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
        let out = outputs[0].channel_mut(0);
        let inputs = Clap909Inputs { trigger, accent };
        let params = Clap909Params {
          tone: state.tone.slice(frames),
          decay: state.decay.slice(frames),
        };
        state.clap.process_block(out, inputs, params);
      }
      ModuleState::Tom909(state) => {
        let trigger = if self.connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
        let accent = if self.connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
        let out = outputs[0].channel_mut(0);
        let inputs = Tom909Inputs { trigger, accent };
        let params = Tom909Params {
          tune: state.tune.slice(frames),
          decay: state.decay.slice(frames),
        };
        state.tom.process_block(out, inputs, params);
      }
      ModuleState::Rimshot909(state) => {
        let trigger = if self.connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
        let accent = if self.connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
        let out = outputs[0].channel_mut(0);
        let inputs = Rimshot909Inputs { trigger, accent };
        let params = Rimshot909Params {
          tune: state.tune.slice(frames),
        };
        state.rimshot.process_block(out, inputs, params);
      }
      ModuleState::DrumSequencer(state) => {
        let clock = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let reset = if self.connections[1].is_empty() {
          None
        } else {
          Some(inputs[1].channel(0))
        };

        // Create individual temporary buffers (avoids array borrowing issues)
        // Use 1024 to handle larger buffer sizes safely
        const DRUM_BUF_SIZE: usize = 1024;
        let safe_frames = frames.min(DRUM_BUF_SIZE);
        let mut buf_gate_kick: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_gate_snare: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_gate_hhc: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_gate_hho: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_gate_clap: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_gate_tom: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_gate_rim: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_gate_aux: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_acc_kick: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_acc_snare: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_acc_hhc: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_acc_hho: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_acc_clap: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_acc_tom: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_acc_rim: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_acc_aux: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
        let mut buf_step: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];

        // Process into temp buffers
        let seq_inputs = DrumSequencerInputs { clock, reset };
        let seq_params = DrumSequencerParams {
          enabled: state.enabled.slice(safe_frames),
          tempo: state.tempo.slice(safe_frames),
          rate: state.rate.slice(safe_frames),
          gate_length: state.gate_length.slice(safe_frames),
          swing: state.swing.slice(safe_frames),
          length: state.length.slice(safe_frames),
        };
        let seq_outputs = DrumSequencerOutputs {
          gate_kick: &mut buf_gate_kick[..safe_frames],
          gate_snare: &mut buf_gate_snare[..safe_frames],
          gate_hhc: &mut buf_gate_hhc[..safe_frames],
          gate_hho: &mut buf_gate_hho[..safe_frames],
          gate_clap: &mut buf_gate_clap[..safe_frames],
          gate_tom: &mut buf_gate_tom[..safe_frames],
          gate_rim: &mut buf_gate_rim[..safe_frames],
          gate_aux: &mut buf_gate_aux[..safe_frames],
          acc_kick: &mut buf_acc_kick[..safe_frames],
          acc_snare: &mut buf_acc_snare[..safe_frames],
          acc_hhc: &mut buf_acc_hhc[..safe_frames],
          acc_hho: &mut buf_acc_hho[..safe_frames],
          acc_clap: &mut buf_acc_clap[..safe_frames],
          acc_tom: &mut buf_acc_tom[..safe_frames],
          acc_rim: &mut buf_acc_rim[..safe_frames],
          acc_aux: &mut buf_acc_aux[..safe_frames],
          step_out: &mut buf_step[..safe_frames],
        };
        state.seq.process_block(seq_outputs, seq_inputs, seq_params);

        // Copy temp buffers to outputs
        outputs[0].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_kick[..safe_frames]);
        outputs[1].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_snare[..safe_frames]);
        outputs[2].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_hhc[..safe_frames]);
        outputs[3].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_hho[..safe_frames]);
        outputs[4].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_clap[..safe_frames]);
        outputs[5].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_tom[..safe_frames]);
        outputs[6].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_rim[..safe_frames]);
        outputs[7].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_aux[..safe_frames]);
        outputs[8].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_kick[..safe_frames]);
        outputs[9].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_snare[..safe_frames]);
        outputs[10].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_hhc[..safe_frames]);
        outputs[11].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_hho[..safe_frames]);
        outputs[12].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_clap[..safe_frames]);
        outputs[13].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_tom[..safe_frames]);
        outputs[14].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_rim[..safe_frames]);
        outputs[15].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_aux[..safe_frames]);
        outputs[16].channel_mut(0)[..safe_frames].copy_from_slice(&buf_step[..safe_frames]);
      }
      ModuleState::PitchShifter(state) => {
        let input = if self.connections[0].is_empty() {
          None
        } else {
          Some(inputs[0].channel(0))
        };
        let pitch_cv = if self.connections.len() > 1 && !self.connections[1].is_empty() {
          Some(inputs[1].channel(0))
        } else {
          None
        };
        let params = PitchShifterParams {
          pitch: state.pitch.slice(frames),
          fine: state.fine.slice(frames),
          grain_ms: state.grain.slice(frames),
          mix: state.mix.slice(frames),
        };
        let shifter_inputs = PitchShifterInputs { input, pitch_cv };
        state.shifter.process_block(outputs[0].channel_mut(0), shifter_inputs, params);
      }
    }
  }
}
fn normalize_module_type(raw: &str) -> ModuleType {
  match raw {
    "oscillator" => ModuleType::Oscillator,
    "supersaw" => ModuleType::Supersaw,
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
    // Drum Sequencer
    "drum-sequencer" => ModuleType::DrumSequencer,
    // Effects
    "pitch-shifter" => ModuleType::PitchShifter,
    _ => ModuleType::Oscillator,
  }
}

fn is_poly_type(module_type: ModuleType) -> bool {
  matches!(
    module_type,
    ModuleType::Oscillator
      | ModuleType::Supersaw
      | ModuleType::NesOsc
      | ModuleType::SnesOsc
      | ModuleType::Noise
      | ModuleType::ModRouter
      | ModuleType::SampleHold
      | ModuleType::Slew
      | ModuleType::Quantizer
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
  )
}

fn input_ports(module_type: ModuleType) -> Vec<PortInfo> {
  match module_type {
    ModuleType::Oscillator => vec![
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::Noise => vec![],
    ModuleType::ModRouter => vec![PortInfo { channels: 1 }],
    ModuleType::SampleHold => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::Slew => vec![PortInfo { channels: 1 }],
    ModuleType::Quantizer => vec![PortInfo { channels: 1 }],
    ModuleType::RingMod => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::Gain => vec![PortInfo { channels: 2 }, PortInfo { channels: 1 }],
    ModuleType::CvVca => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::Output => vec![PortInfo { channels: 2 }],
    ModuleType::Lab => vec![PortInfo { channels: 2 }, PortInfo { channels: 2 }],
    ModuleType::Lfo => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::Adsr => vec![PortInfo { channels: 1 }],
    ModuleType::Vcf => vec![
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::Hpf => vec![PortInfo { channels: 1 }],
    ModuleType::Mixer => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::MixerWide => vec![
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::Chorus
    | ModuleType::Ensemble
    | ModuleType::Choir
    | ModuleType::Delay
    | ModuleType::GranularDelay
    | ModuleType::TapeDelay
    | ModuleType::SpringReverb
    | ModuleType::Reverb
    | ModuleType::Phaser => {
      vec![PortInfo { channels: 2 }]
    },
    ModuleType::Distortion => vec![PortInfo { channels: 1 }],
    ModuleType::Wavefolder => vec![PortInfo { channels: 1 }],
    ModuleType::Supersaw => vec![PortInfo { channels: 1 }],
    ModuleType::NesOsc => vec![PortInfo { channels: 1 }],  // pitch input
    ModuleType::SnesOsc => vec![PortInfo { channels: 1 }],  // pitch input
    ModuleType::AudioIn => vec![],
    ModuleType::Vocoder => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::Control => vec![],
    ModuleType::Scope => vec![
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::Mario => vec![],
    ModuleType::Arpeggiator => vec![
      PortInfo { channels: 1 },  // cv-in
      PortInfo { channels: 1 },  // gate-in
      PortInfo { channels: 1 },  // clock
    ],
    ModuleType::StepSequencer => vec![
      PortInfo { channels: 1 },  // clock
      PortInfo { channels: 1 },  // reset
      PortInfo { channels: 1 },  // cv-offset
    ],
    ModuleType::Tb303 => vec![
      PortInfo { channels: 1 },  // pitch
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // velocity
      PortInfo { channels: 1 },  // cutoff-cv
    ],
    // TR-909 Drums - all have trigger + accent inputs
    ModuleType::Kick909 | ModuleType::Snare909 | ModuleType::HiHat909 |
    ModuleType::Clap909 | ModuleType::Tom909 | ModuleType::Rimshot909 => vec![
      PortInfo { channels: 1 },  // trigger
      PortInfo { channels: 1 },  // accent
    ],
    // Drum Sequencer - 2 inputs (clock, reset)
    ModuleType::DrumSequencer => vec![
      PortInfo { channels: 1 },  // clock
      PortInfo { channels: 1 },  // reset
    ],
    // Pitch Shifter - 2 inputs (audio, pitch CV)
    ModuleType::PitchShifter => vec![
      PortInfo { channels: 1 },  // audio input
      PortInfo { channels: 1 },  // pitch CV
    ],
  }
}

fn output_ports(module_type: ModuleType) -> Vec<PortInfo> {
  match module_type {
    ModuleType::Oscillator => vec![
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::Noise => vec![PortInfo { channels: 1 }],
    ModuleType::ModRouter => vec![
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::SampleHold => vec![PortInfo { channels: 1 }],
    ModuleType::Slew => vec![PortInfo { channels: 1 }],
    ModuleType::Quantizer => vec![PortInfo { channels: 1 }],
    ModuleType::RingMod => vec![PortInfo { channels: 1 }],
    ModuleType::Gain => vec![PortInfo { channels: 2 }],
    ModuleType::CvVca => vec![PortInfo { channels: 1 }],
    ModuleType::Output => vec![PortInfo { channels: 2 }],
    ModuleType::Lab => vec![PortInfo { channels: 2 }, PortInfo { channels: 2 }],
    ModuleType::Lfo => vec![PortInfo { channels: 1 }],
    ModuleType::Adsr => vec![PortInfo { channels: 1 }],
    ModuleType::Vcf => vec![PortInfo { channels: 1 }],
    ModuleType::Hpf => vec![PortInfo { channels: 1 }],
    ModuleType::Mixer => vec![PortInfo { channels: 1 }],
    ModuleType::MixerWide => vec![PortInfo { channels: 1 }],
    ModuleType::Chorus
    | ModuleType::Ensemble
    | ModuleType::Choir
    | ModuleType::Delay
    | ModuleType::GranularDelay
    | ModuleType::TapeDelay
    | ModuleType::SpringReverb
    | ModuleType::Reverb
    | ModuleType::Phaser => {
      vec![PortInfo { channels: 2 }]
    },
    ModuleType::Distortion => vec![PortInfo { channels: 1 }],
    ModuleType::Wavefolder => vec![PortInfo { channels: 1 }],
    ModuleType::Supersaw => vec![PortInfo { channels: 1 }],
    ModuleType::NesOsc => vec![PortInfo { channels: 1 }],  // audio output
    ModuleType::SnesOsc => vec![PortInfo { channels: 1 }],  // audio output
    ModuleType::AudioIn => vec![PortInfo { channels: 1 }],
    ModuleType::Vocoder => vec![PortInfo { channels: 1 }],
    ModuleType::Control => vec![
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::Scope => vec![PortInfo { channels: 2 }, PortInfo { channels: 2 }],
    ModuleType::Mario => {
      let mut outputs = Vec::new();
      for _ in 0..5 {
        outputs.push(PortInfo { channels: 1 });
        outputs.push(PortInfo { channels: 1 });
      }
      outputs
    }
    ModuleType::Arpeggiator => vec![
      PortInfo { channels: 1 },  // cv-out
      PortInfo { channels: 1 },  // gate-out
      PortInfo { channels: 1 },  // accent
    ],
    ModuleType::StepSequencer => vec![
      PortInfo { channels: 1 },  // cv-out
      PortInfo { channels: 1 },  // gate-out
      PortInfo { channels: 1 },  // velocity-out
      PortInfo { channels: 1 },  // step-out
    ],
    ModuleType::Tb303 => vec![
      PortInfo { channels: 1 },  // out
      PortInfo { channels: 1 },  // env-out
    ],
    // TR-909 Drums - all have single audio output
    ModuleType::Kick909 | ModuleType::Snare909 | ModuleType::HiHat909 |
    ModuleType::Clap909 | ModuleType::Tom909 | ModuleType::Rimshot909 => vec![
      PortInfo { channels: 1 },  // out
    ],
    // Drum Sequencer - 17 outputs (8 gates + 8 accents + step)
    ModuleType::DrumSequencer => vec![
      PortInfo { channels: 1 },  // gate-kick
      PortInfo { channels: 1 },  // gate-snare
      PortInfo { channels: 1 },  // gate-hhc
      PortInfo { channels: 1 },  // gate-hho
      PortInfo { channels: 1 },  // gate-clap
      PortInfo { channels: 1 },  // gate-tom
      PortInfo { channels: 1 },  // gate-rim
      PortInfo { channels: 1 },  // gate-aux
      PortInfo { channels: 1 },  // acc-kick
      PortInfo { channels: 1 },  // acc-snare
      PortInfo { channels: 1 },  // acc-hhc
      PortInfo { channels: 1 },  // acc-hho
      PortInfo { channels: 1 },  // acc-clap
      PortInfo { channels: 1 },  // acc-tom
      PortInfo { channels: 1 },  // acc-rim
      PortInfo { channels: 1 },  // acc-aux
      PortInfo { channels: 1 },  // step-out
    ],
    // Pitch Shifter - 1 output
    ModuleType::PitchShifter => vec![PortInfo { channels: 1 }],
  }
}

fn input_port_index(module_type: ModuleType, port_id: &str) -> Option<usize> {
  match module_type {
    ModuleType::Oscillator => match port_id {
      "pitch" => Some(0),
      "fm-lin" | "fmLin" => Some(1),
      "fm-exp" | "fmExp" => Some(2),
      "pwm" => Some(3),
      "sync" => Some(4),
      "fm-audio" => Some(5),
      _ => None,
    },
    ModuleType::ModRouter => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::SampleHold => match port_id {
      "in" => Some(0),
      "trig" => Some(1),
      _ => None,
    },
    ModuleType::Slew => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::Quantizer => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::RingMod => match port_id {
      "in-a" => Some(0),
      "in-b" => Some(1),
      _ => None,
    },
    ModuleType::Hpf => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::Gain => match port_id {
      "in" => Some(0),
      "cv" => Some(1),
      _ => None,
    },
    ModuleType::CvVca => match port_id {
      "in" => Some(0),
      "cv" => Some(1),
      _ => None,
    },
    ModuleType::Output => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::Lab => match port_id {
      "in-a" => Some(0),
      "in-b" => Some(1),
      _ => None,
    },
    ModuleType::Lfo => match port_id {
      "rate" => Some(0),
      "sync" => Some(1),
      _ => None,
    },
    ModuleType::Adsr => match port_id {
      "gate" => Some(0),
      _ => None,
    },
    ModuleType::Vcf => match port_id {
      "in" => Some(0),
      "mod" => Some(1),
      "env" => Some(2),
      "key" => Some(3),
      _ => None,
    },
    ModuleType::Mixer => match port_id {
      "in-a" => Some(0),
      "in-b" => Some(1),
      _ => None,
    },
    ModuleType::MixerWide => match port_id {
      "in-a" => Some(0),
      "in-b" => Some(1),
      "in-c" => Some(2),
      "in-d" => Some(3),
      "in-e" => Some(4),
      "in-f" => Some(5),
      _ => None,
    },
    ModuleType::Chorus
    | ModuleType::Ensemble
    | ModuleType::Choir
    | ModuleType::Delay
    | ModuleType::GranularDelay
    | ModuleType::TapeDelay
    | ModuleType::SpringReverb
    | ModuleType::Reverb
    | ModuleType::Phaser => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::Distortion => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::Wavefolder => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::Supersaw => match port_id {
      "pitch" => Some(0),
      _ => None,
    },
    ModuleType::NesOsc => match port_id {
      "pitch" => Some(0),
      _ => None,
    },
    ModuleType::SnesOsc => match port_id {
      "pitch" => Some(0),
      _ => None,
    },
    ModuleType::Vocoder => match port_id {
      "mod" => Some(0),
      "car" => Some(1),
      _ => None,
    },
    ModuleType::Scope => match port_id {
      "in-a" => Some(0),
      "in-b" => Some(1),
      "in-c" => Some(2),
      "in-d" => Some(3),
      _ => None,
    },
    ModuleType::Arpeggiator => match port_id {
      "cv-in" => Some(0),
      "gate-in" => Some(1),
      "clock" => Some(2),
      _ => None,
    },
    ModuleType::StepSequencer => match port_id {
      "clock" => Some(0),
      "reset" => Some(1),
      "cv-offset" => Some(2),
      _ => None,
    },
    ModuleType::Tb303 => match port_id {
      "pitch" => Some(0),
      "gate" => Some(1),
      "velocity" | "vel" => Some(2),
      "cutoff-cv" | "cut" => Some(3),
      _ => None,
    },
    // TR-909 Drums
    ModuleType::Kick909 | ModuleType::Snare909 | ModuleType::HiHat909 |
    ModuleType::Clap909 | ModuleType::Tom909 | ModuleType::Rimshot909 => match port_id {
      "trigger" | "trig" => Some(0),
      "accent" | "acc" => Some(1),
      _ => None,
    },
    // Drum Sequencer
    ModuleType::DrumSequencer => match port_id {
      "clock" => Some(0),
      "reset" => Some(1),
      _ => None,
    },
    // Pitch Shifter
    ModuleType::PitchShifter => match port_id {
      "in" | "input" | "audio" => Some(0),
      "pitch" | "pitch-cv" => Some(1),
      _ => None,
    },
    _ => None,
  }
}

fn output_port_index(module_type: ModuleType, port_id: &str) -> Option<usize> {
  match module_type {
    ModuleType::Oscillator => match port_id {
      "out" => Some(0),
      "sub" => Some(1),
      "sync" | "sync-out" => Some(2),
      _ => None,
    },
    ModuleType::Noise => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::ModRouter => match port_id {
      "pitch" => Some(0),
      "pwm" => Some(1),
      "vcf" => Some(2),
      "vca" => Some(3),
      _ => None,
    },
    ModuleType::SampleHold => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Slew => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Quantizer => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::RingMod => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Gain => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::CvVca => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Output => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Lab => match port_id {
      "out-a" => Some(0),
      "out-b" => Some(1),
      _ => None,
    },
    ModuleType::Lfo => match port_id {
      "cv-out" => Some(0),
      _ => None,
    },
    ModuleType::Adsr => match port_id {
      "env" => Some(0),
      _ => None,
    },
    ModuleType::Vcf => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Hpf => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Mixer => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::MixerWide => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Chorus
    | ModuleType::Ensemble
    | ModuleType::Choir
    | ModuleType::Delay
    | ModuleType::GranularDelay
    | ModuleType::TapeDelay
    | ModuleType::SpringReverb
    | ModuleType::Reverb
    | ModuleType::Phaser => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Distortion => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Wavefolder => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Supersaw => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::NesOsc => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::SnesOsc => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::AudioIn => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Vocoder => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Control => match port_id {
      "cv-out" => Some(0),
      "vel-out" => Some(1),
      "gate-out" => Some(2),
      "sync-out" => Some(3),
      _ => None,
    },
    ModuleType::Scope => match port_id {
      "out-a" => Some(0),
      "out-b" => Some(1),
      _ => None,
    },
    ModuleType::Mario => match port_id {
      "cv-1" => Some(0),
      "gate-1" => Some(1),
      "cv-2" => Some(2),
      "gate-2" => Some(3),
      "cv-3" => Some(4),
      "gate-3" => Some(5),
      "cv-4" => Some(6),
      "gate-4" => Some(7),
      "cv-5" => Some(8),
      "gate-5" => Some(9),
      _ => None,
    },
    ModuleType::Arpeggiator => match port_id {
      "cv-out" => Some(0),
      "gate-out" => Some(1),
      "accent" => Some(2),
      _ => None,
    },
    ModuleType::StepSequencer => match port_id {
      "cv-out" => Some(0),
      "gate-out" => Some(1),
      "velocity-out" => Some(2),
      "step-out" => Some(3),
      _ => None,
    },
    ModuleType::Tb303 => match port_id {
      "out" => Some(0),
      "env-out" => Some(1),
      _ => None,
    },
    // TR-909 Drums
    ModuleType::Kick909 | ModuleType::Snare909 | ModuleType::HiHat909 |
    ModuleType::Clap909 | ModuleType::Tom909 | ModuleType::Rimshot909 => match port_id {
      "out" => Some(0),
      _ => None,
    },
    // Drum Sequencer - 17 outputs
    ModuleType::DrumSequencer => match port_id {
      "gate-kick" => Some(0),
      "gate-snare" => Some(1),
      "gate-hhc" => Some(2),
      "gate-hho" => Some(3),
      "gate-clap" => Some(4),
      "gate-tom" => Some(5),
      "gate-rim" => Some(6),
      "gate-aux" => Some(7),
      "acc-kick" => Some(8),
      "acc-snare" => Some(9),
      "acc-hhc" => Some(10),
      "acc-hho" => Some(11),
      "acc-clap" => Some(12),
      "acc-tom" => Some(13),
      "acc-rim" => Some(14),
      "acc-aux" => Some(15),
      "step-out" => Some(16),
      _ => None,
    },
    // Pitch Shifter - 1 output
    ModuleType::PitchShifter => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
  }
}

fn resolve_voice_count(modules: &[ModuleSpecJson]) -> usize {
  let mut voice_count = 1.0;
  for module in modules {
    if module.kind == "control" {
      if let Some(params) = &module.params {
        voice_count = param_number(params, "voices", 1.0);
      }
      break;
    }
  }
  let rounded = voice_count.round().clamp(1.0, 8.0) as usize;
  rounded.max(1)
}

fn param_number(
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
