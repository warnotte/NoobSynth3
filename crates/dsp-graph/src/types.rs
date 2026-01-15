//! Core types for the graph engine.

use dsp_core::Sample;

/// All supported module types in the graph.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModuleType {
    // Oscillators
    Oscillator,
    Supersaw,
    Karplus,
    NesOsc,
    SnesOsc,
    Noise,
    Tb303,
    FmOp,
    Shepard,

    // Filters
    Vcf,
    Hpf,

    // Amplifiers / Mixers
    Gain,
    CvVca,
    Mixer,
    MixerWide,
    RingMod,

    // Modulators
    Lfo,
    Adsr,
    ModRouter,
    SampleHold,
    Slew,
    Quantizer,

    // Effects
    Chorus,
    Ensemble,
    Choir,
    Vocoder,
    Delay,
    GranularDelay,
    TapeDelay,
    SpringReverb,
    Reverb,
    Phaser,
    Distortion,
    Wavefolder,
    PitchShifter,

    // Sequencers
    Clock,
    Arpeggiator,
    StepSequencer,
    DrumSequencer,
    Euclidean,
    Mario,

    // TR-909 Drums
    Kick909,
    Snare909,
    HiHat909,
    Clap909,
    Tom909,
    Rimshot909,

    // I/O & Utilities
    Control,
    Output,
    Lab,
    AudioIn,
    Scope,
    Notes,
}

/// Port channel configuration.
#[derive(Clone, Copy)]
pub struct PortInfo {
    pub channels: usize,
}

/// A connection edge in the graph.
pub struct ConnectionEdge {
    pub source_module: usize,
    pub source_port: usize,
    pub gain: f32,
}

/// A tap source for audio monitoring.
pub struct TapSource {
    pub module_index: usize,
    pub input_port: usize,
}

/// Parameter buffer for smooth parameter updates.
pub struct ParamBuffer {
    value: f32,
    buffer: Vec<Sample>,
    dirty: bool,
}

impl ParamBuffer {
    /// Create a new parameter buffer with an initial value.
    pub fn new(value: f32) -> Self {
        Self {
            value,
            buffer: Vec::new(),
            dirty: true,
        }
    }

    /// Set a new value (marks buffer as dirty if changed).
    pub fn set(&mut self, value: f32) {
        if value != self.value {
            self.value = value;
            self.dirty = true;
        }
    }

    /// Get a slice of the parameter value for the given number of frames.
    pub fn slice(&mut self, frames: usize) -> &[Sample] {
        if self.buffer.len() != frames || self.dirty {
            self.buffer.resize(frames, self.value);
            if frames > 0 {
                self.buffer.fill(self.value);
            }
            self.dirty = false;
        }
        &self.buffer
    }
}
