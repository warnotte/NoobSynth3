//! TR-909 Snare Drum.
//!
//! Modeled on a real TR-909 (AudioRealism sample pack: 125 TUNE/TONE/SNAPPY positions, fitted offline on a
//! multi-resolution spectrogram distance, then chosen by ear against the machine and the previous module):
//! - body: two oscillators, a note and its fifth (ratio 1.5). Both start about an octave high and fall back
//!   within ~7 ms (the "snap" of the 909). The low one is a rounded triangle (odd harmonics + a little 2nd)
//!   that swells in over 1 ms and rings ~200 ms; the fifth is mostly a short blip.
//! - noise: white noise band-passed 1-10.5 kHz, held as a plateau then dropped, `(1 - t/L)²`. TONE sets the
//!   length L (114 / 253 / 332 ms at 0 / 50 / 100 %), SNAPPY its level: the real knobs' roles.

use crate::common::Sample;

/// Pitch sweep time constant (s) and depth of each oscillator (1.0 = starts an octave up).
const SWEEP_TAU: f32 = 0.0071;
const SWEEP_LOW: f32 = 1.0;
const SWEEP_FIFTH: f32 = 0.758;
/// Low oscillator: attack and decay time constants (s), harmonics of the rounded triangle.
const LOW_ATTACK: f32 = 0.001;
const BODY_DECAY: f32 = 0.0302;
const LOW_H2: f32 = 0.0929;
const LOW_H3: f32 = 0.056;
const LOW_H5: f32 = 0.0187;
/// Fifth oscillator: share of its short blip (the rest decays with the body).
const FIFTH_BLIP_DECAY: f32 = 0.0087;
const FIFTH_BLIP_SHARE: f32 = 0.614;
/// Body levels (fitted, relative to the noise below).
const LOW_GAIN: f32 = 0.2842;
const FIFTH_GAIN: f32 = 0.1539;
/// Noise band and envelope. Length at TONE 0 / 50 / 100 %, level at SNAPPY 25 / 50 / 100 %: the fitted levels
/// + 2 dB, which gives the machine's share of energy above 2 kHz (9 / 21 / 32 % at SNAPPY 50 / 75 / 100);
/// the plain fit was ~30 % darker. Chosen by ear among four versions from the fit to the previous module.
const NOISE_HP_HZ: f32 = 1010.0;
const NOISE_LP_HZ_TONE0: f32 = 11_120.0;
const NOISE_LP_HZ: f32 = 10_415.0;
const NOISE_LENGTH: [f32; 3] = [0.114, 0.2526, 0.3321];
const NOISE_LEVEL: [f32; 3] = [0.0297, 0.0584, 0.1260];
/// Unit-variance noise from a uniform source (the fit used Gaussian noise of standard deviation 1).
const UNIFORM_TO_UNIT: f32 = 1.732;
/// `decay` = 0.3 is the machine; other values stretch or shorten the body and the noise together.
const DECAY_REFERENCE: f32 = 0.3;
/// Overall level: 1 dB under the previous module at its default settings (same balance in mixes) so a full
/// accent on the sharper attack still peaks under 1.
const OUTPUT_GAIN: f32 = 2.2;
/// A retrigger fades the previous hit out over this long instead of cutting it (no click).
const DECLICK_S: f32 = 0.002;
/// Below this the voice is silent and skipped.
const SILENT: f32 = 1e-5;

/// Second-order Butterworth section (transposed direct form II).
#[derive(Clone, Copy, Default)]
struct Biquad {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    z1: f32,
    z2: f32,
}

impl Biquad {
    fn set(&mut self, hz: f32, sample_rate: f32, highpass: bool) {
        let w = std::f32::consts::TAU * (hz / sample_rate).clamp(1e-4, 0.49);
        let (sin, cos) = (w.sin(), w.cos());
        let alpha = sin / std::f32::consts::SQRT_2;
        let a0 = 1.0 + alpha;
        let (b0, b1) = if highpass { ((1.0 + cos) * 0.5, -(1.0 + cos)) } else { ((1.0 - cos) * 0.5, 1.0 - cos) };
        self.b0 = b0 / a0;
        self.b1 = b1 / a0;
        self.b2 = b0 / a0;
        self.a1 = -2.0 * cos / a0;
        self.a2 = (1.0 - alpha) / a0;
    }

