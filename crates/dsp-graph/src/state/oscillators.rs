//! Oscillator / source module state structs.

use dsp_core::*;
use crate::types::ParamBuffer;

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
    pub stereo: ParamBuffer,
    pub pan: ParamBuffer,
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

pub struct FmMatrixState {
    pub matrix: FmMatrix,
    // Global params
    pub algorithm: ParamBuffer,
    pub feedback: ParamBuffer,
    pub brightness: ParamBuffer,
    pub master: ParamBuffer,
    // Operator 1
    pub op1_ratio: ParamBuffer,
    pub op1_level: ParamBuffer,
    pub op1_detune: ParamBuffer,
    pub op1_attack: ParamBuffer,
    pub op1_decay: ParamBuffer,
    pub op1_sustain: ParamBuffer,
    pub op1_release: ParamBuffer,
    // Operator 2
    pub op2_ratio: ParamBuffer,
    pub op2_level: ParamBuffer,
    pub op2_detune: ParamBuffer,
    pub op2_attack: ParamBuffer,
    pub op2_decay: ParamBuffer,
    pub op2_sustain: ParamBuffer,
    pub op2_release: ParamBuffer,
    // Operator 3
    pub op3_ratio: ParamBuffer,
    pub op3_level: ParamBuffer,
    pub op3_detune: ParamBuffer,
    pub op3_attack: ParamBuffer,
    pub op3_decay: ParamBuffer,
    pub op3_sustain: ParamBuffer,
    pub op3_release: ParamBuffer,
    // Operator 4
    pub op4_ratio: ParamBuffer,
    pub op4_level: ParamBuffer,
    pub op4_detune: ParamBuffer,
    pub op4_attack: ParamBuffer,
    pub op4_decay: ParamBuffer,
    pub op4_sustain: ParamBuffer,
    pub op4_release: ParamBuffer,
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
    pub percussion: ParamBuffer,
    pub perc_harmonic: ParamBuffer,
    pub perc_decay: ParamBuffer,
    pub perc_volume: ParamBuffer,
    pub chorus_vibrato: ParamBuffer,
    pub tremulant: ParamBuffer,
    pub trem_rate: ParamBuffer,
    pub wind: ParamBuffer,
    pub brightness: ParamBuffer,
}

pub struct SpectralSwarmState {
    pub swarm: SpectralSwarm,
    pub frequency: ParamBuffer,
    pub partials: ParamBuffer,
    pub detune: ParamBuffer,
    pub drift: ParamBuffer,
    pub density: ParamBuffer,
    pub evolution: ParamBuffer,
    pub inharmonic: ParamBuffer,
    pub tilt: ParamBuffer,
    pub spread: ParamBuffer,
    pub shimmer: ParamBuffer,
    pub attack: ParamBuffer,
    pub release: ParamBuffer,
    // New parameters
    pub waveform: ParamBuffer,
    pub odd_even: ParamBuffer,
    pub fundamental_mix: ParamBuffer,
    pub formant_freq: ParamBuffer,
    pub formant_q: ParamBuffer,
    pub freeze: ParamBuffer,
    pub chorus: ParamBuffer,
    pub attack_low: ParamBuffer,
    pub attack_high: ParamBuffer,
    pub release_low: ParamBuffer,
    pub release_high: ParamBuffer,
}

pub struct ResonatorState {
    pub resonator: Resonator,
    pub frequency: ParamBuffer,
    pub structure: ParamBuffer,
    pub brightness: ParamBuffer,
    pub damping: ParamBuffer,
    pub position: ParamBuffer,
    pub mode: ParamBuffer,
    pub polyphony: ParamBuffer,
    pub internal_exc: ParamBuffer,
    pub chorus: ParamBuffer,
}

pub struct WavetableState {
    pub wavetable: Wavetable,
    pub frequency: ParamBuffer,
    pub bank: ParamBuffer,
    pub position: ParamBuffer,
    pub unison: ParamBuffer,
    pub detune: ParamBuffer,
    pub spread: ParamBuffer,
    pub morph_speed: ParamBuffer,
    pub sub_mix: ParamBuffer,
    pub attack: ParamBuffer,
    pub release: ParamBuffer,
}

pub struct GranularState {
    pub granular: Granular,
    pub position: ParamBuffer,
    pub size: ParamBuffer,
    pub density: ParamBuffer,
    pub pitch: ParamBuffer,
    pub spray: ParamBuffer,
    pub scatter: ParamBuffer,
    pub pan_spread: ParamBuffer,
    pub shape: ParamBuffer,
    pub level: ParamBuffer,
}

pub struct SamplerState {
    pub sampler: Sampler,
    pub pitch: ParamBuffer,
    pub level: ParamBuffer,
    pub attack: ParamBuffer,
    pub release: ParamBuffer,
    pub loop_mode: ParamBuffer,
    pub loop_start: ParamBuffer,
    pub loop_end: ParamBuffer,
}

pub struct ParticleCloudState {
    pub cloud: ParticleCloud,
    pub count: ParamBuffer,
    pub gravity: ParamBuffer,
    pub turbulence: ParamBuffer,
    pub friction: ParamBuffer,
    pub grain_size: ParamBuffer,
    pub pitch: ParamBuffer,
    pub spread: ParamBuffer,
    pub level: ParamBuffer,
    pub mode: ParamBuffer,
    pub osc_shape: ParamBuffer,
}

pub struct SpeechSynthState {
    pub synth: SpeechSynth,
    pub speed: ParamBuffer,
    pub formant_shift: ParamBuffer,
    pub smoothing: ParamBuffer,
    pub buzz: ParamBuffer,
    pub noise_mix: ParamBuffer,
}

pub struct ThereminState {
    pub theremin: Theremin,
    pub frequency: ParamBuffer,
    pub volume: ParamBuffer,
    pub touch: ParamBuffer,
    pub waveform: ParamBuffer,
    pub vibrato_rate: ParamBuffer,
    pub vibrato_depth: ParamBuffer,
    pub tremolo_rate: ParamBuffer,
    pub tremolo_depth: ParamBuffer,
    pub tone: ParamBuffer,
    pub glide: ParamBuffer,
    pub level: ParamBuffer,
    pub attack: ParamBuffer,
    pub release: ParamBuffer,
    pub lo_freq: ParamBuffer,
    pub hi_freq: ParamBuffer,
}
