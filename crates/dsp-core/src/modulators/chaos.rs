use crate::common::{sample_at, get_scale_notes};

#[derive(Debug, Clone)]
pub struct ChaosParams<'a> {
    pub speed: &'a [f32],
    pub rho: &'a [f32],
    pub sigma: &'a [f32],
    pub beta: &'a [f32],
    pub scale: &'a [f32],
    pub root: &'a [f32],
}

impl<'a> Default for ChaosParams<'a> {
    fn default() -> Self {
        Self {
            speed: &[0.5],
            rho: &[28.0],
            sigma: &[10.0],
            beta: &[8.0 / 3.0],
            scale: &[0.0],
            root: &[0.0],
        }
    }
}

pub struct ChaosInputs<'a> {
    pub speed: Option<&'a [f32]>,
}

#[derive(Debug, Clone)]
pub struct Chaos {
    x: f32,
    y: f32,
    z: f32,
    sample_rate: f32,
    last_z: f32,      // For trigger detection
    trigger_timer: i32, // To keep gate high for a few samples
}

impl Chaos {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            x: 0.1,
            y: 0.0,
            z: 0.0,
            sample_rate,
            last_z: 0.0,
            trigger_timer: 0,
        }
    }

    pub fn process_block(
        &mut self,
        out_x: &mut [f32],
        out_y: &mut [f32],
        out_z: &mut [f32],
        out_gate: &mut [f32],
        inputs: ChaosInputs,
        params: ChaosParams,
    ) {
        const REF_SR: f32 = 44100.0;
        let base_dt = 0.005;
        let sr_scaler = REF_SR / self.sample_rate.max(1.0);
        let speed_cv = inputs.speed.unwrap_or(&[]);

        for i in 0..out_x.len() {
            let speed_mod = sample_at(speed_cv, i, 1.0).max(0.0);
            let p_speed = sample_at(params.speed, i, 0.5);
            let p_rho = sample_at(params.rho, i, 28.0);
            let p_sigma = sample_at(params.sigma, i, 10.0);
            let p_beta = sample_at(params.beta, i, 2.666);
            let p_scale = sample_at(params.scale, i, 0.0) as i32;
            let p_root = sample_at(params.root, i, 0.0) as i32;

            let dt = base_dt * p_speed * speed_mod * sr_scaler;

            let dx = p_sigma * (self.y - self.x);
            let dy = self.x * (p_rho - self.z) - self.y;
            let dz = self.x * self.y - p_beta * self.z;

            self.x += dx * dt;
            self.y += dy * dt;
            self.z += dz * dt;

            let raw_x = self.x * 0.05;
            let raw_y = self.y * 0.05;
            let raw_z = (self.z * 0.05) - 1.0;

            if p_scale > 0 {
                out_x[i] = self.quantize(raw_x, p_scale, p_root);
                out_y[i] = self.quantize(raw_y, p_scale, p_root);
                out_z[i] = self.quantize(raw_z, p_scale, p_root);
            } else {
                out_x[i] = raw_x;
                out_y[i] = raw_y;
                out_z[i] = raw_z;
            }

            // TRIGGER LOGIC MkII:
            // Detect when Z crosses the threshold (0.5) from bottom to top
            let z_threshold = 0.5;
            if raw_z > z_threshold && self.last_z <= z_threshold {
                self.trigger_timer = (0.01 * self.sample_rate) as i32; // 10ms pulse
            }

            if self.trigger_timer > 0 {
                out_gate[i] = 1.0;
                self.trigger_timer -= 1;
            } else {
                out_gate[i] = 0.0;
            }

            self.last_z = raw_z;
        }
    }

    fn quantize(&self, value: f32, scale_idx: i32, root: i32) -> f32 {
        let note_in = value * 36.0; 
        let scale_notes = get_scale_notes(scale_idx);
        if scale_notes.is_empty() { return value; }
        let root_note = root as f32;
        let mut best_note = 0.0;
        let mut min_dist = 1000.0;
        let base_octave = (note_in / 12.0).floor() as i32;
        for oct in (base_octave - 1)..=(base_octave + 1) {
            for &interval in scale_notes {
                let candidate = (oct * 12) as f32 + interval as f32 + root_note;
                let dist = (note_in - candidate).abs();
                if dist < min_dist {
                    min_dist = dist;
                    best_note = candidate;
                }
            }
        }
        best_note / 12.0
    }
}