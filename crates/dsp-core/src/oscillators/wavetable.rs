// Wavetable Oscillator - Morphing wavetable synthesis
// Banks: Basic, Vocal, Digital, Organic

use std::f32::consts::PI;

const TABLE_SIZE: usize = 2048;
const TABLES_PER_BANK: usize = 8;
const NUM_BANKS: usize = 4;

// Bank indices: 0=Basic, 1=Vocal, 2=Digital, 3=Organic

pub struct Wavetable {
    sample_rate: f32,

    // Wavetable data - Box to avoid stack overflow (256KB!)
    tables: Box<[[[f32; TABLE_SIZE]; TABLES_PER_BANK]; NUM_BANKS]>,

    // Oscillator state
    phase: f32,
    prev_output: f32,

    // Unison
    unison_phases: [f32; 7],
    unison_detunes: [f32; 7],

    // Envelope
    envelope: f32,
    gate_was_high: bool,
    last_gate: f32,
}

#[derive(Clone, Copy)]
pub struct WavetableParams {
    pub frequency: f32,     // Base frequency (Hz)
    pub bank: i32,          // 0-3, wavetable bank
    pub position: f32,      // 0-1, position in wavetable
    pub unison: i32,        // 1-7 voices
    pub detune: f32,        // 0-50 cents
    pub spread: f32,        // 0-1 stereo spread
    pub morph_speed: f32,   // 0-10 Hz, auto-morph LFO
    pub sub_mix: f32,       // 0-1 sub oscillator
    pub attack: f32,        // 0.001-2s
    pub release: f32,       // 0.001-5s
}

pub struct WavetableInputs {
    pub pitch_cv: f32,
    pub gate: f32,
    pub position_cv: f32,
    pub sync: f32,
}

impl Wavetable {
    pub fn new(sample_rate: f32) -> Self {
        // Allocate on heap to avoid stack overflow (tables = 256KB)
        let mut wt = Self {
            sample_rate,
            tables: Box::new([[[0.0; TABLE_SIZE]; TABLES_PER_BANK]; NUM_BANKS]),
            phase: 0.0,
            prev_output: 0.0,
            unison_phases: [0.0; 7],
            unison_detunes: [-0.5, -0.33, -0.17, 0.0, 0.17, 0.33, 0.5],
            envelope: 0.0,
            gate_was_high: false,
            last_gate: 0.0,
        };
        wt.init_tables();
        wt
    }

    fn init_tables(&mut self) {
        // Bank 0: Basic - Classic waveforms
        self.generate_basic_bank();

        // Bank 1: Vocal - Formant shapes
        self.generate_vocal_bank();

        // Bank 2: Digital - Aggressive/complex
        self.generate_digital_bank();

        // Bank 3: Organic - Natural/noise-based
        self.generate_organic_bank();
    }

    fn generate_basic_bank(&mut self) {
        for i in 0..TABLE_SIZE {
            let phase = i as f32 / TABLE_SIZE as f32;
            let t = phase * 2.0 * PI;

            // Table 0: Sine
            self.tables[0][0][i] = t.sin();

            // Table 1: Soft triangle
            self.tables[0][1][i] = {
                let p = phase * 4.0;
                if p < 1.0 { p }
                else if p < 3.0 { 2.0 - p }
                else { p - 4.0 }
            };

            // Table 2: Triangle
            self.tables[0][2][i] = {
                let p = phase * 2.0;
                if p < 1.0 { p * 2.0 - 1.0 } else { 1.0 - (p - 1.0) * 2.0 }
            };

            // Table 3: Sawtooth (bandlimited approximation)
            let mut saw = 0.0;
            for h in 1..=16 {
                saw += (t * h as f32).sin() / h as f32;
            }
            self.tables[0][3][i] = saw * 0.6;

            // Table 4: Square 50%
            let mut sq = 0.0;
            for h in (1..=15).step_by(2) {
                sq += (t * h as f32).sin() / h as f32;
            }
            self.tables[0][4][i] = sq * 0.7;

            // Table 5: Pulse 25%
            self.tables[0][5][i] = if phase < 0.25 { 0.8 } else { -0.2 };

            // Table 6: Pulse 12.5%
            self.tables[0][6][i] = if phase < 0.125 { 0.9 } else { -0.1 };

            // Table 7: Combo (saw + sub)
            self.tables[0][7][i] = saw * 0.4 + (t * 0.5).sin() * 0.5;
        }
    }

