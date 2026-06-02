//! `apply_param_str()`

use crate::state::*;

/// Apply a string parameter to a module state (for sequencer data).
pub(crate) fn apply_param_str(state: &mut ModuleState, param: &str, value: &str) {
  match state {
    ModuleState::StepSequencer(state) => {
      if param == "stepData" {
        state.seq.parse_step_data(value);
      }
    }
    ModuleState::DrumSequencer(state) => {
      if param == "drumData" {
        state.seq.parse_drum_data(value);
      }
    }
    ModuleState::MidiFileSequencer(state) => {
      if param == "midiData" {
        state.seq.parse_midi_data(value);
      }
    }
    ModuleState::SpeechSynth(state) => {
      if param == "speechText" {
        state.synth.set_text(value);
      }
    }
    ModuleState::ChordSequencer(state) => {
      if param == "stepData" {
        state.seq.parse_step_data(value);
      }
    }
    ModuleState::PolyrhythmSequencer(state) => {
      if param == "stepData" {
        state.seq.parse_step_data(value);
      }
    }
    ModuleState::GameOfLife(state) => {
      if param == "cellData" {
        state.gol.set_cell_data(value);
      }
    }
    _ => {}
  }
}
