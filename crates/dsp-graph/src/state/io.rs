//! I/O & utility module state structs (no dsp_core processors).

use crate::types::ParamBuffer;

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

// -- Meter -------------------------------------------------------------------
pub struct MeterState {
    pub peak_l: f32,
    pub peak_r: f32,
}

// -- Send/Receive (audio bus pass-through) -----------------------------------
pub struct SendState {
    pub bus: u32,
}

pub struct ReceiveState {
    pub bus: u32,
}
