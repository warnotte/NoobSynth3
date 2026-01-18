//! Module processing logic for all DSP module types.
//!
//! This module contains the main processing function that dispatches
//! to the appropriate DSP implementation based on module state.

use dsp_core::{
    AdsrInputs, AdsrParams, ArpeggiatorInputs, ArpeggiatorOutputs, ArpeggiatorParams,
    ChoirInputs, ChoirParams, ChorusInputs, ChorusParams, Clap909Inputs, Clap909Params,
    DelayInputs, DelayParams, Distortion, DistortionParams,
    DrumSequencerInputs, DrumSequencerOutputs, DrumSequencerParams,
    EnsembleInputs, EnsembleParams, EuclideanInputs, EuclideanParams,
    FmOperatorInputs, FmOperatorParams,
    GranularDelayInputs, GranularDelayParams,
    HiHat909Inputs, HiHat909Params, HpfInputs, HpfParams,
    KarplusInputs, KarplusParams, Kick909Inputs, Kick909Params,
    LfoInputs, LfoParams,
    MasterClockInputs, MasterClockOutputs, MasterClockParams,
    MidiFileSequencerInputs, MidiFileSequencerOutputs, MidiFileSequencerParams,
    Mixer, NesOscInputs, NesOscParams, NoiseParams,
    PhaserInputs, PhaserParams, PipeOrganInputs, PipeOrganParams, PitchShifterInputs, PitchShifterParams,
    Quantizer, QuantizerInputs, QuantizerParams,
    ResonatorInputs, ResonatorParams,
    ReverbInputs, ReverbParams, RingMod, RingModParams,
    Rimshot909Inputs, Rimshot909Params, Sample,
    SampleHoldInputs, SampleHoldParams, ShepardInputs, ShepardParams, SlewInputs, SlewParams,
    Snare909Inputs, Snare909Params, SnesOscInputs, SnesOscParams, SpectralSwarmInputs, SpectralSwarmParams,
    SpringReverbInputs, SpringReverbParams,
    StepSequencerInputs, StepSequencerOutputs, StepSequencerParams,
    SupersawInputs, SupersawParams,
    TapeDelayInputs, TapeDelayParams,
    Tb303Inputs, Tb303Outputs, Tb303Params,
    Tom909Inputs, Tom909Params,
    Vca, VcfInputs, VcfParams, VcoInputs, VcoParams,
    VocoderInputs, VocoderParams, Wavefolder, WavefolderParams,
    WavetableInputs, WavetableParams,
    MARIO_CHANNELS,
};

use crate::buffer::{mix_buffers, Buffer};
use crate::state::*;
use crate::types::ConnectionEdge;

