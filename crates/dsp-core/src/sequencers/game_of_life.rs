//! Game of Life Sequencer
//!
//! Conway's Game of Life as a musical sequencer.
//! A 16×16 grid evolves according to cellular automaton rules.
//! A playhead scans columns left-to-right on clock ticks,
//! generating CV/gate from alive cells.

use crate::common::{sample_at, get_scale_notes};

pub const GOL_COLS: usize = 16;
pub const GOL_ROWS: usize = 16;

/// Parameters for the Game of Life sequencer
#[derive(Debug, Clone)]
pub struct GameOfLifeParams<'a> {
    /// Evolve every N clock ticks (1-16)
    pub evolve_rate: &'a [f32],
    /// Output range in octaves (1-5)
    pub range: &'a [f32],
    /// Scale quantization (0 = off/chromatic)
    pub scale: &'a [f32],
    /// Root note (0-11)
    pub root: &'a [f32],
    /// Wrap edges (toroidal) (0 = dead borders, 1 = wrap)
    pub wrap: &'a [f32],
}

impl<'a> Default for GameOfLifeParams<'a> {
    fn default() -> Self {
        Self {
            evolve_rate: &[4.0],
            range: &[2.0],
            scale: &[0.0],
            root: &[0.0],
            wrap: &[1.0],
        }
    }
}

/// Inputs for the Game of Life sequencer
pub struct GameOfLifeInputs<'a> {
    pub clock: Option<&'a [f32]>,
    pub reset: Option<&'a [f32]>,
}

/// Game of Life sequencer
#[derive(Debug, Clone)]
pub struct GameOfLife {
    /// Grid: each u16 is one row (16 columns, bit = alive)
    grid: [u16; GOL_ROWS],
    /// Double buffer for evolution
    next_grid: [u16; GOL_ROWS],
    /// Current playhead column (0-15)
    playhead: usize,
    /// Clock tick counter (for evolve rate)
    step_count: usize,
    /// Generation counter
    generation: u32,
    /// Sample rate
    sample_rate: f32,
    /// Previous clock value for edge detection
    last_clock: f32,
    /// Previous reset value for edge detection
    last_reset: f32,
    /// Current CV output
    current_cv: f32,
    /// Gate state
    gate_state: f32,
    /// Trigger timer for pulse output
    trigger_timer: i32,
    /// Simple RNG state
    rng_state: u32,
}

impl GameOfLife {
    pub fn new(sample_rate: f32) -> Self {
        let mut gol = Self {
            grid: [0u16; GOL_ROWS],
            next_grid: [0u16; GOL_ROWS],
            playhead: 0,
            step_count: 0,
            generation: 0,
            sample_rate,
            last_clock: 0.0,
            last_reset: 0.0,
            current_cv: 0.0,
            gate_state: 0.0,
            trigger_timer: 0,
            rng_state: 0xDEAD_BEEF,
        };
        // Start with a classic R-pentomino pattern centered
        gol.seed_r_pentomino();
        gol
    }

    /// Seed with R-pentomino (a classic long-lived pattern)
    fn seed_r_pentomino(&mut self) {
        self.clear();
        let cx = GOL_COLS / 2;
        let cy = GOL_ROWS / 2;
        //  .##
        //  ##.
        //  .#.
        self.set_cell(cx, cy - 1, true);
        self.set_cell(cx + 1, cy - 1, true);
        self.set_cell(cx - 1, cy, true);
        self.set_cell(cx, cy, true);
        self.set_cell(cx, cy + 1, true);
    }

    /// Clear the grid
    fn clear(&mut self) {
        self.grid = [0u16; GOL_ROWS];
    }

    /// Set a cell state
    fn set_cell(&mut self, col: usize, row: usize, alive: bool) {
        if col < GOL_COLS && row < GOL_ROWS {
            if alive {
                self.grid[row] |= 1 << col;
            } else {
                self.grid[row] &= !(1 << col);
            }
        }
    }

    /// Get a cell state
    fn get_cell(&self, col: usize, row: usize) -> bool {
        if col < GOL_COLS && row < GOL_ROWS {
            (self.grid[row] >> col) & 1 == 1
        } else {
            false
        }
    }

