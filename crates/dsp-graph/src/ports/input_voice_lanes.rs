//! `input_voice_lanes()`

use crate::types::*;

/// Whether a mono CV/gate input of a NON-poly module accepts voice lanes: when a poly source is
/// patched into it, the engine widens the input to one channel per voice (lane 0 = voice 0).
/// Opt-in per port, because many modules treat a multi-channel input as stereo (or downmix it),
/// so widening every mono input would change what they receive.
pub fn input_voice_lanes(module_type: ModuleType, port_index: usize) -> bool {
  match module_type {
    // gate, pitch, velocity: each voice lane strikes the shared shell independently (chords)
    ModuleType::Handpan => port_index <= 2,
    _ => false,
  }
}
