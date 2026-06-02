//! Amplifiers module processing.
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
        ModuleState::RingMod(state) => {
            let input_a = if connections[0].is_empty() {
                None
            } else {
                Some(inputs[0].channel(0))
            };
            let input_b = if connections[1].is_empty() {
                None
            } else {
                Some(inputs[1].channel(0))
            };
            let output = outputs[0].channel_mut(0);
            let params = RingModParams {
                level: state.level.slice(frames),
            };
            RingMod::process_block(output, input_a, input_b, params);
        }
        ModuleState::Gain(state) => {
            let input_connected = !connections[0].is_empty();
            let cv_connected = !connections[1].is_empty();
            let gain = state.gain.slice(frames);
            let cv = if cv_connected { Some(inputs[1].channel(0)) } else { None };
            for channel in 0..2 {
                let src = if input_connected {
                    if inputs[0].channel_count() == 1 {
                        inputs[0].channel(0)
                    } else {
                        inputs[0].channel(channel)
                    }
                } else {
                    &[]
                };
                let output = outputs[0].channel_mut(channel);
                let input = if input_connected { Some(src) } else { None };
                Vca::process_block(output, input, cv, gain);
            }
        }
        ModuleState::CvVca(state) => {
            let input_connected = !connections[0].is_empty();
            let cv_connected = !connections[1].is_empty();
            let gain = state.gain.slice(frames);
            let input = if input_connected {
                Some(inputs[0].channel(0))
            } else {
                None
            };
            let cv = if cv_connected { Some(inputs[1].channel(0)) } else { None };
            let output = outputs[0].channel_mut(0);
            Vca::process_block(output, input, cv, gain);
        }
        ModuleState::Mixer(state) => {
            // Stereo mixer: process L and R channels separately
            let a_conn = !connections[0].is_empty();
            let b_conn = !connections[1].is_empty();
            let level_a = state.level_a.slice(frames);
            let level_b = state.level_b.slice(frames);

            // Process left channel
            let in_a_l = if a_conn { Some(inputs[0].channel(0)) } else { None };
            let in_b_l = if b_conn { Some(inputs[1].channel(0)) } else { None };
            let out_l = outputs[0].channel_mut(0);
            Mixer::process_block(out_l, in_a_l, in_b_l, level_a, level_b);

            // Process right channel
            let in_a_r = if a_conn { Some(inputs[0].channel(1)) } else { None };
            let in_b_r = if b_conn { Some(inputs[1].channel(1)) } else { None };
            let out_r = outputs[0].channel_mut(1);
            Mixer::process_block(out_r, in_a_r, in_b_r, level_a, level_b);
        }
        ModuleState::MixerWide(state) => {
            // Stereo mixer: process L and R channels separately
            let levels = [
                state.level_a.slice(frames),
                state.level_b.slice(frames),
                state.level_c.slice(frames),
                state.level_d.slice(frames),
                state.level_e.slice(frames),
                state.level_f.slice(frames),
            ];

            // Process left channel
            let inputs_l: [Option<&[f32]>; 6] = [
                if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) },
                if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) },
                if connections[2].is_empty() { None } else { Some(inputs[2].channel(0)) },
                if connections[3].is_empty() { None } else { Some(inputs[3].channel(0)) },
                if connections[4].is_empty() { None } else { Some(inputs[4].channel(0)) },
                if connections[5].is_empty() { None } else { Some(inputs[5].channel(0)) },
            ];
            let out_l = outputs[0].channel_mut(0);
            Mixer::process_block_multi(out_l, &inputs_l, &levels);

            // Process right channel
            let inputs_r: [Option<&[f32]>; 6] = [
                if connections[0].is_empty() { None } else { Some(inputs[0].channel(1)) },
                if connections[1].is_empty() { None } else { Some(inputs[1].channel(1)) },
                if connections[2].is_empty() { None } else { Some(inputs[2].channel(1)) },
                if connections[3].is_empty() { None } else { Some(inputs[3].channel(1)) },
                if connections[4].is_empty() { None } else { Some(inputs[4].channel(1)) },
                if connections[5].is_empty() { None } else { Some(inputs[5].channel(1)) },
            ];
            let out_r = outputs[0].channel_mut(1);
            Mixer::process_block_multi(out_r, &inputs_r, &levels);
        }
        ModuleState::Mixer8(state) => {
            // Stereo mixer: process L and R channels separately
            let levels = [
                state.level1.slice(frames),
                state.level2.slice(frames),
                state.level3.slice(frames),
                state.level4.slice(frames),
                state.level5.slice(frames),
                state.level6.slice(frames),
                state.level7.slice(frames),
                state.level8.slice(frames),
            ];

            // Process left channel
            let inputs_l: [Option<&[f32]>; 8] = [
                if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) },
                if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) },
                if connections[2].is_empty() { None } else { Some(inputs[2].channel(0)) },
                if connections[3].is_empty() { None } else { Some(inputs[3].channel(0)) },
                if connections[4].is_empty() { None } else { Some(inputs[4].channel(0)) },
                if connections[5].is_empty() { None } else { Some(inputs[5].channel(0)) },
                if connections[6].is_empty() { None } else { Some(inputs[6].channel(0)) },
                if connections[7].is_empty() { None } else { Some(inputs[7].channel(0)) },
            ];
            let out_l = outputs[0].channel_mut(0);
            Mixer::process_block_multi(out_l, &inputs_l, &levels);

            // Process right channel
            let inputs_r: [Option<&[f32]>; 8] = [
                if connections[0].is_empty() { None } else { Some(inputs[0].channel(1)) },
                if connections[1].is_empty() { None } else { Some(inputs[1].channel(1)) },
                if connections[2].is_empty() { None } else { Some(inputs[2].channel(1)) },
                if connections[3].is_empty() { None } else { Some(inputs[3].channel(1)) },
                if connections[4].is_empty() { None } else { Some(inputs[4].channel(1)) },
                if connections[5].is_empty() { None } else { Some(inputs[5].channel(1)) },
                if connections[6].is_empty() { None } else { Some(inputs[6].channel(1)) },
                if connections[7].is_empty() { None } else { Some(inputs[7].channel(1)) },
            ];
            let out_r = outputs[0].channel_mut(1);
            Mixer::process_block_multi(out_r, &inputs_r, &levels);
        }
        ModuleState::Crossfader(state) => {
            // Stereo crossfader: process L and R channels separately
            let a_conn = !connections[0].is_empty();
            let b_conn = !connections[1].is_empty();

            // If nothing connected, output silence on both channels
            if !a_conn && !b_conn {
                outputs[0].channel_mut(0).fill(0.0);
                outputs[0].channel_mut(1).fill(0.0);
                return true;
            }

            let mix = state.mix.slice(frames);
            let mix_cv = if connections.len() > 2 && !connections[2].is_empty() {
                Some(inputs[2].channel(0))
            } else {
                None
            };

            // Process left channel
            let in_a_l = if a_conn { Some(inputs[0].channel(0)) } else { None };
            let in_b_l = if b_conn { Some(inputs[1].channel(0)) } else { None };
            let out_l = outputs[0].channel_mut(0);
            Crossfader::process_block(out_l, in_a_l, in_b_l, mix, mix_cv);

            // Process right channel
            let in_a_r = if a_conn { Some(inputs[0].channel(1)) } else { None };
            let in_b_r = if b_conn { Some(inputs[1].channel(1)) } else { None };
            let out_r = outputs[0].channel_mut(1);
            Crossfader::process_block(out_r, in_a_r, in_b_r, mix, mix_cv);
        }
        _ => return false,
    }
    true
}
