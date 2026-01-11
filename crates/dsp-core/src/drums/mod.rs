//! TR-909 Drum Synthesizers.
//!
//! This module provides analog-modeled drum synthesizers inspired by the
//! Roland TR-909 drum machine.
//!
//! ## Available Drums
//!
//! - [`Kick909`] - Bass drum with pitch envelope and click transient
//! - [`Snare909`] - Snare with tone oscillator and filtered noise
//! - [`HiHat909`] - Metallic hi-hat (open/closed)
//! - [`Clap909`] - Hand clap with multi-trigger envelope
//! - [`Tom909`] - Tom-tom with pitch envelope
//! - [`Rimshot909`] - Short metallic rimshot
//!
//! # Accent Latching
//!
//! All drums use accent latching: the accent CV value is captured at
//! the trigger moment and held for the duration of the sound. This
//! prevents glitches if the accent CV changes during playback.
//!
//! # Example
//!
//! ```ignore
//! use dsp_core::drums::{Kick909, Kick909Params, Kick909Inputs};
//!
//! let mut kick = Kick909::new(44100.0);
//! let mut output = [0.0f32; 128];
//!
//! kick.process_block(
//!     &mut output,
//!     Kick909Inputs { trigger: Some(&[1.0]), accent: None },
//!     Kick909Params {
//!         tune: &[55.0],
//!         attack: &[0.5],
//!         decay: &[0.5],
//!         drive: &[0.0],
//!     },
//! );
//! ```

pub mod kick;
pub mod snare;
pub mod hihat;
pub mod clap;
pub mod tom;
pub mod rimshot;

pub use kick::{Kick909, Kick909Params, Kick909Inputs};
pub use snare::{Snare909, Snare909Params, Snare909Inputs};
pub use hihat::{HiHat909, HiHat909Params, HiHat909Inputs};
pub use clap::{Clap909, Clap909Params, Clap909Inputs};
pub use tom::{Tom909, Tom909Params, Tom909Inputs};
pub use rimshot::{Rimshot909, Rimshot909Params, Rimshot909Inputs};
