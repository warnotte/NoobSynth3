//! Recorder cv/gate — SONG mode phase 3.
//!
//! Capture la sortie cv/gate d'un séquenceur génératif (arpeggiator,
//! turing-machine, gravity-sequencer…) vers des événements de notes datés en
//! beats du transport. Armé, il attend la prochaine frontière de mesure (4/4,
//! comme tout le front-end SONG), enregistre N mesures, puis s'auto-stoppe.
//!
//! Conversion : note = round(CV × 12) + 69 (convention midi-file-sequencer,
//! A4 = 0 V) — le clip relu par le MIDI seq sonne à la hauteur enregistrée.

/// Seuil de détection de front sur le signal de gate (gates nominaux 0/1).
const GATE_THRESHOLD: f32 = 0.5;
/// Le front-end SONG assume du 4/4 (TransportConsole, useSongPlayer).
const BEATS_PER_BAR: f64 = 4.0;
/// Durée minimale d'une note capturée (évite les événements de largeur nulle).
const MIN_DUR_BEATS: f64 = 1.0 / 32.0;

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum RecPhase {
  Armed,
  Recording,
  Done,
}

pub(crate) struct NoteEvent {
  /// Offset en beats depuis le début de l'enregistrement (>= 0).
  pub beat: f64,
  pub note: i32,
  /// Vélocité MIDI 1..127 (100 si le module n'a pas de sortie vélocité).
  pub vel: i32,
  pub dur: f64,
}

struct OpenNote {
  beat: f64,
  note: i32,
  vel: i32,
}

pub(crate) struct CvRecorder {
  pub module_id: String,
  pub cv_port: String,
  pub gate_port: String,
  pub vel_port: Option<String>,
  pub phase: RecPhase,
  pub start_beat: f64,
  pub end_beat: f64,
  prev_gate: f32,
  open: Option<OpenNote>,
  events: Vec<NoteEvent>,
}

impl CvRecorder {
  pub fn new(
    module_id: String,
    cv_port: String,
    gate_port: String,
    vel_port: Option<String>,
    bars: u32,
    transport_beats: f64,
  ) -> Self {
    // Départ à la prochaine frontière de mesure (ou celle-ci si pile dessus).
    let start_beat = (transport_beats / BEATS_PER_BAR).ceil() * BEATS_PER_BAR;
    let end_beat = start_beat + bars.max(1) as f64 * BEATS_PER_BAR;
    Self {
      module_id,
      cv_port,
      gate_port,
      vel_port,
      phase: RecPhase::Armed,
      start_beat,
      end_beat,
      prev_gate: 0.0,
      open: None,
      events: Vec::new(),
    }
  }

  /// Scanne un bloc de sortie cv/gate(/vel). `block_beats` = beats au sample 0.
  pub fn scan(
    &mut self,
    cv: &[f32],
    gate: &[f32],
    vel: Option<&[f32]>,
    frames: usize,
    block_beats: f64,
    beats_per_sample: f64,
  ) {
    let len = frames.min(cv.len()).min(gate.len());
    for i in 0..len {
      let beat = block_beats + i as f64 * beats_per_sample;
      if self.phase == RecPhase::Armed {
        if beat + 1e-9 < self.start_beat {
          continue;
        }
        self.phase = RecPhase::Recording;
        self.prev_gate = 0.0; // un gate déjà haut à l'entrée compte comme un front
      }
      if beat >= self.end_beat {
        self.finalize(self.end_beat);
        return;
      }
      let g = gate[i];
      if g >= GATE_THRESHOLD && self.prev_gate < GATE_THRESHOLD {
        let note = ((f64::from(cv[i]) * 12.0).round() as i32 + 69).clamp(0, 127);
        let v = vel
          .and_then(|b| b.get(i))
          .map(|&s| ((s * 127.0).round() as i32).clamp(1, 127))
          .unwrap_or(100);
        // Sécurité : si un front descendant a été manqué (seek), clore d'abord.
        self.close_open(beat - self.start_beat);
        self.open = Some(OpenNote { beat: beat - self.start_beat, note, vel: v });
      } else if g < GATE_THRESHOLD && self.prev_gate >= GATE_THRESHOLD {
        self.close_open(beat - self.start_beat);
      }
      self.prev_gate = g;
    }
  }

  fn close_open(&mut self, end_offset: f64) {
    if let Some(open) = self.open.take() {
      let dur = (end_offset - open.beat).max(MIN_DUR_BEATS);
      self.events.push(NoteEvent { beat: open.beat, note: open.note, vel: open.vel, dur });
    }
  }

