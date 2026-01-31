// =============================================================================
// DSP Core Library
// =============================================================================
//
// This crate provides digital signal processing modules for audio synthesis.
// All modules are designed to be sample-rate agnostic and work across
// Web (WASM), Standalone (Tauri), and Plugin (VST/CLAP) targets.
//
// ## Module Organization
//
// - `common` - Shared types (Sample, ProcessContext) and utilities
// - `oscillators` - Vco, Supersaw, Karplus, NesOsc, SnesOsc, Tb303, FmOperator
// - `filters` - Vcf (SVF/Ladder)
// - `effects` - Delay, Reverb, Chorus, Ensemble, Phaser, Distortion, etc.
// - `modulators` - Lfo, Adsr, SampleHold, SlewLimiter, Quantizer
// - `sequencers` - StepSequencer, DrumSequencer, Arpeggiator, Euclidean, Clock
// - `drums` - TR-909 emulations (Kick, Snare, HiHat, Clap, Tom, Rimshot)

pub mod common;
pub mod oscillators;
pub mod filters;
pub mod effects;
pub mod modulators;
pub mod sequencers;
pub mod drums;
pub mod chips;

// Re-export common types at crate root for convenience
pub use common::{
    clamp, input_at, midi_to_freq, poly_blep, sample_at, saturate, freq_to_midi,
    Node, ProcessContext, Sample,
    A4_FREQ, A4_MIDI, SEMITONES_PER_OCTAVE,
};

// Re-export oscillators
pub use oscillators::{
    Vco, VcoParams, VcoInputs,
    Supersaw, SupersawParams, SupersawInputs,
    Noise, NoiseParams,
    SineOsc,
    NesOsc, NesOscParams, NesOscInputs,
    SnesOsc, SnesOscParams, SnesOscInputs,
    Tb303, Tb303Params, Tb303Inputs, Tb303Outputs,
    KarplusStrong, KarplusParams, KarplusInputs,
    FmOperator, FmOperatorParams, FmOperatorInputs,
    FmMatrix, FmMatrixParams, OpParams,
    Shepard, ShepardParams, ShepardInputs,
    PipeOrgan, PipeOrganParams, PipeOrganInputs, OrganVoicing, ORGAN_DRAWBARS, DRAWBAR_NAMES,
    SpectralSwarm, SpectralSwarmParams, SpectralSwarmInputs,
    Resonator, ResonatorParams, ResonatorInputs,
    Wavetable, WavetableParams, WavetableInputs,
    Granular, GranularParams, GranularInputs, GrainShape,
    ParticleCloud, ParticleCloudParams, ParticleCloudInputs, ParticleMode, OscShape,
};

// Re-export filters
pub use filters::{
    Vcf, VcfParams, VcfInputs,
    SvfState, LadderState,
    Hpf, HpfParams, HpfInputs,
};

// Re-export effects
pub use effects::{
    Delay, DelayParams, DelayInputs,
    TapeDelay, TapeDelayParams, TapeDelayInputs,
    GranularDelay, GranularDelayParams, GranularDelayInputs,
    Chorus, ChorusParams, ChorusInputs,
    Ensemble, EnsembleParams, EnsembleInputs,
    SpringReverb, SpringReverbParams, SpringReverbInputs,
    Reverb, ReverbParams, ReverbInputs,
    CombFilter, AllpassFilter,
    Phaser, PhaserParams, PhaserInputs,
    Distortion, DistortionParams,
    Wavefolder, WavefolderParams,
    RingMod, RingModParams,
    Choir, ChoirParams, ChoirInputs, FormantFilter,
    Vocoder, VocoderParams, VocoderInputs,
    PitchShifter, PitchShifterParams, PitchShifterInputs,
    Compressor, CompressorParams,
};

// Re-export modulators
pub use modulators::{
    Lfo, LfoParams, LfoInputs,
    Adsr, AdsrParams, AdsrInputs,
    SampleHold, SampleHoldParams, SampleHoldInputs,
    SlewLimiter, SlewParams, SlewInputs,
    Quantizer, QuantizerParams, QuantizerInputs,
    Chaos, ChaosParams, ChaosInputs,
};

