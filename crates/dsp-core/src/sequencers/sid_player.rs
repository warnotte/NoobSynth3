//! SID Player module.
//!
//! Plays .sid files from Commodore 64 using a 6502 CPU emulator and reSID.
//! This is a full SID player that executes the original 6502 code.

use crate::common::{sample_at, Sample};
use mos6502::cpu::CPU;
use mos6502::memory::Bus;
use mos6502::instruction::Nmos6502;
use mos6502::registers::StackPointer;
use resid::{ChipModel, Sid, SamplingMethod};

/// C64 PAL clock frequency (Hz)
const C64_CLOCK_PAL: u32 = 985248;
/// C64 NTSC clock frequency (Hz)
const C64_CLOCK_NTSC: u32 = 1022727;

/// SID register base address in C64 memory map
const SID_BASE: u16 = 0xD400;
/// SID register end address
const SID_END: u16 = 0xD41C;

/// Maximum size of .sid file data
#[allow(dead_code)]
const MAX_SID_DATA: usize = 65536;

/// PSID/RSID header magic
const PSID_MAGIC: &[u8] = b"PSID";
const RSID_MAGIC: &[u8] = b"RSID";

/// C64 Memory with SID intercept
pub struct C64Memory {
    ram: [u8; 65536],
    sid_writes: [(u8, u8); 256], // Fixed buffer for SID writes
    sid_write_count: usize,
}

impl C64Memory {
    pub fn new() -> Self {
        Self {
            ram: [0; 65536],
            sid_writes: [(0, 0); 256],
            sid_write_count: 0,
        }
    }

    /// Load data at specified address
    pub fn load(&mut self, address: u16, data: &[u8]) {
        let start = address as usize;
        let end = (start + data.len()).min(65536);
        let len = end - start;
        self.ram[start..end].copy_from_slice(&data[..len]);
    }

    /// Clear SID write buffer
    pub fn clear_sid_writes(&mut self) {
        self.sid_write_count = 0;
    }

    /// Get pending SID writes count
    pub fn sid_write_count(&self) -> usize {
        self.sid_write_count.min(256)
    }

    /// Get a SID write by index
    pub fn get_sid_write(&self, index: usize) -> (u8, u8) {
        self.sid_writes[index]
    }

    /// Install a minimal "kernal" for RTS and basic ops
    fn install_kernal(&mut self) {
        // Reset vector points to a RTS instruction
        self.ram[0xFFFC] = 0x00;
        self.ram[0xFFFD] = 0x10;
        // Put RTS at $1000
        self.ram[0x1000] = 0x60; // RTS

        // NMI vector (just RTI)
        self.ram[0xFFFA] = 0x02;
        self.ram[0xFFFB] = 0x10;
        self.ram[0x1002] = 0x40; // RTI

        // IRQ vector (just RTI)
        self.ram[0xFFFE] = 0x04;
        self.ram[0xFFFF] = 0x10;
        self.ram[0x1004] = 0x40; // RTI
    }
}

impl Default for C64Memory {
    fn default() -> Self {
        Self::new()
    }
}

impl Bus for C64Memory {
    fn get_byte(&mut self, address: u16) -> u8 {
        // SID reads return 0 (write-only registers mostly)
        if address >= SID_BASE && address <= SID_END {
            return 0;
        }
        self.ram[address as usize]
    }

    fn set_byte(&mut self, address: u16, value: u8) {
        // Intercept SID writes
        if address >= SID_BASE && address <= SID_END {
            let reg = (address - SID_BASE) as u8;
            if self.sid_write_count < 256 {
                self.sid_writes[self.sid_write_count] = (reg, value);
                self.sid_write_count += 1;
            }
        }
        self.ram[address as usize] = value;
    }
}

/// Parsed SID file header
#[derive(Clone, Default)]
pub struct SidHeader {
    pub version: u16,
    pub data_offset: u16,
    pub load_address: u16,
    pub init_address: u16,
    pub play_address: u16,
    pub songs: u16,
    pub start_song: u16,
    pub speed: u32,
    pub name: String,
    pub author: String,
    pub released: String,
    pub is_rsid: bool,
    pub is_pal: bool,
}

