//! IPC bridge between NoobSynth VST and Tauri UI via shared memory
//! Build timestamp: 2025-12-31T12:00:00
//!
//! Architecture:
//! - Tauri UI writes commands (setParam, noteOn, setGraph, etc.)
//! - VST reads commands and processes audio
//! - Both sides can read shared state (params, voice status)

use shared_memory::{Shmem, ShmemConf, ShmemError};
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};

/// Shared memory identifier
pub const SHM_NAME: &str = "noobsynth_ipc_v1";

fn shm_name(instance_id: Option<&str>) -> String {
    match instance_id {
        Some(id) if !id.is_empty() => format!("{SHM_NAME}_{id}"),
        _ => SHM_NAME.to_string(),
    }
}

/// Magic number to verify shared memory is valid
pub const MAGIC: u32 = 0x4E4F4F42; // "NOOB"

/// Version of the IPC protocol
pub const VERSION: u32 = 3;

/// Maximum voices supported
pub const MAX_VOICES: usize = 16;

/// Size of the command ring buffer
pub const CMD_RING_SIZE: usize = 256;

/// Size of the graph JSON buffer
pub const GRAPH_BUFFER_SIZE: usize = 64 * 1024; // 64KB for graph JSON

// ============================================================================
// Shared Data Structures (raw repr(C) for memory mapping)
// ============================================================================

/// Header at the start of shared memory
#[repr(C)]
pub struct SharedHeader {
    pub magic: u32,
    pub version: u32,
    /// Flags: bit 0 = VST connected, bit 1 = Tauri connected
    pub flags: AtomicU32,
    pub _pad0: u32,
    /// Monotonic counter incremented by Tauri when params change
    pub param_version: AtomicU64,
    /// Monotonic counter incremented by VST when params change
    pub vst_param_version: AtomicU64,
    /// Monotonic counter incremented by Tauri when graph changes
    pub graph_version: AtomicU64,
    /// Monotonic counter incremented by VST when graph changes
    pub vst_graph_version: AtomicU64,
    /// Sample rate set by VST
    pub sample_rate: AtomicU32,
    pub _pad1: u32,
}

/// Synth parameters (shared between VST and Tauri)
#[derive(Clone, Copy, Default)]
#[repr(C)]
pub struct SharedParams {
    pub macros: [f32; 8],
    pub _padding: [f32; 8], // Align to 64 bytes
}

/// Voice state for a single voice
#[derive(Clone, Copy, Default)]
#[repr(C)]
pub struct VoiceState {
    /// CV value (pitch as V/Oct from middle C)
    pub cv: f32,
    /// Gate value (0.0 or 1.0)
    pub gate: f32,
    /// Velocity (0.0 to 1.0)
    pub velocity: f32,
    /// MIDI note number (0-127, 255 = none)
    pub note: u8,
    pub _padding: [u8; 3],
}

/// Command types
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum CommandType {
    None = 0,
    /// Set a single parameter: module_id, param_id, value
    SetParam = 1,
    /// Note on: voice, note, velocity
    NoteOn = 2,
    /// Note off: voice, note
    NoteOff = 3,
    /// Set graph JSON (read from graph_buffer)
    SetGraph = 4,
    /// Trigger gate for voice
    TriggerGate = 5,
    /// Release gate for voice
    ReleaseGate = 6,
    /// Set voice CV
    SetVoiceCv = 7,
    /// Set voice velocity
    SetVoiceVelocity = 8,
}

impl From<u8> for CommandType {
    fn from(v: u8) -> Self {
        match v {
            1 => CommandType::SetParam,
            2 => CommandType::NoteOn,
            3 => CommandType::NoteOff,
            4 => CommandType::SetGraph,
            5 => CommandType::TriggerGate,
            6 => CommandType::ReleaseGate,
            7 => CommandType::SetVoiceCv,
            8 => CommandType::SetVoiceVelocity,
            _ => CommandType::None,
        }
    }
}

/// A command slot in the ring buffer
#[derive(Clone, Copy, Default)]
#[repr(C)]
pub struct CommandSlot {
    /// Command type (CommandType as u8)
    pub cmd_type: u8,
    /// Voice index (for voice commands)
    pub voice: u8,
    /// MIDI note (for note commands)
    pub note: u8,
    /// Flags
    pub flags: u8,
    /// Generic float value
    pub value: f32,
    /// Module ID hash (for setParam)
    pub module_id: u32,
    /// Param ID hash (for setParam)
    pub param_id: u32,
    /// Extra data
    pub extra: u32,
}

