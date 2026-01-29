//! SID Player module.
//!
//! Plays .sid files from Commodore 64 using a 6502 CPU emulator and reSID.
//! This is a full SID player that executes the original 6502 code.

use crate::common::{sample_at, Sample};
use mos6502::cpu::CPU;
use mos6502::memory::Bus;
use mos6502::instruction::Nmos6502;
use mos6502::registers::{StackPointer, Status};
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

/// CIA1 base address
const CIA1_BASE: u16 = 0xDC00;

/// VIC-II base address
const VIC_BASE: u16 = 0xD000;

/// Cycles per raster line (PAL)
const CYCLES_PER_LINE: u32 = 63;
/// Total raster lines (PAL)
const TOTAL_LINES: u16 = 312;

/// VIC-II chip emulation (simplified for raster interrupts)
#[derive(Clone)]
pub struct Vic {
    // Raster position
    raster_line: u16,
    cycle_counter: u32,

    // Raster interrupt
    raster_compare: u16,  // Line to trigger interrupt ($D012 + bit 7 of $D011)
    raster_irq_enabled: bool,
    irq_pending: bool,
    irq_flag: bool,       // Set when raster matches, cleared by writing to $D019
}

impl Vic {
    pub fn new() -> Self {
        Self {
            raster_line: 0,
            cycle_counter: 0,
            raster_compare: 0,
            raster_irq_enabled: false,
            irq_pending: false,
            irq_flag: false,
        }
    }

    /// Tick the VIC by given number of cycles
    pub fn tick(&mut self, cycles: u32) {
        self.cycle_counter += cycles;

        while self.cycle_counter >= CYCLES_PER_LINE {
            self.cycle_counter -= CYCLES_PER_LINE;
            self.raster_line += 1;

            // Frame wrap-around
            if self.raster_line >= TOTAL_LINES {
                self.raster_line = 0;
            }

            // Trigger raster IRQ when line matches compare value (like real C64)
            if self.raster_irq_enabled && self.raster_line == self.raster_compare {
                self.irq_flag = true;
                self.irq_pending = true;
            }
        }
    }

    /// Read a VIC register
    pub fn read(&self, reg: u8) -> u8 {
        match reg {
            0x11 => {
                // $D011: Control + raster bit 8
                let raster_bit8 = if self.raster_line > 255 { 0x80 } else { 0 };
                raster_bit8 | 0x1B // Default control bits
            }
            0x12 => {
                // $D012: Current raster line (low 8 bits)
                (self.raster_line & 0xFF) as u8
            }
            0x19 => {
                // $D019: Interrupt status
                let mut val = 0;
                if self.irq_flag { val |= 0x01; }
                if self.irq_pending { val |= 0x80; }
                val
            }
            0x1A => {
                // $D01A: Interrupt enable
                if self.raster_irq_enabled { 0x01 } else { 0x00 }
            }
            _ => 0,
        }
    }

    /// Write a VIC register
    pub fn write(&mut self, reg: u8, value: u8) {
        match reg {
            0x11 => {
                // $D011: bit 7 is raster compare bit 8
                self.raster_compare = (self.raster_compare & 0x00FF) | (((value as u16) & 0x80) << 1);
            }
            0x12 => {
                // $D012: Raster compare low 8 bits
                self.raster_compare = (self.raster_compare & 0x0100) | value as u16;
            }
            0x19 => {
                // $D019: Acknowledge interrupts (write 1 to clear)
                if value & 0x01 != 0 {
                    self.irq_flag = false;
                }
            }
            0x1A => {
                // $D01A: Interrupt enable
                self.raster_irq_enabled = value & 0x01 != 0;
            }
            _ => {}
        }
    }

    /// Check and clear IRQ pending flag
    pub fn take_irq(&mut self) -> bool {
        if self.irq_pending {
            self.irq_pending = false;
            true
        } else {
            false
        }
    }
}

impl Default for Vic {
    fn default() -> Self {
        Self::new()
    }
}

/// CIA chip emulation (simplified for SID playback)
#[derive(Clone)]
pub struct Cia {
    // Timer A
    timer_a: u16,
    timer_a_latch: u16,
    timer_a_running: bool,
    timer_a_oneshot: bool,

