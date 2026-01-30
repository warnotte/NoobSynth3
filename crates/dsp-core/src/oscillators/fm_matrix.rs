//! FM Matrix 4-operator synthesizer module.
//!
//! A professional 4-operator FM synthesizer inspired by the Yamaha DX7,
//! with 8 algorithm presets and independent ADSR envelopes per operator.

use std::f64::consts::TAU;

/// Envelope stage for FM operator.
#[derive(Clone, Copy, PartialEq)]
enum EnvStage {
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
}

/// Single FM operator state.
#[derive(Clone)]
struct Operator {
    phase: f64,
    env_stage: EnvStage,
    env_level: f32,
    feedback_buf: [f32; 2],
    feedback_idx: usize,
    prev_gate: f32,
}

impl Operator {
    fn new() -> Self {
        Self {
            phase: 0.0,
            env_stage: EnvStage::Idle,
            env_level: 0.0,
            feedback_buf: [0.0; 2],
            feedback_idx: 0,
            prev_gate: 0.0,
        }
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.env_stage = EnvStage::Idle;
        self.env_level = 0.0;
        self.feedback_buf = [0.0; 2];
        self.feedback_idx = 0;
        self.prev_gate = 0.0;
    }
}

/// FM Matrix 4-operator synthesizer.
pub struct FmMatrix {
    sample_rate: f32,
    operators: [Operator; 4],
}

/// Parameters for a single operator.
#[derive(Clone, Copy)]
pub struct OpParams {
    pub ratio: f32,
    pub level: f32,
    pub detune: f32,
    pub attack_ms: f32,
    pub decay_ms: f32,
    pub sustain: f32,
    pub release_ms: f32,
}

impl Default for OpParams {
    fn default() -> Self {
        Self {
            ratio: 1.0,
            level: 1.0,
            detune: 0.0,
            attack_ms: 10.0,
            decay_ms: 300.0,
            sustain: 0.7,
            release_ms: 500.0,
        }
    }
}

/// Parameters for FM Matrix.
pub struct FmMatrixParams {
    pub algorithm: usize,
    pub feedback: f32,
    pub brightness: f32,
    pub master: f32,
    pub ops: [OpParams; 4],
}

impl Default for FmMatrixParams {
    fn default() -> Self {
        Self {
            algorithm: 0,
            feedback: 0.5,
            brightness: 0.7,
            master: 0.8,
            ops: [
                OpParams { ratio: 1.0, level: 1.0, ..Default::default() },
                OpParams { ratio: 2.0, level: 0.5, ..Default::default() },
                OpParams { ratio: 3.0, level: 0.3, ..Default::default() },
                OpParams { ratio: 4.0, level: 0.2, ..Default::default() },
            ],
        }
    }
}

/// Algorithm routing definition.
/// Each algorithm defines which operators modulate which, and which are carriers.
/// Bit layout for modulation matrix (16 bits):
///   - bits 0-3: Op1 receives modulation from [Op1, Op2, Op3, Op4]
///   - bits 4-7: Op2 receives modulation from [Op1, Op2, Op3, Op4]
///   - bits 8-11: Op3 receives modulation from [Op1, Op2, Op3, Op4]
///   - bits 12-15: Op4 receives modulation from [Op1, Op2, Op3, Op4]
/// Carrier mask (4 bits): which operators output to audio
struct Algorithm {
    mod_matrix: u16,
    carriers: u8,
}

