//! Handpan — coupled-shell modal model, any scale (6 built-ins + free maker-notation scale).
//!
//! Every constant was measured with the spectrogram bench on three instruments (the user's
//! D Kurd video, the freesound GAMEDRIX974 isolated-note pack, the FreePats Hang), then fitted
//! metric by metric on an offline prototype that the user validated by ear before this port:
//!
//! - each note field rings at 1 : 2 : 3 (+ weak 4x / 6x), ratios within ±0.5 % — the maker tunes
//!   the octave and the "compound fifth" of every field (Morrison & Rossing 2007 report the same)
//! - the Ding is stretched (measured 144.2 / 292.0 / 437.5 Hz) so its octave and fifth ring with
//!   the ring notes above it; the same maker stretch is applied to the Ding of every scale
//! - T60 ≈ 3-4.5 s, almost pitch-independent; the Ding rings ~1.6x longer. The fundamental falls fast
//!   for ~0.4 s (amplitude-proportional loss) while the octave and fifth hold, so the tail turns into
//!   an octave + fifth chord (v2, measured on GAMEDRIX, ear-validated A/B against v1)
//! - a field struck hard starts ~8 cents sharp and settles as it decays
//! - each partial radiates from its own part of the shell: fundamental from the field, octave near
//!   the centre, fifth from the far side, with an inter-channel phase offset
//! - the octave and fifth BLOOM: they peak ~110 ms after the strike (-16 / -26 dB). Modelled as the
//!   shell's quadratic nonlinearity (fundamental² drives the octave, fundamental × octave drives the
//!   fifth — the steelpan literature's quadratic energy exchange); the slight mistuning of those
//!   modes against exactly 2f / 3f sets the bloom time
//! - every partial beats ~3 dB (split degenerate modes → detuned pair per partial)
//! - sympathetic halo ≈ -13 dB: the 1-2 fields just BELOW the struck note answer loudest (-17 dB),
//!   and coincident partials build up through a global linear shell coupling (the resonators pick
//!   out what is near their own frequency by themselves)
//! - an air cavity (Helmholtz / Gu) mode at 87.5 Hz on the user's instrument
//! - the finger-on-steel tick: noise centred ~3.3 kHz, ~25 ms to -20 dB, louder toward the treble;
//!   across the user's clip its level ranged ~24 dB with the player's touch → the `attack` control
//!
//! Every field lives in ONE instance (never poly-cloned): shared shell state is what makes the
//! sympathetic ringing real. Chords still work: the gate/pitch/velocity inputs carry up to
//! `HANDPAN_LANES` lanes (one per poly voice of the source), each striking independently.

use std::f32::consts::PI;

pub const HANDPAN_MAX_FIELDS: usize = 32;
const MAX_FIELDS: usize = HANDPAN_MAX_FIELDS;
/// Strike lanes on the gate / pitch / velocity inputs (one per voice of a poly source).
pub const HANDPAN_LANES: usize = 8;
const LANES: usize = HANDPAN_LANES;
const NUM_PARTIALS: usize = 5;

/// Built-in scales in maker notation: `Ding/(bottom notes) ring notes`. Only scales whose note
/// lists agree on at least two maker/retailer sources are included.
pub const HANDPAN_SCALES: [(&str, &str); 6] = [
  ("D Kurde 15", "D3/(F3 G3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5 D5 E5 F5"),
  ("D Kurde 9", "D3/ A3 Bb3 C4 D4 E4 F4 G4 A4"),
  ("D Celtic", "D3/ A3 C4 D4 E4 F4 G4 A4 C5"),
  ("D Integral", "D3/ A3 Bb3 C4 D4 E4 F4 A4 C5"),
  ("F Pygmy", "F3/ G3 Ab3 C4 Eb4 F4 G4 Ab4 C5"),
  ("C Aegean", "C3/ E3 G3 B3 C4 E4 F#4 G4 B4"),
];
/// `scale` value that selects the free scale given by `set_custom_notes`.
pub const HANDPAN_CUSTOM_SCALE: i32 = HANDPAN_SCALES.len() as i32;

const PARTIAL_RATIOS: [f32; NUM_PARTIALS] = [1.0, 2.0, 3.0, 4.0, 6.0];
/// Measured Ding partials 144.2 / 292.0 / 437.5 Hz: the octave and fifth sit on the note, the fundamental
/// ~21 c under it (they used to be applied the other way round, pushing octave and fifth 20 c sharp).
const DING_RATIOS: [f32; NUM_PARTIALS] = [144.2 * 2.0 / 292.0, 2.0, 437.5 * 2.0 / 292.0, 4.0, 6.0];
const RATIO_JITTER: f32 = 0.005;
/// Which draw of that measured spread this instrument gets: the bloom time follows each mode's
/// mistuning, and this draw reproduces the ear-validated prototype (median octave peak 110 ms).
const RATIO_SALT: u32 = 32;
const PITCH_JITTER_CENTS: f32 = 1.5;
const PARTIAL_T60_MUL: [f32; NUM_PARTIALS] = [0.85, 1.05, 1.2, 0.85, 0.8];
const DING_T60_MUL: f32 = 1.6;
/// The Ding's stretch (a fundamental ~21 c flat under an in-tune octave and fifth) and long ring come
/// from a large low dome: full up to ~D3, gone by G3.
/// A high lowest note of a free scale (e.g. a MIDI part) is a plain melodic field, so its octave
/// and fifth stay in tune with the fields above it.
const DING_STRETCH_FULL_HZ: f32 = 150.0;
const DING_STRETCH_NONE_HZ: f32 = 200.0;
/// Exemplar global tuning spread: several instruments playing together (doubled parts) beat audibly
/// beyond a few cents, so exemplars stay as close as a well-tuned set.
const EXEMPLAR_TUNE_CENTS: f32 = 2.0;
/// Register terms follow the measured range only (C3..A5 around C4): extrapolated further up they
/// made the top fields shrill.
const REGISTER_MIN_OCT: f32 = -1.0;
const REGISTER_MAX_OCT: f32 = 1.75;
/// Level injected directly by the strike (dB): the octave and fifth mostly grow through the bloom.
const DIRECT_DB: [f32; NUM_PARTIALS] = [0.0, -18.0, -26.0, -25.0, -28.0];
/// Per unit of `attack - 0.5`: a sharper touch injects more octave/fifth and upper partials
/// directly and a louder tick ([fund, oct, fifth, 4x, 6x], tick) in dB.
const ATTACK_PARTIAL_DB: [f32; NUM_PARTIALS] = [0.0, 12.0, 12.0, 16.0, 16.0];
const ATTACK_TICK_DB: f32 = 28.0;
const OCT_BLOOM_DB: f32 = -9.0;
const OCT_BLOOM_JITTER_DB: f32 = 4.0;
const FIFTH_BLOOM_DB: f32 = -10.0;
const FIFTH_BLOOM_JITTER_DB: f32 = 5.0;
/// Reference strike amplitude the bloom couplings are normalised for.
const A_REF: f32 = 0.9;
/// Twin-mode level range (fundamental / other partials) and split in Hz.
const TWIN_MIX_FUND: (f32, f32) = (0.2, 0.6);
const TWIN_MIX_OTHER: (f32, f32) = (0.1, 0.25);
const SPLIT_MAX_HZ: f32 = 1.5;
/// Sympathetic kicks by scale distance to the struck field: [-2, -1, +1, +2, farther] (dB).
const NEIGHBOR_DB: [f32; 5] = [-28.0, -19.0, -30.0, -36.0, -48.0];
const NEIGHBOR_JITTER_DB: f32 = 3.0;
/// Shell bus coupling: per-mode input gain capped so gain_at_resonance × input <= loop bound.
/// Two exactly coincident modes then have loop gain <= bound² < 1 — never self-oscillates.
const BUS_MAX: f32 = 1e-4;
const BUS_LOOP_MAX: f32 = 0.7;
const BUS_SAT: f32 = 10.0;
const CAVITY_HZ: f32 = 87.5;
const INSTRUMENT_SALT_STEP: u32 = 1009;
const CAVITY_T60: f32 = 3.0;
const CAVITY_KICK_DB: f32 = -25.0;
/// Extra fundamental loss proportional to the field's amplitude (dB/s at A_REF): the fundamental
/// falls fast for ~0.4 s then settles on its own T60 while the octave and fifth hold — the tail
/// turns into an octave + fifth chord, as measured.
const DRAIN_DB_S: f32 = 40.0;
/// Amplitude-dependent pitch (cents at A_REF): a field starts sharp and settles as it decays (steel hardens).
const GLIDE_CENTS: [f32; NUM_PARTIALS] = [8.0, 8.0, 6.0, 5.0, 5.0];
/// Drain and glide follow the amplitude every DYN_CHUNK samples.
const DYN_CHUNK: usize = 32;
/// Register terms are centred here so the scale as a whole keeps its level.
const REGISTER_REF_HZ: f32 = 262.0;
/// Per octave up: the octave blooms louder and the tick stands out more.
const OCT_REGISTER_DB: f32 = 4.0;
const TICK_REGISTER_DB: f32 = 4.0;
/// Finger-on-steel tick: band-passed noise (~3.4 kHz measured centroid, lower on low fields),
/// exponential decay (~25 ms to -20 dB).
const TICK_HZ: f32 = 2700.0;
const TICK_HZ_REGISTER_EXP: f32 = -0.18;
const TICK_Q: f32 = 0.9;
const TICK_TAU_MS: f32 = 13.0;
const TICK_LEVEL: f32 = 0.117;
/// A construction reshapes the whole instrument the way the steel, the shell and the note fields of
/// real handpans differ. Every field is an offset or a factor on the reference sound: construction 0
/// is identity (+0 dB, x1), so the ear-validated handpan renders bit for bit as before.
#[derive(Clone, Copy)]
struct Construction {
  /// decay time of every partial, and per partial [fund, octave, fifth, 4x, 6x]
  t60_mul: f32,
  partial_t60: [f32; NUM_PARTIALS],
  /// octave and fifth bloom level (dB)
  oct_db: f32,
  fifth_db: f32,
  /// 4x and 6x partials struck directly (dB): brightness of the note body
  upper_db: f32,
  /// fundamental's amplitude-dependent early loss
  drain_mul: f32,
  /// octave/fifth mistuning spread: smaller = later, slower bloom
  mistune_mul: f32,
  /// air cavity: level (dB), frequency as a ratio of the Ding (0 = keep), decay
  cavity_db: f32,
  cavity_ratio: f32,
  cavity_t60_mul: f32,
  /// finger tick: level (dB), length, colour
  tick_db: f32,
  tick_tau_mul: f32,
  tick_hz_mul: f32,
  /// sympathetic halo of the shell
  halo_mul: f32,
}