// Re-export sequencers
pub use sequencers::{
    MasterClock, MasterClockParams, MasterClockInputs, MasterClockOutputs,
    Arpeggiator, ArpeggiatorParams, ArpeggiatorInputs, ArpeggiatorOutputs,
    ArpMode, RATE_DIVISIONS,
    StepSequencer, StepSequencerParams, StepSequencerInputs, StepSequencerOutputs,
    SeqStep,
    DrumSequencer, DrumSequencerParams, DrumSequencerInputs, DrumSequencerOutputs,
    DrumStep, DRUM_TRACKS, DRUM_STEPS, DRUM_TRACK_NAMES,
    EuclideanSequencer, EuclideanParams, EuclideanInputs,
    EUCLIDEAN_MAX_STEPS,
    Mario, MarioOutputs, MARIO_CHANNELS,
    MidiFileSequencer, MidiFileSequencerParams, MidiFileSequencerInputs, MidiFileSequencerOutputs,
    MidiNote, MidiTrack, MIDI_TRACKS, MAX_NOTES_PER_TRACK,
    TuringMachine, TuringParams, TuringInputs,
    SidPlayer, SidPlayerParams, SidPlayerInputs, SidPlayerOutputs, SidHeader,
    AyPlayer, AyPlayerParams, AyPlayerInputs, AyPlayerOutputs, YmHeader,
};

// Re-export chips
pub use chips::Ay3_8910;

// Re-export drums (TR-909)
pub use drums::{
    Kick909, Kick909Params, Kick909Inputs,
    Snare909, Snare909Params, Snare909Inputs,
    HiHat909, HiHat909Params, HiHat909Inputs,
    Clap909, Clap909Params, Clap909Inputs,
    Tom909, Tom909Params, Tom909Inputs,
    Rimshot909, Rimshot909Params, Rimshot909Inputs,
};

// Re-export drums (TR-808)
pub use drums::{
    Kick808, Kick808Params, Kick808Inputs,
    Snare808, Snare808Params, Snare808Inputs,
    HiHat808, HiHat808Params, HiHat808Inputs,
    Cowbell808, Cowbell808Params, Cowbell808Inputs,
    Clap808, Clap808Params, Clap808Inputs,
    Tom808, Tom808Params, Tom808Inputs,
};

// =============================================================================
// Amplifiers / Utilities (not extracted to separate modules)
// =============================================================================

/// Simple VCA (Voltage Controlled Amplifier).
///
/// Multiplies input signal by gain and optional CV.
pub struct Vca;

impl Vca {
    pub fn process_block(
        output: &mut [Sample],
        input: Option<&[Sample]>,
        cv: Option<&[Sample]>,
        gain: &[Sample],
    ) {
        if output.is_empty() {
            return;
        }

        for i in 0..output.len() {
            let source = input_at(input, i);
            let cv_value = match cv {
                Some(values) => sample_at(values, i, 1.0).max(0.0),
                None => 1.0,
            };
            let gain_value = sample_at(gain, i, 1.0);
            output[i] = source * gain_value * cv_value;
        }
    }
}

/// Simple audio mixer.
///
/// Mixes multiple audio inputs with individual level controls.
pub struct Mixer;

impl Mixer {
    pub fn process_block(
        output: &mut [Sample],
        input_a: Option<&[Sample]>,
        input_b: Option<&[Sample]>,
        level_a: &[Sample],
        level_b: &[Sample],
    ) {
        if output.is_empty() {
            return;
        }

        for i in 0..output.len() {
            let level_a_value = sample_at(level_a, i, 0.6);
            let level_b_value = sample_at(level_b, i, 0.6);
            let a = input_at(input_a, i) * level_a_value;
            let b = input_at(input_b, i) * level_b_value;
            output[i] = (a + b) * 0.5;
        }
    }

    pub fn process_block_multi(
        output: &mut [Sample],
        inputs: &[Option<&[Sample]>],
        levels: &[&[Sample]],
    ) {
        if output.is_empty() {
            return;
        }
        if inputs.len() != levels.len() {
            return;
        }

        let mut active_count = 0;
        for input in inputs {
            if input.is_some() {
                active_count += 1;
            }
        }
        let scale = if active_count > 0 {
            1.0 / active_count as Sample
        } else {
            0.0
        };

        for i in 0..output.len() {
            let mut sum = 0.0;
            for (index, input) in inputs.iter().enumerate() {
                let level = sample_at(levels[index], i, 0.6);
                sum += input_at(*input, i) * level;
            }
            output[i] = sum * scale;
        }
    }

