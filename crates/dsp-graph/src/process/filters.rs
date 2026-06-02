//! Filters module processing.
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
        ModuleState::Vcf(state) => {
            let audio = if connections[0].is_empty() {
                None
            } else {
                Some(inputs[0].channel(0))
            };
            let mod_in = if connections[1].is_empty() {
                None
            } else {
                Some(inputs[1].channel(0))
            };
            let env = if connections[2].is_empty() {
                None
            } else {
                Some(inputs[2].channel(0))
            };
            let key = if connections[3].is_empty() {
                None
            } else {
                Some(inputs[3].channel(0))
            };
            let params = VcfParams {
                cutoff: state.cutoff.slice(frames),
                resonance: state.resonance.slice(frames),
                drive: state.drive.slice(frames),
                env_amount: state.env_amount.slice(frames),
                mod_amount: state.mod_amount.slice(frames),
                key_track: state.key_track.slice(frames),
                model: state.model.slice(frames),
                mode: state.mode.slice(frames),
                slope: state.slope.slice(frames),
            };
            let vcf_inputs = VcfInputs {
                audio,
                mod_in,
                env,
                key,
            };
            let output = outputs[0].channel_mut(0);
            state.vcf.process_block(output, vcf_inputs, params);
        }
        ModuleState::Hpf(state) => {
            let audio = if connections[0].is_empty() {
                None
            } else {
                Some(inputs[0].channel(0))
            };
            let params = HpfParams {
                cutoff: state.cutoff.slice(frames),
            };
            let hpf_inputs = HpfInputs { audio };
            let output = outputs[0].channel_mut(0);
            state.hpf.process_block(output, hpf_inputs, params);
        }
        _ => return false,
    }
    true
}