const CONSTRUCTIONS: [Construction; 4] = [
  // 0. Reference: the ear-validated D Kurde (stainless phone recording + GAMEDRIX + FreePats fit).
  Construction { t60_mul: 1.0, partial_t60: [1.0; NUM_PARTIALS], oct_db: 0.0, fifth_db: 0.0, upper_db: 0.0, drain_mul: 1.0, mistune_mul: 1.0, cavity_db: 0.0, cavity_ratio: 0.0, cavity_t60_mul: 1.0, tick_db: 0.0, tick_tau_mul: 1.0, tick_hz_mul: 1.0, halo_mul: 1.0 },
  // 1. Pure ("pur"), fitted on the median of FreePats Hang (PANArt, nitrided), Shellopan (nitrided) and
  //    Mudra (stainless): octave -7 dB and fifth -25 dB under the fundamental at 0.5 s, shorter ring,
  //    crisp ~3.7 kHz tick, brighter body, almost no cavity.
  Construction { t60_mul: 0.75, partial_t60: [1.0; NUM_PARTIALS], oct_db: 4.5, fifth_db: -11.0, upper_db: 6.0, drain_mul: 0.8, mistune_mul: 1.0, cavity_db: -30.0, cavity_ratio: 0.0, cavity_t60_mul: 1.0, tick_db: 0.0, tick_tau_mul: 1.05, tick_hz_mul: 1.35, halo_mul: 1.0 },
  // 2. Rich ("riche"), fitted on Yishama and GAMEDRIX: octave level with the fundamental, fifth -7 dB at
  //    0.5 s and still growing at 2 s, slower bloom, gentle early loss, long soft tick (~55 ms).
  Construction { t60_mul: 1.1, partial_t60: [1.0, 1.0, 1.4, 1.0, 1.0], oct_db: 15.0, fifth_db: 21.0, upper_db: 3.0, drain_mul: 0.15, mistune_mul: 0.6, cavity_db: -3.0, cavity_ratio: 0.0, cavity_t60_mul: 1.0, tick_db: -2.0, tick_tau_mul: 4.0, tick_hz_mul: 1.0, halo_mul: 1.2 },
  // 3. Large shell ("grande coque"), from Pantheon Halo Genesis vs Cirrus/Stratus and the PANArt Hang
  //    played upright: darker body, longer ring, a strong deep air cavity near half the Ding, more halo.
  Construction { t60_mul: 1.2, partial_t60: [1.1, 1.0, 1.0, 1.0, 1.0], oct_db: -1.0, fifth_db: 0.0, upper_db: -5.0, drain_mul: 1.0, mistune_mul: 1.0, cavity_db: 8.0, cavity_ratio: 0.53, cavity_t60_mul: 1.5, tick_db: -3.0, tick_tau_mul: 1.2, tick_hz_mul: 0.8, halo_mul: 1.3 },
];
pub const HANDPAN_CONSTRUCTIONS: usize = CONSTRUCTIONS.len();

/// Humanize at 1: strikes land up to this late and spread ±HUMAN_VEL_DB.
const HUMAN_DELAY_MS: f32 = 25.0;
const HUMAN_VEL_DB: f32 = 6.0;
const MAX_PENDING: usize = 16;
const MANUAL_VELOCITY: f32 = 0.85;
/// Manual strike encoding: `nonce * STRIKE_BASE + field`.
pub const HANDPAN_STRIKE_BASE: u32 = 64;
const SILENCE_PEAK: f32 = 1e-6;
const SILENCE_BLOCKS: u32 = 4;
const LN_1000: f32 = 6.907_755;

#[inline]
fn db(x: f32) -> f32 {
  10f32.powf(x / 20.0)
}

/// A scale laid out as note fields, sorted by pitch (engine field index = position here).
#[derive(Clone, Copy, PartialEq)]
pub struct HandpanLayout {
  pub notes: [u8; MAX_FIELDS],
  pub bottom: [bool; MAX_FIELDS],
  pub len: usize,
  pub ding: usize,
}

fn note_from_token(token: &str) -> Option<u8> {
  if let Ok(n) = token.parse::<i32>() {
    return (0..=127).contains(&n).then_some(n as u8);
  }
  let mut chars = token.chars();
  let letter = chars.next()?.to_ascii_uppercase();
  let base = match letter {
    'C' => 0,
    'D' => 2,
    'E' => 4,
    'F' => 5,
    'G' => 7,
    'A' => 9,
    'B' => 11,
    _ => return None,
  };
  let rest: String = chars.collect();
  let (accidental, octave_str) = match rest.chars().next() {
    Some('#') => (1, &rest[1..]),
    Some('b') => (-1, &rest[1..]),
    _ => (0, rest.as_str()),
  };
  let octave: i32 = octave_str.parse().ok()?;
  let midi = (octave + 1) * 12 + base + accidental;
  (0..=127).contains(&midi).then_some(midi as u8)
}

