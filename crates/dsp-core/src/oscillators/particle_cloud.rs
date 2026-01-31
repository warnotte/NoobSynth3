//! Particle Cloud synthesizer - visual granular synthesis with animated particles.
//!
//! Each particle represents a grain with position-based audio mapping:
//! - X position (0-1) → Pan (-1 to +1)
//! - Y position (0-1) → Pitch multiplier (0.5x to 2x)
//!
//! Supports three audio modes:
//! - OSC: Internal oscillator per particle (sine, tri, saw, square, noise)
//! - SAMPLE: Granular playback from loaded buffer
//! - INPUT: Granular processing of external audio input

use crate::common::{input_at, sample_at, Sample};

/// Maximum buffer size in samples (~10 seconds at 48kHz)
const MAX_BUFFER_SAMPLES: usize = 480_000;

/// Maximum number of particles
const MAX_PARTICLES: usize = 32;

/// Audio source mode
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ParticleMode {
    Osc,    // Internal oscillator
    Sample, // Buffer playback
    Input,  // External audio granulation
}

impl ParticleMode {
    pub fn from_index(index: usize) -> Self {
        match index {
            0 => ParticleMode::Osc,
            1 => ParticleMode::Sample,
            2 => ParticleMode::Input,
            _ => ParticleMode::Osc,
        }
    }
}

/// Oscillator shape for Osc mode
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum OscShape {
    Sine,
    Triangle,
    Sawtooth,
    Square,
    Noise,
}

impl OscShape {
    pub fn from_index(index: usize) -> Self {
        match index {
            0 => OscShape::Sine,
            1 => OscShape::Triangle,
            2 => OscShape::Sawtooth,
            3 => OscShape::Square,
            4 => OscShape::Noise,
            _ => OscShape::Sine,
        }
    }
}

/// A single particle with physics and grain state
#[derive(Clone, Copy)]
struct Particle {
    /// Is this particle active?
    active: bool,
    /// X position (0-1), maps to pan
    x: f32,
    /// Y position (0-1), maps to pitch
    y: f32,
    /// X velocity
    vx: f32,
    /// Y velocity
    vy: f32,
    /// Current age (seconds)
    age: f32,
    /// Total lifetime (seconds)
    lifetime: f32,
    /// Grain oscillator phase (0-1 for osc, buffer position for sample)
    grain_phase: f32,
    /// Grain current age in samples
    grain_age: usize,
    /// Grain total length in samples
    grain_length: usize,
    /// Noise state for this particle
    noise_state: u32,
}

impl Default for Particle {
    fn default() -> Self {
        Self {
            active: false,
            x: 0.5,
            y: 0.5,
            vx: 0.0,
            vy: 0.0,
            age: 0.0,
            lifetime: 3.0,
            grain_phase: 0.0,
            grain_age: 0,
            grain_length: 4800, // 100ms @ 48kHz
            noise_state: 0xDEADBEEF,
        }
    }
}

impl Particle {
    fn next_random(&mut self) -> f32 {
        self.noise_state = self.noise_state
            .wrapping_mul(1664525)
            .wrapping_add(1013904223);
        let raw = (self.noise_state >> 9) as f32 / 8_388_608.0;
        raw * 2.0 - 1.0 // -1 to 1
    }

    fn next_random_01(&mut self) -> f32 {
        (self.next_random() + 1.0) * 0.5
    }
}

/// Particle Cloud synthesizer.
///
/// Visual granular synthesis where animated particles generate audio grains.
/// Each particle's position maps to audio parameters:
/// - X → stereo pan
/// - Y → pitch multiplier
pub struct ParticleCloud {
    sample_rate: f32,
    /// Particles pool
    particles: [Particle; MAX_PARTICLES],
    /// Number of active particles (controlled by count param)
    target_count: usize,
    /// Audio mode
    mode: ParticleMode,
    /// Oscillator shape (for Osc mode)
    osc_shape: OscShape,
    /// Audio buffer (for Sample mode)
    buffer: Vec<Sample>,
    /// Buffer length in samples
    buffer_length: usize,
    /// Input capture buffer (for Input mode - circular)
    input_buffer: Vec<Sample>,
    /// Input buffer write position
    input_write_pos: usize,
    /// Global random seed
    _rng_state: u32,
    /// Base frequency for oscillator mode (Hz)
    base_freq: f32,
    /// Positions cache for UI polling (x, y pairs flattened)
    positions_cache: [f32; MAX_PARTICLES * 2],
    /// Active count cache for UI
    active_count_cache: usize,
}