/// Command ring buffer header (positions stored separately for atomicity)
#[repr(C)]
pub struct CommandRingHeader {
    /// Write position (Tauri increments)
    pub write_pos: AtomicU64,
    /// Read position (VST increments)
    pub read_pos: AtomicU64,
}

/// Complete shared memory layout
#[repr(C)]
pub struct SharedMemoryLayout {
    pub header: SharedHeader,
    pub params: SharedParams,
    pub voices: [VoiceState; MAX_VOICES],
    pub ring_header: CommandRingHeader,
    pub ring_slots: [CommandSlot; CMD_RING_SIZE],
    /// Buffer for graph JSON (null-terminated)
    pub graph_buffer: [u8; GRAPH_BUFFER_SIZE],
    /// Buffer for string data (module names, param names)
    pub string_buffer: [u8; 4096],
    /// String buffer write position
    pub string_pos: AtomicU32,
}

// Calculate total size
pub const SHARED_MEM_SIZE: usize = std::mem::size_of::<SharedMemoryLayout>();

// ============================================================================
// VST-side Bridge
// ============================================================================

/// VST-side of the IPC bridge
pub struct VstBridge {
    shmem: Shmem,
    last_param_version: u64,
    last_graph_version: u64,
}

// SAFETY: Shmem is thread-safe by design - it's shared memory with atomic
// synchronization primitives. The raw pointer inside is just an implementation
// detail of the OS mapping.
unsafe impl Send for VstBridge {}
unsafe impl Sync for VstBridge {}

impl VstBridge {
    /// Create or open the shared memory segment
    pub fn new() -> Result<Self, ShmemError> {
        Self::new_with_id(None)
    }

    /// Create or open the shared memory segment for a specific instance
    pub fn new_with_id(instance_id: Option<&str>) -> Result<Self, ShmemError> {
        let os_id = shm_name(instance_id);
        let shmem = ShmemConf::new()
            .size(SHARED_MEM_SIZE)
            .os_id(&os_id)
            .create()?;

        // Initialize if we created it OR if magic is wrong (stale memory)
        unsafe {
            let ptr = shmem.as_ptr() as *mut SharedMemoryLayout;
            if shmem.is_owner()
                || (*ptr).header.magic != MAGIC
                || (*ptr).header.version != VERSION
            {
                std::ptr::write_bytes(ptr, 0, 1);
                (*ptr).header.magic = MAGIC;
                (*ptr).header.version = VERSION;
                (*ptr).params = SharedParams {
                    macros: [0.0; 8],
                    _padding: [0.0; 8],
                };
            }
        }

        // Clear all flags first (removes stale Tauri flag from previous session)
        // Then mark VST as connected
        unsafe {
            let layout = shmem.as_ptr() as *mut SharedMemoryLayout;
            (*layout).header.flags.store(1, Ordering::SeqCst); // Only VST connected
        }

        Ok(Self {
            shmem,
            last_param_version: 0,
            last_graph_version: 0,
        })
    }

    /// Open existing shared memory (created by Tauri)
    pub fn open() -> Result<Self, ShmemError> {
        Self::open_with_id(None)
    }

    /// Open existing shared memory (created by Tauri) for a specific instance
    pub fn open_with_id(instance_id: Option<&str>) -> Result<Self, ShmemError> {
        let os_id = shm_name(instance_id);
        let shmem = ShmemConf::new()
            .os_id(&os_id)
            .open()?;

        // Verify magic/version, reinitialize if stale
        unsafe {
            let layout = shmem.as_ptr() as *const SharedMemoryLayout;
            if (*layout).header.magic != MAGIC || (*layout).header.version != VERSION {
                let layout = shmem.as_ptr() as *mut SharedMemoryLayout;
                std::ptr::write_bytes(layout, 0, 1);
                (*layout).header.magic = MAGIC;
                (*layout).header.version = VERSION;
                (*layout).params = SharedParams {
                    macros: [0.0; 8],
                    _padding: [0.0; 8],
                };
            }
            let layout = shmem.as_ptr() as *mut SharedMemoryLayout;
            // Clear all flags and set only VST connected (removes stale Tauri flag)
            (*layout).header.flags.store(1, Ordering::SeqCst);
        }

        Ok(Self {
            shmem,
            last_param_version: 0,
            last_graph_version: 0,
        })
    }