    /// Get cell with wrapping
    fn get_cell_wrap(&self, col: i32, row: i32, wrap: bool) -> bool {
        if wrap {
            let c = col.rem_euclid(GOL_COLS as i32) as usize;
            let r = row.rem_euclid(GOL_ROWS as i32) as usize;
            (self.grid[r] >> c) & 1 == 1
        } else {
            if col < 0 || row < 0 || col >= GOL_COLS as i32 || row >= GOL_ROWS as i32 {
                false
            } else {
                (self.grid[row as usize] >> col as usize) & 1 == 1
            }
        }
    }

    /// Count neighbors for a cell
    fn count_neighbors(&self, col: usize, row: usize, wrap: bool) -> u8 {
        let c = col as i32;
        let r = row as i32;
        let mut count = 0u8;
        for dy in -1..=1i32 {
            for dx in -1..=1i32 {
                if dx == 0 && dy == 0 {
                    continue;
                }
                if self.get_cell_wrap(c + dx, r + dy, wrap) {
                    count += 1;
                }
            }
        }
        count
    }

    /// Evolve one generation (Conway's B3/S23)
    fn evolve(&mut self, wrap: bool) {
        for row in 0..GOL_ROWS {
            self.next_grid[row] = 0;
            for col in 0..GOL_COLS {
                let neighbors = self.count_neighbors(col, row, wrap);
                let alive = self.get_cell(col, row);
                let next_alive = if alive {
                    neighbors == 2 || neighbors == 3 // Survive
                } else {
                    neighbors == 3 // Birth
                };
                if next_alive {
                    self.next_grid[row] |= 1 << col;
                }
            }
        }
        self.grid = self.next_grid;
        self.generation += 1;

        // If grid is empty, reseed
        if self.grid.iter().all(|&row| row == 0) {
            self.randomize(0.3);
        }
    }

    /// Randomize grid with given density (0-1)
    fn randomize(&mut self, density: f32) {
        for row in 0..GOL_ROWS {
            self.grid[row] = 0;
            for col in 0..GOL_COLS {
                if self.next_random() < density {
                    self.grid[row] |= 1 << col;
                }
            }
        }
        self.generation = 0;
    }

