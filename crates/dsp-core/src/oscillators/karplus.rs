//! Karplus-Strong physical modeling synthesis.
//!
//! Simulates plucked string sounds using a delay line with
//! filtered feedback, based on the Karplus-Strong algorithm.

use crate::common::Sample;

/// Maximum delay line length (supports down to ~23 Hz at 48kHz).
const KARPLUS_MAX_DELAY: usize = 2048;

/// A string is silent (voice switched off) once a WHOLE period stays below this level (-80 dB).
const SILENCE_LEVEL: f32 = 0.0001;

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
    /// Loudest output sample since the start of the current period (silence detection).
    period_peak: f32,
    /// Samples counted in the current period.
    period_count: usize,
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
    /// Pitch CV (1 V/octave, like every sequencer and oscillator: +1 = one octave up)
    pub pitch: Option<&'a [Sample]>,
    /// Gate signal (triggers pluck on rising edge)
    pub gate: Option<&'a [Sample]>,
}

/// Pitch law: 1 V/octave, like every sequencer and oscillator (+1 = one octave up).
#[inline]
fn pitched(freq: f32, pitch_cv: f32) -> f32 {
    freq * (2.0_f32).powf(pitch_cv)
}

/// Loop damping coefficient of the one-pole lowpass `y = (1 - c)·x + c·y[-1]`.
#[inline]
fn damping_coeff(damping: f32) -> f32 {
    0.5 + damping * 0.4
}

