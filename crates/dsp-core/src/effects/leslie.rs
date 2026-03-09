use crate::common::{clamp, input_at, sample_at, Sample};

// ============================================================================
// Leslie Rotary Speaker
// ============================================================================
//
// Simulates a Leslie 122/147 cabinet:
//  - Crossover filter splits signal at ~800 Hz
//  - Horn rotor (treble): slow ~0.8 Hz, fast ~6.8 Hz
//  - Drum rotor (bass):   slow ~0.7 Hz, fast ~5.8 Hz
//  - AM + Doppler modulation per rotor, stereo output
//  - Smooth speed ramp (acceleration/deceleration)
//  - Optional soft overdrive before cabinet

const HORN_SLOW: f32 = 0.8;
const HORN_FAST: f32 = 6.8;
const DRUM_SLOW: f32 = 0.7;
const DRUM_FAST: f32 = 5.8;

// Acceleration/deceleration: horn speeds up faster than drum
const HORN_ACCEL: f32 = 3.0; // Hz/s rate of change
const DRUM_ACCEL: f32 = 1.5;

// Crossover frequency
const CROSSOVER_HZ: f32 = 800.0;

pub struct Leslie {
    sample_rate: f32,
    // Rotor phases
    horn_phase: f32,
    drum_phase: f32,
    // Current rotor speeds (smoothly ramped)
    horn_rate: f32,
    drum_rate: f32,
    // 1-pole crossover filter state (L/R)
    lp_l: f32,
    lp_r: f32,
    // Small delay lines for Doppler (horn L/R, drum L/R)
    horn_buf_l: Vec<Sample>,
    horn_buf_r: Vec<Sample>,
    drum_buf_l: Vec<Sample>,
    drum_buf_r: Vec<Sample>,
    write_idx: usize,
}

pub struct LeslieInputs<'a> {
    pub input_l: Option<&'a [Sample]>,
    pub input_r: Option<&'a [Sample]>,
}

pub struct LeslieParams<'a> {
    pub speed: &'a [Sample],    // 0 = slow, 1 = fast
    pub brake: &'a [Sample],    // 1 = stop rotors
    pub drive: &'a [Sample],    // 0..1 overdrive
    pub depth: &'a [Sample],    // 0..1 modulation depth
    pub horn_drum: &'a [Sample],// 0..1 horn/drum balance (0.5=balanced)
    pub mic_dist: &'a [Sample], // 0..1 mic distance (0=close, 1=far)
    pub ramp: &'a [Sample],     // 0..1 ramp speed (0=slow, 1=fast)
    pub mix: &'a [Sample],      // 0..1 dry/wet
}

