//! Pipe Organ / Hammond B3 synthesizer module.
//!
//! Realistic organ emulation using additive synthesis with:
//! - 8 drawbars for different footages (16' to 1')
//! - 3 voicing types (Diapason, Flute, String)
//! - Hammond percussion (2nd/3rd harmonic, fast/slow decay)
//! - Chiff / key click (initial transient)
//! - Chorus/Vibrato scanner (V1-V3, C1-C3)
//! - Tremulant (wind supply modulation)
//! - Wind instability (natural fluctuation)

use crate::common::{input_at, Sample};

// Scanner vibrato constants (Hammond-style)
const SCANNER_RATE: f32 = 7.0; // Hz, fixed scanner speed
const SCANNER_BUF_MS: f32 = 3.0; // Max delay in ms

/// Number of drawbars (organ stops)
pub const ORGAN_DRAWBARS: usize = 8;

/// Drawbar footage multipliers relative to 8' (unison)
/// 16' = 0.5x, 8' = 1x, 4' = 2x, 2⅔' = 3x, 2' = 4x, 1⅗' = 5x, 1⅓' = 6x, 1' = 8x
const DRAWBAR_RATIOS: [f32; ORGAN_DRAWBARS] = [0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0];

/// Drawbar names for UI
pub const DRAWBAR_NAMES: [&str; ORGAN_DRAWBARS] = [
    "16'", "8'", "4'", "2⅔'", "2'", "1⅗'", "1⅓'", "1'"
];

/// Voicing types affect harmonic content
#[derive(Clone, Copy, Default)]
pub enum OrganVoicing {
    #[default]
    Diapason = 0,  // Full, balanced - the classic organ sound
    Flute = 1,     // Fundamental-heavy, mellow
    String = 2,    // Upper harmonics emphasized, bright
}

impl From<u8> for OrganVoicing {
    fn from(v: u8) -> Self {
        match v {
            0 => OrganVoicing::Diapason,
            1 => OrganVoicing::Flute,
            2 => OrganVoicing::String,
            _ => OrganVoicing::Diapason,
        }
    }
}

/// Pipe Organ synthesizer.
///
/// Features:
/// - 8 drawbar stops controlling harmonic mix
/// - 3 voicing types with different timbral characteristics
/// - Chiff (initial wind noise) for authentic attack
/// - Tremulant for gentle amplitude/pitch modulation
/// - Wind noise for natural instability
/// - Built-in brightness control
///
/// # Acoustics
///
/// Real pipe organs produce sound when pressurized air passes over
/// the lip (labium) of a pipe, creating oscillations. The "chiff"
/// is the initial noise burst as air first hits the lip before
/// the pipe "speaks" with a stable tone.
pub struct PipeOrgan {
    sample_rate: f32,
    inv_sample_rate: f32,

    // Phase accumulators for each drawbar
    phases: [f32; ORGAN_DRAWBARS],

    // Chiff state
    chiff_phase: f32,
    chiff_envelope: f32,
    noise_state: u32,

    // Hammond percussion
    perc_envelope: f32,
    perc_last_gate: f32,

    // Chorus/Vibrato scanner
    scanner_phase: f32,
    scanner_buf: Vec<f32>,
    scanner_write_idx: usize,

    // Tremulant LFO
    tremulant_phase: f32,

    // Wind instability LFO (slower, irregular)
    wind_phase: f32,
    wind_phase2: f32,

    // Envelope for smooth attack
    envelope: f32,
    last_gate: f32,

    // Low-pass filter state for brightness
    lp_state: f32,

    // Smoothed parameters
    smooth_freq: f32,
}