    // Timer B
    timer_b: u16,
    timer_b_latch: u16,
    timer_b_running: bool,
    timer_b_oneshot: bool,

    // Interrupt control
    int_mask: u8,      // Which interrupts are enabled
    int_data: u8,      // Which interrupts have occurred
    irq_pending: bool, // IRQ needs to be triggered
}

impl Cia {
    pub fn new() -> Self {
        Self {
            timer_a: 0xFFFF,
            timer_a_latch: 0xFFFF,
            timer_a_running: false,
            timer_a_oneshot: false,
            timer_b: 0xFFFF,
            timer_b_latch: 0xFFFF,
            timer_b_running: false,
            timer_b_oneshot: false,
            int_mask: 0,
            int_data: 0,
            irq_pending: false,
        }
    }

    /// Tick the CIA timers by given number of cycles.
    /// Handles multiple underflows when cycles > timer value.
    pub fn tick(&mut self, cycles: u32) {
        // Timer A
        if self.timer_a_running {
            let mut remaining = cycles;
            while remaining > 0 {
                let current_val = self.timer_a as u32;
                if remaining > current_val {
                    remaining -= current_val + 1;
                    self.int_data |= 0x01;
                    if self.int_mask & 0x01 != 0 {
                        self.irq_pending = true;
                    }
                    if self.timer_a_oneshot {
                        self.timer_a_running = false;
                        self.timer_a = self.timer_a_latch;
                        break;
                    }
                    self.timer_a = self.timer_a_latch;
                } else {
                    self.timer_a -= remaining as u16;
                    remaining = 0;
                }
            }
        }

        // Timer B
        if self.timer_b_running {
            let mut remaining = cycles;
            while remaining > 0 {
                let current_val = self.timer_b as u32;
                if remaining > current_val {
                    remaining -= current_val + 1;
                    self.int_data |= 0x02;
                    if self.int_mask & 0x02 != 0 {
                        self.irq_pending = true;
                    }
                    if self.timer_b_oneshot {
                        self.timer_b_running = false;
                        self.timer_b = self.timer_b_latch;
                        break;
                    }
                    self.timer_b = self.timer_b_latch;
                } else {
                    self.timer_b -= remaining as u16;
                    remaining = 0;
                }
            }
        }
    }

    /// Read a CIA register
    pub fn read(&mut self, reg: u8) -> u8 {
        match reg {
            0x04 => self.timer_a as u8,
            0x05 => (self.timer_a >> 8) as u8,
            0x06 => self.timer_b as u8,
            0x07 => (self.timer_b >> 8) as u8,
            0x0D => {
                // Reading clears interrupt flags
                let val = self.int_data | if self.irq_pending { 0x80 } else { 0 };
                self.int_data = 0;
                self.irq_pending = false;
                val
            }
            0x0E => {
                let mut val = 0;
                if self.timer_a_running { val |= 0x01; }
                if self.timer_a_oneshot { val |= 0x08; }
                val
            }
            0x0F => {
                let mut val = 0;
                if self.timer_b_running { val |= 0x01; }
                if self.timer_b_oneshot { val |= 0x08; }
                val
            }
            _ => 0,
        }
    }

    /// Write a CIA register
    pub fn write(&mut self, reg: u8, value: u8) {
        match reg {
            0x04 => self.timer_a_latch = (self.timer_a_latch & 0xFF00) | value as u16,
            0x05 => self.timer_a_latch = (self.timer_a_latch & 0x00FF) | ((value as u16) << 8),
            0x06 => self.timer_b_latch = (self.timer_b_latch & 0xFF00) | value as u16,
            0x07 => self.timer_b_latch = (self.timer_b_latch & 0x00FF) | ((value as u16) << 8),
            0x0D => {
                // Interrupt control: bit 7 = set/clear, bits 0-4 = mask bits
                if value & 0x80 != 0 {
                    self.int_mask |= value & 0x1F;
                } else {
                    self.int_mask &= !(value & 0x1F);
                }
            }
            0x0E => {
                // Control Register A
                self.timer_a_oneshot = value & 0x08 != 0;
                if value & 0x10 != 0 {
                    // Force load
                    self.timer_a = self.timer_a_latch;
                }
                self.timer_a_running = value & 0x01 != 0;
            }
            0x0F => {
                // Control Register B
                self.timer_b_oneshot = value & 0x08 != 0;
                if value & 0x10 != 0 {
                    self.timer_b = self.timer_b_latch;
                }
                self.timer_b_running = value & 0x01 != 0;
            }
            _ => {}
        }
    }