    #[inline]
    fn tick(&mut self, x: f32) -> f32 {
        let y = self.b0 * x + self.z1;
        self.z1 = self.b1 * x - self.a1 * y + self.z2;
        self.z2 = self.b2 * x - self.a2 * y;
        y
    }
}

/// Value at knob 0 / 50 / 100 % (`v` in 0..1), linear in between.
#[inline]
fn three_points(v: f32, at: [f32; 3]) -> f32 {
    if v <= 0.5 {
        at[0] + (at[1] - at[0]) * v * 2.0
    } else {
        at[1] + (at[2] - at[1]) * (v - 0.5) * 2.0
    }
}

/// Noise level for SNAPPY (0..1): silent at 0, measured at 25 / 50 / 100 %.
#[inline]
fn snappy_level(snappy: f32) -> f32 {
    if snappy <= 0.25 {
        NOISE_LEVEL[0] * snappy * 4.0
    } else if snappy <= 0.5 {
        NOISE_LEVEL[0] + (NOISE_LEVEL[1] - NOISE_LEVEL[0]) * (snappy - 0.25) * 4.0
    } else {
        NOISE_LEVEL[1] + (NOISE_LEVEL[2] - NOISE_LEVEL[1]) * (snappy - 0.5) * 2.0
    }
}

/// TR-909 Snare Drum.
///
/// # Parameters
///
/// - `tune`: pitch of the low oscillator once settled (100-400 Hz; the machine spans ~116-231 Hz)
/// - `tone`: length of the noise (0 = short, 1 = long), as on the TR-909
/// - `snappy`: level of the noise (0 = body only)
/// - `decay`: 0.3 is the machine; lower / higher shortens / stretches body and noise (0.05-1)
///
/// # Example
///
/// ```ignore
/// use dsp_core::drums::{Snare909, Snare909Params, Snare909Inputs};
///
/// let mut snare = Snare909::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// snare.process_block(
///     &mut output,
///     Snare909Inputs { trigger: Some(&[1.0]), accent: None },
///     Snare909Params {
///         tune: &[200.0],
///         tone: &[0.5],
///         snappy: &[0.5],
///         decay: &[0.3],
///     },
/// );
/// ```
pub struct Snare909 {
    sample_rate: f32,
    phase_low: f32,
    phase_fifth: f32,
    noise_state: u32,
    /// samples since the last trigger
    age: u32,
    active: bool,
    last_trig: f32,
    latched_accent: f32,
    last_out: f32,
    declick: f32,
    declick_step: f32,
    noise_hp: Biquad,
    noise_lp: Biquad,
    lp_hz: f32,
}

/// Parameters for Snare909.
pub struct Snare909Params<'a> {
    /// Settled pitch of the low oscillator (100-400 Hz)
    pub tune: &'a [Sample],
    /// Noise length (0-1)
    pub tone: &'a [Sample],
    /// Noise level (0-1)
    pub snappy: &'a [Sample],
    /// Decay scale (0.05-1, 0.3 = TR-909)
    pub decay: &'a [Sample],
}

/// Input signals for Snare909.
pub struct Snare909Inputs<'a> {
    /// Trigger input (rising edge triggers sound)
    pub trigger: Option<&'a [Sample]>,
    /// Accent CV (0-1, captured at trigger)
    pub accent: Option<&'a [Sample]>,
}

impl Snare909 {
    /// Create a new 909 snare drum.
    pub fn new(sample_rate: f32) -> Self {
        let mut snare = Self {
            sample_rate: sample_rate.max(1.0),
            phase_low: 0.0,
            phase_fifth: 0.0,
            noise_state: 0x12345678,
            age: 0,
            active: false,
            last_trig: 0.0,
            latched_accent: 0.5,
            last_out: 0.0,
            declick: 0.0,
            declick_step: 0.0,
            noise_hp: Biquad::default(),
            noise_lp: Biquad::default(),
            lp_hz: 0.0,
        };
        snare.set_sample_rate(sample_rate);
        snare
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
        self.noise_hp.set(NOISE_HP_HZ, self.sample_rate, true);
        self.lp_hz = 0.0;
    }

