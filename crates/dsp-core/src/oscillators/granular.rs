//! Granular synthesizer - sample-based granular synthesis.
//!
//! Plays back a loaded audio buffer using multiple overlapping grains
//! with control over position, size, density, pitch, and randomization.

use crate::common::{input_at, sample_at, Sample};

/// Maximum buffer size in samples (~10 seconds at 48kHz)
const MAX_BUFFER_SAMPLES: usize = 480_000;

/// Maximum number of simultaneous grains
const MAX_GRAINS: usize = 12;

/// Grain envelope shapes
#[derive(Clone, Copy, PartialEq)]
pub enum GrainShape {
    Triangle,  // Linear fade in/out
    Hann,      // Raised cosine (smooth)
    Tukey,     // Flat top with tapered edges
    Gauss,     // Gaussian bell curve
}

impl GrainShape {
    pub fn from_index(index: usize) -> Self {
        match index {
            0 => GrainShape::Triangle,
            1 => GrainShape::Hann,
            2 => GrainShape::Tukey,
            _ => GrainShape::Gauss,
        }
    }

    /// Calculate envelope value at phase (0.0 to 1.0)
    pub fn envelope(&self, phase: f32) -> f32 {
        match self {
            GrainShape::Triangle => {
                // Triangle: 0->1->0
                1.0 - (phase * 2.0 - 1.0).abs()
            }
            GrainShape::Hann => {
                // Hann window: raised cosine
                0.5 * (1.0 - (phase * std::f32::consts::TAU).cos())
            }
            GrainShape::Tukey => {
                // Tukey window: flat top with 25% taper on each side
                let taper = 0.25;
                if phase < taper {
                    0.5 * (1.0 - (std::f32::consts::PI * phase / taper).cos())
                } else if phase > 1.0 - taper {
                    0.5 * (1.0 - (std::f32::consts::PI * (1.0 - phase) / taper).cos())
                } else {
                    1.0
                }
            }
            GrainShape::Gauss => {
                // Gaussian: bell curve centered at 0.5
                let x = (phase - 0.5) * 4.0; // -2 to 2
                (-x * x * 0.5).exp()
            }
        }
    }
}

/// A single grain for granular processing.
#[derive(Clone, Copy)]
struct Grain {
    active: bool,
    /// Position in buffer (samples, fractional)
    pos: f32,
    /// Playback rate (1.0 = original pitch)
    rate: f32,
    /// Current age in samples
    age: usize,
    /// Total length in samples
    length: usize,
    /// Pan position (-1 to 1)
    pan: f32,
    /// Envelope shape
    shape: GrainShape,
}

impl Default for Grain {
    fn default() -> Self {
        Self {
            active: false,
            pos: 0.0,
            rate: 1.0,
            age: 0,
            length: 1,
            pan: 0.0,
            shape: GrainShape::Hann,
        }
    }
}

/// Granular synthesizer.
///
/// Sample-based granular synthesis with controllable position,
/// grain size, density, pitch shifting, and randomization.
///
/// # Features
///
/// - Load samples up to ~10 seconds
/// - Record from audio input
/// - 12 simultaneous grains
/// - Multiple grain envelope shapes
/// - CV modulation of position and pitch
/// - Stereo output with pan spread
pub struct Granular {
    sample_rate: f32,
    /// Audio buffer (mono, will be converted on load)
    buffer: Vec<Sample>,
    /// Buffer length in samples (may be less than buffer.len())
    buffer_length: usize,
    /// Grains pool
    grains: [Grain; MAX_GRAINS],
    /// Phase accumulator for grain spawning
    spawn_phase: f32,
    /// Random seed
    seed: u32,
    /// Recording state
    recording: bool,
    /// Record write position
    record_pos: usize,
    /// Last trigger state for edge detection
    last_trigger: f32,
    /// Playback enabled (internal state)
    playing: bool,
    /// Enabled from UI (parameter)
    enabled: bool,
}

/// Input signals for Granular.
pub struct GranularInputs<'a> {
    /// Audio input for recording
    pub audio_in: Option<&'a [Sample]>,
    /// Trigger input (gate to start/reset)
    pub trigger: Option<&'a [Sample]>,
    /// Position CV modulation (adds to base position)
    pub position_cv: Option<&'a [Sample]>,
    /// Pitch CV modulation (1V/oct style, adds to base pitch)
    pub pitch_cv: Option<&'a [Sample]>,
}

