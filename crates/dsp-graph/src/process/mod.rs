//! Module processing, dispatched to per-category submodules.

use crate::buffer::Buffer;
use crate::state::ModuleState;
use crate::types::{ConnectionEdge, TransportContext};

mod oscillators;
mod filters;
mod amplifiers;
mod modulators;
mod effects;
mod sequencers;
mod drums;
mod io;

/// Static zero buffer for default input values.
/// Size 4096 to handle WASAPI and other backends with large buffer sizes.
pub(crate) const ZERO_BUFFER: [f32; 4096] = [0.0; 4096];

/// Process a module's audio given its state and connections.
///
/// Dispatches to the per-category processor that handles this module state.
pub(crate) fn process_module(
    state: &mut ModuleState,
    connections: &[Vec<ConnectionEdge>],
    inputs: &[Buffer],
    outputs: &mut [Buffer],
    frames: usize,
    transport: TransportContext,
) {
    if oscillators::process(state, connections, inputs, outputs, frames, transport) {
        return;
    }
    if filters::process(state, connections, inputs, outputs, frames, transport) {
        return;
    }
    if amplifiers::process(state, connections, inputs, outputs, frames, transport) {
        return;
    }
    if modulators::process(state, connections, inputs, outputs, frames, transport) {
        return;
    }
    if effects::process(state, connections, inputs, outputs, frames, transport) {
        return;
    }
    if sequencers::process(state, connections, inputs, outputs, frames, transport) {
        return;
    }
    if drums::process(state, connections, inputs, outputs, frames, transport) {
        return;
    }
    if io::process(state, connections, inputs, outputs, frames, transport) {
        return;
    }
    unreachable!("unhandled module state");
}
