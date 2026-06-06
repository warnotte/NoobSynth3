//! Drums module processing.
#![allow(unused_variables, unused_imports)]

use dsp_core::{
    AdsrInputs, AdsrParams, ArpeggiatorInputs, ArpeggiatorOutputs, ArpeggiatorParams,
    ChaosInputs, ChaosParams,
    ChoirInputs, ChoirParams, ChorusInputs, ChorusParams,
    Clap808Inputs, Clap808Params, Clap909Inputs, Clap909Params,
    BitCrusherInputs, BitCrusherParams,
    CompressorParams,
    Eq3Inputs, Eq3Params,
    FlangerInputs, FlangerParams,
    FrequencyShifterInputs, FrequencyShifterParams,
    GlitchInputs, GlitchParams,
    LeslieInputs, LeslieParams,
    WahInputs, WahParams, TubeAmpInputs, TubeAmpParams,
    Cowbell808Inputs, Cowbell808Params,
    DelayInputs, DelayParams, Distortion, DistortionParams,
    DrumSequencerInputs, DrumSequencerOutputs, DrumSequencerParams,
    EnsembleInputs, EnsembleParams, EuclideanInputs, EuclideanParams,
    FmMatrixParams, FmOperatorInputs, FmOperatorParams, OpParams,
    GranularDelayInputs, GranularDelayParams,
    GranularInputs, GranularParams,
    HiHat808Inputs, HiHat808Params,
    HiHat909Inputs, HiHat909Params, HpfInputs, HpfParams,
    KarplusInputs, KarplusParams,
    Kick808Inputs, Kick808Params,
    Kick909Inputs, Kick909Params,
    LfoInputs, LfoParams,
    MasterClockInputs, MasterClockOutputs, MasterClockParams,
    MidiFileSequencerInputs, MidiFileSequencerOutputs, MidiFileSequencerParams,
    Mixer, Crossfader, NesOscInputs, NesOscParams, NoiseParams,
    ParticleCloudInputs, ParticleCloudParams,
    PhaserInputs, PhaserParams, PipeOrganInputs, PipeOrganParams, PitchShifterInputs, PitchShifterParams,
    Quantizer, QuantizerInputs, QuantizerParams,
    ResonatorInputs, ResonatorParams,
    ReverbInputs, ReverbParams, RingMod, RingModParams,
    Rimshot909Inputs, Rimshot909Params, Sample,
    Crash909Inputs, Crash909Params, Ride909Inputs, Ride909Params,
    SampleHoldInputs, SampleHoldParams, ShepardInputs, ShepardParams,
    SidPlayerInputs, SidPlayerOutputs, SidPlayerParams,
    SpeechSynthInputs, SpeechSynthParams,
    ThereminInputs, ThereminOutputs, ThereminParams,
    AyPlayerInputs, AyPlayerOutputs, AyPlayerParams,
    ChordSequencerInputs, ChordSequencerOutputs, ChordSequencerParams,
    ClockDividerInputs, ClockDividerOutputs,
    PolyrhythmInputs, PolyrhythmOutputs, PolyrhythmParams,
    SlewInputs, SlewParams,
    EnvelopeFollowerInputs, EnvelopeFollowerParams,
    Snare808Inputs, Snare808Params,
    Snare909Inputs, Snare909Params, SnesOscInputs, SnesOscParams, SpectralSwarmInputs, SpectralSwarmParams,
    SpringReverbInputs, SpringReverbParams,
    StepSequencerInputs, StepSequencerOutputs, StepSequencerParams,
    SupersawInputs, SupersawParams,
    TapeDelayInputs, TapeDelayParams,
    Tb303Inputs, Tb303Outputs, Tb303Params,
    Tom808Inputs, Tom808Params, Tom909Inputs, Tom909Params,
    TuringInputs, TuringParams,
    GameOfLifeInputs, GameOfLifeParams,
    GravityInputs, GravityParams,
    Vca, VcfInputs, VcfParams, VcoInputs, VcoParams,
    VocoderInputs, VocoderParams, Wavefolder, WavefolderParams,
    WavetableInputs, WavetableParams,
    MARIO_CHANNELS,
    sequencers::RATE_DIVISIONS,
};

use crate::buffer::{mix_buffers, Buffer};
use crate::state::*;
use crate::types::{ConnectionEdge, TransportContext};
use super::ZERO_BUFFER;

