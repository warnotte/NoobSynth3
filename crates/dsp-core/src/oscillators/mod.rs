//! Oscillator modules for audio synthesis.
//!
//! This module contains various oscillator implementations:
//!
//! - [`Vco`] - Main VCO with multiple waveforms, unison, FM, sync
//! - [`Supersaw`] - 7-voice detuned sawtooth (JP-8000 style)
//! - [`Noise`] - White, pink, and brown noise generator
//! - [`SineOsc`] - Simple sine oscillator (implements Node trait)
//! - [`NesOsc`] - NES 2A03 APU emulation
//! - [`SnesOsc`] - SNES S-DSP wavetable emulation
//! - [`Tb303`] - Roland TB-303 bass synthesizer emulation
//! - [`KarplusStrong`] - Physical modeling string synthesis
//! - [`FmOperator`] - FM synthesis operator with ADSR envelope
//! - [`Shepard`] - Shepard tone generator (endless rising/falling pitch illusion)
//! - [`PipeOrgan`] - Pipe organ emulation with drawbars and voicings
//! - [`SpectralSwarm`] - Additive drone synthesizer with evolving harmonics
//! - [`Resonator`] - Sympathetic resonance module (Rings-style)
//! - [`Wavetable`] - Wavetable oscillator with morphing
//! - [`Granular`] - Sample-based granular synthesizer
//! - [`FmMatrix`] - 4-operator FM synthesizer (DX7 style)

mod vco;
mod supersaw;
mod noise;
mod sine_osc;
mod nes_osc;
mod snes_osc;
mod tb303;
mod karplus;
mod fm_op;
mod fm_matrix;
mod shepard;
mod pipe_organ;
mod spectral_swarm;
mod resonator;
mod wavetable;
mod granular;
mod particle_cloud;

pub use vco::{Vco, VcoParams, VcoInputs};
pub use supersaw::{Supersaw, SupersawParams, SupersawInputs};
pub use noise::{Noise, NoiseParams};
pub use sine_osc::SineOsc;
pub use nes_osc::{NesOsc, NesOscParams, NesOscInputs};
pub use snes_osc::{SnesOsc, SnesOscParams, SnesOscInputs};
pub use tb303::{Tb303, Tb303Params, Tb303Inputs, Tb303Outputs};
pub use karplus::{KarplusStrong, KarplusParams, KarplusInputs};
pub use fm_op::{FmOperator, FmOperatorParams, FmOperatorInputs};
pub use fm_matrix::{FmMatrix, FmMatrixParams, OpParams};
pub use shepard::{Shepard, ShepardParams, ShepardInputs};
pub use pipe_organ::{PipeOrgan, PipeOrganParams, PipeOrganInputs, OrganVoicing, ORGAN_DRAWBARS, DRAWBAR_NAMES};
pub use spectral_swarm::{SpectralSwarm, SpectralSwarmParams, SpectralSwarmInputs};
pub use resonator::{Resonator, ResonatorParams, ResonatorInputs};
pub use wavetable::{Wavetable, WavetableParams, WavetableInputs};
pub use granular::{Granular, GranularParams, GranularInputs, GrainShape};
pub use particle_cloud::{ParticleCloud, ParticleCloudParams, ParticleCloudInputs, ParticleMode, OscShape};
