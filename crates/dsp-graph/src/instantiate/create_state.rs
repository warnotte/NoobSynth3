//! `create_state()`

use std::collections::HashMap;
use dsp_core::*;
use dsp_core::sequencers::game_of_life::GameOfLife;
use dsp_core::sequencers::gravity::GravitySequencer as GravitySeq;
use crate::state::*;
use crate::types::*;
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
      pan: ParamBuffer::new(param_number(params, "pan", 0.0)),
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
    ModuleType::EnvelopeFollower => ModuleState::EnvelopeFollower(EnvelopeFollowerState {
      envelope_follower: EnvelopeFollower::new(sample_rate),
      attack: ParamBuffer::new(param_number(params, "attack", 0.01)),
      release: ParamBuffer::new(param_number(params, "release", 0.1)),
      gain: ParamBuffer::new(param_number(params, "gain", 1.0)),
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
    ModuleType::Crossfader => ModuleState::Crossfader(CrossfaderState {
      mix: ParamBuffer::new(param_number(params, "mix", 0.5)),
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
      tempo_sync: ParamBuffer::new(param_number(params, "tempoSync", 0.0)),
      sync_rate: ParamBuffer::new(param_number(params, "syncRate", 3.0)),
      tempo: ParamBuffer::new(param_number(params, "tempo", 120.0)),
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
    ModuleType::Meter => ModuleState::Meter(MeterState { peak_l: 0.0, peak_r: 0.0 }),
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
    ModuleType::Crash909 => ModuleState::Crash909(Crash909State {
      crash: Crash909::new(sample_rate),
      tune: ParamBuffer::new(param_number(params, "tune", 1.0)),
      decay: ParamBuffer::new(param_number(params, "decay", 1.5)),
      tone: ParamBuffer::new(param_number(params, "tone", 0.6)),
    }),
    ModuleType::Ride909 => ModuleState::Ride909(Ride909State {
      ride: Ride909::new(sample_rate),
      tune: ParamBuffer::new(param_number(params, "tune", 1.0)),
      decay: ParamBuffer::new(param_number(params, "decay", 2.0)),
      bell: ParamBuffer::new(param_number(params, "bell", 0.6)),
    }),
    ModuleType::DrumMachine909 => {
      let mut seq = Seq909::new(sample_rate);
      if let Some(pd) = params.get("patternData").and_then(|v| v.as_str()) {
        super::parse_pattern_data(&mut seq, pd);
      }
      ModuleState::DrumMachine909(DrumMachine909State {
        bd: Kick909::new(sample_rate),
        sd: Snare909::new(sample_rate),
        lt: Tom909::new(sample_rate),
        mt: Tom909::new(sample_rate),
        ht: Tom909::new(sample_rate),
        rs: Rimshot909::new(sample_rate),
        cp: Clap909::new(sample_rate),
        ch: HiHat909::new(sample_rate),
        oh: HiHat909::new(sample_rate),
        cr: Crash909::new(sample_rate),
        rd: Ride909::new(sample_rate),
        seq,
        oh_muted: false,
        enabled: ParamBuffer::new(param_number(params, "enabled", 1.0)),
        rate: ParamBuffer::new(param_number(params, "rate", 4.0)),
        swing: ParamBuffer::new(param_number(params, "swing", 0.0)),
        length: ParamBuffer::new(param_number(params, "length", 16.0)),
        pattern: ParamBuffer::new(param_number(params, "pattern", 0.0)),
        fill: ParamBuffer::new(param_number(params, "fill", 0.0)),
        bd_tune: ParamBuffer::new(param_number(params, "bd-tune", 55.0)),
        bd_decay: ParamBuffer::new(param_number(params, "bd-decay", 0.4)),
        bd_level: ParamBuffer::new(param_number(params, "bd-level", 0.9)),
        sd_tune: ParamBuffer::new(param_number(params, "sd-tune", 200.0)),
        sd_snappy: ParamBuffer::new(param_number(params, "sd-snappy", 0.6)),
        sd_decay: ParamBuffer::new(param_number(params, "sd-decay", 0.3)),
        sd_level: ParamBuffer::new(param_number(params, "sd-level", 0.75)),
        lt_tune: ParamBuffer::new(param_number(params, "lt-tune", 90.0)),
        lt_decay: ParamBuffer::new(param_number(params, "lt-decay", 0.5)),
        lt_level: ParamBuffer::new(param_number(params, "lt-level", 0.7)),
        mt_tune: ParamBuffer::new(param_number(params, "mt-tune", 150.0)),
        mt_decay: ParamBuffer::new(param_number(params, "mt-decay", 0.45)),
        mt_level: ParamBuffer::new(param_number(params, "mt-level", 0.7)),
        ht_tune: ParamBuffer::new(param_number(params, "ht-tune", 220.0)),
        ht_decay: ParamBuffer::new(param_number(params, "ht-decay", 0.4)),
        ht_level: ParamBuffer::new(param_number(params, "ht-level", 0.7)),
        rs_tune: ParamBuffer::new(param_number(params, "rs-tune", 400.0)),
        rs_level: ParamBuffer::new(param_number(params, "rs-level", 0.6)),
        cp_tone: ParamBuffer::new(param_number(params, "cp-tone", 0.5)),
        cp_decay: ParamBuffer::new(param_number(params, "cp-decay", 0.4)),
        cp_level: ParamBuffer::new(param_number(params, "cp-level", 0.7)),
        ch_tune: ParamBuffer::new(param_number(params, "ch-tune", 1.0)),
        ch_decay: ParamBuffer::new(param_number(params, "ch-decay", 0.1)),
        ch_level: ParamBuffer::new(param_number(params, "ch-level", 0.55)),
        oh_tune: ParamBuffer::new(param_number(params, "oh-tune", 1.0)),
        oh_decay: ParamBuffer::new(param_number(params, "oh-decay", 0.5)),
        oh_level: ParamBuffer::new(param_number(params, "oh-level", 0.5)),
        cr_tune: ParamBuffer::new(param_number(params, "cr-tune", 1.0)),
        cr_decay: ParamBuffer::new(param_number(params, "cr-decay", 1.5)),
        cr_tone: ParamBuffer::new(param_number(params, "cr-tone", 0.6)),
        cr_level: ParamBuffer::new(param_number(params, "cr-level", 0.45)),
        rd_tune: ParamBuffer::new(param_number(params, "rd-tune", 1.0)),
        rd_decay: ParamBuffer::new(param_number(params, "rd-decay", 2.0)),
        rd_bell: ParamBuffer::new(param_number(params, "rd-bell", 0.6)),
        rd_level: ParamBuffer::new(param_number(params, "rd-level", 0.45)),
      })
    }
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
    ModuleType::FmMatrix => ModuleState::FmMatrix(FmMatrixState {
      matrix: FmMatrix::new(sample_rate),
      algorithm: ParamBuffer::new(param_number(params, "algorithm", 0.0)),
      feedback: ParamBuffer::new(param_number(params, "feedback", 0.5)),
      brightness: ParamBuffer::new(param_number(params, "brightness", 0.7)),
      master: ParamBuffer::new(param_number(params, "master", 0.8)),
      // Operator 1
      op1_ratio: ParamBuffer::new(param_number(params, "op1_ratio", 1.0)),
      op1_level: ParamBuffer::new(param_number(params, "op1_level", 1.0)),
      op1_detune: ParamBuffer::new(param_number(params, "op1_detune", 0.0)),
      op1_attack: ParamBuffer::new(param_number(params, "op1_attack", 10.0)),
      op1_decay: ParamBuffer::new(param_number(params, "op1_decay", 300.0)),
      op1_sustain: ParamBuffer::new(param_number(params, "op1_sustain", 0.7)),
      op1_release: ParamBuffer::new(param_number(params, "op1_release", 500.0)),
      // Operator 2
      op2_ratio: ParamBuffer::new(param_number(params, "op2_ratio", 2.0)),
      op2_level: ParamBuffer::new(param_number(params, "op2_level", 0.5)),
      op2_detune: ParamBuffer::new(param_number(params, "op2_detune", 0.0)),
      op2_attack: ParamBuffer::new(param_number(params, "op2_attack", 10.0)),
      op2_decay: ParamBuffer::new(param_number(params, "op2_decay", 200.0)),
      op2_sustain: ParamBuffer::new(param_number(params, "op2_sustain", 0.3)),
      op2_release: ParamBuffer::new(param_number(params, "op2_release", 300.0)),
      // Operator 3
      op3_ratio: ParamBuffer::new(param_number(params, "op3_ratio", 3.0)),
      op3_level: ParamBuffer::new(param_number(params, "op3_level", 0.3)),
      op3_detune: ParamBuffer::new(param_number(params, "op3_detune", 0.0)),
      op3_attack: ParamBuffer::new(param_number(params, "op3_attack", 10.0)),
      op3_decay: ParamBuffer::new(param_number(params, "op3_decay", 150.0)),
      op3_sustain: ParamBuffer::new(param_number(params, "op3_sustain", 0.2)),
      op3_release: ParamBuffer::new(param_number(params, "op3_release", 200.0)),
      // Operator 4
      op4_ratio: ParamBuffer::new(param_number(params, "op4_ratio", 4.0)),
      op4_level: ParamBuffer::new(param_number(params, "op4_level", 0.2)),
      op4_detune: ParamBuffer::new(param_number(params, "op4_detune", 0.0)),
      op4_attack: ParamBuffer::new(param_number(params, "op4_attack", 10.0)),
      op4_decay: ParamBuffer::new(param_number(params, "op4_decay", 100.0)),
      op4_sustain: ParamBuffer::new(param_number(params, "op4_sustain", 0.1)),
      op4_release: ParamBuffer::new(param_number(params, "op4_release", 150.0)),
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
      percussion: ParamBuffer::new(param_number(params, "percussion", 0.0)),
      perc_harmonic: ParamBuffer::new(param_number(params, "percHarmonic", 0.0)),
      perc_decay: ParamBuffer::new(param_number(params, "percDecay", 0.0)),
      perc_volume: ParamBuffer::new(param_number(params, "percVolume", 0.8)),
      chorus_vibrato: ParamBuffer::new(param_number(params, "chorusVibrato", 0.0)),
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
    ModuleType::ParticleCloud => ModuleState::ParticleCloud(ParticleCloudState {
      cloud: ParticleCloud::new(sample_rate),
      count: ParamBuffer::new(param_number(params, "count", 16.0)),
      gravity: ParamBuffer::new(param_number(params, "gravity", 0.0)),
      turbulence: ParamBuffer::new(param_number(params, "turbulence", 0.3)),
      friction: ParamBuffer::new(param_number(params, "friction", 0.1)),
      grain_size: ParamBuffer::new(param_number(params, "grainSize", 100.0)),
      pitch: ParamBuffer::new(param_number(params, "pitch", 1.0)),
      spread: ParamBuffer::new(param_number(params, "spread", 0.8)),
      level: ParamBuffer::new(param_number(params, "level", 0.8)),
      mode: ParamBuffer::new(param_number(params, "mode", 0.0)),
      osc_shape: ParamBuffer::new(param_number(params, "oscShape", 0.0)),
    }),
    ModuleType::SpeechSynth => {
      let mut synth = SpeechSynth::new(sample_rate);
      // Apply initial text if provided
      if let Some(serde_json::Value::String(text)) = params.get("speechText") {
        synth.set_text(text);
      }
      ModuleState::SpeechSynth(SpeechSynthState {
        synth,
        speed: ParamBuffer::new(param_number(params, "speed", 8.0)),
        formant_shift: ParamBuffer::new(param_number(params, "formantShift", 0.0)),
        smoothing: ParamBuffer::new(param_number(params, "smoothing", 0.3)),
        buzz: ParamBuffer::new(param_number(params, "buzz", 0.7)),
        noise_mix: ParamBuffer::new(param_number(params, "noise", 0.15)),
      })
    }
    ModuleType::Theremin => ModuleState::Theremin(ThereminState {
      theremin: Theremin::new(sample_rate),
      frequency: ParamBuffer::new(param_number(params, "frequency", 440.0)),
      volume: ParamBuffer::new(param_number(params, "volume", 0.0)),
      touch: ParamBuffer::new(param_number(params, "touch", 0.0)),
      waveform: ParamBuffer::new(param_number(params, "waveform", 0.0)),
      vibrato_rate: ParamBuffer::new(param_number(params, "vibratoRate", 5.0)),
      vibrato_depth: ParamBuffer::new(param_number(params, "vibratoDepth", 0.0)),
      tremolo_rate: ParamBuffer::new(param_number(params, "tremoloRate", 5.0)),
      tremolo_depth: ParamBuffer::new(param_number(params, "tremoloDepth", 0.0)),
      tone: ParamBuffer::new(param_number(params, "tone", 0.6)),
      glide: ParamBuffer::new(param_number(params, "glide", 0.05)),
      level: ParamBuffer::new(param_number(params, "level", 1.0)),
      attack: ParamBuffer::new(param_number(params, "attack", 0.02)),
      release: ParamBuffer::new(param_number(params, "release", 0.15)),
      lo_freq: ParamBuffer::new(param_number(params, "loFreq", 130.81)),
      hi_freq: ParamBuffer::new(param_number(params, "hiFreq", 1046.5)),
    }),
    ModuleType::Notes => ModuleState::Notes,  // UI-only, no DSP
    ModuleType::Send => ModuleState::Send(SendState {
      bus: param_number(params, "bus", 0.0) as u32,
    }),
    ModuleType::Receive => ModuleState::Receive(ReceiveState {
      bus: param_number(params, "bus", 0.0) as u32,
    }),
    ModuleType::TuringMachine => ModuleState::TuringMachine(TuringState {
      turing: TuringMachine::new(sample_rate),
      probability: ParamBuffer::new(param_number(params, "probability", 0.5)),
      length: ParamBuffer::new(param_number(params, "length", 8.0)),
      range: ParamBuffer::new(param_number(params, "range", 2.0)),
      scale: ParamBuffer::new(param_number(params, "scale", 0.0)),
      root: ParamBuffer::new(param_number(params, "root", 0.0)),
    }),
    ModuleType::GameOfLife => {
      let mut gol = GameOfLife::new(sample_rate);
      if let Some(cell_data) = params.get("cellData") {
        if let Some(s) = cell_data.as_str() {
          gol.set_cell_data(s);
        }
      }
      ModuleState::GameOfLife(GameOfLifeState {
        gol,
        evolve_rate: ParamBuffer::new(param_number(params, "evolveRate", 4.0)),
        range: ParamBuffer::new(param_number(params, "range", 2.0)),
        scale: ParamBuffer::new(param_number(params, "scale", 0.0)),
        root: ParamBuffer::new(param_number(params, "root", 0.0)),
        wrap: ParamBuffer::new(param_number(params, "wrap", 1.0)),
      })
    }
    ModuleType::GravitySequencer => ModuleState::GravitySequencer(GravityState {
      gravity: GravitySeq::new(sample_rate),
      speed: ParamBuffer::new(param_number(params, "speed", 1.0)),
      bodies: ParamBuffer::new(param_number(params, "bodies", 4.0)),
      eccentricity: ParamBuffer::new(param_number(params, "eccentricity", 0.3)),
      spread: ParamBuffer::new(param_number(params, "spread", 1.0)),
      range: ParamBuffer::new(param_number(params, "range", 2.0)),
      scale: ParamBuffer::new(param_number(params, "scale", 0.0)),
      root: ParamBuffer::new(param_number(params, "root", 0.0)),
      chaos: ParamBuffer::new(param_number(params, "chaos", 0.0)),
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
    ModuleType::ChordSequencer => {
      let mut seq = ChordSequencer::new(sample_rate);
      if let Some(step_data) = params.get("stepData") {
        if let Some(s) = step_data.as_str() {
          seq.parse_step_data(s);
        }
      }
      ModuleState::ChordSequencer(ChordSequencerState {
        seq,
        enabled: ParamBuffer::new(param_number(params, "enabled", 1.0)),
        tempo: ParamBuffer::new(param_number(params, "tempo", 120.0)),
        rate: ParamBuffer::new(param_number(params, "rate", 2.0)),
        gate_length: ParamBuffer::new(param_number(params, "gateLength", 50.0)),
        swing: ParamBuffer::new(param_number(params, "swing", 0.0)),
        length: ParamBuffer::new(param_number(params, "length", 4.0)),
        strum_speed: ParamBuffer::new(param_number(params, "strumSpeed", 0.0)),
        strum_direction: ParamBuffer::new(param_number(params, "strumDirection", 0.0)),
        voicing: ParamBuffer::new(param_number(params, "voicing", 0.0)),
      })
    }
    ModuleType::PolyrhythmSequencer => {
      let mut seq = PolyrhythmSequencer::new(sample_rate);
      if let Some(step_data) = params.get("stepData") {
        if let Some(s) = step_data.as_str() {
          seq.parse_step_data(s);
        }
      }
      ModuleState::PolyrhythmSequencer(PolyrhythmSequencerState {
        seq,
        enabled: ParamBuffer::new(param_number(params, "enabled", 1.0)),
        tempo: ParamBuffer::new(param_number(params, "tempo", 120.0)),
        rate: ParamBuffer::new(param_number(params, "rate", 3.0)),
        gate_length: ParamBuffer::new(param_number(params, "gateLength", 50.0)),
        swing: ParamBuffer::new(param_number(params, "swing", 0.0)),
        track1_length: ParamBuffer::new(param_number(params, "track1Length", 8.0)),
        track2_length: ParamBuffer::new(param_number(params, "track2Length", 12.0)),
        track3_length: ParamBuffer::new(param_number(params, "track3Length", 16.0)),
        track4_length: ParamBuffer::new(param_number(params, "track4Length", 7.0)),
        track1_mute: ParamBuffer::new(param_number(params, "track1Mute", 0.0)),
        track2_mute: ParamBuffer::new(param_number(params, "track2Mute", 0.0)),
        track3_mute: ParamBuffer::new(param_number(params, "track3Mute", 0.0)),
        track4_mute: ParamBuffer::new(param_number(params, "track4Mute", 0.0)),
      })
    }
    ModuleType::ClockDivider => ModuleState::ClockDivider(ClockDividerState {
      divider: ClockDivider::new(sample_rate),
    }),
    ModuleType::Compressor => ModuleState::Compressor(CompressorState {
      compressor: Compressor::new(sample_rate),
      threshold: ParamBuffer::new(param_number(params, "threshold", -20.0)),
      ratio: ParamBuffer::new(param_number(params, "ratio", 4.0)),
      attack: ParamBuffer::new(param_number(params, "attack", 10.0)),
      release: ParamBuffer::new(param_number(params, "release", 100.0)),
      makeup: ParamBuffer::new(param_number(params, "makeup", 0.0)),
      mix: ParamBuffer::new(param_number(params, "mix", 1.0)),
    }),
    ModuleType::BitCrusher => ModuleState::BitCrusher(BitCrusherState {
      crusher: BitCrusher::new(),
      bits: ParamBuffer::new(param_number(params, "bits", 8.0)),
      downsample: ParamBuffer::new(param_number(params, "downsample", 1.0)),
      mix: ParamBuffer::new(param_number(params, "mix", 1.0)),
    }),
    ModuleType::Flanger => ModuleState::Flanger(FlangerState {
      flanger: Flanger::new(sample_rate),
      rate: ParamBuffer::new(param_number(params, "rate", 0.3)),
      depth: ParamBuffer::new(param_number(params, "depth", 2.0)),
      feedback: ParamBuffer::new(param_number(params, "feedback", 0.5)),
      mix: ParamBuffer::new(param_number(params, "mix", 0.5)),
    }),
    ModuleType::FreqShifter => ModuleState::FreqShifter(FreqShifterState {
      shifter: FrequencyShifter::new(sample_rate),
      shift: ParamBuffer::new(param_number(params, "shift", 0.0)),
      mix: ParamBuffer::new(param_number(params, "mix", 1.0)),
    }),
    ModuleType::Eq3 => ModuleState::Eq3(Eq3State {
      eq: Eq3::new(sample_rate),
      low_gain: ParamBuffer::new(param_number(params, "lowGain", 0.0)),
      mid_gain: ParamBuffer::new(param_number(params, "midGain", 0.0)),
      high_gain: ParamBuffer::new(param_number(params, "highGain", 0.0)),
      low_freq: ParamBuffer::new(param_number(params, "lowFreq", 200.0)),
      mid_freq: ParamBuffer::new(param_number(params, "midFreq", 1000.0)),
      high_freq: ParamBuffer::new(param_number(params, "highFreq", 5000.0)),
      mid_q: ParamBuffer::new(param_number(params, "midQ", 1.0)),
    }),
    ModuleType::Glitch => ModuleState::Glitch(GlitchState {
      glitch: Glitch::new(sample_rate),
      probability: ParamBuffer::new(param_number(params, "probability", 0.5)),
      slice_ms: ParamBuffer::new(param_number(params, "sliceMs", 100.0)),
      repeats: ParamBuffer::new(param_number(params, "repeats", 2.0)),
      reverse_chance: ParamBuffer::new(param_number(params, "reverseChance", 0.3)),
      pitch_range: ParamBuffer::new(param_number(params, "pitchRange", 0.0)),
      mix: ParamBuffer::new(param_number(params, "mix", 0.5)),
    }),
    ModuleType::Leslie => ModuleState::Leslie(LeslieState {
      leslie: Leslie::new(sample_rate),
      speed: ParamBuffer::new(param_number(params, "speed", 0.0)),
      brake: ParamBuffer::new(param_number(params, "brake", 0.0)),
      drive: ParamBuffer::new(param_number(params, "drive", 0.0)),
      depth: ParamBuffer::new(param_number(params, "depth", 0.7)),
      horn_drum: ParamBuffer::new(param_number(params, "hornDrum", 0.5)),
      mic_dist: ParamBuffer::new(param_number(params, "micDist", 0.0)),
      ramp: ParamBuffer::new(param_number(params, "ramp", 0.5)),
      mix: ParamBuffer::new(param_number(params, "mix", 1.0)),
    }),
    ModuleType::Wah => ModuleState::Wah(WahState {
      wah: Wah::new(sample_rate),
      mode: ParamBuffer::new(param_number(params, "mode", 0.0)),
      freq: ParamBuffer::new(param_number(params, "freq", 800.0)),
      range: ParamBuffer::new(param_number(params, "range", 0.7)),
      resonance: ParamBuffer::new(param_number(params, "resonance", 0.5)),
      speed: ParamBuffer::new(param_number(params, "speed", 2.0)),
      sensitivity: ParamBuffer::new(param_number(params, "sensitivity", 0.7)),
      mix: ParamBuffer::new(param_number(params, "mix", 1.0)),
    }),
    ModuleType::TubeAmp => ModuleState::TubeAmp(TubeAmpState {
      tube_amp: TubeAmp::new(sample_rate),
      gain: ParamBuffer::new(param_number(params, "gain", 0.5)),
      stages: ParamBuffer::new(param_number(params, "stages", 2.0)),
      tone: ParamBuffer::new(param_number(params, "tone", 0.5)),
      bias: ParamBuffer::new(param_number(params, "bias", 0.3)),
      sag: ParamBuffer::new(param_number(params, "sag", 0.0)),
      mix: ParamBuffer::new(param_number(params, "mix", 1.0)),
    }),
  }
}