const ALGORITHMS: [Algorithm; 8] = [
    // 1: Stack (4→3→2→1) - Classic bell/metallic
    Algorithm {
        mod_matrix: 0b0000_0100_0010_0100, // Op1←Op2, Op2←Op3, Op3←Op4
        carriers: 0b0001, // Op1 is carrier
    },
    // 2: Parallel (2→1, 4→3) - Dual carriers, rich
    Algorithm {
        mod_matrix: 0b0000_1000_0000_0010, // Op1←Op2, Op3←Op4
        carriers: 0b0101, // Op1 and Op3 are carriers
    },
    // 3: Y-Shape (3→2→1, 4→1) - Brass
    Algorithm {
        mod_matrix: 0b0000_0100_0010_1100, // Op1←Op2+Op4, Op2←Op3
        carriers: 0b0001, // Op1 is carrier
    },
    // 4: Diamond (4→2, 4→3, 2→1, 3→1) - Complex, evolving
    Algorithm {
        mod_matrix: 0b0000_1000_1000_0110, // Op1←Op2+Op3, Op2←Op4, Op3←Op4
        carriers: 0b0001, // Op1 is carrier
    },
    // 5: Branch (4→3→2, 4→1) - Organ FM
    Algorithm {
        mod_matrix: 0b0000_0100_1000_1000, // Op1←Op4, Op2←Op3, Op3←Op4
        carriers: 0b0011, // Op1 and Op2 are carriers
    },
    // 6: Dual Stack (4→3, 2→1) - Two independent sounds
    Algorithm {
        mod_matrix: 0b0000_1000_0000_0010, // Op1←Op2, Op3←Op4
        carriers: 0b0101, // Op1 and Op3 are carriers
    },
    // 7: Triple Mod (4→1, 3→1, 2→1) - Very rich
    Algorithm {
        mod_matrix: 0b0000_0000_0000_1110, // Op1←Op2+Op3+Op4
        carriers: 0b0001, // Op1 is carrier
    },
    // 8: Full Parallel (all carriers) - Additive/organ
    Algorithm {
        mod_matrix: 0b0000_0000_0000_0000, // No modulation
        carriers: 0b1111, // All operators are carriers
    },
];

