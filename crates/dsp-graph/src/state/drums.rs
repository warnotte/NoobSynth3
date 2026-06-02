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