/// Parse maker notation, e.g. `D3/(F3 G3) A3 Bb3 C4` (MIDI numbers also accepted). The first note
/// is the Ding, notes inside parentheses are bottom notes. Duplicates are dropped, at most 32 fields.
pub fn parse_handpan_scale(text: &str) -> Option<HandpanLayout> {
  let mut entries: Vec<(u8, bool)> = Vec::new();
  let mut depth = 0i32;
  let mut ding: Option<u8> = None;
  let spaced = text.replace('(', " ( ").replace(')', " ) ").replace(['/', ','], " ");
  for token in spaced.split_whitespace() {
    match token {
      "(" => depth += 1,
      ")" => depth = (depth - 1).max(0),
      t => {
        let Some(n) = note_from_token(t) else { continue };
        if entries.iter().any(|(m, _)| *m == n) || entries.len() >= MAX_FIELDS {
          continue;
        }
        if ding.is_none() {
          ding = Some(n);
        }
        entries.push((n, depth > 0 && ding != Some(n)));
      }
    }
  }
  let ding = ding?;
  entries.sort_by_key(|(n, _)| *n);
  let mut layout = HandpanLayout { notes: [0; MAX_FIELDS], bottom: [false; MAX_FIELDS], len: entries.len(), ding: 0 };
  for (i, (n, b)) in entries.iter().enumerate() {
    layout.notes[i] = *n;
    layout.bottom[i] = *b;
    if *n == ding {
      layout.ding = i;
    }
  }
  Some(layout)
}

#[derive(Clone, Copy, Default)]
struct Mode {
  cos_w: f32,
  sin_w: f32,
  decay: f32,
  s1: f32,
  s2: f32,
  /// nominal tuning and damping (drain and glide move `decay` / `cos_w` / `sin_w` around these)
  w0: f32,
  decay0: f32,
}

impl Mode {
  #[inline]
  fn set(&mut self, freq: f32, t60: f32, sample_rate: f32) {
    let w = 2.0 * PI * freq / sample_rate;
    self.w0 = w;
    self.cos_w = w.cos();
    self.sin_w = w.sin();
    self.decay0 = (-LN_1000 / (t60.max(0.05) * sample_rate)).exp();
    self.decay = self.decay0;
  }

  #[inline]
  fn retune(&mut self, factor: f32) {
    let w = self.w0 * factor;
    self.cos_w = w.cos();
    self.sin_w = w.sin();
  }

  #[inline]
  fn w(&self) -> f32 {
    self.sin_w.atan2(self.cos_w)
  }

  /// |H(e^{jw})| of this exact recursion (input into s1, output s2): d·sin / |(z − d·cos)² + (d·sin)²|.
  fn gain_at(&self, w: f32) -> f32 {
    let zr = w.cos() - self.decay * self.cos_w;
    let zi = w.sin();
    let ds = self.decay * self.sin_w;
    let re = zr * zr - zi * zi + ds * ds;
    let im = 2.0 * zr * zi;
    (self.decay * self.sin_w.abs()) / (re * re + im * im).sqrt().max(1e-12)
  }

  /// Returns the output and its quadrature (the rotated state before this sample's excitation),
  /// so a partial can be radiated with a phase offset per channel.
  #[inline]
  fn tick(&mut self, exc: f32) -> (f32, f32) {
    let x = self.decay * (self.cos_w * self.s1 - self.sin_w * self.s2);
    let s2 = self.decay * (self.sin_w * self.s1 + self.cos_w * self.s2);
    self.s1 = x + exc;
    self.s2 = s2;
    (s2, x)
  }

  #[inline]
  fn clear(&mut self) {
    self.s1 = 0.0;
    self.s2 = 0.0;
  }
}

#[derive(Clone, Copy, Default)]
struct Field {
  modes_a: [Mode; NUM_PARTIALS],
  modes_b: [Mode; NUM_PARTIALS],
  twin_mix: [f32; NUM_PARTIALS],
  recv_a: [f32; NUM_PARTIALS],
  recv_b: [f32; NUM_PARTIALS],
  active: [bool; NUM_PARTIALS],
  /// quadratic bloom couplings (fundamental² → octave, fundamental × octave → fifth)
  k2: f32,
  k3: f32,
  f0: f32,
  midi: i32,
  /// field position (the tick radiates from here)
  pan_l: f32,
  pan_r: f32,
  /// per-partial radiation: output and quadrature gains per channel (level difference + phase)
  rad_l: [(f32, f32); NUM_PARTIALS],
  rad_r: [(f32, f32); NUM_PARTIALS],
  /// fundamental amplitude / A_REF the drain and glide were last set for (< 0 = stale)
  dyn_amp: f32,
  out: f32,
}

/// Topology-preserving state-variable band-pass, unity gain at the centre.
#[derive(Clone, Copy, Default)]
struct BandPass {
  a1: f32,
  a2: f32,
  a3: f32,
  k: f32,
  ic1: f32,
  ic2: f32,
}

impl BandPass {
  fn set(&mut self, hz: f32, q: f32, sample_rate: f32) {
    let g = (PI * hz.min(0.45 * sample_rate) / sample_rate).tan();
    self.k = 1.0 / q;
    self.a1 = 1.0 / (1.0 + g * (g + self.k));
    self.a2 = g * self.a1;
    self.a3 = g * self.a2;
  }

  #[inline]
  fn process(&mut self, v0: f32) -> f32 {
    let v3 = v0 - self.ic2;
    let v1 = self.a1 * self.ic1 + self.a2 * v3;
    let v2 = self.ic2 + self.a2 * self.ic1 + self.a3 * v3;
    self.ic1 = 2.0 * v1 - self.ic1;
    self.ic2 = 2.0 * v2 - self.ic2;
    self.k * v1
  }
}

#[derive(Clone, Copy, Default)]
struct PendingStrike {
  delay: u32,
  field: usize,
  vel: f32,
}

#[derive(Clone, Copy)]
pub struct HandpanParams {
  pub scale: i32,     // 0..HANDPAN_SCALES.len()-1 built-in, HANDPAN_CUSTOM_SCALE = free scale
  pub tune: f32,      // cents
  pub octave: i32,    // -1..1
  pub sustain: f32,   // T60 multiplier (0.25-2)
  pub bloom: f32,     // 0-1, 0.5 = measured octave/fifth bloom
  pub resonance: f32, // 0-1, 0.5 = measured shell halo
  pub cavity: f32,    // 0-1, 0.5 = measured air cavity
  pub attack: f32,    // 0-1, 0.5 = measured touch; 0 = soft pad, 1 = hard fingertip
  pub humanize: f32,  // 0-1 per-strike variation (velocity, strike position, tick)
  pub pitch_ref: i32, // pitch CV reference: 0 = C4 (step/chord/control), 1 = A4 (MIDI file seq)
  pub seed: i32,
  pub level: f32,
  pub pan: f32,       // -1..1 whole-instrument stereo placement (0 = centred shell layout)
  pub instrument: i32, // 0 = reference exemplar, 1..999 = other exemplars (tuning, cavity, T60, colour)
  pub construction: i32, // 0 = reference, 1 = pure (nitrided-like), 2 = rich, 3 = large shell
  /// Manual strike from the UI, encoded `nonce * HANDPAN_STRIKE_BASE + field`: a strike fires only
  /// when the value CHANGES, so reloading a patch that stored the last value never plays a phantom note.
  pub strike: f32,
}

