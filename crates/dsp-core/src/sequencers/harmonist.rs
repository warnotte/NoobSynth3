//! Harmonist — an autonomous functional-harmony engine.
//!
//! Walks a key center through weighted cadences (Tonic → Subdominant → Dominant → Tonic) with
//! rare, smooth key modulations over minutes, and emits `root` + `scale` CV to drive a Quantizer
//! so every voice in the patch follows the same slowly-evolving tonality. Clocked (advances one
//! chord every `rate` clock pulses); deterministic LCG so a given seed yields the same journey.

use crate::common::sample_at;

// Diatonic scale-degree offsets (semitones from the key root).
const MAJOR: [i32; 7] = [0, 2, 4, 5, 7, 9, 11];
const MINOR: [i32; 7] = [0, 2, 3, 5, 7, 8, 10]; // natural minor
// Triad quality per degree → which pentatonic the chord uses (quantizer scale index).
// true = minor-ish (min pentatonic = idx 7), false = major-ish (maj pentatonic = idx 6).
const MAJ_QUAL: [bool; 7] = [false, true, true, false, false, true, true]; // I ii iii IV V vi vii°
const MIN_QUAL: [bool; 7] = [true, true, false, true, true, false, false]; // i ii° III iv v VI VII
// Functional bucket per degree: 0 = Tonic, 1 = Subdominant, 2 = Dominant.
const FUNC_MAJ: [u8; 7] = [0, 1, 0, 1, 2, 0, 2];
const FUNC_MIN: [u8; 7] = [0, 2, 0, 1, 2, 1, 2];

const SCALE_MAJ_PENTA: f32 = 6.0;
const SCALE_MIN_PENTA: f32 = 7.0;

/// Parameters for the Harmonist.
pub struct HarmonistParams<'a> {
    /// Clocks per chord (2..64) — the harmonic rhythm.
    pub rate: &'a [f32],
    /// 0..1 — chord-duration jitter + flattens the cadential pull (more wandering).
    pub restlessness: &'a [f32],
    /// 0..1 — major↔minor bias on parallel modulations (bright = prefer major).
    pub brightness: &'a [f32],
    /// 0..1 — probability of a key modulation when a cadence lands on the tonic.
    pub mod_chance: &'a [f32],
}

/// Inputs for the Harmonist.
pub struct HarmonistInputs<'a> {
    pub clock: Option<&'a [f32]>,
    pub reset: Option<&'a [f32]>,
}

/// Autonomous functional-harmony engine.
#[derive(Debug, Clone)]
pub struct Harmonist {
    sample_rate: f32,
    last_clock: f32,
    last_reset: f32,
    rng_state: u32,
    clocks: u32,        // clocks elapsed in the current chord
    chord_len: u32,     // clocks the current chord lasts
    key_root: i32,      // 0..11
    minor: bool,        // current mode
    degree: usize,      // 0..6 (scale degree of the current chord)
    trigger_timer: i32, // chord-change gate pulse countdown
    out_root: f32,      // current chord root (0..11) for the quantizer root CV
    out_scale: f32,     // current scale index (6 or 7) for the quantizer scale CV
    init_root: i32,
    init_minor: bool,
}

impl Harmonist {
    pub fn new(sample_rate: f32, root: i32, minor: bool, seed: u32) -> Self {
        let r = root.rem_euclid(12);
        let mut h = Self {
            sample_rate,
            last_clock: 0.0,
            last_reset: 0.0,
            rng_state: if seed == 0 { 0x1a2b_3c4d } else { seed },
            clocks: 0,
            chord_len: 16,
            key_root: r,
            minor,
            degree: 0,
            trigger_timer: 0,
            out_root: 0.0,
            out_scale: SCALE_MAJ_PENTA,
            init_root: r,
            init_minor: minor,
        };
        h.emit(); // establish the tonic
        h
    }