    /// Get reference to shared layout
    fn layout(&self) -> &SharedMemoryLayout {
        unsafe { &*(self.shmem.as_ptr() as *const SharedMemoryLayout) }
    }

    /// Get mutable reference to shared layout
    fn layout_mut(&mut self) -> &mut SharedMemoryLayout {
        unsafe { &mut *(self.shmem.as_ptr() as *mut SharedMemoryLayout) }
    }

    /// Check if params have changed
    pub fn params_changed(&mut self) -> bool {
        let current = self.layout().header.param_version.load(Ordering::Acquire);
        if current != self.last_param_version {
            self.last_param_version = current;
            true
        } else {
            false
        }
    }

    /// Check if graph has changed, return the new JSON if so
    pub fn graph_changed(&mut self) -> Option<String> {
        let current = self.layout().header.graph_version.load(Ordering::Acquire);
        if current != self.last_graph_version {
            self.last_graph_version = current;
            // Read graph JSON from buffer
            let layout = self.layout();
            let end = layout.graph_buffer.iter().position(|&b| b == 0).unwrap_or(GRAPH_BUFFER_SIZE);
            String::from_utf8(layout.graph_buffer[..end].to_vec()).ok()
        } else {
            None
        }
    }

    /// Read current params
    pub fn params(&self) -> SharedParams {
        self.layout().params
    }

    /// Write params from VST for the UI to read
    pub fn set_vst_params(&mut self, params: SharedParams) {
        let layout = self.layout_mut();
        layout.params = params;
        layout
            .header
            .vst_param_version
            .fetch_add(1, Ordering::Release);
    }

    /// Write graph JSON from VST for the UI to read
    pub fn set_vst_graph(&mut self, json: &str) {
        let layout = self.layout_mut();
        let bytes = json.as_bytes();
        let len = bytes.len().min(GRAPH_BUFFER_SIZE - 1);
        layout.graph_buffer[..len].copy_from_slice(&bytes[..len]);
        layout.graph_buffer[len] = 0;
        layout.header.vst_graph_version.fetch_add(1, Ordering::Release);
    }

    /// Pop next command from ring buffer
    pub fn pop_command(&mut self) -> Option<CommandSlot> {
        let layout = self.layout_mut();
        let write_pos = layout.ring_header.write_pos.load(Ordering::Acquire);
        let read_pos = layout.ring_header.read_pos.load(Ordering::Relaxed);

        if read_pos >= write_pos {
            return None;
        }

        let index = (read_pos as usize) % CMD_RING_SIZE;
        let cmd = layout.ring_slots[index];
        layout.ring_header.read_pos.store(read_pos + 1, Ordering::Release);

        if cmd.cmd_type == CommandType::None as u8 {
            None
        } else {
            Some(cmd)
        }
    }

    /// Read a string from the string buffer at given offset
    pub fn read_string(&self, offset: u32, len: u32) -> Option<String> {
        let layout = self.layout();
        let start = offset as usize;
        let end = start + len as usize;
        if end <= layout.string_buffer.len() {
            String::from_utf8(layout.string_buffer[start..end].to_vec()).ok()
        } else {
            None
        }
    }

    /// Set sample rate (called by VST)
    pub fn set_sample_rate(&mut self, rate: u32) {
        self.layout_mut().header.sample_rate.store(rate, Ordering::Release);
    }

    /// Check if Tauri UI is connected
    pub fn is_ui_connected(&self) -> bool {
        self.layout().header.flags.load(Ordering::Relaxed) & 2 != 0
    }
}

impl Drop for VstBridge {
    fn drop(&mut self) {
        // Clear VST connected flag
        unsafe {
            let layout = self.shmem.as_ptr() as *mut SharedMemoryLayout;
            (*layout).header.flags.fetch_and(!1, Ordering::SeqCst);
        }
    }
}

// ============================================================================
// Tauri-side Bridge
// ============================================================================

/// Tauri-side of the IPC bridge
pub struct TauriBridge {
    shmem: Shmem,
}

// SAFETY: Shmem is thread-safe by design - it's shared memory with atomic
// synchronization primitives. The raw pointer inside is just an implementation
// detail of the OS mapping.
unsafe impl Send for TauriBridge {}
unsafe impl Sync for TauriBridge {}

