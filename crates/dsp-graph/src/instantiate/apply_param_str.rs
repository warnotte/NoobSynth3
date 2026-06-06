//! `apply_param_str()`

use crate::state::*;

/// Parse the `drum-machine-909` patternData JSON and program the internal sequencer.
///
/// Format: `{ "length": 16, "pattern": 0, "banks": [ A, B, FILL ] }`
/// where each bank is an array of 11 voice arrays (lane order bd..rd), and each voice is an
/// array of up to 64 step velocities: 0 = off, 1..127 = on with that MIDI velocity.
pub(crate) fn parse_pattern_data(seq: &mut dsp_core::Seq909, json: &str) {
    let v: serde_json::Value = match serde_json::from_str(json) {
        Ok(v) => v,
        Err(_) => return,
    };
    if let Some(len) = v.get("length").and_then(|x| x.as_u64()) {
        seq.set_length(len as usize);
    }
    if let Some(p) = v.get("pattern").and_then(|x| x.as_u64()) {
        seq.set_running_pattern(p as usize);
    }
    if let Some(banks) = v.get("banks").and_then(|x| x.as_array()) {
        for (b, bank) in banks.iter().enumerate().take(dsp_core::DM_BANKS) {
            seq.clear_bank(b);
            if let Some(voices) = bank.as_array() {
                for (vi, voice) in voices.iter().enumerate().take(dsp_core::DM_VOICES) {
                    if let Some(steps) = voice.as_array() {
                        for (si, step) in steps.iter().enumerate().take(dsp_core::DM_MAX_STEPS) {
                            let vel = step.as_u64().unwrap_or(0) as u8;
                            if vel > 0 {
                                seq.set_step(b, vi, si, true, vel.min(127));
                            }
                        }
                    }
                }
            }
        }
    }
}

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
    ModuleState::DrumMachine909(state) => {
      if param == "patternData" {
        parse_pattern_data(&mut state.seq, value);
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