    /// Check and clear IRQ pending flag
    pub fn take_irq(&mut self) -> bool {
        if self.irq_pending {
            self.irq_pending = false;
            true
        } else {
            false
        }
    }
}

impl Default for Cia {
    fn default() -> Self {
        Self::new()
    }
}

/// Voice state for visualization
#[derive(Clone, Copy, Default)]
pub struct VoiceState {
    pub frequency: u16,    // 0-65535
    pub gate: bool,        // Gate bit
    pub waveform: u8,      // 0=none, 1=tri, 2=saw, 4=pulse, 8=noise
    pub pulse_width: u16,  // 0-4095
    pub attack: u8,        // 0-15
    pub decay: u8,         // 0-15
    pub sustain: u8,       // 0-15
    pub release: u8,       // 0-15
}

/// C64 Memory with SID, CIA, and VIC intercept
pub struct C64Memory {
    ram: [u8; 65536],
    sid_writes: [(u8, u8); 256],
    sid_write_count: usize,
    sid_registers: [u8; 32],  // Track SID register values for visualization
    pub cia1: Cia,
    pub vic: Vic,
}

impl C64Memory {
    pub fn new() -> Self {
        Self {
            ram: [0; 65536],
            sid_writes: [(0, 0); 256],
            sid_write_count: 0,
            sid_registers: [0; 32],
            cia1: Cia::new(),
            vic: Vic::new(),
        }
    }

