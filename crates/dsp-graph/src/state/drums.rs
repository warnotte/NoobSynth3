//! TR-909 / TR-808 drum module state structs.

use dsp_core::*;
use crate::types::ParamBuffer;

// TR-909

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

pub struct Crash909State {
    pub crash: Crash909,
    pub tune: ParamBuffer,
    pub decay: ParamBuffer,
    pub tone: ParamBuffer,
}

pub struct Ride909State {
    pub ride: Ride909,
    pub tune: ParamBuffer,
    pub decay: ParamBuffer,
    pub bell: ParamBuffer,
}

/// All-in-one TR-909 drum machine: 11 embedded voices + internal Seq909.
pub struct DrumMachine909State {
    // 11 voices (lane order: bd sd lt mt ht rs cp ch oh cr rd)
    pub bd: Kick909,
    pub sd: Snare909,
    pub lt: Tom909,
    pub mt: Tom909,
    pub ht: Tom909,
    pub rs: Rimshot909,
    pub cp: Clap909,
    pub ch: HiHat909,
    pub oh: HiHat909,
    pub cr: Crash909,
    pub rd: Ride909,
    pub seq: Seq909,
    pub oh_muted: bool, // CH→OH choke state
    // global params
    pub enabled: ParamBuffer,
    pub rate: ParamBuffer,
    pub swing: ParamBuffer,
    pub length: ParamBuffer,
    pub pattern: ParamBuffer,
    pub fill: ParamBuffer,
    // per-voice live params (other voice params use fixed defaults at construction)
    pub bd_tune: ParamBuffer, pub bd_decay: ParamBuffer, pub bd_level: ParamBuffer,
    pub sd_tune: ParamBuffer, pub sd_snappy: ParamBuffer, pub sd_decay: ParamBuffer, pub sd_level: ParamBuffer,
    pub lt_tune: ParamBuffer, pub lt_decay: ParamBuffer, pub lt_level: ParamBuffer,
    pub mt_tune: ParamBuffer, pub mt_decay: ParamBuffer, pub mt_level: ParamBuffer,
    pub ht_tune: ParamBuffer, pub ht_decay: ParamBuffer, pub ht_level: ParamBuffer,
    pub rs_tune: ParamBuffer, pub rs_level: ParamBuffer,
    pub cp_tone: ParamBuffer, pub cp_decay: ParamBuffer, pub cp_level: ParamBuffer,
    pub ch_tune: ParamBuffer, pub ch_decay: ParamBuffer, pub ch_level: ParamBuffer,
    pub oh_tune: ParamBuffer, pub oh_decay: ParamBuffer, pub oh_level: ParamBuffer,
    pub cr_tune: ParamBuffer, pub cr_decay: ParamBuffer, pub cr_tone: ParamBuffer, pub cr_level: ParamBuffer,
    pub rd_tune: ParamBuffer, pub rd_decay: ParamBuffer, pub rd_bell: ParamBuffer, pub rd_level: ParamBuffer,
}

// TR-808

pub struct Kick808State {
    pub kick: Kick808,
    pub tune: ParamBuffer,
    pub decay: ParamBuffer,
    pub tone: ParamBuffer,
    pub click: ParamBuffer,
}

pub struct Snare808State {
    pub snare: Snare808,
    pub tune: ParamBuffer,
    pub tone: ParamBuffer,
    pub snappy: ParamBuffer,
    pub decay: ParamBuffer,
}

pub struct HiHat808State {
    pub hihat: HiHat808,
    pub tune: ParamBuffer,
    pub decay: ParamBuffer,
    pub tone: ParamBuffer,
    pub snap: ParamBuffer,
}

pub struct Cowbell808State {
    pub cowbell: Cowbell808,
    pub tune: ParamBuffer,
    pub decay: ParamBuffer,
    pub tone: ParamBuffer,
}

pub struct Clap808State {
    pub clap: Clap808,
    pub tone: ParamBuffer,
    pub decay: ParamBuffer,
    pub spread: ParamBuffer,
}

pub struct Tom808State {
    pub tom: Tom808,
    pub tune: ParamBuffer,
    pub decay: ParamBuffer,
    pub pitch: ParamBuffer,
    pub tone: ParamBuffer,
}