impl TauriBridge {
    /// Create the shared memory segment
    pub fn new() -> Result<Self, ShmemError> {
        Self::new_with_id(None)
    }

    /// Create the shared memory segment for a specific instance
    pub fn new_with_id(instance_id: Option<&str>) -> Result<Self, ShmemError> {
        let os_id = shm_name(instance_id);
        let shmem = ShmemConf::new()
            .size(SHARED_MEM_SIZE)
            .os_id(&os_id)
            .create()?;

        // Initialize
        unsafe {
            let ptr = shmem.as_ptr() as *mut SharedMemoryLayout;
            std::ptr::write_bytes(ptr, 0, 1);
            (*ptr).header.magic = MAGIC;
            (*ptr).header.version = VERSION;
            (*ptr).params = SharedParams {
                macros: [0.0; 8],
                _padding: [0.0; 8],
            };
            // Mark Tauri as connected
            (*ptr).header.flags.store(2, Ordering::SeqCst);
        }

        Ok(Self { shmem })
    }

    /// Open existing shared memory
    pub fn open() -> Result<Self, ShmemError> {
        Self::open_with_id(None)
    }

    /// Open existing shared memory for a specific instance
    pub fn open_with_id(instance_id: Option<&str>) -> Result<Self, ShmemError> {
        let os_id = shm_name(instance_id);
        let shmem = ShmemConf::new()
            .os_id(&os_id)
            .open()?;

        // Verify magic, reinitialize if wrong (stale from previous session)
        unsafe {
            let layout = shmem.as_ptr() as *mut SharedMemoryLayout;
            if (*layout).header.magic != MAGIC || (*layout).header.version != VERSION {
                // Stale shared memory - reinitialize it
                eprintln!("[NoobSynth IPC] Reinitializing stale shared memory");
                std::ptr::write_bytes(layout, 0, 1);
                (*layout).header.magic = MAGIC;
                (*layout).header.version = VERSION;
                (*layout).params = SharedParams {
                    macros: [0.0; 8],
                    _padding: [0.0; 8],
                };
            }
            (*layout).header.flags.fetch_or(2, Ordering::SeqCst);
        }

        Ok(Self { shmem })
    }

    fn layout_mut(&mut self) -> &mut SharedMemoryLayout {
        unsafe { &mut *(self.shmem.as_ptr() as *mut SharedMemoryLayout) }
    }

    fn layout(&self) -> &SharedMemoryLayout {
        unsafe { &*(self.shmem.as_ptr() as *const SharedMemoryLayout) }
    }

    /// Push a command to the ring buffer
    fn push_command(&mut self, cmd: CommandSlot) -> bool {
        let layout = self.layout_mut();
        let write_pos = layout.ring_header.write_pos.load(Ordering::Relaxed);
        let read_pos = layout.ring_header.read_pos.load(Ordering::Acquire);

        // Check if buffer is full
        if write_pos.wrapping_sub(read_pos) >= CMD_RING_SIZE as u64 {
            return false;
        }

        let index = (write_pos as usize) % CMD_RING_SIZE;
        layout.ring_slots[index] = cmd;
        layout.ring_header.write_pos.store(write_pos.wrapping_add(1), Ordering::Release);
        true
    }

    /// Write a string to the string buffer, return offset and length
    fn write_string(&mut self, s: &str) -> (u32, u32) {
        let layout = self.layout_mut();
        let bytes = s.as_bytes();
        let len = bytes.len().min(layout.string_buffer.len());

        let pos = layout.string_pos.load(Ordering::Relaxed) as usize;
        let new_pos = (pos + len) % layout.string_buffer.len();

        // Handle wraparound
        if pos + len <= layout.string_buffer.len() {
            layout.string_buffer[pos..pos + len].copy_from_slice(&bytes[..len]);
        } else {
            let first_part = layout.string_buffer.len() - pos;
            layout.string_buffer[pos..].copy_from_slice(&bytes[..first_part]);
            layout.string_buffer[..len - first_part].copy_from_slice(&bytes[first_part..len]);
        }

        layout.string_pos.store(new_pos as u32, Ordering::Release);
        (pos as u32, len as u32)
    }

