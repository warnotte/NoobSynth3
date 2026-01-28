//! AY-3-8910 / YM2149 sound chip emulator.
//!
//! The AY-3-8910 is a 3-voice Programmable Sound Generator (PSG) used in:
//! - ZX Spectrum 128K
//! - Amstrad CPC
//! - MSX
//! - Atari ST (YM2149 variant)
//!
//! ## Features
//! - 3 square wave tone channels (12-bit frequency divider)
//! - 1 noise generator (5-bit period, 17-bit LFSR)
//! - Hardware envelope generator (16 shapes)
//! - Per-channel mixer (tone/noise enable)
//!
//! ## Registers
//! - R0-R1: Channel A tone period (12-bit)
//! - R2-R3: Channel B tone period (12-bit)
//! - R4-R5: Channel C tone period (12-bit)
//! - R6: Noise period (5-bit)
//! - R7: Mixer control
//! - R8-R10: Channel A/B/C amplitude (4-bit) or envelope mode
//! - R11-R12: Envelope period (16-bit)
//! - R13: Envelope shape

use crate::common::Sample;

/// AY-3-8910 / YM2149 sound chip.
#[derive(Clone)]
pub struct Ay3_8910 {
    // Registers (directly accessible)
    pub regs: [u8; 16],

    // Internal state
    tone_counters: [u16; 3],
    tone_outputs: [bool; 3],

    noise_counter: u16,
    noise_output: bool,
    noise_lfsr: u32,  // 17-bit LFSR

    envelope_counter: u32,
    envelope_step: u8,
    envelope_holding: bool,
    envelope_alternate: bool,
    envelope_attack: bool,

    // Clock divider (chip runs at clock/8 for tone, clock/16 for noise)
    clock_counter: u32,

    // Chip clock frequency (Hz)
    clock_freq: f32,

    // Sample rate
    sample_rate: f32,

    // Accumulator for resampling
    accum: f32,
}

/// Envelope shape bits
const ENV_CONTINUE: u8 = 0x08;
const ENV_ATTACK: u8 = 0x04;
const ENV_ALTERNATE: u8 = 0x02;
const ENV_HOLD: u8 = 0x01;

/// Volume table (4-bit DAC, logarithmic)
/// These values approximate the real chip's exponential DAC
const VOLUME_TABLE: [f32; 16] = [
    0.0000, 0.0100, 0.0145, 0.0211,
    0.0307, 0.0447, 0.0650, 0.0945,
    0.1375, 0.2000, 0.2910, 0.4230,
    0.6150, 0.8945, 1.0000, 1.0000,  // 15 same as 14 on real chip
];

impl Ay3_8910 {
    /// Create a new AY-3-8910 with given clock frequency and sample rate.
    ///
    /// Common clock frequencies:
    /// - ZX Spectrum: 1773400 Hz
    /// - Amstrad CPC: 1000000 Hz
    /// - Atari ST (YM2149): 2000000 Hz
    /// - MSX: 1789773 Hz
    pub fn new(clock_freq: f32, sample_rate: f32) -> Self {
        let mut chip = Self {
            regs: [0; 16],
            tone_counters: [0; 3],
            tone_outputs: [false; 3],
            noise_counter: 0,
            noise_output: false,
            noise_lfsr: 1,  // Must be non-zero
            envelope_counter: 0,
            envelope_step: 0,
            envelope_holding: false,
            envelope_alternate: false,
            envelope_attack: false,
            clock_counter: 0,
            clock_freq,
            sample_rate,
            accum: 0.0,
        };
        // Initialize with all channels disabled (silent by default)
        chip.regs[7] = 0xFF;
        chip
    }

    /// Reset the chip to initial state.
    pub fn reset(&mut self) {
        self.regs = [0; 16];
        self.regs[7] = 0xFF;  // All channels disabled by default
        self.tone_counters = [0; 3];
        self.tone_outputs = [false; 3];
        self.noise_counter = 0;
        self.noise_output = false;
        self.noise_lfsr = 1;
        self.envelope_counter = 0;
        self.envelope_step = 0;
        self.envelope_holding = false;
        self.envelope_alternate = false;
        self.envelope_attack = false;
        self.clock_counter = 0;
        self.accum = 0.0;
    }

