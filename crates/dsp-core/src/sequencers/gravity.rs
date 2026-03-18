//! Gravity Sequencer
//!
//! A gravitational sequencer where orbital bodies generate musical events.
//! Up to 4 bodies orbit a central attractor following Kepler's laws.
//! Each body triggers a gate at perihelion (closest approach) and outputs
//! CV based on its orbital distance.

use crate::common::{sample_at, get_scale_notes};

const MAX_BODIES: usize = 8;

/// Base orbital periods — musically interesting irrational ratios
/// These are pairwise irrational, so bodies never fully sync → rich polyrhythms
const BASE_PERIODS: [f32; MAX_BODIES] = [
    1.000,  // Body 1: fundamental
    1.618,  // Body 2: φ (golden ratio)
    2.236,  // Body 3: √5
    2.718,  // Body 4: e (Euler's)
    3.141,  // Body 5: π
    3.606,  // Body 6: √13
    4.236,  // Body 7: φ³
    5.385,  // Body 8: √29
];

/// Parameters for the Gravity Sequencer
#[derive(Debug, Clone)]
pub struct GravityParams<'a> {
    /// Global speed multiplier (0.1-10)
    pub speed: &'a [f32],
    /// Number of active bodies (1-4)
    pub bodies: &'a [f32],
    /// Orbit eccentricity (0=circle, 0.9=very elliptical)
    pub eccentricity: &'a [f32],
    /// Period spread between bodies (0.5-4)
    pub spread: &'a [f32],
    /// Output range in octaves (1-5)
    pub range: &'a [f32],
    /// Scale quantization (0 = off)
    pub scale: &'a [f32],
    /// Root note (0-11)
    pub root: &'a [f32],
    /// Chaos: random perturbation amount (0-1)
    pub chaos: &'a [f32],
}

impl<'a> Default for GravityParams<'a> {
    fn default() -> Self {
        Self {
            speed: &[1.0],
            bodies: &[4.0],
            eccentricity: &[0.3],
            spread: &[1.0],
            range: &[2.0],
            scale: &[0.0],
            root: &[0.0],
            chaos: &[0.0],
        }
    }
}

/// Inputs for the Gravity Sequencer
pub struct GravityInputs<'a> {
    pub reset: Option<&'a [f32]>,
}

/// State of a single orbital body
#[derive(Debug, Clone)]
struct OrbitalBody {
    /// Mean anomaly (advances linearly, 0 to 2π)
    mean_anomaly: f32,
    /// Angular velocity (radians per sample)
    angular_velocity: f32,
    /// Current true anomaly (actual angle)
    true_anomaly: f32,
    /// Current orbital distance (normalized)
    distance: f32,
    /// Current x,y position (for UI visualization)
    x: f32,
    y: f32,
    /// Previous mean anomaly (for orbit completion detection)
    prev_mean_anomaly: f32,
    /// Whether this body just triggered
    triggered: bool,
}

impl OrbitalBody {
    fn new() -> Self {
        Self {
            mean_anomaly: 0.0,
            angular_velocity: 0.0,
            true_anomaly: 0.0,
            distance: 1.0,
            x: 1.0,
            y: 0.0,
            prev_mean_anomaly: 0.0,
            triggered: false,
        }
    }
}

/// Gravity Sequencer
#[derive(Debug, Clone)]
pub struct GravitySequencer {
    bodies: [OrbitalBody; MAX_BODIES],
    sample_rate: f32,
    inv_sample_rate: f32,
    last_reset: f32,
    /// CV from last triggered body
    current_cv: f32,
    /// Gate state (merged from all bodies)
    gate_state: f32,
    /// Per-body trigger timers
    trigger_timers: [i32; MAX_BODIES],
    /// RNG state for chaos (reserved for future use)
    #[allow(dead_code)]
    rng_state: u32,
}

impl GravitySequencer {
    pub fn new(sample_rate: f32) -> Self {
        let mut bodies = core::array::from_fn(|_| OrbitalBody::new());
        // Initialize with spread-out phases
        for (i, body) in bodies.iter_mut().enumerate() {
            body.mean_anomaly = (i as f32 / MAX_BODIES as f32) * std::f32::consts::TAU;
        }

        Self {
            bodies,
            sample_rate,
            inv_sample_rate: 1.0 / sample_rate,
            last_reset: 0.0,
            current_cv: 0.0,
            gate_state: 0.0,
            trigger_timers: [0; MAX_BODIES],
            rng_state: 0xCAFE_BABE,
        }
    }

