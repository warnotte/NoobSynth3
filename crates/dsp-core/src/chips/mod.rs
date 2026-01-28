//! Retro sound chip emulators.
//!
//! This module provides emulations of classic sound chips:
//!
//! - [`Ay3_8910`] - General Instrument AY-3-8910 / Yamaha YM2149
//!   Used in: ZX Spectrum, Amstrad CPC, MSX, Atari ST

pub mod ay3_8910;

pub use ay3_8910::Ay3_8910;
