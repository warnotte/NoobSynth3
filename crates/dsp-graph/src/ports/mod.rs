//! Port definitions for all module types.
//!
//! This module defines the input and output ports for each module type,
//! as well as mapping port IDs to indices.

mod input_ports;
mod output_ports;
mod input_port_index;
mod output_port_index;

pub use input_ports::*;
pub use output_ports::*;
pub use input_port_index::*;
pub use output_port_index::*;