pub(crate) fn process(
    state: &mut ModuleState,
    connections: &[Vec<ConnectionEdge>],
    inputs: &[Buffer],
    outputs: &mut [Buffer],
    frames: usize,
    transport: TransportContext,
) -> bool {
    match state {
        ModuleState::Kick909(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let kick_inputs = Kick909Inputs { trigger, accent };
            let params = Kick909Params {
                tune: state.tune.slice(frames),
                attack: state.attack.slice(frames),
                decay: state.decay.slice(frames),
                drive: state.drive.slice(frames),
            };
            state.kick.process_block(out, kick_inputs, params);
        }
        ModuleState::Snare909(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let snare_inputs = Snare909Inputs { trigger, accent };
            let params = Snare909Params {
                tune: state.tune.slice(frames),
                tone: state.tone.slice(frames),
                snappy: state.snappy.slice(frames),
                decay: state.decay.slice(frames),
            };
            state.snare.process_block(out, snare_inputs, params);
        }
        ModuleState::HiHat909(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let hihat_inputs = HiHat909Inputs { trigger, accent };
            let params = HiHat909Params {
                tune: state.tune.slice(frames),
                decay: state.decay.slice(frames),
                tone: state.tone.slice(frames),
                open: state.open.slice(frames),
            };
            state.hihat.process_block(out, hihat_inputs, params);
        }
        ModuleState::Clap909(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let clap_inputs = Clap909Inputs { trigger, accent };
            let params = Clap909Params {
                tone: state.tone.slice(frames),
                decay: state.decay.slice(frames),
            };
            state.clap.process_block(out, clap_inputs, params);
        }
        ModuleState::Tom909(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let tom_inputs = Tom909Inputs { trigger, accent };
            let params = Tom909Params {
                tune: state.tune.slice(frames),
                decay: state.decay.slice(frames),
            };
            state.tom.process_block(out, tom_inputs, params);
        }
        ModuleState::Rimshot909(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let rim_inputs = Rimshot909Inputs { trigger, accent };
            let params = Rimshot909Params {
                tune: state.tune.slice(frames),
            };
            state.rimshot.process_block(out, rim_inputs, params);
        }
        ModuleState::Crash909(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let crash_inputs = Crash909Inputs { trigger, accent };
            let params = Crash909Params {
                tune: state.tune.slice(frames),
                decay: state.decay.slice(frames),
                tone: state.tone.slice(frames),
            };
            state.crash.process_block(out, crash_inputs, params);
        }
        ModuleState::Ride909(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let ride_inputs = Ride909Inputs { trigger, accent };
            let params = Ride909Params {
                tune: state.tune.slice(frames),
                decay: state.decay.slice(frames),
                bell: state.bell.slice(frames),
            };
            state.ride.process_block(out, ride_inputs, params);
        }
        // TR-808 Drums
        ModuleState::Kick808(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let kick_inputs = Kick808Inputs { trigger, accent };
            let params = Kick808Params {
                tune: state.tune.slice(frames),
                decay: state.decay.slice(frames),
                tone: state.tone.slice(frames),
                click: state.click.slice(frames),
            };
            state.kick.process_block(out, kick_inputs, params);
        }
        ModuleState::Snare808(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let snare_inputs = Snare808Inputs { trigger, accent };
            let params = Snare808Params {
                tune: state.tune.slice(frames),
                tone: state.tone.slice(frames),
                snappy: state.snappy.slice(frames),
                decay: state.decay.slice(frames),
            };
            state.snare.process_block(out, snare_inputs, params);
        }
        ModuleState::HiHat808(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let hihat_inputs = HiHat808Inputs { trigger, accent };
            let params = HiHat808Params {
                tune: state.tune.slice(frames),
                decay: state.decay.slice(frames),
                tone: state.tone.slice(frames),
                snap: state.snap.slice(frames),
            };
            state.hihat.process_block(out, hihat_inputs, params);
        }
        ModuleState::Cowbell808(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let cowbell_inputs = Cowbell808Inputs { trigger, accent };
            let params = Cowbell808Params {
                tune: state.tune.slice(frames),
                decay: state.decay.slice(frames),
                tone: state.tone.slice(frames),
            };
            state.cowbell.process_block(out, cowbell_inputs, params);
        }
        ModuleState::Clap808(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let clap_inputs = Clap808Inputs { trigger, accent };
            let params = Clap808Params {
                tone: state.tone.slice(frames),
                decay: state.decay.slice(frames),
                spread: state.spread.slice(frames),
            };
            state.clap.process_block(out, clap_inputs, params);
        }
        ModuleState::Tom808(state) => {
            let trigger = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let accent = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let out = outputs[0].channel_mut(0);
            let tom_inputs = Tom808Inputs { trigger, accent };
            let params = Tom808Params {
                tune: state.tune.slice(frames),
                decay: state.decay.slice(frames),
                pitch: state.pitch.slice(frames),
                tone: state.tone.slice(frames),
            };
            state.tom.process_block(out, tom_inputs, params);
        }
        _ => return false,
    }
    true
}