    /// Set a parameter by name
    pub fn set_param(&mut self, module_id: &str, param_id: &str, value: f32) {
        let module_hash = hash_id(module_id);
        let param_hash = hash_id(param_id);

        // Also write the strings for debugging/lookup
        let (mod_off, mod_len) = self.write_string(module_id);
        let (_param_off, _param_len) = self.write_string(param_id);

        self.push_command(CommandSlot {
            cmd_type: CommandType::SetParam as u8,
            voice: 0,
            note: 0,
            flags: 0,
            value,
            module_id: module_hash,
            param_id: param_hash,
            extra: (mod_off << 16) | mod_len, // Pack offset and length
        });
    }

    /// Send note on
    pub fn note_on(&mut self, voice: u8, note: u8, velocity: f32) {
        self.push_command(CommandSlot {
            cmd_type: CommandType::NoteOn as u8,
            voice,
            note,
            flags: 0,
            value: velocity,
            module_id: 0,
            param_id: 0,
            extra: 0,
        });
    }

    /// Send note off
    pub fn note_off(&mut self, voice: u8, note: u8) {
        self.push_command(CommandSlot {
            cmd_type: CommandType::NoteOff as u8,
            voice,
            note,
            flags: 0,
            value: 0.0,
            module_id: 0,
            param_id: 0,
            extra: 0,
        });
    }

    /// Set voice CV
    pub fn set_voice_cv(&mut self, voice: u8, cv: f32) {
        self.push_command(CommandSlot {
            cmd_type: CommandType::SetVoiceCv as u8,
            voice,
            note: 0,
            flags: 0,
            value: cv,
            module_id: 0,
            param_id: 0,
            extra: 0,
        });
    }

    /// Set voice velocity
    pub fn set_voice_velocity(&mut self, voice: u8, velocity: f32) {
        self.push_command(CommandSlot {
            cmd_type: CommandType::SetVoiceVelocity as u8,
            voice,
            note: 0,
            flags: 0,
            value: velocity,
            module_id: 0,
            param_id: 0,
            extra: 0,
        });
    }

    /// Trigger gate for voice
    pub fn trigger_gate(&mut self, voice: u8) {
        self.push_command(CommandSlot {
            cmd_type: CommandType::TriggerGate as u8,
            voice,
            note: 0,
            flags: 0,
            value: 1.0,
            module_id: 0,
            param_id: 0,
            extra: 0,
        });
    }

    /// Release gate for voice
    pub fn release_gate(&mut self, voice: u8) {
        self.push_command(CommandSlot {
            cmd_type: CommandType::ReleaseGate as u8,
            voice,
            note: 0,
            flags: 0,
            value: 0.0,
            module_id: 0,
            param_id: 0,
            extra: 0,
        });
    }

    /// Set graph JSON
    pub fn set_graph(&mut self, json: &str) {
        let layout = self.layout_mut();
        let bytes = json.as_bytes();
        let len = bytes.len().min(GRAPH_BUFFER_SIZE - 1);
        layout.graph_buffer[..len].copy_from_slice(&bytes[..len]);
        layout.graph_buffer[len] = 0; // Null terminate
        layout.header.graph_version.fetch_add(1, Ordering::Release);

        // Also push a command to signal the change
        self.push_command(CommandSlot {
            cmd_type: CommandType::SetGraph as u8,
            voice: 0,
            note: 0,
            flags: 0,
            value: 0.0,
            module_id: 0,
            param_id: 0,
            extra: len as u32,
        });
    }

    /// Read graph JSON written by the VST
    pub fn read_vst_graph(&self) -> Option<String> {
        let layout = self.layout();
        let end = layout
            .graph_buffer
            .iter()
            .position(|&b| b == 0)
            .unwrap_or(GRAPH_BUFFER_SIZE);
        if end == 0 {
            return None;
        }
        String::from_utf8(layout.graph_buffer[..end].to_vec()).ok()
    }

    /// Read current params
    pub fn params(&self) -> SharedParams {
        self.layout().params
    }

    /// Read the current VST graph version
    pub fn vst_graph_version(&self) -> u64 {
        self.layout()
            .header
            .vst_graph_version
            .load(Ordering::Acquire)
    }

    /// Read the current VST param version
    pub fn vst_param_version(&self) -> u64 {
        self.layout()
            .header
            .vst_param_version
            .load(Ordering::Acquire)
    }

    /// Update shared params
    pub fn set_params(&mut self, params: SharedParams) {
        let layout = self.layout_mut();
        layout.params = params;
        layout.header.param_version.fetch_add(1, Ordering::Release);
    }

    /// Check if VST is connected
    pub fn is_vst_connected(&self) -> bool {
        self.layout().header.flags.load(Ordering::Relaxed) & 1 != 0
    }

