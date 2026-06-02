//! Effects module processing.
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
            // Input 1 is Vowel CV
            let vowel_cv = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let params = ChoirParams {
                vowel: state.vowel.slice(frames),
                rate: state.rate.slice(frames),
                depth: state.depth.slice(frames),
                mix: state.mix.slice(frames),
            };
            let choir_inputs = ChoirInputs { input_l, input_r, vowel_cv };
            let (left, right) = outputs[0].channels.split_at_mut(1);
            let out_l = &mut left[0];
            let out_r = &mut right[0];
            state.choir.process_block(out_l, out_r, choir_inputs, params);
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
            // Compute delay time: if tempo sync is on, derive from tempo + rate
            let tempo_sync = state.tempo_sync.slice(frames)[0] >= 0.5;
            let time_ms_buf;
            let time_ms_slice = if tempo_sync {
                let tempo = state.tempo.slice(frames)[0].max(20.0);
                let rate_idx = state.sync_rate.slice(frames)[0] as usize;
                let rate_beats = RATE_DIVISIONS.get(rate_idx).copied().unwrap_or(1.0);
                let synced_ms = (rate_beats * 60.0 / tempo as f64 * 1000.0) as f32;
                time_ms_buf = vec![synced_ms; frames];
                &time_ms_buf[..]
            } else {
                state.time.slice(frames)
            };
            let params = DelayParams {
                time_ms: time_ms_slice,
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
        ModuleState::Compressor(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let sc_connected = connections.len() > 1 && !connections[1].is_empty();
            let sc_l = if sc_connected { Some(inputs[1].channel(0)) } else { None };
            let sc_r = if sc_connected {
                Some(if inputs[1].channel_count() == 1 { inputs[1].channel(0) } else { inputs[1].channel(1) })
            } else {
                None
            };
            let params = CompressorParams {
                threshold: state.threshold.slice(frames),
                ratio: state.ratio.slice(frames),
                attack: state.attack.slice(frames),
                release: state.release.slice(frames),
                makeup: state.makeup.slice(frames),
                mix: state.mix.slice(frames),
            };
            let (out_l, out_r) = outputs[0].channels_mut_2();
            state.compressor.process_block_stereo(out_l, out_r, input_l, input_r, params, sc_l, sc_r);
        }
        ModuleState::BitCrusher(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = BitCrusherParams {
                bits: state.bits.slice(frames),
                downsample: state.downsample.slice(frames),
                mix: state.mix.slice(frames),
            };
            let bc_inputs = BitCrusherInputs { input_l, input_r };
            let (out_l, out_r) = outputs[0].channels_mut_2();
            state.crusher.process_block(out_l, out_r, bc_inputs, params);
        }
        ModuleState::Flanger(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = FlangerParams {
                rate: state.rate.slice(frames),
                depth_ms: state.depth.slice(frames),
                feedback: state.feedback.slice(frames),
                mix: state.mix.slice(frames),
            };
            let fl_inputs = FlangerInputs { input_l, input_r };
            let (out_l, out_r) = outputs[0].channels_mut_2();
            state.flanger.process_block(out_l, out_r, fl_inputs, params);
        }
        ModuleState::FreqShifter(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = FrequencyShifterParams {
                shift: state.shift.slice(frames),
                mix: state.mix.slice(frames),
            };
            let fs_inputs = FrequencyShifterInputs { input_l, input_r };
            let (out_l, out_r) = outputs[0].channels_mut_2();
            state.shifter.process_block(out_l, out_r, fs_inputs, params);
        }
        ModuleState::Eq3(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = Eq3Params {
                low_gain: state.low_gain.slice(frames),
                mid_gain: state.mid_gain.slice(frames),
                high_gain: state.high_gain.slice(frames),
                low_freq: state.low_freq.slice(frames),
                mid_freq: state.mid_freq.slice(frames),
                high_freq: state.high_freq.slice(frames),
                mid_q: state.mid_q.slice(frames),
            };
            let eq_inputs = Eq3Inputs { input_l, input_r };
            let (out_l, out_r) = outputs[0].channels_mut_2();
            state.eq.process_block(out_l, out_r, eq_inputs, params);
        }
        ModuleState::Glitch(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let clock = if connections.len() > 1 && !connections[1].is_empty() {
                Some(inputs[1].channel(0))
            } else {
                None
            };
            let params = GlitchParams {
                probability: state.probability.slice(frames),
                slice_ms: state.slice_ms.slice(frames),
                repeats: state.repeats.slice(frames),
                reverse_chance: state.reverse_chance.slice(frames),
                pitch_range: state.pitch_range.slice(frames),
                mix: state.mix.slice(frames),
            };
            let gl_inputs = GlitchInputs { input_l, input_r, clock };
            let (out_l, out_r) = outputs[0].channels_mut_2();
            state.glitch.process_block(out_l, out_r, gl_inputs, params);
        }
        ModuleState::Leslie(state) => {
            let input_connected = !connections[0].is_empty();
            let input_l = if input_connected { Some(inputs[0].channel(0)) } else { None };
            let input_r = if input_connected {
                Some(if inputs[0].channel_count() == 1 { inputs[0].channel(0) } else { inputs[0].channel(1) })
            } else {
                None
            };
            let params = LeslieParams {
                speed: state.speed.slice(frames),
                brake: state.brake.slice(frames),
                drive: state.drive.slice(frames),
                depth: state.depth.slice(frames),
                horn_drum: state.horn_drum.slice(frames),
                mic_dist: state.mic_dist.slice(frames),
                ramp: state.ramp.slice(frames),
                mix: state.mix.slice(frames),
            };
            let les_inputs = LeslieInputs { input_l, input_r };
            let (out_l, out_r) = outputs[0].channels_mut_2();
            state.leslie.process_block(out_l, out_r, les_inputs, params);
        }
        ModuleState::Wah(state) => {
            let input = if !connections[0].is_empty() {
                Some(inputs[0].channel(0))
            } else {
                None
            };
            let params = WahParams {
                mode: state.mode.slice(frames),
                freq: state.freq.slice(frames),
                range: state.range.slice(frames),
                resonance: state.resonance.slice(frames),
                speed: state.speed.slice(frames),
                sensitivity: state.sensitivity.slice(frames),
                mix: state.mix.slice(frames),
            };
            let out = outputs[0].channel_mut(0);
            state.wah.process_block(out, WahInputs { input }, params);
        }
        ModuleState::TubeAmp(state) => {
            let input = if !connections[0].is_empty() {
                Some(inputs[0].channel(0))
            } else {
                None
            };
            let params = TubeAmpParams {
                gain: state.gain.slice(frames),
                stages: state.stages.slice(frames),
                tone: state.tone.slice(frames),
                bias: state.bias.slice(frames),
                sag: state.sag.slice(frames),
                mix: state.mix.slice(frames),
            };
            let out = outputs[0].channel_mut(0);
            state.tube_amp.process_block(out, TubeAmpInputs { input }, params);
        }
        _ => return false,
    }
    true
}