/// Delay (in samples) the loop lowpass adds at angular frequency `w` (rad/sample). The loop is one
/// period long only if the delay line is shortened by this much — otherwise the string plays flat,
/// by a different amount on each note (up to -28 cents at 440 Hz with damping 0.4).
#[inline]
fn lowpass_phase_delay(c: f32, w: f32) -> f32 {
    (c * w.sin()).atan2(1.0 - c * w.cos()) / w
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
            period_peak: 0.0,
            period_count: 0,
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

        // Remove the burst's DC: the loop sustains it for seconds (silent, but it keeps the voice alive
        // and makes the next pluck thump)
        let n = delay_samples.min(KARPLUS_MAX_DELAY);
        let dc = noise_buf[..n].iter().sum::<f32>() / n as f32;

        // Copy to delay line
        for i in 0..n {
            self.delay_line[i] = (noise_buf[i] - dc) * 0.8;
        }

        self.write_pos = delay_samples % KARPLUS_MAX_DELAY;
        self.last_output = 0.0;
        self.is_active = true;
        self.period_peak = 0.0;
        self.period_count = 0;
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
            let freq = pitched(freq_param, pitch_cv);
            let freq_clamped = freq.clamp(20.0, self.sample_rate / 2.0);

            // Delay line length: one period minus what the loop lowpass already delays
            let filter_coeff = damping_coeff(damping);
            let period = self.sample_rate / freq_clamped;
            let w = std::f32::consts::TAU * freq_clamped / self.sample_rate;
            let line = (period - lowpass_phase_delay(filter_coeff, w)).clamp(2.0, (KARPLUS_MAX_DELAY - 2) as f32);
            let delay_samples = line as usize;
            self.frac_delay = line - delay_samples as f32;

            // Check for gate trigger
            let gate = inputs.gate.map(|g| g.get(i).copied().unwrap_or(0.0)).unwrap_or(0.0);
            if gate > 0.5 && self.prev_gate <= 0.5 {
                self.pluck(delay_samples, brightness, pluck_pos);
            }
            self.prev_gate = gate;

            // Process Karplus-Strong algorithm
            let out = if self.is_active {
                // Read `delay_samples + frac` samples back: linear interpolation towards the OLDER
                // neighbour (the newer one would shorten the loop and detune the string)
                let read_pos = (self.write_pos + KARPLUS_MAX_DELAY - delay_samples) % KARPLUS_MAX_DELAY;
                let read_pos_older = (read_pos + KARPLUS_MAX_DELAY - 1) % KARPLUS_MAX_DELAY;

                let sample_a = self.delay_line[read_pos];
                let sample_b = self.delay_line[read_pos_older];
                let current = sample_a + (sample_b - sample_a) * self.frac_delay;

                // Apply lowpass filter
                let filtered = current * (1.0 - filter_coeff) + self.last_output * filter_coeff;

                // Apply decay feedback
                let feedback = filtered * decay;

                // Write back
                self.delay_line[self.write_pos] = feedback;
                self.write_pos = (self.write_pos + 1) % KARPLUS_MAX_DELAY;

                self.last_output = filtered;

                // Decayed? Judge a whole period, not one sample: a vibrating string crosses zero
                // twice per period, and stopping at the first quiet sample cut notes after ~25 ms.
                self.period_peak = self.period_peak.max(filtered.abs());
                self.period_count += 1;
                if self.period_count >= delay_samples {
                    if self.period_peak < SILENCE_LEVEL {
                        self.is_active = false;
                    }
                    self.period_peak = 0.0;
                    self.period_count = 0;
                }

                filtered
            } else {
                0.0
            };

            output[i] = out;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Pitch CV is 1 V/octave like every sequencer: +1 is one octave up, not one semitone.
    #[test]
    fn pitch_cv_is_one_volt_per_octave() {
        assert!((pitched(220.0, 1.0) - 440.0).abs() < 1e-3);
        assert!((pitched(220.0, -1.0) - 110.0).abs() < 1e-3);
        assert!((pitched(220.0, 7.0 / 12.0) - 329.627_6).abs() < 0.01, "+7/12 V is a fifth up");
    }

    /// Pluck once (gate rises at sample 1) and render `seconds` of output.
    fn pluck_render(freq: f32, damping: f32, decay: f32, seconds: f32) -> Vec<f32> {
        let sr = 48_000.0;
        let mut ks = KarplusStrong::new(sr);
        let (f, d, dc, b, p) = ([freq], [damping], [decay], [0.55], [0.3]);
        let mut out = vec![0.0; (seconds * sr) as usize];
        for (k, block) in out.chunks_mut(128).enumerate() {
            let gate: Vec<f32> = (0..block.len()).map(|i| if k == 0 && i == 0 { 0.0 } else { 1.0 }).collect();
            let params = KarplusParams { frequency: &f, damping: &d, decay: &dc, brightness: &b, pluck_pos: &p };
            ks.process_block(block, KarplusInputs { pitch: None, gate: Some(&gate) }, params);
        }
        out
    }

    /// A note rings for its natural decay: it used to stop at the first output sample close to zero
    /// (median 25 ms), which a vibrating string crosses twice per period.
    #[test]
    fn plucked_note_rings_until_it_decays() {
        let sr = 48_000.0;
        let x = pluck_render(220.0, 0.25, 0.996, 30.0);
        let peak = |from: f32, to: f32| x[(from * sr) as usize..(to * sr) as usize].iter().fold(0.0f32, |m, v| m.max(v.abs()));
        assert!(peak(0.0, 0.05) > 0.05, "the pluck is audible");
        assert!(peak(0.5, 0.6) > 0.001, "still ringing after half a second (peak {})", peak(0.5, 0.6));
        assert_eq!(peak(29.0, 30.0), 0.0, "the voice switches off once silent");
    }

    /// The string is in tune: the delay line is shortened by the delay of the loop lowpass
    /// (every note used to play flat, up to 28 cents at 440 Hz with damping 0.4).
    #[test]
    fn plucked_string_is_in_tune() {
        let sr = 48_000.0;
        // (frequency, damping, analysis window in seconds once the upper harmonics have died out)
        for (freq, damping, from, to) in [(440.0, 0.4, 0.5, 1.5), (880.0, 0.0, 0.1, 0.4), (220.0, 0.5, 0.5, 1.5)] {
            let x = pluck_render(freq, damping, 0.999, to);
            // Count upward zero crossings of the fundamental
            let crossings: Vec<f32> = ((from * sr) as usize..x.len() - 1)
                .filter(|&i| x[i] <= 0.0 && x[i + 1] > 0.0)
                .map(|i| i as f32 + x[i] / (x[i] - x[i + 1]))
                .collect();
            let measured = sr * (crossings.len() - 1) as f32 / (crossings[crossings.len() - 1] - crossings[0]);
            let cents = 1200.0 * (measured / freq).log2();
            assert!(cents.abs() < 3.0, "{freq} Hz (damping {damping}) plays {measured:.2} Hz ({cents:+.1} cents)");
        }
    }
}