    #[allow(dead_code)]
    fn next_random(&mut self) -> f32 {
        self.rng_state = self.rng_state.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.rng_state as f32) / (u32::MAX as f32)
    }

    pub fn process_block(
        &mut self,
        out_cv: &mut [f32],
        out_gate: &mut [f32],
        out_pulse: &mut [f32],
        out_x: &mut [f32],
        out_y: &mut [f32],
        inputs: GravityInputs,
        params: GravityParams,
    ) {
        let reset_in = inputs.reset.unwrap_or(&[]);
        let pulse_samples = (0.005 * self.sample_rate) as i32;

        for i in 0..out_cv.len() {
            let speed = sample_at(params.speed, i, 1.0).clamp(0.1, 10.0);
            let num_bodies = sample_at(params.bodies, i, 4.0).clamp(1.0, 8.0) as usize;
            let ecc = sample_at(params.eccentricity, i, 0.3).clamp(0.0, 0.9);
            let spread = sample_at(params.spread, i, 1.0).clamp(0.5, 4.0);
            let range = sample_at(params.range, i, 2.0).clamp(1.0, 5.0);
            let scale_idx = sample_at(params.scale, i, 0.0) as i32;
            let root = sample_at(params.root, i, 0.0) as i32;
            let chaos = sample_at(params.chaos, i, 0.0).clamp(0.0, 1.0);
            let reset = sample_at(reset_in, i, 0.0);

            // Reset detection
            if reset > 0.5 && self.last_reset <= 0.5 {
                for (j, body) in self.bodies.iter_mut().enumerate() {
                    body.mean_anomaly = (j as f32 / MAX_BODIES as f32) * std::f32::consts::TAU;
                    body.prev_mean_anomaly = body.mean_anomaly;
                }
            }
            self.last_reset = reset;

            // Base angular velocity: complete orbit in ~1 second at speed=1
            let base_omega = std::f32::consts::TAU * speed * self.inv_sample_rate;

            let mut any_triggered = false;

            for j in 0..MAX_BODIES {
                if j >= num_bodies {
                    self.trigger_timers[j] = 0;
                    continue;
                }

                let body = &mut self.bodies[j];

                // Compute angular velocity for this body (spread by period ratio)
                let period_ratio = BASE_PERIODS[j].powf(spread);
                body.angular_velocity = base_omega / period_ratio;

                // Add chaos perturbation
                let chaos_offset = if chaos > 0.0 {
                    // Use a deterministic but chaotic perturbation
                    let phase = body.mean_anomaly * 3.0 + j as f32 * 7.0;
                    chaos * 0.01 * phase.sin() * body.angular_velocity
                } else {
                    0.0
                };

                // Advance mean anomaly
                body.prev_mean_anomaly = body.mean_anomaly;
                body.mean_anomaly += body.angular_velocity + chaos_offset;

                // Detect orbit completion: mean anomaly wraps past 2π (perihelion)
                body.triggered = false;
                if body.mean_anomaly >= std::f32::consts::TAU {
                    body.mean_anomaly -= std::f32::consts::TAU;
                    body.triggered = true;
                    any_triggered = true;
                    self.trigger_timers[j] = pulse_samples;

                    // Generate CV from body index mapped to pitch range
                    let pitch_normalized = j as f32 / (num_bodies - 1).max(1) as f32;
                    let cv_raw = (pitch_normalized - 0.5) * range;

                    self.current_cv = if scale_idx > 0 {
                        quantize_pitch(cv_raw, scale_idx, root)
                    } else {
                        cv_raw
                    };
                } else if body.mean_anomaly < 0.0 {
                    body.mean_anomaly += std::f32::consts::TAU;
                }

                // Solve Kepler's equation: E - e*sin(E) = M
                let eccentric_anomaly = solve_kepler(body.mean_anomaly, ecc);

                // True anomaly from eccentric anomaly
                body.true_anomaly = true_anomaly_from_eccentric(eccentric_anomaly, ecc);

                // Orbital distance: r = a(1 - e*cos(E))
                body.distance = 1.0 - ecc * eccentric_anomaly.cos();

                // Position (for visualization)
                body.x = body.distance * body.true_anomaly.cos();
                body.y = body.distance * body.true_anomaly.sin();
            }

            // Gate: high while any trigger timer is active
            self.gate_state = if any_triggered || self.trigger_timers.iter().any(|&t| t > 0) {
                1.0
            } else {
                0.0
            };

            // Outputs
            out_cv[i] = self.current_cv;
            out_gate[i] = self.gate_state;

            // Pulse: merged triggers
            let mut pulse = 0.0f32;
            for j in 0..MAX_BODIES {
                if self.trigger_timers[j] > 0 {
                    pulse = 1.0;
                    self.trigger_timers[j] -= 1;
                }
            }
            out_pulse[i] = pulse;

            // X/Y output from body 0 (for modulation / visualization)
            out_x[i] = if num_bodies > 0 { self.bodies[0].x } else { 0.0 };
            out_y[i] = if num_bodies > 0 { self.bodies[0].y } else { 0.0 };
        }
    }

    /// Get body positions for UI visualization
    pub fn body_positions(&self) -> [(f32, f32); MAX_BODIES] {
        let mut positions = [(0.0f32, 0.0f32); MAX_BODIES];
        for (i, body) in self.bodies.iter().enumerate() {
            positions[i] = (body.x, body.y);
        }
        positions
    }

    /// Get body distances for UI
    pub fn body_distances(&self) -> [f32; MAX_BODIES] {
        let mut distances = [0.0f32; MAX_BODIES];
        for (i, body) in self.bodies.iter().enumerate() {
            distances[i] = body.distance;
        }
        distances
    }
}

/// Solve Kepler's equation E - e*sin(E) = M using Newton-Raphson
fn solve_kepler(mean_anomaly: f32, eccentricity: f32) -> f32 {
    let mut e_anom = mean_anomaly; // Initial guess
    for _ in 0..5 {
        let f = e_anom - eccentricity * e_anom.sin() - mean_anomaly;
        let f_prime = 1.0 - eccentricity * e_anom.cos();
        if f_prime.abs() > 1e-10 {
            e_anom -= f / f_prime;
        }
    }
    e_anom
}

/// Convert eccentric anomaly to true anomaly
fn true_anomaly_from_eccentric(eccentric_anomaly: f32, eccentricity: f32) -> f32 {
    let half_e = eccentric_anomaly * 0.5;
    let sin_half = half_e.sin();
    let cos_half = half_e.cos();
    let factor_a = (1.0 + eccentricity).sqrt() * sin_half;
    let factor_b = (1.0 - eccentricity).sqrt() * cos_half;
    2.0 * factor_a.atan2(factor_b)
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
