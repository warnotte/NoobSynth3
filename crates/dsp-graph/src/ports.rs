//! Port definitions for all module types.
//!
//! This module defines the input and output ports for each module type,
//! as well as mapping port IDs to indices.

use crate::types::{ModuleType, PortInfo};

/// Get the input ports for a given module type.
pub fn input_ports(module_type: ModuleType) -> Vec<PortInfo> {
  match module_type {
    ModuleType::Oscillator => vec![
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::Noise => vec![],
    ModuleType::ModRouter => vec![PortInfo { channels: 1 }],
    ModuleType::SampleHold => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::Slew => vec![PortInfo { channels: 1 }],
    ModuleType::Quantizer => vec![PortInfo { channels: 1 }],
    ModuleType::RingMod => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::Gain => vec![PortInfo { channels: 2 }, PortInfo { channels: 1 }],
    ModuleType::CvVca => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::Output => vec![PortInfo { channels: 2 }],
    ModuleType::Lab => vec![PortInfo { channels: 2 }, PortInfo { channels: 2 }],
    ModuleType::Lfo => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::Adsr => vec![PortInfo { channels: 1 }],
    ModuleType::Vcf => vec![
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::Hpf => vec![PortInfo { channels: 1 }],
    ModuleType::Mixer => vec![PortInfo { channels: 2 }, PortInfo { channels: 2 }],  // stereo inputs
    ModuleType::MixerWide => vec![
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
    ],
    ModuleType::Mixer8 => vec![
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
    ],
    // Crossfader - 2 audio inputs (A and B) + mix CV
    ModuleType::Crossfader => vec![
      PortInfo { channels: 2 },  // in-a (stereo)
      PortInfo { channels: 2 },  // in-b (stereo)
      PortInfo { channels: 1 },  // mix CV
    ],
    ModuleType::Chorus
    | ModuleType::Ensemble
    | ModuleType::Delay
    | ModuleType::GranularDelay
    | ModuleType::TapeDelay
    | ModuleType::SpringReverb
    | ModuleType::Reverb
    | ModuleType::Phaser => {
      vec![PortInfo { channels: 2 }]
    },
    ModuleType::Choir => vec![
      PortInfo { channels: 2 }, // audio in (stereo)
      PortInfo { channels: 1 }, // vowel CV
    ],
    ModuleType::Distortion => vec![PortInfo { channels: 1 }],
    ModuleType::Wavefolder => vec![PortInfo { channels: 1 }],
    ModuleType::Supersaw => vec![PortInfo { channels: 1 }],
    ModuleType::Karplus => vec![
      PortInfo { channels: 1 },  // pitch input
      PortInfo { channels: 1 },  // gate input
    ],
    ModuleType::NesOsc => vec![
      PortInfo { channels: 1 },  // pitch input
      PortInfo { channels: 1 },  // wave-cv input
    ],
    ModuleType::SnesOsc => vec![
      PortInfo { channels: 1 },  // pitch input
      PortInfo { channels: 1 },  // wave-cv input
    ],
    ModuleType::AudioIn => vec![],
    ModuleType::Vocoder => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::Control => vec![],
    ModuleType::Scope => vec![
      PortInfo { channels: 2 },
      PortInfo { channels: 2 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::Mario => vec![],
    ModuleType::Arpeggiator => vec![
      PortInfo { channels: 1 },  // cv-in
      PortInfo { channels: 1 },  // gate-in
      PortInfo { channels: 1 },  // clock
    ],
    ModuleType::StepSequencer => vec![
      PortInfo { channels: 1 },  // clock
      PortInfo { channels: 1 },  // reset
      PortInfo { channels: 1 },  // cv-offset
    ],
    ModuleType::Tb303 => vec![
      PortInfo { channels: 1 },  // pitch
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // velocity
      PortInfo { channels: 1 },  // cutoff-cv
    ],
    // TR-909 Drums - all have trigger + accent inputs
    ModuleType::Kick909 | ModuleType::Snare909 | ModuleType::HiHat909 |
    ModuleType::Clap909 | ModuleType::Tom909 | ModuleType::Rimshot909 => vec![
      PortInfo { channels: 1 },  // trigger
      PortInfo { channels: 1 },  // accent
    ],
    // TR-808 Drums - all have trigger + accent inputs
    ModuleType::Kick808 | ModuleType::Snare808 | ModuleType::HiHat808
    | ModuleType::Cowbell808 | ModuleType::Clap808 | ModuleType::Tom808 => vec![
      PortInfo { channels: 1 },  // trigger
      PortInfo { channels: 1 },  // accent
    ],
    // Drum Sequencer - 2 inputs (clock, reset)
    ModuleType::DrumSequencer => vec![
      PortInfo { channels: 1 },  // clock
      PortInfo { channels: 1 },  // reset
    ],
    // Euclidean Sequencer - 2 inputs (clock, reset)
    ModuleType::Euclidean => vec![
      PortInfo { channels: 1 },  // clock
      PortInfo { channels: 1 },  // reset
    ],
    // FM Operator - 3 inputs (pitch, gate, fm)
    ModuleType::FmOp => vec![
      PortInfo { channels: 1 },  // pitch CV
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // FM input
    ],
    // FM Matrix - 6 inputs (pitch, gate, velocity, fm-in, mod, ratio-cv)
    ModuleType::FmMatrix => vec![
      PortInfo { channels: 1 },  // pitch CV
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // velocity
      PortInfo { channels: 1 },  // FM external input
      PortInfo { channels: 1 },  // mod CV
      PortInfo { channels: 1 },  // ratio CV
    ],
    // Notes - no inputs (UI only)
    ModuleType::Notes => vec![],
    // Pitch Shifter - 2 inputs (audio, pitch CV)
    ModuleType::PitchShifter => vec![
      PortInfo { channels: 1 },  // audio input
      PortInfo { channels: 1 },  // pitch CV
    ],
    // Clock - 3 inputs (start, stop, reset)
    ModuleType::Clock => vec![
      PortInfo { channels: 1 },  // start trigger
      PortInfo { channels: 1 },  // stop trigger
      PortInfo { channels: 1 },  // reset trigger
    ],
    // Shepard tone generator - 3 inputs (rate CV, pitch CV, sync)
    ModuleType::Shepard => vec![
      PortInfo { channels: 1 },  // rate CV
      PortInfo { channels: 1 },  // pitch CV
      PortInfo { channels: 1 },  // sync
    ],
    // Pipe Organ - 2 inputs (pitch CV, gate)
    ModuleType::PipeOrgan => vec![
      PortInfo { channels: 1 },  // pitch CV
      PortInfo { channels: 1 },  // gate
    ],
    // Spectral Swarm - 3 inputs (pitch, gate, sync)
    ModuleType::SpectralSwarm => vec![
      PortInfo { channels: 1 },  // pitch CV
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // sync
    ],
    // Resonator - 5 inputs (audio in, pitch, gate, strum, damp)
    ModuleType::Resonator => vec![
      PortInfo { channels: 1 },  // audio in
      PortInfo { channels: 1 },  // pitch CV
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // strum trigger
      PortInfo { channels: 1 },  // damp CV
    ],
    // Wavetable - 4 inputs (pitch, gate, position CV, sync)
    ModuleType::Wavetable => vec![
      PortInfo { channels: 1 },  // pitch CV
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // position CV
      PortInfo { channels: 1 },  // sync
    ],
    // MIDI File Sequencer - 2 inputs (clock, reset)
    ModuleType::MidiFileSequencer => vec![
      PortInfo { channels: 1 },  // clock
      PortInfo { channels: 1 },  // reset
    ],
    // Chaos - 1 input (speed)
    ModuleType::Chaos => vec![
      PortInfo { channels: 1 },  // speed
    ],
    // Turing Machine - 2 inputs (clock, reset)
    ModuleType::TuringMachine => vec![
      PortInfo { channels: 1 },  // clock
      PortInfo { channels: 1 },  // reset
    ],
    // Granular - 4 inputs (audio, trigger, position CV, pitch CV)
    ModuleType::Granular => vec![
      PortInfo { channels: 1 },  // audio in (for recording)
      PortInfo { channels: 1 },  // trigger
      PortInfo { channels: 1 },  // position CV
      PortInfo { channels: 1 },  // pitch CV
    ],
    // SidPlayer - 1 input (reset)
    ModuleType::SidPlayer => vec![
      PortInfo { channels: 1 },  // reset trigger
    ],
    // AyPlayer - 1 input (reset)
    ModuleType::AyPlayer => vec![
      PortInfo { channels: 1 },  // reset trigger
    ],
  }
}

/// Get the output ports for a given module type.
pub fn output_ports(module_type: ModuleType) -> Vec<PortInfo> {
  match module_type {
    ModuleType::Oscillator => vec![
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::Noise => vec![PortInfo { channels: 2 }],
    ModuleType::ModRouter => vec![
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::SampleHold => vec![PortInfo { channels: 1 }],
    ModuleType::Slew => vec![PortInfo { channels: 1 }],
    ModuleType::Quantizer => vec![PortInfo { channels: 1 }],
    ModuleType::RingMod => vec![PortInfo { channels: 1 }],
    ModuleType::Gain => vec![PortInfo { channels: 2 }],
    ModuleType::CvVca => vec![PortInfo { channels: 1 }],
    ModuleType::Output => vec![PortInfo { channels: 2 }],
    ModuleType::Lab => vec![PortInfo { channels: 2 }, PortInfo { channels: 2 }],
    ModuleType::Lfo => vec![PortInfo { channels: 1 }],
    ModuleType::Adsr => vec![PortInfo { channels: 1 }],
    ModuleType::Vcf => vec![PortInfo { channels: 1 }],
    ModuleType::Hpf => vec![PortInfo { channels: 1 }],
    ModuleType::Mixer => vec![PortInfo { channels: 2 }],      // stereo output
    ModuleType::MixerWide => vec![PortInfo { channels: 2 }],  // stereo output
    ModuleType::Mixer8 => vec![PortInfo { channels: 2 }],     // stereo output
    ModuleType::Crossfader => vec![PortInfo { channels: 2 }], // stereo output
    ModuleType::Chorus
    | ModuleType::Ensemble
    | ModuleType::Choir
    | ModuleType::Delay
    | ModuleType::GranularDelay
    | ModuleType::TapeDelay
    | ModuleType::SpringReverb
    | ModuleType::Reverb
    | ModuleType::Phaser => {
      vec![PortInfo { channels: 2 }]
    },
    ModuleType::Distortion => vec![PortInfo { channels: 1 }],
    ModuleType::Wavefolder => vec![PortInfo { channels: 1 }],
    ModuleType::Supersaw => vec![PortInfo { channels: 1 }],
    ModuleType::Karplus => vec![PortInfo { channels: 1 }],  // audio output
    ModuleType::NesOsc => vec![PortInfo { channels: 1 }],  // audio output
    ModuleType::SnesOsc => vec![PortInfo { channels: 1 }],  // audio output
    ModuleType::AudioIn => vec![PortInfo { channels: 1 }],
    ModuleType::Vocoder => vec![PortInfo { channels: 1 }],
    ModuleType::Control => vec![
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
      PortInfo { channels: 1 },
    ],
    ModuleType::Scope => vec![PortInfo { channels: 2 }, PortInfo { channels: 2 }],
    ModuleType::Mario => {
      let mut outputs = Vec::new();
      for _ in 0..5 {
        outputs.push(PortInfo { channels: 1 });
        outputs.push(PortInfo { channels: 1 });
      }
      outputs
    }
    ModuleType::Arpeggiator => vec![
      PortInfo { channels: 1 },  // cv-out
      PortInfo { channels: 1 },  // gate-out
      PortInfo { channels: 1 },  // accent
    ],
    ModuleType::StepSequencer => vec![
      PortInfo { channels: 1 },  // cv-out
      PortInfo { channels: 1 },  // gate-out
      PortInfo { channels: 1 },  // velocity-out
      PortInfo { channels: 1 },  // step-out
    ],
    ModuleType::Tb303 => vec![
      PortInfo { channels: 1 },  // out
      PortInfo { channels: 1 },  // env-out
    ],
    // TR-909 Drums - all have single audio output
    ModuleType::Kick909 | ModuleType::Snare909 | ModuleType::HiHat909 |
    ModuleType::Clap909 | ModuleType::Tom909 | ModuleType::Rimshot909 => vec![
      PortInfo { channels: 1 },  // out
    ],
    // TR-808 Drums - all have single audio output
    ModuleType::Kick808 | ModuleType::Snare808 | ModuleType::HiHat808
    | ModuleType::Cowbell808 | ModuleType::Clap808 | ModuleType::Tom808 => vec![
      PortInfo { channels: 1 },  // out
    ],
    // Drum Sequencer - 17 outputs (8 gates + 8 accents + step)
    ModuleType::DrumSequencer => vec![
      PortInfo { channels: 1 },  // gate-kick
      PortInfo { channels: 1 },  // gate-snare
      PortInfo { channels: 1 },  // gate-hhc
      PortInfo { channels: 1 },  // gate-hho
      PortInfo { channels: 1 },  // gate-clap
      PortInfo { channels: 1 },  // gate-tom
      PortInfo { channels: 1 },  // gate-rim
      PortInfo { channels: 1 },  // gate-aux
      PortInfo { channels: 1 },  // acc-kick
      PortInfo { channels: 1 },  // acc-snare
      PortInfo { channels: 1 },  // acc-hhc
      PortInfo { channels: 1 },  // acc-hho
      PortInfo { channels: 1 },  // acc-clap
      PortInfo { channels: 1 },  // acc-tom
      PortInfo { channels: 1 },  // acc-rim
      PortInfo { channels: 1 },  // acc-aux
      PortInfo { channels: 1 },  // step-out
    ],
    // Pitch Shifter - 1 output
    ModuleType::PitchShifter => vec![PortInfo { channels: 1 }],
    // Euclidean Sequencer - 2 outputs (gate, step)
    ModuleType::Euclidean => vec![
      PortInfo { channels: 1 },  // gate out
      PortInfo { channels: 1 },  // step out
    ],
    // FM Operator - 1 output (audio)
    ModuleType::FmOp => vec![
      PortInfo { channels: 1 },  // audio out
    ],
    // FM Matrix - 2 outputs (audio stereo, mod-out)
    ModuleType::FmMatrix => vec![
      PortInfo { channels: 2 },  // stereo audio out
      PortInfo { channels: 1 },  // envelope out (mod)
    ],
    // Notes - no outputs (UI only)
    ModuleType::Notes => vec![],
    // Clock - 4 outputs (clock, reset, run, bar)
    ModuleType::Clock => vec![
      PortInfo { channels: 1 },  // clock pulse
      PortInfo { channels: 1 },  // reset pulse
      PortInfo { channels: 1 },  // run gate
      PortInfo { channels: 1 },  // bar pulse
    ],
    // Shepard tone generator - 1 stereo output
    ModuleType::Shepard => vec![
      PortInfo { channels: 2 },  // stereo audio out
    ],
    // Pipe Organ - 1 mono output
    ModuleType::PipeOrgan => vec![
      PortInfo { channels: 1 },  // audio out
    ],
    // Spectral Swarm - 1 stereo output
    ModuleType::SpectralSwarm => vec![
      PortInfo { channels: 2 },  // stereo audio out
    ],
    // Resonator - 1 mono output
    ModuleType::Resonator => vec![
      PortInfo { channels: 1 },  // audio out
    ],
    // Wavetable - 1 mono output
    ModuleType::Wavetable => vec![
      PortInfo { channels: 1 },  // audio out
    ],
    // MIDI File Sequencer - 25 outputs (8 CV + 8 Gate + 8 Velocity + 1 Tick)
    ModuleType::MidiFileSequencer => vec![
      PortInfo { channels: 1 },  // cv-1
      PortInfo { channels: 1 },  // cv-2
      PortInfo { channels: 1 },  // cv-3
      PortInfo { channels: 1 },  // cv-4
      PortInfo { channels: 1 },  // cv-5
      PortInfo { channels: 1 },  // cv-6
      PortInfo { channels: 1 },  // cv-7
      PortInfo { channels: 1 },  // cv-8
      PortInfo { channels: 1 },  // gate-1
      PortInfo { channels: 1 },  // gate-2
      PortInfo { channels: 1 },  // gate-3
      PortInfo { channels: 1 },  // gate-4
      PortInfo { channels: 1 },  // gate-5
      PortInfo { channels: 1 },  // gate-6
      PortInfo { channels: 1 },  // gate-7
      PortInfo { channels: 1 },  // gate-8
      PortInfo { channels: 1 },  // vel-1
      PortInfo { channels: 1 },  // vel-2
      PortInfo { channels: 1 },  // vel-3
      PortInfo { channels: 1 },  // vel-4
      PortInfo { channels: 1 },  // vel-5
      PortInfo { channels: 1 },  // vel-6
      PortInfo { channels: 1 },  // vel-7
      PortInfo { channels: 1 },  // vel-8
      PortInfo { channels: 1 },  // tick-out
    ],
    // Chaos - 4 outputs (x, y, z, gate)
    ModuleType::Chaos => vec![
      PortInfo { channels: 1 },  // x
      PortInfo { channels: 1 },  // y
      PortInfo { channels: 1 },  // z
      PortInfo { channels: 1 },  // gate
    ],
    // Turing Machine - 3 outputs (cv, gate, pulse)
    ModuleType::TuringMachine => vec![
      PortInfo { channels: 1 },  // cv
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // pulse
    ],
    // Granular - 1 stereo output
    ModuleType::Granular => vec![
      PortInfo { channels: 2 },  // stereo out
    ],
    // SidPlayer - 1 stereo output + 3 gates + 3 CVs + 3 waveform CVs
    ModuleType::SidPlayer => vec![
      PortInfo { channels: 2 },  // stereo audio out
      PortInfo { channels: 1 },  // gate-1
      PortInfo { channels: 1 },  // gate-2
      PortInfo { channels: 1 },  // gate-3
      PortInfo { channels: 1 },  // cv-1
      PortInfo { channels: 1 },  // cv-2
      PortInfo { channels: 1 },  // cv-3
      PortInfo { channels: 1 },  // wf-1
      PortInfo { channels: 1 },  // wf-2
      PortInfo { channels: 1 },  // wf-3
    ],
    // AyPlayer - 1 stereo output + 3 gates + 3 CVs
    ModuleType::AyPlayer => vec![
      PortInfo { channels: 2 },  // stereo audio out
      PortInfo { channels: 1 },  // gate-a
      PortInfo { channels: 1 },  // gate-b
      PortInfo { channels: 1 },  // gate-c
      PortInfo { channels: 1 },  // cv-a
      PortInfo { channels: 1 },  // cv-b
      PortInfo { channels: 1 },  // cv-c
    ],
  }
}

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
    ModuleType::Quantizer => match port_id {
      "in" => Some(0),
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
    ModuleType::Distortion => match port_id {
      "in" => Some(0),
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
    ModuleType::Tb303 => match port_id {
      "pitch" => Some(0),
      "gate" => Some(1),
      "velocity" | "vel" => Some(2),
      "cutoff-cv" | "cut" => Some(3),
      _ => None,
    },
    // TR-909 Drums
    ModuleType::Kick909 | ModuleType::Snare909 | ModuleType::HiHat909 |
    ModuleType::Clap909 | ModuleType::Tom909 | ModuleType::Rimshot909 => match port_id {
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
    ModuleType::DrumSequencer => match port_id {
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
    // Granular - 4 inputs
    ModuleType::Granular => match port_id {
      "in" | "audio" | "audio-in" => Some(0),
      "trigger" | "trig" => Some(1),
      "position" | "pos-cv" => Some(2),
      "pitch" | "pitch-cv" => Some(3),
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
    _ => None,
  }
}

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
    ModuleType::Distortion => match port_id {
      "out" => Some(0),
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
    ModuleType::Tb303 => match port_id {
      "out" => Some(0),
      "env-out" => Some(1),
      _ => None,
    },
    // TR-909 Drums
    ModuleType::Kick909 | ModuleType::Snare909 | ModuleType::HiHat909 |
    ModuleType::Clap909 | ModuleType::Tom909 | ModuleType::Rimshot909 => match port_id {
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
    // Granular - 1 stereo output
    ModuleType::Granular => match port_id {
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
  }
}
