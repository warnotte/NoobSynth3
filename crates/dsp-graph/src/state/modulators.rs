//! Modulator module state structs.

use dsp_core::*;
use crate::types::ParamBuffer;

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

pub struct ChaosState {
    pub chaos: Chaos,
    pub speed: ParamBuffer,
    pub rho: ParamBuffer,
    pub sigma: ParamBuffer,
    pub beta: ParamBuffer,
    pub scale: ParamBuffer,
    pub root: ParamBuffer,
}

pub struct EnvelopeFollowerState {
    pub envelope_follower: EnvelopeFollower,
    pub attack: ParamBuffer,
    pub release: ParamBuffer,
    pub gain: ParamBuffer,
}