/// Parameters for pipe organ processing.
pub struct PipeOrganParams<'a> {
    /// Base frequency in Hz (typically from CV)
    pub frequency: &'a [Sample],

    /// Drawbar levels (0.0 to 1.0 each)
    pub drawbar_16: &'a [Sample],   // 16' - Sub bass
    pub drawbar_8: &'a [Sample],    // 8' - Unison (fundamental)
    pub drawbar_4: &'a [Sample],    // 4' - Octave
    pub drawbar_223: &'a [Sample],  // 2⅔' - Twelfth (quint)
    pub drawbar_2: &'a [Sample],    // 2' - Fifteenth
    pub drawbar_135: &'a [Sample],  // 1⅗' - Seventeenth (tierce)
    pub drawbar_113: &'a [Sample],  // 1⅓' - Nineteenth
    pub drawbar_1: &'a [Sample],    // 1' - Twenty-second

    /// Voicing type: 0=Diapason, 1=Flute, 2=String
    pub voicing: &'a [Sample],

    /// Chiff amount (0.0 to 1.0)
    pub chiff: &'a [Sample],

    /// Hammond percussion on/off (0 or 1)
    pub percussion: &'a [Sample],

    /// Percussion harmonic: 0=2nd (4'), 1=3rd (2⅔')
    pub perc_harmonic: &'a [Sample],

    /// Percussion decay: 0=fast (~200ms), 1=slow (~500ms)
    pub perc_decay: &'a [Sample],

    /// Percussion volume (0.0 to 1.0)
    pub perc_volume: &'a [Sample],

    /// Chorus/Vibrato scanner: 0=off, 1=V1, 2=V2, 3=V3, 4=C1, 5=C2, 6=C3
    pub chorus_vibrato: &'a [Sample],

    /// Tremulant depth (0.0 to 1.0)
    pub tremulant: &'a [Sample],

    /// Tremulant rate in Hz (typically 5-7 Hz)
    pub trem_rate: &'a [Sample],

    /// Wind instability amount (0.0 to 1.0)
    pub wind: &'a [Sample],

    /// Brightness (0.0 to 1.0, controls low-pass filter)
    pub brightness: &'a [Sample],
}

/// Input signals for pipe organ.
pub struct PipeOrganInputs<'a> {
    /// Pitch CV (1V/octave)
    pub pitch: Option<&'a [Sample]>,
    /// Gate input
    pub gate: Option<&'a [Sample]>,
}

impl PipeOrgan {
    /// Create a new pipe organ at the given sample rate.
    pub fn new(sample_rate: f32) -> Self {
        let sr = sample_rate.max(1.0);
        let scanner_buf_size = ((SCANNER_BUF_MS * sr / 1000.0) as usize + 2).max(4);
        Self {
            sample_rate: sr,
            inv_sample_rate: 1.0 / sr,
            phases: [0.0; ORGAN_DRAWBARS],
            chiff_phase: 0.0,
            chiff_envelope: 0.0,
            noise_state: 0x12345678,
            perc_envelope: 0.0,
            perc_last_gate: 0.0,
            scanner_phase: 0.0,
            scanner_buf: vec![0.0; scanner_buf_size],
            scanner_write_idx: 0,
            tremulant_phase: 0.0,
            wind_phase: 0.0,
            wind_phase2: 0.0,
            envelope: 0.0,
            last_gate: 0.0,
            lp_state: 0.0,
            smooth_freq: 220.0,
        }
    }