    /// Write a register value.
    pub fn write_reg(&mut self, reg: u8, value: u8) {
        let reg = reg & 0x0F;  // Only 16 registers
        self.regs[reg as usize] = value;

        // Special handling for envelope shape register
        if reg == 13 {
            self.envelope_step = 0;
            self.envelope_counter = 0;
            self.envelope_holding = false;

            // Decode envelope shape
            let shape = value & 0x0F;
            self.envelope_attack = (shape & ENV_ATTACK) != 0;
            self.envelope_alternate = (shape & ENV_ALTERNATE) != 0;

            // If continue bit is 0, we hold after first cycle
            if (shape & ENV_CONTINUE) == 0 {
                self.envelope_holding = false;  // Will hold after first cycle
            }
        }
    }

    /// Read a register value.
    pub fn read_reg(&self, reg: u8) -> u8 {
        self.regs[(reg & 0x0F) as usize]
    }

    /// Get the tone period for a channel (0-2).
    #[inline]
    fn tone_period(&self, channel: usize) -> u16 {
        let lo = self.regs[channel * 2] as u16;
        let hi = (self.regs[channel * 2 + 1] & 0x0F) as u16;
        let period = (hi << 8) | lo;
        if period == 0 { 1 } else { period }
    }

    /// Get the noise period.
    #[inline]
    fn noise_period(&self) -> u16 {
        let period = (self.regs[6] & 0x1F) as u16;
        if period == 0 { 1 } else { period }
    }

    /// Get the envelope period.
    #[inline]
    fn envelope_period(&self) -> u32 {
        let lo = self.regs[11] as u32;
        let hi = self.regs[12] as u32;
        let period = (hi << 8) | lo;
        if period == 0 { 1 } else { period }
    }

    /// Check if tone is enabled for a channel.
    #[inline]
    fn tone_enabled(&self, channel: usize) -> bool {
        (self.regs[7] & (1 << channel)) == 0
    }

    /// Check if noise is enabled for a channel.
    #[inline]
    fn noise_enabled(&self, channel: usize) -> bool {
        (self.regs[7] & (8 << channel)) == 0
    }

    /// Get channel amplitude (0-15) or envelope mode.
    #[inline]
    fn channel_amplitude(&self, channel: usize) -> (u8, bool) {
        let amp = self.regs[8 + channel];
        let use_envelope = (amp & 0x10) != 0;
        (amp & 0x0F, use_envelope)
    }

    /// Calculate current envelope amplitude.
    fn envelope_amplitude(&self) -> u8 {
        if self.envelope_holding {
            let shape = self.regs[13] & 0x0F;
            // Determine hold value based on shape
            match shape {
                0x00..=0x03 => 0,      // Decay to 0, hold
                0x04..=0x07 => 0,      // Attack to 15, then 0, hold
                0x08 => 0,             // Sawtooth down (no hold)
                0x09 => 0,             // Decay to 0, hold
                0x0A => 0,             // Triangle (no hold)
                0x0B => 15,            // Decay then hold at 15
                0x0C => 15,            // Sawtooth up (no hold)
                0x0D => 15,            // Attack to 15, hold
                0x0E => 15,            // Triangle (no hold)
                0x0F => 0,             // Attack then hold at 0
                _ => 0,
            }
        } else if self.envelope_attack {
            self.envelope_step
        } else {
            15 - self.envelope_step
        }
    }

    /// Tick the chip by one internal clock cycle.
    fn tick(&mut self) {
        // Tone generators (updated every 8 clock cycles)
        for ch in 0..3 {
            self.tone_counters[ch] = self.tone_counters[ch].wrapping_sub(1);
            if self.tone_counters[ch] == 0 {
                self.tone_counters[ch] = self.tone_period(ch);
                self.tone_outputs[ch] = !self.tone_outputs[ch];
            }
        }

        // Noise generator (updated every 16 clock cycles relative to tone)
        // We'll update it every other tick to simulate clock/16
        if self.clock_counter & 1 == 0 {
            self.noise_counter = self.noise_counter.wrapping_sub(1);
            if self.noise_counter == 0 {
                self.noise_counter = self.noise_period();

                // 17-bit LFSR with taps at bits 0 and 3 (XOR)
                let bit = ((self.noise_lfsr ^ (self.noise_lfsr >> 3)) & 1) as u32;
                self.noise_lfsr = (self.noise_lfsr >> 1) | (bit << 16);
                self.noise_output = (self.noise_lfsr & 1) != 0;
            }
        }

        // Envelope generator (updated every 8 clock cycles, like tone)
        // But envelope period is much longer
        self.envelope_counter += 1;
        if self.envelope_counter >= self.envelope_period() {
            self.envelope_counter = 0;

            if !self.envelope_holding {
                self.envelope_step += 1;
                if self.envelope_step >= 16 {
                    self.envelope_step = 0;

                    let shape = self.regs[13] & 0x0F;

                    // Check for hold condition
                    if (shape & ENV_CONTINUE) == 0 {
                        self.envelope_holding = true;
                    } else if (shape & ENV_HOLD) != 0 {
                        self.envelope_holding = true;
                    } else if (shape & ENV_ALTERNATE) != 0 {
                        self.envelope_attack = !self.envelope_attack;
                    }
                }
            }
        }

        self.clock_counter = self.clock_counter.wrapping_add(1);
    }

