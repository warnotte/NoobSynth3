//! Filter module state structs.

use dsp_core::*;
use crate::types::ParamBuffer;

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