impl Leslie {
    pub fn new(sample_rate: f32) -> Self {
        let sr = sample_rate.max(1.0);
        // Doppler buffer: ~5ms max delay per rotor
        let buf_size = ((0.005 * sr) as usize + 2).max(4);
        Self {
            sample_rate: sr,
            horn_phase: 0.0,
            drum_phase: 0.0,
            horn_rate: HORN_SLOW,
            drum_rate: DRUM_SLOW,
            lp_l: 0.0,
            lp_r: 0.0,
            horn_buf_l: vec![0.0; buf_size],
            horn_buf_r: vec![0.0; buf_size],
            drum_buf_l: vec![0.0; buf_size],
            drum_buf_r: vec![0.0; buf_size],
            write_idx: 0,
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        let sr = sample_rate.max(1.0);
        if (sr - self.sample_rate).abs() > 1.0 {
            self.sample_rate = sr;
            let buf_size = ((0.005 * sr) as usize + 2).max(4);
            self.horn_buf_l = vec![0.0; buf_size];
            self.horn_buf_r = vec![0.0; buf_size];
            self.drum_buf_l = vec![0.0; buf_size];
            self.drum_buf_r = vec![0.0; buf_size];
            self.write_idx = 0;
        }
    }

    fn read_interp(buffer: &[Sample], write_idx: usize, delay_samples: f32) -> f32 {
        let size = buffer.len() as i32;
        let read_pos = write_idx as f32 - delay_samples;
        let base = read_pos.floor();
        let mut ia = base as i32 % size;
        if ia < 0 {
            ia += size;
        }
        let ib = (ia + 1) % size;
        let frac = read_pos - base;
        buffer[ia as usize] + (buffer[ib as usize] - buffer[ia as usize]) * frac
    }

    pub fn process_block(
        &mut self,
        out_l: &mut [Sample],
        out_r: &mut [Sample],
        inputs: LeslieInputs<'_>,
        params: LeslieParams<'_>,
    ) {
        if out_l.is_empty() || out_r.is_empty() {
            return;
        }

        let sr = self.sample_rate;
        let tau = std::f32::consts::TAU;
        let inv_sr = 1.0 / sr;
        let buf_size = self.horn_buf_l.len();

        // Crossover coefficient (1-pole LP at CROSSOVER_HZ)
        let rc = 1.0 / (tau * CROSSOVER_HZ);
        let alpha = inv_sr / (rc + inv_sr);

        for i in 0..out_l.len() {
            let speed = sample_at(params.speed, i, 0.0);
            let brake = sample_at(params.brake, i, 0.0) >= 0.5;
            let drive = sample_at(params.drive, i, 0.0).clamp(0.0, 1.0);
            let depth = sample_at(params.depth, i, 0.7).clamp(0.0, 1.0);
            let horn_drum = sample_at(params.horn_drum, i, 0.5).clamp(0.0, 1.0);
            let mic_dist = sample_at(params.mic_dist, i, 0.0).clamp(0.0, 1.0);
            let ramp_speed = sample_at(params.ramp, i, 0.5).clamp(0.0, 1.0);
            let mix = sample_at(params.mix, i, 1.0).clamp(0.0, 1.0);

            // Target rates
            let (horn_target, drum_target) = if brake {
                (0.0, 0.0)
            } else if speed >= 0.5 {
                (HORN_FAST, DRUM_FAST)
            } else {
                (HORN_SLOW, DRUM_SLOW)
            };

            // Smooth ramp toward target (ramp_speed: 0=slow, 1=fast)
            let ramp_mult = 0.5 + ramp_speed * 3.0; // 0.5x to 3.5x
            let horn_accel = HORN_ACCEL * ramp_mult;
            let drum_accel = DRUM_ACCEL * ramp_mult;
            let horn_diff = horn_target - self.horn_rate;
            let drum_diff = drum_target - self.drum_rate;
            self.horn_rate += horn_diff.signum() * (horn_accel * inv_sr).min(horn_diff.abs());
            self.drum_rate += drum_diff.signum() * (drum_accel * inv_sr).min(drum_diff.abs());

            // Input
            let dry_l = input_at(inputs.input_l, i);
            let dry_r = match inputs.input_r {
                Some(_) => input_at(inputs.input_r, i),
                None => dry_l,
            };

            // Soft overdrive (tanh waveshaping)
            let gain = 1.0 + drive * 8.0; // 1x to 9x gain
            let od_l = (dry_l * gain).tanh();
            let od_r = (dry_r * gain).tanh();

            // Crossover: LP = bass (drum), HP = treble (horn)
            self.lp_l += alpha * (od_l - self.lp_l);
            self.lp_r += alpha * (od_r - self.lp_r);
            let bass_l = self.lp_l;
            let bass_r = self.lp_r;
            let treble_l = od_l - bass_l;
            let treble_r = od_r - bass_r;

            // --- HORN ROTOR (treble) ---
            let horn_sin = self.horn_phase.sin();
            let horn_cos = self.horn_phase.cos();
            // AM: volume modulation (0.5 + 0.5*depth*sin for L, cos for R)
            let horn_am_l = 1.0 - depth * 0.5 * (1.0 - horn_sin);
            let horn_am_r = 1.0 - depth * 0.5 * (1.0 - horn_cos);
            // Doppler: delay modulation (0.5-2.5ms based on rotor position)
            let horn_delay_base = 1.5 * sr / 1000.0; // 1.5ms center
            let horn_delay_mod = depth * 1.0 * sr / 1000.0; // ±1ms
            let horn_del_l = horn_delay_base + horn_delay_mod * horn_sin;
            let horn_del_r = horn_delay_base + horn_delay_mod * horn_cos;

            // Write treble to horn buffers
            self.horn_buf_l[self.write_idx] = treble_l;
            self.horn_buf_r[self.write_idx] = treble_r;
            let horn_l = Self::read_interp(&self.horn_buf_l, self.write_idx, horn_del_l) * horn_am_l;
            let horn_r = Self::read_interp(&self.horn_buf_r, self.write_idx, horn_del_r) * horn_am_r;

            // --- DRUM ROTOR (bass) ---
            let drum_sin = self.drum_phase.sin();
            let drum_cos = self.drum_phase.cos();
            // AM: bass modulation is subtler
            let drum_am_l = 1.0 - depth * 0.3 * (1.0 - drum_sin);
            let drum_am_r = 1.0 - depth * 0.3 * (1.0 - drum_cos);
            // Doppler: bass gets less pitch modulation
            let drum_delay_base = 2.0 * sr / 1000.0;
            let drum_delay_mod = depth * 0.5 * sr / 1000.0;
            let drum_del_l = drum_delay_base + drum_delay_mod * drum_sin;
            let drum_del_r = drum_delay_base + drum_delay_mod * drum_cos;

            self.drum_buf_l[self.write_idx] = bass_l;
            self.drum_buf_r[self.write_idx] = bass_r;
            let drum_l = Self::read_interp(&self.drum_buf_l, self.write_idx, drum_del_l) * drum_am_l;
            let drum_r = Self::read_interp(&self.drum_buf_r, self.write_idx, drum_del_r) * drum_am_r;

            // Combine with horn/drum balance
            // horn_drum: 0=all drum, 0.5=balanced, 1=all horn
            let horn_level = horn_drum.min(1.0) * 2.0; // 0..1 -> 0..2
            let drum_level = (1.0 - horn_drum).min(1.0) * 2.0;
            let horn_gain = horn_level.min(1.0);
            let drum_gain = drum_level.min(1.0);

            let wet_l = horn_l * horn_gain + drum_l * drum_gain;
            let wet_r = horn_r * horn_gain + drum_r * drum_gain;

            // Mic distance: close=dry/direct, far=more blended/diffuse
            // Simulates mic placement: close mic = more stereo separation, far = more mono/room
            let stereo_narrow = mic_dist * 0.6; // 0=full stereo, 0.6=mostly mono
            let mid = (wet_l + wet_r) * 0.5;
            let final_wet_l = wet_l + (mid - wet_l) * stereo_narrow;
            let final_wet_r = wet_r + (mid - wet_r) * stereo_narrow;

            let dry_mix = 1.0 - mix;
            out_l[i] = dry_l * dry_mix + final_wet_l * mix;
            out_r[i] = dry_r * dry_mix + final_wet_r * mix;

            // Advance phases
            self.horn_phase += tau * self.horn_rate * inv_sr;
            if self.horn_phase >= tau {
                self.horn_phase -= tau;
            }
            self.drum_phase += tau * self.drum_rate * inv_sr;
            if self.drum_phase >= tau {
                self.drum_phase -= tau;
            }

            self.write_idx = (self.write_idx + 1) % buf_size;
        }
    }
}
