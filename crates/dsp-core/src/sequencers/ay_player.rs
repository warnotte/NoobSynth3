//! AY/YM/VTX/PSG Player module.
//!
//! Plays chiptune files from various AY-3-8910/YM2149 based platforms:
//! - Atari ST (.ym)
//! - ZX Spectrum (.vtx, .psg)
//! - Amstrad CPC (.vtx, .psg)
//! - MSX (.psg)
//!
//! ## Supported Formats
//!
//! ### YM Format (Atari ST)
//! - YM2!, YM3!, YM3b, YM4!, YM5!, YM6!
//! - Register dumps, typically LHA compressed
//!
//! ### VTX Format (ZX Spectrum/CPC)
//! - Header with chip type (AY/YM), stereo mode, clock, metadata
//! - LHA-5 compressed register data (YM3-like interleaved)
//!
//! ### PSG Format (MSX/Spectrum)
//! - Simple command-based register log
//! - Commands: 0x00-0x0F = register write, 0xFF = end of frame, 0xFD = end
//!
//! Note: LHA decompression is done in JavaScript before loading.

use crate::common::Sample;
use crate::chips::Ay3_8910;

/// Number of AY registers per frame
const REGS_PER_FRAME: usize = 16;

/// YM file header info
#[derive(Clone, Debug, Default)]
pub struct YmHeader {
    /// Format identifier (YM2!, YM3!, YM5!, YM6!)
    pub format: [u8; 4],
    /// Song name
    pub name: String,
    /// Author name
    pub author: String,
    /// Comment
    pub comment: String,
    /// Number of frames
    pub frame_count: u32,
    /// Playback rate (usually 50 Hz)
    pub frame_rate: u32,
    /// Chip clock frequency
    pub clock_freq: u32,
    /// Loop frame (for looping songs)
    pub loop_frame: u32,
    /// Is interleaved format
    pub interleaved: bool,
    /// Has digidrum data
    pub has_digidrums: bool,
}

/// AY Player state
#[derive(Clone)]
pub struct AyPlayer {
    /// AY chip instance
    ay: Ay3_8910,

    /// YM header info
    header: YmHeader,

    /// Frame data (14-16 bytes per frame)
    frame_data: Vec<u8>,

    /// Current frame index
    current_frame: u32,

    /// Sample accumulator for frame timing
    sample_accum: f32,

    /// Samples per frame
    samples_per_frame: f32,

    /// Sample rate
    sample_rate: f32,

    /// Playing state
    playing: bool,

    /// Loop enabled
    loop_enabled: bool,

    /// Data loaded flag
    data_loaded: bool,

    /// Elapsed frames (for time display)
    elapsed_frames: u32,
}

impl AyPlayer {
    /// Create a new AY player.
    pub fn new(sample_rate: f32) -> Self {
        let frame_rate = 50.0;  // Default PAL
        Self {
            ay: Ay3_8910::new(1773400.0, sample_rate),  // Default ZX Spectrum clock
            header: YmHeader::default(),
            frame_data: Vec::new(),
            current_frame: 0,
            sample_accum: 0.0,
            samples_per_frame: sample_rate / frame_rate,
            sample_rate,
            playing: false,
            loop_enabled: true,
            data_loaded: false,
            elapsed_frames: 0,
        }
    }

    /// Reset playback to beginning.
    pub fn reset(&mut self) {
        self.ay.reset();
        self.current_frame = 0;
        self.sample_accum = 0.0;
        self.elapsed_frames = 0;
    }

    /// Load music data (auto-detects format: YM, VTX, PSG).
    ///
    /// The data should be already decompressed (LHA decompression done in JS).
    pub fn load_ym(&mut self, data: &[u8]) -> Result<(), &'static str> {
        if data.len() < 4 {
            return Err("Data too short");
        }

        // Auto-detect format based on magic bytes
        let magic = &data[0..4];

        // PSG format: "PSG" + 0x1A
        if data.len() >= 4 && &data[0..3] == b"PSG" && data[3] == 0x1A {
            return self.load_psg(data);
        }

        // VTX format: "ay" or "ym" (little-endian word)
        if data.len() >= 2 {
            let vtx_magic = u16::from_le_bytes([data[0], data[1]]);
            // "ay" = 0x7961, "ym" = 0x6D79
            if vtx_magic == 0x7961 || vtx_magic == 0x6D79 {
                return self.load_vtx(data);
            }
        }

