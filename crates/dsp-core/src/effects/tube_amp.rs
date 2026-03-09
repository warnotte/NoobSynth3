use crate::common::{input_at, sample_at, Sample};

// Tube Amplifier — multi-stage tube saturation with tone stack

pub struct TubeAmp {
    sample_rate: f32,
    // Tone stack filter states
    lp_state: f32,
    hp_state: f32,
    // DC blocker
    dc_in: f32,
    dc_out: f32,
}

pub struct TubeAmpInputs<'a> {
    pub input: Option<&'a [Sample]>,
}

pub struct TubeAmpParams<'a> {
    pub gain: &'a [Sample],    // Input gain / drive 0-1
    pub stages: &'a [Sample],  // Number of tube stages 1-4
    pub tone: &'a [Sample],    // Tone 0-1 (dark to bright)
    pub bias: &'a [Sample],    // Tube bias 0-1 (clean to asymmetric)
    pub sag: &'a [Sample],     // Power supply sag 0-1 (compression)
    pub mix: &'a [Sample],     // Dry/wet 0-1
}

impl TubeAmp {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            lp_state: 0.0,
            hp_state: 0.0,
            dc_in: 0.0,
            dc_out: 0.0,
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Tube stage: asymmetric soft clipping (triode characteristic)
    #[inline]
    fn tube_stage(input: f32, bias: f32) -> f32 {
        // Asymmetric waveshaping: positive side clips harder
        let biased = input + bias * 0.3;
        if biased >= 0.0 {
            // Positive: soft clip via tanh (tubes compress positive more)
            (biased * 1.5).tanh()
        } else {
            // Negative: softer clip (tubes are more linear on negative swing)
            let x = biased * 1.2;
            x / (1.0 + x.abs())
        }
    }

    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: TubeAmpInputs<'_>,
        params: TubeAmpParams<'_>,
    ) {
        if output.is_empty() { return; }

        let inv_sr = 1.0 / self.sample_rate;
        let tau = std::f32::consts::TAU;

        for i in 0..output.len() {
            let dry = input_at(inputs.input, i);
            let gain = sample_at(params.gain, i, 0.5).clamp(0.0, 1.0);
            let num_stages = sample_at(params.stages, i, 2.0).clamp(1.0, 4.0) as u32;
            let tone = sample_at(params.tone, i, 0.5).clamp(0.0, 1.0);
            let bias = sample_at(params.bias, i, 0.3).clamp(0.0, 1.0);
            let sag = sample_at(params.sag, i, 0.0).clamp(0.0, 1.0);
            let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);

            // Input gain: 1x to 20x
            let input_gain = 1.0 + gain * 19.0;
            let mut sig = dry * input_gain;

            // Power supply sag: compress dynamics
            if sag > 0.01 {
                let level = sig.abs();
                let compression = 1.0 / (1.0 + level * sag * 3.0);
                sig *= compression;
            }

            // Multi-stage tube saturation
            for _stage in 0..num_stages {
                sig = Self::tube_stage(sig, bias);
                sig *= 0.8; // Inter-stage level reduction
            }

            // Tone stack (simple Baxandall-style)
            // LP for bass, HP for treble, blend by tone knob
            let lp_freq = 300.0 + tone * 700.0; // 300-1000 Hz
            let hp_freq = 800.0 + tone * 4000.0; // 800-4800 Hz

            let lp_alpha = inv_sr / (1.0 / (tau * lp_freq) + inv_sr);
            self.lp_state += lp_alpha * (sig - self.lp_state);

            let hp_alpha = inv_sr / (1.0 / (tau * hp_freq) + inv_sr);
            self.hp_state += hp_alpha * (sig - self.hp_state);
            let hp_out = sig - self.hp_state;

            // Blend: dark=more LP, bright=more HP
            sig = self.lp_state * (1.0 - tone) + hp_out * tone + sig * 0.3;

            // DC blocker
            let dc_alpha = 0.995;
            self.dc_out = dc_alpha * (self.dc_out + sig - self.dc_in);
            self.dc_in = sig;
            sig = self.dc_out;

            // Output level compensation
            let level_comp = 1.0 / (1.0 + gain * 2.0);
            sig *= level_comp;

            output[i] = dry * (1.0 - mix) + sig * mix;
        }
    }
}
