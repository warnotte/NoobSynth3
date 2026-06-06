//! `input_ports()`

use crate::types::*;

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
    ModuleType::EnvelopeFollower => vec![PortInfo { channels: 1 }],
    ModuleType::Quantizer => vec![PortInfo { channels: 1 }],
    ModuleType::RingMod => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::Gain => vec![PortInfo { channels: 2 }, PortInfo { channels: 1 }],
    ModuleType::CvVca => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }],
    ModuleType::Output => vec![PortInfo { channels: 2 }],
    ModuleType::Lab => vec![PortInfo { channels: 2 }, PortInfo { channels: 2 }],
    ModuleType::Lfo => vec![PortInfo { channels: 1 }, PortInfo { channels: 1 }, PortInfo { channels: 1 }],
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
    ModuleType::Distortion
    | ModuleType::Wah
    | ModuleType::TubeAmp => vec![PortInfo { channels: 1 }],
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
    ModuleType::Meter => vec![
      PortInfo { channels: 2 },  // stereo audio input
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
    // Chord Sequencer - 2 inputs (clock, reset)
    ModuleType::ChordSequencer => vec![
      PortInfo { channels: 1 },  // clock
      PortInfo { channels: 1 },  // reset
    ],
    // Polyrhythm Sequencer - 2 inputs (clock, reset)
    ModuleType::PolyrhythmSequencer => vec![
      PortInfo { channels: 1 },  // clock
      PortInfo { channels: 1 },  // reset
    ],
    // Clock Divider - 2 inputs (clock, reset)
    ModuleType::ClockDivider => vec![
      PortInfo { channels: 1 },  // clock
      PortInfo { channels: 1 },  // reset
    ],
    ModuleType::Tb303 => vec![
      PortInfo { channels: 1 },  // pitch
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // velocity
      PortInfo { channels: 1 },  // cutoff-cv
    ],
    // TR-909 Drums - all have trigger + accent inputs
    ModuleType::Kick909 | ModuleType::Snare909 | ModuleType::HiHat909 |
    ModuleType::Clap909 | ModuleType::Tom909 | ModuleType::Rimshot909 |
    ModuleType::Crash909 | ModuleType::Ride909 => vec![
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
    ModuleType::DrumSequencer | ModuleType::DrumMachine909 => vec![
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
    // Game of Life - 2 inputs (clock, reset)
    ModuleType::GameOfLife => vec![
      PortInfo { channels: 1 },  // clock
      PortInfo { channels: 1 },  // reset
    ],
    // Gravity Sequencer - 1 input (reset)
    ModuleType::GravitySequencer => vec![
      PortInfo { channels: 1 },  // reset
    ],
    // Granular - 4 inputs (audio, trigger, position CV, pitch CV)
    ModuleType::Granular => vec![
      PortInfo { channels: 1 },  // audio in (for recording)
      PortInfo { channels: 1 },  // trigger
      PortInfo { channels: 1 },  // position CV
      PortInfo { channels: 1 },  // pitch CV
    ],
    // ParticleCloud - 2 inputs (audio in for Input mode, trigger)
    ModuleType::ParticleCloud => vec![
      PortInfo { channels: 1 },  // audio in (for Input mode)
      PortInfo { channels: 1 },  // trigger
    ],
    // SidPlayer - 1 input (reset)
    ModuleType::SidPlayer => vec![
      PortInfo { channels: 1 },  // reset trigger
    ],
    // AyPlayer - 1 input (reset)
    ModuleType::AyPlayer => vec![
      PortInfo { channels: 1 },  // reset trigger
    ],
    // Compressor - 1 stereo input
    ModuleType::Compressor => vec![
      PortInfo { channels: 2 },  // audio in (stereo)
      PortInfo { channels: 2 },  // sidechain in (stereo)
    ],
    // BitCrusher - 1 stereo input
    ModuleType::BitCrusher => vec![
      PortInfo { channels: 2 },  // audio in (stereo)
    ],
    // Flanger - 1 stereo input
    ModuleType::Flanger => vec![
      PortInfo { channels: 2 },  // audio in (stereo)
    ],
    // FreqShifter - 1 stereo input
    ModuleType::FreqShifter => vec![
      PortInfo { channels: 2 },  // audio in (stereo)
    ],
    // Eq3 - 1 stereo input
    ModuleType::Eq3 => vec![
      PortInfo { channels: 2 },  // audio in (stereo)
    ],
    // Glitch - 1 stereo input + clock
    ModuleType::Glitch => vec![
      PortInfo { channels: 2 },  // audio in (stereo)
      PortInfo { channels: 1 },  // clock trigger
    ],
    // Leslie - 1 stereo input
    ModuleType::Leslie => vec![
      PortInfo { channels: 2 },
    ],
    // SpeechSynth - 3 inputs (pitch CV, gate, clock)
    ModuleType::SpeechSynth => vec![
      PortInfo { channels: 1 },  // pitch CV
      PortInfo { channels: 1 },  // gate
      PortInfo { channels: 1 },  // clock
    ],
    // Theremin - CV inputs (pitch, volume, gate) so it can be driven by
    // a sequencer / LFO / another theremin. The mouse overrides when touched.
    ModuleType::Theremin => vec![
      PortInfo { channels: 1 },  // pitch CV
      PortInfo { channels: 1 },  // volume CV
      PortInfo { channels: 1 },  // gate
    ],
    // Send - 1 stereo input
    ModuleType::Send => vec![
      PortInfo { channels: 2 },  // audio in (stereo)
    ],
    // Receive - 1 stereo input
    ModuleType::Receive => vec![
      PortInfo { channels: 2 },  // audio in (stereo)
    ],
  }
}