    /// Get current output for a single channel.
    fn channel_output(&self, channel: usize) -> f32 {
        let tone_out = !self.tone_enabled(channel) || self.tone_outputs[channel];
        let noise_out = !self.noise_enabled(channel) || self.noise_output;

        // Both must be high for output
        let output = tone_out && noise_out;

        // Get amplitude
        let (amp, use_envelope) = self.channel_amplitude(channel);
        let volume = if use_envelope {
            self.envelope_amplitude()
        } else {
            amp
        };

        if output {
            VOLUME_TABLE[volume as usize]
        } else {
            0.0
        }
    }

    /// Generate audio samples.
    ///
    /// Returns (left, right) stereo output. Default is ABC spread (A left, B center, C right).
    pub fn generate_samples(&mut self, output_l: &mut [Sample], output_r: &mut [Sample]) {
        // Calculate how many chip clocks per sample
        let clocks_per_sample = (self.clock_freq / 8.0) / self.sample_rate;

        for i in 0..output_l.len().min(output_r.len()) {
            self.accum += clocks_per_sample;

            while self.accum >= 1.0 {
                self.tick();
                self.accum -= 1.0;
            }

            // Get channel outputs
            let a = self.channel_output(0);
            let b = self.channel_output(1);
            let c = self.channel_output(2);

            // ABC stereo spread: A=left, B=center, C=right
            output_l[i] = a + b * 0.5;
            output_r[i] = c + b * 0.5;
        }
    }

    /// Generate mono audio samples (mixed ABC).
    pub fn generate_samples_mono(&mut self, output: &mut [Sample]) {
        let clocks_per_sample = (self.clock_freq / 8.0) / self.sample_rate;

        for sample in output.iter_mut() {
            self.accum += clocks_per_sample;

            while self.accum >= 1.0 {
                self.tick();
                self.accum -= 1.0;
            }

            let a = self.channel_output(0);
            let b = self.channel_output(1);
            let c = self.channel_output(2);

            *sample = (a + b + c) / 3.0;
        }
    }

    /// Get current voice state for visualization.
    pub fn voice_state(&self, channel: usize) -> (u16, bool, u8) {
        let period = self.tone_period(channel);
        let (amp, use_envelope) = self.channel_amplitude(channel);
        let volume = if use_envelope {
            self.envelope_amplitude()
        } else {
            amp
        };
        let active = volume > 0 && (self.tone_enabled(channel) || self.noise_enabled(channel));

        // Encode output type: bit 0 = tone, bit 1 = noise, bit 2 = envelope
        let mut flags = 0u8;
        if self.tone_enabled(channel) { flags |= 1; }
        if self.noise_enabled(channel) { flags |= 2; }
        if use_envelope { flags |= 4; }

        (period, active, flags)
    }

    /// Convert period to frequency (Hz).
    pub fn period_to_freq(&self, period: u16) -> f32 {
        if period == 0 { return 0.0; }
        self.clock_freq / (16.0 * period as f32)
    }
}

impl Default for Ay3_8910 {
    fn default() -> Self {
        // Default to ZX Spectrum 128K clock
        Self::new(1773400.0, 44100.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tone_period() {
        let mut ay = Ay3_8910::new(1773400.0, 44100.0);

        // Set channel A period to 0x1FF
        ay.write_reg(0, 0xFF);
        ay.write_reg(1, 0x01);

        assert_eq!(ay.tone_period(0), 0x1FF);
    }

    #[test]
    fn test_mixer() {
        let mut ay = Ay3_8910::new(1773400.0, 44100.0);

        // Enable tone on A, noise on B
        ay.write_reg(7, 0b00_110_110);  // A tone, B noise

        assert!(ay.tone_enabled(0));
        assert!(!ay.tone_enabled(1));
        assert!(!ay.noise_enabled(0));
        assert!(ay.noise_enabled(1));
    }

    #[test]
    fn test_envelope() {
        let mut ay = Ay3_8910::new(1773400.0, 44100.0);

        // Set envelope shape to attack (0x0C)
        ay.write_reg(13, 0x0C);

        assert!(ay.envelope_attack);
    }
}