        // YM formats
        let (format, _header_size, interleaved) = match magic {
            b"YM2!" => (*b"YM2!", 4, false),
            b"YM3!" => (*b"YM3!", 4, true),
            b"YM3b" => (*b"YM3b", 4, true),
            b"YM4!" => (*b"YM4!", 8, true),
            b"YM5!" => (*b"YM5!", 0, true),
            b"YM6!" => (*b"YM6!", 0, true),
            _ => return Err("Unknown format (not YM/VTX/PSG)"),
        };

        self.header.format = format;
        self.header.interleaved = interleaved;

        // Parse based on format version
        if magic == b"YM5!" || magic == b"YM6!" {
            self.parse_ym5_header(data)?;
        } else if magic == b"YM3!" || magic == b"YM3b" {
            self.parse_ym3_header(data)?;
        } else {
            // YM2! - simplest format
            self.parse_ym2_header(data)?;
        }

        self.finalize_load()
    }

    /// Finalize loading - update timing and chip.
    fn finalize_load(&mut self) -> Result<(), &'static str> {
        // Update timing
        if self.header.frame_rate == 0 {
            self.header.frame_rate = 50;  // Default to PAL
        }
        self.samples_per_frame = self.sample_rate / self.header.frame_rate as f32;

        // Update chip clock
        if self.header.clock_freq > 0 {
            self.ay = Ay3_8910::new(self.header.clock_freq as f32, self.sample_rate);
        }

        self.data_loaded = true;
        self.reset();

        Ok(())
    }

    /// Load VTX format (ZX Spectrum/CPC).
    fn load_vtx(&mut self, data: &[u8]) -> Result<(), &'static str> {
        if data.len() < 16 {
            return Err("VTX data too short");
        }

        // Header structure:
        // 0-1: "ay" (0x7961) or "ym" (0x6D79)
        // 2: stereo mode
        // 3-4: loop frame (word)
        // 5-8: chip clock (dword)
        // 9: player frequency (VBL/sec)
        // 10-11: year (word)
        // 12-15: unpacked data size (dword)
        // Then: null-terminated strings (name, author, program, editor, comment)
        // Then: LHA-5 compressed data

        let chip_type = u16::from_le_bytes([data[0], data[1]]);
        let _stereo_mode = data[2];
        let loop_frame = u16::from_le_bytes([data[3], data[4]]) as u32;
        let clock_freq = u32::from_le_bytes([data[5], data[6], data[7], data[8]]);
        let frame_rate = data[9] as u32;
        let _year = u16::from_le_bytes([data[10], data[11]]);
        let unpacked_size = u32::from_le_bytes([data[12], data[13], data[14], data[15]]) as usize;

        // Read null-terminated strings
        let mut offset = 16;

        fn read_string(data: &[u8], offset: &mut usize) -> String {
            let start = *offset;
            while *offset < data.len() && data[*offset] != 0 {
                *offset += 1;
            }
            let s = String::from_utf8_lossy(&data[start..*offset]).to_string();
            if *offset < data.len() {
                *offset += 1;  // Skip null terminator
            }
            s
        }

        let name = read_string(data, &mut offset);
        let author = read_string(data, &mut offset);
        let _program = read_string(data, &mut offset);
        let _editor = read_string(data, &mut offset);
        let _comment = read_string(data, &mut offset);

        // The remaining data is the frame data (already decompressed by JS)
        // VTX uses YM3-style interleaved format (14 registers)
        let frame_data = &data[offset..];

        // Check if this is raw decompressed data or still needs processing
        let actual_size = if frame_data.len() >= unpacked_size {
            unpacked_size
        } else {
            frame_data.len()
        };

        let frame_count = actual_size / 14;

        self.header.format = if chip_type == 0x7961 { *b"VTXa" } else { *b"VTXy" };
        self.header.name = name;
        self.header.author = author;
        self.header.frame_count = frame_count as u32;
        self.header.frame_rate = if frame_rate > 0 { frame_rate } else { 50 };
        self.header.clock_freq = if clock_freq > 0 { clock_freq } else { 1773400 };
        self.header.loop_frame = loop_frame;
        self.header.interleaved = true;

        // Deinterleave (VTX uses same format as YM3)
        self.frame_data = self.deinterleave(&frame_data[..actual_size], frame_count, 14);

        self.finalize_load()
    }

    /// Load PSG format (MSX/Spectrum).
    fn load_psg(&mut self, data: &[u8]) -> Result<(), &'static str> {
        if data.len() < 16 {
            return Err("PSG data too short");
        }

        // Header:
        // 0-2: "PSG"
        // 3: 0x1A
        // 4: version
        // 5: player frequency (for version >= 10)
        // 6-15: reserved

        let version = data[4];
        let frame_rate = if version >= 10 && data[5] > 0 {
            data[5] as u32
        } else {
            50  // Default PAL
        };

        // Parse command stream into frames
        // Commands: 0x00-0x0F = register, followed by value
        //           0xFF = end of frame
        //           0xFE, count = multiple end of frames
        //           0xFD = end of music

        let mut frames: Vec<[u8; 14]> = Vec::new();
        let mut current_frame = [0u8; 14];
        let mut offset = 16;

        while offset < data.len() {
            let cmd = data[offset];
            offset += 1;

            match cmd {
                0x00..=0x0D => {
                    // Register write (0-13 are valid AY registers)
                    if offset < data.len() {
                        current_frame[cmd as usize] = data[offset];
                        offset += 1;
                    }
                }
                0x0E..=0x0F => {
                    // Register 14-15 (I/O ports, usually ignored)
                    if offset < data.len() {
                        offset += 1;
                    }
                }
                0xFD => {
                    // End of music
                    frames.push(current_frame);
                    break;
                }
                0xFE => {
                    // Multiple end of frames
                    if offset < data.len() {
                        let count = data[offset] as usize;
                        offset += 1;
                        for _ in 0..=count {
                            frames.push(current_frame);
                        }
                    }
                }
                0xFF => {
                    // End of frame
                    frames.push(current_frame);
                }
                _ => {
                    // Unknown command, skip
                }
            }
        }

        // Convert frames to sequential data
        self.frame_data = frames.iter().flat_map(|f| f.iter().copied()).collect();

        self.header.format = *b"PSG!";
        self.header.frame_count = frames.len() as u32;
        self.header.frame_rate = frame_rate;
        self.header.clock_freq = 1773400;  // Default ZX Spectrum
        self.header.loop_frame = 0;
        self.header.interleaved = false;

        self.finalize_load()
    }

    /// Parse YM2! header (simplest format).
    fn parse_ym2_header(&mut self, data: &[u8]) -> Result<(), &'static str> {
        // YM2! is just magic + raw frame data (non-interleaved)
        // Each frame is 14 bytes
        let frame_data_start = 4;
        let frame_data_len = data.len() - frame_data_start;
        let frame_count = frame_data_len / 14;

        self.header.frame_count = frame_count as u32;
        self.header.frame_rate = 50;
        self.header.clock_freq = 1773400;  // ZX Spectrum default
        self.header.interleaved = false;

        // Copy frame data
        self.frame_data = data[frame_data_start..].to_vec();

        Ok(())
    }

    /// Parse YM3!/YM3b header.
    fn parse_ym3_header(&mut self, data: &[u8]) -> Result<(), &'static str> {
        // YM3! has interleaved frame data
        // Check for "LeOnArD!" at end (indicates YM3b with loop info)
        let has_loop = data.len() > 8 && &data[data.len()-8..] == b"LeOnArD!";

        let frame_data_end = if has_loop {
            data.len() - 8
        } else {
            data.len()
        };

        let frame_data_start = 4;
        let frame_data_len = frame_data_end - frame_data_start;

        // YM3 interleaved: all R0 values, then all R1 values, etc. (14 registers)
        let frame_count = frame_data_len / 14;

        self.header.frame_count = frame_count as u32;
        self.header.frame_rate = 50;
        self.header.clock_freq = 2000000;  // Atari ST default

        // Convert interleaved to sequential
        self.frame_data = self.deinterleave(&data[frame_data_start..frame_data_end], frame_count, 14);

        Ok(())
    }

    /// Parse YM5!/YM6! header (extended format).
    fn parse_ym5_header(&mut self, data: &[u8]) -> Result<(), &'static str> {
        if data.len() < 34 {
            return Err("YM5/6 header too short");
        }

        // YM5!/YM6! header structure:
        // 0-3: "YM5!" or "YM6!"
        // 4-11: "LeOnArD!" check string
        // 12-15: frame count (big endian)
        // 16-19: song attributes
        // 20-21: digidrums count
        // 22-25: chip clock (big endian)
        // 26-27: frame rate (big endian)
        // 28-31: loop frame (big endian)
        // 32-33: extra data size
        // Then: song name (null terminated)
        // Then: author name (null terminated)
        // Then: comment (null terminated)
        // Then: frame data

        // Check "LeOnArD!"
        if &data[4..12] != b"LeOnArD!" {
            return Err("Invalid YM5/6 header (missing LeOnArD!)");
        }

        self.header.frame_count = u32::from_be_bytes([data[12], data[13], data[14], data[15]]);

        let attributes = u32::from_be_bytes([data[16], data[17], data[18], data[19]]);
        self.header.interleaved = (attributes & 1) != 0;
        self.header.has_digidrums = (attributes & 2) != 0;

        let _digidrums_count = u16::from_be_bytes([data[20], data[21]]);

        self.header.clock_freq = u32::from_be_bytes([data[22], data[23], data[24], data[25]]);
        self.header.frame_rate = u16::from_be_bytes([data[26], data[27]]) as u32;
        self.header.loop_frame = u32::from_be_bytes([data[28], data[29], data[30], data[31]]);

        let extra_size = u16::from_be_bytes([data[32], data[33]]) as usize;

        // Skip extra data and read strings
        let mut offset = 34 + extra_size;

        // Skip digidrums if present
        if self.header.has_digidrums && _digidrums_count > 0 {
            for _ in 0.._digidrums_count {
                if offset + 4 > data.len() {
                    return Err("Invalid digidrum data");
                }
                let drum_size = u32::from_be_bytes([
                    data[offset], data[offset+1], data[offset+2], data[offset+3]
                ]) as usize;
                offset += 4 + drum_size;
            }
        }

        // Read null-terminated strings
        fn read_string(data: &[u8], offset: &mut usize) -> String {
            let start = *offset;
            while *offset < data.len() && data[*offset] != 0 {
                *offset += 1;
            }
            let s = String::from_utf8_lossy(&data[start..*offset]).to_string();
            *offset += 1;  // Skip null terminator
            s
        }

        self.header.name = read_string(data, &mut offset);
        self.header.author = read_string(data, &mut offset);
        self.header.comment = read_string(data, &mut offset);

        // Frame data
        let frame_data_len = data.len() - offset;
        let expected_len = self.header.frame_count as usize * 16;

        if frame_data_len < expected_len {
            // Some files use 14 registers instead of 16
            let regs = if frame_data_len >= self.header.frame_count as usize * 14 { 14 } else { 16 };
            if self.header.interleaved {
                self.frame_data = self.deinterleave(&data[offset..], self.header.frame_count as usize, regs);
            } else {
                self.frame_data = data[offset..].to_vec();
            }
        } else {
            if self.header.interleaved {
                self.frame_data = self.deinterleave(&data[offset..offset + expected_len], self.header.frame_count as usize, 16);
            } else {
                self.frame_data = data[offset..offset + expected_len].to_vec();
            }
        }

        Ok(())
    }

    /// Convert interleaved frame data to sequential.
    fn deinterleave(&self, data: &[u8], frame_count: usize, regs: usize) -> Vec<u8> {
        let mut result = vec![0u8; frame_count * regs];

        for frame in 0..frame_count {
            for reg in 0..regs {
                let src_offset = reg * frame_count + frame;
                let dst_offset = frame * regs + reg;
                if src_offset < data.len() {
                    result[dst_offset] = data[src_offset];
                }
            }
        }

        result
    }

    /// Set playing state.
    pub fn set_playing(&mut self, playing: bool) {
        self.playing = playing;
        if playing && !self.data_loaded {
            self.playing = false;
        }
    }

    /// Check if playing.
    pub fn is_playing(&self) -> bool {
        self.playing
    }

    /// Get header info.
    pub fn header(&self) -> &YmHeader {
        &self.header
    }

    /// Get current frame.
    pub fn current_frame(&self) -> u32 {
        self.current_frame
    }

    /// Get elapsed time in seconds.
    pub fn elapsed_seconds(&self) -> f32 {
        if self.header.frame_rate == 0 {
            0.0
        } else {
            self.elapsed_frames as f32 / self.header.frame_rate as f32
        }
    }

    /// Apply frame registers to AY chip.
    fn apply_frame(&mut self, frame: u32) {
        let frame_size = if self.frame_data.len() / self.header.frame_count.max(1) as usize >= 16 {
            16
        } else {
            14
        };

        let offset = frame as usize * frame_size;
        if offset + frame_size <= self.frame_data.len() {
            for reg in 0..frame_size.min(14) {
                self.ay.write_reg(reg as u8, self.frame_data[offset + reg]);
            }
        }
    }

    /// Process audio block.
    pub fn process_block(
        &mut self,
        output_l: &mut [Sample],
        output_r: &mut [Sample],
    ) {
        // Always ensure silence when not playing or no data loaded
        if !self.playing || !self.data_loaded || self.header.frame_count == 0 {
            // Output complete silence
            output_l.fill(0.0);
            output_r.fill(0.0);
            return;
        }

        let len = output_l.len().min(output_r.len());

        for i in 0..len {
            // Check if we need to advance to next frame
            self.sample_accum += 1.0;
            if self.sample_accum >= self.samples_per_frame {
                self.sample_accum -= self.samples_per_frame;

                self.current_frame += 1;
                self.elapsed_frames += 1;

                if self.current_frame >= self.header.frame_count {
                    if self.loop_enabled {
                        self.current_frame = self.header.loop_frame.min(self.header.frame_count.saturating_sub(1));
                    } else {
                        self.playing = false;
                        self.current_frame = self.header.frame_count - 1;
                    }
                }

                self.apply_frame(self.current_frame);
            }

            // Generate one sample
            let mut l = [0.0f32];
            let mut r = [0.0f32];
            self.ay.generate_samples(&mut l, &mut r);
            output_l[i] = l[0];
            output_r[i] = r[0];
        }
    }

    /// Get voice state for visualization.
    /// Returns (period, active, flags) for each of the 3 voices.
    pub fn voice_states(&self) -> [(u16, bool, u8); 3] {
        [
            self.ay.voice_state(0),
            self.ay.voice_state(1),
            self.ay.voice_state(2),
        ]
    }
}