    /// Check if Tauri UI is connected
    pub fn is_tauri_connected(&self) -> bool {
        self.layout().header.flags.load(Ordering::Relaxed) & 2 != 0
    }

    /// Get sample rate from VST
    pub fn sample_rate(&self) -> u32 {
        self.layout().header.sample_rate.load(Ordering::Relaxed)
    }
}

impl Drop for TauriBridge {
    fn drop(&mut self) {
        // Clear Tauri connected flag
        unsafe {
            let layout = self.shmem.as_ptr() as *mut SharedMemoryLayout;
            (*layout).header.flags.fetch_and(!2, Ordering::SeqCst);
        }
    }
}

// ============================================================================
// Module/Param ID hashing (for compact command representation)
// ============================================================================

/// Simple hash for module/param IDs (fits in u32)
pub fn hash_id(s: &str) -> u32 {
    let mut hash: u32 = 5381;
    for byte in s.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(byte as u32);
    }
    hash
}

// ============================================================================
// Auto-launch utilities
// ============================================================================

#[cfg(windows)]
pub mod launcher {
    use std::path::PathBuf;
    use std::process::Command;
    use std::io::Write;

    /// Executable names to search for (in order of preference)
    const EXE_NAMES: &[&str] = &["noobsynth3.exe", "NoobSynth.exe", "app.exe"];

    /// Write debug message to log file
    fn log_debug(msg: &str) {
        eprintln!("{}", msg);
        // Also write to file for debugging
        if let Some(dir) = get_dll_directory() {
            let log_path = dir.join("noobsynth_vst_debug.log");
            if let Ok(mut file) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
            {
                let _ = writeln!(file, "{}", msg);
            }
        }
    }

    /// Get the directory containing this DLL using Windows API
    fn get_dll_directory() -> Option<PathBuf> {
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;

        // Get handle to this DLL
        let mut module: *mut std::ffi::c_void = std::ptr::null_mut();
        let address = get_dll_directory as *const ();

        // GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT
        const FLAGS: u32 = 0x00000004 | 0x00000002;

        let success = unsafe {
            GetModuleHandleExW(FLAGS, address as *const u16, &mut module as *mut _ as *mut *mut std::ffi::c_void)
        };

        if success == 0 || module.is_null() {
            return None;
        }

        // Get the module filename
        let mut buffer = [0u16; 512];
        let len = unsafe { GetModuleFileNameW(module, buffer.as_mut_ptr(), buffer.len() as u32) };

        if len == 0 || len >= buffer.len() as u32 {
            return None;
        }

        let path = OsString::from_wide(&buffer[..len as usize]);
        let path = PathBuf::from(path);
        path.parent().map(|p| p.to_path_buf())
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GetModuleHandleExW(flags: u32, module_name: *const u16, module: *mut *mut std::ffi::c_void) -> i32;
        fn GetModuleFileNameW(module: *mut std::ffi::c_void, filename: *mut u16, size: u32) -> u32;
    }

