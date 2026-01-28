//! Module instantiation and parameter handling.

use std::collections::HashMap;

use dsp_core::{
  Adsr, Arpeggiator, AyPlayer, Chaos, Choir, Chorus, Clap808, Clap909, Cowbell808, Delay, DrumSequencer, Ensemble,
  EuclideanSequencer, FmOperator, Granular, GranularDelay, HiHat808, HiHat909, Hpf, KarplusStrong,
  Kick808, Kick909, Lfo, Mario, MasterClock, MidiFileSequencer, NesOsc, Noise, Phaser, PipeOrgan, PitchShifter,
  Resonator, Reverb, Rimshot909, SampleHold, Shepard, SidPlayer, SlewLimiter, Snare808, Snare909, SnesOsc, SpectralSwarm, SpringReverb,
  StepSequencer, Supersaw, TapeDelay, Tb303, Tom808, Tom909, TuringMachine, Vcf, Vco, Vocoder, Wavetable,
};

use crate::state::*;
use crate::types::{ModuleType, ParamBuffer};
use crate::param_number;

/// Create the initial state for a module based on its type and parameters.
pub(crate) fn create_state(
  module_type: ModuleType,
  params: &HashMap<String, serde_json::Value>,
  sample_rate: f32,
  voice_index: Option<usize>,
) -> ModuleState {
  match module_type {
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
      stereo: ParamBuffer::new(param_number(params, "stereo", 0.0)),
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
    ModuleType::Chaos => ModuleState::Chaos(ChaosState {
      chaos: Chaos::new(sample_rate),
      speed: ParamBuffer::new(param_number(params, "speed", 0.5)),
      rho: ParamBuffer::new(param_number(params, "rho", 28.0)),
      sigma: ParamBuffer::new(param_number(params, "sigma", 10.0)),
      beta: ParamBuffer::new(param_number(params, "beta", 8.0 / 3.0)),
      scale: ParamBuffer::new(param_number(params, "scale", 0.0)),
      root: ParamBuffer::new(param_number(params, "root", 0.0)),
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
      hpf: Hpf::new(sample_rate),
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
    ModuleType::Mixer8 => ModuleState::Mixer8(Mixer8State {
      level1: ParamBuffer::new(param_number(params, "level1", 0.6)),
      level2: ParamBuffer::new(param_number(params, "level2", 0.6)),
      level3: ParamBuffer::new(param_number(params, "level3", 0.6)),
      level4: ParamBuffer::new(param_number(params, "level4", 0.6)),
      level5: ParamBuffer::new(param_number(params, "level5", 0.6)),
      level6: ParamBuffer::new(param_number(params, "level6", 0.6)),
      level7: ParamBuffer::new(param_number(params, "level7", 0.6)),
      level8: ParamBuffer::new(param_number(params, "level8", 0.6)),
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
    ModuleType::Karplus => ModuleState::Karplus(KarplusState {
      karplus: KarplusStrong::new(sample_rate),
      frequency: ParamBuffer::new(param_number(params, "frequency", 220.0)),
      damping: ParamBuffer::new(param_number(params, "damping", 0.3)),
      decay: ParamBuffer::new(param_number(params, "decay", 0.995)),
      brightness: ParamBuffer::new(param_number(params, "brightness", 0.5)),
      pluck_pos: ParamBuffer::new(param_number(params, "pluckPos", 0.5)),
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
      mario: Mario::new(),
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
    // TR-808 Drums
    ModuleType::Kick808 => ModuleState::Kick808(Kick808State {
      kick: Kick808::new(sample_rate),
      tune: ParamBuffer::new(param_number(params, "tune", 45.0)),
      decay: ParamBuffer::new(param_number(params, "decay", 1.5)),
      tone: ParamBuffer::new(param_number(params, "tone", 0.3)),
      click: ParamBuffer::new(param_number(params, "click", 0.2)),
    }),
    ModuleType::Snare808 => ModuleState::Snare808(Snare808State {
      snare: Snare808::new(sample_rate),
      tune: ParamBuffer::new(param_number(params, "tune", 180.0)),
      tone: ParamBuffer::new(param_number(params, "tone", 0.5)),
      snappy: ParamBuffer::new(param_number(params, "snappy", 0.6)),
      decay: ParamBuffer::new(param_number(params, "decay", 0.3)),
    }),
    ModuleType::HiHat808 => ModuleState::HiHat808(HiHat808State {
      hihat: HiHat808::new(sample_rate),
      tune: ParamBuffer::new(param_number(params, "tune", 1.0)),
      decay: ParamBuffer::new(param_number(params, "decay", 0.15)),
      tone: ParamBuffer::new(param_number(params, "tone", 0.6)),
      snap: ParamBuffer::new(param_number(params, "snap", 0.5)),
    }),
    ModuleType::Cowbell808 => ModuleState::Cowbell808(Cowbell808State {
      cowbell: Cowbell808::new(sample_rate),
      tune: ParamBuffer::new(param_number(params, "tune", 1.0)),
      decay: ParamBuffer::new(param_number(params, "decay", 0.1)),
      tone: ParamBuffer::new(param_number(params, "tone", 0.6)),
    }),
    ModuleType::Clap808 => ModuleState::Clap808(Clap808State {
      clap: Clap808::new(sample_rate),
      tone: ParamBuffer::new(param_number(params, "tone", 0.5)),
      decay: ParamBuffer::new(param_number(params, "decay", 0.3)),
      spread: ParamBuffer::new(param_number(params, "spread", 0.5)),
    }),
    ModuleType::Tom808 => ModuleState::Tom808(Tom808State {
      tom: Tom808::new(sample_rate),
      tune: ParamBuffer::new(param_number(params, "tune", 150.0)),
      decay: ParamBuffer::new(param_number(params, "decay", 0.3)),
      pitch: ParamBuffer::new(param_number(params, "pitch", 0.5)),
      tone: ParamBuffer::new(param_number(params, "tone", 0.4)),
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
    ModuleType::MidiFileSequencer => {
      let mut seq = MidiFileSequencer::new(sample_rate);
      // Set voice count from params
      let voice_count = param_number(params, "voices", 4.0) as usize;
      seq.set_voice_count(voice_count);
      // Set voice index for this instance
      seq.set_voice_index(voice_index.unwrap_or(0));
      // Parse initial MIDI data if provided
      if let Some(midi_data) = params.get("midiData") {
        if let Some(s) = midi_data.as_str() {
          seq.parse_midi_data(s);
        }
      }
      ModuleState::MidiFileSequencer(MidiFileSequencerState {
        seq,
        voice_index: voice_index.unwrap_or(0),
        enabled: ParamBuffer::new(param_number(params, "enabled", 1.0)),
        tempo: ParamBuffer::new(param_number(params, "tempo", 120.0)),
        gate_length: ParamBuffer::new(param_number(params, "gateLength", 90.0)),
        loop_enabled: ParamBuffer::new(param_number(params, "loop", 1.0)),
        mute1: ParamBuffer::new(param_number(params, "mute1", 0.0)),
        mute2: ParamBuffer::new(param_number(params, "mute2", 0.0)),
        mute3: ParamBuffer::new(param_number(params, "mute3", 0.0)),
        mute4: ParamBuffer::new(param_number(params, "mute4", 0.0)),
        mute5: ParamBuffer::new(param_number(params, "mute5", 0.0)),
        mute6: ParamBuffer::new(param_number(params, "mute6", 0.0)),
        mute7: ParamBuffer::new(param_number(params, "mute7", 0.0)),
        mute8: ParamBuffer::new(param_number(params, "mute8", 0.0)),
      })
    }
    ModuleType::PitchShifter => ModuleState::PitchShifter(PitchShifterState {
      shifter: PitchShifter::new(sample_rate),
      pitch: ParamBuffer::new(param_number(params, "pitch", 0.0)),
      fine: ParamBuffer::new(param_number(params, "fine", 0.0)),
      grain: ParamBuffer::new(param_number(params, "grain", 50.0)),
      mix: ParamBuffer::new(param_number(params, "mix", 1.0)),
    }),
    ModuleType::Clock => ModuleState::Clock(ClockState {
      clock: MasterClock::new(sample_rate),
      running: ParamBuffer::new(param_number(params, "running", 1.0)),
      tempo: ParamBuffer::new(param_number(params, "tempo", 120.0)),
      rate: ParamBuffer::new(param_number(params, "rate", 4.0)),
      swing: ParamBuffer::new(param_number(params, "swing", 0.0)),
    }),
    ModuleType::Euclidean => ModuleState::Euclidean(EuclideanState {
      euclidean: EuclideanSequencer::new(sample_rate),
      enabled: ParamBuffer::new(param_number(params, "enabled", 1.0)),
      tempo: ParamBuffer::new(param_number(params, "tempo", 120.0)),
      rate: ParamBuffer::new(param_number(params, "rate", 7.0)), // 1/16
      steps: ParamBuffer::new(param_number(params, "steps", 16.0)),
      pulses: ParamBuffer::new(param_number(params, "pulses", 4.0)),
      rotation: ParamBuffer::new(param_number(params, "rotation", 0.0)),
      gate_length: ParamBuffer::new(param_number(params, "gateLength", 50.0)),
      swing: ParamBuffer::new(param_number(params, "swing", 0.0)),
    }),
    ModuleType::FmOp => ModuleState::FmOp(FmOpState {
      op: FmOperator::new(sample_rate),
      frequency: ParamBuffer::new(param_number(params, "frequency", 440.0)),
      ratio: ParamBuffer::new(param_number(params, "ratio", 1.0)),
      level: ParamBuffer::new(param_number(params, "level", 1.0)),
      feedback: ParamBuffer::new(param_number(params, "feedback", 0.0)),
      attack: ParamBuffer::new(param_number(params, "attack", 10.0)),
      decay: ParamBuffer::new(param_number(params, "decay", 200.0)),
      sustain: ParamBuffer::new(param_number(params, "sustain", 0.7)),
      release: ParamBuffer::new(param_number(params, "release", 300.0)),
    }),
    ModuleType::Shepard => ModuleState::Shepard(ShepardState {
      shepard: Shepard::new(sample_rate),
      voices: ParamBuffer::new(param_number(params, "voices", 8.0)),
      rate: ParamBuffer::new(param_number(params, "rate", 0.1)),
      base_freq: ParamBuffer::new(param_number(params, "baseFreq", 220.0)),
      spread: ParamBuffer::new(param_number(params, "spread", 1.0)),
      mix: ParamBuffer::new(param_number(params, "mix", 1.0)),
      waveform: ParamBuffer::new(param_number(params, "waveform", 0.0)),
      stereo: ParamBuffer::new(param_number(params, "stereo", 0.5)),
      detune: ParamBuffer::new(param_number(params, "detune", 0.0)),
      direction: ParamBuffer::new(param_number(params, "direction", 0.0)),
      risset: ParamBuffer::new(param_number(params, "risset", 0.0)),
      phase_spread: ParamBuffer::new(param_number(params, "phaseSpread", 0.0)),
      interval: ParamBuffer::new(param_number(params, "interval", 0.0)),
      tilt: ParamBuffer::new(param_number(params, "tilt", 0.0)),
      feedback: ParamBuffer::new(param_number(params, "feedback", 0.0)),
      vibrato: ParamBuffer::new(param_number(params, "vibrato", 0.0)),
      shimmer: ParamBuffer::new(param_number(params, "shimmer", 0.0)),
    }),
    ModuleType::PipeOrgan => ModuleState::PipeOrgan(PipeOrganState {
      organ: PipeOrgan::new(sample_rate),
      frequency: ParamBuffer::new(param_number(params, "frequency", 220.0)),
      drawbar_16: ParamBuffer::new(param_number(params, "drawbar16", 0.5)),
      drawbar_8: ParamBuffer::new(param_number(params, "drawbar8", 0.8)),
      drawbar_4: ParamBuffer::new(param_number(params, "drawbar4", 0.6)),
      drawbar_223: ParamBuffer::new(param_number(params, "drawbar223", 0.0)),
      drawbar_2: ParamBuffer::new(param_number(params, "drawbar2", 0.4)),
      drawbar_135: ParamBuffer::new(param_number(params, "drawbar135", 0.0)),
      drawbar_113: ParamBuffer::new(param_number(params, "drawbar113", 0.0)),
      drawbar_1: ParamBuffer::new(param_number(params, "drawbar1", 0.2)),
      voicing: ParamBuffer::new(param_number(params, "voicing", 0.0)),
      chiff: ParamBuffer::new(param_number(params, "chiff", 0.3)),
      tremulant: ParamBuffer::new(param_number(params, "tremulant", 0.0)),
      trem_rate: ParamBuffer::new(param_number(params, "tremRate", 6.0)),
      wind: ParamBuffer::new(param_number(params, "wind", 0.1)),
      brightness: ParamBuffer::new(param_number(params, "brightness", 0.7)),
    }),
    ModuleType::SpectralSwarm => ModuleState::SpectralSwarm(SpectralSwarmState {
      swarm: SpectralSwarm::new(sample_rate),
      frequency: ParamBuffer::new(param_number(params, "frequency", 110.0)),
      partials: ParamBuffer::new(param_number(params, "partials", 16.0)),
      detune: ParamBuffer::new(param_number(params, "detune", 15.0)),
      drift: ParamBuffer::new(param_number(params, "drift", 0.3)),
      density: ParamBuffer::new(param_number(params, "density", 0.8)),
      evolution: ParamBuffer::new(param_number(params, "evolution", 4.0)),
      inharmonic: ParamBuffer::new(param_number(params, "inharmonic", 0.0)),
      tilt: ParamBuffer::new(param_number(params, "tilt", -3.0)),
      spread: ParamBuffer::new(param_number(params, "spread", 0.7)),
      shimmer: ParamBuffer::new(param_number(params, "shimmer", 0.0)),
      attack: ParamBuffer::new(param_number(params, "attack", 2.0)),
      release: ParamBuffer::new(param_number(params, "release", 3.0)),
      // New parameters
      waveform: ParamBuffer::new(param_number(params, "waveform", 0.0)),
      odd_even: ParamBuffer::new(param_number(params, "oddEven", 0.0)),
      fundamental_mix: ParamBuffer::new(param_number(params, "fundamentalMix", 0.5)),
      formant_freq: ParamBuffer::new(param_number(params, "formantFreq", 0.0)),
      formant_q: ParamBuffer::new(param_number(params, "formantQ", 2.0)),
      freeze: ParamBuffer::new(param_number(params, "freeze", 0.0)),
      chorus: ParamBuffer::new(param_number(params, "chorus", 0.0)),
      attack_low: ParamBuffer::new(param_number(params, "attackLow", 1.0)),
      attack_high: ParamBuffer::new(param_number(params, "attackHigh", 1.0)),
      release_low: ParamBuffer::new(param_number(params, "releaseLow", 1.0)),
      release_high: ParamBuffer::new(param_number(params, "releaseHigh", 1.0)),
    }),
    ModuleType::Resonator => ModuleState::Resonator(ResonatorState {
      resonator: Resonator::new(sample_rate),
      frequency: ParamBuffer::new(param_number(params, "frequency", 220.0)),
      structure: ParamBuffer::new(param_number(params, "structure", 0.5)),
      brightness: ParamBuffer::new(param_number(params, "brightness", 0.7)),
      damping: ParamBuffer::new(param_number(params, "damping", 0.7)),
      position: ParamBuffer::new(param_number(params, "position", 0.5)),
      mode: ParamBuffer::new(param_number(params, "mode", 0.0)),
      polyphony: ParamBuffer::new(param_number(params, "polyphony", 1.0)),
      internal_exc: ParamBuffer::new(param_number(params, "internalExc", 0.8)),
      chorus: ParamBuffer::new(param_number(params, "chorus", 0.0)),
    }),
    ModuleType::Wavetable => ModuleState::Wavetable(WavetableState {
      wavetable: Wavetable::new(sample_rate),
      frequency: ParamBuffer::new(param_number(params, "frequency", 220.0)),
      bank: ParamBuffer::new(param_number(params, "bank", 0.0)),
      position: ParamBuffer::new(param_number(params, "position", 0.0)),
      unison: ParamBuffer::new(param_number(params, "unison", 1.0)),
      detune: ParamBuffer::new(param_number(params, "detune", 15.0)),
      spread: ParamBuffer::new(param_number(params, "spread", 0.5)),
      morph_speed: ParamBuffer::new(param_number(params, "morphSpeed", 0.0)),
      sub_mix: ParamBuffer::new(param_number(params, "subMix", 0.0)),
      attack: ParamBuffer::new(param_number(params, "attack", 0.01)),
      release: ParamBuffer::new(param_number(params, "release", 0.3)),
    }),
    ModuleType::Granular => ModuleState::Granular(GranularState {
      granular: Granular::new(sample_rate),
      position: ParamBuffer::new(param_number(params, "position", 0.5)),
      size: ParamBuffer::new(param_number(params, "size", 100.0)),
      density: ParamBuffer::new(param_number(params, "density", 8.0)),
      pitch: ParamBuffer::new(param_number(params, "pitch", 1.0)),
      spray: ParamBuffer::new(param_number(params, "spray", 0.1)),
      scatter: ParamBuffer::new(param_number(params, "scatter", 0.0)),
      pan_spread: ParamBuffer::new(param_number(params, "panSpread", 0.5)),
      shape: ParamBuffer::new(param_number(params, "shape", 1.0)),
      level: ParamBuffer::new(param_number(params, "level", 0.8)),
    }),
    ModuleType::Notes => ModuleState::Notes,  // UI-only, no DSP
    ModuleType::TuringMachine => ModuleState::TuringMachine(TuringState {
      turing: TuringMachine::new(sample_rate),
      probability: ParamBuffer::new(param_number(params, "probability", 0.5)),
      length: ParamBuffer::new(param_number(params, "length", 8.0)),
      range: ParamBuffer::new(param_number(params, "range", 2.0)),
      scale: ParamBuffer::new(param_number(params, "scale", 0.0)),
      root: ParamBuffer::new(param_number(params, "root", 0.0)),
    }),
    ModuleType::SidPlayer => ModuleState::SidPlayer(SidPlayerState {
      sid_player: SidPlayer::new(sample_rate),
      playing: ParamBuffer::new(param_number(params, "playing", 0.0)),
      song: ParamBuffer::new(param_number(params, "song", 1.0)),
      chip_model: ParamBuffer::new(param_number(params, "chipModel", 0.0)),
    }),
    ModuleType::AyPlayer => ModuleState::AyPlayer(AyPlayerState {
      ay_player: AyPlayer::new(sample_rate),
      playing: ParamBuffer::new(param_number(params, "playing", 0.0)),
      loop_enabled: ParamBuffer::new(param_number(params, "loop", 1.0)),
    }),
  }
}

/// Apply a numeric parameter to a module state.
pub(crate) fn apply_param(state: &mut ModuleState, param: &str, value: f32) {
  match state {
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
    ModuleState::Chaos(state) => match param {
      "speed" => state.speed.set(value),
      "rho" => state.rho.set(value),
      "sigma" => state.sigma.set(value),
      "beta" => state.beta.set(value),
      "scale" => state.scale.set(value),
      "root" => state.root.set(value),
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
    ModuleState::Mixer8(state) => match param {
      "level1" => state.level1.set(value),
      "level2" => state.level2.set(value),
      "level3" => state.level3.set(value),
      "level4" => state.level4.set(value),
      "level5" => state.level5.set(value),
      "level6" => state.level6.set(value),
      "level7" => state.level7.set(value),
      "level8" => state.level8.set(value),
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
    ModuleState::Karplus(state) => match param {
      "frequency" => state.frequency.set(value),
      "damping" => state.damping.set(value),
      "decay" => state.decay.set(value),
      "brightness" => state.brightness.set(value),
      "pluckPos" => state.pluck_pos.set(value),
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
    // TR-808 Drums
    ModuleState::Kick808(state) => match param {
      "tune" => state.tune.set(value),
      "decay" => state.decay.set(value),
      "tone" => state.tone.set(value),
      "click" => state.click.set(value),
      _ => {}
    },
    ModuleState::Snare808(state) => match param {
      "tune" => state.tune.set(value),
      "tone" => state.tone.set(value),
      "snappy" => state.snappy.set(value),
      "decay" => state.decay.set(value),
      _ => {}
    },
    ModuleState::HiHat808(state) => match param {
      "tune" => state.tune.set(value),
      "decay" => state.decay.set(value),
      "tone" => state.tone.set(value),
      "snap" => state.snap.set(value),
      _ => {}
    },
    ModuleState::Cowbell808(state) => match param {
      "tune" => state.tune.set(value),
      "decay" => state.decay.set(value),
      "tone" => state.tone.set(value),
      _ => {}
    },
    ModuleState::Clap808(state) => match param {
      "tone" => state.tone.set(value),
      "decay" => state.decay.set(value),
      "spread" => state.spread.set(value),
      _ => {}
    },
    ModuleState::Tom808(state) => match param {
      "tune" => state.tune.set(value),
      "decay" => state.decay.set(value),
      "pitch" => state.pitch.set(value),
      "tone" => state.tone.set(value),
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
    ModuleState::MidiFileSequencer(state) => match param {
      "enabled" => state.enabled.set(value),
      "tempo" => state.tempo.set(value),
      "gateLength" => state.gate_length.set(value),
      "loop" => state.loop_enabled.set(value),
      "mute1" => state.mute1.set(value),
      "mute2" => state.mute2.set(value),
      "mute3" => state.mute3.set(value),
      "mute4" => state.mute4.set(value),
      "mute5" => state.mute5.set(value),
      "mute6" => state.mute6.set(value),
      "mute7" => state.mute7.set(value),
      "mute8" => state.mute8.set(value),
      _ => {}
    },
    ModuleState::PitchShifter(state) => match param {
      "pitch" => state.pitch.set(value),
      "fine" => state.fine.set(value),
      "grain" => state.grain.set(value),
      "mix" => state.mix.set(value),
      _ => {}
    },
    ModuleState::Clock(state) => match param {
      "running" => state.running.set(value),
      "tempo" => state.tempo.set(value),
      "rate" => state.rate.set(value),
      "swing" => state.swing.set(value),
      _ => {}
    },
    ModuleState::Euclidean(state) => match param {
      "enabled" => state.enabled.set(value),
      "tempo" => state.tempo.set(value),
      "rate" => state.rate.set(value),
      "steps" => state.steps.set(value),
      "pulses" => state.pulses.set(value),
      "rotation" => state.rotation.set(value),
      "gateLength" => state.gate_length.set(value),
      "swing" => state.swing.set(value),
      _ => {}
    },
    ModuleState::FmOp(state) => match param {
      "frequency" => state.frequency.set(value),
      "ratio" => state.ratio.set(value),
      "level" => state.level.set(value),
      "feedback" => state.feedback.set(value),
      "attack" => state.attack.set(value),
      "decay" => state.decay.set(value),
      "sustain" => state.sustain.set(value),
      "release" => state.release.set(value),
      _ => {}
    },
    ModuleState::Shepard(state) => match param {
      "voices" => state.voices.set(value),
      "rate" => state.rate.set(value),
      "baseFreq" => state.base_freq.set(value),
      "spread" => state.spread.set(value),
      "mix" => state.mix.set(value),
      "waveform" => state.waveform.set(value),
      "stereo" => state.stereo.set(value),
      "detune" => state.detune.set(value),
      "direction" => state.direction.set(value),
      "risset" => state.risset.set(value),
      "phaseSpread" => state.phase_spread.set(value),
      "interval" => state.interval.set(value),
      "tilt" => state.tilt.set(value),
      "feedback" => state.feedback.set(value),
      "vibrato" => state.vibrato.set(value),
      "shimmer" => state.shimmer.set(value),
      _ => {}
    },
    ModuleState::PipeOrgan(state) => match param {
      "frequency" => state.frequency.set(value),
      "drawbar16" => state.drawbar_16.set(value),
      "drawbar8" => state.drawbar_8.set(value),
      "drawbar4" => state.drawbar_4.set(value),
      "drawbar223" => state.drawbar_223.set(value),
      "drawbar2" => state.drawbar_2.set(value),
      "drawbar135" => state.drawbar_135.set(value),
      "drawbar113" => state.drawbar_113.set(value),
      "drawbar1" => state.drawbar_1.set(value),
      "voicing" => state.voicing.set(value),
      "chiff" => state.chiff.set(value),
      "tremulant" => state.tremulant.set(value),
      "tremRate" => state.trem_rate.set(value),
      "wind" => state.wind.set(value),
      "brightness" => state.brightness.set(value),
      _ => {}
    },
    ModuleState::SpectralSwarm(state) => match param {
      "frequency" => state.frequency.set(value),
      "partials" => state.partials.set(value),
      "detune" => state.detune.set(value),
      "drift" => state.drift.set(value),
      "density" => state.density.set(value),
      "evolution" => state.evolution.set(value),
      "inharmonic" => state.inharmonic.set(value),
      "tilt" => state.tilt.set(value),
      "spread" => state.spread.set(value),
      "shimmer" => state.shimmer.set(value),
      "attack" => state.attack.set(value),
      "release" => state.release.set(value),
      // New parameters
      "waveform" => state.waveform.set(value),
      "oddEven" => state.odd_even.set(value),
      "fundamentalMix" => state.fundamental_mix.set(value),
      "formantFreq" => state.formant_freq.set(value),
      "formantQ" => state.formant_q.set(value),
      "freeze" => state.freeze.set(value),
      "chorus" => state.chorus.set(value),
      "attackLow" => state.attack_low.set(value),
      "attackHigh" => state.attack_high.set(value),
      "releaseLow" => state.release_low.set(value),
      "releaseHigh" => state.release_high.set(value),
      _ => {}
    },
    ModuleState::Resonator(state) => match param {
      "frequency" => state.frequency.set(value),
      "structure" => state.structure.set(value),
      "brightness" => state.brightness.set(value),
      "damping" => state.damping.set(value),
      "position" => state.position.set(value),
      "mode" => state.mode.set(value),
      "polyphony" => state.polyphony.set(value),
      "internalExc" => state.internal_exc.set(value),
      "chorus" => state.chorus.set(value),
      _ => {}
    },
    ModuleState::Wavetable(state) => match param {
      "frequency" => state.frequency.set(value),
      "bank" => state.bank.set(value),
      "position" => state.position.set(value),
      "unison" => state.unison.set(value),
      "detune" => state.detune.set(value),
      "spread" => state.spread.set(value),
      "morphSpeed" => state.morph_speed.set(value),
      "subMix" => state.sub_mix.set(value),
      "attack" => state.attack.set(value),
      "release" => state.release.set(value),
      _ => {}
    },
    ModuleState::Granular(state) => match param {
      "position" => state.position.set(value),
      "size" => state.size.set(value),
      "density" => state.density.set(value),
      "pitch" => state.pitch.set(value),
      "spray" => state.spray.set(value),
      "scatter" => state.scatter.set(value),
      "panSpread" => state.pan_spread.set(value),
      "shape" => state.shape.set(value),
      "level" => state.level.set(value),
      "enabled" => state.granular.set_enabled(value > 0.5),
      _ => {}
    },
    ModuleState::TuringMachine(state) => match param {
      "probability" => state.probability.set(value),
      "length" => state.length.set(value),
      "range" => state.range.set(value),
      "scale" => state.scale.set(value),
      "root" => state.root.set(value),
      _ => {}
    },
    ModuleState::SidPlayer(state) => match param {
      "playing" => state.playing.set(value),
      "song" => state.song.set(value),
      "chipModel" => state.chip_model.set(value),
      _ => {}
    },
    ModuleState::AyPlayer(state) => match param {
      "playing" => state.playing.set(value),
      "loop" => state.loop_enabled.set(value),
      _ => {}
    },
    _ => {}
  }
}

/// Apply a string parameter to a module state (for sequencer data).
pub(crate) fn apply_param_str(state: &mut ModuleState, param: &str, value: &str) {
  match state {
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
    ModuleState::MidiFileSequencer(state) => {
      if param == "midiData" {
        state.seq.parse_midi_data(value);
      }
    }
    _ => {}
  }
}
