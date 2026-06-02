//! Effect module state structs.

use dsp_core::*;
use crate::types::ParamBuffer;

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
    pub tempo_sync: ParamBuffer,
    pub sync_rate: ParamBuffer,
    pub tempo: ParamBuffer,
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

pub struct CompressorState {
    pub compressor: Compressor,
    pub threshold: ParamBuffer,
    pub ratio: ParamBuffer,
    pub attack: ParamBuffer,
    pub release: ParamBuffer,
    pub makeup: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct BitCrusherState {
    pub crusher: BitCrusher,
    pub bits: ParamBuffer,
    pub downsample: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct FlangerState {
    pub flanger: Flanger,
    pub rate: ParamBuffer,
    pub depth: ParamBuffer,
    pub feedback: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct FreqShifterState {
    pub shifter: FrequencyShifter,
    pub shift: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct Eq3State {
    pub eq: Eq3,
    pub low_gain: ParamBuffer,
    pub mid_gain: ParamBuffer,
    pub high_gain: ParamBuffer,
    pub low_freq: ParamBuffer,
    pub mid_freq: ParamBuffer,
    pub high_freq: ParamBuffer,
    pub mid_q: ParamBuffer,
}

pub struct GlitchState {
    pub glitch: Glitch,
    pub probability: ParamBuffer,
    pub slice_ms: ParamBuffer,
    pub repeats: ParamBuffer,
    pub reverse_chance: ParamBuffer,
    pub pitch_range: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct LeslieState {
    pub leslie: Leslie,
    pub speed: ParamBuffer,
    pub brake: ParamBuffer,
    pub drive: ParamBuffer,
    pub depth: ParamBuffer,
    pub horn_drum: ParamBuffer,
    pub mic_dist: ParamBuffer,
    pub ramp: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct WahState {
    pub wah: Wah,
    pub mode: ParamBuffer,
    pub freq: ParamBuffer,
    pub range: ParamBuffer,
    pub resonance: ParamBuffer,
    pub speed: ParamBuffer,
    pub sensitivity: ParamBuffer,
    pub mix: ParamBuffer,
}

pub struct TubeAmpState {
    pub tube_amp: TubeAmp,
    pub gain: ParamBuffer,
    pub stages: ParamBuffer,
    pub tone: ParamBuffer,
    pub bias: ParamBuffer,
    pub sag: ParamBuffer,
    pub mix: ParamBuffer,
}