/// Parameters for ParticleCloud.
pub struct ParticleCloudParams<'a> {
    /// Number of particles (1-32)
    pub count: &'a [Sample],
    /// Gravity force (-1 to +1)
    pub gravity: &'a [Sample],
    /// Turbulence amount (0-1)
    pub turbulence: &'a [Sample],
    /// Friction/damping (0-1)
    pub friction: &'a [Sample],
    /// Grain size in ms (10-500)
    pub grain_size: &'a [Sample],
    /// Base pitch multiplier (0.25-4)
    pub pitch: &'a [Sample],
    /// Stereo spread (0-1)
    pub spread: &'a [Sample],
    /// Output level (0-1)
    pub level: &'a [Sample],
    /// Mode (0=Osc, 1=Sample, 2=Input)
    pub mode: &'a [Sample],
    /// Oscillator shape (0-4) for Osc mode
    pub osc_shape: &'a [Sample],
}

/// Input signals for ParticleCloud.
pub struct ParticleCloudInputs<'a> {
    /// Audio input (for Input mode)
    pub audio_in: Option<&'a [Sample]>,
    /// Trigger input (reset/burst)
    pub trigger: Option<&'a [Sample]>,
}

impl ParticleCloud {
    /// Create a new particle cloud synthesizer.
    pub fn new(sample_rate: f32) -> Self {
        let sr = sample_rate.max(1.0);
        // Input buffer: 500ms circular buffer for input granulation
        let input_buf_size = (sr * 0.5) as usize;

        let mut cloud = Self {
            sample_rate: sr,
            particles: [Particle::default(); MAX_PARTICLES],
            target_count: 16,
            mode: ParticleMode::Osc,
            osc_shape: OscShape::Sine,
            buffer: vec![0.0; MAX_BUFFER_SAMPLES],
            buffer_length: 0,
            input_buffer: vec![0.0; input_buf_size],
            input_write_pos: 0,
            _rng_state: 0xCAFEBABE,
            base_freq: 220.0,
            positions_cache: [0.0; MAX_PARTICLES * 2],
            active_count_cache: 0,
        };

        // Initialize particles with random positions
        for (i, p) in cloud.particles.iter_mut().enumerate() {
            p.noise_state = 0xDEADBEEF_u32.wrapping_add(i as u32 * 12345);
            p.x = p.next_random_01();
            p.y = p.next_random_01();
            p.vx = p.next_random() * 0.1;
            p.vy = p.next_random() * 0.1;
            p.lifetime = 2.0 + p.next_random_01() * 4.0;
            p.age = p.next_random_01() * p.lifetime; // Stagger initial ages
            p.active = i < 16; // Default 16 active
        }

        // Initialize positions cache for UI polling before first process_block
        let mut active = 0;
        for (idx, p) in cloud.particles.iter().enumerate() {
            cloud.positions_cache[idx * 2] = p.x;
            cloud.positions_cache[idx * 2 + 1] = p.y;
            if p.active {
                active += 1;
            }
        }
        cloud.active_count_cache = active;

        cloud
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Load sample data into the buffer (for Sample mode).
    pub fn load_buffer(&mut self, data: &[Sample]) {
        let len = data.len().min(MAX_BUFFER_SAMPLES);
        self.buffer[..len].copy_from_slice(&data[..len]);
        self.buffer_length = len;
        // Clear remaining buffer
        for i in len..self.buffer.len() {
            self.buffer[i] = 0.0;
        }
    }

    /// Check if buffer has content.
    pub fn has_buffer(&self) -> bool {
        self.buffer_length > 0
    }

    /// Get buffer length in samples.
    pub fn buffer_length(&self) -> usize {
        self.buffer_length
    }

    /// Get particle positions for UI visualization.
    /// Returns flattened array: [x0, y0, x1, y1, ..., x31, y31]
    pub fn get_positions(&self) -> &[f32; MAX_PARTICLES * 2] {
        &self.positions_cache
    }

    /// Get active particle count for UI.
    pub fn get_active_count(&self) -> usize {
        self.active_count_cache
    }

    fn _next_random(&mut self) -> f32 {
        self._rng_state = self._rng_state
            .wrapping_mul(1664525)
            .wrapping_add(1013904223);
        let raw = (self._rng_state >> 9) as f32 / 8_388_608.0;
        raw * 2.0 - 1.0
    }

    fn _next_random_01(&mut self) -> f32 {
        (self._next_random() + 1.0) * 0.5
    }

    /// Respawn a particle with random position and velocity
    fn _respawn_particle(&mut self, idx: usize) {
        let p = &mut self.particles[idx];
        p.x = p.next_random_01();
        p.y = p.next_random_01();
        p.vx = p.next_random() * 0.2;
        p.vy = p.next_random() * 0.2;
        p.age = 0.0;
        p.lifetime = 2.0 + p.next_random_01() * 4.0;
        p.grain_phase = p.next_random_01();
        p.grain_age = 0;
    }

    /// Calculate grain envelope (Hann window)
    fn grain_envelope(phase: f32) -> f32 {
        0.5 * (1.0 - (phase * std::f32::consts::TAU).cos())
    }

    /// Generate oscillator sample for a particle
    fn generate_osc_sample(shape: OscShape, phase: f32, particle: &mut Particle) -> f32 {
        match shape {
            OscShape::Sine => (phase * std::f32::consts::TAU).sin(),
            OscShape::Triangle => {
                let t = phase * 4.0;
                if t < 1.0 {
                    t
                } else if t < 3.0 {
                    2.0 - t
                } else {
                    t - 4.0
                }
            }
            OscShape::Sawtooth => phase * 2.0 - 1.0,
            OscShape::Square => if phase < 0.5 { 1.0 } else { -1.0 },
            OscShape::Noise => particle.next_random(),
        }
    }

    /// Read sample from buffer with linear interpolation (static to avoid borrow issues)
    fn read_buffer_sample_from(buffer: &[Sample], buffer_length: usize, index: f32) -> f32 {
        if buffer_length == 0 {
            return 0.0;
        }
        let len = buffer_length as f32;
        let mut idx = index % len;
        if idx < 0.0 {
            idx += len;
        }
        let base = idx.floor() as usize;
        let frac = idx - base as f32;
        let next = (base + 1) % buffer_length;
        let a = buffer[base];
        let b = buffer[next];
        a + (b - a) * frac
    }

    /// Read sample from input buffer (static to avoid borrow issues)
    fn read_input_sample_from(input_buffer: &[Sample], write_pos: usize, offset: usize) -> f32 {
        let len = input_buffer.len();
        if len == 0 {
            return 0.0;
        }
        let idx = (write_pos + len - offset) % len;
        input_buffer[idx]
    }

    /// Process a block of audio, producing stereo output.
    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: ParticleCloudInputs<'_>,
        params: ParticleCloudParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        let frames = out_l.len();
        let dt = 1.0 / self.sample_rate;
        let physics_dt = dt * 64.0; // Update physics every ~64 samples worth

        for i in 0..frames {
            // Read parameters
            let count = sample_at(params.count, i, 16.0).clamp(1.0, 32.0) as usize;
            let gravity = sample_at(params.gravity, i, 0.0).clamp(-1.0, 1.0);
            let turbulence = sample_at(params.turbulence, i, 0.3).clamp(0.0, 1.0);
            let friction = sample_at(params.friction, i, 0.1).clamp(0.0, 1.0);
            let grain_size_ms = sample_at(params.grain_size, i, 100.0).clamp(10.0, 500.0);
            let base_pitch = sample_at(params.pitch, i, 1.0).clamp(0.25, 4.0);
            let spread = sample_at(params.spread, i, 0.8).clamp(0.0, 1.0);
            let level = sample_at(params.level, i, 0.8).clamp(0.0, 1.0);
            let mode_idx = sample_at(params.mode, i, 0.0) as usize;
            let shape_idx = sample_at(params.osc_shape, i, 0.0) as usize;

            self.mode = ParticleMode::from_index(mode_idx);
            self.osc_shape = OscShape::from_index(shape_idx);
            self.target_count = count;

            let grain_length = (grain_size_ms * self.sample_rate / 1000.0).max(1.0) as usize;

            // Capture input audio (for Input mode)
            let input_sample = input_at(inputs.audio_in, i);
            let input_len = self.input_buffer.len();
            if input_len > 0 {
                self.input_buffer[self.input_write_pos] = input_sample;
                self.input_write_pos = (self.input_write_pos + 1) % input_len;
            }

            // Update particle active states based on count
            for (idx, p) in self.particles.iter_mut().enumerate() {
                if idx < count {
                    if !p.active {
                        p.active = true;
                        // Respawn when becoming active
                        p.x = p.next_random_01();
                        p.y = p.next_random_01();
                        p.vx = p.next_random() * 0.2;
                        p.vy = p.next_random() * 0.2;
                        p.age = 0.0;
                        p.lifetime = 2.0 + p.next_random_01() * 4.0;
                    }
                } else {
                    p.active = false;
                }
            }

            // Physics update (every sample but scaled by dt)
            let should_update_physics = i % 64 == 0;
            if should_update_physics {
                for idx in 0..MAX_PARTICLES {
                    let p = &mut self.particles[idx];
                    if !p.active {
                        continue;
                    }

                    // Gravity (affects Y velocity)
                    p.vy += gravity * physics_dt * 2.0;

                    // Turbulence (random acceleration)
                    if turbulence > 0.001 {
                        p.vx += p.next_random() * turbulence * physics_dt * 5.0;
                        p.vy += p.next_random() * turbulence * physics_dt * 5.0;
                    }

                    // Friction (velocity damping)
                    let friction_factor = 1.0 - friction * physics_dt * 3.0;
                    p.vx *= friction_factor;
                    p.vy *= friction_factor;

                    // Move
                    p.x += p.vx * physics_dt;
                    p.y += p.vy * physics_dt;

                    // Bounce on boundaries
                    if p.x < 0.0 {
                        p.x = -p.x;
                        p.vx = -p.vx * 0.7;
                    }
                    if p.x > 1.0 {
                        p.x = 2.0 - p.x;
                        p.vx = -p.vx * 0.7;
                    }
                    if p.y < 0.0 {
                        p.y = -p.y;
                        p.vy = -p.vy * 0.7;
                    }
                    if p.y > 1.0 {
                        p.y = 2.0 - p.y;
                        p.vy = -p.vy * 0.7;
                    }

                    // Clamp to bounds
                    p.x = p.x.clamp(0.0, 1.0);
                    p.y = p.y.clamp(0.0, 1.0);

                    // Age particle
                    p.age += physics_dt;
                    if p.age >= p.lifetime {
                        // Respawn
                        p.x = p.next_random_01();
                        p.y = p.next_random_01();
                        p.vx = p.next_random() * 0.2;
                        p.vy = p.next_random() * 0.2;
                        p.age = 0.0;
                        p.lifetime = 2.0 + p.next_random_01() * 4.0;
                        p.grain_phase = p.next_random_01();
                        p.grain_age = 0;
                    }
                }
            }

            // Generate audio from particles
            let mut sum_l = 0.0;
            let mut sum_r = 0.0;
            let mut active_count = 0;

            for idx in 0..MAX_PARTICLES {
                let p = &mut self.particles[idx];
                if !p.active {
                    continue;
                }
                active_count += 1;

                // Y position maps to pitch (0.5x to 2x = ±1 octave)
                // Y=0 (bottom) -> 2x pitch, Y=1 (top) -> 0.5x pitch
                let y_pitch = 2.0_f32.powf(1.0 - p.y * 2.0);
                let final_pitch = base_pitch * y_pitch;

                // X position maps to pan (-1 to +1)
                let pan = (p.x * 2.0 - 1.0) * spread;

                // Grain envelope
                let grain_phase = if p.grain_length > 0 {
                    p.grain_age as f32 / p.grain_length as f32
                } else {
                    0.0
                };
                let envelope = Self::grain_envelope(grain_phase);

                // Generate audio based on mode
                let sample = match self.mode {
                    ParticleMode::Osc => {
                        // Oscillator mode - each particle is an oscillator
                        let freq = self.base_freq * final_pitch;
                        let phase_inc = freq / self.sample_rate;
                        p.grain_phase = (p.grain_phase + phase_inc) % 1.0;
                        Self::generate_osc_sample(self.osc_shape, p.grain_phase, p)
                    }
                    ParticleMode::Sample => {
                        // Sample mode - each particle reads from buffer
                        if self.buffer_length > 0 {
                            let buf_pos = p.grain_phase * self.buffer_length as f32;
                            let sample = Self::read_buffer_sample_from(&self.buffer, self.buffer_length, buf_pos);
                            // Advance position based on pitch
                            p.grain_phase = (p.grain_phase + final_pitch / self.buffer_length as f32) % 1.0;
                            sample
                        } else {
                            0.0
                        }
                    }
                    ParticleMode::Input => {
                        // Input mode - granulate the input buffer
                        let offset = ((1.0 - p.grain_phase) * input_len as f32) as usize;
                        let sample = Self::read_input_sample_from(&self.input_buffer, self.input_write_pos, offset.min(input_len - 1));
                        // Advance grain position
                        let advance = final_pitch / (grain_length as f32);
                        p.grain_phase = (p.grain_phase + advance) % 1.0;
                        sample
                    }
                };

                // Apply envelope and pan
                let out = sample * envelope;
                let pan_l = (0.5 * (1.0 - pan)).sqrt();
                let pan_r = (0.5 * (1.0 + pan)).sqrt();
                sum_l += out * pan_l;
                sum_r += out * pan_r;

                // Update grain age
                p.grain_age += 1;
                if p.grain_age >= p.grain_length {
                    p.grain_age = 0;
                    p.grain_length = grain_length;
                    // Small random variation in grain start phase
                    if self.mode != ParticleMode::Osc {
                        p.grain_phase = p.next_random_01();
                    }
                }
            }

            // Normalize by sqrt of active count to prevent too loud with many particles
            let norm = if active_count > 0 {
                1.0 / (active_count as f32).sqrt()
            } else {
                1.0
            };

            out_l[i] = sum_l * norm * level;
            out_r[i] = sum_r * norm * level;
        }

        // Update positions cache for UI
        let mut active = 0;
        for (idx, p) in self.particles.iter().enumerate() {
            self.positions_cache[idx * 2] = p.x;
            self.positions_cache[idx * 2 + 1] = p.y;
            if p.active {
                active += 1;
            }
        }
        self.active_count_cache = active;
    }
}
