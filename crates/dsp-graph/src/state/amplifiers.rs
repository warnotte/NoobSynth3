//! Amplifier / mixer module state structs (all pure ParamBuffer).

use crate::types::ParamBuffer;

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

pub struct Mixer8State {
    pub level1: ParamBuffer,
    pub level2: ParamBuffer,
    pub level3: ParamBuffer,
    pub level4: ParamBuffer,
    pub level5: ParamBuffer,
    pub level6: ParamBuffer,
    pub level7: ParamBuffer,
    pub level8: ParamBuffer,
}

/// Crossfader: mix between two audio inputs (0 = 100% A, 1 = 100% B)
pub struct CrossfaderState {
    pub mix: ParamBuffer,
}

pub struct RingModState {
    pub level: ParamBuffer,
}
