//! Spectral Swarm - Additive drone synthesizer with evolving harmonics.
//!
//! Creates thick, organic textures by layering multiple partials that behave
//! like a living swarm. Each partial drifts in pitch, fades in/out, and moves
//! in the stereo field. Inspired by throat singing, Ligeti micropolyphony,
//! and Shepard tones.

use crate::common::{sample_at, input_at, Sample};
use std::f32::consts::PI;

/// Maximum number of partials
const MAX_PARTIALS: usize = 32;

/// Number of chorus voices per partial
const CHORUS_VOICES: usize = 3;

/// Spectral Swarm synthesizer
pub struct SpectralSwarm {
    sample_rate: f32,
    /// Phase accumulator for each partial
    phases: [f32; MAX_PARTIALS],
    /// Chorus phases (additional detuned copies)
    chorus_phases: [[f32; CHORUS_VOICES]; MAX_PARTIALS],
    /// Current detune offset for each partial (drifts over time)
    detune_current: [f32; MAX_PARTIALS],
    /// Target detune for smooth interpolation
    detune_target: [f32; MAX_PARTIALS],
    /// Current amplitude for each partial (evolves over time)
    amp_current: [f32; MAX_PARTIALS],
    /// Target amplitude for evolution
    amp_target: [f32; MAX_PARTIALS],
    /// Current stereo position for each partial
    pan_current: [f32; MAX_PARTIALS],
    /// Target stereo position
    pan_target: [f32; MAX_PARTIALS],
    /// Shimmer phase (for Shepard-like spectral movement)
    shimmer_phases: [f32; MAX_PARTIALS],
    /// Random state for organic variations
    random_state: u32,
    /// Time accumulator for evolution
    evolution_timer: f32,
    /// Last gate state for envelope and edge detection
    last_gate: f32,
    /// Last sync state for edge detection
    last_sync: f32,
    /// Per-band envelope amplitudes [low, mid, high]
    band_env: [f32; 3],
    /// Formant filter states (2-pole bandpass per formant)
    formant_state: [[f32; 2]; 5],
    /// Evolution frozen flag
    frozen: bool,
}

/// Parameters for Spectral Swarm processing
pub struct SpectralSwarmParams<'a> {
    /// Number of partials (4-32)
    pub partials: &'a [Sample],
    /// Micro-detuning spread in cents (0-100)
    pub detune: &'a [Sample],
    /// Drift speed - how fast detuning changes (0-1)
    pub drift: &'a [Sample],
    /// Density - percentage of partials active (0-1)
    pub density: &'a [Sample],
    /// Evolution speed in seconds (0.1-10)
    pub evolution: &'a [Sample],
    /// Inharmonicity (-1 to +1, 0=pure harmonic)
    pub inharmonic: &'a [Sample],
    /// Spectral tilt in dB/octave (-12 to +12)
    pub tilt: &'a [Sample],
    /// Stereo spread (0-1)
    pub spread: &'a [Sample],
    /// Shimmer - Shepard-like spectral movement (-1 to +1)
    pub shimmer: &'a [Sample],
    /// Base frequency
    pub frequency: &'a [Sample],
    /// Attack time (global)
    pub attack: &'a [Sample],
    /// Release time (global)
    pub release: &'a [Sample],
    // === New parameters ===
    /// Waveform: 0=sine, 1=triangle, 2=saw, 3=square
    pub waveform: &'a [Sample],
    /// Odd/even harmonic balance: -1=odd only, 0=all, +1=even only
    pub odd_even: &'a [Sample],
    /// Fundamental mix: 0=harmonics only, 1=fundamental only
    pub fundamental_mix: &'a [Sample],
    /// Formant frequency (200-4000 Hz, 0=off)
    pub formant_freq: &'a [Sample],
    /// Formant resonance/Q (0-1)
    pub formant_q: &'a [Sample],
    /// Spectral freeze (>0.5 = frozen)
    pub freeze: &'a [Sample],
    /// Chorus amount (0-1)
    pub chorus: &'a [Sample],
    /// Low band attack multiplier (0.1-10)
    pub attack_low: &'a [Sample],
    /// High band attack multiplier (0.1-10)
    pub attack_high: &'a [Sample],
    /// Low band release multiplier (0.1-10)
    pub release_low: &'a [Sample],
    /// High band release multiplier (0.1-10)
    pub release_high: &'a [Sample],
}

