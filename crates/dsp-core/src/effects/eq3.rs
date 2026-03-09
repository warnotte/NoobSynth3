//! 3-band parametric EQ effect.
//!
//! Three biquad filters in series: low shelf, mid peak (bell),
//! and high shelf. Uses Transposed Direct Form II for stability
//! and efficiency. Coefficient formulas from the Audio EQ Cookbook.

use std::f32::consts::PI;

use crate::common::{input_at, sample_at, Sample};

/// Biquad filter state using Transposed Direct Form II.
///
/// TDF2 requires only two state variables per filter stage:
/// `y = b0*x + z1; z1 = b1*x - a1*y + z2; z2 = b2*x - a2*y`
#[derive(Clone, Copy)]
struct BiquadState {
    z1: f32,
    z2: f32,
}

impl BiquadState {
    fn new() -> Self {
        Self { z1: 0.0, z2: 0.0 }
    }

    /// Process a single sample through this biquad stage.
    #[inline]
    fn process(&mut self, x: f32, b0: f32, b1: f32, b2: f32, a1: f32, a2: f32) -> f32 {
        let y = b0 * x + self.z1;
        self.z1 = b1 * x - a1 * y + self.z2;
        self.z2 = b2 * x - a2 * y;
        y
    }
}

/// Biquad coefficients (normalized so a0 = 1).
struct Coeffs {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
}

/// Compute low shelf biquad coefficients.
///
/// Uses Q = 0.707 (Butterworth) for a smooth shelf response.
/// Based on the Audio EQ Cookbook by Robert Bristow-Johnson.
fn low_shelf_coeffs(freq: f32, gain_db: f32, sample_rate: f32) -> Coeffs {
    let a = 10.0_f32.powf(gain_db / 40.0); // sqrt of linear gain
    let w0 = 2.0 * PI * freq / sample_rate;
    let cos_w0 = w0.cos();
    let sin_w0 = w0.sin();
    let alpha = sin_w0 / (2.0 * 0.707);
    let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;

    let a0 = (a + 1.0) + (a - 1.0) * cos_w0 + two_sqrt_a_alpha;
    let a0_inv = 1.0 / a0;

    Coeffs {
        b0: (a * ((a + 1.0) - (a - 1.0) * cos_w0 + two_sqrt_a_alpha)) * a0_inv,
        b1: (2.0 * a * ((a - 1.0) - (a + 1.0) * cos_w0)) * a0_inv,
        b2: (a * ((a + 1.0) - (a - 1.0) * cos_w0 - two_sqrt_a_alpha)) * a0_inv,
        a1: (-2.0 * ((a - 1.0) + (a + 1.0) * cos_w0)) * a0_inv,
        a2: ((a + 1.0) + (a - 1.0) * cos_w0 - two_sqrt_a_alpha) * a0_inv,
    }
}

/// Compute peaking EQ (bell) biquad coefficients.
fn peak_coeffs(freq: f32, gain_db: f32, q: f32, sample_rate: f32) -> Coeffs {
    let a = 10.0_f32.powf(gain_db / 40.0);
    let w0 = 2.0 * PI * freq / sample_rate;
    let cos_w0 = w0.cos();
    let sin_w0 = w0.sin();
    let alpha = sin_w0 / (2.0 * q);

    let a0 = 1.0 + alpha / a;
    let a0_inv = 1.0 / a0;

    Coeffs {
        b0: (1.0 + alpha * a) * a0_inv,
        b1: (-2.0 * cos_w0) * a0_inv,
        b2: (1.0 - alpha * a) * a0_inv,
        a1: (-2.0 * cos_w0) * a0_inv,
        a2: (1.0 - alpha / a) * a0_inv,
    }
}

/// Compute high shelf biquad coefficients.
///
/// Uses Q = 0.707 (Butterworth) for a smooth shelf response.
fn high_shelf_coeffs(freq: f32, gain_db: f32, sample_rate: f32) -> Coeffs {
    let a = 10.0_f32.powf(gain_db / 40.0);
    let w0 = 2.0 * PI * freq / sample_rate;
    let cos_w0 = w0.cos();
    let sin_w0 = w0.sin();
    let alpha = sin_w0 / (2.0 * 0.707);
    let two_sqrt_a_alpha = 2.0 * a.sqrt() * alpha;

    let a0 = (a + 1.0) - (a - 1.0) * cos_w0 + two_sqrt_a_alpha;
    let a0_inv = 1.0 / a0;

    Coeffs {
        b0: (a * ((a + 1.0) + (a - 1.0) * cos_w0 + two_sqrt_a_alpha)) * a0_inv,
        b1: (-2.0 * a * ((a - 1.0) + (a + 1.0) * cos_w0)) * a0_inv,
        b2: (a * ((a + 1.0) + (a - 1.0) * cos_w0 - two_sqrt_a_alpha)) * a0_inv,
        a1: (2.0 * ((a - 1.0) - (a + 1.0) * cos_w0)) * a0_inv,
        a2: ((a + 1.0) - (a - 1.0) * cos_w0 - two_sqrt_a_alpha) * a0_inv,
    }
}

