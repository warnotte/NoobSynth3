//! Tape delay effect with wow, flutter, and saturation.
//!
//! Emulates vintage tape echo machines with their characteristic
//! modulation and warm saturation.

use crate::common::{input_at, sample_at, saturate, Sample};

/// Tape delay effect.
///
/// Simulates the sound of analog tape echo machines:
/// - Wow (slow pitch modulation)
/// - Flutter (fast pitch modulation)
/// - Tape saturation/drive
/// - Damping for darker repeats
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{TapeDelay, TapeDelayParams, TapeDelayInputs};
///
/// let mut tape = TapeDelay::new(44100.0);
/// let mut out_l = [0.0f32; 128];
/// let mut out_r = [0.0f32; 128];
///
/// tape.process_block(&mut out_l, &mut out_r, inputs, params);
/// ```
pub struct TapeDelay {
    sample_rate: f32,
    buffer_l: Vec<Sample>,
    buffer_r: Vec<Sample>,
    write_index: usize,
    wow_phase: f32,
    flutter_phase: f32,
    damp_state_l: f32,
    damp_state_r: f32,
}

/// Input signals for TapeDelay.
pub struct TapeDelayInputs<'a> {
    /// Left audio input
    pub input_l: Option<&'a [Sample]>,
    /// Right audio input
    pub input_r: Option<&'a [Sample]>,
}

/// Parameters for TapeDelay.
pub struct TapeDelayParams<'a> {
    /// Delay time in ms (20-2000)
    pub time_ms: &'a [Sample],
    /// Feedback amount (0-0.9)
    pub feedback: &'a [Sample],
    /// Dry/wet mix (0-1)
    pub mix: &'a [Sample],
    /// Tone/damping (0-1, lower = darker)
    pub tone: &'a [Sample],
    /// Wow amount (0-1)
    pub wow: &'a [Sample],
    /// Flutter amount (0-1)
    pub flutter: &'a [Sample],
    /// Tape saturation drive (0-1)
    pub drive: &'a [Sample],
}

impl TapeDelay {
    /// Create a new tape delay.
    pub fn new(sample_rate: f32) -> Self {
        let mut delay = Self {
            sample_rate: sample_rate.max(1.0),
            buffer_l: Vec::new(),
            buffer_r: Vec::new(),
            write_index: 0,
            wow_phase: 0.0,
            flutter_phase: 0.0,
            damp_state_l: 0.0,
            damp_state_r: 0.0,
        };
        delay.allocate_buffers();
        delay
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        self.allocate_buffers();
    }

    fn allocate_buffers(&mut self) {
        let max_delay_ms = 2000.0;
        let max_samples = ((max_delay_ms / 1000.0) * self.sample_rate).ceil() as usize + 2;
        if self.buffer_l.len() != max_samples {
            self.buffer_l = vec![0.0; max_samples];
            self.buffer_r = vec![0.0; max_samples];
            self.write_index = 0;
            self.wow_phase = 0.0;
            self.flutter_phase = 0.0;
            self.damp_state_l = 0.0;
            self.damp_state_r = 0.0;
        }
    }

    fn read_delay(&self, buffer: &[Sample], delay_samples: f32) -> f32 {
        let size = buffer.len() as i32;
        let read_pos = self.write_index as f32 - delay_samples;
        let base_index = read_pos.floor();
        let mut index_a = base_index as i32 % size;
        if index_a < 0 {
            index_a += size;
        }
        let index_b = (index_a + 1) % size;
        let frac = read_pos - base_index;
        let a = buffer[index_a as usize];
        let b = buffer[index_b as usize];
        a + (b - a) * frac
    }

    /// Process a block of stereo audio.
    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: TapeDelayInputs<'_>,
        params: TapeDelayParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        let buffer_size = self.buffer_l.len();
        let tau = std::f32::consts::TAU;
        let max_delay = (buffer_size as f32 - 2.0).max(1.0);

        for i in 0..out_l.len() {
            let time_ms = sample_at(params.time_ms, i, 420.0).clamp(20.0, 2000.0);
            let feedback = sample_at(params.feedback, i, 0.35).clamp(0.0, 0.9);
            let mix = sample_at(params.mix, i, 0.35).clamp(0.0, 1.0);
            let tone = sample_at(params.tone, i, 0.55).clamp(0.0, 1.0);
            let wow = sample_at(params.wow, i, 0.2).clamp(0.0, 1.0);
            let flutter = sample_at(params.flutter, i, 0.2).clamp(0.0, 1.0);
            let drive = sample_at(params.drive, i, 0.2).clamp(0.0, 1.0);

            let wow_depth = wow * 6.0;
            let flutter_depth = flutter * 2.0;
            let wow_rate = 0.25;
            let flutter_rate = 6.0;
            let mod_ms =
                wow_depth * self.wow_phase.sin() + flutter_depth * self.flutter_phase.sin();

            let delay_samples = ((time_ms + mod_ms).clamp(5.0, 2000.0) * self.sample_rate / 1000.0)
                .clamp(1.0, max_delay);

            let input_l = input_at(inputs.input_l, i);
            let input_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => input_l,
            };

            let delayed_l = self.read_delay(&self.buffer_l, delay_samples);
            let delayed_r = self.read_delay(&self.buffer_r, delay_samples);

            let damp = 0.05 + (1.0 - tone) * 0.9;
            let drive_gain = 1.0 + drive * 6.0;
            let fb_l = saturate((input_l + delayed_l * feedback) * drive_gain);
            let fb_r = saturate((input_r + delayed_r * feedback) * drive_gain);
            self.damp_state_l = fb_l * (1.0 - damp) + self.damp_state_l * damp;
            self.damp_state_r = fb_r * (1.0 - damp) + self.damp_state_r * damp;

            self.buffer_l[self.write_index] = self.damp_state_l;
            self.buffer_r[self.write_index] = self.damp_state_r;

            let dry = 1.0 - mix;
            out_l[i] = input_l * dry + delayed_l * mix;
            out_r[i] = input_r * dry + delayed_r * mix;

            self.write_index = (self.write_index + 1) % buffer_size;
            self.wow_phase += (tau * wow_rate) / self.sample_rate;
            if self.wow_phase >= tau {
                self.wow_phase -= tau;
            }
            self.flutter_phase += (tau * flutter_rate) / self.sample_rate;
            if self.flutter_phase >= tau {
                self.flutter_phase -= tau;
            }
        }
    }
}