    fn rng(&mut self) -> f32 {
        self.rng_state = self.rng_state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        (self.rng_state >> 8) as f32 / 16_777_216.0
    }

    fn func(&self, deg: usize) -> u8 {
        if self.minor { FUNC_MIN[deg] } else { FUNC_MAJ[deg] }
    }

    fn pick_weighted3(&mut self, w: [f32; 3]) -> u8 {
        let tot = w[0] + w[1] + w[2];
        let mut r = self.rng() * tot;
        for (k, &wk) in w.iter().enumerate() {
            if r < wk {
                return k as u8;
            }
            r -= wk;
        }
        0
    }

    /// Pick the next chord degree from the current function via weighted cadential transitions.
    fn next_degree(&mut self, restlessness: f32) {
        let w: [f32; 3] = match self.func(self.degree) {
            0 => [2.0, 5.0, 3.0], // from Tonic       → [T, S, D]
            1 => [2.0, 1.0, 6.0], // from Subdominant  → wants Dominant
            _ => [7.0, 1.0, 1.0], // from Dominant     → resolves to Tonic
        };
        // restlessness flattens the weights toward uniform (more wandering, weaker cadence pull)
        let f = restlessness;
        let w = [w[0] * (1.0 - f) + f, w[1] * (1.0 - f) + f, w[2] * (1.0 - f) + f];
        let next_func = self.pick_weighted3(w);
        let table = if self.minor { &FUNC_MIN } else { &FUNC_MAJ };
        let mut cands = [0usize; 7];
        let mut n = 0;
        for (d, &fb) in table.iter().enumerate() {
            if fb == next_func {
                cands[n] = d;
                n += 1;
            }
        }
        if n == 0 {
            self.degree = 0;
            return;
        }
        let pick = ((self.rng() * n as f32) as usize).min(n - 1);
        self.degree = cands[pick];
    }

    /// At a cadence (on the tonic), maybe pivot to a related key. Returns true if it modulated.
    fn maybe_modulate(&mut self, mod_chance: f32, brightness: f32) -> bool {
        if self.func(self.degree) != 0 || self.rng() > mod_chance {
            return false;
        }
        let c = self.rng();
        if c < 0.30 {
            self.key_root = (self.key_root + 7).rem_euclid(12); // dominant key (up a fifth)
        } else if c < 0.58 {
            self.key_root = (self.key_root + 5).rem_euclid(12); // subdominant key (down a fifth)
        } else if c < 0.80 {
            // relative major/minor
            if self.minor {
                self.key_root = (self.key_root + 3).rem_euclid(12);
                self.minor = false;
            } else {
                self.key_root = (self.key_root + 9).rem_euclid(12);
                self.minor = true;
            }
        } else {
            // parallel — biased by brightness (bright → prefer major)
            self.minor = self.rng() > brightness;
        }
        self.degree = 0;
        true
    }

    fn emit(&mut self) {
        let offs = if self.minor { MINOR } else { MAJOR };
        self.out_root = (self.key_root + offs[self.degree]).rem_euclid(12) as f32;
        let qual = if self.minor { MIN_QUAL[self.degree] } else { MAJ_QUAL[self.degree] };
        self.out_scale = if qual { SCALE_MIN_PENTA } else { SCALE_MAJ_PENTA };
    }