pub struct HandpanInputs<'a> {
  pub gate: [Option<&'a [f32]>; LANES],
  pub pitch_cv: [Option<&'a [f32]>; LANES],
  pub vel_cv: [Option<&'a [f32]>; LANES],
}

impl Default for HandpanInputs<'_> {
  fn default() -> Self {
    Self { gate: [None; LANES], pitch_cv: [None; LANES], vel_cv: [None; LANES] }
  }
}

pub struct Handpan {
  sample_rate: f32,
  fields: [Field; MAX_FIELDS],
  layout: HandpanLayout,
  custom: Option<HandpanLayout>,
  custom_version: u32,
  cavity: Mode,
  cavity_recv: f32,
  cavity_pan_l: f32,
  cavity_pan_r: f32,
  salt: u32,
  tick_db: f32,
  cons: Construction,
  coef_key: (i32, u32, i32, i32, i32, i32, i32),
  bus_loop: f32,
  neighbor_gain: f32,

  tick_left: u32,
  tick_env: f32,
  tick_decay: f32,
  tick_amp: f32,
  tick_bp: [BandPass; 2],
  tick_pan_l: f32,
  tick_pan_r: f32,

  noise_state: u32,
  seed: i32,
  prev_gate: [f32; LANES],
  pending: [PendingStrike; MAX_PENDING],
  pending_len: usize,
  dyn_counter: usize,
  /// NaN until the first block has seen the stored `strike` value.
  last_manual_strike: f32,
  last_field: usize,
  strike_count: u32,
  silent: bool,
  silent_blocks: u32,
}

/// Deterministic per-instrument "personality" in [-1, 1] (the instrument doesn't change per strike).
fn jitter(a: usize, b: usize, salt: u32) -> f32 {
  let mut h = (a as u32)
    .wrapping_add(1)
    .wrapping_mul(0x9E37_79B1)
    .wrapping_add((b as u32).wrapping_add(1).wrapping_mul(0x85EB_CA6B))
    .wrapping_add(salt.wrapping_mul(0x27D4_EB2F));
  h ^= h >> 15;
  h = h.wrapping_mul(0x2C1B_3C6D);
  h ^= h >> 12;
  h = h.wrapping_mul(0x297A_2D39);
  h ^= h >> 15;
  (h >> 8) as f32 / 8_388_608.0 - 1.0
}

impl Handpan {
  pub fn new(sample_rate: f32) -> Self {
    let mut hp = Self {
      sample_rate,
      fields: [Field::default(); MAX_FIELDS],
      layout: parse_handpan_scale(HANDPAN_SCALES[0].1).expect("built-in scale"),
      custom: None,
      custom_version: 0,
      cavity: Mode::default(),
      cavity_recv: 0.0,
      cavity_pan_l: 0.7071,
      cavity_pan_r: 0.7071,
      salt: 0,
      tick_db: 0.0,
      cons: CONSTRUCTIONS[0],
      coef_key: (i32::MIN, 0, 0, 0, 0, 0, 0),
      bus_loop: 0.5,
      neighbor_gain: 1.0,
      tick_left: 0,
      tick_env: 0.0,
      tick_decay: 0.0,
      tick_amp: 0.0,
      tick_bp: [BandPass::default(); 2],
      tick_pan_l: 0.7071,
      tick_pan_r: 0.7071,
      noise_state: 0x9E37_79B9,
      seed: i32::MIN,
      prev_gate: [0.0; LANES],
      pending: [PendingStrike::default(); MAX_PENDING],
      pending_len: 0,
      dyn_counter: 0,
      last_manual_strike: f32::NAN,
      last_field: 0,
      strike_count: 0,
      silent: true,
      silent_blocks: 0,
    };
    hp.cavity.set(CAVITY_HZ, CAVITY_T60, sample_rate);
    hp
  }

  /// Free scale in maker notation (used when `scale == HANDPAN_CUSTOM_SCALE`). Invalid text is ignored.
  pub fn set_custom_notes(&mut self, text: &str) {
    if let Some(layout) = parse_handpan_scale(text) {
      if self.custom != Some(layout) {
        self.custom = Some(layout);
        self.custom_version = self.custom_version.wrapping_add(1);
      }
    }
  }

  pub fn layout(&self) -> HandpanLayout {
    self.layout
  }

  pub fn strike_count(&self) -> u32 {
    self.strike_count
  }

  pub fn last_field(&self) -> usize {
    self.last_field
  }

  /// Current vibration amplitude of each note field (all partials and twins), for the UI.
  pub fn field_levels(&self) -> Vec<f32> {
    self.fields[..self.layout.len]
      .iter()
      .map(|f| {
        let mut e = 0.0;
        for k in 0..NUM_PARTIALS {
          let (a, b) = (&f.modes_a[k], &f.modes_b[k]);
          e += a.s1 * a.s1 + a.s2 * a.s2 + b.s1 * b.s1 + b.s2 * b.s2;
        }
        e.sqrt()
      })
      .collect()
  }

  #[inline]
  fn noise(&mut self) -> f32 {
    self.noise_state = self.noise_state.wrapping_mul(1664525).wrapping_add(1013904223);
    (self.noise_state >> 8) as f32 / 8_388_608.0 - 1.0
  }

  fn update_coefficients(&mut self, p: &HandpanParams) {
    let scale = p.scale.clamp(0, HANDPAN_CUSTOM_SCALE);
    let custom_key = if scale == HANDPAN_CUSTOM_SCALE { self.custom_version } else { 0 };
    let key = (
      (scale * 3 + p.octave) * 1024 + p.instrument.clamp(0, 999),
      custom_key + ((p.construction.clamp(0, HANDPAN_CONSTRUCTIONS as i32 - 1) as u32) << 28),
      (p.tune * 10.0) as i32,
      (p.sustain * 1000.0) as i32,
      (p.bloom * 1000.0) as i32,
      (p.resonance * 1000.0) as i32,
      (p.pan * 1000.0) as i32,
    );
    if key == self.coef_key {
      return;
    }
    self.coef_key = key;

    let layout = if scale == HANDPAN_CUSTOM_SCALE {
      self.custom.unwrap_or_else(|| parse_handpan_scale(HANDPAN_SCALES[0].1).expect("built-in scale"))
    } else {
      parse_handpan_scale(HANDPAN_SCALES[scale as usize].1).expect("built-in scale")
    };
    if layout != self.layout {
      // A different instrument: nothing of the old one keeps ringing.
      self.clear_state();
      self.layout = layout;
    }

    let sr = self.sample_rate;
    let octave = p.octave.clamp(-1, 1);
    let sustain = p.sustain.clamp(0.25, 2.0);
    let bloom_offset_db = (p.bloom.clamp(0.0, 1.0) - 0.5) * 16.0;
    let cons = CONSTRUCTIONS[p.construction.clamp(0, HANDPAN_CONSTRUCTIONS as i32 - 1) as usize];
    self.cons = cons;
    let resonance = p.resonance.clamp(0.0, 1.0) * cons.halo_mul;
    self.bus_loop = resonance.min(BUS_LOOP_MAX);
    self.neighbor_gain = 2.0 * resonance;
    // Instrument identity: 0 is the ear-validated reference handpan. Any other value is another
    // exemplar within the spread measured between real instruments (global tuning ±2 c, cavity
    // 0.55-0.9x the Ding, T60 ±20 %, brightness ±2 dB, tick ±3 dB) and its own per-field draws.
    let instrument = p.instrument.clamp(0, 999) as u32;
    let salt = instrument * INSTRUMENT_SALT_STEP;
    self.salt = salt;
    let personal = |k: u32| if instrument == 0 { 0.0 } else { jitter(instrument as usize, 0, 100 + k) };
    let tune_offset = EXEMPLAR_TUNE_CENTS * personal(1);
    let t60_personality = 1.0 + 0.2 * personal(2);
    let bright_db = 2.0 * personal(3);
    self.tick_db = 3.0 * personal(4);
    let placement = p.pan.clamp(-1.0, 1.0);
    // Whole-instrument stereo placement: shifts and narrows the shell layout (two players apart).
    let place = |pan: f32| {
      if placement == 0.0 {
        pan
      } else {
        (0.5 + (pan - 0.5) * (1.0 - 0.6 * placement.abs()) + 0.4 * placement).clamp(0.0, 1.0)
      }
    };
    (self.cavity_pan_l, self.cavity_pan_r) = if placement == 0.0 {
      (0.7071, 0.7071)
    } else {
      let c = place(0.5);
      ((c * PI * 0.5).cos(), (c * PI * 0.5).sin())
    };

    let mut bottom_count = 0;
    for i in 0..layout.len {
      let is_ding = i == layout.ding;
      // Ding and bottom notes near the centre; the tone fields zig-zag left/right like the shell layout.
      let pan = if is_ding {
        0.5
      } else if layout.bottom[i] {
        bottom_count += 1;
        0.5 + if bottom_count % 2 == 1 { -0.1 } else { 0.1 }
      } else {
        0.5 + if i % 2 == 1 { -0.22 } else { 0.22 }
      };
      let field = &mut self.fields[i];
      field.dyn_amp = -1.0;
      let field_pan = place(pan);
      field.pan_l = (field_pan * PI * 0.5).cos();
      field.pan_r = (field_pan * PI * 0.5).sin();
      // Each partial radiates from its own part of the shell (measured level differences between the
      // fundamental, octave and fifth of 3-10 dB): the fundamental from the field, the octave from the
      // whole shell (near the centre), the fifth from the far side; octave and fifth also reach the two
      // channels with a phase offset. Ding partials stay centred.
      for k in 0..NUM_PARTIALS {
        let offset = pan - 0.5;
        let (spread, wander, ipd_deg) = match k {
          0 => (1.0, 0.0, 0.0),
          1 => (0.35, 0.1, 20.0 + 40.0 * jitter(i, 1, 8 + salt).abs()),
          2 => (-0.3, 0.12, 20.0 + 60.0 * jitter(i, 2, 8 + salt).abs()),
          _ => (0.8, 0.1, 30.0 * jitter(i, k, 8 + salt).abs()),
        };
        let (partial_pan, ipd_deg) = if is_ding {
          (0.5, ipd_deg)
        } else {
          (0.5 + spread * offset + wander * jitter(i, k, 9 + salt), ipd_deg)
        };
        let partial_pan = place(partial_pan.clamp(0.0, 1.0));
        let half = 0.5 * ipd_deg.to_radians() * if jitter(i, k, 10 + salt) < 0.0 { -1.0 } else { 1.0 };
        let (gl, gr) = ((partial_pan * PI * 0.5).cos(), (partial_pan * PI * 0.5).sin());
        field.rad_l[k] = (gl * half.cos(), gl * half.sin());
        field.rad_r[k] = (gr * half.cos(), -gr * half.sin());
      }
      field.midi = layout.notes[i] as i32 + 12 * octave;
      let cents = p.tune + tune_offset + PITCH_JITTER_CENTS * jitter(i, 0, 1 + salt);
      field.f0 = 440.0 * 2f32.powf((layout.notes[i] as f32 - 69.0) / 12.0 + cents / 1200.0 + octave as f32);
      let ding_amount = if is_ding {
        ((DING_STRETCH_NONE_HZ / field.f0).log2() / (DING_STRETCH_NONE_HZ / DING_STRETCH_FULL_HZ).log2()).clamp(0.0, 1.0)
      } else {
        0.0
      };
      let ding_t60 = if ding_amount >= 1.0 { DING_T60_MUL } else { 1.0 + (DING_T60_MUL - 1.0) * ding_amount };
      let t60_base = 4.0 * (field.f0 / 200.0).powf(-0.15) * if is_ding { ding_t60 } else { 1.0 } * sustain * t60_personality * cons.t60_mul;

      for k in 0..NUM_PARTIALS {
        let ratio = if is_ding && ding_amount >= 1.0 {
          DING_RATIOS[k]
        } else if is_ding {
          PARTIAL_RATIOS[k] + (DING_RATIOS[k] - PARTIAL_RATIOS[k]) * ding_amount
        } else {
          PARTIAL_RATIOS[k] * (1.0 + RATIO_JITTER * cons.mistune_mul * jitter(i, k, RATIO_SALT + salt))
        };
        let f = field.f0 * ratio;
        let split = SPLIT_MAX_HZ.min(f * (0.001 + 0.003 * jitter(i, k, 3 + salt).abs()));
        if f + split >= sr * 0.45 {
          field.active[k] = false;
          field.modes_a[k].set(1000.0, 0.1, sr);
          field.modes_b[k].set(1000.0, 0.1, sr);
          continue;
        }
        field.active[k] = true;
        let t60 = t60_base * PARTIAL_T60_MUL[k] * cons.partial_t60[k];
        let (lo, hi) = if k == 0 { TWIN_MIX_FUND } else { TWIN_MIX_OTHER };
        let twin = lo + (hi - lo) * jitter(i, k, 4 + salt).abs();
        field.twin_mix[k] = twin;
        // The pair is centred on its amplitude-weighted pitch: the louder twin used to sit half a split
        // flat, which pulled every partial a few cents under its target.
        field.modes_a[k].set(f - split * twin / (1.0 + twin), t60, sr);
        field.modes_b[k].set(f + split / (1.0 + twin), t60 * 0.97, sr);
        let ga = field.modes_a[k].gain_at(field.modes_a[k].w());
        let gb = field.modes_b[k].gain_at(field.modes_b[k].w());
        field.recv_a[k] = BUS_MAX.min(self.bus_loop / ga);
        field.recv_b[k] = BUS_MAX.min(self.bus_loop / gb);
      }

      // Bloom couplings normalised on the exact response of the receiving mode at the driving
      // frequency, so the grown octave/fifth land on the measured level whatever their mistuning.
      let register_db = OCT_REGISTER_DB * (field.f0 / REGISTER_REF_HZ).log2().clamp(REGISTER_MIN_OCT, REGISTER_MAX_OCT);
      let oct_lin = db(OCT_BLOOM_DB + register_db + bloom_offset_db + bright_db + OCT_BLOOM_JITTER_DB * jitter(i, 0, 5 + salt) + cons.oct_db);
      let fifth_lin = db(FIFTH_BLOOM_DB + bloom_offset_db + bright_db + FIFTH_BLOOM_JITTER_DB * jitter(i, 0, 6 + salt) + cons.fifth_db);
      let w1 = field.modes_a[0].w();
      let w2 = field.modes_a[1].w();
      field.k2 = if field.active[1] { oct_lin / (A_REF * field.modes_a[1].gain_at(2.0 * w1)) } else { 0.0 };
      field.k3 = if field.active[2] { fifth_lin / (oct_lin * A_REF * field.modes_a[2].gain_at(w1 + w2)) } else { 0.0 };
    }
    let cavity_hz = if cons.cavity_ratio > 0.0 {
      self.fields[layout.ding].f0 * cons.cavity_ratio
    } else if instrument == 0 {
      CAVITY_HZ
    } else {
      self.fields[layout.ding].f0 * (0.55 + 0.35 * personal(5).abs())
    };
    self.cavity.set(cavity_hz, CAVITY_T60 * cons.cavity_t60_mul, sr);
    self.cavity_recv = BUS_MAX.min(self.bus_loop / self.cavity.gain_at(self.cavity.w()));
  }

  fn nearest_field(&self, midi: f32) -> usize {
    let mut best = self.layout.ding;
    let mut best_d = f32::MAX;
    for (i, field) in self.fields[..self.layout.len].iter().enumerate() {
      let d = (field.midi as f32 - midi).abs();
      if d < best_d {
        best_d = d;
        best = i;
      }
    }
    best
  }

  fn strike(&mut self, field_i: usize, vel: f32, p: &HandpanParams) {
    self.dyn_counter = 0;
    let n = self.layout.len;
    let h = p.humanize.clamp(0.0, 1.0);
    let n_vel = self.noise();
    let n_oct = self.noise();
    let n_fifth = self.noise();
    let n_twin = self.noise();
    let n_tick = self.noise();
    let vel = (vel * db(HUMAN_VEL_DB * h * n_vel)).clamp(0.0, 1.0);
    if vel <= 0.0 || field_i >= n {
      return;
    }
    let touch = p.attack.clamp(0.0, 1.0) - 0.5;
    // Humanised strike position on the field: shifts the octave/fifth balance and which twin rings.
    let pos_db = [0.0, 4.0 * h * n_oct, 4.0 * h * n_fifth, 0.0, 0.0];
    let cons = self.cons;
    let twin_scale = (1.0 + 0.8 * h * n_twin).max(0.0);

    {
      let f = &mut self.fields[field_i];
      for k in 0..NUM_PARTIALS {
        if !f.active[k] {
          continue;
        }
        let upper = if k >= 3 { cons.upper_db } else { 0.0 };
        let amp = vel * db(DIRECT_DB[k] + pos_db[k] + ATTACK_PARTIAL_DB[k] * touch + upper);
        f.modes_a[k].s1 += amp;
        f.modes_b[k].s1 += amp * f.twin_mix[k] * twin_scale;
      }
      self.tick_pan_l = f.pan_l;
      self.tick_pan_r = f.pan_r;
    }

    let neighbor_gain = self.neighbor_gain;
    for (j, other) in self.fields[..n].iter_mut().enumerate() {
      if j == field_i {
        continue;
      }
      let d = j as i32 - field_i as i32;
      let base = match d {
        -2 => NEIGHBOR_DB[0],
        -1 => NEIGHBOR_DB[1],
        1 => NEIGHBOR_DB[2],
        2 => NEIGHBOR_DB[3],
        _ => NEIGHBOR_DB[4],
      };
      let kick = vel * neighbor_gain * db(base + NEIGHBOR_JITTER_DB * jitter(field_i * 31 + j, 0, 7 + self.salt));
      for k in 0..2 {
        other.modes_a[k].s1 += kick;
        other.modes_b[k].s1 += kick * other.twin_mix[k];
      }
    }

    let f0 = self.fields[field_i].f0;
    self.cavity.s1 += vel * 2.0 * p.cavity.clamp(0.0, 1.0) * db(CAVITY_KICK_DB + cons.cavity_db) * (f0 / 200.0).powf(-0.5);

    let sr = self.sample_rate;
    let register = (f0 / REGISTER_REF_HZ).log2().clamp(REGISTER_MIN_OCT, REGISTER_MAX_OCT);
    let tick_hz = TICK_HZ * (f0 / REGISTER_REF_HZ).powf(TICK_HZ_REGISTER_EXP) * (1.0 + 0.15 * h * n_tick) * cons.tick_hz_mul;
    for bp in self.tick_bp.iter_mut() {
      bp.set(tick_hz, TICK_Q, sr);
    }
    let tau = TICK_TAU_MS * 0.001 * sr * cons.tick_tau_mul;
    self.tick_left = (6.0 * tau) as u32;
    self.tick_env = 1.0;
    self.tick_decay = (-1.0 / tau).exp();
    self.tick_amp = vel * TICK_LEVEL * db(3.0 * h * n_tick + ATTACK_TICK_DB * touch + self.tick_db + TICK_REGISTER_DB * register + cons.tick_db);
    self.last_field = field_i;
    self.strike_count = self.strike_count.wrapping_add(1);
    self.silent = false;
    self.silent_blocks = 0;
  }

  pub fn process_block(&mut self, out_l: &mut [f32], out_r: &mut [f32], inputs: HandpanInputs, params: HandpanParams) {
    let frames = out_l.len().min(out_r.len());
    if params.seed != self.seed {
      self.seed = params.seed;
      self.noise_state = (params.seed as u32).wrapping_mul(2654435761).wrapping_add(0x9E37_79B9);
    }
    self.update_coefficients(&params);
    if params.strike != self.last_manual_strike {
      if !self.last_manual_strike.is_nan() {
        let field = (params.strike.max(0.0) as u32 % HANDPAN_STRIKE_BASE) as usize;
        self.strike(field, MANUAL_VELOCITY, &params);
      }
      self.last_manual_strike = params.strike;
    }
    let reference = if params.pitch_ref == 1 { 69.0 } else { 60.0 };
    let level = params.level.clamp(0.0, 2.0) * 0.315;
    let mut block_peak: f32 = 0.0;

    let max_delay = params.humanize.clamp(0.0, 1.0) * HUMAN_DELAY_MS * 0.001 * self.sample_rate;

    for i in 0..frames {
      let mut p = 0;
      while p < self.pending_len {
        if self.pending[p].delay == 0 {
          let PendingStrike { field, vel, .. } = self.pending[p];
          self.pending_len -= 1;
          self.pending[p] = self.pending[self.pending_len];
          self.strike(field, vel, &params);
        } else {
          self.pending[p].delay -= 1;
          p += 1;
        }
      }

      for lane in 0..LANES {
        let Some(gate) = inputs.gate[lane] else { continue };
        let g = gate[i];
        if g > 0.5 && self.prev_gate[lane] <= 0.5 {
          let field = match inputs.pitch_cv[lane] {
            Some(cv) => self.nearest_field(reference + 12.0 * cv[i]),
            None => self.layout.ding,
          };
          let vel = inputs.vel_cv[lane].map_or(0.8, |v| v[i].clamp(0.0, 1.0));
          // A player never lands exactly on the grid, and two hands never hit a chord at once.
          let delay = (max_delay * (0.5 + 0.5 * self.noise())) as u32;
          if delay == 0 || self.pending_len == MAX_PENDING {
            self.strike(field, vel, &params);
          } else {
            self.pending[self.pending_len] = PendingStrike { delay, field, vel };
            self.pending_len += 1;
          }
        }
        self.prev_gate[lane] = g;
      }

      // Fully decayed: nothing left to hear, and skipping keeps the recursions out of the denormal
      // range that made the (reverted) piano eat the CPU. The next strike wakes everything.
      if self.silent {
        out_l[i] = 0.0;
        out_r[i] = 0.0;
        continue;
      }

      if self.dyn_counter == 0 {
        self.update_dynamics();
      }
      self.dyn_counter = (self.dyn_counter + 1) % DYN_CHUNK;

      let n = self.layout.len;
      let mut bus = self.cavity.s2;
      for f in self.fields[..n].iter() {
        bus += f.out;
      }

      let mut l = 0.0;
      let mut r = 0.0;
      for f in self.fields[..n].iter_mut() {
        let drive = BUS_SAT * ((bus - f.out) / BUS_SAT).tanh();
        let y1 = f.modes_a[0].s2;
        let y2 = f.modes_a[1].s2;
        let q2 = f.k2 * y1 * y1;
        let q3 = f.k3 * y1 * y2;
        let mut s = 0.0;
        for k in 0..NUM_PARTIALS {
          if !f.active[k] {
            continue;
          }
          let mut ea = drive * f.recv_a[k];
          let mut eb = drive * f.recv_b[k];
          if k == 1 {
            ea += q2;
            eb += q2 * f.twin_mix[1];
          } else if k == 2 {
            ea += q3;
            eb += q3 * f.twin_mix[2];
          }
          let (ya, xa) = f.modes_a[k].tick(ea);
          let (yb, xb) = f.modes_b[k].tick(eb);
          let (y, x) = (ya + yb, xa + xb);
          s += y;
          l += f.rad_l[k].0 * y + f.rad_l[k].1 * x;
          r += f.rad_r[k].0 * y + f.rad_r[k].1 * x;
        }
        f.out = s;
      }

      let cav = self.cavity.tick(self.cavity_recv * BUS_SAT * (bus / BUS_SAT).tanh()).0;
      l += cav * self.cavity_pan_l;
      r += cav * self.cavity_pan_r;

      if self.tick_left > 0 {
        self.tick_left -= 1;
        let n = self.noise();
        let band = self.tick_bp[0].process(n);
        let t = self.tick_bp[1].process(band) * self.tick_amp * self.tick_env;
        self.tick_env *= self.tick_decay;
        l += t * self.tick_pan_l;
        r += t * self.tick_pan_r;
      }

      out_l[i] = l * level;
      out_r[i] = r * level;
      block_peak = block_peak.max(l.abs()).max(r.abs());
    }

    if !self.silent {
      if block_peak < SILENCE_PEAK && self.tick_left == 0 {
        self.silent_blocks += 1;
        if self.silent_blocks >= SILENCE_BLOCKS {
          self.clear_state();
          self.silent = true;
        }
      } else {
        self.silent_blocks = 0;
      }
    }
  }

  /// Amplitude-dependent behaviour of each field, from its fundamental's amplitude: the nonlinear
  /// drain of the fundamental and the pitch glide of every partial.
  fn update_dynamics(&mut self) {
    let drain_per_amp = DRAIN_DB_S * self.cons.drain_mul * std::f32::consts::LN_10 / (20.0 * self.sample_rate);
    let cent = std::f32::consts::LN_2 / 1200.0;
    for f in self.fields[..self.layout.len].iter_mut() {
      let a = &f.modes_a[0];
      let amp = ((a.s1 * a.s1 + a.s2 * a.s2).sqrt() / A_REF).min(2.0);
      if (amp - f.dyn_amp).abs() < 1e-4 {
        continue;
      }
      f.dyn_amp = amp;
      let drain = (-drain_per_amp * amp).exp();
      f.modes_a[0].decay = f.modes_a[0].decay0 * drain;
      f.modes_b[0].decay = f.modes_b[0].decay0 * drain;
      for k in 0..NUM_PARTIALS {
        if f.active[k] {
          let factor = (GLIDE_CENTS[k] * cent * amp).exp();
          f.modes_a[k].retune(factor);
          f.modes_b[k].retune(factor);
        }
      }
    }
  }

  fn clear_state(&mut self) {
    for f in self.fields.iter_mut() {
      for k in 0..NUM_PARTIALS {
        f.modes_a[k].clear();
        f.modes_b[k].clear();
      }
      f.out = 0.0;
      f.dyn_amp = -1.0;
    }
    self.cavity.clear();
    self.tick_left = 0;
  }

  pub fn reset(&mut self) {
    self.clear_state();
    self.pending_len = 0;
    self.prev_gate = [0.0; LANES];
    self.last_manual_strike = f32::NAN;
    self.silent = true;
    self.silent_blocks = 0;
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  const SR: f32 = 48_000.0;
  const FRAMES: usize = 128;
  const D_KURD_MIDI: [u8; 15] = [50, 53, 55, 57, 58, 60, 62, 64, 65, 67, 69, 72, 74, 76, 77];
  const D_KURD_NAMES: [&str; 15] = ["D3", "F3", "G3", "A3", "Bb3", "C4", "D4", "E4", "F4", "G4", "A4", "C5", "D5", "E5", "F5"];

  fn params() -> HandpanParams {
    HandpanParams {
      scale: 0,
      tune: 0.0,
      octave: 0,
      sustain: 1.0,
      bloom: 0.5,
      resonance: 0.5,
      cavity: 0.5,
      attack: 0.5,
      humanize: 0.0,
      pitch_ref: 0,
      seed: 1,
      level: 1.0,
      pan: 0.0,
      instrument: 0,
      construction: 0,
      strike: 0.0,
    }
  }

  /// Strike `midi` notes at the given times (s) on lane 0; returns mono (L+R)/2.
  fn render(hp: &mut Handpan, strikes: &[(f32, f32)], seconds: f32, p: HandpanParams) -> Vec<f32> {
    let (mut l, mut r) = (vec![0.0; FRAMES], vec![0.0; FRAMES]);
    let mut out = Vec::new();
    let blocks = (seconds * SR / FRAMES as f32) as usize;
    for b in 0..blocks {
      let t0 = b as f32 * FRAMES as f32 / SR;
      let t1 = t0 + FRAMES as f32 / SR;
      let hit = strikes.iter().find(|(t, _)| *t >= t0 && *t < t1);
      let gate = vec![if hit.is_some() { 1.0 } else { 0.0 }; FRAMES];
      let pitch = vec![hit.map_or(0.0, |(_, m)| (m - 60.0) / 12.0); FRAMES];
      let mut inputs = HandpanInputs::default();
      inputs.gate[0] = Some(&gate);
      inputs.pitch_cv[0] = Some(&pitch);
      hp.process_block(&mut l, &mut r, inputs, p);
      for i in 0..FRAMES {
        out.push(0.5 * (l[i] + r[i]));
      }
    }
    out
  }

  /// Magnitude of `f` in a Hann-windowed chunk (Goertzel-style single-bin DFT).
  fn bin(x: &[f32], f: f32) -> f32 {
    let n = x.len();
    let (mut re, mut im) = (0.0f64, 0.0f64);
    for (i, &v) in x.iter().enumerate() {
      let hw = 0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / (n - 1) as f64).cos();
      let ph = 2.0 * std::f64::consts::PI * f as f64 * i as f64 / SR as f64;
      re += v as f64 * hw * ph.cos();
      im -= v as f64 * hw * ph.sin();
    }
    ((re * re + im * im).sqrt() / n as f64) as f32
  }

  #[test]
  fn parses_maker_notation() {
    let kurd = parse_handpan_scale(HANDPAN_SCALES[0].1).unwrap();
    assert_eq!(&kurd.notes[..kurd.len], &D_KURD_MIDI[..]);
    assert_eq!(kurd.ding, 0);
    assert!(kurd.bottom[1] && kurd.bottom[2] && !kurd.bottom[3], "F3 G3 are bottom notes");
    let aegean = parse_handpan_scale("C3/ E3 G3 B3 C4 E4 F#4 G4 B4").unwrap();
    assert_eq!(&aegean.notes[..aegean.len], &[48, 52, 55, 59, 60, 64, 66, 67, 71]);
    let low_mutant = parse_handpan_scale("D3/(A2) Eb4 64").unwrap();
    assert_eq!(&low_mutant.notes[..low_mutant.len], &[45, 50, 63, 64]);
    assert_eq!(low_mutant.ding, 1, "the Ding is the first note written, not the lowest");
    assert!(parse_handpan_scale("nonsense").is_none());
  }

  #[test]
  fn manual_strike_fires_on_change_only() {
    let mut hp = Handpan::new(SR);
    let (mut l, mut r) = (vec![0.0; FRAMES], vec![0.0; FRAMES]);
    let stored = HandpanParams { strike: (41 * HANDPAN_STRIKE_BASE + 10) as f32, ..params() };
    for _ in 0..4 {
      hp.process_block(&mut l, &mut r, HandpanInputs::default(), stored);
    }
    assert_eq!(hp.strike_count(), 0, "a strike value restored from a patch must not play");
    let played = HandpanParams { strike: (42 * HANDPAN_STRIKE_BASE + 3) as f32, ..params() };
    hp.process_block(&mut l, &mut r, HandpanInputs::default(), played);
    hp.process_block(&mut l, &mut r, HandpanInputs::default(), played);
    assert_eq!(hp.strike_count(), 1);
    assert_eq!(hp.last_field(), 3);
    let levels = hp.field_levels();
    assert!(levels[3] > 10.0 * levels[13], "the struck field must be the brightest");
  }

  #[test]
  fn silent_without_gate() {
    let mut hp = Handpan::new(SR);
    let out = render(&mut hp, &[], 1.0, params());
    assert!(out.iter().all(|&s| s == 0.0));
  }

  #[test]
  fn gate_strikes_nearest_field() {
    let mut hp = Handpan::new(SR);
    let out = render(&mut hp, &[(0.0, 69.4)], 0.3, params());
    assert_eq!(hp.last_field(), 10, "A4 is field 10 of the D Kurd layout");
    assert_eq!(hp.strike_count(), 1);
    assert!(out.iter().all(|s| s.is_finite()));
    assert!(out.iter().any(|&s| s.abs() > 1e-3));
  }

  /// Lanes strike independently in the same block (a chord), and the A4 pitch reference maps MIDI CV.
  #[test]
  fn lanes_play_chords_with_midi_reference() {
    let mut hp = Handpan::new(SR);
    let (mut l, mut r) = (vec![0.0; FRAMES], vec![0.0; FRAMES]);
    let gate = vec![1.0; FRAMES];
    // MIDI-file convention (A4 = 0 V): D4 = -7/12, A4 = 0, D5 = +5/12
    let (p_d4, p_a4, p_d5) = (vec![-7.0 / 12.0; FRAMES], vec![0.0; FRAMES], vec![5.0 / 12.0; FRAMES]);
    let mut inputs = HandpanInputs::default();
    inputs.gate = [Some(&gate), Some(&gate), Some(&gate), None, None, None, None, None];
    inputs.pitch_cv = [Some(&p_d4), Some(&p_a4), Some(&p_d5), None, None, None, None, None];
    hp.process_block(&mut l, &mut r, inputs, HandpanParams { pitch_ref: 1, ..params() });
    assert_eq!(hp.strike_count(), 3, "three lanes, three strikes");
    let levels = hp.field_levels();
    for (field, name) in [(6, "D4"), (10, "A4"), (12, "D5")] {
      assert!(levels[field] > 0.3, "{name} should have been struck (level {})", levels[field]);
    }
  }

  #[test]
  fn custom_scale_and_attack() {
    let mut hp = Handpan::new(SR);
    hp.set_custom_notes("F3/ G3 Ab3 Bb3 C4 Db4 Eb4 F4");
    let custom = HandpanParams { scale: HANDPAN_CUSTOM_SCALE, ..params() };
    let _ = render(&mut hp, &[(0.0, 61.0)], 0.1, custom);
    assert_eq!(hp.layout().len, 8);
    assert_eq!(hp.layout().notes[hp.last_field()], 61, "Db4 exists on this custom instrument");

    let tick_energy = |attack: f32| {
      let mut hp = Handpan::new(SR);
      let out = render(&mut hp, &[(0.0, 69.0)], 0.03, HandpanParams { attack, ..params() });
      // second difference: the ~3 kHz tick passes, the A4 body is ~60 dB down
      out.windows(3).take((0.02 * SR) as usize).map(|w| (w[2] - 2.0 * w[1] + w[0]).powi(2)).sum::<f32>()
    };
    assert!(tick_energy(1.0) > 2.0 * tick_energy(0.5), "a hard touch must click more");
    assert!(tick_energy(0.0) < tick_energy(0.5), "a soft touch must click less");
  }

  /// Instrument 0 is the reference; another exemplar is a genuinely different instrument.
  #[test]
  fn instrument_changes_the_exemplar() {
    let a = render(&mut Handpan::new(SR), &[(0.0, 69.0)], 0.5, params());
    let b = render(&mut Handpan::new(SR), &[(0.0, 69.0)], 0.5, HandpanParams { instrument: 3, ..params() });
    let c = render(&mut Handpan::new(SR), &[(0.0, 69.0)], 0.5, HandpanParams { instrument: 3, ..params() });
    assert_eq!(b, c, "an exemplar is deterministic");
    let diff: f32 = a.iter().zip(&b).map(|(x, y)| (x - y).abs()).sum();
    assert!(diff > 1.0, "instrument 3 must differ from the reference ({diff})");
  }

  /// `pan` moves the whole instrument: hard left puts clearly more energy in the left channel.
  #[test]
  fn pan_places_the_instrument() {
    let energy = |pan: f32| {
      let mut hp = Handpan::new(SR);
      let (mut l, mut r) = (vec![0.0; FRAMES], vec![0.0; FRAMES]);
      let (mut el, mut er) = (0.0f32, 0.0f32);
      let gate = vec![1.0; FRAMES];
      for b in 0..40 {
        let mut inputs = HandpanInputs::default();
        let off = vec![0.0; FRAMES];
        inputs.gate[0] = Some(if b == 0 { &gate } else { &off });
        hp.process_block(&mut l, &mut r, inputs, HandpanParams { pan, ..params() });
        el += l.iter().map(|v| v * v).sum::<f32>();
        er += r.iter().map(|v| v * v).sum::<f32>();
      }
      (el, er)
    };
    let (cl, cr) = energy(0.0);
    let (ll, lr) = energy(-1.0);
    let (rl, rr) = energy(1.0);
    assert!((cl / cr - 1.0).abs() < 0.05, "Ding centred at pan 0 ({cl} / {cr})");
    assert!(ll > 4.0 * lr, "pan -1 must sit left ({ll} / {lr})");
    assert!(rr > 4.0 * rl, "pan +1 must sit right ({rl} / {rr})");
  }

  /// The octave must grow after the strike (measured peak ~110 ms), not start at its maximum.
  #[test]
  fn octave_blooms_after_strike() {
    let mut hp = Handpan::new(SR);
    let out = render(&mut hp, &[(0.0, 69.0)], 0.6, params());
    let f_oct = 2.0 * hp.fields[10].f0;
    let w = (0.02 * SR) as usize;
    let early = bin(&out[(0.005 * SR) as usize..(0.005 * SR) as usize + w], f_oct);
    let later = bin(&out[(0.10 * SR) as usize..(0.10 * SR) as usize + w], f_oct);
    assert!(later > 1.5 * early, "octave should bloom (early {early:.5}, at 100ms {later:.5})");
  }

  /// Striking A4 must ring the Ding (its stretched fifth sits on A4) and the field just below (G4).
  #[test]
  fn shell_rings_sympathetically() {
    let mut hp = Handpan::new(SR);
    let _ = render(&mut hp, &[(0.0, 69.0)], 0.8, params());
    let ding = hp.fields[0].modes_a[2].s1.hypot(hp.fields[0].modes_a[2].s2);
    let g4 = hp.fields[9].modes_a[0].s1.hypot(hp.fields[9].modes_a[0].s2);
    let e5 = hp.fields[13].modes_a[0].s1.hypot(hp.fields[13].modes_a[0].s2);
    assert!(ding > 1e-3, "Ding fifth should answer an A4 strike ({ding})");
    assert!(g4 > e5, "the field just below should ring more than a far one (G4 {g4}, E5 {e5})");
  }

  /// Every field of a 32-note custom scale at full resonance: no NaN, and the tail must still die out.
  #[test]
  fn stable_at_max_resonance_and_goes_silent() {
    let mut hp = Handpan::new(SR);
    let notes: Vec<String> = (48..80).map(|m: i32| m.to_string()).collect();
    hp.set_custom_notes(&notes.join(" "));
    let p = HandpanParams {
      scale: HANDPAN_CUSTOM_SCALE,
      resonance: 1.0,
      bloom: 1.0,
      cavity: 1.0,
      sustain: 2.0,
      humanize: 1.0,
      attack: 1.0,
      ..params()
    };
    let strikes: Vec<(f32, f32)> = (48..80).enumerate().map(|(i, m)| (i as f32 * 0.07, m as f32)).collect();
    let out = render(&mut hp, &strikes, 60.0, p);
    assert_eq!(hp.layout().len, 32);
    assert!(out.iter().all(|s| s.is_finite()));
    let rms = |a: f32, b: f32| {
      let s = &out[(a * SR) as usize..(b * SR) as usize];
      (s.iter().map(|v| v * v).sum::<f32>() / s.len() as f32).sqrt()
    };
    assert!(rms(10.0, 11.0) < 0.1 * rms(1.0, 2.0), "the halo must decay, not self-sustain");
    assert!(out[out.len() - FRAMES..].iter().all(|&s| s == 0.0), "fully decayed voice should be skipped");
  }

  /// Bench: HANDPAN_DUMP=<dir> writes raw f32 mono files (single strikes + the reference run).
  #[test]
  fn dump_for_bench() {
    let Ok(dir) = std::env::var("HANDPAN_DUMP") else { return };
    let write = |name: &str, x: &[f32]| {
      let mut bytes = Vec::with_capacity(x.len() * 4);
      for v in x {
        bytes.extend_from_slice(&v.to_le_bytes());
      }
      std::fs::write(format!("{dir}/{name}"), bytes).unwrap();
    };
    for (i, &m) in D_KURD_MIDI.iter().enumerate() {
      let mut hp = Handpan::new(SR);
      let out = render(&mut hp, &[(0.05, m as f32)], 3.0, HandpanParams { humanize: 0.0, ..params() });
      write(&format!("rust-single-{}.f32", D_KURD_NAMES[i]), &out);
    }
    let run = [(1.74, 58.0), (2.01, 60.0), (2.26, 62.0), (2.51, 64.0), (2.76, 65.0), (3.03, 67.0),
      (3.28, 69.0), (3.59, 72.0), (4.10, 74.0), (4.49, 76.0), (5.31, 50.0)];
    let strikes: Vec<(f32, f32)> = run.iter().map(|(t, m)| (t - 1.64, *m)).collect();
    let mut hp = Handpan::new(SR);
    let out = render(&mut hp, &strikes, 6.5, HandpanParams { humanize: 0.5, ..params() });
    write("rust-run.f32", &out);
  }
}