    fn generate_vocal_bank(&mut self) {
        // Formant frequencies for vowels (F1, F2, F3)
        let formants = [
            (730.0, 1090.0, 2440.0),  // A
            (660.0, 1720.0, 2410.0),  // transitional
            (530.0, 1840.0, 2480.0),  // E
            (390.0, 1990.0, 2550.0),  // transitional
            (270.0, 2290.0, 3010.0),  // I
            (300.0, 870.0, 2240.0),   // transitional
            (570.0, 840.0, 2410.0),   // O
            (440.0, 1020.0, 2240.0),  // U
        ];

        for (table_idx, &(f1, f2, f3)) in formants.iter().enumerate() {
            for i in 0..TABLE_SIZE {
                let phase = i as f32 / TABLE_SIZE as f32;

                // Base frequency for formant calculation
                let base_freq = 220.0;
                let t = phase * 2.0 * PI;

                // Generate harmonics with formant filtering
                let mut sample = 0.0;
                for h in 1..=32 {
                    let harm_freq = base_freq * h as f32;
                    let amp = 1.0 / h as f32;

                    // Apply formant resonances (simplified)
                    let f1_boost = 1.0 / (1.0 + ((harm_freq - f1) / 80.0).powi(2));
                    let f2_boost = 1.0 / (1.0 + ((harm_freq - f2) / 100.0).powi(2));
                    let f3_boost = 1.0 / (1.0 + ((harm_freq - f3) / 120.0).powi(2));

                    let formant_amp = amp * (0.3 + f1_boost * 0.4 + f2_boost * 0.2 + f3_boost * 0.1);
                    sample += (t * h as f32).sin() * formant_amp;
                }

                self.tables[1][table_idx][i] = (sample * 0.5).clamp(-1.0, 1.0);
            }
        }
    }

    fn generate_digital_bank(&mut self) {
        for i in 0..TABLE_SIZE {
            let phase = i as f32 / TABLE_SIZE as f32;
            let t = phase * 2.0 * PI;

            // Table 0: FM-like 1:1
            self.tables[2][0][i] = (t + 0.5 * t.sin()).sin();

            // Table 1: FM-like 1:2
            self.tables[2][1][i] = (t + 0.7 * (t * 2.0).sin()).sin();

            // Table 2: FM-like 1:3
            self.tables[2][2][i] = (t + 0.6 * (t * 3.0).sin()).sin();

            // Table 3: Hard sync simulation
            let sync_freq = 2.5;
            let sync_phase = (phase * sync_freq).fract();
            self.tables[2][3][i] = (sync_phase * 2.0 * PI).sin();

            // Table 4: Bit-crushed
            let saw = phase * 2.0 - 1.0;
            self.tables[2][4][i] = (saw * 8.0).round() / 8.0;

            // Table 5: Ring mod
            self.tables[2][5][i] = t.sin() * (t * 1.5).sin();

            // Table 6: Metallic
            self.tables[2][6][i] = t.sin() * 0.4 + (t * 2.76).sin() * 0.3 + (t * 5.4).sin() * 0.2;

            // Table 7: Aggressive
            let harsh = (t * 2.0).sin().powi(3) + (t * 3.0).sin().powi(3) * 0.5;
            self.tables[2][7][i] = harsh.tanh();
        }
    }

