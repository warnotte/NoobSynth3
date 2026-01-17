//! Module state definitions for all DSP modules.

use dsp_core::{
    Adsr, Arpeggiator, Choir, Chorus, Clap909, Delay, DrumSequencer, Ensemble,
    EuclideanSequencer, FmOperator, GranularDelay, HiHat909, Hpf, KarplusStrong,
    Kick909, Lfo, Mario, MasterClock, MidiFileSequencer, NesOsc, Noise, Phaser, PipeOrgan, PitchShifter,
    Reverb, Rimshot909, SampleHold, Shepard, SlewLimiter, Snare909, SnesOsc, SpringReverb,
    StepSequencer, Supersaw, TapeDelay, Tb303, Tom909, Vcf, Vco, Vocoder,
};

use crate::types::ParamBuffer;

// =============================================================================
// Oscillator States
// =============================================================================

pub struct VcoState {
    pub vco: Vco,
    pub base_freq: ParamBuffer,
    pub waveform: ParamBuffer,
    pub pwm: ParamBuffer,
    pub fm_lin_depth: ParamBuffer,
    pub fm_exp_depth: ParamBuffer,
    pub unison: ParamBuffer,
    pub detune: ParamBuffer,
    pub sub_mix: ParamBuffer,
    pub sub_oct: ParamBuffer,
}