    /// Find the Tauri app executable relative to the VST DLL
    pub fn find_tauri_exe() -> Option<PathBuf> {
        // Try to get DLL directory first, fall back to exe directory
        let dll_dir = get_dll_directory();
        let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf()));

        // Build list of candidate paths
        let mut candidates = Vec::new();

        // Try DLL directory first (most likely location)
        if let Some(ref dir) = dll_dir {
            for exe_name in EXE_NAMES {
                candidates.push(dir.join(exe_name));
            }
            // Also try parent of DLL dir
            if let Some(parent) = dir.parent() {
                for exe_name in EXE_NAMES {
                    candidates.push(parent.join(exe_name));
                }
            }
        }

        // Try exe directory as fallback
        if let Some(ref dir) = exe_dir {
            for exe_name in EXE_NAMES {
                candidates.push(dir.join(exe_name));
            }
        }

        // Also try standard install locations
        candidates.push(PathBuf::from(r"C:\Program Files\NoobSynth\noobsynth3.exe"));
        candidates.push(PathBuf::from(r"C:\Program Files\NoobSynth\NoobSynth.exe"));
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            candidates.push(PathBuf::from(&local_app_data).join("NoobSynth").join("noobsynth3.exe"));
            candidates.push(PathBuf::from(&local_app_data).join("NoobSynth").join("NoobSynth.exe"));
        }

        log_debug(&format!("[NoobSynth VST] DLL directory: {:?}", get_dll_directory()));
        log_debug(&format!("[NoobSynth VST] Searching for executable in {} candidates", candidates.len()));

        for path in &candidates {
            if path.exists() {
                log_debug(&format!("[NoobSynth VST] Found executable: {:?}", path));
                return Some(path.clone());
            }
        }

        log_debug("[NoobSynth VST] Could not find executable. Searched:");
        for path in &candidates {
            log_debug(&format!("  - {:?}", path));
        }
        None
    }

    /// Check if Tauri is connected by peeking at the shared memory flags
    /// This does NOT set any flags, just reads them
    fn is_tauri_running(instance_id: &str) -> bool {
        use std::sync::atomic::Ordering;

        let os_id = super::shm_name(if instance_id.is_empty() { None } else { Some(instance_id) });
        let shmem = match shared_memory::ShmemConf::new()
            .os_id(&os_id)
            .open()
        {
            Ok(s) => s,
            Err(_) => return false, // No shared memory = Tauri not running
        };

        unsafe {
            let layout = shmem.as_ptr() as *const super::SharedMemoryLayout;
            // Check if magic is valid and Tauri flag (bit 1) is set
            if (*layout).header.magic != super::MAGIC {
                return false;
            }
            (*layout).header.flags.load(Ordering::Relaxed) & 2 != 0
        }
    }

    /// Launch the Tauri app if not already running
    pub fn launch_tauri_if_needed(instance_id: &str) -> bool {
        log_debug("[NoobSynth VST] launch_tauri_if_needed() called");

        // Check if Tauri is actually connected (peek at flags without modifying)
        if is_tauri_running(instance_id) {
            log_debug("[NoobSynth VST] Tauri already connected");
            return true;
        }
        log_debug("[NoobSynth VST] Tauri not connected, launching...");

        // Find and launch
        if let Some(exe_path) = find_tauri_exe() {
            log_debug(&format!("[NoobSynth VST] Launching: {:?}", exe_path));
            let mut cmd = Command::new(&exe_path);
            cmd.arg("--vst-mode");
            if !instance_id.is_empty() {
                cmd.arg("--vst-id").arg(instance_id);
            }
            match cmd.spawn() {
                Ok(_) => {
                    log_debug("[NoobSynth VST] Launch successful, waiting...");
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    true
                }
                Err(e) => {
                    log_debug(&format!("[NoobSynth VST] Failed to launch: {}", e));
                    false
                }
            }
        } else {
            log_debug("[NoobSynth VST] Could not find Tauri executable");
            false
        }
    }
}

#[cfg(not(windows))]
pub mod launcher {
    use std::path::PathBuf;

    pub fn find_tauri_exe() -> Option<PathBuf> {
        // macOS/Linux implementation
        let home = std::env::var("HOME").ok()?;
        let candidates = [
            PathBuf::from(&home).join(".local/bin/noobsynth"),
            PathBuf::from("/usr/local/bin/noobsynth"),
            PathBuf::from("/Applications/NoobSynth.app/Contents/MacOS/NoobSynth"),
        ];

        for path in candidates {
            if path.exists() {
                return Some(path);
            }
        }
        None
    }

    pub fn launch_tauri_if_needed(instance_id: &str) -> bool {
        use std::process::Command;

        if super::TauriBridge::open_with_id(if instance_id.is_empty() { None } else { Some(instance_id) }).is_ok() {
            return true;
        }

        if let Some(exe_path) = find_tauri_exe() {
            let mut cmd = Command::new(&exe_path);
            cmd.arg("--vst-mode");
            if !instance_id.is_empty() {
                cmd.arg("--vst-id").arg(instance_id);
            }
            cmd.spawn()
                .map(|_| {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    true
                })
                .unwrap_or(false)
        } else {
            false
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_id() {
        assert_ne!(hash_id("osc-1"), hash_id("osc-2"));
        assert_eq!(hash_id("cutoff"), hash_id("cutoff"));
    }

    #[test]
    fn test_layout_size() {
        println!("SharedMemoryLayout size: {} bytes", SHARED_MEM_SIZE);
        assert!(SHARED_MEM_SIZE < 128 * 1024); // Should be under 128KB
    }

    #[test]
    fn test_command_slot_size() {
        assert_eq!(std::mem::size_of::<CommandSlot>(), 24);
    }
}