    fn generate_organic_bank(&mut self) {
        // Use deterministic noise generation
        let mut noise_state: u32 = 12345;
        let mut noise = || -> f32 {
            noise_state = noise_state.wrapping_mul(1664525).wrapping_add(1013904223);
            (noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0
        };

        // Pre-generate some noise
        let mut noise_buffer = [0.0f32; TABLE_SIZE];
        for i in 0..TABLE_SIZE {
            noise_buffer[i] = noise();
        }

        for i in 0..TABLE_SIZE {
            let phase = i as f32 / TABLE_SIZE as f32;
            let t = phase * 2.0 * PI;

            // Table 0: Breathy sine
            let breath = noise_buffer[i] * 0.1;
            self.tables[3][0][i] = t.sin() * 0.8 + breath;

            // Table 1: Airy
            let airy = noise_buffer[(i + 100) % TABLE_SIZE] * 0.2;
            self.tables[3][1][i] = (t + airy * 0.5).sin();

            // Table 2: Windy
            let wind = noise_buffer[(i + 200) % TABLE_SIZE] * 0.4;
            self.tables[3][2][i] = t.sin() * 0.5 + wind;

            // Table 3: Texture
            let mut tex = 0.0;
            for h in 1..=8 {
                let phase_noise = noise_buffer[(i * h) % TABLE_SIZE] * 0.1;
                tex += (t * h as f32 + phase_noise).sin() / h as f32;
            }
            self.tables[3][3][i] = tex * 0.6;

            // Table 4: Growl
            let growl = (t * 0.5).sin() * 0.3 + noise_buffer[(i + 300) % TABLE_SIZE] * 0.3;
            self.tables[3][4][i] = (t + growl).sin();

            // Table 5: Flutter
            let flutter = (i as f32 * 0.1).sin() * 0.3;
            self.tables[3][5][i] = t.sin() + flutter * noise_buffer[(i + 400) % TABLE_SIZE];

            // Table 6: Choir-like
            let mut choir = 0.0;
            for v in 0..5 {
                let detune = (v as f32 - 2.0) * 0.01;
                choir += (t * (1.0 + detune)).sin() * 0.2;
            }
            self.tables[3][6][i] = choir;

            // Table 7: Noise
            self.tables[3][7][i] = noise_buffer[(i + 500) % TABLE_SIZE] * 0.8;
        }
    }

    fn read_table(&self, bank: usize, position: f32, phase: f32) -> f32 {
        let bank = bank.min(NUM_BANKS - 1);
        let pos = position * (TABLES_PER_BANK - 1) as f32;
        let table1 = pos.floor() as usize;
        let table2 = (table1 + 1).min(TABLES_PER_BANK - 1);
        let table_frac = pos - pos.floor();

        let sample_pos = phase * TABLE_SIZE as f32;
        let idx1 = sample_pos.floor() as usize % TABLE_SIZE;
        let idx2 = (idx1 + 1) % TABLE_SIZE;
        let sample_frac = sample_pos - sample_pos.floor();

        // Bilinear interpolation
        let s1_1 = self.tables[bank][table1][idx1];
        let s1_2 = self.tables[bank][table1][idx2];
        let s2_1 = self.tables[bank][table2][idx1];
        let s2_2 = self.tables[bank][table2][idx2];

        let interp1 = s1_1 * (1.0 - sample_frac) + s1_2 * sample_frac;
        let interp2 = s2_1 * (1.0 - sample_frac) + s2_2 * sample_frac;

        interp1 * (1.0 - table_frac) + interp2 * table_frac
    }

    pub fn process(&mut self, params: WavetableParams, inputs: WavetableInputs) -> f32 {
        // Sync reset
        if inputs.sync > 0.5 && self.last_gate <= 0.5 {
            self.phase = 0.0;
            for i in 0..7 {
                self.unison_phases[i] = 0.0;
            }
        }
        self.last_gate = inputs.sync;

        // Envelope
        let gate_high = inputs.gate > 0.5;
        if gate_high {
            let attack_coef = (-1.0 / (params.attack.max(0.001) * self.sample_rate)).exp();
            self.envelope = self.envelope * attack_coef + (1.0 - attack_coef);
        } else {
            let release_coef = (-1.0 / (params.release.max(0.001) * self.sample_rate)).exp();
            self.envelope *= release_coef;
        }
        self.gate_was_high = gate_high;

        // Frequency with CV
        let freq = params.frequency * (2.0_f32).powf(inputs.pitch_cv);
        let phase_inc = freq / self.sample_rate;

        // Position with CV and auto-morph
        let position = (params.position + inputs.position_cv * 0.5).clamp(0.0, 1.0);

        let bank = (params.bank as usize).min(NUM_BANKS - 1);
        let num_unison = (params.unison as usize).clamp(1, 7);

        let mut output = 0.0;

        // Process unison voices
        for v in 0..num_unison {
            let detune_semitones = self.unison_detunes[v] * params.detune / 100.0;
            let voice_freq = freq * (2.0_f32).powf(detune_semitones / 12.0);
            let voice_phase_inc = voice_freq / self.sample_rate;

            // Update phase
            self.unison_phases[v] += voice_phase_inc;
            if self.unison_phases[v] >= 1.0 {
                self.unison_phases[v] -= 1.0;
            }

            let voice_out = self.read_table(bank, position, self.unison_phases[v]);

            // Apply spread (pan would be stereo, here we just vary amplitude slightly)
            let spread_factor = 1.0 - params.spread * 0.2 * (v as f32 / num_unison as f32 - 0.5).abs();
            output += voice_out * spread_factor;
        }

        output /= (num_unison as f32).sqrt();

        // Sub oscillator (one octave down)
        self.phase += phase_inc * 0.5;
        if self.phase >= 1.0 {
            self.phase -= 1.0;
        }
        let sub = (self.phase * 2.0 * PI).sin() * params.sub_mix;
        output += sub;

        // Apply envelope
        output *= self.envelope;

        // Soft limit
        self.prev_output = (output * 0.8).tanh();
        self.prev_output
    }

    pub fn reset(&mut self) {
        self.phase = 0.0;
        self.unison_phases = [0.0; 7];
        self.envelope = 0.0;
        self.gate_was_high = false;
        self.last_gate = 0.0;
        self.prev_output = 0.0;
    }
}
