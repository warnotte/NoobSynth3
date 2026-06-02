//! Sequencer module state structs.

use dsp_core::*;
use dsp_core::sequencers::game_of_life::GameOfLife;
use dsp_core::sequencers::gravity::GravitySequencer as GravitySeq;
use crate::types::ParamBuffer;

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
    pub voice_index: usize,
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

pub struct TuringState {
    pub turing: TuringMachine,
    pub probability: ParamBuffer,
    pub length: ParamBuffer,
    pub range: ParamBuffer,
    pub scale: ParamBuffer,
    pub root: ParamBuffer,
}

pub struct GameOfLifeState {
    pub gol: GameOfLife,
    pub evolve_rate: ParamBuffer,
    pub range: ParamBuffer,
    pub scale: ParamBuffer,
    pub root: ParamBuffer,
    pub wrap: ParamBuffer,
}

pub struct GravityState {
    pub gravity: GravitySeq,
    pub speed: ParamBuffer,
    pub bodies: ParamBuffer,
    pub eccentricity: ParamBuffer,
    pub spread: ParamBuffer,
    pub range: ParamBuffer,
    pub scale: ParamBuffer,
    pub root: ParamBuffer,
    pub chaos: ParamBuffer,
}

pub struct SidPlayerState {
    pub sid_player: SidPlayer,
    pub playing: ParamBuffer,
    pub song: ParamBuffer,
    pub chip_model: ParamBuffer,
}

pub struct AyPlayerState {
    pub ay_player: AyPlayer,
    pub playing: ParamBuffer,
    pub loop_enabled: ParamBuffer,
}

pub struct ChordSequencerState {
    pub seq: ChordSequencer,
    pub enabled: ParamBuffer,
    pub tempo: ParamBuffer,
    pub rate: ParamBuffer,
    pub gate_length: ParamBuffer,
    pub swing: ParamBuffer,
    pub length: ParamBuffer,
    pub strum_speed: ParamBuffer,
    pub strum_direction: ParamBuffer,
    pub voicing: ParamBuffer,
}

pub struct ClockDividerState {
    pub divider: ClockDivider,
}

pub struct PolyrhythmSequencerState {
    pub seq: PolyrhythmSequencer,
    pub enabled: ParamBuffer,
    pub tempo: ParamBuffer,
    pub rate: ParamBuffer,
    pub gate_length: ParamBuffer,
    pub swing: ParamBuffer,
    pub track1_length: ParamBuffer,
    pub track2_length: ParamBuffer,
    pub track3_length: ParamBuffer,
    pub track4_length: ParamBuffer,
    pub track1_mute: ParamBuffer,
    pub track2_mute: ParamBuffer,
    pub track3_mute: ParamBuffer,
    pub track4_mute: ParamBuffer,
}
