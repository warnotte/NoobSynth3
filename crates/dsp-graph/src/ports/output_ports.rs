//! `output_ports()`

use crate::types::*;

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
    ModuleType::EnvelopeFollower => vec![PortInfo { channels: 1 }],
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
    ModuleType::Distortion
    | ModuleType::Wah
    | ModuleType::TubeAmp => vec![PortInfo { channels: 1 }],
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
    ModuleType::Meter => vec![],
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
    // Chord Sequencer - 10 outputs (4×CV + 4×Gate + step + root-cv)
    ModuleType::ChordSequencer => vec![
      PortInfo { channels: 1 },  // cv-1
      PortInfo { channels: 1 },  // gate-1
      PortInfo { channels: 1 },  // cv-2
      PortInfo { channels: 1 },  // gate-2
      PortInfo { channels: 1 },  // cv-3
      PortInfo { channels: 1 },  // gate-3
      PortInfo { channels: 1 },  // cv-4
      PortInfo { channels: 1 },  // gate-4
      PortInfo { channels: 1 },  // step-out
      PortInfo { channels: 1 },  // root-cv
    ],
    // Polyrhythm Sequencer - 9 outputs (4×CV + 4×Gate + step)
    ModuleType::PolyrhythmSequencer => vec![
      PortInfo { channels: 1 },  // cv-1
      PortInfo { channels: 1 },  // gate-1
      PortInfo { channels: 1 },  // cv-2
      PortInfo { channels: 1 },  // gate-2
      PortInfo { channels: 1 },  // cv-3
      PortInfo { channels: 1 },  // gate-3
      PortInfo { channels: 1 },  // cv-4
      PortInfo { channels: 1 },  // gate-4
      PortInfo { channels: 1 },  // step-out
    ],
    // Clock Divider - 4 outputs (/2, /4, /8, /16)
    ModuleType::ClockDivider => vec![
      PortInfo { channels: 1 },  // div-2
      PortInfo { channels: 1 },  // div-4
      PortInfo { channels: 1 },  // div-8
      PortInfo { channels: 1 },  // div-16
    ],
    ModuleType::Tb303 => vec![
      PortInfo { channels: 1 },  // out
      PortInfo { channels: 1 },  // env-out
    ],
    // TR-909 Drum Machine - 14 outputs (stereo mix + 11 per-voice + step)
    ModuleType::DrumMachine909 => vec![
      PortInfo { channels: 1 },  // mix-l
      PortInfo { channels: 1 },  // mix-r
      PortInfo { channels: 1 },  // out-bd
      PortInfo { channels: 1 },  // out-sd
      PortInfo { channels: 1 },  // out-lt
      PortInfo { channels: 1 },  // out-mt
      PortInfo { channels: 1 },  // out-ht
      PortInfo { channels: 1 },  // out-rs
      PortInfo { channels: 1 },  // out-cp
      PortInfo { channels: 1 },  // out-ch
      PortInfo { channels: 1 },  // out-oh
      PortInfo { channels: 1 },  // out-cr
      PortInfo { channels: 1 },  // out-rd
      PortInfo { channels: 1 },  // step-out
    ],
    // TR-909 Drums - all have single audio output
    ModuleType::Kick909 | ModuleType::Snare909 | ModuleType::HiHat909 |
    ModuleType::Clap909 | ModuleType::Tom909 | ModuleType::Rimshot909 |
    ModuleType::Crash909 | ModuleType::Ride909 => vec![
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
    // Game of Life - 4 outputs (cv, gate, pulse, density)
    ModuleType::GameOfLife => vec![
      PortInfo { channels: 1 },  // cv
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // pulse
      PortInfo { channels: 1 },  // density
    ],
    // Gravity Sequencer - 5 outputs (cv, gate, pulse, x, y)
    ModuleType::GravitySequencer => vec![
      PortInfo { channels: 1 },  // cv
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // pulse
      PortInfo { channels: 1 },  // x
      PortInfo { channels: 1 },  // y
    ],
    // Granular - 1 stereo output
    ModuleType::Granular => vec![
      PortInfo { channels: 2 },  // stereo out
    ],
    // ParticleCloud - 1 stereo output
    ModuleType::ParticleCloud => vec![
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
    // Compressor - 1 stereo output
    ModuleType::Compressor => vec![
      PortInfo { channels: 2 },  // stereo audio out
    ],
    // BitCrusher - 1 stereo output
    ModuleType::BitCrusher => vec![
      PortInfo { channels: 2 },  // stereo audio out
    ],
    // Flanger - 1 stereo output
    ModuleType::Flanger => vec![
      PortInfo { channels: 2 },  // stereo audio out
    ],
    // FreqShifter - 1 stereo output
    ModuleType::FreqShifter => vec![
      PortInfo { channels: 2 },  // stereo audio out
    ],
    // Eq3 - 1 stereo output
    ModuleType::Eq3 => vec![
      PortInfo { channels: 2 },  // stereo audio out
    ],
    // Glitch - 1 stereo output
    ModuleType::Glitch => vec![
      PortInfo { channels: 2 },  // stereo audio out
    ],
    // Leslie - 1 stereo output
    ModuleType::Leslie => vec![
      PortInfo { channels: 2 },
    ],
    // SpeechSynth - 1 mono output
    ModuleType::SpeechSynth => vec![
      PortInfo { channels: 1 },  // audio out
    ],
    // Theremin - stereo audio + pitch/gate/volume CV outs
    ModuleType::Theremin => vec![
      PortInfo { channels: 2 },  // audio out (stereo)
      PortInfo { channels: 1 },  // pitch CV
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // volume CV
    ],
    // Send - 1 stereo output
    ModuleType::Send => vec![
      PortInfo { channels: 2 },  // audio out (stereo)
    ],
    // Receive - 1 stereo output
    ModuleType::Receive => vec![
      PortInfo { channels: 2 },  // audio out (stereo)
    ],
  }
}