    /// Stereo version of process_block for 2-channel mixer.
    pub fn process_block_stereo(
        output_l: &mut [Sample],
        output_r: &mut [Sample],
        input_a_l: Option<&[Sample]>,
        input_a_r: Option<&[Sample]>,
        input_b_l: Option<&[Sample]>,
        input_b_r: Option<&[Sample]>,
        level_a: &[Sample],
        level_b: &[Sample],
    ) {
        if output_l.is_empty() {
            return;
        }

        for i in 0..output_l.len() {
            let level_a_value = sample_at(level_a, i, 0.6);
            let level_b_value = sample_at(level_b, i, 0.6);
            let a_l = input_at(input_a_l, i) * level_a_value;
            let a_r = input_at(input_a_r, i) * level_a_value;
            let b_l = input_at(input_b_l, i) * level_b_value;
            let b_r = input_at(input_b_r, i) * level_b_value;
            output_l[i] = (a_l + b_l) * 0.5;
            output_r[i] = (a_r + b_r) * 0.5;
        }
    }

    /// Stereo version of process_block_multi for multi-channel mixers.
    pub fn process_block_multi_stereo(
        output_l: &mut [Sample],
        output_r: &mut [Sample],
        inputs_l: &[Option<&[Sample]>],
        inputs_r: &[Option<&[Sample]>],
        levels: &[&[Sample]],
    ) {
        if output_l.is_empty() {
            return;
        }
        if inputs_l.len() != levels.len() || inputs_r.len() != levels.len() {
            return;
        }

        let mut active_count = 0;
        for input in inputs_l {
            if input.is_some() {
                active_count += 1;
            }
        }
        let scale = if active_count > 0 {
            1.0 / active_count as Sample
        } else {
            0.0
        };

        for i in 0..output_l.len() {
            let mut sum_l = 0.0;
            let mut sum_r = 0.0;
            for (index, (input_l, input_r)) in inputs_l.iter().zip(inputs_r.iter()).enumerate() {
                let level = sample_at(levels[index], i, 0.6);
                sum_l += input_at(*input_l, i) * level;
                sum_r += input_at(*input_r, i) * level;
            }
            output_l[i] = sum_l * scale;
            output_r[i] = sum_r * scale;
        }
    }
}

/// Crossfader for A/B mixing between two audio sources.
///
/// mix = 0: 100% input A
/// mix = 1: 100% input B
/// mix = 0.5: 50% A + 50% B
pub struct Crossfader;

impl Crossfader {
    pub fn process_block(
        output: &mut [Sample],
        input_a: Option<&[Sample]>,
        input_b: Option<&[Sample]>,
        mix: &[Sample],
        mix_cv: Option<&[Sample]>,
    ) {
        // Early exit: if no inputs connected, output silence
        if input_a.is_none() && input_b.is_none() {
            output.fill(0.0);
            return;
        }

        for i in 0..output.len() {
            let base = sample_at(mix, i, 0.5);
            let cv = input_at(mix_cv, i);
            let m = (base + cv).clamp(0.0, 1.0);
            let a = input_at(input_a, i);
            let b = input_at(input_b, i);
            output[i] = a * (1.0 - m) + b * m;
        }
    }

    /// Stereo version of process_block for crossfader.
    pub fn process_block_stereo(
        output_l: &mut [Sample],
        output_r: &mut [Sample],
        input_a_l: Option<&[Sample]>,
        input_a_r: Option<&[Sample]>,
        input_b_l: Option<&[Sample]>,
        input_b_r: Option<&[Sample]>,
        mix: &[Sample],
        mix_cv: Option<&[Sample]>,
    ) {
        // Early exit: if no inputs connected, output silence
        if input_a_l.is_none() && input_b_l.is_none() {
            output_l.fill(0.0);
            output_r.fill(0.0);
            return;
        }

        for i in 0..output_l.len() {
            let base = sample_at(mix, i, 0.5);
            let cv = input_at(mix_cv, i);
            let m = (base + cv).clamp(0.0, 1.0);
            let a_l = input_at(input_a_l, i);
            let a_r = input_at(input_a_r, i);
            let b_l = input_at(input_b_l, i);
            let b_r = input_at(input_b_r, i);
            output_l[i] = a_l * (1.0 - m) + b_l * m;
            output_r[i] = a_r * (1.0 - m) + b_r * m;
        }
    }
}