/// Params for AY Player
pub struct AyPlayerParams<'a> {
    pub playing: &'a [Sample],
    pub loop_enabled: &'a [Sample],
}

/// Inputs for AY Player
pub struct AyPlayerInputs<'a> {
    pub gate: Option<&'a [Sample]>,
}

/// Outputs for AY Player
pub struct AyPlayerOutputs<'a> {
    pub out_l: &'a mut [Sample],
    pub out_r: &'a mut [Sample],
    pub cv_a: &'a mut [Sample],
    pub cv_b: &'a mut [Sample],
    pub cv_c: &'a mut [Sample],
    pub gate_a: &'a mut [Sample],
    pub gate_b: &'a mut [Sample],
    pub gate_c: &'a mut [Sample],
}

impl AyPlayer {
    /// Process with full params/inputs/outputs interface.
    pub fn process_block_full(
        &mut self,
        outputs: AyPlayerOutputs,
        _inputs: AyPlayerInputs,
        params: AyPlayerParams,
    ) {
        use crate::common::sample_at;

        // Update params
        let playing = sample_at(params.playing, 0, 0.0) > 0.5;
        let loop_enabled = sample_at(params.loop_enabled, 0, 1.0) > 0.5;

        self.set_playing(playing);
        self.loop_enabled = loop_enabled;

        // Generate audio
        self.process_block(outputs.out_l, outputs.out_r);

        // Generate CV/gate outputs for each voice
        let states = self.voice_states();

        for i in 0..outputs.cv_a.len() {
            // Voice A
            let (period_a, active_a, _) = states[0];
            let freq_a = self.ay.period_to_freq(period_a);
            outputs.cv_a[i] = freq_to_voct(freq_a);
            outputs.gate_a[i] = if active_a && self.playing { 1.0 } else { 0.0 };

            // Voice B
            let (period_b, active_b, _) = states[1];
            let freq_b = self.ay.period_to_freq(period_b);
            outputs.cv_b[i] = freq_to_voct(freq_b);
            outputs.gate_b[i] = if active_b && self.playing { 1.0 } else { 0.0 };

            // Voice C
            let (period_c, active_c, _) = states[2];
            let freq_c = self.ay.period_to_freq(period_c);
            outputs.cv_c[i] = freq_to_voct(freq_c);
            outputs.gate_c[i] = if active_c && self.playing { 1.0 } else { 0.0 };
        }
    }
}

/// Convert frequency in Hz to V/Oct CV (C4 = 0V, 261.63 Hz)
#[inline]
fn freq_to_voct(freq_hz: f32) -> f32 {
    if freq_hz <= 0.0 {
        return -5.0; // Very low CV for zero/invalid frequency
    }
    (freq_hz / 261.63).log2()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_player() {
        let player = AyPlayer::new(44100.0);
        assert!(!player.is_playing());
        assert!(!player.data_loaded);
    }

    #[test]
    fn test_ym3_magic() {
        let player = AyPlayer::new(44100.0);
        // Just checking it doesn't panic
        assert_eq!(player.header.frame_count, 0);
    }
}