/// Input signals for Spectral Swarm
pub struct SpectralSwarmInputs<'a> {
    /// Pitch CV (1V/oct)
    pub pitch: Option<&'a [Sample]>,
    /// Gate input
    pub gate: Option<&'a [Sample]>,
    /// Sync/reset trigger
    pub sync: Option<&'a [Sample]>,
}

impl SpectralSwarm {
    /// Create a new Spectral Swarm at the given sample rate
    pub fn new(sample_rate: f32) -> Self {
        let mut phases = [0.0; MAX_PARTIALS];
        let mut chorus_phases = [[0.0; CHORUS_VOICES]; MAX_PARTIALS];
        let mut detune_current = [0.0; MAX_PARTIALS];
        let mut detune_target = [0.0; MAX_PARTIALS];
        let mut amp_current = [0.0; MAX_PARTIALS];
        let mut amp_target = [0.0; MAX_PARTIALS];
        let mut pan_current = [0.0; MAX_PARTIALS];
        let mut pan_target = [0.0; MAX_PARTIALS];
        let mut shimmer_phases = [0.0; MAX_PARTIALS];

        // Initialize with golden ratio based spread for organic feel
        for i in 0..MAX_PARTIALS {
            phases[i] = (i as f32 * 0.618033988749895) % 1.0;
            // Initialize chorus phases with slight offsets
            for v in 0..CHORUS_VOICES {
                chorus_phases[i][v] = (phases[i] + v as f32 * 0.33) % 1.0;
            }
            detune_current[i] = ((i as f32 * 0.7548776662466927) % 1.0 - 0.5) * 2.0;
            detune_target[i] = detune_current[i];
            // Start with fundamental loud, upper partials quieter
            amp_current[i] = 1.0 / (1.0 + i as f32 * 0.3);
            amp_target[i] = amp_current[i];
            // Spread partials across stereo field
            pan_current[i] = ((i as f32 * 0.381966) % 1.0 - 0.5) * 2.0;
            pan_target[i] = pan_current[i];
            // Stagger shimmer phases
            shimmer_phases[i] = (i as f32 * 0.2618) % 1.0;
        }

        Self {
            sample_rate: sample_rate.max(1.0),
            phases,
            chorus_phases,
            detune_current,
            detune_target,
            amp_current,
            amp_target,
            pan_current,
            pan_target,
            shimmer_phases,
            random_state: 42,
            evolution_timer: 0.0,
            last_gate: 0.0,
            last_sync: 0.0,
            band_env: [0.0; 3],
            formant_state: [[0.0; 2]; 5],
            frozen: false,
        }
    }

    /// Simple LCG random
    fn next_random(&mut self) -> f32 {
        self.random_state = self.random_state.wrapping_mul(1103515245).wrapping_add(12345);
        ((self.random_state >> 16) & 0x7FFF) as f32 / 32767.0
    }

