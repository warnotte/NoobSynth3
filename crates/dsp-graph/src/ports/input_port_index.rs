//! `input_port_index()`

use crate::types::*;

/// Map an input port ID to its index for a given module type.
pub fn input_port_index(module_type: ModuleType, port_id: &str) -> Option<usize> {
  match module_type {
    ModuleType::Oscillator => match port_id {
      "pitch" => Some(0),
      "fm-lin" | "fmLin" => Some(1),
      "fm-exp" | "fmExp" => Some(2),
      "pwm" => Some(3),
      "sync" => Some(4),
      "fm-audio" => Some(5),
      _ => None,
    },
    ModuleType::ModRouter => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::SampleHold => match port_id {
      "in" => Some(0),
      "trig" => Some(1),
      _ => None,
    },
    ModuleType::Slew => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::EnvelopeFollower => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::Quantizer => match port_id {
      "in" => Some(0),
      "root-cv" => Some(1),
      "scale-cv" => Some(2),
      _ => None,
    },
    ModuleType::RingMod => match port_id {
      "in-a" => Some(0),
      "in-b" => Some(1),
      _ => None,
    },
    ModuleType::Hpf => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::Gain => match port_id {
      "in" => Some(0),
      "cv" => Some(1),
      _ => None,
    },
    ModuleType::CvVca => match port_id {
      "in" => Some(0),
      "cv" => Some(1),
      _ => None,
    },
    ModuleType::Output => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::Lab => match port_id {
      "in-a" => Some(0),
      "in-b" => Some(1),
      _ => None,
    },
    ModuleType::Lfo => match port_id {
      "rate" => Some(0),
      "sync" => Some(1),
      "depth" | "depth-cv" => Some(2),
      _ => None,
    },
    ModuleType::Adsr => match port_id {
      "gate" => Some(0),
      _ => None,
    },
    ModuleType::Vcf => match port_id {
      "in" => Some(0),
      "mod" => Some(1),
      "env" => Some(2),
      "key" => Some(3),
      _ => None,
    },
    ModuleType::Mixer => match port_id {
      "in-a" => Some(0),
      "in-b" => Some(1),
      _ => None,
    },
    ModuleType::MixerWide => match port_id {
      "in-a" => Some(0),
      "in-b" => Some(1),
      "in-c" => Some(2),
      "in-d" => Some(3),
      "in-e" => Some(4),
      "in-f" => Some(5),
      _ => None,
    },
    ModuleType::Mixer8 => match port_id {
      "in-1" => Some(0),
      "in-2" => Some(1),
      "in-3" => Some(2),
      "in-4" => Some(3),
      "in-5" => Some(4),
      "in-6" => Some(5),
      "in-7" => Some(6),
      "in-8" => Some(7),
      _ => None,
    },
    ModuleType::Crossfader => match port_id {
      "in-a" | "a" => Some(0),
      "in-b" | "b" => Some(1),
      "mix" | "cv" => Some(2),
      _ => None,
    },
    ModuleType::Chorus
    | ModuleType::Ensemble
    | ModuleType::Delay
    | ModuleType::GranularDelay
    | ModuleType::TapeDelay
    | ModuleType::SpringReverb
    | ModuleType::Reverb
    | ModuleType::Phaser => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::Choir => match port_id {
      "in" => Some(0),
      "vowel" | "cv" => Some(1),
      _ => None,
    },
    ModuleType::Distortion
    | ModuleType::Wah
    | ModuleType::TubeAmp => match port_id {
      "in" | "input" | "audio" => Some(0),
      _ => None,
    },
    ModuleType::Wavefolder => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::Supersaw => match port_id {
      "pitch" => Some(0),
      _ => None,
    },
    ModuleType::Karplus => match port_id {
      "pitch" => Some(0),
      "gate" => Some(1),
      _ => None,
    },
    ModuleType::NesOsc => match port_id {
      "pitch" => Some(0),
      "wave-cv" => Some(1),
      _ => None,
    },
    ModuleType::SnesOsc => match port_id {
      "pitch" => Some(0),
      "wave-cv" => Some(1),
      _ => None,
    },
    ModuleType::Vocoder => match port_id {
      "mod" => Some(0),
      "car" => Some(1),
      _ => None,
    },
    ModuleType::Scope => match port_id {
      "in-a" => Some(0),
      "in-b" => Some(1),
      "in-c" => Some(2),
      "in-d" => Some(3),
      _ => None,
    },
    ModuleType::Meter => match port_id {
      "in" => Some(0),
      _ => None,
    },
    ModuleType::Arpeggiator => match port_id {
      "cv-in" => Some(0),
      "gate-in" => Some(1),
      "clock" => Some(2),
      _ => None,
    },
    ModuleType::StepSequencer => match port_id {
      "clock" => Some(0),
      "reset" => Some(1),
      "cv-offset" => Some(2),
      _ => None,
    },
    ModuleType::ChordSequencer | ModuleType::PolyrhythmSequencer | ModuleType::ClockDivider => match port_id {
      "clock" | "clk" => Some(0),
      "reset" | "rst" => Some(1),
      _ => None,
    },
    ModuleType::Tb303 => match port_id {
      "pitch" => Some(0),
      "gate" => Some(1),
      "velocity" | "vel" => Some(2),
      "cutoff-cv" | "cut" => Some(3),
      _ => None,
    },
    // TR-909 Drums
    ModuleType::Kick909 | ModuleType::Snare909 | ModuleType::HiHat909 |
    ModuleType::Clap909 | ModuleType::Tom909 | ModuleType::Rimshot909 |
    ModuleType::Crash909 | ModuleType::Ride909 => match port_id {
      "trigger" | "trig" => Some(0),
      "accent" | "acc" => Some(1),
      _ => None,
    },
    // TR-808 Drums
    ModuleType::Kick808 | ModuleType::Snare808 | ModuleType::HiHat808
    | ModuleType::Cowbell808 | ModuleType::Clap808 | ModuleType::Tom808 => match port_id {
      "trigger" | "trig" => Some(0),
      "accent" | "acc" => Some(1),
      _ => None,
    },
    // Drum Sequencer
    ModuleType::DrumSequencer | ModuleType::DrumMachine909 => match port_id {
      "clock" => Some(0),
      "reset" => Some(1),
      _ => None,
    },
    // Pitch Shifter
    ModuleType::PitchShifter => match port_id {
      "in" | "input" | "audio" => Some(0),
      "pitch" | "pitch-cv" => Some(1),
      _ => None,
    },
    // Euclidean Sequencer - 2 inputs
    ModuleType::Euclidean => match port_id {
      "clock" | "clk" => Some(0),
      "reset" | "rst" => Some(1),
      _ => None,
    },
    // FM Operator - 3 inputs
    ModuleType::FmOp => match port_id {
      "pitch" | "1volt" => Some(0),
      "gate" => Some(1),
      "fm" | "fm-in" => Some(2),
      _ => None,
    },
    // FM Matrix - 6 inputs
    ModuleType::FmMatrix => match port_id {
      "pitch" | "1volt" => Some(0),
      "gate" => Some(1),
      "velocity" | "vel" => Some(2),
      "fm-in" | "fm" => Some(3),
      "mod" => Some(4),
      "ratio-cv" | "ratio" => Some(5),
      _ => None,
    },
    // Notes - no inputs
    ModuleType::Notes => None,
    // Clock - 3 inputs
    ModuleType::Clock => match port_id {
      "start" => Some(0),
      "stop" => Some(1),
      "rst-in" => Some(2),
      _ => None,
    },
    // Shepard - 3 inputs
    ModuleType::Shepard => match port_id {
      "rate-cv" | "rate" => Some(0),
      "pitch-cv" | "pitch" | "1volt" => Some(1),
      "sync" => Some(2),
      _ => None,
    },
    // Pipe Organ - 2 inputs
    ModuleType::PipeOrgan => match port_id {
      "pitch" | "pitch-cv" | "1volt" => Some(0),
      "gate" => Some(1),
      _ => None,
    },
    // Spectral Swarm - 3 inputs
    ModuleType::SpectralSwarm => match port_id {
      "pitch" | "pitch-cv" | "1volt" => Some(0),
      "gate" => Some(1),
      "sync" | "reset" => Some(2),
      _ => None,
    },
    // Resonator - 5 inputs
    ModuleType::Resonator => match port_id {
      "in" | "input" | "audio" => Some(0),
      "pitch" | "pitch-cv" | "1volt" => Some(1),
      "gate" => Some(2),
      "strum" => Some(3),
      "damp" | "damper" => Some(4),
      _ => None,
    },
    // Wavetable - 4 inputs
    ModuleType::Wavetable => match port_id {
      "pitch" | "pitch-cv" | "1volt" => Some(0),
      "gate" => Some(1),
      "position" | "pos-cv" => Some(2),
      "sync" => Some(3),
      _ => None,
    },
    // MIDI File Sequencer - 2 inputs
    ModuleType::MidiFileSequencer => match port_id {
      "clock" | "clk" => Some(0),
      "reset" | "rst" => Some(1),
      _ => None,
    },
    ModuleType::Chaos => match port_id {
      "speed" => Some(0),
      _ => None,
    },
    ModuleType::TuringMachine => match port_id {
      "clock" | "clk" => Some(0),
      "reset" | "rst" => Some(1),
      _ => None,
    },
    ModuleType::Harmonist => match port_id {
      "clock" | "clk" => Some(0),
      "reset" | "rst" => Some(1),
      _ => None,
    },
    ModuleType::GameOfLife => match port_id {
      "clock" | "clk" => Some(0),
      "reset" | "rst" => Some(1),
      _ => None,
    },
    ModuleType::GravitySequencer => match port_id {
      "reset" | "rst" => Some(0),
      _ => None,
    },
    // Granular - 4 inputs
    ModuleType::Granular => match port_id {
      "in" | "audio" | "audio-in" => Some(0),
      "trigger" | "trig" => Some(1),
      "position" | "pos-cv" => Some(2),
      "pitch" | "pitch-cv" => Some(3),
      _ => None,
    },
    // ParticleCloud - 2 inputs
    ModuleType::ParticleCloud => match port_id {
      "in" | "audio" | "audio-in" => Some(0),
      "trigger" | "trig" => Some(1),
      _ => None,
    },
    // SidPlayer - 1 input
    ModuleType::SidPlayer => match port_id {
      "reset" | "rst" => Some(0),
      _ => None,
    },
    // AyPlayer - 1 input (reset)
    ModuleType::AyPlayer => match port_id {
      "reset" | "rst" => Some(0),
      _ => None,
    },
    // Compressor - 2 inputs (audio + sidechain)
    ModuleType::Compressor => match port_id {
      "in" | "input" | "audio" => Some(0),
      "sidechain" | "sc" => Some(1),
      _ => None,
    },
    // BitCrusher - 1 input
    ModuleType::BitCrusher => match port_id {
      "in" | "input" | "audio" => Some(0),
      _ => None,
    },
    // Flanger - 1 input
    ModuleType::Flanger => match port_id {
      "in" | "input" | "audio" => Some(0),
      _ => None,
    },
    // FreqShifter - 1 input
    ModuleType::FreqShifter => match port_id {
      "in" | "input" | "audio" => Some(0),
      _ => None,
    },
    // Eq3 - 1 input
    ModuleType::Eq3 => match port_id {
      "in" | "input" | "audio" => Some(0),
      _ => None,
    },
    // Glitch - 2 inputs (audio + clock)
    ModuleType::Glitch => match port_id {
      "in" | "input" | "audio" => Some(0),
      "clock" | "clk" | "trig" => Some(1),
      _ => None,
    },
    ModuleType::Leslie => match port_id {
      "in" | "input" | "audio" => Some(0),
      _ => None,
    },
    // SpeechSynth - 3 inputs
    ModuleType::SpeechSynth => match port_id {
      "pitch" | "pitch-cv" | "1volt" => Some(0),
      "gate" => Some(1),
      "clock" | "clk" => Some(2),
      _ => None,
    },
    // Theremin - pitch / volume / gate CV inputs
    ModuleType::Theremin => match port_id {
      "pitch" | "pitch-cv" | "pitch-in" | "1volt" => Some(0),
      "vol" | "vol-in" | "volume" => Some(1),
      "gate" | "gate-in" => Some(2),
      _ => None,
    },
    // Send - 1 input
    ModuleType::Send => match port_id {
      "in" => Some(0),
      _ => None,
    },
    // Receive - 1 input
    ModuleType::Receive => match port_id {
      "in" => Some(0),
      _ => None,
    },
    _ => None,
  }
}