    fn white_noise(&mut self) -> f32 {
        self.noise_state ^= self.noise_state << 13;
        self.noise_state ^= self.noise_state >> 17;
        self.noise_state ^= self.noise_state << 5;
        (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: Snare909Inputs,
        params: Snare909Params,
    ) {
        let sr = self.sample_rate;
        for i in 0..output.len() {
            let tune = params.tune.get(i).copied().unwrap_or(params.tune[0]).clamp(100.0, 400.0);
            let tone = params.tone.get(i).copied().unwrap_or(params.tone[0]).clamp(0.0, 1.0);
            let snappy = params.snappy.get(i).copied().unwrap_or(params.snappy[0]).clamp(0.0, 1.0);
            let decay = params.decay.get(i).copied().unwrap_or(params.decay[0]).clamp(0.05, 1.0);

            let trig = inputs.trigger.map_or(0.0, |t| t.get(i).copied().unwrap_or(t[0]));
            let accent_in = inputs.accent.map_or(0.5, |a| a.get(i).copied().unwrap_or(a[0])).clamp(0.0, 1.0);

            if trig > 0.5 && self.last_trig <= 0.5 {
                // fade what was still ringing instead of jumping to the new hit
                self.declick = self.last_out;
                self.declick_step = self.last_out / (DECLICK_S * sr);
                self.age = 0;
                self.phase_low = 0.0;
                self.phase_fifth = 0.0;
                self.active = true;
                self.latched_accent = accent_in;
            }
            self.last_trig = trig;

            let mut sample = 0.0;
            if self.active {
                let t = self.age as f32 / sr;
                let stretch = decay / DECAY_REFERENCE;

                // body: two sweeping oscillators
                let sweep = (-t / SWEEP_TAU).exp();
                self.phase_low += tune * (1.0 + SWEEP_LOW * sweep) / sr;
                self.phase_low -= self.phase_low.floor();
                self.phase_fifth += 1.5 * tune * (1.0 + SWEEP_FIFTH * sweep) / sr;
                self.phase_fifth -= self.phase_fifth.floor();
                let p = self.phase_low * std::f32::consts::TAU;
                let low_wave = p.sin() + LOW_H2 * (2.0 * p).sin() + LOW_H3 * (3.0 * p).sin() + LOW_H5 * (5.0 * p).sin();
                let body_env = (-t / (BODY_DECAY * stretch)).exp();
                let low_env = (1.0 - (-t / LOW_ATTACK).exp()) * body_env;
                let fifth_env = FIFTH_BLIP_SHARE * (-t / (FIFTH_BLIP_DECAY * stretch)).exp() + (1.0 - FIFTH_BLIP_SHARE) * body_env;
                let body = LOW_GAIN * low_env * low_wave + FIFTH_GAIN * fifth_env * (self.phase_fifth * std::f32::consts::TAU).sin();

                // noise: band-passed, plateau then drop
                let length = three_points(tone, NOISE_LENGTH) * stretch;
                let lp_hz = if tone <= 0.5 { NOISE_LP_HZ_TONE0 + (NOISE_LP_HZ - NOISE_LP_HZ_TONE0) * tone * 2.0 } else { NOISE_LP_HZ };
                if (lp_hz - self.lp_hz).abs() > 1.0 {
                    self.noise_lp.set(lp_hz, sr, false);
                    self.lp_hz = lp_hz;
                }
                let shape = (1.0 - t / length).max(0.0);
                let white = self.white_noise() * UNIFORM_TO_UNIT;
                let noise = snappy_level(snappy) * shape * shape * self.noise_lp.tick(self.noise_hp.tick(white));

                sample = (body + noise) * OUTPUT_GAIN * (0.7 + self.latched_accent * 0.5);
                self.age = self.age.saturating_add(1);
                if shape == 0.0 && body_env < SILENT {
                    self.active = false;
                }
            }

            if self.declick != 0.0 {
                sample += self.declick;
                self.declick -= self.declick_step;
                if self.declick * self.declick_step <= 0.0 {
                    self.declick = 0.0;
                }
            }
            self.last_out = sample;
            output[i] = sample.clamp(-1.0, 1.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn render(params: (f32, f32, f32, f32), hits: &[usize], len: usize) -> Vec<f32> {
        let sr = 48_000.0;
        let mut sd = Snare909::new(sr);
        let mut out = vec![0.0; len];
        for (k, block) in out.chunks_mut(64).enumerate() {
            let start = k * 64;
            let trig: Vec<f32> = (start..start + block.len()).map(|n| if hits.iter().any(|&h| n >= h && n < h + 480) { 1.0 } else { 0.0 }).collect();
            let (tune, tone, snappy, decay) = params;
            sd.process_block(block, Snare909Inputs { trigger: Some(&trig), accent: None }, Snare909Params { tune: &[tune], tone: &[tone], snappy: &[snappy], decay: &[decay] });
        }
        out
    }

    /// The pitch falls from about an octave up to the tune within ~20 ms (the 909 "snap").
    #[test]
    fn body_pitch_sweeps_down_to_tune() {
        let x = render((180.0, 0.5, 0.0, 0.3), &[0], 48_000);
        // strongest frequency of the body (SNAPPY 0) between 140 and 400 Hz, Hann-windowed fine scan
        let dominant = |a: usize, b: usize| {
            let n = b - a;
            (140..400).map(|f| {
                let (mut re, mut im) = (0.0f32, 0.0f32);
                for (k, v) in x[a..b].iter().enumerate() {
                    let w = 0.5 - 0.5 * (std::f32::consts::TAU * k as f32 / n as f32).cos();
                    let ph = std::f32::consts::TAU * f as f32 * k as f32 / 48_000.0;
                    re += v * w * ph.cos();
                    im += v * w * ph.sin();
                }
                (re * re + im * im, f)
            }).fold((0.0, 0), |best, c| if c.0 > best.0 { c } else { best }).1 as f32
        };
        let early = dominant(0, 480);
        let late = dominant(2_880, 7_680);
        assert!(early > 1.25 * late, "early {early} Hz should be well above late {late} Hz");
        assert!((late - 180.0).abs() < 8.0, "settles on the tune ({late} Hz)");
    }

    /// TONE sets how long the noise lasts, SNAPPY how loud it is; everything ends in silence.
    #[test]
    fn tone_lengthens_noise_and_snappy_raises_it() {
        let energy = |x: &[f32], a: usize, b: usize| x[a..b].iter().map(|v| v * v).sum::<f32>();
        let short = render((180.0, 0.0, 1.0, 0.3), &[0], 48_000);
        let long = render((180.0, 1.0, 1.0, 0.3), &[0], 48_000);
        assert!(energy(&long, 9_600, 14_400) > 20.0 * energy(&short, 9_600, 14_400), "tone 1 must still hiss at 200-300 ms");
        let quiet = render((180.0, 0.5, 0.25, 0.3), &[0], 48_000);
        let loud = render((180.0, 0.5, 1.0, 0.3), &[0], 48_000);
        assert!(energy(&loud, 2_400, 9_600) > 2.0 * energy(&quiet, 2_400, 9_600));
        assert!(long.iter().all(|v| v.is_finite()));
        assert!(long[40_000..].iter().all(|&v| v == 0.0), "the voice switches off once silent");
    }

    /// A retrigger fades the previous hit instead of jumping (no click).
    #[test]
    fn retrigger_does_not_click() {
        let x = render((180.0, 0.5, 0.6, 0.3), &[0, 2_000], 6_000);
        let jump = x.windows(2).skip(1_990).take(20).map(|w| (w[1] - w[0]).abs()).fold(0.0f32, f32::max);
        let typical = x.windows(2).skip(1_000).take(900).map(|w| (w[1] - w[0]).abs()).fold(0.0f32, f32::max);
        assert!(jump < 2.5 * typical.max(0.02), "retrigger step {jump} vs running steps {typical}");
    }
}
