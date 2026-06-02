//! Modulators module processing.
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
        ModuleState::ModRouter(state) => {
            let input = if connections[0].is_empty() {
                None
            } else {
                Some(inputs[0].channel(0))
            };
            let (pitch_group, rest) = outputs.split_at_mut(1);
            let (pwm_group, rest) = rest.split_at_mut(1);
            let (vcf_group, vca_group) = rest.split_at_mut(1);
            let out_pitch = pitch_group[0].channel_mut(0);
            let out_pwm = pwm_group[0].channel_mut(0);
            let out_vcf = vcf_group[0].channel_mut(0);
            let out_vca = vca_group[0].channel_mut(0);
            let depth_pitch = state.depth_pitch.slice(frames);
            let depth_pwm = state.depth_pwm.slice(frames);
            let depth_vcf = state.depth_vcf.slice(frames);
            let depth_vca = state.depth_vca.slice(frames);
            for i in 0..frames {
                let source = match input {
                    Some(values) => {
                        if values.len() > 1 {
                            values[i]
                        } else {
                            values[0]
                        }
                    }
                    None => 0.0,
                };
                out_pitch[i] = source * depth_pitch[i];
                out_pwm[i] = source * depth_pwm[i];
                out_vcf[i] = source * depth_vcf[i];
                out_vca[i] = source * depth_vca[i];
            }
        }
        ModuleState::SampleHold(state) => {
            let input = if connections[0].is_empty() {
                None
            } else {
                Some(inputs[0].channel(0))
            };
            let trigger = if connections[1].is_empty() {
                None
            } else {
                Some(inputs[1].channel(0))
            };
            let params = SampleHoldParams {
                mode: state.mode.slice(frames),
            };
            let sh_inputs = SampleHoldInputs { input, trigger };
            let output = outputs[0].channel_mut(0);
            state.sample_hold.process_block(output, sh_inputs, params);
        }
        ModuleState::Slew(state) => {
            let input = if connections[0].is_empty() {
                None
            } else {
                Some(inputs[0].channel(0))
            };
            let params = SlewParams {
                rise: state.rise.slice(frames),
                fall: state.fall.slice(frames),
            };
            let slew_inputs = SlewInputs { input };
            let output = outputs[0].channel_mut(0);
            state.slew.process_block(output, slew_inputs, params);
        }
        ModuleState::EnvelopeFollower(state) => {
            let input = if connections[0].is_empty() {
                None
            } else {
                Some(inputs[0].channel(0))
            };
            let params = EnvelopeFollowerParams {
                attack: state.attack.slice(frames),
                release: state.release.slice(frames),
                gain: state.gain.slice(frames),
            };
            let ef_inputs = EnvelopeFollowerInputs { input };
            let output = outputs[0].channel_mut(0);
            state.envelope_follower.process_block(output, ef_inputs, params);
        }
        ModuleState::Quantizer(state) => {
            let input = if connections[0].is_empty() {
                None
            } else {
                Some(inputs[0].channel(0))
            };
            let params = QuantizerParams {
                root: state.root.slice(frames),
                scale: state.scale.slice(frames),
            };
            let q_inputs = QuantizerInputs { input };
            let output = outputs[0].channel_mut(0);
            Quantizer::process_block(output, q_inputs, params);
        }
        ModuleState::Chaos(state) => {
            let speed = if !connections[0].is_empty() {
                Some(inputs[0].channel(0))
            } else {
                None
            };
            let params = ChaosParams {
                speed: state.speed.slice(frames),
                rho: state.rho.slice(frames),
                sigma: state.sigma.slice(frames),
                beta: state.beta.slice(frames),
                scale: state.scale.slice(frames),
                root: state.root.slice(frames),
            };
            let chaos_inputs = ChaosInputs { speed };
            
            // X, Y, Z, Gate outputs
            let (x_group, rest) = outputs.split_at_mut(1);
            let (y_group, rest2) = rest.split_at_mut(1);
            let (z_group, gate_group) = rest2.split_at_mut(1);
            
            let out_x = x_group[0].channel_mut(0);
            let out_y = y_group[0].channel_mut(0);
            let out_z = z_group[0].channel_mut(0);
            let out_gate = gate_group[0].channel_mut(0);
            
            state.chaos.process_block(out_x, out_y, out_z, out_gate, chaos_inputs, params);
        }
        ModuleState::Lfo(state) => {
            let rate_cv = if connections[0].is_empty() {
                None
            } else {
                Some(inputs[0].channel(0))
            };
            let sync = if connections[1].is_empty() {
                None
            } else {
                Some(inputs[1].channel(0))
            };
            let depth_cv = if connections.len() > 2 && !connections[2].is_empty() {
                Some(inputs[2].channel(0))
            } else {
                None
            };
            let params = LfoParams {
                rate: state.rate.slice(frames),
                shape: state.shape.slice(frames),
                depth: state.depth.slice(frames),
                offset: state.offset.slice(frames),
                bipolar: state.bipolar.slice(frames),
            };
            let lfo_inputs = LfoInputs { rate_cv, sync, depth_cv };
            let output = outputs[0].channel_mut(0);
            state.lfo.process_block(output, lfo_inputs, params);
        }
        ModuleState::Adsr(state) => {
            let gate = if connections[0].is_empty() {
                None
            } else {
                Some(inputs[0].channel(0))
            };
            let params = AdsrParams {
                attack: state.attack.slice(frames),
                decay: state.decay.slice(frames),
                sustain: state.sustain.slice(frames),
                release: state.release.slice(frames),
            };
            let adsr_inputs = AdsrInputs { gate };
            let output = outputs[0].channel_mut(0);
            state.adsr.process_block(output, adsr_inputs, params);
        }
        _ => return false,
    }
    true
}