impl FmMatrix {
    /// Create a new FM Matrix synthesizer.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate: sample_rate.max(1.0),
            operators: [
                Operator::new(),
                Operator::new(),
                Operator::new(),
                Operator::new(),
            ],
        }
    }

    /// Update the sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Reset all operators.
    pub fn reset(&mut self) {
        for op in &mut self.operators {
            op.reset();
        }
    }

    /// Process a single sample.
    /// Returns the output sample.
    pub fn process_sample(
        &mut self,
        freq_hz: f32,
        gate: f32,
        velocity: f32,
        fm_external: f32,
        params: &FmMatrixParams,
    ) -> f32 {
        let algo = &ALGORITHMS[params.algorithm.min(7)];
        let dt_ms = 1000.0 / self.sample_rate;

        // Detect gate edges
        let gate_on = gate > 0.5;
        let gate_rising = gate > 0.5 && self.operators[0].prev_gate <= 0.5;
        let gate_falling = gate <= 0.5 && self.operators[0].prev_gate > 0.5;

        // Process envelopes for all operators
        let mut env_levels = [0.0f32; 4];
        for (i, op) in self.operators.iter_mut().enumerate() {
            let op_params = &params.ops[i];

            // Update gate tracking (use op 0's prev_gate for all)
            if i == 0 {
                op.prev_gate = gate;
            }

            // Envelope state machine
            if gate_rising {
                op.env_stage = EnvStage::Attack;
            } else if gate_falling && op.env_stage != EnvStage::Idle {
                op.env_stage = EnvStage::Release;
            }

            // Calculate envelope
            match op.env_stage {
                EnvStage::Idle => {
                    op.env_level = 0.0;
                }
                EnvStage::Attack => {
                    let attack_rate = 1.0 / op_params.attack_ms.max(0.1);
                    op.env_level += attack_rate * dt_ms;
                    if op.env_level >= 1.0 {
                        op.env_level = 1.0;
                        op.env_stage = EnvStage::Decay;
                    }
                }
                EnvStage::Decay => {
                    let target = op_params.sustain;
                    let decay_rate = (1.0 - target) / op_params.decay_ms.max(0.1);
                    op.env_level -= decay_rate * dt_ms;
                    if op.env_level <= target {
                        op.env_level = target;
                        op.env_stage = EnvStage::Sustain;
                    }
                }
                EnvStage::Sustain => {
                    op.env_level = op_params.sustain;
                    if !gate_on {
                        op.env_stage = EnvStage::Release;
                    }
                }
                EnvStage::Release => {
                    let release_rate = op.env_level / op_params.release_ms.max(0.1);
                    op.env_level -= release_rate * dt_ms;
                    if op.env_level <= 0.001 {
                        op.env_level = 0.0;
                        op.env_stage = EnvStage::Idle;
                    }
                }
            }

            env_levels[i] = op.env_level;
        }

        // Calculate operator outputs with FM routing
        // Process in reverse order (Op4 first, then Op3, Op2, Op1)
        // so modulators are computed before carriers
        let mut op_outputs = [0.0f32; 4];

        for i in (0..4).rev() {
            let op = &mut self.operators[i];
            let op_params = &params.ops[i];

            // Calculate frequency with ratio and detune
            let detune_factor = (2.0_f32).powf(op_params.detune / 1200.0);
            let op_freq = freq_hz * op_params.ratio * detune_factor;

            // Gather modulation from other operators based on algorithm
            let mut fm_mod = 0.0f32;
            for j in 0..4 {
                let bit_pos = i * 4 + j;
                if (algo.mod_matrix >> bit_pos) & 1 == 1 {
                    fm_mod += op_outputs[j];
                }
            }

            // Add external FM to Op4 only
            if i == 3 {
                fm_mod += fm_external;
            }

            // Self-feedback for Op4
            if i == 3 && params.feedback > 0.0 {
                let fb = (op.feedback_buf[0] + op.feedback_buf[1]) * 0.5
                    * params.feedback * std::f32::consts::PI;
                fm_mod += fb;
            }

            // Apply brightness scaling to modulators (non-carriers)
            let is_carrier = (algo.carriers >> i) & 1 == 1;
            let level_scale = if is_carrier { 1.0 } else { params.brightness };

            // Phase increment
            let phase_inc = (op_freq as f64 / self.sample_rate as f64) * TAU;

            // Generate sine with FM
            let modulated_phase = op.phase + (fm_mod as f64 * std::f64::consts::PI);
            let out = modulated_phase.sin() as f32;

            // Update phase
            op.phase += phase_inc;
            if op.phase >= TAU {
                op.phase -= TAU;
            }

            // Store for feedback (Op4 only)
            if i == 3 {
                op.feedback_buf[op.feedback_idx] = out;
                op.feedback_idx = (op.feedback_idx + 1) % 2;
            }

            // Apply envelope and level
            op_outputs[i] = out * env_levels[i] * op_params.level * level_scale;
        }

        // Sum carriers
        let mut output = 0.0f32;
        for i in 0..4 {
            if (algo.carriers >> i) & 1 == 1 {
                output += op_outputs[i];
            }
        }

        // Apply master level and velocity
        output * params.master * velocity
    }

    /// Get the current envelope level of operator 1 (for mod-out).
    pub fn get_env_level(&self) -> f32 {
        self.operators[0].env_level
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fm_matrix_creation() {
        let fm = FmMatrix::new(48000.0);
        assert_eq!(fm.operators.len(), 4);
    }

    #[test]
    fn test_algorithm_count() {
        assert_eq!(ALGORITHMS.len(), 8);
    }

    #[test]
    fn test_silent_without_gate() {
        let mut fm = FmMatrix::new(48000.0);
        let params = FmMatrixParams::default();

        // Without gate, output should be silent
        let out = fm.process_sample(440.0, 0.0, 1.0, 0.0, &params);
        assert_eq!(out, 0.0);
    }

    #[test]
    fn test_produces_sound_with_gate() {
        let mut fm = FmMatrix::new(48000.0);
        let params = FmMatrixParams::default();

        // Process multiple samples with gate on
        let mut max_output = 0.0f32;
        for _ in 0..1000 {
            let out = fm.process_sample(440.0, 1.0, 1.0, 0.0, &params);
            max_output = max_output.max(out.abs());
        }

        // Should produce some output
        assert!(max_output > 0.0);
    }
}
