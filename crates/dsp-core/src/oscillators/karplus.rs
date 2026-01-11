//! Karplus-Strong physical modeling synthesis.
//!
//! Simulates plucked string sounds using a delay line with
//! filtered feedback, based on the Karplus-Strong algorithm.

use crate::common::Sample;

/// Maximum delay line length (supports down to ~23 Hz at 48kHz).
const KARPLUS_MAX_DELAY: usize = 2048;

/// Karplus-Strong plucked string synthesizer.
///
/// Physical modeling synthesis that creates realistic plucked string
/// sounds by exciting a delay line with noise and applying filtered
/// feedback.
///
/// # Algorithm
///
/// 1. On trigger, fill delay line with filtered noise
/// 2. Read from delay line at pitch-determined position
/// 3. Apply lowpass filter and decay
/// 4. Write back to delay line
///
/// # Features
///
/// - Adjustable damping (brightness/decay)
/// - Pluck position affects harmonic content
/// - Fractional delay interpolation for accurate tuning
///
/// # Example
///
/// ```ignore
/// use dsp_core::oscillators::{KarplusStrong, KarplusParams, KarplusInputs};
///
/// let mut ks = KarplusStrong::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// ks.process_block(&mut output, inputs, params);
/// ```
pub struct KarplusStrong {
    sample_rate: f32,
    delay_line: [f32; KARPLUS_MAX_DELAY],
    write_pos: usize,
    #[allow(dead_code)]
    delay_length: f32,
    last_output: f32,
    prev_gate: f32,
    noise_state: u32,
    is_active: bool,
    frac_delay: f32,
}

/// Parameters for Karplus-Strong synthesis.
pub struct KarplusParams<'a> {
    /// Base frequency in Hz
    pub frequency: &'a [Sample],
    /// Damping (0 = bright/long, 1 = dull/short)
    pub damping: &'a [Sample],
    /// Feedback decay (0.9-0.999)
    pub decay: &'a [Sample],
    /// Initial noise brightness (0-1)
    pub brightness: &'a [Sample],
    /// Pluck position (affects harmonics, 0.1-0.9)
    pub pluck_pos: &'a [Sample],
}

/// Input signals for Karplus-Strong.
pub struct KarplusInputs<'a> {
    /// Pitch CV (semitones offset)
    pub pitch: Option<&'a [Sample]>,
    /// Gate signal (triggers pluck on rising edge)
    pub gate: Option<&'a [Sample]>,
}

impl KarplusStrong {
    /// Create a new Karplus-Strong synthesizer.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            delay_line: [0.0; KARPLUS_MAX_DELAY],
            write_pos: 0,
            delay_length: 100.0,
            last_output: 0.0,
            prev_gate: 0.0,
            noise_state: 12345,
            is_active: false,
            frac_delay: 0.0,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Generate noise using LCG.
    fn next_noise(&mut self) -> f32 {
        self.noise_state = self.noise_state.wrapping_mul(1103515245).wrapping_add(12345);
        ((self.noise_state >> 16) as f32 / 32768.0) - 1.0
    }

    /// Fill delay line with filtered noise (pluck excitation).
    fn pluck(&mut self, delay_samples: usize, brightness: f32, pluck_pos: f32) {
        // Generate noise burst
        let mut noise_buf = [0.0f32; KARPLUS_MAX_DELAY];
        for i in 0..delay_samples {
            noise_buf[i] = self.next_noise();
        }

        // Apply brightness filter (simple lowpass)
        let coeff = (1.0 - brightness).clamp(0.0, 0.99);
        let mut prev = 0.0f32;
        for i in 0..delay_samples {
            noise_buf[i] = noise_buf[i] * (1.0 - coeff) + prev * coeff;
            prev = noise_buf[i];
        }

        // Apply pluck position comb filter
        let pluck_delay = ((pluck_pos.clamp(0.1, 0.9) * delay_samples as f32) as usize).max(1);
        for i in pluck_delay..delay_samples {
            noise_buf[i] -= noise_buf[i - pluck_delay] * 0.5;
        }

        // Copy to delay line
        for i in 0..delay_samples.min(KARPLUS_MAX_DELAY) {
            self.delay_line[i] = noise_buf[i] * 0.8;
        }

        self.write_pos = delay_samples % KARPLUS_MAX_DELAY;
        self.last_output = 0.0;
        self.is_active = true;
    }

    /// Process a block of audio.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: KarplusInputs,
        params: KarplusParams,
    ) {
        let frames = output.len();

        for i in 0..frames {
            let freq_param = params.frequency.get(i).copied().unwrap_or(params.frequency[0]);
            let damping = params.damping.get(i).copied().unwrap_or(params.damping[0]).clamp(0.0, 1.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.5, 0.9999);
            let brightness = params.brightness.get(i).copied().unwrap_or(params.brightness[0]).clamp(0.0, 1.0);
            let pluck_pos = params.pluck_pos.get(i).copied().unwrap_or(params.pluck_pos[0]).clamp(0.1, 0.9);

            // Apply pitch CV
            let pitch_cv = inputs.pitch.map(|p| p.get(i).copied().unwrap_or(0.0)).unwrap_or(0.0);
            let freq = freq_param * (2.0_f32).powf(pitch_cv / 12.0);
            let freq_clamped = freq.clamp(20.0, self.sample_rate / 2.0);

            // Calculate delay length
            let delay_samples_f = self.sample_rate / freq_clamped;
            let delay_samples = (delay_samples_f as usize).min(KARPLUS_MAX_DELAY - 1).max(2);
            self.frac_delay = delay_samples_f - delay_samples as f32;

            // Check for gate trigger
            let gate = inputs.gate.map(|g| g.get(i).copied().unwrap_or(0.0)).unwrap_or(0.0);
            if gate > 0.5 && self.prev_gate <= 0.5 {
                self.pluck(delay_samples, brightness, pluck_pos);
            }
            self.prev_gate = gate;

            // Process Karplus-Strong algorithm
            let out = if self.is_active {
                // Read with linear interpolation
                let read_pos = (self.write_pos + KARPLUS_MAX_DELAY - delay_samples) % KARPLUS_MAX_DELAY;
                let read_pos_next = (read_pos + 1) % KARPLUS_MAX_DELAY;

                let sample_a = self.delay_line[read_pos];
                let sample_b = self.delay_line[read_pos_next];
                let current = sample_a + (sample_b - sample_a) * self.frac_delay;

                // Apply lowpass filter
                let filter_coeff = 0.5 + damping * 0.4;
                let filtered = current * (1.0 - filter_coeff) + self.last_output * filter_coeff;

                // Apply decay feedback
                let feedback = filtered * decay;

                // Write back
                self.delay_line[self.write_pos] = feedback;
                self.write_pos = (self.write_pos + 1) % KARPLUS_MAX_DELAY;

                self.last_output = filtered;

                // Check if decayed
                if filtered.abs() < 0.0001 {
                    self.is_active = false;
                }

                filtered
            } else {
                0.0
            };

            output[i] = out;
        }
    }
}
