//! Voltage Controlled Filter (VCF) module.
//!
//! Provides two filter models:
//! - **SVF (State Variable Filter)**: 12dB or 24dB/oct with LP, HP, BP, Notch modes
//! - **Ladder (Moog-style)**: 12dB or 24dB/oct lowpass only
//!
//! The SVF model offers more flexibility with multiple filter modes,
//! while the Ladder model provides the classic Moog sound.

use crate::common::{input_at, sample_at, saturate, Sample};

/// State Variable Filter internal state.
///
/// Uses the trapezoidal integrator topology for numerical stability.
#[derive(Clone, Copy, Debug)]
pub struct SvfState {
    ic1: f32,
    ic2: f32,
}

impl Default for SvfState {
    fn default() -> Self {
        Self { ic1: 0.0, ic2: 0.0 }
    }
}

/// Moog Ladder Filter internal state.
///
/// Four cascaded one-pole filters for 24dB/oct slope.
#[derive(Clone, Copy, Debug)]
pub struct LadderState {
    stage1: f32,
    stage2: f32,
    stage3: f32,
    stage4: f32,
}

impl Default for LadderState {
    fn default() -> Self {
        Self {
            stage1: 0.0,
            stage2: 0.0,
            stage3: 0.0,
            stage4: 0.0,
        }
    }
}

/// Voltage Controlled Filter with SVF and Ladder models.
///
/// A versatile filter module supporting multiple topologies and modes.
///
/// # Models
///
/// - **SVF (model < 0.5)**: State Variable Filter with trapezoidal integration
///   - Supports LP, HP, BP, Notch modes
///   - Clean self-oscillation at high resonance
///
/// - **Ladder (model >= 0.5)**: Moog-style cascade filter
///   - Lowpass only (falls back to SVF for other modes)
///   - Fat, warm character with musical resonance
///
/// # Filter Modes (SVF)
///
/// - 0: Lowpass - removes high frequencies
/// - 1: Highpass - removes low frequencies
/// - 2: Bandpass - passes only around cutoff
/// - 3: Notch - removes frequencies around cutoff
///
/// # Slope
///
/// - 0: 12dB/octave (2-pole)
/// - 1: 24dB/octave (4-pole, cascade of two stages)
///
/// # Example
///
/// ```ignore
/// use dsp_core::filters::{Vcf, VcfParams, VcfInputs};
///
/// let mut vcf = Vcf::new(44100.0);
/// let mut output = [0.0f32; 128];
///
/// vcf.process_block(&mut output, inputs, params);
/// ```
pub struct Vcf {
    sample_rate: f32,
    stage_a: SvfState,
    stage_b: SvfState,
    ladder: LadderState,
    cutoff_smooth: f32,
    res_smooth: f32,
}

/// Input signals for VCF.
pub struct VcfInputs<'a> {
    /// Audio input to filter
    pub audio: Option<&'a [Sample]>,
    /// Modulation input (adds to cutoff in octaves)
    pub mod_in: Option<&'a [Sample]>,
    /// Envelope input (adds to cutoff in octaves)
    pub env: Option<&'a [Sample]>,
    /// Key tracking input (1V/octave)
    pub key: Option<&'a [Sample]>,
}

/// Parameters for VCF.
pub struct VcfParams<'a> {
    /// Base cutoff frequency in Hz (20-20000)
    pub cutoff: &'a [Sample],
    /// Resonance amount (0-1, self-oscillation near 1)
    pub resonance: &'a [Sample],
    /// Drive/saturation amount (0-1)
    pub drive: &'a [Sample],
    /// Envelope modulation depth in octaves
    pub env_amount: &'a [Sample],
    /// External modulation depth in octaves
    pub mod_amount: &'a [Sample],
    /// Keyboard tracking amount (0 = none, 1 = full)
    pub key_track: &'a [Sample],
    /// Filter model (0 = SVF, 1 = Ladder)
    pub model: &'a [Sample],
    /// Filter mode (0 = LP, 1 = HP, 2 = BP, 3 = Notch)
    pub mode: &'a [Sample],
    /// Filter slope (0 = 12dB, 1 = 24dB)
    pub slope: &'a [Sample],
}

impl Vcf {
    /// Create a new VCF with the given sample rate.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            stage_a: SvfState::default(),
            stage_b: SvfState::default(),
            ladder: LadderState::default(),
            cutoff_smooth: 800.0,
            res_smooth: 0.4,
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Process a single SVF stage.
    ///
    /// Returns (lowpass, bandpass, highpass) outputs.
    fn process_svf_stage(input: f32, g: f32, k: f32, state: &mut SvfState) -> (f32, f32, f32) {
        let a1 = 1.0 / (1.0 + g * (g + k));
        let a2 = g * a1;
        let a3 = g * a2;
        let v3 = input - state.ic2;
        let v1 = a1 * state.ic1 + a2 * v3;
        let v2 = state.ic2 + a2 * state.ic1 + a3 * v3;
        state.ic1 = 2.0 * v1 - state.ic1;
        state.ic2 = 2.0 * v2 - state.ic2;
        let lp = v2;
        let bp = v1;
        let hp = input - k * v1 - v2;
        (lp, bp, hp)
    }