    /// Update sample rate
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate.max(1.0);
    }

    /// Reset all phases and states to initial values
    pub fn reset(&mut self) {
        for i in 0..MAX_PARTIALS {
            // Reset phases with golden ratio spread
            self.phases[i] = (i as f32 * 0.618033988749895) % 1.0;
            // Reset chorus phases
            for v in 0..CHORUS_VOICES {
                self.chorus_phases[i][v] = (self.phases[i] + v as f32 * 0.33) % 1.0;
            }
            // Reset detune
            self.detune_current[i] = ((i as f32 * 0.7548776662466927) % 1.0 - 0.5) * 2.0;
            self.detune_target[i] = self.detune_current[i];
            // Reset amplitude
            self.amp_current[i] = 1.0 / (1.0 + i as f32 * 0.3);
            self.amp_target[i] = self.amp_current[i];
            // Reset pan
            self.pan_current[i] = ((i as f32 * 0.381966) % 1.0 - 0.5) * 2.0;
            self.pan_target[i] = self.pan_current[i];
            // Reset shimmer
            self.shimmer_phases[i] = (i as f32 * 0.2618) % 1.0;
        }
        self.evolution_timer = 0.0;
        self.random_state = 42; // Reset to deterministic seed
        self.band_env = [0.0; 3];
        self.formant_state = [[0.0; 2]; 5];
        self.frozen = false;
    }

    /// Generate waveform sample based on type
    #[inline]
    fn generate_wave(phase: f32, waveform: i32) -> f32 {
        match waveform {
            0 => (phase * 2.0 * PI).sin(), // Sine
            1 => {
                // Triangle
                let p = phase * 4.0;
                if p < 1.0 {
                    p
                } else if p < 3.0 {
                    2.0 - p
                } else {
                    p - 4.0
                }
            }
            2 => 2.0 * phase - 1.0, // Sawtooth
            3 => {
                // Square
                if phase < 0.5 {
                    1.0
                } else {
                    -1.0
                }
            }
            _ => (phase * 2.0 * PI).sin(), // Default to sine
        }
    }

    /// Calculate harmonic frequency with inharmonicity
    #[inline]
    fn harmonic_freq(fundamental: f32, partial_num: usize, inharmonic: f32) -> f32 {
        let n = (partial_num + 1) as f32;
        if inharmonic.abs() < 0.001 {
            // Pure harmonic series
            fundamental * n
        } else if inharmonic > 0.0 {
            // Stretched (piano-like): f_n = f_1 * n * sqrt(1 + B * n^2)
            let b = inharmonic * 0.0001; // Small stretch factor
            fundamental * n * (1.0 + b * n * n).sqrt()
        } else {
            // Compressed (bell-like): f_n = f_1 * n^(1 + inharmonic*0.3)
            let exp = 1.0 + inharmonic * 0.3;
            fundamental * n.powf(exp)
        }
    }

    /// Apply spectral tilt (dB per octave)
    #[inline]
    fn apply_tilt(amp: f32, partial_num: usize, tilt_db: f32) -> f32 {
        if tilt_db.abs() < 0.01 {
            return amp;
        }
        // Each octave up (doubling of partial number) changes by tilt_db
        let octaves = (partial_num as f32 + 1.0).log2();
        let db_change = octaves * tilt_db;
        let gain = 10.0_f32.powf(db_change / 20.0);
        amp * gain
    }

    /// Calculate odd/even harmonic gain
    #[inline]
    fn odd_even_gain(partial_num: usize, odd_even: f32) -> f32 {
        let is_odd = (partial_num + 1) % 2 == 1;
        if odd_even.abs() < 0.01 {
            1.0
        } else if odd_even > 0.0 {
            // Favor even harmonics
            if is_odd {
                1.0 - odd_even
            } else {
                1.0
            }
        } else {
            // Favor odd harmonics
            if is_odd {
                1.0
            } else {
                1.0 + odd_even // odd_even is negative
            }
        }
    }

    /// Get band index for a partial (0=low, 1=mid, 2=high)
    #[inline]
    fn get_band(partial_num: usize, num_partials: usize) -> usize {
        let third = num_partials / 3;
        if partial_num < third {
            0 // Low
        } else if partial_num < third * 2 {
            1 // Mid
        } else {
            2 // High
        }
    }

    /// Simple 2-pole bandpass filter for formants
    #[inline]
    fn bandpass_filter(
        input: f32,
        state: &mut [f32; 2],
        freq: f32,
        q: f32,
        sample_rate: f32,
    ) -> f32 {
        let omega = 2.0 * PI * freq / sample_rate;
        let sin_omega = omega.sin();
        let cos_omega = omega.cos();
        let alpha = sin_omega / (2.0 * q.max(0.5));

        let b0 = alpha;
        let b1 = 0.0;
        let b2 = -alpha;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_omega;
        let a2 = 1.0 - alpha;

        // Normalize
        let b0 = b0 / a0;
        let b1 = b1 / a0;
        let b2 = b2 / a0;
        let a1 = a1 / a0;
        let a2 = a2 / a0;

        let output = b0 * input + state[0];
        state[0] = b1 * input - a1 * output + state[1];
        state[1] = b2 * input - a2 * output;

        output
    }

    /// Process a block of stereo audio
    pub fn process_block_stereo(
        &mut self,
        output_l: &mut [Sample],
        output_r: &mut [Sample],
        inputs: SpectralSwarmInputs<'_>,
        params: SpectralSwarmParams<'_>,
    ) {
        if output_l.is_empty() {
            return;
        }

        let inv_sr = 1.0 / self.sample_rate;

        for i in 0..output_l.len() {
            // Get parameters
            let num_partials = (sample_at(params.partials, i, 16.0) as usize).clamp(4, MAX_PARTIALS);
            let detune_amt = sample_at(params.detune, i, 10.0).clamp(0.0, 100.0);
            let drift_speed = sample_at(params.drift, i, 0.3).clamp(0.0, 1.0);
            let density = sample_at(params.density, i, 0.8).clamp(0.0, 1.0);
            let evolution_time = sample_at(params.evolution, i, 2.0).clamp(0.1, 10.0);
            let inharmonic = sample_at(params.inharmonic, i, 0.0).clamp(-1.0, 1.0);
            let tilt_db = sample_at(params.tilt, i, -3.0).clamp(-12.0, 12.0);
            let stereo_spread = sample_at(params.spread, i, 0.7).clamp(0.0, 1.0);
            let shimmer = sample_at(params.shimmer, i, 0.0).clamp(-1.0, 1.0);
            let base_freq = sample_at(params.frequency, i, 110.0).clamp(20.0, 2000.0);
            let attack = sample_at(params.attack, i, 0.5).clamp(0.001, 10.0);
            let release = sample_at(params.release, i, 1.0).clamp(0.001, 10.0);

            // New parameters
            let waveform = sample_at(params.waveform, i, 0.0) as i32;
            let odd_even = sample_at(params.odd_even, i, 0.0).clamp(-1.0, 1.0);
            let fundamental_mix = sample_at(params.fundamental_mix, i, 0.5).clamp(0.0, 1.0);
            let formant_freq = sample_at(params.formant_freq, i, 0.0).clamp(0.0, 4000.0);
            let formant_q = sample_at(params.formant_q, i, 0.5).clamp(0.1, 20.0);
            let freeze = sample_at(params.freeze, i, 0.0) > 0.5;
            let chorus_amt = sample_at(params.chorus, i, 0.0).clamp(0.0, 1.0);
            let attack_low = sample_at(params.attack_low, i, 1.0).clamp(0.1, 10.0);
            let attack_high = sample_at(params.attack_high, i, 1.0).clamp(0.1, 10.0);
            let release_low = sample_at(params.release_low, i, 1.0).clamp(0.1, 10.0);
            let release_high = sample_at(params.release_high, i, 1.0).clamp(0.1, 10.0);

            // Update frozen state
            self.frozen = freeze;

            // Pitch CV (1V/oct)
            let pitch_cv = input_at(inputs.pitch, i);
            let freq = base_freq * 2.0_f32.powf(pitch_cv);

            // Gate and envelope
            let gate = input_at(inputs.gate, i);
            let gate_on = gate > 0.5;
            let gate_rising = gate_on && self.last_gate <= 0.5;

            // Reset on note-on (rising edge of gate)
            if gate_rising {
                self.reset();
            }

            // Per-band envelopes with different rates
            let band_attack_mult = [attack_low, 1.0, attack_high];
            let band_release_mult = [release_low, 1.0, release_high];

            for band in 0..3 {
                if gate_on {
                    let band_attack = attack * band_attack_mult[band];
                    let attack_rate = inv_sr / band_attack;
                    self.band_env[band] = (self.band_env[band] + attack_rate).min(1.0);
                } else {
                    let band_release = release * band_release_mult[band];
                    let release_rate = inv_sr / band_release;
                    self.band_env[band] = (self.band_env[band] - release_rate).max(0.0);
                }
            }
            self.last_gate = gate;

            // Check for sync trigger (rising edge)
            let sync_val = input_at(inputs.sync, i);
            if sync_val > 0.5 && self.last_sync <= 0.5 {
                self.reset();
            }
            self.last_sync = sync_val;

            // Evolution: periodically update targets (only if not frozen)
            if !self.frozen {
                self.evolution_timer += inv_sr;
                if self.evolution_timer > evolution_time * 0.1 {
                    self.evolution_timer = 0.0;

                    // Pick new random targets for some partials
                    for p in 0..num_partials {
                        if self.next_random() < 0.3 {
                            // New detune target
                            self.detune_target[p] = (self.next_random() - 0.5) * 2.0;
                        }
                        if self.next_random() < 0.2 {
                            // New amplitude target (respect density)
                            let base_amp = 1.0 / (1.0 + p as f32 * 0.2);
                            if self.next_random() < density {
                                self.amp_target[p] = base_amp * (0.5 + self.next_random() * 0.5);
                            } else {
                                self.amp_target[p] = 0.0; // Fade out
                            }
                        }
                        if self.next_random() < 0.1 {
                            // New pan target
                            self.pan_target[p] = (self.next_random() - 0.5) * 2.0;
                        }
                    }
                }
            }

            // Interpolation rate based on drift speed (only if not frozen)
            let interp_rate = if self.frozen {
                0.0
            } else {
                0.0001 + drift_speed * 0.002
            };
            let amp_interp_rate = if self.frozen {
                0.0
            } else {
                0.00005 + drift_speed * 0.0005
            };
            let pan_interp_rate = if self.frozen {
                0.0
            } else {
                0.00002 + drift_speed * 0.0002
            };

            let mut sample_l = 0.0f32;
            let mut sample_r = 0.0f32;

            for p in 0..num_partials {
                // Smoothly interpolate toward targets
                self.detune_current[p] +=
                    (self.detune_target[p] - self.detune_current[p]) * interp_rate;
                self.amp_current[p] +=
                    (self.amp_target[p] - self.amp_current[p]) * amp_interp_rate;
                self.pan_current[p] +=
                    (self.pan_target[p] - self.pan_current[p]) * pan_interp_rate;

                // Skip if amplitude is negligible
                if self.amp_current[p] < 0.001 {
                    continue;
                }

                // Apply odd/even filter
                let oe_gain = Self::odd_even_gain(p, odd_even);
                if oe_gain < 0.01 {
                    continue;
                }

                // Calculate partial frequency with inharmonicity
                let partial_freq = Self::harmonic_freq(freq, p, inharmonic);

                // Apply micro-detuning
                let detune_cents = self.detune_current[p] * detune_amt;
                let detune_ratio = 2.0_f32.powf(detune_cents / 1200.0);
                let mut final_freq = partial_freq * detune_ratio;

                // Apply shimmer (Shepard-like movement)
                if shimmer.abs() > 0.001 && !self.frozen {
                    // Update shimmer phase
                    let shimmer_rate = shimmer * 0.1; // octaves per second
                    self.shimmer_phases[p] += shimmer_rate * inv_sr;
                    if self.shimmer_phases[p] >= 1.0 {
                        self.shimmer_phases[p] -= 1.0;
                    } else if self.shimmer_phases[p] < 0.0 {
                        self.shimmer_phases[p] += 1.0;
                    }

                    // Modulate frequency based on shimmer phase
                    let shimmer_mod = 2.0_f32.powf(self.shimmer_phases[p] - 0.5);
                    final_freq *= shimmer_mod;
                }

                // Clamp frequency to audible range
                final_freq = final_freq.clamp(20.0, 20000.0);

                // Update phase
                self.phases[p] += final_freq * inv_sr;
                if self.phases[p] >= 1.0 {
                    self.phases[p] -= self.phases[p].floor();
                }

                // Generate main waveform
                let mut wave = Self::generate_wave(self.phases[p], waveform);

                // Add chorus voices if enabled
                if chorus_amt > 0.01 {
                    let chorus_detune_cents = [7.0, -7.0, 12.0]; // Slight detuning
                    for v in 0..CHORUS_VOICES {
                        let chorus_ratio = 2.0_f32.powf(chorus_detune_cents[v] / 1200.0);
                        let chorus_freq = final_freq * chorus_ratio;
                        self.chorus_phases[p][v] += chorus_freq * inv_sr;
                        if self.chorus_phases[p][v] >= 1.0 {
                            self.chorus_phases[p][v] -= 1.0;
                        }
                        wave += Self::generate_wave(self.chorus_phases[p][v], waveform)
                            * chorus_amt
                            * 0.3;
                    }
                    // Normalize
                    wave /= 1.0 + chorus_amt * 0.9;
                }

                // Apply amplitude with tilt
                let mut amp = Self::apply_tilt(self.amp_current[p], p, tilt_db);

                // Apply odd/even gain
                amp *= oe_gain;

                // Apply fundamental mix
                if p == 0 {
                    // Fundamental - boost based on fundamental_mix
                    amp *= 0.5 + fundamental_mix * 0.5;
                } else {
                    // Harmonics - reduce based on fundamental_mix
                    amp *= 1.0 - fundamental_mix * 0.5;
                }

                // Apply shimmer amplitude envelope (Gaussian fade at extremes)
                let shimmer_amp = if shimmer.abs() > 0.001 {
                    let pos = self.shimmer_phases[p];
                    let x = pos - 0.5;
                    (-x * x * 8.0).exp() // Gaussian centered at 0.5
                } else {
                    1.0
                };

                // Get band envelope
                let band = Self::get_band(p, num_partials);
                let band_amp = self.band_env[band];

                let voiced_sample = wave * amp * shimmer_amp * band_amp;

                // Stereo panning
                let pan = self.pan_current[p] * stereo_spread;
                let pan_l = ((1.0 - pan) * 0.5).sqrt();
                let pan_r = ((1.0 + pan) * 0.5).sqrt();

                sample_l += voiced_sample * pan_l;
                sample_r += voiced_sample * pan_r;
            }

            // Normalize by number of active partials
            let norm = 1.0 / (num_partials as f32).sqrt();

            sample_l *= norm;
            sample_r *= norm;

            // Apply formant filter if enabled
            if formant_freq > 50.0 {
                // Main formant
                sample_l = Self::bandpass_filter(
                    sample_l,
                    &mut self.formant_state[0],
                    formant_freq,
                    formant_q,
                    self.sample_rate,
                );
                sample_r = Self::bandpass_filter(
                    sample_r,
                    &mut self.formant_state[1],
                    formant_freq,
                    formant_q,
                    self.sample_rate,
                );

                // Add second formant at ~1.5x frequency for more vocal character
                let formant2_freq = (formant_freq * 1.5).min(8000.0);
                let f2_l = Self::bandpass_filter(
                    sample_l,
                    &mut self.formant_state[2],
                    formant2_freq,
                    formant_q * 0.8,
                    self.sample_rate,
                );
                let f2_r = Self::bandpass_filter(
                    sample_r,
                    &mut self.formant_state[3],
                    formant2_freq,
                    formant_q * 0.8,
                    self.sample_rate,
                );

                sample_l = sample_l * 0.7 + f2_l * 0.3;
                sample_r = sample_r * 0.7 + f2_r * 0.3;
            }

            output_l[i] = sample_l;
            output_r[i] = sample_r;
        }
    }

    /// Process mono output
    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: SpectralSwarmInputs<'_>,
        params: SpectralSwarmParams<'_>,
    ) {
        if output.is_empty() {
            return;
        }

        let mut output_r = vec![0.0; output.len()];
        self.process_block_stereo(output, &mut output_r, inputs, params);

        // Mix to mono
        for i in 0..output.len() {
            output[i] = (output[i] + output_r[i]) * 0.5;
        }
    }
}
