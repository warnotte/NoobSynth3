//! High-Pass Filter.
//!
//! Simple high-pass filter wrapper around Vcf.

use crate::common::Sample;
use crate::filters::Vcf;

/// High-Pass Filter.
///
/// A simplified high-pass filter that wraps the Vcf with fixed settings
/// for highpass mode. Only exposes cutoff frequency control.
///
/// # Parameters
///
/// - `cutoff`: Cutoff frequency in Hz (20-20000)
///
/// # Example
///
/// ```ignore
/// use dsp_core::filters::{Hpf, HpfParams, HpfInputs};
///
/// let mut hpf = Hpf::new(44100.0);
/// let mut output = [0.0f32; 128];
/// let input = [0.5f32; 128];
///
/// hpf.process_block(
///     &mut output,
///     HpfInputs { audio: Some(&input) },
///     HpfParams { cutoff: &[280.0] },
/// );
/// ```
pub struct Hpf {
    vcf: Vcf,
}

/// Parameters for Hpf.
pub struct HpfParams<'a> {
    /// Cutoff frequency in Hz (20-20000)
    pub cutoff: &'a [Sample],
}

/// Input signals for Hpf.
pub struct HpfInputs<'a> {
    /// Audio input
    pub audio: Option<&'a [Sample]>,
}

impl Hpf {
    /// Create a new high-pass filter.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            vcf: Vcf::new(sample_rate),
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.vcf.set_sample_rate(sample_rate);
    }

    /// Process a block of samples.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: HpfInputs,
        params: HpfParams,
    ) {
        use crate::filters::{VcfInputs, VcfParams};

        // Fixed parameters for highpass mode
        let zero = [0.0_f32];
        let one = [1.0_f32];

        let vcf_params = VcfParams {
            cutoff: params.cutoff,
            resonance: &zero,
            drive: &zero,
            env_amount: &zero,
            mod_amount: &zero,
            key_track: &zero,
            model: &zero,       // SVF model
            mode: &one,         // 1 = highpass
            slope: &zero,       // 12dB
        };

        let vcf_inputs = VcfInputs {
            audio: inputs.audio,
            mod_in: None,
            env: None,
            key: None,
        };

        self.vcf.process_block(output, vcf_inputs, vcf_params);
    }
}