    /// Get voice state for visualization (voice 0, 1, or 2)
    pub fn get_voice_state(&self, voice: usize) -> VoiceState {
        if voice > 2 {
            return VoiceState::default();
        }
        let base = voice * 7; // Each voice uses 7 registers
        let freq_lo = self.sid_registers[base] as u16;
        let freq_hi = self.sid_registers[base + 1] as u16;
        let pw_lo = self.sid_registers[base + 2] as u16;
        let pw_hi = self.sid_registers[base + 3] as u16;
        let control = self.sid_registers[base + 4];
        let ad = self.sid_registers[base + 5];
        let sr = self.sid_registers[base + 6];

        VoiceState {
            frequency: freq_lo | (freq_hi << 8),
            gate: control & 0x01 != 0,
            waveform: (control >> 4) & 0x0F,
            pulse_width: (pw_lo | ((pw_hi & 0x0F) << 8)) & 0x0FFF,
            attack: (ad >> 4) & 0x0F,
            decay: ad & 0x0F,
            sustain: (sr >> 4) & 0x0F,
            release: sr & 0x0F,
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

        // IRQ vector - we'll set this dynamically for RSID
        self.ram[0xFFFE] = 0x04;
        self.ram[0xFFFF] = 0x10;
        self.ram[0x1004] = 0x40; // RTI (default, RSID will override $0314/$0315)
    }

    /// Install RSID-compatible KERNAL stubs.
    ///
    /// RSID tunes contain original C64 machine code that expects real KERNAL
    /// ROM routines at specific addresses. Without these stubs, a tune that
    /// ends its IRQ handler with `JMP $EA31` jumps into zeros (BRK),
    /// causing an infinite interrupt loop and crash.
    ///
    /// Real C64 IRQ flow:
    ///   Hardware → $FFFE → $FF48: PHA/TXA/PHA/TYA/PHA, JMP ($0314)
    ///   [user handler runs]
    ///   JMP $EA31: PLA/TAY/PLA/TAX/PLA, RTI
    fn install_rsid_kernal(&mut self) {
        // === KERNAL IRQ entry at $FF48 (real C64 address) ===
        // The 6502 hardware jumps here on IRQ (via $FFFE/$FFFF).
        // Saves A/X/Y, then dispatches through user vector $0314/$0315.
        self.ram[0xFF48] = 0x48; // PHA         — save A
        self.ram[0xFF49] = 0x8A; // TXA         — A = X
        self.ram[0xFF4A] = 0x48; // PHA         — save X
        self.ram[0xFF4B] = 0x98; // TYA         — A = Y
        self.ram[0xFF4C] = 0x48; // PHA         — save Y
        self.ram[0xFF4D] = 0x6C; // JMP ($0314) — dispatch to user IRQ handler
        self.ram[0xFF4E] = 0x14;
        self.ram[0xFF4F] = 0x03;

        // === KERNAL IRQ exit at $EA31 (real C64 address) ===
        // Standard return: restore Y/X/A and RTI.
        // Most RSID tunes end their handler with JMP $EA31.
        self.ram[0xEA31] = 0x68; // PLA         — pop Y value
        self.ram[0xEA32] = 0xA8; // TAY         — restore Y
        self.ram[0xEA33] = 0x68; // PLA         — pop X value
        self.ram[0xEA34] = 0xAA; // TAX         — restore X
        self.ram[0xEA35] = 0x68; // PLA         — restore A
        self.ram[0xEA36] = 0x40; // RTI         — pop Status + PC

        // === Short KERNAL exit at $EA81 (just RTI) ===
        self.ram[0xEA81] = 0x40; // RTI

        // === Hardware vectors ===
        self.ram[0xFFFA] = 0x81; // NMI  → $EA81 (just RTI)
        self.ram[0xFFFB] = 0xEA;
        self.ram[0xFFFC] = 0x00; // Reset → $1000
        self.ram[0xFFFD] = 0x10;
        self.ram[0xFFFE] = 0x48; // IRQ  → $FF48 (KERNAL entry)
        self.ram[0xFFFF] = 0xFF;

        // === User vectors (RAM) ===
        // $0314/$0315: IRQ user vector → $EA31 (default: just restore & RTI)
        self.ram[0x0314] = 0x31;
        self.ram[0x0315] = 0xEA;

        // === Return stub at $1000 ===
        // call_irq pushes $1000 as return address; we detect PC == $1000 to stop.
        self.ram[0x1000] = 0x60; // RTS (safety net, not normally reached)

        // === CIA1 Timer A — default 50Hz IRQ (PAL) ===
        // Fallback for tunes that don't configure their own timing.
        // 985248 Hz / 50 Hz = 19704 cycles = $4CF8
        self.cia1.timer_a_latch = 0x4CF8;
        self.cia1.timer_a = 0x4CF8;
        self.cia1.timer_a_running = true;
        self.cia1.timer_a_oneshot = false;
        self.cia1.int_mask = 0x01; // Enable Timer A interrupt
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
        // VIC-II reads ($D000-$D3FF, but we only care about $D000-$D02E)
        if address >= VIC_BASE && address < VIC_BASE + 0x40 {
            return self.vic.read((address - VIC_BASE) as u8);
        }
        // CIA1 reads
        if address >= CIA1_BASE && address < CIA1_BASE + 0x10 {
            return self.cia1.read((address - CIA1_BASE) as u8);
        }
        self.ram[address as usize]
    }

    fn set_byte(&mut self, address: u16, value: u8) {
        // Intercept SID writes
        if address >= SID_BASE && address <= SID_END {
            let reg = (address - SID_BASE) as u8;
            // Track register values for visualization
            if (reg as usize) < 32 {
                self.sid_registers[reg as usize] = value;
            }
            if self.sid_write_count < 256 {
                self.sid_writes[self.sid_write_count] = (reg, value);
                self.sid_write_count += 1;
            }
        }
        // VIC-II writes
        if address >= VIC_BASE && address < VIC_BASE + 0x40 {
            self.vic.write((address - VIC_BASE) as u8, value);
        }
        // CIA1 writes
        if address >= CIA1_BASE && address < CIA1_BASE + 0x10 {
            self.cia1.write((address - CIA1_BASE) as u8, value);
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

    // Persistent CPU state across IRQ calls (RSID needs this)
    // Real C64 has one CPU — registers persist between interrupts.
    irq_sp: u8,
    irq_a: u8,
    irq_x: u8,
    irq_y: u8,
    irq_status: u8,

    // Play state
    playing: bool,
    initialized: bool,
    current_chip_model: u8, // 0 = 6581, 1 = 8580

    // Reset input tracking
    prev_reset: f32,

    // Elapsed time tracking
    elapsed_samples: u64,
}

/// Parameters for SidPlayer
pub struct SidPlayerParams<'a> {
    /// Play/pause (0 = paused, 1 = playing)
    pub playing: &'a [Sample],
    /// Song number (1-based, clamped to available songs)
    pub song: &'a [Sample],
    /// Chip model (0 = 6581, 1 = 8580)
    pub chip_model: &'a [Sample],
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
    /// Voice 1 gate output (0.0 or 1.0)
    pub gate1: &'a mut [Sample],
    /// Voice 2 gate output (0.0 or 1.0)
    pub gate2: &'a mut [Sample],
    /// Voice 3 gate output (0.0 or 1.0)
    pub gate3: &'a mut [Sample],
    /// Voice 1 pitch CV output (V/Oct, C4 = 0V)
    pub cv1: &'a mut [Sample],
    /// Voice 2 pitch CV output (V/Oct, C4 = 0V)
    pub cv2: &'a mut [Sample],
    /// Voice 3 pitch CV output (V/Oct, C4 = 0V)
    pub cv3: &'a mut [Sample],
    /// Voice 1 waveform CV output (0=pulse, 1=saw, 2=tri, 3=noise)
    pub wf1: &'a mut [Sample],
    /// Voice 2 waveform CV output (0=pulse, 1=saw, 2=tri, 3=noise)
    pub wf2: &'a mut [Sample],
    /// Voice 3 waveform CV output (0=pulse, 1=saw, 2=tri, 3=noise)
    pub wf3: &'a mut [Sample],
}

/// Convert SID frequency register to V/Oct CV (C4 = 0V)
#[inline]
fn sid_freq_to_cv(freq_reg: u16, clock_freq: f64) -> Sample {
    if freq_reg == 0 {
        return -5.0;
    }
    let freq_hz = (freq_reg as f64) * clock_freq / 16777216.0;
    (freq_hz / 261.63).log2() as f32
}

/// Convert SID waveform bits (bits 4-7 of control register) to CV.
/// Priority if multiple bits set: noise > pulse > saw > tri.
/// Output: 0.0=pulse, 1.0=saw, 2.0=tri, 3.0=noise
#[inline]
fn sid_waveform_to_cv(waveform_bits: u8) -> Sample {
    if waveform_bits & 0x08 != 0 {
        3.0 // noise (bit 7 of control = bit 3 of waveform nibble)
    } else if waveform_bits & 0x04 != 0 {
        0.0 // pulse (bit 6 of control = bit 2 of waveform nibble)
    } else if waveform_bits & 0x02 != 0 {
        1.0 // sawtooth (bit 5 of control = bit 1 of waveform nibble)
    } else if waveform_bits & 0x01 != 0 {
        2.0 // triangle (bit 4 of control = bit 0 of waveform nibble)
    } else {
        0.0 // silence/none
    }
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
            irq_sp: 0xFF,
            irq_a: 0,
            irq_x: 0,
            irq_y: 0,
            irq_status: 0x00,
            playing: false,
            initialized: false,
            current_chip_model: 0,
            prev_reset: 0.0,
            elapsed_samples: 0,
        }
    }