impl SidHeader {
    /// Parse header from .sid file data
    pub fn parse(data: &[u8]) -> Option<Self> {
        if data.len() < 0x76 {
            return None;
        }

        // Check magic
        let is_rsid = &data[0..4] == RSID_MAGIC;
        if &data[0..4] != PSID_MAGIC && !is_rsid {
            return None;
        }

        let version = u16::from_be_bytes([data[4], data[5]]);
        let data_offset = u16::from_be_bytes([data[6], data[7]]);
        let load_address = u16::from_be_bytes([data[8], data[9]]);
        let init_address = u16::from_be_bytes([data[10], data[11]]);
        let play_address = u16::from_be_bytes([data[12], data[13]]);
        let songs = u16::from_be_bytes([data[14], data[15]]);
        let start_song = u16::from_be_bytes([data[16], data[17]]);
        let speed = u32::from_be_bytes([data[18], data[19], data[20], data[21]]);

        // Parse strings (32 bytes each, null-terminated)
        let name = parse_string(&data[0x16..0x36]);
        let author = parse_string(&data[0x36..0x56]);
        let released = parse_string(&data[0x56..0x76]);

        // Flags (version 2+)
        let is_pal = if version >= 2 && data.len() > 0x77 {
            let flags = u16::from_be_bytes([data[0x76], data[0x77]]);
            (flags & 0x0C) != 0x08 // Not NTSC-only
        } else {
            true // Default to PAL
        };

        Some(Self {
            version,
            data_offset,
            load_address,
            init_address,
            play_address,
            songs,
            start_song,
            speed,
            name,
            author,
            released,
            is_rsid,
            is_pal,
        })
    }
}

fn parse_string(data: &[u8]) -> String {
    let end = data.iter().position(|&b| b == 0).unwrap_or(data.len());
    String::from_utf8_lossy(&data[..end]).to_string()
}

/// SID Player state
pub struct SidPlayer {
    sample_rate: f32,

    // Emulation
    memory: C64Memory,
    sid: Sid,

    // SID file info
    header: SidHeader,
    current_song: u16,
    is_loaded: bool,

    // Timing
    cycles_per_frame: u32,       // Cycles between play calls
    cycle_accumulator: f64,      // Fractional cycles for SID clocking
    frame_cycle_accumulator: u32, // Cycles accumulated for play routine calls
    cycles_per_sample: f64,

    // Play state
    playing: bool,
    initialized: bool,
    current_chip_model: u8, // 0 = 6581, 1 = 8580
}

/// Parameters for SidPlayer
pub struct SidPlayerParams<'a> {
    /// Play/pause (0 = paused, 1 = playing)
    pub playing: &'a [Sample],
    /// Song number (1-based, clamped to available songs)
    pub song: &'a [Sample],
    /// Chip model (0 = 6581, 1 = 8580)
    pub chip_model: &'a [Sample],
    /// Filter enable (0 = off, 1 = on)
    pub filter: &'a [Sample],
}

/// Inputs for SidPlayer
pub struct SidPlayerInputs<'a> {
    /// Reset trigger
    pub reset: Option<&'a [Sample]>,
}

/// Outputs for SidPlayer
pub struct SidPlayerOutputs<'a> {
    /// Left audio output
    pub left: &'a mut [Sample],
    /// Right audio output
    pub right: &'a mut [Sample],
}

impl SidPlayer {
    /// Clear all SID registers to ensure silence and prime the SID
    fn clear_sid_registers(sid: &mut Sid) {
        // Write zeros to all 29 SID registers ($D400-$D41C)
        for reg in 0..=0x1C {
            sid.write(reg, 0);
        }
        // Clock the SID a bit to flush any residual state
        sid.clock_delta(1000);
        // Discard any output that might have been generated
        let _ = sid.output();
    }

    pub fn new(sample_rate: f32) -> Self {
        let mut sid = Sid::new(ChipModel::Mos6581);
        sid.set_sampling_parameters(SamplingMethod::Fast, C64_CLOCK_PAL, sample_rate as u32);
        sid.enable_filter(true);
        sid.reset(); // Reset SID state
        Self::clear_sid_registers(&mut sid); // Explicitly clear all registers and prime

        Self {
            sample_rate,
            memory: C64Memory::new(),
            sid,
            header: SidHeader::default(),
            current_song: 1,
            is_loaded: false,
            cycles_per_frame: C64_CLOCK_PAL / 50, // PAL: 50Hz
            cycle_accumulator: 0.0,
            frame_cycle_accumulator: 0,
            cycles_per_sample: C64_CLOCK_PAL as f64 / sample_rate as f64,
            playing: false,
            initialized: false,
            current_chip_model: 0,
        }
    }