/// 3-band parametric EQ with low shelf, mid peak, and high shelf.
///
/// Processes stereo audio through three biquad filter stages in series.
/// Each band has independent frequency and gain controls; the mid band
/// also has a Q (bandwidth) control.
///
/// # Example
///
/// ```ignore
/// use dsp_core::effects::{Eq3, Eq3Params, Eq3Inputs};
///
/// let mut eq = Eq3::new(44100.0);
/// let mut out_l = [0.0f32; 128];
/// let mut out_r = [0.0f32; 128];
///
/// eq.process_block(&mut out_l, &mut out_r, inputs, params);
/// ```
pub struct Eq3 {
    sample_rate: f32,
    // Left channel: low shelf, mid peak, high shelf
    low_l: BiquadState,
    mid_l: BiquadState,
    high_l: BiquadState,
    // Right channel: low shelf, mid peak, high shelf
    low_r: BiquadState,
    mid_r: BiquadState,
    high_r: BiquadState,
}

/// Input signals for Eq3.
pub struct Eq3Inputs<'a> {
    /// Left audio input
    pub input_l: Option<&'a [Sample]>,
    /// Right audio input
    pub input_r: Option<&'a [Sample]>,
}

/// Parameters for Eq3.
pub struct Eq3Params<'a> {
    /// Low shelf gain in dB (-12 to +12)
    pub low_gain: &'a [Sample],
    /// Mid peak gain in dB (-12 to +12)
    pub mid_gain: &'a [Sample],
    /// High shelf gain in dB (-12 to +12)
    pub high_gain: &'a [Sample],
    /// Low shelf frequency in Hz (20-2000)
    pub low_freq: &'a [Sample],
    /// Mid peak frequency in Hz (200-8000)
    pub mid_freq: &'a [Sample],
    /// High shelf frequency in Hz (2000-20000)
    pub high_freq: &'a [Sample],
    /// Mid peak Q factor (0.1-10.0)
    pub mid_q: &'a [Sample],
}

impl Eq3 {
    /// Create a new 3-band EQ.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            low_l: BiquadState::new(),
            mid_l: BiquadState::new(),
            high_l: BiquadState::new(),
            low_r: BiquadState::new(),
            mid_r: BiquadState::new(),
            high_r: BiquadState::new(),
        }
    }

    /// Update the sample rate and reset filter states.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        self.low_l = BiquadState::new();
        self.mid_l = BiquadState::new();
        self.high_l = BiquadState::new();
        self.low_r = BiquadState::new();
        self.mid_r = BiquadState::new();
        self.high_r = BiquadState::new();
    }

    /// Process a block of stereo audio through the 3-band EQ.
    ///
    /// Coefficients are computed once per block from the first sample
    /// of each parameter buffer, since EQ parameters rarely change
    /// at audio rate.
    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: Eq3Inputs<'_>,
        params: Eq3Params<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        // Read parameters once per block (index 0)
        let low_gain = sample_at(params.low_gain, 0, 0.0).clamp(-12.0, 12.0);
        let mid_gain = sample_at(params.mid_gain, 0, 0.0).clamp(-12.0, 12.0);
        let high_gain = sample_at(params.high_gain, 0, 0.0).clamp(-12.0, 12.0);
        let low_freq = sample_at(params.low_freq, 0, 200.0).clamp(20.0, 2000.0);
        let mid_freq = sample_at(params.mid_freq, 0, 1000.0).clamp(200.0, 8000.0);
        let high_freq = sample_at(params.high_freq, 0, 5000.0).clamp(2000.0, 20000.0);
        let mid_q = sample_at(params.mid_q, 0, 1.0).clamp(0.1, 10.0);

        // Compute biquad coefficients
        let low = low_shelf_coeffs(low_freq, low_gain, self.sample_rate);
        let mid = peak_coeffs(mid_freq, mid_gain, mid_q, self.sample_rate);
        let high = high_shelf_coeffs(high_freq, high_gain, self.sample_rate);

        for i in 0..out_l.len() {
            // Read inputs
            let in_l = input_at(inputs.input_l, i);
            let in_r = match inputs.input_r {
                Some(values) => input_at(Some(values), i),
                None => in_l,
            };

            // Left channel: low shelf → mid peak → high shelf
            let x_l = self.low_l.process(in_l, low.b0, low.b1, low.b2, low.a1, low.a2);
            let x_l = self.mid_l.process(x_l, mid.b0, mid.b1, mid.b2, mid.a1, mid.a2);
            out_l[i] = self.high_l.process(x_l, high.b0, high.b1, high.b2, high.a1, high.a2);

            // Right channel: low shelf → mid peak → high shelf
            let x_r = self.low_r.process(in_r, low.b0, low.b1, low.b2, low.a1, low.a2);
            let x_r = self.mid_r.process(x_r, mid.b0, mid.b1, mid.b2, mid.a1, mid.a2);
            out_r[i] = self.high_r.process(x_r, high.b0, high.b1, high.b2, high.a1, high.a2);
        }
    }
}