    /// Select output based on filter mode.
    ///
    /// - 0: Lowpass
    /// - 1: Highpass
    /// - 2: Bandpass
    /// - 3: Notch (HP + LP)
    fn select_mode(stage: (f32, f32, f32), mode: f32) -> f32 {
        if mode < 0.5 {
            stage.0 // LP
        } else if mode < 1.5 {
            stage.2 // HP
        } else if mode < 2.5 {
            stage.1 // BP
        } else {
            stage.2 + stage.0 // Notch
        }
    }

    /// Process using SVF topology.
    fn process_svf(
        &mut self,
        input: f32,
        cutoff: f32,
        resonance: f32,
        mode: f32,
        slope: f32,
        drive: f32,
    ) -> f32 {
        let clamped_cutoff = cutoff.min(self.sample_rate * 0.45);
        let g = (std::f32::consts::PI * clamped_cutoff / self.sample_rate).tan();
        let slope24 = slope >= 0.5;
        let resonance_scaled = resonance * if slope24 { 0.38 } else { 1.0 };
        let q = 0.7 + resonance_scaled * if slope24 { 3.8 } else { 8.0 };
        let k = 1.0 / q;

        let drive_gain = 1.0 + drive * if slope24 { 1.0 } else { 2.6 };
        let shaped_input = saturate(input * drive_gain);

        let stage1 = Self::process_svf_stage(shaped_input, g, k, &mut self.stage_a);
        if slope24 {
            let stage1_out = saturate(stage1.0 * (1.0 + drive * 0.2));
            let stage2 = Self::process_svf_stage(stage1_out, g, k, &mut self.stage_b);
            let out = Self::select_mode(stage2, mode);
            let res_comp = 1.0 / (1.0 + resonance_scaled * 1.5);
            return saturate(out * 0.52 * res_comp);
        }
        let out = Self::select_mode(stage1, mode);
        let res_comp = 1.0 / (1.0 + resonance_scaled * 0.6);
        saturate(out * 0.85 * res_comp)
    }

    /// Process using Ladder (Moog-style) topology.
    ///
    /// Note: Ladder only supports lowpass mode.
    fn process_ladder(
        &mut self,
        input: f32,
        cutoff: f32,
        resonance: f32,
        slope: f32,
        drive: f32,
    ) -> f32 {
        let f = (cutoff / self.sample_rate).min(0.49);
        let p = f * (1.8 - 0.8 * f);
        let t1 = (1.0 - p) * 1.386249;
        let t2 = 12.0 + t1 * t1;
        let r = resonance * (t2 + 6.0 * t1) / (t2 - 6.0 * t1);

        let drive_gain = 1.0 + drive * 1.7;
        let input_drive = saturate(input * drive_gain - r * self.ladder.stage4);
        self.ladder.stage1 = input_drive * p + self.ladder.stage1 * (1.0 - p);
        self.ladder.stage2 = self.ladder.stage1 * p + self.ladder.stage2 * (1.0 - p);
        self.ladder.stage3 = self.ladder.stage2 * p + self.ladder.stage3 * (1.0 - p);
        self.ladder.stage4 = self.ladder.stage3 * p + self.ladder.stage4 * (1.0 - p);

        let output = if slope >= 0.5 {
            self.ladder.stage4
        } else {
            self.ladder.stage2
        };
        let res_comp = 1.0 / (1.0 + resonance * 0.85);
        saturate(output * 0.9 * res_comp)
    }

    /// Process a block of audio through the filter.
    pub fn process_block(&mut self, output: &mut [Sample], inputs: VcfInputs<'_>, params: VcfParams<'_>) {
        if output.is_empty() {
            return;
        }

        let mode = params.mode.get(0).copied().unwrap_or(0.0);
        let slope = params.slope.get(0).copied().unwrap_or(1.0);
        let model = params.model.get(0).copied().unwrap_or(0.0);
        let smooth_coeff = 1.0 - (-1.0 / (0.01 * self.sample_rate)).exp();

        for i in 0..output.len() {
            let input_sample = input_at(inputs.audio, i);
            let base_cutoff = sample_at(params.cutoff, i, 800.0);
            let base_res = sample_at(params.resonance, i, 0.4);
            let drive = sample_at(params.drive, i, 0.2);
            let env_amount = sample_at(params.env_amount, i, 0.0);
            let mod_amount = sample_at(params.mod_amount, i, 0.0);
            let key_track = sample_at(params.key_track, i, 0.0);
            let mod_signal = input_at(inputs.mod_in, i);
            let env = input_at(inputs.env, i);
            let key = input_at(inputs.key, i);

            let cutoff = base_cutoff
                * 2.0_f32.powf(key * key_track + mod_signal * mod_amount + env * env_amount);
            self.cutoff_smooth += (cutoff - self.cutoff_smooth) * smooth_coeff;
            self.res_smooth += (base_res - self.res_smooth) * smooth_coeff;

            let cutoff_hz = self.cutoff_smooth.clamp(20.0, 20000.0);
            let resonance = self.res_smooth.clamp(0.0, 1.0);

            // Use ladder for LP mode only (model >= 0.5 and mode < 0.5)
            let use_ladder = model >= 0.5 && mode < 0.5;
            output[i] = if use_ladder {
                self.process_ladder(input_sample, cutoff_hz, resonance, slope, drive)
            } else {
                self.process_svf(input_sample, cutoff_hz, resonance, mode, slope, drive)
            };
        }
    }
}