    /// Reset playback to beginning (re-init song)
    pub fn reset(&mut self) {
        self.initialized = false;
        self.elapsed_samples = 0;
        // init_song will be called on next process if playing
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
        if header.is_rsid {
            self.memory.install_rsid_kernal();
        } else {
            self.memory.install_kernal();
        }
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

        // Capture CPU register state after init — RSID tunes may
        // leave meaningful state in registers for the IRQ handler
        self.irq_a = cpu.registers.accumulator;
        self.irq_x = cpu.registers.index_x;
        self.irq_y = cpu.registers.index_y;
        self.irq_status = cpu.registers.status.bits();
        self.irq_sp = cpu.registers.stack_pointer.0;

        // Reset timing for clean playback
        self.cycle_accumulator = 0.0;
        self.frame_cycle_accumulator = 0;
        self.elapsed_samples = 0;
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

    /// Get voice states for visualization
    /// Returns (freq, gate, waveform) for each of the 3 voices
    /// freq: 0-65535, gate: 0 or 1, waveform: 1=tri, 2=saw, 4=pulse, 8=noise
    pub fn get_voice_states(&self) -> [(u16, u8, u8); 3] {
        let v0 = self.memory.get_voice_state(0);
        let v1 = self.memory.get_voice_state(1);
        let v2 = self.memory.get_voice_state(2);
        [
            (v0.frequency, v0.gate as u8, v0.waveform),
            (v1.frequency, v1.gate as u8, v1.waveform),
            (v2.frequency, v2.gate as u8, v2.waveform),
        ]
    }

    /// Get elapsed playback time in seconds
    pub fn elapsed_seconds(&self) -> f32 {
        self.elapsed_samples as f32 / self.sample_rate
    }

    /// Process a block of audio
    pub fn process_block(
        &mut self,
        outputs: SidPlayerOutputs,
        inputs: SidPlayerInputs,
        params: SidPlayerParams,
    ) {
        // Check for reset trigger (rising edge detection)
        if let Some(reset_buf) = inputs.reset {
            let reset_val = sample_at(reset_buf, 0, 0.0);
            if reset_val > 0.5 && self.prev_reset <= 0.5 {
                // Rising edge detected - reset playback
                self.reset();
            }
            self.prev_reset = reset_val;
        }
        let block_size = outputs.left.len();

        // Handle params
        let should_play = sample_at(params.playing, 0, 0.0) > 0.5;
        let song = sample_at(params.song, 0, 1.0) as u16;
        let chip_model = if sample_at(params.chip_model, 0, 0.0) > 0.5 {
            ChipModel::Mos8580
        } else {
            ChipModel::Mos6581
        };

        // Update song if changed
        self.set_song(song);

        // Update chip model if changed
        self.set_chip_model(chip_model);

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
                outputs.gate1[i] = 0.0;
                outputs.gate2[i] = 0.0;
                outputs.gate3[i] = 0.0;
                outputs.cv1[i] = 0.0;
                outputs.cv2[i] = 0.0;
                outputs.cv3[i] = 0.0;
                outputs.wf1[i] = 0.0;
                outputs.wf2[i] = 0.0;
                outputs.wf3[i] = 0.0;
            }
            return;
        }