    /// Set the sample rate
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        self.sample_rate = sample_rate;
        let clock = if self.header.is_pal { C64_CLOCK_PAL } else { C64_CLOCK_NTSC };
        self.sid.set_sampling_parameters(SamplingMethod::Fast, clock, sample_rate as u32);
        self.cycles_per_sample = clock as f64 / sample_rate as f64;
    }

    /// Load a .sid file from raw bytes
    pub fn load_sid(&mut self, data: &[u8]) -> bool {
        // Parse header
        let header = match SidHeader::parse(data) {
            Some(h) => h,
            None => return false,
        };

        // Get the data portion
        let data_offset = header.data_offset as usize;
        if data_offset >= data.len() {
            return false;
        }
        let sid_data = &data[data_offset..];

        // Determine load address
        let load_addr = if header.load_address == 0 && sid_data.len() >= 2 {
            // Load address is first two bytes of data
            u16::from_le_bytes([sid_data[0], sid_data[1]])
        } else {
            header.load_address
        };

        let code_data = if header.load_address == 0 && sid_data.len() >= 2 {
            &sid_data[2..]
        } else {
            sid_data
        };

        // Setup memory
        self.memory = C64Memory::new();
        self.memory.install_kernal();
        self.memory.load(load_addr, code_data);

        // Update header with actual load address
        let mut header = header;
        if header.load_address == 0 {
            header.load_address = load_addr;
        }

        // Setup timing
        let clock = if header.is_pal { C64_CLOCK_PAL } else { C64_CLOCK_NTSC };
        let frame_rate = if header.is_pal { 50 } else { 60 };
        self.cycles_per_frame = clock / frame_rate;
        self.cycles_per_sample = clock as f64 / self.sample_rate as f64;

        // Update SID and reset to silence
        self.sid.set_sampling_parameters(SamplingMethod::Fast, clock, self.sample_rate as u32);
        self.sid.reset();
        Self::clear_sid_registers(&mut self.sid);

        self.header = header;
        self.current_song = self.header.start_song.max(1);
        self.is_loaded = true;
        self.initialized = false;
        self.cycle_accumulator = 0.0;
        self.frame_cycle_accumulator = 0;

        true
    }

    /// Initialize the current song
    fn init_song(&mut self) {
        if !self.is_loaded {
            return;
        }

        // Reset SID completely
        self.sid.reset();
        Self::clear_sid_registers(&mut self.sid);
        self.memory.clear_sid_writes();

        // Create CPU and run init routine
        let mut cpu: CPU<C64Memory, Nmos6502> = CPU::new(self.memory.clone(), Nmos6502);

        // Initialize stack pointer (6502 stack is at $0100-$01FF, SP starts at $FF)
        cpu.registers.stack_pointer = StackPointer(0xFF);

        // Push return address onto stack (JSR pushes PC+2-1, so we push $0FFF for return to $1000)
        // High byte first, then low byte (6502 is little-endian but stack pushes high first)
        let return_addr: u16 = 0x0FFF; // Will return to $1000 after RTS
        let sp = cpu.registers.stack_pointer.0;
        cpu.memory.set_byte(0x0100 + sp as u16, (return_addr >> 8) as u8);
        cpu.registers.stack_pointer = StackPointer(sp.wrapping_sub(1));
        let sp = cpu.registers.stack_pointer.0;
        cpu.memory.set_byte(0x0100 + sp as u16, (return_addr & 0xFF) as u8);
        cpu.registers.stack_pointer = StackPointer(sp.wrapping_sub(1));

        // Set A register to song number (0-based)
        cpu.registers.accumulator = (self.current_song - 1) as u8;

        // Set PC to init address
        cpu.registers.program_counter = self.header.init_address;

        // Run up to 1M cycles for init (should be plenty)
        for _ in 0..1_000_000 {
            cpu.single_step();
            // Check if we've returned to our RTS stub
            if cpu.registers.program_counter == 0x1000 {
                break;
            }
        }

        // Get memory back and apply SID writes
        self.memory = cpu.memory.clone();
        for i in 0..self.memory.sid_write_count() {
            let (reg, value) = self.memory.get_sid_write(i);
            self.sid.write(reg, value);
        }
        self.memory.clear_sid_writes();

        // Reset timing for clean playback
        self.cycle_accumulator = 0.0;
        self.frame_cycle_accumulator = 0;
        self.initialized = true;
    }

    /// Select a song (1-based)
    pub fn set_song(&mut self, song: u16) {
        let song = song.clamp(1, self.header.songs.max(1));
        if song != self.current_song {
            self.current_song = song;
            self.initialized = false;
        }
    }

    /// Set chip model
    pub fn set_chip_model(&mut self, model: ChipModel) {
        let new_model = match model {
            ChipModel::Mos6581 => 0,
            ChipModel::Mos8580 => 1,
        };

        if new_model != self.current_chip_model {
            self.current_chip_model = new_model;
            // Recreate SID with new model
            self.sid = Sid::new(model);
            let clock = if self.header.is_pal { C64_CLOCK_PAL } else { C64_CLOCK_NTSC };
            self.sid.set_sampling_parameters(SamplingMethod::Fast, clock, self.sample_rate as u32);
            self.sid.reset();
            Self::clear_sid_registers(&mut self.sid);
            self.initialized = false;
        }
    }

    /// Get song info
    pub fn get_info(&self) -> (&str, &str, &str, u16, u16) {
        (
            &self.header.name,
            &self.header.author,
            &self.header.released,
            self.current_song,
            self.header.songs,
        )
    }

    /// Process a block of audio
    pub fn process_block(
        &mut self,
        outputs: SidPlayerOutputs,
        _inputs: SidPlayerInputs,
        params: SidPlayerParams,
    ) {
        let block_size = outputs.left.len();

        // Handle params
        let should_play = sample_at(params.playing, 0, 0.0) > 0.5;
        let song = sample_at(params.song, 0, 1.0) as u16;
        let chip_model = if sample_at(params.chip_model, 0, 0.0) > 0.5 {
            ChipModel::Mos8580
        } else {
            ChipModel::Mos6581
        };
        let filter_enabled = sample_at(params.filter, 0, 1.0) > 0.5;

        // Update song if changed
        self.set_song(song);

        // Update chip model if changed
        self.set_chip_model(chip_model);

        // Update filter
        self.sid.enable_filter(filter_enabled);

        // Initialize if needed
        if should_play && !self.initialized {
            self.init_song();
        }

        self.playing = should_play;

        // If not playing or not loaded, output silence
        if !self.playing || !self.is_loaded || !self.initialized {
            for i in 0..block_size {
                outputs.left[i] = 0.0;
                outputs.right[i] = 0.0;
            }
            return;
        }

        // Process audio
        // We need to interleave CPU execution with SID sampling

        for i in 0..block_size {
            // Accumulate cycles for this sample
            self.cycle_accumulator += self.cycles_per_sample;

            // Run CPU cycles and clock the SID
            while self.cycle_accumulator >= 1.0 {
                let cycles_to_run = self.cycle_accumulator as u32;
                self.cycle_accumulator -= cycles_to_run as f64;

                // Check if we need to call the play routine
                self.frame_cycle_accumulator += cycles_to_run;
                if self.frame_cycle_accumulator >= self.cycles_per_frame {
                    self.frame_cycle_accumulator -= self.cycles_per_frame;
                    self.call_play();
                }

                // Apply any pending SID writes (from init or play)
                for i in 0..self.memory.sid_write_count() {
                    let (reg, value) = self.memory.get_sid_write(i);
                    self.sid.write(reg, value);
                }
                self.memory.clear_sid_writes();

                // Clock the SID
                self.sid.clock_delta(cycles_to_run);
            }

            // Get SID output
            let sample = self.sid.output();
            let normalized = sample as f32 / 32768.0;

            outputs.left[i] = normalized;
            outputs.right[i] = normalized; // SID is mono
        }
    }

    /// Call the play routine
    fn call_play(&mut self) {
        if self.header.play_address == 0 {
            // Play address 0 means the init routine set up an interrupt
            // For RSID files, we'd need to emulate the CIA timers
            // For now, just skip
            return;
        }

        // Create CPU and run play routine
        let mut cpu: CPU<C64Memory, Nmos6502> = CPU::new(self.memory.clone(), Nmos6502);

        // Initialize stack pointer
        cpu.registers.stack_pointer = StackPointer(0xFF);

        // Push return address onto stack (for RTS to return to $1000)
        let return_addr: u16 = 0x0FFF;
        let sp = cpu.registers.stack_pointer.0;
        cpu.memory.set_byte(0x0100 + sp as u16, (return_addr >> 8) as u8);
        cpu.registers.stack_pointer = StackPointer(sp.wrapping_sub(1));
        let sp = cpu.registers.stack_pointer.0;
        cpu.memory.set_byte(0x0100 + sp as u16, (return_addr & 0xFF) as u8);
        cpu.registers.stack_pointer = StackPointer(sp.wrapping_sub(1));

        cpu.registers.program_counter = self.header.play_address;

        // Run up to 20000 cycles for play (should be plenty)
        for _ in 0..20000 {
            cpu.single_step();
            if cpu.registers.program_counter == 0x1000 {
                break;
            }
        }

        // Get memory back
        self.memory = cpu.memory.clone();
    }
}

impl Clone for C64Memory {
    fn clone(&self) -> Self {
        Self {
            ram: self.ram,
            sid_writes: self.sid_writes,
            sid_write_count: self.sid_write_count,
        }
    }
}
