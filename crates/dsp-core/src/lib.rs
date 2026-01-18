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
    Shepard, ShepardParams, ShepardInputs,
    PipeOrgan, PipeOrganParams, PipeOrganInputs, OrganVoicing, ORGAN_DRAWBARS, DRAWBAR_NAMES,
    SpectralSwarm, SpectralSwarmParams, SpectralSwarmInputs,
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
};

// Re-export modulators
pub use modulators::{
    Lfo, LfoParams, LfoInputs,
    Adsr, AdsrParams, AdsrInputs,
    SampleHold, SampleHoldParams, SampleHoldInputs,
    SlewLimiter, SlewParams, SlewInputs,
    Quantizer, QuantizerParams, QuantizerInputs,
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
};

// Re-export drums
pub use drums::{
    Kick909, Kick909Params, Kick909Inputs,
    Snare909, Snare909Params, Snare909Inputs,
    HiHat909, HiHat909Params, HiHat909Inputs,
    Clap909, Clap909Params, Clap909Inputs,
    Tom909, Tom909Params, Tom909Inputs,
    Rimshot909, Rimshot909Params, Rimshot909Inputs,
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
}
