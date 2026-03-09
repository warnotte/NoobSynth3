use crate::common::{input_at, sample_at, Sample};

// Wah-wah pedal — resonant bandpass filter swept by envelope follower or LFO

pub struct Wah {
    sample_rate: f32,
    // Bandpass filter state (2-pole SVF)
    bp_ic1: f32,
    bp_ic2: f32,
    // Envelope follower
    env_level: f32,
    // LFO phase
    lfo_phase: f32,
}

pub struct WahInputs<'a> {
    pub input: Option<&'a [Sample]>,
}

pub struct WahParams<'a> {
    pub mode: &'a [Sample],        // 0=envelope, 1=LFO
    pub freq: &'a [Sample],        // Base frequency 200-2000 Hz
    pub range: &'a [Sample],       // Sweep range 0-1 (how far the wah sweeps)
    pub resonance: &'a [Sample],   // Filter Q 0-1
    pub speed: &'a [Sample],       // LFO rate 0.1-10 Hz (LFO mode)
    pub sensitivity: &'a [Sample], // Envelope sensitivity 0-1 (env mode)
    pub mix: &'a [Sample],         // Dry/wet 0-1
}

impl Wah {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            bp_ic1: 0.0,
            bp_ic2: 0.0,
            env_level: 0.0,
            lfo_phase: 0.0,
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: WahInputs<'_>,
        params: WahParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        let sr = self.sample_rate;
        let inv_sr = 1.0 / sr;
        let tau = std::f32::consts::TAU;

        for i in 0..output.len() {
            let dry = input_at(inputs.input, i);
            let mode = sample_at(params.mode, i, 0.0);
            let base_freq = sample_at(params.freq, i, 800.0).clamp(200.0, 2000.0);
            let range = sample_at(params.range, i, 0.7).clamp(0.0, 1.0);
            let resonance = sample_at(params.resonance, i, 0.5).clamp(0.0, 1.0);
            let lfo_speed = sample_at(params.speed, i, 2.0).clamp(0.1, 10.0);
            let sensitivity = sample_at(params.sensitivity, i, 0.7).clamp(0.0, 1.0);
            let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);

            // Modulation source
            let mod_val = if mode < 0.5 {
                // Envelope follower mode
                let abs_in = dry.abs();
                let attack = 0.005; // 5ms attack
                let release = 0.05; // 50ms release
                let alpha = if abs_in > self.env_level {
                    inv_sr / (attack + inv_sr)
                } else {
                    inv_sr / (release + inv_sr)
                };
                self.env_level += alpha * (abs_in - self.env_level);
                (self.env_level * sensitivity * 4.0).min(1.0)
            } else {
                // LFO mode
                self.lfo_phase += lfo_speed * inv_sr;
                if self.lfo_phase >= 1.0 {
                    self.lfo_phase -= 1.0;
                }
                (self.lfo_phase * tau).sin() * 0.5 + 0.5 // 0..1
            };

            // Calculate swept frequency
            let sweep = base_freq * (1.0 + mod_val * range * 4.0); // Up to 5x base
            let freq = sweep.min(sr * 0.45);

            // SVF bandpass
            let q = 0.5 + resonance * 9.5; // Q from 0.5 to 10
            let g = (std::f32::consts::PI * freq * inv_sr).tan();
            let k = 1.0 / q;
            let a1 = 1.0 / (1.0 + g * (g + k));
            let a2 = g * a1;
            let a3 = g * a2;

            let v3 = dry - self.bp_ic2;
            let v1 = a1 * self.bp_ic1 + a2 * v3;
            let v2 = self.bp_ic2 + a2 * self.bp_ic1 + a3 * v3;
            self.bp_ic1 = 2.0 * v1 - self.bp_ic1;
            self.bp_ic2 = 2.0 * v2 - self.bp_ic2;

            let bp = v1; // Bandpass output
            let wet = bp * (1.0 + resonance * 2.0); // Boost at high Q

            output[i] = dry * (1.0 - mix) + wet * mix;
        }
    }
}
