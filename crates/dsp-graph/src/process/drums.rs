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
    Seq909, Seq909Inputs, Seq909Params, DM_VOICES,
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
        ModuleState::DrumMachine909(state) => {
            const DM_BUF: usize = 1024;
            let safe = frames.min(DM_BUF);
            state.seq.transport_beats = transport.beats;
            state.seq.transport_bps = transport.beats_per_sample;
            let clock = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let reset = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };

            // Run the internal sequencer into flattened scratch [voice*safe + i].
            let mut trig = [0.0f32; DM_VOICES * DM_BUF];
            let mut vel = [0.0f32; DM_VOICES * DM_BUF];
            let mut stepbuf = [0.0f32; DM_BUF];
            {
                let seq_params = Seq909Params {
                    enabled: state.enabled.slice(safe),
                    tempo: &[120.0], // transport-driven; param ignored while transport active
                    rate: state.rate.slice(safe),
                    swing: state.swing.slice(safe),
                    length: state.length.slice(safe),
                    pattern: state.pattern.slice(safe),
                    fill: state.fill.slice(safe),
                };
                state.seq.process_block(
                    &mut trig[..DM_VOICES * safe],
                    &mut vel[..DM_VOICES * safe],
                    &mut stepbuf[..safe],
                    Seq909Inputs { clock, reset },
                    seq_params,
                );
            }

            let mut mix = [0.0f32; DM_BUF];
            let mut vbuf = [0.0f32; DM_BUF];

            // 0 BD
            {
                let lvl = state.bd_level.slice(safe)[0];
                state.bd.process_block(&mut vbuf[..safe],
                    Kick909Inputs { trigger: Some(&trig[0 * safe..1 * safe]), accent: Some(&vel[0 * safe..1 * safe]) },
                    Kick909Params { tune: state.bd_tune.slice(safe), attack: &[0.5], decay: state.bd_decay.slice(safe), drive: &[0.3] });
                let o = outputs[2].channel_mut(0);
                for i in 0..safe { o[i] = vbuf[i]; mix[i] += vbuf[i] * lvl; }
            }
            // 1 SD
            {
                let lvl = state.sd_level.slice(safe)[0];
                state.sd.process_block(&mut vbuf[..safe],
                    Snare909Inputs { trigger: Some(&trig[1 * safe..2 * safe]), accent: Some(&vel[1 * safe..2 * safe]) },
                    Snare909Params { tune: state.sd_tune.slice(safe), tone: &[0.5], snappy: state.sd_snappy.slice(safe), decay: state.sd_decay.slice(safe) });
                let o = outputs[3].channel_mut(0);
                for i in 0..safe { o[i] = vbuf[i]; mix[i] += vbuf[i] * lvl; }
            }
            // 2 LT, 3 MT, 4 HT (Tom909)
            {
                let lvl = state.lt_level.slice(safe)[0];
                state.lt.process_block(&mut vbuf[..safe],
                    Tom909Inputs { trigger: Some(&trig[2 * safe..3 * safe]), accent: Some(&vel[2 * safe..3 * safe]) },
                    Tom909Params { tune: state.lt_tune.slice(safe), decay: state.lt_decay.slice(safe) });
                let o = outputs[4].channel_mut(0);
                for i in 0..safe { o[i] = vbuf[i]; mix[i] += vbuf[i] * lvl; }
            }
            {
                let lvl = state.mt_level.slice(safe)[0];
                state.mt.process_block(&mut vbuf[..safe],
                    Tom909Inputs { trigger: Some(&trig[3 * safe..4 * safe]), accent: Some(&vel[3 * safe..4 * safe]) },
                    Tom909Params { tune: state.mt_tune.slice(safe), decay: state.mt_decay.slice(safe) });
                let o = outputs[5].channel_mut(0);
                for i in 0..safe { o[i] = vbuf[i]; mix[i] += vbuf[i] * lvl; }
            }
            {
                let lvl = state.ht_level.slice(safe)[0];
                state.ht.process_block(&mut vbuf[..safe],
                    Tom909Inputs { trigger: Some(&trig[4 * safe..5 * safe]), accent: Some(&vel[4 * safe..5 * safe]) },
                    Tom909Params { tune: state.ht_tune.slice(safe), decay: state.ht_decay.slice(safe) });
                let o = outputs[6].channel_mut(0);
                for i in 0..safe { o[i] = vbuf[i]; mix[i] += vbuf[i] * lvl; }
            }
            // 5 RS
            {
                let lvl = state.rs_level.slice(safe)[0];
                state.rs.process_block(&mut vbuf[..safe],
                    Rimshot909Inputs { trigger: Some(&trig[5 * safe..6 * safe]), accent: Some(&vel[5 * safe..6 * safe]) },
                    Rimshot909Params { tune: state.rs_tune.slice(safe) });
                let o = outputs[7].channel_mut(0);
                for i in 0..safe { o[i] = vbuf[i]; mix[i] += vbuf[i] * lvl; }
            }
            // 6 CP
            {
                let lvl = state.cp_level.slice(safe)[0];
                state.cp.process_block(&mut vbuf[..safe],
                    Clap909Inputs { trigger: Some(&trig[6 * safe..7 * safe]), accent: Some(&vel[6 * safe..7 * safe]) },
                    Clap909Params { tone: state.cp_tone.slice(safe), decay: state.cp_decay.slice(safe) });
                let o = outputs[8].channel_mut(0);
                for i in 0..safe { o[i] = vbuf[i]; mix[i] += vbuf[i] * lvl; }
            }
            // 7 CH (closed hat)
            {
                let lvl = state.ch_level.slice(safe)[0];
                state.ch.process_block(&mut vbuf[..safe],
                    HiHat909Inputs { trigger: Some(&trig[7 * safe..8 * safe]), accent: Some(&vel[7 * safe..8 * safe]) },
                    HiHat909Params { tune: state.ch_tune.slice(safe), decay: state.ch_decay.slice(safe), tone: &[0.6], open: &[0.0] });
                let o = outputs[9].channel_mut(0);
                for i in 0..safe { o[i] = vbuf[i]; mix[i] += vbuf[i] * lvl; }
            }
            // 8 OH (open hat) — CH chokes OH until OH retriggers
            {
                let lvl = state.oh_level.slice(safe)[0];
                state.oh.process_block(&mut vbuf[..safe],
                    HiHat909Inputs { trigger: Some(&trig[8 * safe..9 * safe]), accent: Some(&vel[8 * safe..9 * safe]) },
                    HiHat909Params { tune: state.oh_tune.slice(safe), decay: state.oh_decay.slice(safe), tone: &[0.65], open: &[1.0] });
                let o = outputs[10].channel_mut(0);
                for i in 0..safe {
                    if trig[8 * safe + i] > 0.5 { state.oh_muted = false; }
                    if trig[7 * safe + i] > 0.5 { state.oh_muted = true; }
                    let s = if state.oh_muted { 0.0 } else { vbuf[i] };
                    o[i] = s;
                    mix[i] += s * lvl;
                }
            }
            // 9 CR (crash)
            {
                let lvl = state.cr_level.slice(safe)[0];
                state.cr.process_block(&mut vbuf[..safe],
                    Crash909Inputs { trigger: Some(&trig[9 * safe..10 * safe]), accent: Some(&vel[9 * safe..10 * safe]) },
                    Crash909Params { tune: state.cr_tune.slice(safe), decay: state.cr_decay.slice(safe), tone: state.cr_tone.slice(safe) });
                let o = outputs[11].channel_mut(0);
                for i in 0..safe { o[i] = vbuf[i]; mix[i] += vbuf[i] * lvl; }
            }
            // 10 RD (ride)
            {
                let lvl = state.rd_level.slice(safe)[0];
                state.rd.process_block(&mut vbuf[..safe],
                    Ride909Inputs { trigger: Some(&trig[10 * safe..11 * safe]), accent: Some(&vel[10 * safe..11 * safe]) },
                    Ride909Params { tune: state.rd_tune.slice(safe), decay: state.rd_decay.slice(safe), bell: state.rd_bell.slice(safe) });
                let o = outputs[12].channel_mut(0);
                for i in 0..safe { o[i] = vbuf[i]; mix[i] += vbuf[i] * lvl; }
            }
            // Mix → L/R (mono dup; pan is v2) + step-out
            {
                let o = outputs[0].channel_mut(0);
                for i in 0..safe { o[i] = (mix[i] * 0.6).clamp(-1.0, 1.0); }
            }
            {
                let o = outputs[1].channel_mut(0);
                for i in 0..safe { o[i] = (mix[i] * 0.6).clamp(-1.0, 1.0); }
            }
            {
                let o = outputs[13].channel_mut(0);
                for i in 0..safe { o[i] = stepbuf[i]; }
            }
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