  /// Clôt la note en cours et termine l'enregistrement (fin naturelle ou stop
  /// anticipé). Sans effet si déjà Done.
  pub fn finalize(&mut self, at_beat: f64) {
    if self.phase == RecPhase::Done {
      return;
    }
    let end_offset = (at_beat - self.start_beat).clamp(0.0, self.end_beat - self.start_beat);
    self.close_open(end_offset);
    self.phase = RecPhase::Done;
  }

  pub fn take_events(&mut self) -> Vec<NoteEvent> {
    std::mem::take(&mut self.events)
  }

  pub fn event_count(&self) -> usize {
    self.events.len()
  }

  /// Beats enregistrés jusqu'ici (0 tant qu'armé, la durée totale une fois Done).
  pub fn beats_done(&self, transport_beats: f64) -> f64 {
    let total = self.end_beat - self.start_beat;
    match self.phase {
      RecPhase::Armed => 0.0,
      RecPhase::Recording => (transport_beats - self.start_beat).clamp(0.0, total),
      RecPhase::Done => total,
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  /// Simule des blocs de 128 samples à 2 beats/s (120 BPM, sr fictif 64 Hz
  /// pour des blocs = 4 beats — valeurs commodes, la logique est en beats).
  fn run_blocks(rec: &mut CvRecorder, cv: &[f32], gate: &[f32], start_beats: f64, bps: f64) {
    rec.scan(cv, gate, None, cv.len(), start_beats, bps);
  }

  #[test]
  fn waits_for_bar_boundary_then_records_notes() {
    // Armé à beat 1.0 → départ à beat 4.0, 1 mesure → fin à 8.0.
    let mut rec = CvRecorder::new("m".into(), "cv-out".into(), "gate-out".into(), None, 1, 1.0);
    assert_eq!(rec.start_beat, 4.0);
    assert_eq!(rec.end_beat, 8.0);

    // Bloc de 8 samples couvrant beats 3.0..7.0 (0.5 beat/sample) :
    // gate haut sur les samples 4..6 (beats 5.0..6.0), CV = 0.25 (note 72).
    let cv = [0.25f32; 8];
    let gate = [1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0];
    run_blocks(&mut rec, &cv, &gate, 3.0, 0.5);
    assert!(matches!(rec.phase, RecPhase::Recording));
    assert_eq!(rec.event_count(), 1);
    let events = rec.take_events();
    assert_eq!(events[0].note, 72); // round(0.25×12)+69 = 3+69
    assert!((events[0].beat - 1.0).abs() < 1e-9); // beat 5.0 − start 4.0
    assert!((events[0].dur - 1.0).abs() < 1e-9); // 6.0 − 5.0
    assert_eq!(events[0].vel, 100);
  }

  #[test]
  fn auto_stops_at_end_and_closes_open_note() {
    let mut rec = CvRecorder::new("m".into(), "cv".into(), "gate".into(), None, 1, 0.0);
    // start 0.0, end 4.0. Gate monte à beat 3.0 et ne redescend jamais.
    let cv = [0.0f32; 10];
    let gate = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0];
    run_blocks(&mut rec, &cv, &gate, 0.0, 0.5); // beats 0.0..4.5 → coupe à 4.0
    assert!(matches!(rec.phase, RecPhase::Done));
    let events = rec.take_events();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].note, 69); // CV 0 = A4
    assert!((events[0].beat - 3.0).abs() < 1e-9);
    assert!((events[0].dur - 1.0).abs() < 1e-9); // clôturée à end_beat 4.0
  }

  #[test]
  fn finalize_early_keeps_partial_take() {
    let mut rec = CvRecorder::new("m".into(), "cv".into(), "gate".into(), None, 2, 0.0);
    let cv = [-0.5f32; 4]; // note 63
    let gate = [1.0f32, 0.0, 1.0, 1.0];
    run_blocks(&mut rec, &cv, &gate, 0.0, 0.25); // beats 0..1, note ouverte à 0.5
    rec.finalize(1.0); // stop anticipé à beat 1.0
    assert!(matches!(rec.phase, RecPhase::Done));
    let events = rec.take_events();
    assert_eq!(events.len(), 2);
    assert_eq!(events[0].note, 63);
    assert!((events[1].beat - 0.5).abs() < 1e-9);
    assert!((events[1].dur - 0.5).abs() < 1e-9); // clôturée au finalize(1.0)
  }
}