        // Process audio
        // We need to interleave CPU execution with SID sampling
        let is_rsid = self.header.is_rsid;
        let clock_freq = if self.header.is_pal { C64_CLOCK_PAL } else { C64_CLOCK_NTSC } as f64;

        for i in 0..block_size {
            // Accumulate cycles for this sample
            self.cycle_accumulator += self.cycles_per_sample;

            // Run CPU cycles and clock the SID
            while self.cycle_accumulator >= 1.0 {
                let cycles_to_run = self.cycle_accumulator as u32;
                self.cycle_accumulator -= cycles_to_run as f64;

                if is_rsid {
                    // RSID: Tick CIA timers and VIC raster, check for IRQ
                    self.memory.cia1.tick(cycles_to_run);
                    self.memory.vic.tick(cycles_to_run);

                    // Check for IRQ from either CIA or VIC
                    // Both must be evaluated — short-circuit would skip VIC acknowledgment
                    let cia_irq = self.memory.cia1.take_irq();
                    let vic_irq = self.memory.vic.take_irq();
                    if cia_irq || vic_irq {
                        self.call_irq();
                    }
                } else {
                    // PSID: Check if we need to call the play routine at frame rate
                    self.frame_cycle_accumulator += cycles_to_run;
                    if self.frame_cycle_accumulator >= self.cycles_per_frame {
                        self.frame_cycle_accumulator -= self.cycles_per_frame;
                        self.call_play();
                    }

                    // Tick timers even in PSID mode — some tunes read CIA
                    // registers for RNG or noise waveform generation
                    self.memory.cia1.tick(cycles_to_run);
                    self.memory.vic.tick(cycles_to_run);
                }

                // Apply any pending SID writes (from init or play)
                for j in 0..self.memory.sid_write_count() {
                    let (reg, value) = self.memory.get_sid_write(j);
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

            // Output voice gate and CV
            let v0 = self.memory.get_voice_state(0);
            let v1 = self.memory.get_voice_state(1);
            let v2 = self.memory.get_voice_state(2);

            outputs.gate1[i] = if v0.gate { 1.0 } else { 0.0 };
            outputs.gate2[i] = if v1.gate { 1.0 } else { 0.0 };
            outputs.gate3[i] = if v2.gate { 1.0 } else { 0.0 };

            outputs.cv1[i] = sid_freq_to_cv(v0.frequency, clock_freq);
            outputs.cv2[i] = sid_freq_to_cv(v1.frequency, clock_freq);
            outputs.cv3[i] = sid_freq_to_cv(v2.frequency, clock_freq);

            outputs.wf1[i] = sid_waveform_to_cv(v0.waveform);
            outputs.wf2[i] = sid_waveform_to_cv(v1.waveform);
            outputs.wf3[i] = sid_waveform_to_cv(v2.waveform);

            // Track elapsed time
            self.elapsed_samples += 1;
        }
    }

    /// Call the play routine (PSID only)
    fn call_play(&mut self) {
        if self.header.play_address == 0 {
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

    /// Handle IRQ for RSID files
    fn call_irq(&mut self) {
        // Save VIC timing state — the CPU clone doesn't tick VIC/CIA,
        // so we must preserve external timing counters.
        // CIA timers are NOT saved: the 6502 IRQ handler may reprogram
        // them (e.g. Hülsbeck's dynamic timer modulation in Giana Sisters).
        let vic_cycle_counter = self.memory.vic.cycle_counter;
        let vic_raster_line = self.memory.vic.raster_line;

        // Create CPU with current memory, restore ALL persistent register state.
        // Real C64 has one CPU — registers persist between interrupts.
        let mut cpu: CPU<C64Memory, Nmos6502> = CPU::new(self.memory.clone(), Nmos6502);
        cpu.registers.stack_pointer = StackPointer(self.irq_sp);
        cpu.registers.accumulator = self.irq_a;
        cpu.registers.index_x = self.irq_x;
        cpu.registers.index_y = self.irq_y;
        cpu.registers.status = Status::from_bits_truncate(self.irq_status);

        // Push return address and status for RTI (mimics 6502 IRQ sequence)
        // We want to return to $1000 after RTI
        let sp = cpu.registers.stack_pointer.0;
        cpu.memory.set_byte(0x0100 + sp as u16, 0x10); // PCH = $10
        cpu.registers.stack_pointer = StackPointer(sp.wrapping_sub(1));
        let sp = cpu.registers.stack_pointer.0;
        cpu.memory.set_byte(0x0100 + sp as u16, 0x00); // PCL = $00
        cpu.registers.stack_pointer = StackPointer(sp.wrapping_sub(1));
        let sp = cpu.registers.stack_pointer.0;
        // Push actual status register (with B=0 as per real IRQ, not BRK)
        cpu.memory.set_byte(0x0100 + sp as u16, self.irq_status & !0x10);
        cpu.registers.stack_pointer = StackPointer(sp.wrapping_sub(1));

        // Set I flag (disable interrupts) as the real 6502 does on IRQ entry
        cpu.registers.status.insert(Status::PS_DISABLE_INTERRUPTS);

        // Read IRQ vector from $FFFE/$FFFF
        let irq_lo = cpu.memory.get_byte(0xFFFE);
        let irq_hi = cpu.memory.get_byte(0xFFFF);
        let irq_addr = (irq_hi as u16) << 8 | irq_lo as u16;
        cpu.registers.program_counter = irq_addr;

        // Run until we hit RTI and return to $1000
        for _ in 0..50000 {
            cpu.single_step();
            if cpu.registers.program_counter == 0x1000 {
                break;
            }
        }

        // Persist ALL CPU registers for next IRQ call
        self.irq_sp = cpu.registers.stack_pointer.0;
        self.irq_a = cpu.registers.accumulator;
        self.irq_x = cpu.registers.index_x;
        self.irq_y = cpu.registers.index_y;
        self.irq_status = cpu.registers.status.bits();

        // Get memory back — CIA timer modifications by the 6502 are preserved
        self.memory = cpu.memory.clone();

        // Restore only VIC timing (external counters not ticked by CPU clone)
        self.memory.vic.cycle_counter = vic_cycle_counter;
        self.memory.vic.raster_line = vic_raster_line;
    }
}

impl Clone for C64Memory {
    fn clone(&self) -> Self {
        Self {
            ram: self.ram,
            sid_writes: self.sid_writes,
            sid_write_count: self.sid_write_count,
            sid_registers: self.sid_registers,
            cia1: self.cia1.clone(),
            vic: self.vic.clone(),
        }
    }
}
