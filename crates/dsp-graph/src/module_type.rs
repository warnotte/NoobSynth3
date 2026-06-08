//! Mapping from preset/graph module-type strings to the `ModuleType` enum.
//!
//! This is the single source of truth for which string identifiers the engine
//! accepts for each module (including aliases, e.g. `"frequency-shifter"` for
//! `freq-shifter`). When adding a new module, add its string here — see the
//! "New Module Checklist" in CLAUDE.md.

use crate::types::ModuleType;

/// Resolve a module-type string to its `ModuleType`.
///
/// Unknown strings fall back to `ModuleType::Oscillator`.
pub(crate) fn normalize_module_type(raw: &str) -> ModuleType {
  match raw {
    "oscillator" => ModuleType::Oscillator,
    "supersaw" => ModuleType::Supersaw,
    "karplus" => ModuleType::Karplus,
    "nes-osc" => ModuleType::NesOsc,
    "snes-osc" => ModuleType::SnesOsc,
    "noise" => ModuleType::Noise,
    "mod-router" => ModuleType::ModRouter,
    "sample-hold" => ModuleType::SampleHold,
    "slew" => ModuleType::Slew,
    "quantizer" => ModuleType::Quantizer,
    "ring-mod" => ModuleType::RingMod,
    "gain" => ModuleType::Gain,
    "cv-vca" => ModuleType::CvVca,
    "output" => ModuleType::Output,
    "lab" => ModuleType::Lab,
    "lfo" => ModuleType::Lfo,
    "adsr" => ModuleType::Adsr,
    "vcf" => ModuleType::Vcf,
    "hpf" => ModuleType::Hpf,
    "mixer" => ModuleType::Mixer,
    "mixer-1x2" => ModuleType::MixerWide,
    "mixer-8" => ModuleType::Mixer8,
    "crossfader" => ModuleType::Crossfader,
    "chorus" => ModuleType::Chorus,
    "ensemble" => ModuleType::Ensemble,
    "choir" => ModuleType::Choir,
    "vocoder" => ModuleType::Vocoder,
    "audio-in" => ModuleType::AudioIn,
    "delay" => ModuleType::Delay,
    "granular-delay" => ModuleType::GranularDelay,
    "tape-delay" => ModuleType::TapeDelay,
    "spring-reverb" => ModuleType::SpringReverb,
    "reverb" => ModuleType::Reverb,
    "phaser" => ModuleType::Phaser,
    "distortion" => ModuleType::Distortion,
    "wavefolder" => ModuleType::Wavefolder,
    "compressor" => ModuleType::Compressor,
    "bit-crusher" => ModuleType::BitCrusher,
    "flanger" => ModuleType::Flanger,
    "freq-shifter" | "frequency-shifter" => ModuleType::FreqShifter,
    "eq3" | "eq-3" => ModuleType::Eq3,
    "glitch" => ModuleType::Glitch,
    "leslie" | "rotary" => ModuleType::Leslie,
    "wah" | "wah-wah" | "auto-wah" => ModuleType::Wah,
    "tube-amp" | "tube" => ModuleType::TubeAmp,
    "control" => ModuleType::Control,
    "scope" => ModuleType::Scope,
    "meter" => ModuleType::Meter,
    "mario" => ModuleType::Mario,
    "arpeggiator" => ModuleType::Arpeggiator,
    "step-sequencer" => ModuleType::StepSequencer,
    "tb-303" => ModuleType::Tb303,
    // TR-909 Drums
    "909-kick" => ModuleType::Kick909,
    "909-snare" => ModuleType::Snare909,
    "909-hihat" => ModuleType::HiHat909,
    "909-clap" => ModuleType::Clap909,
    "909-tom" => ModuleType::Tom909,
    "909-rimshot" => ModuleType::Rimshot909,
    "909-crash" => ModuleType::Crash909,
    "909-ride" => ModuleType::Ride909,
    "drum-machine-909" => ModuleType::DrumMachine909,
    // TR-808 Drums
    "808-kick" => ModuleType::Kick808,
    "808-snare" => ModuleType::Snare808,
    "808-hihat" => ModuleType::HiHat808,
    "808-cowbell" => ModuleType::Cowbell808,
    "808-clap" => ModuleType::Clap808,
    "808-tom" => ModuleType::Tom808,
    // Drum Sequencer
    "drum-sequencer" => ModuleType::DrumSequencer,
    "euclidean" => ModuleType::Euclidean,
    // MIDI File Sequencer
    "midi-file-sequencer" => ModuleType::MidiFileSequencer,
    // FM Synthesis
    "fm-op" => ModuleType::FmOp,
    "fm-matrix" => ModuleType::FmMatrix,
    "shepard" => ModuleType::Shepard,
    "pipe-organ" => ModuleType::PipeOrgan,
    "spectral-swarm" => ModuleType::SpectralSwarm,
    "resonator" => ModuleType::Resonator,
    "wavetable" => ModuleType::Wavetable,
    "granular" => ModuleType::Granular,
    "particle-cloud" => ModuleType::ParticleCloud,
    // Documentation
    "notes" => ModuleType::Notes,
    // Effects
    "pitch-shifter" => ModuleType::PitchShifter,
    "clock" => ModuleType::Clock,
    "chaos" => ModuleType::Chaos,
    "envelope-follower" => ModuleType::EnvelopeFollower,
    "turing-machine" | "turing" => ModuleType::TuringMachine,
    "harmonist" => ModuleType::Harmonist,
    // SID Player
    "sid-player" => ModuleType::SidPlayer,
    // AY Player
    "ay-player" => ModuleType::AyPlayer,
    // Speech Synth
    "speech-synth" => ModuleType::SpeechSynth,
    "theremin" => ModuleType::Theremin,
    // Chord Sequencer
    "chord-sequencer" => ModuleType::ChordSequencer,
    // Polyrhythm Sequencer
    "polyrhythm-sequencer" => ModuleType::PolyrhythmSequencer,
    // Clock Divider
    "clock-divider" => ModuleType::ClockDivider,
    // Generative sequencers
    "game-of-life" => ModuleType::GameOfLife,
    "gravity-sequencer" => ModuleType::GravitySequencer,
    // Send/Receive (audio bus pass-through)
    "send" => ModuleType::Send,
    "receive" => ModuleType::Receive,
    _ => ModuleType::Oscillator,
  }
}
