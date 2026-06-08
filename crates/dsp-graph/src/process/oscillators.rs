//! Oscillators module processing.
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
    SamplerInputs, SamplerParams,
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
        ModuleState::Vco(state) => {
            let pitch = inputs[0].channel(0);
            let fm_lin = inputs[1].channel(0);
            let fm_exp = inputs[2].channel(0);
            let pwm_in = inputs[3].channel(0);
            let sync = inputs[4].channel(0);
            let fm_audio = inputs[5].channel(0);
            let (main_group, rest) = outputs.split_at_mut(1);
            let out = main_group[0].channel_mut(0);
            let (sub_group, sync_group) = rest.split_at_mut(1);
            let sub_out = sub_group.get_mut(0).map(|buffer| buffer.channel_mut(0));
            let sync_out = sync_group.get_mut(0).map(|buffer| buffer.channel_mut(0));
            let params = VcoParams {
                base_freq: state.base_freq.slice(frames),
                waveform: state.waveform.slice(frames),
                pwm: state.pwm.slice(frames),
                fm_lin_depth: state.fm_lin_depth.slice(frames),
                fm_exp_depth: state.fm_exp_depth.slice(frames),
                unison: state.unison.slice(frames),
                detune: state.detune.slice(frames),
                sub_mix: state.sub_mix.slice(frames),
                sub_oct: state.sub_oct.slice(frames),
            };
            let vco_inputs = VcoInputs {
                pitch: Some(pitch),
                fm_lin: Some(fm_lin),
                fm_audio: Some(fm_audio),
                fm_exp: Some(fm_exp),
                pwm: Some(pwm_in),
                sync: Some(sync),
            };
            state.vco.process_block(out, sub_out, sync_out, vco_inputs, params);
        }
        ModuleState::Noise(state) => {
            let (out_l, out_r) = outputs[0].channels_mut_2();
            let params = NoiseParams {
                level: state.level.slice(frames),
                noise_type: state.noise_type.slice(frames),
                stereo: state.stereo.slice(frames),
                pan: state.pan.slice(frames),
            };
            state.noise.process_block_stereo(out_l, out_r, params);
        }
        ModuleState::Supersaw(state) => {
            let pitch = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let params = SupersawParams {
                base_freq: state.base_freq.slice(frames),
                detune: state.detune.slice(frames),
                mix: state.mix.slice(frames),
            };
            let supersaw_inputs = SupersawInputs { pitch };
            let output = outputs[0].channel_mut(0);
            state.supersaw.process_block(output, supersaw_inputs, params);
        }
        ModuleState::Karplus(state) => {
            let pitch = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let gate = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let params = KarplusParams {
                frequency: state.frequency.slice(frames),
                damping: state.damping.slice(frames),
                decay: state.decay.slice(frames),
                brightness: state.brightness.slice(frames),
                pluck_pos: state.pluck_pos.slice(frames),
            };
            let karplus_inputs = KarplusInputs { pitch, gate };
            let output = outputs[0].channel_mut(0);
            state.karplus.process_block(output, karplus_inputs, params);
        }
        ModuleState::NesOsc(state) => {
            let pitch = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let wave_cv = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let params = NesOscParams {
                base_freq: state.base_freq.slice(frames),
                fine: state.fine.slice(frames),
                volume: state.volume.slice(frames),
                mode: state.mode.slice(frames),
                duty: state.duty.slice(frames),
                noise_mode: state.noise_mode.slice(frames),
                bitcrush: state.bitcrush.slice(frames),
            };
            let nes_inputs = NesOscInputs { pitch, wave_cv };
            let output = outputs[0].channel_mut(0);
            state.nes_osc.process_block(output, nes_inputs, params);
        }
        ModuleState::SnesOsc(state) => {
            let pitch = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let wave_cv = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let params = SnesOscParams {
                base_freq: state.base_freq.slice(frames),
                fine: state.fine.slice(frames),
                volume: state.volume.slice(frames),
                wave: state.wave.slice(frames),
                gauss: state.gauss.slice(frames),
                color: state.color.slice(frames),
                lofi: state.lofi.slice(frames),
            };
            let snes_inputs = SnesOscInputs { pitch, wave_cv };
            let output = outputs[0].channel_mut(0);
            state.snes_osc.process_block(output, snes_inputs, params);
        }
        ModuleState::Tb303(state) => {
            let pitch = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let gate = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let velocity = if connections[2].is_empty() { None } else { Some(inputs[2].channel(0)) };
            let cutoff_cv = if connections[3].is_empty() { None } else { Some(inputs[3].channel(0)) };
            let (audio_group, env_group) = outputs.split_at_mut(1);
            let audio = audio_group[0].channel_mut(0);
            let env_out = env_group[0].channel_mut(0);
            let tb_inputs = Tb303Inputs { pitch, gate, velocity, cutoff_cv };
            let params = Tb303Params {
                waveform: state.waveform.slice(frames),
                cutoff: state.cutoff.slice(frames),
                resonance: state.resonance.slice(frames),
                decay: state.decay.slice(frames),
                envmod: state.envmod.slice(frames),
                accent: state.accent.slice(frames),
                glide: state.glide.slice(frames),
            };
            let tb_outputs = Tb303Outputs { audio, env_out };
            state.tb303.process_block(tb_outputs, tb_inputs, params);
        }
        ModuleState::FmOp(state) => {
            let pitch = if !connections[0].is_empty() { Some(inputs[0].channel(0)) } else { None };
            let gate = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let fm_in = if connections.len() > 2 && !connections[2].is_empty() {
                Some(inputs[2].channel(0))
            } else {
                None
            };

            let fm_inputs = FmOperatorInputs { pitch, gate, fm_in };
            let params = FmOperatorParams {
                frequency: state.frequency.slice(frames),
                ratio: state.ratio.slice(frames),
                level: state.level.slice(frames),
                feedback: state.feedback.slice(frames),
                attack: state.attack.slice(frames),
                decay: state.decay.slice(frames),
                sustain: state.sustain.slice(frames),
                release: state.release.slice(frames),
            };

            let out = outputs[0].channel_mut(0);
            state.op.process_block(out, fm_inputs, params);
        }
        ModuleState::FmMatrix(state) => {
            // 6 inputs: pitch, gate, velocity, fm-in, mod, ratio-cv
            let pitch_cv = if !connections[0].is_empty() { Some(inputs[0].channel(0)) } else { None };
            let gate_cv = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let velocity_cv = if connections.len() > 2 && !connections[2].is_empty() {
                Some(inputs[2].channel(0))
            } else {
                None
            };
            let fm_in = if connections.len() > 3 && !connections[3].is_empty() {
                Some(inputs[3].channel(0))
            } else {
                None
            };
            let _mod_cv = if connections.len() > 4 && !connections[4].is_empty() {
                Some(inputs[4].channel(0))
            } else {
                None
            };
            let _ratio_cv = if connections.len() > 5 && !connections[5].is_empty() {
                Some(inputs[5].channel(0))
            } else {
                None
            };

            // Get param slices
            let algorithm = state.algorithm.slice(frames);
            let feedback = state.feedback.slice(frames);
            let brightness = state.brightness.slice(frames);
            let master = state.master.slice(frames);

            // Operator params
            let op1_ratio = state.op1_ratio.slice(frames);
            let op1_level = state.op1_level.slice(frames);
            let op1_detune = state.op1_detune.slice(frames);
            let op1_attack = state.op1_attack.slice(frames);
            let op1_decay = state.op1_decay.slice(frames);
            let op1_sustain = state.op1_sustain.slice(frames);
            let op1_release = state.op1_release.slice(frames);

            let op2_ratio = state.op2_ratio.slice(frames);
            let op2_level = state.op2_level.slice(frames);
            let op2_detune = state.op2_detune.slice(frames);
            let op2_attack = state.op2_attack.slice(frames);
            let op2_decay = state.op2_decay.slice(frames);
            let op2_sustain = state.op2_sustain.slice(frames);
            let op2_release = state.op2_release.slice(frames);

            let op3_ratio = state.op3_ratio.slice(frames);
            let op3_level = state.op3_level.slice(frames);
            let op3_detune = state.op3_detune.slice(frames);
            let op3_attack = state.op3_attack.slice(frames);
            let op3_decay = state.op3_decay.slice(frames);
            let op3_sustain = state.op3_sustain.slice(frames);
            let op3_release = state.op3_release.slice(frames);

            let op4_ratio = state.op4_ratio.slice(frames);
            let op4_level = state.op4_level.slice(frames);
            let op4_detune = state.op4_detune.slice(frames);
            let op4_attack = state.op4_attack.slice(frames);
            let op4_decay = state.op4_decay.slice(frames);
            let op4_sustain = state.op4_sustain.slice(frames);
            let op4_release = state.op4_release.slice(frames);

            // Split outputs to avoid borrow conflicts
            let (audio_out, mod_outputs) = outputs.split_at_mut(1);
            let audio_buf = &mut audio_out[0];
            let mod_out = mod_outputs[0].channel_mut(0);

            for i in 0..frames {
                // Get pitch from CV (octaves relative to base) - base freq is A3 (220Hz)
                let base_freq = 220.0_f32;
                let pitch_offset = pitch_cv.map(|p| p[i]).unwrap_or(0.0);
                let freq_hz = base_freq * (2.0_f32).powf(pitch_offset);
                let gate = gate_cv.map(|g| g[i]).unwrap_or(0.0);
                let velocity = velocity_cv.map(|v| v[i]).unwrap_or(1.0);
                let fm_ext = fm_in.map(|f| f[i]).unwrap_or(0.0);

                let params = FmMatrixParams {
                    algorithm: algorithm[i] as usize,
                    feedback: feedback[i],
                    brightness: brightness[i],
                    master: master[i],
                    ops: [
                        OpParams {
                            ratio: op1_ratio[i],
                            level: op1_level[i],
                            detune: op1_detune[i],
                            attack_ms: op1_attack[i],
                            decay_ms: op1_decay[i],
                            sustain: op1_sustain[i],
                            release_ms: op1_release[i],
                        },
                        OpParams {
                            ratio: op2_ratio[i],
                            level: op2_level[i],
                            detune: op2_detune[i],
                            attack_ms: op2_attack[i],
                            decay_ms: op2_decay[i],
                            sustain: op2_sustain[i],
                            release_ms: op2_release[i],
                        },
                        OpParams {
                            ratio: op3_ratio[i],
                            level: op3_level[i],
                            detune: op3_detune[i],
                            attack_ms: op3_attack[i],
                            decay_ms: op3_decay[i],
                            sustain: op3_sustain[i],
                            release_ms: op3_release[i],
                        },
                        OpParams {
                            ratio: op4_ratio[i],
                            level: op4_level[i],
                            detune: op4_detune[i],
                            attack_ms: op4_attack[i],
                            decay_ms: op4_decay[i],
                            sustain: op4_sustain[i],
                            release_ms: op4_release[i],
                        },
                    ],
                };

                let sample = state.matrix.process_sample(freq_hz, gate, velocity, fm_ext, &params);
                audio_buf.channel_mut(0)[i] = sample;
                audio_buf.channel_mut(1)[i] = sample;
                mod_out[i] = state.matrix.get_env_level();
            }
        }
        ModuleState::Shepard(state) => {
            let rate_cv = if !connections[0].is_empty() { Some(inputs[0].channel(0)) } else { None };
            let pitch_cv = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let sync = if connections.len() > 2 && !connections[2].is_empty() {
                Some(inputs[2].channel(0))
            } else {
                None
            };

            let shepard_inputs = ShepardInputs { rate_cv, pitch_cv, sync };
            let params = ShepardParams {
                voices: state.voices.slice(frames),
                rate: state.rate.slice(frames),
                base_freq: state.base_freq.slice(frames),
                spread: state.spread.slice(frames),
                mix: state.mix.slice(frames),
                waveform: state.waveform.slice(frames),
                stereo: state.stereo.slice(frames),
                detune: state.detune.slice(frames),
                direction: state.direction.slice(frames),
                risset: state.risset.slice(frames),
                phase_spread: state.phase_spread.slice(frames),
                interval: state.interval.slice(frames),
                tilt: state.tilt.slice(frames),
                feedback: state.feedback.slice(frames),
                vibrato: state.vibrato.slice(frames),
                shimmer: state.shimmer.slice(frames),
            };

            let (left, right) = outputs[0].channels.split_at_mut(1);
            let out_l = &mut left[0];
            let out_r = &mut right[0];
            state.shepard.process_block_stereo(out_l, out_r, shepard_inputs, params);
        }
        ModuleState::PipeOrgan(state) => {
            // Input 0: pitch CV, Input 1: gate
            let pitch_cv = if !connections[0].is_empty() {
                Some(inputs[0].channel(0))
            } else {
                None
            };
            let gate = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };

            let organ_inputs = PipeOrganInputs { pitch: pitch_cv, gate };
            let params = PipeOrganParams {
                frequency: state.frequency.slice(frames),
                drawbar_16: state.drawbar_16.slice(frames),
                drawbar_8: state.drawbar_8.slice(frames),
                drawbar_4: state.drawbar_4.slice(frames),
                drawbar_223: state.drawbar_223.slice(frames),
                drawbar_2: state.drawbar_2.slice(frames),
                drawbar_135: state.drawbar_135.slice(frames),
                drawbar_113: state.drawbar_113.slice(frames),
                drawbar_1: state.drawbar_1.slice(frames),
                voicing: state.voicing.slice(frames),
                chiff: state.chiff.slice(frames),
                percussion: state.percussion.slice(frames),
                perc_harmonic: state.perc_harmonic.slice(frames),
                perc_decay: state.perc_decay.slice(frames),
                perc_volume: state.perc_volume.slice(frames),
                chorus_vibrato: state.chorus_vibrato.slice(frames),
                tremulant: state.tremulant.slice(frames),
                trem_rate: state.trem_rate.slice(frames),
                wind: state.wind.slice(frames),
                brightness: state.brightness.slice(frames),
            };

            let out = outputs[0].channel_mut(0);
            state.organ.process_block(out, organ_inputs, params);
        }
        ModuleState::SpectralSwarm(state) => {
            // Input 0: pitch CV, Input 1: gate, Input 2: sync
            let pitch = if !connections[0].is_empty() {
                Some(inputs[0].channel(0))
            } else {
                None
            };
            let gate = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let sync = if connections.len() > 2 && !connections[2].is_empty() {
                Some(inputs[2].channel(0))
            } else {
                None
            };

            let swarm_inputs = SpectralSwarmInputs { pitch, gate, sync };
            let params = SpectralSwarmParams {
                frequency: state.frequency.slice(frames),
                partials: state.partials.slice(frames),
                detune: state.detune.slice(frames),
                drift: state.drift.slice(frames),
                density: state.density.slice(frames),
                evolution: state.evolution.slice(frames),
                inharmonic: state.inharmonic.slice(frames),
                tilt: state.tilt.slice(frames),
                spread: state.spread.slice(frames),
                shimmer: state.shimmer.slice(frames),
                attack: state.attack.slice(frames),
                release: state.release.slice(frames),
                // New parameters
                waveform: state.waveform.slice(frames),
                odd_even: state.odd_even.slice(frames),
                fundamental_mix: state.fundamental_mix.slice(frames),
                formant_freq: state.formant_freq.slice(frames),
                formant_q: state.formant_q.slice(frames),
                freeze: state.freeze.slice(frames),
                chorus: state.chorus.slice(frames),
                attack_low: state.attack_low.slice(frames),
                attack_high: state.attack_high.slice(frames),
                release_low: state.release_low.slice(frames),
                release_high: state.release_high.slice(frames),
            };

            // Stereo output
            let (out_l, out_r) = outputs[0].channels_mut_2();
            state.swarm.process_block_stereo(out_l, out_r, swarm_inputs, params);
        }
        ModuleState::Resonator(state) => {
            // Input 0: audio in, Input 1: pitch CV, Input 2: gate, Input 3: strum, Input 4: damp
            let audio_in = if !connections[0].is_empty() {
                inputs[0].channel(0)
            } else {
                &ZERO_BUFFER[..frames]
            };
            let pitch_cv = if connections.len() > 1 && !connections[1].is_empty() {
                inputs[1].channel(0)
            } else {
                &ZERO_BUFFER[..frames]
            };
            let gate = if connections.len() > 2 && !connections[2].is_empty() {
                inputs[2].channel(0)
            } else {
                &ZERO_BUFFER[..frames]
            };
            let strum = if connections.len() > 3 && !connections[3].is_empty() {
                inputs[3].channel(0)
            } else {
                &ZERO_BUFFER[..frames]
            };
            let damp = if connections.len() > 4 && !connections[4].is_empty() {
                inputs[4].channel(0)
            } else {
                &ZERO_BUFFER[..frames]
            };

            // Get parameter slices
            let frequency = state.frequency.slice(frames);
            let structure = state.structure.slice(frames);
            let brightness = state.brightness.slice(frames);
            let damping = state.damping.slice(frames);
            let position = state.position.slice(frames);
            let mode = state.mode.slice(frames);
            let polyphony = state.polyphony.slice(frames);
            let internal_exc = state.internal_exc.slice(frames);
            let chorus = state.chorus.slice(frames);

            let out = outputs[0].channel_mut(0);
            for i in 0..frames {
                let params = ResonatorParams {
                    frequency: frequency[i],
                    structure: structure[i],
                    brightness: brightness[i],
                    damping: damping[i],
                    position: position[i],
                    mode: mode[i] as i32,
                    polyphony: polyphony[i] as i32,
                    internal_exc: internal_exc[i],
                    chorus: chorus[i],
                };
                let res_inputs = ResonatorInputs {
                    audio_in: audio_in[i],
                    pitch_cv: pitch_cv[i],
                    gate: gate[i],
                    strum: strum[i],
                    damp: damp[i],
                };
                out[i] = state.resonator.process(params, res_inputs);
            }
        }
        ModuleState::Wavetable(state) => {
            // Input 0: pitch CV, Input 1: gate, Input 2: position CV, Input 3: sync
            let pitch_cv = if !connections[0].is_empty() {
                inputs[0].channel(0)
            } else {
                &ZERO_BUFFER[..frames]
            };
            let gate = if connections.len() > 1 && !connections[1].is_empty() {
                inputs[1].channel(0)
            } else {
                &ZERO_BUFFER[..frames]
            };
            let position_cv = if connections.len() > 2 && !connections[2].is_empty() {
                inputs[2].channel(0)
            } else {
                &ZERO_BUFFER[..frames]
            };
            let sync = if connections.len() > 3 && !connections[3].is_empty() {
                inputs[3].channel(0)
            } else {
                &ZERO_BUFFER[..frames]
            };

            // Get parameter slices
            let frequency = state.frequency.slice(frames);
            let bank = state.bank.slice(frames);
            let position = state.position.slice(frames);
            let unison = state.unison.slice(frames);
            let detune = state.detune.slice(frames);
            let spread = state.spread.slice(frames);
            let morph_speed = state.morph_speed.slice(frames);
            let sub_mix = state.sub_mix.slice(frames);
            let attack = state.attack.slice(frames);
            let release = state.release.slice(frames);

            let out = outputs[0].channel_mut(0);
            for i in 0..frames {
                let params = WavetableParams {
                    frequency: frequency[i],
                    bank: bank[i] as i32,
                    position: position[i],
                    unison: unison[i] as i32,
                    detune: detune[i],
                    spread: spread[i],
                    morph_speed: morph_speed[i],
                    sub_mix: sub_mix[i],
                    attack: attack[i],
                    release: release[i],
                };
                let wt_inputs = WavetableInputs {
                    pitch_cv: pitch_cv[i],
                    gate: gate[i],
                    position_cv: position_cv[i],
                    sync: sync[i],
                };
                out[i] = state.wavetable.process(params, wt_inputs);
            }
        }
        ModuleState::Granular(state) => {
            // Input 0: audio in (for recording), Input 1: trigger, Input 2: position CV, Input 3: pitch CV
            let audio_in = if !connections[0].is_empty() {
                Some(inputs[0].channel(0))
            } else {
                None
            };
            let trigger = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let position_cv = if connections.len() > 2 && !connections[2].is_empty() {
                Some(inputs[2].channel(0))
            } else {
                None
            };
            let pitch_cv = if connections.len() > 3 && !connections[3].is_empty() {
                Some(inputs[3].channel(0))
            } else {
                None
            };

            let granular_inputs = GranularInputs {
                audio_in,
                trigger,
                position_cv,
                pitch_cv,
            };
            let params = GranularParams {
                position: state.position.slice(frames),
                size_ms: state.size.slice(frames),
                density: state.density.slice(frames),
                pitch: state.pitch.slice(frames),
                spray: state.spray.slice(frames),
                scatter: state.scatter.slice(frames),
                pan_spread: state.pan_spread.slice(frames),
                shape: state.shape.slice(frames),
                level: state.level.slice(frames),
            };

            // Stereo output
            let (out_l, out_r) = outputs[0].channels_mut_2();
            state.granular.process_block(out_l, out_r, granular_inputs, params);
        }
        ModuleState::Sampler(state) => {
            // Input 0: trigger, Input 1: pitch CV
            let trigger = if !connections[0].is_empty() { Some(inputs[0].channel(0)) } else { None };
            let pitch_cv = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let sampler_inputs = SamplerInputs { trigger, pitch_cv };
            let params = SamplerParams {
                pitch: state.pitch.slice(frames),
                level: state.level.slice(frames),
                attack: state.attack.slice(frames),
                release: state.release.slice(frames),
                loop_mode: state.loop_mode.slice(frames),
                loop_start: state.loop_start.slice(frames),
                loop_end: state.loop_end.slice(frames),
            };
            let (out_l, out_r) = outputs[0].channels_mut_2();
            state.sampler.process_block(out_l, out_r, sampler_inputs, params);
        }
        ModuleState::ParticleCloud(state) => {
            // Input 0: audio in (for Input mode), Input 1: trigger
            let audio_in = if !connections[0].is_empty() {
                Some(inputs[0].channel(0))
            } else {
                None
            };
            let trigger = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };

            let cloud_inputs = ParticleCloudInputs {
                audio_in,
                trigger,
            };
            let params = ParticleCloudParams {
                count: state.count.slice(frames),
                gravity: state.gravity.slice(frames),
                turbulence: state.turbulence.slice(frames),
                friction: state.friction.slice(frames),
                grain_size: state.grain_size.slice(frames),
                pitch: state.pitch.slice(frames),
                spread: state.spread.slice(frames),
                level: state.level.slice(frames),
                mode: state.mode.slice(frames),
                osc_shape: state.osc_shape.slice(frames),
            };

            // Stereo output
            let (out_l, out_r) = outputs[0].channels_mut_2();
            state.cloud.process_block(out_l, out_r, cloud_inputs, params);
        }
        ModuleState::SpeechSynth(state) => {
            // Input 0: pitch CV, Input 1: gate, Input 2: clock
            let pitch = if !connections[0].is_empty() {
                Some(inputs[0].channel(0))
            } else {
                None
            };
            let gate = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let clock = if connections.len() > 2 && !connections[2].is_empty() {
                Some(inputs[2].channel(0))
            } else {
                None
            };

            let synth_inputs = SpeechSynthInputs { pitch, gate, clock };
            let params = SpeechSynthParams {
                speed: state.speed.slice(frames),
                formant_shift: state.formant_shift.slice(frames),
                smoothing: state.smoothing.slice(frames),
                buzz: state.buzz.slice(frames),
                noise_mix: state.noise_mix.slice(frames),
            };

            let out = outputs[0].channel_mut(0);
            state.synth.process_block(out, synth_inputs, params);
        }
        ModuleState::Theremin(state) => {
            // Inputs: 0 = pitch CV, 1 = volume CV, 2 = gate
            // Outputs: 0 = stereo audio, 1 = pitch CV, 2 = gate, 3 = volume CV
            const TH_BUF: usize = 4096;
            let sf = frames.min(TH_BUF);
            let mut buf_l = [0.0_f32; TH_BUF];
            let mut buf_r = [0.0_f32; TH_BUF];
            let mut buf_pitch = [0.0_f32; TH_BUF];
            let mut buf_gate = [0.0_f32; TH_BUF];
            let mut buf_vol = [0.0_f32; TH_BUF];

            let pitch_in = if !connections[0].is_empty() { Some(inputs[0].channel(0)) } else { None };
            let vol_in = if connections.len() > 1 && !connections[1].is_empty() { Some(inputs[1].channel(0)) } else { None };
            let gate_in = if connections.len() > 2 && !connections[2].is_empty() { Some(inputs[2].channel(0)) } else { None };

            let th_inputs = ThereminInputs { pitch: pitch_in, volume: vol_in, gate: gate_in };
            let params = ThereminParams {
                frequency: state.frequency.slice(frames),
                volume: state.volume.slice(frames),
                touch: state.touch.slice(frames),
                waveform: state.waveform.slice(frames),
                vibrato_rate: state.vibrato_rate.slice(frames),
                vibrato_depth: state.vibrato_depth.slice(frames),
                tremolo_rate: state.tremolo_rate.slice(frames),
                tremolo_depth: state.tremolo_depth.slice(frames),
                tone: state.tone.slice(frames),
                glide: state.glide.slice(frames),
                level: state.level.slice(frames),
                attack: state.attack.slice(frames),
                release: state.release.slice(frames),
                lo_freq: state.lo_freq.slice(frames),
                hi_freq: state.hi_freq.slice(frames),
            };
            let th_outs = ThereminOutputs {
                out_l: &mut buf_l[..sf],
                out_r: &mut buf_r[..sf],
                pitch_cv: &mut buf_pitch[..sf],
                gate_cv: &mut buf_gate[..sf],
                vol_cv: &mut buf_vol[..sf],
            };
            state.theremin.process_block(th_outs, th_inputs, params);

            let (out_l, out_r) = outputs[0].channels_mut_2();
            out_l[..sf].copy_from_slice(&buf_l[..sf]);
            out_r[..sf].copy_from_slice(&buf_r[..sf]);
            outputs[1].channel_mut(0)[..sf].copy_from_slice(&buf_pitch[..sf]);
            outputs[2].channel_mut(0)[..sf].copy_from_slice(&buf_gate[..sf]);
            outputs[3].channel_mut(0)[..sf].copy_from_slice(&buf_vol[..sf]);
        }
        _ => return false,
    }
    true
}