pub struct SupersawState {
    pub supersaw: Supersaw,
    pub base_freq: ParamBuffer,
    pub detune: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct KarplusState {
    pub karplus: KarplusStrong,
    pub frequency: ParamBuffer,
    pub damping: ParamBuffer,
    pub decay: ParamBuffer,
    pub brightness: ParamBuffer,
    pub pluck_pos: ParamBuffer,
}

pub struct NesOscState {
    pub nes_osc: NesOsc,
    pub base_freq: ParamBuffer,
    pub fine: ParamBuffer,
    pub volume: ParamBuffer,
    pub mode: ParamBuffer,
    pub duty: ParamBuffer,
    pub noise_mode: ParamBuffer,
    pub bitcrush: ParamBuffer,
}

pub struct SnesOscState {
    pub snes_osc: SnesOsc,
    pub base_freq: ParamBuffer,
    pub fine: ParamBuffer,
    pub volume: ParamBuffer,
    pub wave: ParamBuffer,
    pub gauss: ParamBuffer,
    pub color: ParamBuffer,
    pub lofi: ParamBuffer,
}

pub struct NoiseState {
    pub noise: Noise,
    pub level: ParamBuffer,
    pub noise_type: ParamBuffer,
}

pub struct Tb303State {
    pub tb303: Tb303,
    pub waveform: ParamBuffer,
    pub cutoff: ParamBuffer,
    pub resonance: ParamBuffer,
    pub decay: ParamBuffer,
    pub envmod: ParamBuffer,
    pub accent: ParamBuffer,
    pub glide: ParamBuffer,
}

pub struct FmOpState {
    pub op: FmOperator,
    pub frequency: ParamBuffer,
    pub ratio: ParamBuffer,
    pub level: ParamBuffer,
    pub feedback: ParamBuffer,
    pub attack: ParamBuffer,
    pub decay: ParamBuffer,
    pub sustain: ParamBuffer,
    pub release: ParamBuffer,
}

pub struct ShepardState {
    pub shepard: Shepard,
    pub voices: ParamBuffer,
    pub rate: ParamBuffer,
    pub base_freq: ParamBuffer,
    pub spread: ParamBuffer,
    pub mix: ParamBuffer,
    pub waveform: ParamBuffer,
    pub stereo: ParamBuffer,
    pub detune: ParamBuffer,
    pub direction: ParamBuffer,
    pub risset: ParamBuffer,
    pub phase_spread: ParamBuffer,
    pub interval: ParamBuffer,
    pub tilt: ParamBuffer,
    pub feedback: ParamBuffer,
    pub vibrato: ParamBuffer,
    pub shimmer: ParamBuffer,
}

pub struct PipeOrganState {
    pub organ: PipeOrgan,
    pub frequency: ParamBuffer,
    pub drawbar_16: ParamBuffer,
    pub drawbar_8: ParamBuffer,
    pub drawbar_4: ParamBuffer,
    pub drawbar_223: ParamBuffer,
    pub drawbar_2: ParamBuffer,
    pub drawbar_135: ParamBuffer,
    pub drawbar_113: ParamBuffer,
    pub drawbar_1: ParamBuffer,
    pub voicing: ParamBuffer,
    pub chiff: ParamBuffer,
    pub tremulant: ParamBuffer,
    pub trem_rate: ParamBuffer,
    pub wind: ParamBuffer,
    pub brightness: ParamBuffer,
}

// =============================================================================
// Filter States
// =============================================================================

pub struct VcfState {
    pub vcf: Vcf,
    pub cutoff: ParamBuffer,
    pub resonance: ParamBuffer,
    pub drive: ParamBuffer,
    pub env_amount: ParamBuffer,
    pub mod_amount: ParamBuffer,
    pub key_track: ParamBuffer,
    pub model: ParamBuffer,
    pub mode: ParamBuffer,
    pub slope: ParamBuffer,
}

pub struct HpfState {
    pub hpf: Hpf,
    pub cutoff: ParamBuffer,
}

// =============================================================================
// Amplifier / Mixer States
// =============================================================================

pub struct GainState {
    pub gain: ParamBuffer,
}

pub struct MixerState {
    pub level_a: ParamBuffer,
    pub level_b: ParamBuffer,
}

pub struct MixerWideState {
    pub level_a: ParamBuffer,
    pub level_b: ParamBuffer,
    pub level_c: ParamBuffer,
    pub level_d: ParamBuffer,
    pub level_e: ParamBuffer,
    pub level_f: ParamBuffer,
}

pub struct RingModState {
    pub level: ParamBuffer,
}

// =============================================================================
// Modulator States
// =============================================================================

pub struct LfoState {
    pub lfo: Lfo,
    pub rate: ParamBuffer,
    pub shape: ParamBuffer,
    pub depth: ParamBuffer,
    pub offset: ParamBuffer,
    pub bipolar: ParamBuffer,
}

pub struct AdsrState {
    pub adsr: Adsr,
    pub attack: ParamBuffer,
    pub decay: ParamBuffer,
    pub sustain: ParamBuffer,
    pub release: ParamBuffer,
}

pub struct ModRouterState {
    pub depth_pitch: ParamBuffer,
    pub depth_pwm: ParamBuffer,
    pub depth_vcf: ParamBuffer,
    pub depth_vca: ParamBuffer,
}

pub struct SampleHoldState {
    pub sample_hold: SampleHold,
    pub mode: ParamBuffer,
}

pub struct SlewState {
    pub slew: SlewLimiter,
    pub rise: ParamBuffer,
    pub fall: ParamBuffer,
}

pub struct QuantizerState {
    pub root: ParamBuffer,
    pub scale: ParamBuffer,
}

// =============================================================================
// Effect States
// =============================================================================

pub struct ChorusState {
    pub chorus: Chorus,
    pub rate: ParamBuffer,
    pub depth: ParamBuffer,
    pub delay: ParamBuffer,
    pub mix: ParamBuffer,
    pub feedback: ParamBuffer,
    pub spread: ParamBuffer,
}

pub struct EnsembleState {
    pub ensemble: Ensemble,
    pub rate: ParamBuffer,
    pub depth: ParamBuffer,
    pub delay: ParamBuffer,
    pub mix: ParamBuffer,
    pub spread: ParamBuffer,
}

pub struct ChoirState {
    pub choir: Choir,
    pub vowel: ParamBuffer,
    pub rate: ParamBuffer,
    pub depth: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct VocoderState {
    pub vocoder: Vocoder,
    pub attack: ParamBuffer,
    pub release: ParamBuffer,
    pub low: ParamBuffer,
    pub high: ParamBuffer,
    pub q: ParamBuffer,
    pub formant: ParamBuffer,
    pub emphasis: ParamBuffer,
    pub unvoiced: ParamBuffer,
    pub mix: ParamBuffer,
    pub mod_gain: ParamBuffer,
    pub car_gain: ParamBuffer,
}

pub struct DelayState {
    pub delay: Delay,
    pub time: ParamBuffer,
    pub feedback: ParamBuffer,
    pub mix: ParamBuffer,
    pub tone: ParamBuffer,
    pub ping_pong: ParamBuffer,
}

pub struct GranularDelayState {
    pub delay: GranularDelay,
    pub time: ParamBuffer,
    pub size: ParamBuffer,
    pub density: ParamBuffer,
    pub pitch: ParamBuffer,
    pub feedback: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct TapeDelayState {
    pub delay: TapeDelay,
    pub time: ParamBuffer,
    pub feedback: ParamBuffer,
    pub mix: ParamBuffer,
    pub tone: ParamBuffer,
    pub wow: ParamBuffer,
    pub flutter: ParamBuffer,
    pub drive: ParamBuffer,
}

pub struct SpringReverbState {
    pub reverb: SpringReverb,
    pub decay: ParamBuffer,
    pub tone: ParamBuffer,
    pub mix: ParamBuffer,
    pub drive: ParamBuffer,
}

pub struct ReverbState {
    pub reverb: Reverb,
    pub time: ParamBuffer,
    pub damp: ParamBuffer,
    pub pre_delay: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct PhaserState {
    pub phaser: Phaser,
    pub rate: ParamBuffer,
    pub depth: ParamBuffer,
    pub feedback: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct DistortionState {
    pub drive: ParamBuffer,
    pub tone: ParamBuffer,
    pub mix: ParamBuffer,
    pub mode: ParamBuffer,
}

pub struct WavefolderState {
    pub drive: ParamBuffer,
    pub fold: ParamBuffer,
    pub bias: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct PitchShifterState {
    pub shifter: PitchShifter,
    pub pitch: ParamBuffer,
    pub fine: ParamBuffer,
    pub grain: ParamBuffer,
    pub mix: ParamBuffer,
}

// =============================================================================
// Sequencer States
// =============================================================================

pub struct ClockState {
    pub clock: MasterClock,
    pub running: ParamBuffer,
    pub tempo: ParamBuffer,
    pub rate: ParamBuffer,
    pub swing: ParamBuffer,
}

pub struct ArpeggiatorState {
    pub arp: Arpeggiator,
    pub enabled: ParamBuffer,
    pub hold: ParamBuffer,
    pub mode: ParamBuffer,
    pub octaves: ParamBuffer,
    pub rate: ParamBuffer,
    pub gate_len: ParamBuffer,
    pub swing: ParamBuffer,
    pub tempo: ParamBuffer,
    pub ratchet: ParamBuffer,
    pub ratchet_decay: ParamBuffer,
    pub probability: ParamBuffer,
    pub velocity_mode: ParamBuffer,
    pub accent_pattern: ParamBuffer,
    pub euclid_steps: ParamBuffer,
    pub euclid_fill: ParamBuffer,
    pub euclid_rotate: ParamBuffer,
    pub euclid_enabled: ParamBuffer,
    pub mutate: ParamBuffer,
}

pub struct StepSequencerState {
    pub seq: StepSequencer,
    pub enabled: ParamBuffer,
    pub tempo: ParamBuffer,
    pub rate: ParamBuffer,
    pub gate_length: ParamBuffer,
    pub swing: ParamBuffer,
    pub slide_time: ParamBuffer,
    pub length: ParamBuffer,
    pub direction: ParamBuffer,
}

pub struct DrumSequencerState {
    pub seq: DrumSequencer,
    pub enabled: ParamBuffer,
    pub tempo: ParamBuffer,
    pub rate: ParamBuffer,
    pub gate_length: ParamBuffer,
    pub swing: ParamBuffer,
    pub length: ParamBuffer,
}

pub struct EuclideanState {
    pub euclidean: EuclideanSequencer,
    pub enabled: ParamBuffer,
    pub tempo: ParamBuffer,
    pub rate: ParamBuffer,
    pub steps: ParamBuffer,
    pub pulses: ParamBuffer,
    pub rotation: ParamBuffer,
    pub gate_length: ParamBuffer,
    pub swing: ParamBuffer,
}

pub struct MarioState {
    pub mario: Mario,
}

pub struct MidiFileSequencerState {
    pub seq: MidiFileSequencer,
    pub enabled: ParamBuffer,
    pub tempo: ParamBuffer,
    pub gate_length: ParamBuffer,
    pub loop_enabled: ParamBuffer,
    pub mute1: ParamBuffer,
    pub mute2: ParamBuffer,
    pub mute3: ParamBuffer,
    pub mute4: ParamBuffer,
    pub mute5: ParamBuffer,
    pub mute6: ParamBuffer,
    pub mute7: ParamBuffer,
    pub mute8: ParamBuffer,
}

// =============================================================================
// TR-909 Drum States
// =============================================================================

pub struct Kick909State {
    pub kick: Kick909,
    pub tune: ParamBuffer,
    pub attack: ParamBuffer,
    pub decay: ParamBuffer,
    pub drive: ParamBuffer,
}

pub struct Snare909State {
    pub snare: Snare909,
    pub tune: ParamBuffer,
    pub tone: ParamBuffer,
    pub snappy: ParamBuffer,
    pub decay: ParamBuffer,
}

pub struct HiHat909State {
    pub hihat: HiHat909,
    pub tune: ParamBuffer,
    pub decay: ParamBuffer,
    pub tone: ParamBuffer,
    pub open: ParamBuffer,
}

pub struct Clap909State {
    pub clap: Clap909,
    pub tone: ParamBuffer,
    pub decay: ParamBuffer,
}

pub struct Tom909State {
    pub tom: Tom909,
    pub tune: ParamBuffer,
    pub decay: ParamBuffer,
}

pub struct Rimshot909State {
    pub rimshot: Rimshot909,
    pub tune: ParamBuffer,
}

// =============================================================================
// I/O & Utility States
// =============================================================================

pub struct OutputState {
    pub level: ParamBuffer,
}

pub struct LabState {
    pub level: ParamBuffer,
}

pub struct AudioInState {
    pub gain: ParamBuffer,
}

pub struct ControlState {
    pub cv: f32,
    pub cv_target: f32,
    pub cv_step: f32,
    pub cv_remaining: usize,
    pub velocity: f32,
    pub velocity_target: f32,
    pub velocity_step: f32,
    pub velocity_remaining: usize,
    pub gate: f32,
    /// When > 0, output gate=0 for these samples to force a rising edge retrigger
    pub retrigger_samples: usize,
    pub sync_remaining: usize,
    pub glide_seconds: f32,
    pub sample_rate: f32,
}

// =============================================================================
// Module State Enum
// =============================================================================

/// Union type for all module states.
pub enum ModuleState {
    // Oscillators
    Vco(VcoState),
    Supersaw(SupersawState),
    Karplus(KarplusState),
    NesOsc(NesOscState),
    SnesOsc(SnesOscState),
    Noise(NoiseState),
    Tb303(Tb303State),
    FmOp(FmOpState),
    Shepard(ShepardState),
    PipeOrgan(PipeOrganState),

    // Filters
    Vcf(VcfState),
    Hpf(HpfState),

    // Amplifiers / Mixers
    Gain(GainState),
    CvVca(GainState),
    Mixer(MixerState),
    MixerWide(MixerWideState),
    RingMod(RingModState),

    // Modulators
    Lfo(LfoState),
    Adsr(AdsrState),
    ModRouter(ModRouterState),
    SampleHold(SampleHoldState),
    Slew(SlewState),
    Quantizer(QuantizerState),

    // Effects
    Chorus(ChorusState),
    Ensemble(EnsembleState),
    Choir(ChoirState),
    Vocoder(VocoderState),
    Delay(DelayState),
    GranularDelay(GranularDelayState),
    TapeDelay(TapeDelayState),
    SpringReverb(SpringReverbState),
    Reverb(ReverbState),
    Phaser(PhaserState),
    Distortion(DistortionState),
    Wavefolder(WavefolderState),
    PitchShifter(PitchShifterState),

    // Sequencers
    Clock(ClockState),
    Arpeggiator(ArpeggiatorState),
    StepSequencer(StepSequencerState),
    DrumSequencer(DrumSequencerState),
    Euclidean(EuclideanState),
    Mario(MarioState),
    MidiFileSequencer(MidiFileSequencerState),

    // TR-909 Drums
    Kick909(Kick909State),
    Snare909(Snare909State),
    HiHat909(HiHat909State),
    Clap909(Clap909State),
    Tom909(Tom909State),
    Rimshot909(Rimshot909State),

    // I/O & Utilities
    Output(OutputState),
    Lab(LabState),
    AudioIn(AudioInState),
    Control(ControlState),
    Scope,
    Notes,
}
