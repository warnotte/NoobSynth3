//! `output_port_index()`

use crate::types::*;

/// Map an output port ID to its index for a given module type.
pub fn output_port_index(module_type: ModuleType, port_id: &str) -> Option<usize> {
  match module_type {
    ModuleType::Oscillator => match port_id {
      "out" => Some(0),
      "sub" => Some(1),
      "sync" | "sync-out" => Some(2),
      _ => None,
    },
    ModuleType::Noise => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::ModRouter => match port_id {
      "pitch" => Some(0),
      "pwm" => Some(1),
      "vcf" => Some(2),
      "vca" => Some(3),
      _ => None,
    },
    ModuleType::SampleHold => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Slew => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::EnvelopeFollower => match port_id {
      "out" | "cv-out" => Some(0),
      _ => None,
    },
    ModuleType::Quantizer => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::RingMod => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Gain => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::CvVca => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Output => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Lab => match port_id {
      "out-a" => Some(0),
      "out-b" => Some(1),
      _ => None,
    },
    ModuleType::Lfo => match port_id {
      "cv-out" => Some(0),
      _ => None,
    },
    ModuleType::Adsr => match port_id {
      "env" => Some(0),
      _ => None,
    },
    ModuleType::Vcf => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Hpf => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Mixer => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::MixerWide => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Mixer8 => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Crossfader => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Chorus
    | ModuleType::Ensemble
    | ModuleType::Choir
    | ModuleType::Delay
    | ModuleType::GranularDelay
    | ModuleType::TapeDelay
    | ModuleType::SpringReverb
    | ModuleType::Reverb
    | ModuleType::Phaser => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Distortion
    | ModuleType::Wah
    | ModuleType::TubeAmp => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    ModuleType::Wavefolder => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Supersaw => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Karplus => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::NesOsc => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::SnesOsc => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::AudioIn => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Vocoder => match port_id {
      "out" => Some(0),
      _ => None,
    },
    ModuleType::Control => match port_id {
      "cv-out" => Some(0),
      "vel-out" => Some(1),
      "gate-out" => Some(2),
      "sync-out" => Some(3),
      _ => None,
    },
    ModuleType::Scope => match port_id {
      "out-a" => Some(0),
      "out-b" => Some(1),
      _ => None,
    },
    ModuleType::Meter => match port_id {
      _ => None,
    },
    ModuleType::Mario => match port_id {
      "cv-1" => Some(0),
      "gate-1" => Some(1),
      "cv-2" => Some(2),
      "gate-2" => Some(3),
      "cv-3" => Some(4),
      "gate-3" => Some(5),
      "cv-4" => Some(6),
      "gate-4" => Some(7),
      "cv-5" => Some(8),
      "gate-5" => Some(9),
      _ => None,
    },
    ModuleType::Arpeggiator => match port_id {
      "cv-out" => Some(0),
      "gate-out" => Some(1),
      "accent" => Some(2),
      _ => None,
    },
    ModuleType::StepSequencer => match port_id {
      "cv-out" => Some(0),
      "gate-out" => Some(1),
      "velocity-out" => Some(2),
      "step-out" => Some(3),
      _ => None,
    },
    ModuleType::ChordSequencer => match port_id {
      "cv-1" => Some(0),
      "gate-1" => Some(1),
      "cv-2" => Some(2),
      "gate-2" => Some(3),
      "cv-3" => Some(4),
      "gate-3" => Some(5),
      "cv-4" => Some(6),
      "gate-4" => Some(7),
      "step-out" => Some(8),
      "root-cv" => Some(9),
      _ => None,
    },
    ModuleType::PolyrhythmSequencer => match port_id {
      "cv-1" => Some(0),
      "gate-1" => Some(1),
      "cv-2" => Some(2),
      "gate-2" => Some(3),
      "cv-3" => Some(4),
      "gate-3" => Some(5),
      "cv-4" => Some(6),
      "gate-4" => Some(7),
      "step-out" => Some(8),
      _ => None,
    },
    ModuleType::ClockDivider => match port_id {
      "div-2" => Some(0),
      "div-4" => Some(1),
      "div-8" => Some(2),
      "div-16" => Some(3),
      _ => None,
    },
    ModuleType::Tb303 => match port_id {
      "out" => Some(0),
      "env-out" => Some(1),
      _ => None,
    },
    // TR-909 Drums
    ModuleType::Kick909 | ModuleType::Snare909 | ModuleType::HiHat909 |
    ModuleType::Clap909 | ModuleType::Tom909 | ModuleType::Rimshot909 |
    ModuleType::Crash909 | ModuleType::Ride909 => match port_id {
      "out" => Some(0),
      _ => None,
    },
    // TR-808 Drums
    ModuleType::Kick808 | ModuleType::Snare808 | ModuleType::HiHat808
    | ModuleType::Cowbell808 | ModuleType::Clap808 | ModuleType::Tom808 => match port_id {
      "out" => Some(0),
      _ => None,
    },
    // Drum Sequencer - 17 outputs
    ModuleType::DrumSequencer => match port_id {
      "gate-kick" => Some(0),
      "gate-snare" => Some(1),
      "gate-hhc" => Some(2),
      "gate-hho" => Some(3),
      "gate-clap" => Some(4),
      "gate-tom" => Some(5),
      "gate-rim" => Some(6),
      "gate-aux" => Some(7),
      "acc-kick" => Some(8),
      "acc-snare" => Some(9),
      "acc-hhc" => Some(10),
      "acc-hho" => Some(11),
      "acc-clap" => Some(12),
      "acc-tom" => Some(13),
      "acc-rim" => Some(14),
      "acc-aux" => Some(15),
      "step-out" => Some(16),
      _ => None,
    },
    // Pitch Shifter - 1 output
    ModuleType::PitchShifter => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // Euclidean Sequencer - 2 outputs
    ModuleType::Euclidean => match port_id {
      "gate" | "gate-out" => Some(0),
      "step" | "step-out" => Some(1),
      _ => None,
    },
    // FM Operator - 1 output
    ModuleType::FmOp => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // FM Matrix - 2 outputs
    ModuleType::FmMatrix => match port_id {
      "out" | "output" => Some(0),
      "mod-out" | "env" => Some(1),
      _ => None,
    },
    // Notes - no outputs
    ModuleType::Notes => None,
    // Clock - 4 outputs
    ModuleType::Clock => match port_id {
      "clock" | "clk" => Some(0),
      "reset" | "rst" => Some(1),
      "run" => Some(2),
      "bar" => Some(3),
      _ => None,
    },
    // Shepard - 1 output
    ModuleType::Shepard => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // Pipe Organ - 1 output
    ModuleType::PipeOrgan => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // Spectral Swarm - 1 stereo output
    ModuleType::SpectralSwarm => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // Resonator - 1 mono output
    ModuleType::Resonator => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // Wavetable - 1 mono output
    ModuleType::Wavetable => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // MIDI File Sequencer - 25 outputs
    ModuleType::MidiFileSequencer => match port_id {
      "cv-1" => Some(0),
      "cv-2" => Some(1),
      "cv-3" => Some(2),
      "cv-4" => Some(3),
      "cv-5" => Some(4),
      "cv-6" => Some(5),
      "cv-7" => Some(6),
      "cv-8" => Some(7),
      "gate-1" => Some(8),
      "gate-2" => Some(9),
      "gate-3" => Some(10),
      "gate-4" => Some(11),
      "gate-5" => Some(12),
      "gate-6" => Some(13),
      "gate-7" => Some(14),
      "gate-8" => Some(15),
      "vel-1" => Some(16),
      "vel-2" => Some(17),
      "vel-3" => Some(18),
      "vel-4" => Some(19),
      "vel-5" => Some(20),
      "vel-6" => Some(21),
      "vel-7" => Some(22),
      "vel-8" => Some(23),
      "tick-out" => Some(24),
      _ => None,
    },
    ModuleType::Chaos => match port_id {
      "x" => Some(0),
      "y" => Some(1),
      "z" => Some(2),
      "gate" => Some(3),
      _ => None,
    },
    ModuleType::TuringMachine => match port_id {
      "cv" | "cv-out" => Some(0),
      "gate" | "gate-out" => Some(1),
      "pulse" | "trig" => Some(2),
      _ => None,
    },
    ModuleType::GameOfLife => match port_id {
      "cv" | "cv-out" => Some(0),
      "gate" | "gate-out" => Some(1),
      "pulse" | "trig" => Some(2),
      "density" => Some(3),
      _ => None,
    },
    ModuleType::GravitySequencer => match port_id {
      "cv" | "cv-out" => Some(0),
      "gate" | "gate-out" => Some(1),
      "pulse" | "trig" => Some(2),
      "x" | "x-out" => Some(3),
      "y" | "y-out" => Some(4),
      _ => None,
    },
    // Granular - 1 stereo output
    ModuleType::Granular => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // ParticleCloud - 1 stereo output
    ModuleType::ParticleCloud => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // SidPlayer - 1 stereo output + 3 gates + 3 CVs + 3 waveform CVs
    ModuleType::SidPlayer => match port_id {
      "out" | "output" | "audio" => Some(0),
      "gate-1" => Some(1),
      "gate-2" => Some(2),
      "gate-3" => Some(3),
      "cv-1" => Some(4),
      "cv-2" => Some(5),
      "cv-3" => Some(6),
      "wf-1" => Some(7),
      "wf-2" => Some(8),
      "wf-3" => Some(9),
      _ => None,
    },
    // AyPlayer - 1 stereo output + 3 gates + 3 CVs
    ModuleType::AyPlayer => match port_id {
      "out" | "output" | "audio" => Some(0),
      "gate-a" => Some(1),
      "gate-b" => Some(2),
      "gate-c" => Some(3),
      "cv-a" => Some(4),
      "cv-b" => Some(5),
      "cv-c" => Some(6),
      _ => None,
    },
    // Compressor - 1 output
    ModuleType::Compressor => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // BitCrusher - 1 output
    ModuleType::BitCrusher => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // Flanger - 1 output
    ModuleType::Flanger => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // FreqShifter - 1 output
    ModuleType::FreqShifter => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // Eq3 - 1 output
    ModuleType::Eq3 => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // Glitch - 1 output
    ModuleType::Glitch => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    ModuleType::Leslie => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // SpeechSynth - 1 output
    ModuleType::SpeechSynth => match port_id {
      "out" | "output" => Some(0),
      _ => None,
    },
    // Theremin - audio out + pitch/gate/volume CV
    ModuleType::Theremin => match port_id {
      "out" | "output" => Some(0),
      "pitch-cv" | "pitch" => Some(1),
      "gate" | "gate-out" => Some(2),
      "vol" | "vol-cv" | "volume" => Some(3),
      _ => None,
    },
    // Send - 1 output
    ModuleType::Send => match port_id {
      "out" => Some(0),
      _ => None,
    },
    // Receive - 1 output
    ModuleType::Receive => match port_id {
      "out" => Some(0),
      _ => None,
    },
  }
}
