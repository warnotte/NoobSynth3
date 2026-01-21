//! TR-808 and TR-909 Drum Synthesizers.
//!
//! This module provides analog-modeled drum synthesizers inspired by the
//! Roland TR-808 and TR-909 drum machines.
//!
//! ## TR-909 Drums
//!
//! - [`Kick909`] - Bass drum with pitch envelope and click transient
//! - [`Snare909`] - Snare with tone oscillator and filtered noise
//! - [`HiHat909`] - Metallic hi-hat (open/closed)
//! - [`Clap909`] - Hand clap with multi-trigger envelope
//! - [`Tom909`] - Tom-tom with pitch envelope
//! - [`Rimshot909`] - Short metallic rimshot
//!
//! ## TR-808 Drums
//!
//! - [`Kick808`] - Legendary deep kick with long decay ("boom")
//! - [`Snare808`] - Snappy snare with clear tonal component
//! - [`HiHat808`] - Thin metallic hi-hat
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
//! use dsp_core::drums::{Kick808, Kick808Params, Kick808Inputs};
//!
//! let mut kick = Kick808::new(44100.0);
//! let mut output = [0.0f32; 128];
//!
//! kick.process_block(
//!     &mut output,
//!     Kick808Inputs { trigger: Some(&[1.0]), accent: None },
//!     Kick808Params {
//!         tune: &[45.0],
//!         decay: &[1.5],
//!         tone: &[0.3],
//!         click: &[0.2],
//!     },
//! );
//! ```

// TR-909
pub mod kick;
pub mod snare;
pub mod hihat;
pub mod clap;
pub mod tom;
pub mod rimshot;

// TR-808
pub mod kick808;
pub mod snare808;
pub mod hihat808;
pub mod cowbell808;
pub mod clap808;
pub mod tom808;

// TR-909 exports
pub use kick::{Kick909, Kick909Params, Kick909Inputs};
pub use snare::{Snare909, Snare909Params, Snare909Inputs};
pub use hihat::{HiHat909, HiHat909Params, HiHat909Inputs};
pub use clap::{Clap909, Clap909Params, Clap909Inputs};
pub use tom::{Tom909, Tom909Params, Tom909Inputs};
pub use rimshot::{Rimshot909, Rimshot909Params, Rimshot909Inputs};

// TR-808 exports
pub use kick808::{Kick808, Kick808Params, Kick808Inputs};
pub use snare808::{Snare808, Snare808Params, Snare808Inputs};
pub use hihat808::{HiHat808, HiHat808Params, HiHat808Inputs};
pub use cowbell808::{Cowbell808, Cowbell808Params, Cowbell808Inputs};
pub use clap808::{Clap808, Clap808Params, Clap808Inputs};
pub use tom808::{Tom808, Tom808Params, Tom808Inputs};