/// Process a module's audio given its state and connections.
///
/// This function dispatches to the appropriate DSP processing based on the module state.
pub(crate) fn process_module(
    state: &mut ModuleState,
    connections: &[Vec<ConnectionEdge>],
    inputs: &[Buffer],
    outputs: &mut [Buffer],
    frames: usize,
) {
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
            let out = outputs[0].channel_mut(0);
            let params = NoiseParams {
                level: state.level.slice(frames),
                noise_type: state.noise_type.slice(frames),
            };
            state.noise.process_block(out, params);
        }
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
            let params = LfoParams {
                rate: state.rate.slice(frames),
                shape: state.shape.slice(frames),
                depth: state.depth.slice(frames),
                offset: state.offset.slice(frames),
                bipolar: state.bipolar.slice(frames),
            };
            let lfo_inputs = LfoInputs { rate_cv, sync };
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
        ModuleState::Mixer(state) => {
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
            Mixer::process_block(
                output,
                input_a,
                input_b,
                state.level_a.slice(frames),
                state.level_b.slice(frames),
            );
        }
        ModuleState::MixerWide(state) => {
            let input_a = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let input_b = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let input_c = if connections[2].is_empty() { None } else { Some(inputs[2].channel(0)) };
            let input_d = if connections[3].is_empty() { None } else { Some(inputs[3].channel(0)) };
            let input_e = if connections[4].is_empty() { None } else { Some(inputs[4].channel(0)) };
            let input_f = if connections[5].is_empty() { None } else { Some(inputs[5].channel(0)) };
            let output = outputs[0].channel_mut(0);
            let mixer_inputs = [input_a, input_b, input_c, input_d, input_e, input_f];
            let levels = [
                state.level_a.slice(frames),
                state.level_b.slice(frames),
                state.level_c.slice(frames),
                state.level_d.slice(frames),
                state.level_e.slice(frames),
                state.level_f.slice(frames),
            ];
            Mixer::process_block_multi(output, &mixer_inputs, &levels);
        }
        ModuleState::Chorus(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = ChorusParams {
                rate: state.rate.slice(frames),
                depth_ms: state.depth.slice(frames),
                delay_ms: state.delay.slice(frames),
                mix: state.mix.slice(frames),
                feedback: state.feedback.slice(frames),
                spread: state.spread.slice(frames),
            };
            let chorus_inputs = ChorusInputs { input_l, input_r };
            let (left, right) = outputs[0].channels.split_at_mut(1);
            let out_l = &mut left[0];
            let out_r = &mut right[0];
            state.chorus.process_block(out_l, out_r, chorus_inputs, params);
        }
        ModuleState::Ensemble(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = EnsembleParams {
                rate: state.rate.slice(frames),
                depth_ms: state.depth.slice(frames),
                delay_ms: state.delay.slice(frames),
                mix: state.mix.slice(frames),
                spread: state.spread.slice(frames),
            };
            let ensemble_inputs = EnsembleInputs { input_l, input_r };
            let (left, right) = outputs[0].channels.split_at_mut(1);
            let out_l = &mut left[0];
            let out_r = &mut right[0];
            state.ensemble.process_block(out_l, out_r, ensemble_inputs, params);
        }
        ModuleState::Choir(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = ChoirParams {
                vowel: state.vowel.slice(frames),
                rate: state.rate.slice(frames),
                depth: state.depth.slice(frames),
                mix: state.mix.slice(frames),
            };
            let choir_inputs = ChoirInputs { input_l, input_r };
            let (left, right) = outputs[0].channels.split_at_mut(1);
            let out_l = &mut left[0];
            let out_r = &mut right[0];
            state.choir.process_block(out_l, out_r, choir_inputs, params);
        }
        ModuleState::AudioIn(_) => {
            // Handled in GraphEngine::render via external input injection.
        }
        ModuleState::Vocoder(state) => {
            let mod_input = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let car_input = if connections[1].is_empty() { None } else { Some(inputs[1].channel(0)) };
            let params = VocoderParams {
                attack: state.attack.slice(frames),
                release: state.release.slice(frames),
                low: state.low.slice(frames),
                high: state.high.slice(frames),
                q: state.q.slice(frames),
                formant: state.formant.slice(frames),
                emphasis: state.emphasis.slice(frames),
                unvoiced: state.unvoiced.slice(frames),
                mix: state.mix.slice(frames),
                mod_gain: state.mod_gain.slice(frames),
                car_gain: state.car_gain.slice(frames),
            };
            let vocoder_inputs = VocoderInputs { modulator: mod_input, carrier: car_input };
            let output = outputs[0].channel_mut(0);
            state.vocoder.process_block(output, vocoder_inputs, params);
        }
        ModuleState::Delay(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = DelayParams {
                time_ms: state.time.slice(frames),
                feedback: state.feedback.slice(frames),
                mix: state.mix.slice(frames),
                tone: state.tone.slice(frames),
                ping_pong: state.ping_pong.slice(frames),
            };
            let delay_inputs = DelayInputs { input_l, input_r };
            let (left, right) = outputs[0].channels.split_at_mut(1);
            let out_l = &mut left[0];
            let out_r = &mut right[0];
            state.delay.process_block(out_l, out_r, delay_inputs, params);
        }
        ModuleState::GranularDelay(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = GranularDelayParams {
                time_ms: state.time.slice(frames),
                size_ms: state.size.slice(frames),
                density: state.density.slice(frames),
                pitch: state.pitch.slice(frames),
                feedback: state.feedback.slice(frames),
                mix: state.mix.slice(frames),
            };
            let granular_inputs = GranularDelayInputs { input_l, input_r };
            let (left, right) = outputs[0].channels.split_at_mut(1);
            let out_l = &mut left[0];
            let out_r = &mut right[0];
            state.delay.process_block(out_l, out_r, granular_inputs, params);
        }
        ModuleState::TapeDelay(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = TapeDelayParams {
                time_ms: state.time.slice(frames),
                feedback: state.feedback.slice(frames),
                mix: state.mix.slice(frames),
                tone: state.tone.slice(frames),
                wow: state.wow.slice(frames),
                flutter: state.flutter.slice(frames),
                drive: state.drive.slice(frames),
            };
            let tape_inputs = TapeDelayInputs { input_l, input_r };
            let (left, right) = outputs[0].channels.split_at_mut(1);
            let out_l = &mut left[0];
            let out_r = &mut right[0];
            state.delay.process_block(out_l, out_r, tape_inputs, params);
        }
        ModuleState::SpringReverb(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = SpringReverbParams {
                decay: state.decay.slice(frames),
                tone: state.tone.slice(frames),
                mix: state.mix.slice(frames),
                drive: state.drive.slice(frames),
            };
            let spring_inputs = SpringReverbInputs { input_l, input_r };
            let (left, right) = outputs[0].channels.split_at_mut(1);
            let out_l = &mut left[0];
            let out_r = &mut right[0];
            state.reverb.process_block(out_l, out_r, spring_inputs, params);
        }
        ModuleState::Reverb(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = ReverbParams {
                time: state.time.slice(frames),
                damp: state.damp.slice(frames),
                pre_delay: state.pre_delay.slice(frames),
                mix: state.mix.slice(frames),
            };
            let reverb_inputs = ReverbInputs { input_l, input_r };
            let (left, right) = outputs[0].channels.split_at_mut(1);
            let out_l = &mut left[0];
            let out_r = &mut right[0];
            state.reverb.process_block(out_l, out_r, reverb_inputs, params);
        }
        ModuleState::Phaser(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = PhaserParams {
                rate: state.rate.slice(frames),
                depth: state.depth.slice(frames),
                feedback: state.feedback.slice(frames),
                mix: state.mix.slice(frames),
            };
            let phaser_inputs = PhaserInputs { input_l, input_r };
            let (left, right) = outputs[0].channels.split_at_mut(1);
            let out_l = &mut left[0];
            let out_r = &mut right[0];
            state.phaser.process_block(out_l, out_r, phaser_inputs, params);
        }
        ModuleState::Distortion(state) => {
            let input_connected = !connections[0].is_empty();
            let input = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let params = DistortionParams {
                drive: state.drive.slice(frames),
                tone: state.tone.slice(frames),
                mix: state.mix.slice(frames),
                mode: state.mode.slice(frames),
            };
            let output = outputs[0].channel_mut(0);
            Distortion::process_block(output, input, params);
        }
        ModuleState::Wavefolder(state) => {
            let input_connected = !connections[0].is_empty();
            let input = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let params = WavefolderParams {
                drive: state.drive.slice(frames),
                fold: state.fold.slice(frames),
                bias: state.bias.slice(frames),
                mix: state.mix.slice(frames),
            };
            let output = outputs[0].channel_mut(0);
            Wavefolder::process_block(output, input, params);
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
            let params = NesOscParams {
                base_freq: state.base_freq.slice(frames),
                fine: state.fine.slice(frames),
                volume: state.volume.slice(frames),
                mode: state.mode.slice(frames),
                duty: state.duty.slice(frames),
                noise_mode: state.noise_mode.slice(frames),
                bitcrush: state.bitcrush.slice(frames),
            };
            let nes_inputs = NesOscInputs { pitch };
            let output = outputs[0].channel_mut(0);
            state.nes_osc.process_block(output, nes_inputs, params);
        }
        ModuleState::SnesOsc(state) => {
            let pitch = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let params = SnesOscParams {
                base_freq: state.base_freq.slice(frames),
                fine: state.fine.slice(frames),
                volume: state.volume.slice(frames),
                wave: state.wave.slice(frames),
                gauss: state.gauss.slice(frames),
                color: state.color.slice(frames),
                lofi: state.lofi.slice(frames),
            };
            let snes_inputs = SnesOscInputs { pitch };
            let output = outputs[0].channel_mut(0);
            state.snes_osc.process_block(output, snes_inputs, params);
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
        ModuleState::DrumSequencer(state) => {
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
        ModuleState::PitchShifter(state) => {
            let input = if connections[0].is_empty() { None } else { Some(inputs[0].channel(0)) };
            let pitch_cv = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let params = PitchShifterParams {
                pitch: state.pitch.slice(frames),
                fine: state.fine.slice(frames),
                grain_ms: state.grain.slice(frames),
                mix: state.mix.slice(frames),
            };
            let shifter_inputs = PitchShifterInputs { input, pitch_cv };
            state.shifter.process_block(outputs[0].channel_mut(0), shifter_inputs, params);
        }
        ModuleState::Clock(state) => {
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
                &[0.0; 128][..frames]
            };
            let pitch_cv = if connections.len() > 1 && !connections[1].is_empty() {
                inputs[1].channel(0)
            } else {
                &[0.0; 128][..frames]
            };
            let gate = if connections.len() > 2 && !connections[2].is_empty() {
                inputs[2].channel(0)
            } else {
                &[0.0; 128][..frames]
            };
            let strum = if connections.len() > 3 && !connections[3].is_empty() {
                inputs[3].channel(0)
            } else {
                &[0.0; 128][..frames]
            };
            let damp = if connections.len() > 4 && !connections[4].is_empty() {
                inputs[4].channel(0)
            } else {
                &[0.0; 128][..frames]
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
                &[0.0; 128][..frames]
            };
            let gate = if connections.len() > 1 && !connections[1].is_empty() {
                inputs[1].channel(0)
            } else {
                &[0.0; 128][..frames]
            };
            let position_cv = if connections.len() > 2 && !connections[2].is_empty() {
                inputs[2].channel(0)
            } else {
                &[0.0; 128][..frames]
            };
            let sync = if connections.len() > 3 && !connections[3].is_empty() {
                inputs[3].channel(0)
            } else {
                &[0.0; 128][..frames]
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
        ModuleState::Notes => {
            // UI-only module, no audio processing
        }
    }
}
