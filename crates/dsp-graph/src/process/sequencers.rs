//! Sequencers module processing.
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
    Harmonist, HarmonistInputs, HarmonistParams,
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
        ModuleState::Mario(state) => {
            for channel in 0..MARIO_CHANNELS {
                let cv_value = state.mario.cv(channel);
                let gate_value = state.mario.gate(channel);
                let cv_idx = channel * 2;
                let gate_idx = channel * 2 + 1;
                let (left, right) = outputs.split_at_mut(gate_idx);
                let cv_out = left[cv_idx].channel_mut(0);
                let gate_out = right[0].channel_mut(0);
                for i in 0..frames {
                    cv_out[i] = cv_value;
                    gate_out[i] = gate_value;
                }
            }
        }
        ModuleState::Arpeggiator(state) => {
            state.arp.transport_beats = transport.beats;
            state.arp.transport_bps = transport.beats_per_sample;
            let cv_in = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let gate_in = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let clock = if connections[2].is_empty() { None } else { Some(inputs[2].channel(0)) };
            let (cv_group, rest) = outputs.split_at_mut(1);
            let (gate_group, accent_group) = rest.split_at_mut(1);
            let cv_out = cv_group[0].channel_mut(0);
            let gate_out = gate_group[0].channel_mut(0);
            let accent_out = accent_group[0].channel_mut(0);
            let arp_inputs = ArpeggiatorInputs { cv_in, gate_in, clock };
            let params = ArpeggiatorParams {
                enabled: state.enabled.slice(frames),
                hold: state.hold.slice(frames),
                mode: state.mode.slice(frames),
                octaves: state.octaves.slice(frames),
                rate: state.rate.slice(frames),
                gate: state.gate_len.slice(frames),
                swing: state.swing.slice(frames),
                tempo: state.tempo.slice(frames),
                ratchet: state.ratchet.slice(frames),
                ratchet_decay: state.ratchet_decay.slice(frames),
                probability: state.probability.slice(frames),
                velocity_mode: state.velocity_mode.slice(frames),
                accent_pattern: state.accent_pattern.slice(frames),
                euclid_steps: state.euclid_steps.slice(frames),
                euclid_fill: state.euclid_fill.slice(frames),
                euclid_rotate: state.euclid_rotate.slice(frames),
                euclid_enabled: state.euclid_enabled.slice(frames),
                mutate: state.mutate.slice(frames),
            };
            let arp_outputs = ArpeggiatorOutputs { cv_out, gate_out, accent_out };
            state.arp.process_block(arp_outputs, arp_inputs, params);
        }
        ModuleState::StepSequencer(state) => {
            state.seq.transport_beats = transport.beats;
            state.seq.transport_bps = transport.beats_per_sample;
            let clock = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let reset = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let cv_offset = if connections[2].is_empty() { None } else { Some(inputs[2].channel(0)) };
            let (cv_group, rest) = outputs.split_at_mut(1);
            let (gate_group, rest2) = rest.split_at_mut(1);
            let (vel_group, step_group) = rest2.split_at_mut(1);
            let cv_out = cv_group[0].channel_mut(0);
            let gate_out = gate_group[0].channel_mut(0);
            let velocity_out = vel_group[0].channel_mut(0);
            let step_out = step_group[0].channel_mut(0);
            let seq_inputs = StepSequencerInputs { clock, reset, cv_offset };
            let params = StepSequencerParams {
                enabled: state.enabled.slice(frames),
                tempo: state.tempo.slice(frames),
                rate: state.rate.slice(frames),
                gate_length: state.gate_length.slice(frames),
                swing: state.swing.slice(frames),
                slide_time: state.slide_time.slice(frames),
                length: state.length.slice(frames),
                direction: state.direction.slice(frames),
            };
            let seq_outputs = StepSequencerOutputs { cv_out, gate_out, velocity_out, step_out };
            state.seq.process_block(seq_outputs, seq_inputs, params);
        }
        ModuleState::DrumSequencer(state) => {
            state.seq.transport_beats = transport.beats;
            state.seq.transport_bps = transport.beats_per_sample;
            let clock = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let reset = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };

            const DRUM_BUF_SIZE: usize = 1024;
            let safe_frames = frames.min(DRUM_BUF_SIZE);
            let mut buf_gate_kick: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_gate_snare: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_gate_hhc: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_gate_hho: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_gate_clap: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_gate_tom: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_gate_rim: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_gate_aux: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_acc_kick: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_acc_snare: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_acc_hhc: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_acc_hho: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_acc_clap: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_acc_tom: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_acc_rim: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_acc_aux: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];
            let mut buf_step: [Sample; DRUM_BUF_SIZE] = [0.0; DRUM_BUF_SIZE];

            let seq_inputs = DrumSequencerInputs { clock, reset };
            let seq_params = DrumSequencerParams {
                enabled: state.enabled.slice(safe_frames),
                tempo: state.tempo.slice(safe_frames),
                rate: state.rate.slice(safe_frames),
                gate_length: state.gate_length.slice(safe_frames),
                swing: state.swing.slice(safe_frames),
                length: state.length.slice(safe_frames),
            };
            let seq_outputs = DrumSequencerOutputs {
                gate_kick: &mut buf_gate_kick[..safe_frames],
                gate_snare: &mut buf_gate_snare[..safe_frames],
                gate_hhc: &mut buf_gate_hhc[..safe_frames],
                gate_hho: &mut buf_gate_hho[..safe_frames],
                gate_clap: &mut buf_gate_clap[..safe_frames],
                gate_tom: &mut buf_gate_tom[..safe_frames],
                gate_rim: &mut buf_gate_rim[..safe_frames],
                gate_aux: &mut buf_gate_aux[..safe_frames],
                acc_kick: &mut buf_acc_kick[..safe_frames],
                acc_snare: &mut buf_acc_snare[..safe_frames],
                acc_hhc: &mut buf_acc_hhc[..safe_frames],
                acc_hho: &mut buf_acc_hho[..safe_frames],
                acc_clap: &mut buf_acc_clap[..safe_frames],
                acc_tom: &mut buf_acc_tom[..safe_frames],
                acc_rim: &mut buf_acc_rim[..safe_frames],
                acc_aux: &mut buf_acc_aux[..safe_frames],
                step_out: &mut buf_step[..safe_frames],
            };
            state.seq.process_block(seq_outputs, seq_inputs, seq_params);

            outputs[0].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_kick[..safe_frames]);
            outputs[1].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_snare[..safe_frames]);
            outputs[2].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_hhc[..safe_frames]);
            outputs[3].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_hho[..safe_frames]);
            outputs[4].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_clap[..safe_frames]);
            outputs[5].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_tom[..safe_frames]);
            outputs[6].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_rim[..safe_frames]);
            outputs[7].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_aux[..safe_frames]);
            outputs[8].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_kick[..safe_frames]);
            outputs[9].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_snare[..safe_frames]);
            outputs[10].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_hhc[..safe_frames]);
            outputs[11].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_hho[..safe_frames]);
            outputs[12].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_clap[..safe_frames]);
            outputs[13].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_tom[..safe_frames]);
            outputs[14].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_rim[..safe_frames]);
            outputs[15].channel_mut(0)[..safe_frames].copy_from_slice(&buf_acc_aux[..safe_frames]);
            outputs[16].channel_mut(0)[..safe_frames].copy_from_slice(&buf_step[..safe_frames]);
        }
        ModuleState::MidiFileSequencer(state) => {
            let clock = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let reset = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };

            const MIDI_BUF_SIZE: usize = 1024;
            let safe_frames = frames.min(MIDI_BUF_SIZE);

            // Individual buffers for each track to satisfy borrow checker
            let mut buf_cv_1: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_cv_2: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_cv_3: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_cv_4: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_cv_5: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_cv_6: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_cv_7: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_cv_8: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_gate_1: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_gate_2: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_gate_3: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_gate_4: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_gate_5: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_gate_6: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_gate_7: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_gate_8: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_vel_1: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_vel_2: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_vel_3: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_vel_4: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_vel_5: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_vel_6: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_vel_7: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_vel_8: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];
            let mut buf_tick: [Sample; MIDI_BUF_SIZE] = [0.0; MIDI_BUF_SIZE];

            let seq_inputs = MidiFileSequencerInputs { clock, reset };
            let seq_params = MidiFileSequencerParams {
                enabled: state.enabled.slice(safe_frames),
                tempo: state.tempo.slice(safe_frames),
                gate_length: state.gate_length.slice(safe_frames),
                loop_enabled: state.loop_enabled.slice(safe_frames),
                mute: [
                    state.mute1.slice(safe_frames),
                    state.mute2.slice(safe_frames),
                    state.mute3.slice(safe_frames),
                    state.mute4.slice(safe_frames),
                    state.mute5.slice(safe_frames),
                    state.mute6.slice(safe_frames),
                    state.mute7.slice(safe_frames),
                    state.mute8.slice(safe_frames),
                ],
            };

            let seq_outputs = MidiFileSequencerOutputs {
                cv_1: &mut buf_cv_1[..safe_frames],
                cv_2: &mut buf_cv_2[..safe_frames],
                cv_3: &mut buf_cv_3[..safe_frames],
                cv_4: &mut buf_cv_4[..safe_frames],
                cv_5: &mut buf_cv_5[..safe_frames],
                cv_6: &mut buf_cv_6[..safe_frames],
                cv_7: &mut buf_cv_7[..safe_frames],
                cv_8: &mut buf_cv_8[..safe_frames],
                gate_1: &mut buf_gate_1[..safe_frames],
                gate_2: &mut buf_gate_2[..safe_frames],
                gate_3: &mut buf_gate_3[..safe_frames],
                gate_4: &mut buf_gate_4[..safe_frames],
                gate_5: &mut buf_gate_5[..safe_frames],
                gate_6: &mut buf_gate_6[..safe_frames],
                gate_7: &mut buf_gate_7[..safe_frames],
                gate_8: &mut buf_gate_8[..safe_frames],
                vel_1: &mut buf_vel_1[..safe_frames],
                vel_2: &mut buf_vel_2[..safe_frames],
                vel_3: &mut buf_vel_3[..safe_frames],
                vel_4: &mut buf_vel_4[..safe_frames],
                vel_5: &mut buf_vel_5[..safe_frames],
                vel_6: &mut buf_vel_6[..safe_frames],
                vel_7: &mut buf_vel_7[..safe_frames],
                vel_8: &mut buf_vel_8[..safe_frames],
                tick_out: &mut buf_tick[..safe_frames],
            };

            state.seq.process_block(seq_outputs, seq_inputs, seq_params);

            // Copy to outputs: CV (0-7), Gate (8-15), Velocity (16-23), Tick (24)
            outputs[0].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv_1[..safe_frames]);
            outputs[1].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv_2[..safe_frames]);
            outputs[2].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv_3[..safe_frames]);
            outputs[3].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv_4[..safe_frames]);
            outputs[4].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv_5[..safe_frames]);
            outputs[5].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv_6[..safe_frames]);
            outputs[6].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv_7[..safe_frames]);
            outputs[7].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv_8[..safe_frames]);
            outputs[8].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_1[..safe_frames]);
            outputs[9].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_2[..safe_frames]);
            outputs[10].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_3[..safe_frames]);
            outputs[11].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_4[..safe_frames]);
            outputs[12].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_5[..safe_frames]);
            outputs[13].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_6[..safe_frames]);
            outputs[14].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_7[..safe_frames]);
            outputs[15].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_8[..safe_frames]);
            outputs[16].channel_mut(0)[..safe_frames].copy_from_slice(&buf_vel_1[..safe_frames]);
            outputs[17].channel_mut(0)[..safe_frames].copy_from_slice(&buf_vel_2[..safe_frames]);
            outputs[18].channel_mut(0)[..safe_frames].copy_from_slice(&buf_vel_3[..safe_frames]);
            outputs[19].channel_mut(0)[..safe_frames].copy_from_slice(&buf_vel_4[..safe_frames]);
            outputs[20].channel_mut(0)[..safe_frames].copy_from_slice(&buf_vel_5[..safe_frames]);
            outputs[21].channel_mut(0)[..safe_frames].copy_from_slice(&buf_vel_6[..safe_frames]);
            outputs[22].channel_mut(0)[..safe_frames].copy_from_slice(&buf_vel_7[..safe_frames]);
            outputs[23].channel_mut(0)[..safe_frames].copy_from_slice(&buf_vel_8[..safe_frames]);
            outputs[24].channel_mut(0)[..safe_frames].copy_from_slice(&buf_tick[..safe_frames]);
        }
        ModuleState::Clock(state) => {
            state.clock.transport_beats = transport.beats;
            state.clock.transport_bps = transport.beats_per_sample;
            let start = if !connections[0].is_empty() { Some(inputs[0].channel(0)) } else { None };
            let stop = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let reset_in = if connections.len() > 2 && !connections[2].is_empty() {
                Some(inputs[2].channel(0))
            } else {
                None
            };
            let clock_inputs = MasterClockInputs { start, stop, reset_in };
            let params = MasterClockParams {
                running: state.running.slice(frames),
                tempo: state.tempo.slice(frames),
                rate: state.rate.slice(frames),
                swing: state.swing.slice(frames),
            };

            const CLOCK_BUF_SIZE: usize = 1024;
            let safe_frames = frames.min(CLOCK_BUF_SIZE);
            let mut buf_clock: [Sample; CLOCK_BUF_SIZE] = [0.0; CLOCK_BUF_SIZE];
            let mut buf_reset: [Sample; CLOCK_BUF_SIZE] = [0.0; CLOCK_BUF_SIZE];
            let mut buf_run: [Sample; CLOCK_BUF_SIZE] = [0.0; CLOCK_BUF_SIZE];
            let mut buf_bar: [Sample; CLOCK_BUF_SIZE] = [0.0; CLOCK_BUF_SIZE];

            let clock_outputs = MasterClockOutputs {
                clock: &mut buf_clock[..safe_frames],
                reset: &mut buf_reset[..safe_frames],
                run: &mut buf_run[..safe_frames],
                bar: &mut buf_bar[..safe_frames],
            };
            state.clock.process_block(clock_outputs, clock_inputs, params);

            outputs[0].channel_mut(0)[..safe_frames].copy_from_slice(&buf_clock[..safe_frames]);
            outputs[1].channel_mut(0)[..safe_frames].copy_from_slice(&buf_reset[..safe_frames]);
            outputs[2].channel_mut(0)[..safe_frames].copy_from_slice(&buf_run[..safe_frames]);
            outputs[3].channel_mut(0)[..safe_frames].copy_from_slice(&buf_bar[..safe_frames]);
        }
        ModuleState::Euclidean(state) => {
            state.euclidean.transport_beats = transport.beats;
            state.euclidean.transport_bps = transport.beats_per_sample;
            let clock = if !connections[0].is_empty() { Some(inputs[0].channel(0)) } else { None };
            let reset = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let euc_inputs = EuclideanInputs { clock, reset };
            let params = EuclideanParams {
                enabled: state.enabled.slice(frames),
                tempo: state.tempo.slice(frames),
                rate: state.rate.slice(frames),
                steps: state.steps.slice(frames),
                pulses: state.pulses.slice(frames),
                rotation: state.rotation.slice(frames),
                gate_length: state.gate_length.slice(frames),
                swing: state.swing.slice(frames),
            };

            const EUC_BUF_SIZE: usize = 1024;
            let safe_frames = frames.min(EUC_BUF_SIZE);
            let mut buf_gate: [Sample; EUC_BUF_SIZE] = [0.0; EUC_BUF_SIZE];
            let mut buf_step: [Sample; EUC_BUF_SIZE] = [0.0; EUC_BUF_SIZE];

            state.euclidean.process_block(
                &mut buf_gate[..safe_frames],
                &mut buf_step[..safe_frames],
                euc_inputs,
                params,
            );

            outputs[0].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate[..safe_frames]);
            outputs[1].channel_mut(0)[..safe_frames].copy_from_slice(&buf_step[..safe_frames]);
        }
        ModuleState::TuringMachine(state) => {
            let clock = if !connections[0].is_empty() { Some(inputs[0].channel(0)) } else { None };
            let reset = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };

            let turing_inputs = TuringInputs { clock, reset };
            let params = TuringParams {
                probability: state.probability.slice(frames),
                length: state.length.slice(frames),
                range: state.range.slice(frames),
                scale: state.scale.slice(frames),
                root: state.root.slice(frames),
            };

            let (cv_group, rest) = outputs.split_at_mut(1);
            let (gate_group, pulse_group) = rest.split_at_mut(1);
            let cv_out = cv_group[0].channel_mut(0);
            let gate_out = gate_group[0].channel_mut(0);
            let pulse_out = pulse_group[0].channel_mut(0);

            state.turing.process_block(cv_out, gate_out, pulse_out, turing_inputs, params);
        }
        ModuleState::Harmonist(state) => {
            let clock = if !connections[0].is_empty() { Some(inputs[0].channel(0)) } else { None };
            let reset = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let h_inputs = HarmonistInputs { clock, reset };
            let params = HarmonistParams {
                rate: state.rate.slice(frames),
                restlessness: state.restlessness.slice(frames),
                brightness: state.brightness.slice(frames),
                mod_chance: state.mod_chance.slice(frames),
            };
            let (root_group, rest) = outputs.split_at_mut(1);
            let (scale_group, gate_group) = rest.split_at_mut(1);
            let root_out = root_group[0].channel_mut(0);
            let scale_out = scale_group[0].channel_mut(0);
            let gate_out = gate_group[0].channel_mut(0);
            state.harmonist.process_block(root_out, scale_out, gate_out, h_inputs, params);
        }
        ModuleState::GameOfLife(state) => {
            let clock = if !connections[0].is_empty() { Some(inputs[0].channel(0)) } else { None };
            let reset = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };

            let gol_inputs = GameOfLifeInputs { clock, reset };
            let params = GameOfLifeParams {
                evolve_rate: state.evolve_rate.slice(frames),
                range: state.range.slice(frames),
                scale: state.scale.slice(frames),
                root: state.root.slice(frames),
                wrap: state.wrap.slice(frames),
            };

            let (cv_group, rest) = outputs.split_at_mut(1);
            let (gate_group, rest2) = rest.split_at_mut(1);
            let (pulse_group, density_group) = rest2.split_at_mut(1);
            let cv_out = cv_group[0].channel_mut(0);
            let gate_out = gate_group[0].channel_mut(0);
            let pulse_out = pulse_group[0].channel_mut(0);
            let density_out = density_group[0].channel_mut(0);

            state.gol.process_block(cv_out, gate_out, pulse_out, density_out, gol_inputs, params);
        }
        ModuleState::GravitySequencer(state) => {
            let reset = if !connections[0].is_empty() {
                Some(inputs[0].channel(0))
            } else {
                None
            };

            let gravity_inputs = GravityInputs { reset };
            let params = GravityParams {
                speed: state.speed.slice(frames),
                bodies: state.bodies.slice(frames),
                eccentricity: state.eccentricity.slice(frames),
                spread: state.spread.slice(frames),
                range: state.range.slice(frames),
                scale: state.scale.slice(frames),
                root: state.root.slice(frames),
                chaos: state.chaos.slice(frames),
            };

            let (cv_group, rest) = outputs.split_at_mut(1);
            let (gate_group, rest2) = rest.split_at_mut(1);
            let (pulse_group, rest3) = rest2.split_at_mut(1);
            let (x_group, y_group) = rest3.split_at_mut(1);
            let cv_out = cv_group[0].channel_mut(0);
            let gate_out = gate_group[0].channel_mut(0);
            let pulse_out = pulse_group[0].channel_mut(0);
            let x_out = x_group[0].channel_mut(0);
            let y_out = y_group[0].channel_mut(0);

            state.gravity.process_block(cv_out, gate_out, pulse_out, x_out, y_out, gravity_inputs, params);
        }
        ModuleState::SidPlayer(state) => {
            // Input 0: reset trigger (optional)
            let reset = if !connections[0].is_empty() {
                Some(inputs[0].channel(0))
            } else {
                None
            };

            let sid_inputs = SidPlayerInputs { reset };
            let params = SidPlayerParams {
                playing: state.playing.slice(frames),
                song: state.song.slice(frames),
                chip_model: state.chip_model.slice(frames),
            };

            const SID_BUF_SIZE: usize = 1024;
            let safe_frames = frames.min(SID_BUF_SIZE);

            let mut buf_left: [Sample; SID_BUF_SIZE] = [0.0; SID_BUF_SIZE];
            let mut buf_right: [Sample; SID_BUF_SIZE] = [0.0; SID_BUF_SIZE];
            let mut buf_gate1: [Sample; SID_BUF_SIZE] = [0.0; SID_BUF_SIZE];
            let mut buf_gate2: [Sample; SID_BUF_SIZE] = [0.0; SID_BUF_SIZE];
            let mut buf_gate3: [Sample; SID_BUF_SIZE] = [0.0; SID_BUF_SIZE];
            let mut buf_cv1: [Sample; SID_BUF_SIZE] = [0.0; SID_BUF_SIZE];
            let mut buf_cv2: [Sample; SID_BUF_SIZE] = [0.0; SID_BUF_SIZE];
            let mut buf_cv3: [Sample; SID_BUF_SIZE] = [0.0; SID_BUF_SIZE];
            let mut buf_wf1: [Sample; SID_BUF_SIZE] = [0.0; SID_BUF_SIZE];
            let mut buf_wf2: [Sample; SID_BUF_SIZE] = [0.0; SID_BUF_SIZE];
            let mut buf_wf3: [Sample; SID_BUF_SIZE] = [0.0; SID_BUF_SIZE];

            let sid_outputs = SidPlayerOutputs {
                left: &mut buf_left[..safe_frames],
                right: &mut buf_right[..safe_frames],
                gate1: &mut buf_gate1[..safe_frames],
                gate2: &mut buf_gate2[..safe_frames],
                gate3: &mut buf_gate3[..safe_frames],
                cv1: &mut buf_cv1[..safe_frames],
                cv2: &mut buf_cv2[..safe_frames],
                cv3: &mut buf_cv3[..safe_frames],
                wf1: &mut buf_wf1[..safe_frames],
                wf2: &mut buf_wf2[..safe_frames],
                wf3: &mut buf_wf3[..safe_frames],
            };
            state.sid_player.process_block(sid_outputs, sid_inputs, params);

            // Copy stereo audio output
            let (out_l, out_r) = outputs[0].channels_mut_2();
            out_l[..safe_frames].copy_from_slice(&buf_left[..safe_frames]);
            out_r[..safe_frames].copy_from_slice(&buf_right[..safe_frames]);

            // Copy voice gate/CV outputs
            outputs[1].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate1[..safe_frames]);
            outputs[2].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate2[..safe_frames]);
            outputs[3].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate3[..safe_frames]);
            outputs[4].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv1[..safe_frames]);
            outputs[5].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv2[..safe_frames]);
            outputs[6].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv3[..safe_frames]);

            // Copy voice waveform CV outputs
            outputs[7].channel_mut(0)[..safe_frames].copy_from_slice(&buf_wf1[..safe_frames]);
            outputs[8].channel_mut(0)[..safe_frames].copy_from_slice(&buf_wf2[..safe_frames]);
            outputs[9].channel_mut(0)[..safe_frames].copy_from_slice(&buf_wf3[..safe_frames]);
        }
        ModuleState::AyPlayer(state) => {
            // Input 0: reset trigger (optional)
            let reset = if !connections[0].is_empty() {
                Some(inputs[0].channel(0))
            } else {
                None
            };

            let ay_inputs = AyPlayerInputs { reset };
            let params = AyPlayerParams {
                playing: state.playing.slice(frames),
                loop_enabled: state.loop_enabled.slice(frames),
            };

            const AY_BUF_SIZE: usize = 1024;
            let safe_frames = frames.min(AY_BUF_SIZE);

            let mut buf_left: [Sample; AY_BUF_SIZE] = [0.0; AY_BUF_SIZE];
            let mut buf_right: [Sample; AY_BUF_SIZE] = [0.0; AY_BUF_SIZE];
            let mut buf_cv_a: [Sample; AY_BUF_SIZE] = [0.0; AY_BUF_SIZE];
            let mut buf_cv_b: [Sample; AY_BUF_SIZE] = [0.0; AY_BUF_SIZE];
            let mut buf_cv_c: [Sample; AY_BUF_SIZE] = [0.0; AY_BUF_SIZE];
            let mut buf_gate_a: [Sample; AY_BUF_SIZE] = [0.0; AY_BUF_SIZE];
            let mut buf_gate_b: [Sample; AY_BUF_SIZE] = [0.0; AY_BUF_SIZE];
            let mut buf_gate_c: [Sample; AY_BUF_SIZE] = [0.0; AY_BUF_SIZE];

            let ay_outputs = AyPlayerOutputs {
                out_l: &mut buf_left[..safe_frames],
                out_r: &mut buf_right[..safe_frames],
                cv_a: &mut buf_cv_a[..safe_frames],
                cv_b: &mut buf_cv_b[..safe_frames],
                cv_c: &mut buf_cv_c[..safe_frames],
                gate_a: &mut buf_gate_a[..safe_frames],
                gate_b: &mut buf_gate_b[..safe_frames],
                gate_c: &mut buf_gate_c[..safe_frames],
            };
            state.ay_player.process_block_full(ay_outputs, ay_inputs, params);

            // Copy stereo audio output
            let (out_l, out_r) = outputs[0].channels_mut_2();
            out_l[..safe_frames].copy_from_slice(&buf_left[..safe_frames]);
            out_r[..safe_frames].copy_from_slice(&buf_right[..safe_frames]);

            // Copy voice gate outputs
            outputs[1].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_a[..safe_frames]);
            outputs[2].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_b[..safe_frames]);
            outputs[3].channel_mut(0)[..safe_frames].copy_from_slice(&buf_gate_c[..safe_frames]);

            // Copy voice CV outputs (frequency)
            outputs[4].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv_a[..safe_frames]);
            outputs[5].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv_b[..safe_frames]);
            outputs[6].channel_mut(0)[..safe_frames].copy_from_slice(&buf_cv_c[..safe_frames]);
        }
        ModuleState::ChordSequencer(state) => {
            state.seq.transport_beats = transport.beats;
            state.seq.transport_bps = transport.beats_per_sample;
            let clock = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let reset = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            // 10 outputs: cv1,gate1,cv2,gate2,cv3,gate3,cv4,gate4,step,root_cv
            let (o0, rest) = outputs.split_at_mut(1);
            let (o1, rest) = rest.split_at_mut(1);
            let (o2, rest) = rest.split_at_mut(1);
            let (o3, rest) = rest.split_at_mut(1);
            let (o4, rest) = rest.split_at_mut(1);
            let (o5, rest) = rest.split_at_mut(1);
            let (o6, rest) = rest.split_at_mut(1);
            let (o7, rest) = rest.split_at_mut(1);
            let (o8, o9) = rest.split_at_mut(1);
            let seq_inputs = ChordSequencerInputs { clock, reset };
            let params = ChordSequencerParams {
                enabled: state.enabled.slice(frames),
                tempo: state.tempo.slice(frames),
                rate: state.rate.slice(frames),
                gate_length: state.gate_length.slice(frames),
                swing: state.swing.slice(frames),
                length: state.length.slice(frames),
                strum_speed: state.strum_speed.slice(frames),
                strum_direction: state.strum_direction.slice(frames),
                voicing: state.voicing.slice(frames),
            };
            let seq_outputs = ChordSequencerOutputs {
                cv_1: o0[0].channel_mut(0),
                gate_1: o1[0].channel_mut(0),
                cv_2: o2[0].channel_mut(0),
                gate_2: o3[0].channel_mut(0),
                cv_3: o4[0].channel_mut(0),
                gate_3: o5[0].channel_mut(0),
                cv_4: o6[0].channel_mut(0),
                gate_4: o7[0].channel_mut(0),
                step_out: o8[0].channel_mut(0),
                root_cv: o9[0].channel_mut(0),
            };
            state.seq.process_block(seq_outputs, seq_inputs, params);
        }
        ModuleState::PolyrhythmSequencer(state) => {
            state.seq.transport_beats = transport.beats;
            state.seq.transport_bps = transport.beats_per_sample;
            let clock = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let reset = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            // 9 outputs: cv1,gate1,cv2,gate2,cv3,gate3,cv4,gate4,step
            let (o0, rest) = outputs.split_at_mut(1);
            let (o1, rest) = rest.split_at_mut(1);
            let (o2, rest) = rest.split_at_mut(1);
            let (o3, rest) = rest.split_at_mut(1);
            let (o4, rest) = rest.split_at_mut(1);
            let (o5, rest) = rest.split_at_mut(1);
            let (o6, rest) = rest.split_at_mut(1);
            let (o7, o8) = rest.split_at_mut(1);
            let poly_inputs = PolyrhythmInputs { clock, reset };
            let params = PolyrhythmParams {
                enabled: state.enabled.slice(frames),
                tempo: state.tempo.slice(frames),
                rate: state.rate.slice(frames),
                gate_length: state.gate_length.slice(frames),
                swing: state.swing.slice(frames),
                track1_length: state.track1_length.slice(frames),
                track2_length: state.track2_length.slice(frames),
                track3_length: state.track3_length.slice(frames),
                track4_length: state.track4_length.slice(frames),
                track1_mute: state.track1_mute.slice(frames),
                track2_mute: state.track2_mute.slice(frames),
                track3_mute: state.track3_mute.slice(frames),
                track4_mute: state.track4_mute.slice(frames),
            };
            let poly_outputs = PolyrhythmOutputs {
                cv_1: o0[0].channel_mut(0),
                gate_1: o1[0].channel_mut(0),
                cv_2: o2[0].channel_mut(0),
                gate_2: o3[0].channel_mut(0),
                cv_3: o4[0].channel_mut(0),
                gate_3: o5[0].channel_mut(0),
                cv_4: o6[0].channel_mut(0),
                gate_4: o7[0].channel_mut(0),
                step_out: o8[0].channel_mut(0),
            };
            state.seq.process_block(poly_outputs, poly_inputs, params);
        }
        ModuleState::ClockDivider(state) => {
            let clock = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let reset = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            // 4 outputs: div-2, div-4, div-8, div-16
            let (o0, rest) = outputs.split_at_mut(1);
            let (o1, rest) = rest.split_at_mut(1);
            let (o2, o3) = rest.split_at_mut(1);
            let div_inputs = ClockDividerInputs { clock, reset };
            let div_outputs = ClockDividerOutputs {
                div2: o0[0].channel_mut(0),
                div4: o1[0].channel_mut(0),
                div8: o2[0].channel_mut(0),
                div16: o3[0].channel_mut(0),
            };
            state.divider.process_block(div_outputs, div_inputs);
        }
        _ => return false,
    }
    true
}