    /// Simple LCG random
    fn next_random(&mut self) -> f32 {
        self.rng_state = self.rng_state.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.rng_state as f32) / (u32::MAX as f32)
    }

    /// Read alive cells in current playhead column, return CV
    fn column_to_cv(&self, col: usize, range: f32, scale_idx: i32, root: i32) -> (f32, bool) {
        // Find alive cells in this column
        let mut lowest_row: Option<usize> = None;
        let mut _alive_count = 0u32;

        for row in 0..GOL_ROWS {
            if (self.grid[row] >> col) & 1 == 1 {
                _alive_count += 1;
                if lowest_row.is_none() {
                    lowest_row = Some(row);
                }
            }
        }

        match lowest_row {
            None => (self.current_cv, false), // No cells alive → gate off, hold last CV
            Some(row) => {
                // Map row to pitch: row 0 = lowest, row 15 = highest
                let normalized = row as f32 / (GOL_ROWS - 1) as f32; // 0..1
                let cv_raw = (normalized - 0.5) * range; // Center around 0

                let cv = if scale_idx > 0 {
                    quantize_pitch(cv_raw, scale_idx, root)
                } else {
                    cv_raw
                };
                (cv, true)
            }
        }
    }

    /// Set grid from cell data string (JSON array of row bitmasks)
    pub fn set_cell_data(&mut self, data: &str) {
        // Format: "[row0,row1,...,row15]" where each value is a u16 bitmask
        // Manual JSON array parsing (no serde_json dependency)
        if data.starts_with('[') && data.ends_with(']') {
            let inner = &data[1..data.len() - 1];
            let mut i = 0;
            for part in inner.split(',') {
                if i >= GOL_ROWS { break; }
                if let Ok(val) = part.trim().parse::<u16>() {
                    self.grid[i] = val;
                    i += 1;
                }
            }
        } else if data == "randomize" {
            self.randomize(0.3);
        } else if data == "clear" {
            self.clear();
        } else if data == "r-pentomino" {
            self.seed_r_pentomino();
        } else if data.starts_with("random:") {
            if let Ok(density) = data[7..].parse::<f32>() {
                self.randomize(density.clamp(0.05, 0.95));
            }
        }
    }

    pub fn process_block(
        &mut self,
        out_cv: &mut [f32],
        out_gate: &mut [f32],
        out_pulse: &mut [f32],
        out_density: &mut [f32],
        inputs: GameOfLifeInputs,
        params: GameOfLifeParams,
    ) {
        let clock_in = inputs.clock.unwrap_or(&[]);
        let reset_in = inputs.reset.unwrap_or(&[]);
        let pulse_samples = (0.005 * self.sample_rate) as i32;

        // Count total alive cells for density output
        let total_alive: u32 = self.grid.iter().map(|r| r.count_ones()).sum();
        let density = total_alive as f32 / (GOL_COLS * GOL_ROWS) as f32;

        for i in 0..out_cv.len() {
            let clock = sample_at(clock_in, i, 0.0);
            let reset = sample_at(reset_in, i, 0.0);
            let evolve_rate = sample_at(params.evolve_rate, i, 4.0).clamp(1.0, 16.0) as usize;
            let range = sample_at(params.range, i, 2.0).clamp(1.0, 5.0);
            let scale_idx = sample_at(params.scale, i, 0.0) as i32;
            let root = sample_at(params.root, i, 0.0) as i32;
            let wrap = sample_at(params.wrap, i, 1.0) > 0.5;

            // Reset detection
            if reset > 0.5 && self.last_reset <= 0.5 {
                self.playhead = 0;
                self.step_count = 0;
                self.seed_r_pentomino();
                self.generation = 0;
            }
            self.last_reset = reset;

            // Clock detection (rising edge)
            if clock > 0.5 && self.last_clock <= 0.5 {
                // Advance playhead
                self.playhead = (self.playhead + 1) % GOL_COLS;
                self.step_count += 1;

                // Evolve grid every N steps
                if self.step_count >= evolve_rate {
                    self.evolve(wrap);
                    self.step_count = 0;
                }

                // Read column and generate CV/gate
                let (cv, gate) = self.column_to_cv(self.playhead, range, scale_idx, root);
                self.current_cv = cv;
                self.gate_state = if gate { 1.0 } else { 0.0 };

                // Trigger pulse
                if gate {
                    self.trigger_timer = pulse_samples;
                }
            }
            self.last_clock = clock;

            // Outputs
            out_cv[i] = self.current_cv;
            out_gate[i] = self.gate_state;
            out_density[i] = density;

            if self.trigger_timer > 0 {
                out_pulse[i] = 1.0;
                self.trigger_timer -= 1;
            } else {
                out_pulse[i] = 0.0;
            }
        }
    }

    /// Get current playhead position (for UI)
    pub fn current_step(&self) -> usize {
        self.playhead
    }

    /// Get grid state (for UI visualization)
    pub fn grid_state(&self) -> &[u16; GOL_ROWS] {
        &self.grid
    }

    /// Get generation counter
    pub fn generation(&self) -> u32 {
        self.generation
    }
}

/// Quantize a pitch value (in octaves) to a scale
fn quantize_pitch(value: f32, scale_idx: i32, root: i32) -> f32 {
    let note_in = value * 12.0;
    let scale_notes = get_scale_notes(scale_idx);
    if scale_notes.is_empty() {
        return value;
    }

    let root_note = root as f32;
    let mut best_note = 0.0f32;
    let mut min_dist = 1000.0f32;
    let base_octave = (note_in / 12.0).floor() as i32;

    for oct in (base_octave - 1)..=(base_octave + 1) {
        for &interval in scale_notes {
            let candidate = (oct * 12) as f32 + interval as f32 + root_note;
            let dist = (note_in - candidate).abs();
            if dist < min_dist {
                min_dist = dist;
                best_note = candidate;
            }
        }
    }
    best_note / 12.0
}
