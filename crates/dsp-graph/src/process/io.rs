//! Io module processing.
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
        ModuleState::Output(state) => {
            let input_connected = !connections[0].is_empty();
            let gain = state.level.slice(frames);
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
                if input_connected {
                    for i in 0..frames {
                        output[i] = src[i] * gain[i];
                    }
                } else {
                    output.fill(0.0);
                }
            }
        }
        ModuleState::Lab(state) => {
            let gain = state.level.slice(frames);
            let in_a_connected = !connections[0].is_empty();
            let in_b_connected = !connections[1].is_empty();
            let (out_a_group, out_b_group) = outputs.split_at_mut(1);
            let out_a_group = &mut out_a_group[0];
            let out_b_group = &mut out_b_group[0];
            for channel in 0..2 {
                let out_a = out_a_group.channel_mut(channel);
                let out_b = out_b_group.channel_mut(channel);
                let in_a = if in_a_connected {
                    if inputs[0].channel_count() == 1 {
                        inputs[0].channel(0)
                    } else {
                        inputs[0].channel(channel)
                    }
                } else {
                    &[]
                };
                let in_b = if in_b_connected {
                    if inputs[1].channel_count() == 1 {
                        inputs[1].channel(0)
                    } else {
                        inputs[1].channel(channel)
                    }
                } else {
                    &[]
                };
                for i in 0..frames {
                    let mut sample = 0.0;
                    if in_a_connected {
                        sample += in_a[i];
                    }
                    if in_b_connected {
                        sample += in_b[i];
                    }
                    let value = sample * gain[i];
                    out_a[i] = value;
                    out_b[i] = value;
                }
            }
        }
        ModuleState::AudioIn(_) => {
            // Handled in GraphEngine::render via external input injection.
        }
        ModuleState::Control(state) => {
            let (cv_group, rest) = outputs.split_at_mut(1);
            let (vel_group, rest) = rest.split_at_mut(1);
            let (gate_group, rest) = rest.split_at_mut(1);
            let cv_out = cv_group[0].channel_mut(0);
            let vel_out = vel_group[0].channel_mut(0);
            let gate_out = gate_group[0].channel_mut(0);
            let sync_out = rest[0].channel_mut(0);
            for i in 0..frames {
                if state.cv_remaining > 0 {
                    state.cv += state.cv_step;
                    state.cv_remaining -= 1;
                }
                if state.velocity_remaining > 0 {
                    state.velocity += state.velocity_step;
                    state.velocity_remaining -= 1;
                }
                cv_out[i] = state.cv;
                vel_out[i] = state.velocity;
                if state.retrigger_samples > 0 {
                    gate_out[i] = 0.0;
                    state.retrigger_samples -= 1;
                } else {
                    gate_out[i] = state.gate;
                }
                if state.sync_remaining > 0 {
                    sync_out[i] = 1.0;
                    state.sync_remaining -= 1;
                } else {
                    sync_out[i] = 0.0;
                }
            }
        }
        ModuleState::Scope => {
            let in_a_connected = !connections[0].is_empty();
            let in_b_connected = !connections[1].is_empty();
            let (out_a_group, out_b_group) = outputs.split_at_mut(1);
            let out_a = &mut out_a_group[0];
            let out_b = &mut out_b_group[0];
            out_a.resize(2, frames);
            out_b.resize(2, frames);
            out_a.clear();
            out_b.clear();
            if in_a_connected {
                mix_buffers(out_a, &inputs[0], 1.0);
            }
            if in_b_connected {
                mix_buffers(out_b, &inputs[1], 1.0);
            }
        }
        ModuleState::Meter(state) => {
            // Track peak amplitude from stereo input
            let left = inputs[0].channel(0);
            let right = inputs[0].channel(1);
            let mut peak_l = 0.0_f32;
            let mut peak_r = 0.0_f32;
            for i in 0..left.len() {
                peak_l = peak_l.max(left[i].abs());
                peak_r = peak_r.max(right[i].abs());
            }
            // Smooth decay (~20dB/s at 44100 Hz / 128 block)
            let decay = 0.95_f32;
            state.peak_l = (state.peak_l * decay).max(peak_l);
            state.peak_r = (state.peak_r * decay).max(peak_r);
        }
        ModuleState::Send(_state) => {
            // Pass-through: copy stereo input to stereo output
            let input_connected = !connections[0].is_empty();
            if input_connected {
                for channel in 0..2 {
                    let src = if inputs[0].channel_count() == 1 {
                        inputs[0].channel(0)
                    } else {
                        inputs[0].channel(channel)
                    };
                    let output = outputs[0].channel_mut(channel);
                    output[..frames].copy_from_slice(&src[..frames]);
                }
            }
        }
        ModuleState::Receive(_state) => {
            // Pass-through: copy stereo input to stereo output
            let input_connected = !connections[0].is_empty();
            if input_connected {
                for channel in 0..2 {
                    let src = if inputs[0].channel_count() == 1 {
                        inputs[0].channel(0)
                    } else {
                        inputs[0].channel(channel)
                    };
                    let output = outputs[0].channel_mut(channel);
                    output[..frames].copy_from_slice(&src[..frames]);
                }
            }
        }
        ModuleState::Notes | ModuleState::Empty => {
            // UI-only module / placeholder, no audio processing
        }
        _ => return false,
    }
    true
}