    pub fn process_block(
        &mut self,
        out_root: &mut [f32],
        out_scale: &mut [f32],
        out_gate: &mut [f32],
        inputs: HarmonistInputs,
        params: HarmonistParams,
    ) {
        let clock_in = inputs.clock.unwrap_or(&[]);
        let reset_in = inputs.reset.unwrap_or(&[]);
        let pulse = (0.01 * self.sample_rate) as i32; // 10 ms chord-change gate

        for i in 0..out_root.len() {
            let clock = sample_at(clock_in, i, 0.0);
            let reset = sample_at(reset_in, i, 0.0);
            let rate = sample_at(params.rate, i, 16.0).clamp(2.0, 64.0);
            let restless = sample_at(params.restlessness, i, 0.4).clamp(0.0, 1.0);
            let bright = sample_at(params.brightness, i, 0.5).clamp(0.0, 1.0);
            let modc = sample_at(params.mod_chance, i, 0.15).clamp(0.0, 1.0);

            if reset > 0.5 && self.last_reset <= 0.5 {
                self.key_root = self.init_root;
                self.minor = self.init_minor;
                self.degree = 0;
                self.clocks = 0;
                self.emit();
                self.trigger_timer = pulse;
            }
            self.last_reset = reset;

            if clock > 0.5 && self.last_clock <= 0.5 {
                self.clocks += 1;
                if self.clocks >= self.chord_len {
                    self.clocks = 0;
                    if self.maybe_modulate(modc, bright) {
                        self.emit(); // land on the new key's tonic so the modulation reads
                    } else {
                        self.next_degree(restless);
                        self.emit();
                    }
                    self.trigger_timer = pulse;
                    let jitter = 1.0 + (self.rng() - 0.5) * restless;
                    self.chord_len = (rate * jitter).round().clamp(2.0, 64.0) as u32;
                }
            }
            self.last_clock = clock;

            out_root[i] = self.out_root;
            out_scale[i] = self.out_scale;
            out_gate[i] = if self.trigger_timer > 0 {
                self.trigger_timer -= 1;
                1.0
            } else {
                0.0
            };
        }
    }

    /// Current chord root (0-11), for UI.
    pub fn current_root(&self) -> i32 {
        self.out_root as i32
    }

    /// Current key center root (0-11).
    pub fn key_root(&self) -> i32 {
        self.key_root
    }

    /// Current mode (true = minor), for UI.
    pub fn is_minor(&self) -> bool {
        self.minor
    }

    /// Live key change (also the new reset target): jumps to that key's tonic.
    pub fn set_key(&mut self, root: i32, minor: bool) {
        self.init_root = root.rem_euclid(12);
        self.init_minor = minor;
        self.key_root = self.init_root;
        self.minor = minor;
        self.degree = 0;
        self.emit();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clocks(h: &mut Harmonist, n: usize) -> Vec<(f32, f32)> {
        let mut seen = Vec::new();
        for _ in 0..n {
            // one clock pulse = high then low blocks
            for &lvl in &[1.0f32, 0.0] {
                let (mut r, mut s, mut g) = ([0.0f32; 32], [0.0f32; 32], [0.0f32; 32]);
                h.process_block(&mut r, &mut s, &mut g,
                    HarmonistInputs { clock: Some(&[lvl; 32]), reset: None },
                    HarmonistParams { rate: &[4.0], restlessness: &[0.4], brightness: &[0.5], mod_chance: &[0.2] });
                seen.push((r[0], s[0]));
            }
        }
        seen
    }

    #[test]
    fn harmony_advances_and_stays_in_range() {
        let mut h = Harmonist::new(48_000.0, 0, false, 0x1234);
        let out = clocks(&mut h, 200);
        // roots are valid pitch classes, scale is a pentatonic index
        for (root, scale) in &out {
            assert!(*root >= 0.0 && *root <= 11.0, "root out of range: {root}");
            assert!(*scale == 6.0 || *scale == 7.0, "scale not pentatonic: {scale}");
        }
        // the harmony actually MOVES (more than one distinct chord root over 200 clocks)
        let distinct: std::collections::HashSet<i32> = out.iter().map(|(r, _)| *r as i32).collect();
        assert!(distinct.len() >= 4, "harmony barely moves: {} distinct roots", distinct.len());
    }

    #[test]
    fn deterministic() {
        let mut a = Harmonist::new(48_000.0, 0, false, 0x55);
        let mut b = Harmonist::new(48_000.0, 0, false, 0x55);
        assert_eq!(clocks(&mut a, 100), clocks(&mut b, 100));
    }
}