    /// Update sample rate.
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        let sr = sample_rate.max(1.0);
        if (sr - self.sample_rate).abs() > 1.0 {
            self.sample_rate = sr;
            self.inv_sample_rate = 1.0 / sr;
            let scanner_buf_size = ((SCANNER_BUF_MS * sr / 1000.0) as usize + 2).max(4);
            self.scanner_buf = vec![0.0; scanner_buf_size];
            self.scanner_write_idx = 0;
        }
    }

    /// Interpolated read from scanner delay buffer.
    fn scanner_read(&self, delay_samples: f32) -> f32 {
        let size = self.scanner_buf.len() as i32;
        let read_pos = self.scanner_write_idx as f32 - delay_samples;
        let base = read_pos.floor();
        let mut ia = base as i32 % size;
        if ia < 0 { ia += size; }
        let ib = (ia + 1) % size;
        let frac = read_pos - base;
        self.scanner_buf[ia as usize] + (self.scanner_buf[ib as usize] - self.scanner_buf[ia as usize]) * frac
    }

    /// Generate white noise using xorshift.
    #[inline]
    fn noise(&mut self) -> f32 {
        self.noise_state ^= self.noise_state << 13;
        self.noise_state ^= self.noise_state >> 17;
        self.noise_state ^= self.noise_state << 5;
        (self.noise_state as f32 / u32::MAX as f32) * 2.0 - 1.0
    }

    /// Generate band-limited noise for chiff (filtered white noise).
    #[inline]
    fn chiff_noise(&mut self, freq: f32) -> f32 {
        // Use the pipe frequency to modulate the chiff noise
        // Higher pipes have brighter, shorter chiff
        let raw_noise = self.noise();

        // Simple resonant filter around the pipe frequency
        let cutoff = (freq * 2.0).min(self.sample_rate * 0.4);
        let rc = 1.0 / (2.0 * std::f32::consts::PI * cutoff);
        let alpha = self.inv_sample_rate / (rc + self.inv_sample_rate);

        self.chiff_phase += alpha * (raw_noise - self.chiff_phase);
        self.chiff_phase
    }

    /// Get voicing harmonic weights.
    /// Returns amplitude multipliers for each harmonic based on voicing type.
    #[inline]
    fn voicing_weights(&self, voicing: OrganVoicing) -> [f32; ORGAN_DRAWBARS] {
        match voicing {
            OrganVoicing::Diapason => {
                // Classic organ: balanced harmonics with gradual rolloff
                [1.0, 1.0, 0.85, 0.7, 0.6, 0.5, 0.4, 0.35]
            }
            OrganVoicing::Flute => {
                // Flute pipes: fundamental dominant, quick rolloff
                [1.0, 1.0, 0.5, 0.25, 0.15, 0.1, 0.05, 0.03]
            }
            OrganVoicing::String => {
                // String pipes: emphasized upper harmonics
                [0.7, 1.0, 1.0, 0.9, 0.85, 0.75, 0.65, 0.5]
            }
        }
    }

    /// Process a block of audio.
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: PipeOrganInputs<'_>,
        params: PipeOrganParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        let two_pi = std::f32::consts::TAU;

        for (i, out) in output.iter_mut().enumerate() {
            // Get parameters for this sample
            let base_freq = params.frequency.get(i).copied()
                .unwrap_or_else(|| params.frequency.last().copied().unwrap_or(220.0));

            // Apply pitch CV (1V/octave)
            let pitch_cv = input_at(inputs.pitch, i);
            let freq = if pitch_cv != 0.0 {
                base_freq * (2.0_f32).powf(pitch_cv)
            } else {
                base_freq
            };

            // Smooth frequency changes to avoid clicks
            self.smooth_freq += 0.01 * (freq - self.smooth_freq);
            let freq = self.smooth_freq;

            // Gate input
            let gate = input_at(inputs.gate, i);
            let gate_on = gate > 0.5;

            // Detect gate trigger for chiff
            let gate_trigger = gate > 0.5 && self.last_gate <= 0.5;
            self.last_gate = gate;

            // Get drawbar levels
            let drawbars = [
                params.drawbar_16.get(i).copied().unwrap_or_else(|| params.drawbar_16.last().copied().unwrap_or(0.5)),
                params.drawbar_8.get(i).copied().unwrap_or_else(|| params.drawbar_8.last().copied().unwrap_or(0.8)),
                params.drawbar_4.get(i).copied().unwrap_or_else(|| params.drawbar_4.last().copied().unwrap_or(0.6)),
                params.drawbar_223.get(i).copied().unwrap_or_else(|| params.drawbar_223.last().copied().unwrap_or(0.0)),
                params.drawbar_2.get(i).copied().unwrap_or_else(|| params.drawbar_2.last().copied().unwrap_or(0.4)),
                params.drawbar_135.get(i).copied().unwrap_or_else(|| params.drawbar_135.last().copied().unwrap_or(0.0)),
                params.drawbar_113.get(i).copied().unwrap_or_else(|| params.drawbar_113.last().copied().unwrap_or(0.0)),
                params.drawbar_1.get(i).copied().unwrap_or_else(|| params.drawbar_1.last().copied().unwrap_or(0.2)),
            ];

            // Get other parameters
            let voicing_val = params.voicing.get(i).copied().unwrap_or(0.0) as u8;
            let voicing = OrganVoicing::from(voicing_val);
            let voicing_weights = self.voicing_weights(voicing);

            let chiff_amount = params.chiff.get(i).copied()
                .unwrap_or_else(|| params.chiff.last().copied().unwrap_or(0.3));
            let percussion_on = params.percussion.get(i).copied().unwrap_or(0.0) >= 0.5;
            let perc_harmonic = params.perc_harmonic.get(i).copied().unwrap_or(0.0);
            let perc_decay_mode = params.perc_decay.get(i).copied().unwrap_or(0.0);
            let perc_volume = params.perc_volume.get(i).copied().unwrap_or(0.8);
            let cv_mode = params.chorus_vibrato.get(i).copied().unwrap_or(0.0) as u8;
            let tremulant_depth = params.tremulant.get(i).copied()
                .unwrap_or_else(|| params.tremulant.last().copied().unwrap_or(0.0));
            let trem_rate = params.trem_rate.get(i).copied()
                .unwrap_or_else(|| params.trem_rate.last().copied().unwrap_or(6.0));
            let wind_amount = params.wind.get(i).copied()
                .unwrap_or_else(|| params.wind.last().copied().unwrap_or(0.1));
            let brightness = params.brightness.get(i).copied()
                .unwrap_or_else(|| params.brightness.last().copied().unwrap_or(0.7));

            // === Envelope ===
            // Organ has instant attack but we add tiny smoothing to avoid clicks
            let env_target = if gate_on { 1.0 } else { 0.0 };
            let env_speed = if gate_on { 0.005 } else { 0.001 }; // Fast attack, medium release
            self.envelope += env_speed * (env_target - self.envelope);

            // === Chiff / Key Click (improved Hammond-style) ===
            if gate_trigger {
                self.chiff_envelope = 1.0;
            }
            // Key click: fast decay ~8ms for tonal click + 40ms noise tail
            let click_decay = (-self.inv_sample_rate / 0.008).exp();
            let noise_decay = (-self.inv_sample_rate / 0.04).exp();
            self.chiff_envelope *= noise_decay;
            // Tonal click component: broadband burst at contact
            let tonal_click = if self.chiff_envelope > 0.5 {
                (self.phases[1] * two_pi * 3.0).sin() * 0.4 // Based on 8' phase
            } else {
                0.0
            };
            let noise_click = self.chiff_noise(freq) * self.chiff_envelope;
            let chiff_signal = (tonal_click + noise_click) * chiff_amount * 0.5;

            // === Hammond Percussion ===
            // Trigger on gate rising edge
            let perc_trigger = gate > 0.5 && self.perc_last_gate <= 0.5;
            self.perc_last_gate = gate;
            if perc_trigger {
                self.perc_envelope = 1.0;
            }
            // Decay: fast ~200ms, slow ~500ms
            let perc_decay_time = if perc_decay_mode >= 0.5 { 0.5 } else { 0.2 };
            let perc_coeff = (-self.inv_sample_rate * 6.9 / perc_decay_time).exp();
            self.perc_envelope *= perc_coeff;

            // === Tremulant LFO ===
            self.tremulant_phase += trem_rate * self.inv_sample_rate;
            if self.tremulant_phase >= 1.0 {
                self.tremulant_phase -= 1.0;
            }
            let tremulant_lfo = (self.tremulant_phase * two_pi).sin();
            let tremulant_mod = 1.0 + tremulant_lfo * tremulant_depth * 0.1;

            // === Wind instability ===
            // Two slow LFOs at irrational ratio for organic movement
            self.wind_phase += 0.13 * self.inv_sample_rate;
            self.wind_phase2 += 0.17 * self.inv_sample_rate;
            if self.wind_phase >= 1.0 { self.wind_phase -= 1.0; }
            if self.wind_phase2 >= 1.0 { self.wind_phase2 -= 1.0; }

            let wind_mod = 1.0 +
                ((self.wind_phase * two_pi).sin() * 0.3 +
                 (self.wind_phase2 * two_pi).sin() * 0.2) * wind_amount * 0.02;

            // === Additive synthesis with drawbars ===
            let mut sum = 0.0;
            let mut total_weight = 0.0;

            for (j, &ratio) in DRAWBAR_RATIOS.iter().enumerate() {
                let drawbar_level = drawbars[j];
                if drawbar_level < 0.001 {
                    continue;
                }

                let harmonic_freq = freq * ratio * wind_mod;
                let phase_inc = harmonic_freq * self.inv_sample_rate;

                self.phases[j] += phase_inc;
                if self.phases[j] >= 1.0 {
                    self.phases[j] -= 1.0;
                }

                // Generate sine wave with slight harmonic coloring based on voicing
                let phase_angle = self.phases[j] * two_pi;
                let mut wave = phase_angle.sin();

                // Add slight 2nd harmonic for warmth (more for Diapason/String)
                let harmonic_amount = match voicing {
                    OrganVoicing::Diapason => 0.08,
                    OrganVoicing::Flute => 0.02,
                    OrganVoicing::String => 0.12,
                };
                wave += (phase_angle * 2.0).sin() * harmonic_amount;
                wave += (phase_angle * 3.0).sin() * harmonic_amount * 0.5;

                let weight = drawbar_level * voicing_weights[j];
                sum += wave * weight;
                total_weight += weight;
            }

            // Normalize to prevent clipping when many drawbars are active
            if total_weight > 0.0 {
                sum /= total_weight.max(1.0);
            }

            // === Add Hammond Percussion ===
            if percussion_on && self.perc_envelope > 0.001 {
                // 2nd harmonic = 4' (index 2, ratio 2.0), 3rd harmonic = 2⅔' (index 3, ratio 3.0)
                // 2nd harmonic = 4' (index 2, ratio 2.0), 3rd harmonic = 2⅔' (index 3, ratio 3.0)
                let perc_phase_idx = if perc_harmonic >= 0.5 { 3 } else { 2 };
                let perc_signal = (self.phases[perc_phase_idx] * two_pi).sin();
                sum += perc_signal * self.perc_envelope * perc_volume * 0.6;
            }

            // Apply tremulant modulation
            sum *= tremulant_mod;

            // Add chiff / key click
            sum += chiff_signal;

            // === Brightness filter (gentle low-pass) ===
            // Map brightness 0-1 to cutoff frequency
            let cutoff = 200.0 + brightness * brightness * 8000.0;
            let rc = 1.0 / (two_pi * cutoff);
            let alpha = self.inv_sample_rate / (rc + self.inv_sample_rate);
            self.lp_state += alpha * (sum - self.lp_state);

            // Mix filtered and unfiltered based on brightness
            // At high brightness, less filtering
            let filtered_mix = 1.0 - brightness * 0.5;
            sum = sum * (1.0 - filtered_mix) + self.lp_state * filtered_mix;

            // === Chorus/Vibrato Scanner ===
            // 0=off, 1=V1, 2=V2, 3=V3, 4=C1, 5=C2, 6=C3
            if cv_mode > 0 {
                let buf_size = self.scanner_buf.len();
                self.scanner_buf[self.scanner_write_idx] = sum;

                // Scanner LFO
                self.scanner_phase += SCANNER_RATE * self.inv_sample_rate;
                if self.scanner_phase >= 1.0 { self.scanner_phase -= 1.0; }
                let scanner_lfo = (self.scanner_phase * two_pi).sin();

                // Depth in ms: V1/C1=0.3, V2/C2=0.7, V3/C3=1.2
                let depth_ms = match cv_mode {
                    1 | 4 => 0.3,
                    2 | 5 => 0.7,
                    _ => 1.2, // 3 | 6
                };
                let center_delay = depth_ms * self.sample_rate / 1000.0;
                let mod_range = center_delay * 0.5;
                let delay_samples = center_delay + scanner_lfo * mod_range;
                let wet = self.scanner_read(delay_samples.max(0.5));

                // V modes = wet only, C modes = 50/50 dry+wet
                sum = if cv_mode <= 3 {
                    wet // Vibrato: wet only
                } else {
                    sum * 0.5 + wet * 0.5 // Chorus: mix
                };

                self.scanner_write_idx = (self.scanner_write_idx + 1) % buf_size;
            }

            // Apply envelope
            sum *= self.envelope;

            *out = sum * 0.5; // Output level
        }
    }

    /// Reset internal state.
    pub fn reset(&mut self) {
        self.phases = [0.0; ORGAN_DRAWBARS];
        self.chiff_phase = 0.0;
        self.chiff_envelope = 0.0;
        self.perc_envelope = 0.0;
        self.perc_last_gate = 0.0;
        self.scanner_phase = 0.0;
        for s in self.scanner_buf.iter_mut() { *s = 0.0; }
        self.scanner_write_idx = 0;
        self.tremulant_phase = 0.0;
        self.wind_phase = 0.0;
        self.wind_phase2 = 0.0;
        self.envelope = 0.0;
        self.last_gate = 0.0;
        self.lp_state = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pipe_organ_creation() {
        let organ = PipeOrgan::new(44100.0);
        assert_eq!(organ.sample_rate, 44100.0);
    }

    #[test]
    fn test_drawbar_ratios() {
        // 8' should be unison (1.0)
        assert_eq!(DRAWBAR_RATIOS[1], 1.0);
        // 16' should be sub (0.5)
        assert_eq!(DRAWBAR_RATIOS[0], 0.5);
        // 4' should be octave (2.0)
        assert_eq!(DRAWBAR_RATIOS[2], 2.0);
    }

    #[test]
    fn test_voicing_conversion() {
        assert!(matches!(OrganVoicing::from(0), OrganVoicing::Diapason));
        assert!(matches!(OrganVoicing::from(1), OrganVoicing::Flute));
        assert!(matches!(OrganVoicing::from(2), OrganVoicing::String));
        assert!(matches!(OrganVoicing::from(99), OrganVoicing::Diapason));
    }
}