/// Parameters for Granular.
pub struct GranularParams<'a> {
    /// Position in buffer (0.0-1.0)
    pub position: &'a [Sample],
    /// Grain size in ms (5-500)
    pub size_ms: &'a [Sample],
    /// Grain density (grains per second, 1-100)
    pub density: &'a [Sample],
    /// Pitch ratio (0.25-4.0, 1.0 = original)
    pub pitch: &'a [Sample],
    /// Position randomization/spray (0-1)
    pub spray: &'a [Sample],
    /// Pitch randomization/scatter in semitones (0-24)
    pub scatter: &'a [Sample],
    /// Pan spread (0-1, how wide grains are panned)
    pub pan_spread: &'a [Sample],
    /// Grain envelope shape (0-3)
    pub shape: &'a [Sample],
    /// Output level (0-1)
    pub level: &'a [Sample],
}

impl Granular {
    /// Create a new granular synthesizer.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            buffer: vec![0.0; MAX_BUFFER_SAMPLES],
            buffer_length: 0,
            grains: [Grain::default(); MAX_GRAINS],
            spawn_phase: 0.0,
            seed: 0xDEAD_BEEF,
            recording: false,
            record_pos: 0,
            last_trigger: 0.0,
            playing: true,
            enabled: true,
        }
    }

    /// Set enabled state (from UI parameter).
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    /// Get enabled state.
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Load sample data into the buffer.
    /// Data should be normalized f32 samples.
    pub fn load_buffer(&mut self, data: &[Sample]) {
        let len = data.len().min(MAX_BUFFER_SAMPLES);
        self.buffer[..len].copy_from_slice(&data[..len]);
        self.buffer_length = len;
        // Clear remaining buffer
        for i in len..self.buffer.len() {
            self.buffer[i] = 0.0;
        }
        // Reset grains
        for grain in &mut self.grains {
            grain.active = false;
        }
    }

    /// Start recording from audio input.
    pub fn start_recording(&mut self) {
        self.recording = true;
        self.record_pos = 0;
        self.buffer_length = 0;
        // Stop all grains during recording
        for grain in &mut self.grains {
            grain.active = false;
        }
    }

    /// Stop recording.
    pub fn stop_recording(&mut self) {
        self.recording = false;
        self.buffer_length = self.record_pos;
    }

    /// Check if currently recording.
    pub fn is_recording(&self) -> bool {
        self.recording
    }

    /// Get the buffer length in samples.
    pub fn buffer_length(&self) -> usize {
        self.buffer_length
    }

    /// Get buffer length in seconds.
    pub fn buffer_duration(&self) -> f32 {
        self.buffer_length as f32 / self.sample_rate
    }

    /// Check if buffer has content.
    pub fn has_buffer(&self) -> bool {
        self.buffer_length > 0
    }

    /// Get a reference to the buffer for visualization.
    pub fn buffer_data(&self) -> &[Sample] {
        &self.buffer[..self.buffer_length]
    }

    /// Get active grain count for visualization.
    pub fn active_grain_count(&self) -> usize {
        self.grains.iter().filter(|g| g.active).count()
    }

    /// Get grain positions for visualization (normalized 0-1).
    pub fn grain_positions(&self) -> Vec<(f32, f32)> {
        if self.buffer_length == 0 {
            return Vec::new();
        }
        self.grains
            .iter()
            .filter(|g| g.active)
            .map(|g| {
                let pos = g.pos / self.buffer_length as f32;
                let phase = g.age as f32 / g.length as f32;
                (pos, phase)
            })
            .collect()
    }

    fn next_random(&mut self) -> f32 {
        self.seed = self
            .seed
            .wrapping_mul(1664525)
            .wrapping_add(1013904223);
        let raw = (self.seed >> 9) as f32 / 8_388_608.0;
        raw * 2.0 - 1.0 // -1 to 1
    }

    fn _next_random_01(&mut self) -> f32 {
        (self.next_random() + 1.0) * 0.5
    }

    /// Read sample with linear interpolation (static method to avoid borrow issues).
    fn read_sample_from(buffer: &[Sample], buffer_length: usize, index: f32) -> f32 {
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

    fn spawn_grain(
        &mut self,
        position: f32,
        length: usize,
        rate: f32,
        pan: f32,
        shape: GrainShape,
    ) {
        if length == 0 || self.buffer_length == 0 {
            return;
        }
        // Find inactive grain slot
        let mut target = None;
        for (index, grain) in self.grains.iter().enumerate() {
            if !grain.active {
                target = Some(index);
                break;
            }
        }
        // If all grains active, steal oldest
        let index = target.unwrap_or_else(|| {
            let mut oldest_idx = 0;
            let mut oldest_age = 0;
            for (i, grain) in self.grains.iter().enumerate() {
                if grain.age > oldest_age {
                    oldest_age = grain.age;
                    oldest_idx = i;
                }
            }
            oldest_idx
        });

        let grain = &mut self.grains[index];
        grain.active = true;
        grain.pos = position * self.buffer_length as f32;
        grain.rate = rate;
        grain.age = 0;
        grain.length = length;
        grain.pan = pan.clamp(-1.0, 1.0);
        grain.shape = shape;
    }

    /// Process a block of audio, producing stereo output.
    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: GranularInputs<'_>,
        params: GranularParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        for i in 0..out_l.len() {
            // Handle recording
            if self.recording {
                let input = input_at(inputs.audio_in, i);
                if self.record_pos < MAX_BUFFER_SAMPLES {
                    self.buffer[self.record_pos] = input;
                    self.record_pos += 1;
                }
                out_l[i] = input * 0.5; // Monitor
                out_r[i] = input * 0.5;
                continue;
            }

            // Check trigger for gate-based control
            let trig = input_at(inputs.trigger, i);
            if trig > 0.5 && self.last_trigger <= 0.5 {
                self.playing = true;
            }
            self.last_trigger = trig;

            // Skip if no buffer or disabled
            if self.buffer_length == 0 || !self.playing || !self.enabled {
                out_l[i] = 0.0;
                out_r[i] = 0.0;
                continue;
            }

            // Read parameters
            let base_position = sample_at(params.position, i, 0.5).clamp(0.0, 1.0);
            let size_ms = sample_at(params.size_ms, i, 100.0).clamp(5.0, 500.0);
            let density = sample_at(params.density, i, 8.0).clamp(1.0, 100.0);
            let base_pitch = sample_at(params.pitch, i, 1.0).clamp(0.25, 4.0);
            let spray = sample_at(params.spray, i, 0.1).clamp(0.0, 1.0);
            let scatter = sample_at(params.scatter, i, 0.0).clamp(0.0, 24.0);
            let pan_spread = sample_at(params.pan_spread, i, 0.5).clamp(0.0, 1.0);
            let shape_idx = sample_at(params.shape, i, 1.0) as usize;
            let level = sample_at(params.level, i, 0.8).clamp(0.0, 1.0);

            // CV modulation
            let position_mod = input_at(inputs.position_cv, i) * 0.5; // ±0.5 range
            let pitch_cv = input_at(inputs.pitch_cv, i);
            let pitch_mod = if pitch_cv.abs() > 0.001 {
                2.0_f32.powf(pitch_cv) // 1V/oct
            } else {
                1.0
            };

            let position = (base_position + position_mod).clamp(0.0, 1.0);
            let pitch = (base_pitch * pitch_mod).clamp(0.125, 8.0);

            let grain_length = (size_ms * self.sample_rate / 1000.0).max(1.0) as usize;
            let shape = GrainShape::from_index(shape_idx);

            // Spawn new grains based on density
            self.spawn_phase += density / self.sample_rate;
            while self.spawn_phase >= 1.0 {
                self.spawn_phase -= 1.0;

                // Apply spray (position randomization)
                let spray_amount = self.next_random() * spray;
                let grain_pos = (position + spray_amount).clamp(0.0, 1.0);

                // Apply scatter (pitch randomization) in semitones
                let scatter_semitones = self.next_random() * scatter;
                let grain_pitch = pitch * 2.0_f32.powf(scatter_semitones / 12.0);

                // Random pan within spread
                let grain_pan = self.next_random() * pan_spread;

                self.spawn_grain(grain_pos, grain_length, grain_pitch, grain_pan, shape);
            }

            // Mix active grains
            let mut sum_l = 0.0;
            let mut sum_r = 0.0;
            let mut active_count = 0;

            for grain in &mut self.grains {
                if !grain.active {
                    continue;
                }
                active_count += 1;

                // Calculate envelope
                let phase = grain.age as f32 / grain.length as f32;
                let envelope = grain.shape.envelope(phase);

                // Read sample
                let sample = Self::read_sample_from(&self.buffer, self.buffer_length, grain.pos);

                // Apply envelope and pan
                let out = sample * envelope;
                let pan_l = (0.5 * (1.0 - grain.pan)).sqrt();
                let pan_r = (0.5 * (1.0 + grain.pan)).sqrt();
                sum_l += out * pan_l;
                sum_r += out * pan_r;

                // Advance grain position
                grain.pos += grain.rate;

                // Wrap position
                if grain.pos >= self.buffer_length as f32 {
                    grain.pos -= self.buffer_length as f32;
                } else if grain.pos < 0.0 {
                    grain.pos += self.buffer_length as f32;
                }

                // Advance age
                grain.age += 1;
                if grain.age >= grain.length {
                    grain.active = false;
                }
            }

            // Normalize by sqrt of active count to prevent too loud with many grains
            let norm = if active_count > 0 {
                1.0 / (active_count as f32).sqrt()
            } else {
                1.0
            };

            out_l[i] = sum_l * norm * level;
            out_r[i] = sum_r * norm * level;
        }
    }
}
