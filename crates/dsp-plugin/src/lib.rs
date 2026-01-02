use nih_plug::prelude::*;
use nih_plug_egui::{create_egui_editor, egui, EguiState};
use dsp_graph::GraphEngine;
use dsp_ipc::{CommandType, SharedParams, VstBridge, hash_id, launcher};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

static INSTANCE_COUNTER: AtomicU64 = AtomicU64::new(1);

fn generate_instance_id() -> String {
    let pid = std::process::id();
    let seq = INSTANCE_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{pid:x}-{seq:x}")
}

/// Default graph JSON for a simple synth patch
/// VCO → VCF → VCA → Output with ADSR envelopes
const DEFAULT_GRAPH_JSON: &str = r#"{
  "modules": [
    {
      "id": "osc-1",
      "type": "oscillator",
      "name": "VCO",
      "position": { "x": 0, "y": 0 },
      "params": {
        "frequency": 110,
        "type": "sawtooth",
        "pwm": 0.5,
        "unison": 2,
        "detune": 7,
        "fmLin": 0,
        "fmExp": 0,
        "subMix": 0,
        "subOct": 1
      }
    },
    {
      "id": "vcf-1",
      "type": "vcf",
      "name": "VCF",
      "position": { "x": 0, "y": 0 },
      "params": {
        "cutoff": 1200,
        "resonance": 0.2,
        "drive": 0.1,
        "envAmount": 0.4,
        "modAmount": 0,
        "keyTrack": 0.5,
        "model": "svf",
        "mode": "lp",
        "slope": 12
      }
    },
    {
      "id": "gain-1",
      "type": "gain",
      "name": "VCA",
      "position": { "x": 0, "y": 0 },
      "params": { "gain": 0.8 }
    },
    {
      "id": "chorus-1",
      "type": "chorus",
      "name": "Chorus",
      "position": { "x": 0, "y": 0 },
      "params": {
        "rate": 0.3,
        "depth": 12,
        "delay": 18,
        "mix": 0.4,
        "spread": 0.7,
        "feedback": 0.1
      }
    },
    {
      "id": "out-1",
      "type": "output",
      "name": "Output",
      "position": { "x": 0, "y": 0 },
      "params": { "level": 0.7 }
    },
    {
      "id": "adsr-1",
      "type": "adsr",
      "name": "Amp Env",
      "position": { "x": 0, "y": 0 },
      "params": { "attack": 0.01, "decay": 0.3, "sustain": 0.7, "release": 0.5 }
    },
    {
      "id": "adsr-2",
      "type": "adsr",
      "name": "Filter Env",
      "position": { "x": 0, "y": 0 },
      "params": { "attack": 0.01, "decay": 0.5, "sustain": 0.3, "release": 0.4 }
    },
    {
      "id": "ctrl-1",
      "type": "control",
      "name": "Control",
      "position": { "x": 0, "y": 0 },
      "params": {
        "cv": 0,
        "cvMode": "unipolar",
        "velocity": 1,
        "midiVelocity": true,
        "gate": 0,
        "glide": 0.02,
        "midiEnabled": false,
        "midiChannel": 0,
        "midiRoot": 60,
        "midiInputId": "",
        "midiVelSlew": 0.005,
        "voices": 8,
        "seqOn": false,
        "seqTempo": 120,
        "seqGate": 0.5
      }
    }
  ],
  "macros": [
    {
      "id": 1,
      "name": "Cutoff",
      "targets": [{ "moduleId": "vcf-1", "paramId": "cutoff", "min": 200, "max": 6000 }]
    },
    {
      "id": 2,
      "name": "Resonance",
      "targets": [{ "moduleId": "vcf-1", "paramId": "resonance", "min": 0, "max": 0.8 }]
    },
    {
      "id": 3,
      "name": "Env Amount",
      "targets": [{ "moduleId": "vcf-1", "paramId": "envAmount", "min": 0, "max": 0.9 }]
    },
    {
      "id": 4,
      "name": "Attack",
      "targets": [{ "moduleId": "adsr-1", "paramId": "attack", "min": 0.01, "max": 2.0 }]
    },
    {
      "id": 5,
      "name": "Decay",
      "targets": [{ "moduleId": "adsr-1", "paramId": "decay", "min": 0.05, "max": 2.5 }]
    },
    {
      "id": 6,
      "name": "Sustain",
      "targets": [{ "moduleId": "adsr-1", "paramId": "sustain", "min": 0.0, "max": 1.0 }]
    },
    {
      "id": 7,
      "name": "Release",
      "targets": [{ "moduleId": "adsr-1", "paramId": "release", "min": 0.05, "max": 3.0 }]
    },
    {
      "id": 8,
      "name": "Chorus",
      "targets": [{ "moduleId": "chorus-1", "paramId": "mix", "min": 0.0, "max": 1.0 }]
    }
  ],
  "connections": [
    { "from": { "moduleId": "ctrl-1", "portId": "cv-out" }, "to": { "moduleId": "osc-1", "portId": "pitch" }, "kind": "cv" },
    { "from": { "moduleId": "ctrl-1", "portId": "cv-out" }, "to": { "moduleId": "vcf-1", "portId": "key" }, "kind": "cv" },
    { "from": { "moduleId": "ctrl-1", "portId": "gate-out" }, "to": { "moduleId": "adsr-1", "portId": "gate" }, "kind": "gate" },
    { "from": { "moduleId": "ctrl-1", "portId": "gate-out" }, "to": { "moduleId": "adsr-2", "portId": "gate" }, "kind": "gate" },
    { "from": { "moduleId": "osc-1", "portId": "out" }, "to": { "moduleId": "vcf-1", "portId": "in" }, "kind": "audio" },
    { "from": { "moduleId": "adsr-2", "portId": "env" }, "to": { "moduleId": "vcf-1", "portId": "env" }, "kind": "cv" },
    { "from": { "moduleId": "vcf-1", "portId": "out" }, "to": { "moduleId": "gain-1", "portId": "in" }, "kind": "audio" },
    { "from": { "moduleId": "adsr-1", "portId": "env" }, "to": { "moduleId": "gain-1", "portId": "cv" }, "kind": "cv" },
    { "from": { "moduleId": "gain-1", "portId": "out" }, "to": { "moduleId": "chorus-1", "portId": "in" }, "kind": "audio" },
    { "from": { "moduleId": "chorus-1", "portId": "out" }, "to": { "moduleId": "out-1", "portId": "in" }, "kind": "audio" }
  ]
}"#;

/// Precomputed hashes for common module/param IDs
mod hashes {
    use super::hash_id;
    use std::sync::LazyLock;

    pub static CTRL_1: LazyLock<u32> = LazyLock::new(|| hash_id("ctrl-1"));
    pub static OUT_1: LazyLock<u32> = LazyLock::new(|| hash_id("out-1"));
    pub static VCF_1: LazyLock<u32> = LazyLock::new(|| hash_id("vcf-1"));
    pub static ADSR_1: LazyLock<u32> = LazyLock::new(|| hash_id("adsr-1"));
    pub static ADSR_2: LazyLock<u32> = LazyLock::new(|| hash_id("adsr-2"));
    pub static CHORUS_1: LazyLock<u32> = LazyLock::new(|| hash_id("chorus-1"));
    pub static OSC_1: LazyLock<u32> = LazyLock::new(|| hash_id("osc-1"));
    pub static GAIN_1: LazyLock<u32> = LazyLock::new(|| hash_id("gain-1"));
}

#[derive(Clone)]
struct MacroTarget {
    module_id: String,
    param_id: String,
    min: f32,
    max: f32,
}

#[derive(Clone)]
struct MacroSpec {
    id: u8,
    name: Option<String>,
    targets: Vec<MacroTarget>,
}

#[derive(Deserialize)]
struct MacroTargetJson {
    #[serde(rename = "moduleId")]
    module_id: String,
    #[serde(rename = "paramId")]
    param_id: String,
    min: Option<f32>,
    max: Option<f32>,
}

#[derive(Deserialize)]
struct MacroSpecJson {
    id: u8,
    name: Option<String>,
    targets: Vec<MacroTargetJson>,
}

#[derive(Deserialize)]
struct MacroPayload {
    macros: Option<Vec<MacroSpecJson>>,
}

#[derive(Deserialize)]
struct GraphIndexPayload {
    modules: Vec<GraphIndexModule>,
}

#[derive(Deserialize)]
struct GraphIndexModule {
    id: String,
    params: Option<HashMap<String, serde_json::Value>>,
}

/// NoobSynth VST3/CLAP Plugin
pub struct NoobSynth {
    params: Arc<NoobSynthParams>,
    engine: GraphEngine,
    /// Current graph state as JSON (for state persistence)
    graph_json: String,
    /// Voice allocation: maps voice_id to MIDI note
    voice_notes: [Option<u8>; 16],
    /// Next voice to allocate (round-robin)
    next_voice: usize,
    /// Maximum voices
    max_voices: usize,
    /// Unique instance identifier for IPC
    instance_id: String,
    /// IPC bridge for communication with Tauri UI
    ipc_bridge: Option<VstBridge>,
    ui_connected: Arc<AtomicBool>,
    ui_requests: Arc<AtomicU32>,
    ui_sample_rate: Arc<AtomicU32>,
    module_hash_map: HashMap<u32, String>,
    param_hash_map: HashMap<u32, String>,
    macro_specs: Vec<MacroSpec>,
    last_macro_values: [f32; 8],
    last_daw_macro_values: [f32; 8],
    last_published_macros: [f32; 8],
    last_ui_connected: bool,
    ui_macro_override: bool,
}

/// Plugin parameters exposed to the DAW
#[derive(Params)]
struct NoobSynthParams {
    /// Editor state
    #[persist = "editor-state"]
    editor_state: Arc<EguiState>,

    #[persist = "graph-json"]
    graph_json: Mutex<String>,

    /// Macro 1
    #[id = "macro_1"]
    pub macro_1: FloatParam,

    /// Macro 2
    #[id = "macro_2"]
    pub macro_2: FloatParam,

    /// Macro 3
    #[id = "macro_3"]
    pub macro_3: FloatParam,

    /// Macro 4
    #[id = "macro_4"]
    pub macro_4: FloatParam,

    /// Macro 5
    #[id = "macro_5"]
    pub macro_5: FloatParam,

    /// Macro 6
    #[id = "macro_6"]
    pub macro_6: FloatParam,

    /// Macro 7
    #[id = "macro_7"]
    pub macro_7: FloatParam,

    /// Macro 8
    #[id = "macro_8"]
    pub macro_8: FloatParam,
}

impl Default for NoobSynthParams {
    fn default() -> Self {
        Self {
            editor_state: EguiState::from_size(360, 200),
            graph_json: Mutex::new(DEFAULT_GRAPH_JSON.to_string()),

            macro_1: FloatParam::new(
                "Macro 1",
                0.0,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_value_to_string(formatters::v2s_f32_percentage(0)),

            macro_2: FloatParam::new(
                "Macro 2",
                0.0,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_value_to_string(formatters::v2s_f32_percentage(0)),

            macro_3: FloatParam::new(
                "Macro 3",
                0.0,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_value_to_string(formatters::v2s_f32_percentage(0)),

            macro_4: FloatParam::new(
                "Macro 4",
                0.0,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_value_to_string(formatters::v2s_f32_percentage(0)),

            macro_5: FloatParam::new(
                "Macro 5",
                0.0,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_value_to_string(formatters::v2s_f32_percentage(0)),

            macro_6: FloatParam::new(
                "Macro 6",
                0.0,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_value_to_string(formatters::v2s_f32_percentage(0)),

            macro_7: FloatParam::new(
                "Macro 7",
                0.0,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_value_to_string(formatters::v2s_f32_percentage(0)),

            macro_8: FloatParam::new(
                "Macro 8",
                0.0,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_value_to_string(formatters::v2s_f32_percentage(0)),
        }
    }
}

impl NoobSynthParams {
    fn macro_values(&self) -> [f32; 8] {
        [
            self.macro_1.value(),
            self.macro_2.value(),
            self.macro_3.value(),
            self.macro_4.value(),
            self.macro_5.value(),
            self.macro_6.value(),
            self.macro_7.value(),
            self.macro_8.value(),
        ]
    }
}

impl Default for NoobSynth {
    fn default() -> Self {
        let params = Arc::new(NoobSynthParams::default());
        let macro_specs = parse_macro_specs(DEFAULT_GRAPH_JSON);
        let last_macro_values = params.macro_values();
        let last_published_macros = [-1.0; 8];
        let ui_connected = Arc::new(AtomicBool::new(false));
        let ui_requests = Arc::new(AtomicU32::new(0));
        let ui_sample_rate = Arc::new(AtomicU32::new(0));
        let instance_id = generate_instance_id();
        Self {
            params,
            engine: GraphEngine::new(44100.0),
            graph_json: DEFAULT_GRAPH_JSON.to_string(),
            voice_notes: [None; 16],
            next_voice: 0,
            max_voices: 8,
            instance_id,
            ipc_bridge: None,
            ui_connected,
            ui_requests,
            ui_sample_rate,
            module_hash_map: HashMap::new(),
            param_hash_map: HashMap::new(),
            macro_specs,
            last_macro_values,
            last_daw_macro_values: last_macro_values,
            last_published_macros,
            last_ui_connected: false,
            ui_macro_override: false,
        }
    }
}

impl NoobSynth {
    const UI_REQ_RECONNECT: u32 = 1;

    fn sync_macros_from_ui(&mut self) {
        let Some(bridge) = &mut self.ipc_bridge else {
            return;
        };
        if !bridge.params_changed() {
            return;
        }
        let mut values = bridge.params().macros;
        for value in &mut values {
            *value = value.clamp(0.0, 1.0);
        }
        let mut changed = false;
        for (index, value) in values.iter().enumerate() {
            if (self.last_macro_values[index] - *value).abs() > 1e-6 {
                self.apply_macro_value(index, *value);
                changed = true;
            }
        }
        if changed {
            self.last_macro_values = values;
            self.last_published_macros = values;
            self.ui_macro_override = true;
        }
    }

    fn publish_macros_to_ui(&mut self) {
        let Some(bridge) = &mut self.ipc_bridge else {
            return;
        };
        if self.ui_macro_override {
            return;
        }
        let values = self.params.macro_values();
        if values == self.last_published_macros {
            return;
        }
        bridge.set_vst_params(SharedParams {
            macros: values,
            _padding: [0.0; 8],
        });
        self.last_published_macros = values;
    }

    fn load_graph_from_params(&mut self) {
        if let Ok(stored) = self.params.graph_json.lock() {
            if !stored.trim().is_empty() {
                self.graph_json = stored.clone();
                return;
            }
        }
        self.graph_json = DEFAULT_GRAPH_JSON.to_string();
        self.persist_graph_json();
    }

    fn persist_graph_json(&self) {
        if let Ok(mut stored) = self.params.graph_json.lock() {
            if *stored != self.graph_json {
                *stored = self.graph_json.clone();
            }
        }
    }

    fn set_graph_json(&mut self, graph_json: String) {
        self.graph_json = graph_json;
        self.persist_graph_json();
    }

    fn apply_graph_json(&mut self, graph_json: String) {
        if let Err(e) = self.engine.set_graph_json(&graph_json) {
            nih_error!("Failed to load graph: {}", e);
            return;
        }
        self.set_graph_json(graph_json);
        self.engine.set_param("ctrl-1", "voices", self.max_voices as f32);
        self.refresh_hash_maps();
        self.macro_specs = parse_macro_specs(&self.graph_json);
        self.apply_all_macros();
        self.publish_graph_to_ui();
    }

    fn sync_graph_from_params(&mut self) {
        let stored = match self.params.graph_json.try_lock() {
            Ok(guard) => guard.clone(),
            Err(_) => return,
        };
        if stored.trim().is_empty() || stored == self.graph_json {
            return;
        }
        self.apply_graph_json(stored);
    }

    fn refresh_hash_maps(&mut self) {
        let (module_map, param_map) = build_hash_maps(&self.graph_json);
        self.module_hash_map = module_map;
        self.param_hash_map = param_map;
    }

    fn publish_graph_to_ui(&mut self) {
        if let Some(bridge) = &mut self.ipc_bridge {
            bridge.set_vst_graph(&self.graph_json);
        }
    }

    fn lookup_module_id(&self, hash: u32) -> Option<&str> {
        if let Some(value) = self.module_hash_map.get(&hash) {
            return Some(value.as_str());
        }
        hash_to_module_id(hash)
    }

    fn lookup_param_id(&self, hash: u32) -> Option<&str> {
        if let Some(value) = self.param_hash_map.get(&hash) {
            return Some(value.as_str());
        }
        hash_to_param_id(hash)
    }

    /// Allocate a voice for a new note (round-robin with voice stealing)
    fn allocate_voice(&mut self, note: u8) -> usize {
        // First, check if this note is already playing
        for (i, n) in self.voice_notes.iter().enumerate() {
            if *n == Some(note) {
                return i;
            }
        }

        // Find a free voice
        for (i, n) in self.voice_notes.iter().enumerate() {
            if i < self.max_voices && n.is_none() {
                self.voice_notes[i] = Some(note);
                return i;
            }
        }

        // No free voice, steal the next one (round-robin)
        let voice = self.next_voice % self.max_voices;
        self.voice_notes[voice] = Some(note);
        self.next_voice = (self.next_voice + 1) % self.max_voices;
        voice
    }

    /// Release a voice by note
    fn release_voice(&mut self, note: u8) -> Option<usize> {
        for (i, n) in self.voice_notes.iter_mut().enumerate() {
            if *n == Some(note) {
                *n = None;
                return Some(i);
            }
        }
        None
    }

    fn apply_macro_value(&mut self, macro_index: usize, value: f32) {
        let macro_id = (macro_index + 1) as u8;
        for spec in &self.macro_specs {
            if spec.id != macro_id {
                continue;
            }
            for target in &spec.targets {
                let scaled = target.min + (target.max - target.min) * value;
                self.engine
                    .set_param(&target.module_id, &target.param_id, scaled);
            }
        }
    }

    fn apply_all_macros(&mut self) {
        let values = self.params.macro_values();
        for (index, value) in values.iter().enumerate() {
            self.apply_macro_value(index, *value);
        }
        self.last_macro_values = values;
    }

    fn sync_macros_to_engine(&mut self) {
        let values = self.params.macro_values();
        if values == self.last_daw_macro_values {
            return;
        }
        let mut changed = false;
        for (index, value) in values.iter().enumerate() {
            let previous = self.last_macro_values[index];
            if (value - previous).abs() <= 1e-6 {
                continue;
            }
            changed = true;
            self.last_macro_values[index] = *value;
            self.apply_macro_value(index, *value);
        }
        if changed {
            self.ui_macro_override = false;
        }
        self.last_daw_macro_values = values;
    }

    /// Initialize IPC bridge and optionally launch Tauri
    fn init_ipc(&mut self, sample_rate: f32) {
        // FIRST: Create the IPC bridge BEFORE launching Tauri
        // This ensures the shared memory exists when Tauri tries to connect
        nih_log!("Initializing IPC bridge...");

        match VstBridge::new_with_id(Some(self.instance_id.as_str())) {
            Ok(mut bridge) => {
                bridge.set_sample_rate(sample_rate as u32);
                nih_log!("IPC bridge created successfully (sample rate: {})", sample_rate as u32);
                self.ui_connected.store(bridge.is_ui_connected(), Ordering::Relaxed);
                self.ipc_bridge = Some(bridge);
                self.publish_graph_to_ui();
                self.publish_macros_to_ui();
            }
            Err(e) => {
                nih_log!("VstBridge::new() failed: {:?}, trying open()...", e);
                // Try to open existing (maybe Tauri created it first)
                match VstBridge::open_with_id(Some(self.instance_id.as_str())) {
                    Ok(mut bridge) => {
                        bridge.set_sample_rate(sample_rate as u32);
                        nih_log!("IPC bridge opened successfully");
                        self.ui_connected.store(bridge.is_ui_connected(), Ordering::Relaxed);
                        self.ipc_bridge = Some(bridge);
                        self.publish_graph_to_ui();
                        self.publish_macros_to_ui();
                    }
                    Err(e2) => {
                        nih_log!("VstBridge::open() also failed: {:?}", e2);
                        nih_log!("IPC bridge unavailable - UI control will not work");
                    }
                }
            }
        }

        // THEN: Launch Tauri if not already running (after bridge is ready)
        // UI is opened on demand via the host's editor button.
    }

    fn reconnect_ipc(&mut self) {
        self.ipc_bridge = None;
        let sample_rate = self.ui_sample_rate.load(Ordering::Relaxed);
        match VstBridge::open_with_id(Some(self.instance_id.as_str())) {
            Ok(mut bridge) => {
                if sample_rate > 0 {
                    bridge.set_sample_rate(sample_rate);
                }
                self.ui_connected.store(bridge.is_ui_connected(), Ordering::Relaxed);
                self.ipc_bridge = Some(bridge);
                self.publish_macros_to_ui();
                nih_log!("IPC bridge reconnected (open)");
            }
            Err(_) => match VstBridge::new_with_id(Some(self.instance_id.as_str())) {
                Ok(mut bridge) => {
                    if sample_rate > 0 {
                        bridge.set_sample_rate(sample_rate);
                    }
                    self.ui_connected.store(bridge.is_ui_connected(), Ordering::Relaxed);
                    self.ipc_bridge = Some(bridge);
                    self.publish_macros_to_ui();
                    nih_log!("IPC bridge reconnected (new)");
                }
                Err(err) => {
                    nih_log!("IPC bridge reconnect failed: {:?}", err);
                }
            },
        }
    }

    /// Process IPC commands from Tauri UI
    fn process_ipc_commands(&mut self) {
        let graph_json = {
            let Some(bridge) = &mut self.ipc_bridge else {
                return;
            };
            bridge.graph_changed()
        };

        // Check for graph changes
        if let Some(graph_json) = graph_json {
            nih_log!("Received new graph from UI ({} bytes)", graph_json.len());
            self.apply_graph_json(graph_json);
        }

        // Process commands from ring buffer
        let mut commands = Vec::new();
        if let Some(bridge) = &mut self.ipc_bridge {
            while let Some(cmd) = bridge.pop_command() {
                commands.push(cmd);
            }
        }

        for cmd in commands {
            let cmd_type = CommandType::from(cmd.cmd_type);
            match cmd_type {
                CommandType::SetParam => {
                    // Read module and param names from string buffer if needed
                    // For now, we use the hash to identify known modules
                    let module_id = self.lookup_module_id(cmd.module_id).map(str::to_string);
                    let param_id = self.lookup_param_id(cmd.param_id).map(str::to_string);
                    if let (Some(module_id), Some(param_id)) = (module_id, param_id) {
                        self.engine.set_param(&module_id, &param_id, cmd.value);
                        if let Some(updated) = update_graph_param_json(
                            &self.graph_json,
                            &module_id,
                            &param_id,
                            cmd.value,
                        ) {
                            self.set_graph_json(updated);
                            self.publish_graph_to_ui();
                        }
                    }
                }
                CommandType::NoteOn => {
                    let voice = cmd.voice as usize;
                    let note = cmd.note;
                    let velocity = cmd.value;

                    if voice < self.max_voices {
                        self.voice_notes[voice] = Some(note);
                        let cv = (note as f32 - 60.0) / 12.0;
                        self.engine.set_control_voice_cv("ctrl-1", voice, cv);
                        self.engine.set_control_voice_velocity("ctrl-1", voice, velocity, 0.005);
                        self.engine.trigger_control_voice_gate("ctrl-1", voice);
                    }
                }
                CommandType::NoteOff => {
                    let voice = cmd.voice as usize;
                    if voice < self.max_voices {
                        self.voice_notes[voice] = None;
                        self.engine.set_control_voice_gate("ctrl-1", voice, 0.0);
                    }
                }
                CommandType::SetVoiceCv => {
                    let voice = cmd.voice as usize;
                    if voice < self.max_voices {
                        self.engine.set_control_voice_cv("ctrl-1", voice, cmd.value);
                    }
                }
                CommandType::SetVoiceVelocity => {
                    let voice = cmd.voice as usize;
                    if voice < self.max_voices {
                        self.engine.set_control_voice_velocity("ctrl-1", voice, cmd.value, 0.005);
                    }
                }
                CommandType::TriggerGate => {
                    let voice = cmd.voice as usize;
                    if voice < self.max_voices {
                        self.engine.trigger_control_voice_gate("ctrl-1", voice);
                    }
                }
                CommandType::ReleaseGate => {
                    let voice = cmd.voice as usize;
                    if voice < self.max_voices {
                        self.engine.set_control_voice_gate("ctrl-1", voice, 0.0);
                    }
                }
                CommandType::SetGraph => {
                    // Graph was already handled above via graph_changed()
                }
                CommandType::None => {}
            }
        }
    }

}

/// Convert module hash back to module ID string
fn hash_to_module_id(hash: u32) -> Option<&'static str> {
    if hash == *hashes::CTRL_1 { return Some("ctrl-1"); }
    if hash == *hashes::OUT_1 { return Some("out-1"); }
    if hash == *hashes::VCF_1 { return Some("vcf-1"); }
    if hash == *hashes::ADSR_1 { return Some("adsr-1"); }
    if hash == *hashes::ADSR_2 { return Some("adsr-2"); }
    if hash == *hashes::CHORUS_1 { return Some("chorus-1"); }
    if hash == *hashes::OSC_1 { return Some("osc-1"); }
    if hash == *hashes::GAIN_1 { return Some("gain-1"); }
    None
}

/// Convert param hash back to param ID string
fn hash_to_param_id(hash: u32) -> Option<&'static str> {
    let common_params = [
        "level", "cutoff", "resonance", "envAmount", "attack", "decay",
        "sustain", "release", "mix", "frequency", "type", "drive",
        "rate", "depth", "delay", "spread", "feedback", "gain",
        "cv", "gate", "velocity", "voices", "glide",
    ];

    for param in common_params {
        if hash_id(param) == hash {
            return Some(match param {
                "level" => "level",
                "cutoff" => "cutoff",
                "resonance" => "resonance",
                "envAmount" => "envAmount",
                "attack" => "attack",
                "decay" => "decay",
                "sustain" => "sustain",
                "release" => "release",
                "mix" => "mix",
                "frequency" => "frequency",
                "type" => "type",
                "drive" => "drive",
                "rate" => "rate",
                "depth" => "depth",
                "delay" => "delay",
                "spread" => "spread",
                "feedback" => "feedback",
                "gain" => "gain",
                "cv" => "cv",
                "gate" => "gate",
                "velocity" => "velocity",
                "voices" => "voices",
                "glide" => "glide",
                _ => return None,
            });
        }
    }
    None
}

fn parse_macro_specs(payload: &str) -> Vec<MacroSpec> {
    let parsed: MacroPayload = match serde_json::from_str(payload) {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    parsed
        .macros
        .unwrap_or_default()
        .into_iter()
        .filter_map(|spec| {
            if spec.id == 0 || spec.id > 8 {
                return None;
            }
            let targets: Vec<MacroTarget> = spec
                .targets
                .into_iter()
                .filter_map(|target| {
                    if target.module_id.is_empty() || target.param_id.is_empty() {
                        return None;
                    }
                    let mut min = target.min.unwrap_or(0.0);
                    let mut max = target.max.unwrap_or(1.0);
                    if min > max {
                        std::mem::swap(&mut min, &mut max);
                    }
                    Some(MacroTarget {
                        module_id: target.module_id,
                        param_id: target.param_id,
                        min,
                        max,
                    })
                })
                .collect();

            if targets.is_empty() {
                return None;
            }
            Some(MacroSpec {
                id: spec.id,
                name: spec.name,
                targets,
            })
        })
        .collect()
}

fn build_hash_maps(payload: &str) -> (HashMap<u32, String>, HashMap<u32, String>) {
    let parsed: GraphIndexPayload = match serde_json::from_str(payload) {
        Ok(value) => value,
        Err(_) => return (HashMap::new(), HashMap::new()),
    };

    let mut module_map = HashMap::new();
    let mut param_map = HashMap::new();
    for module in parsed.modules {
        let module_hash = hash_id(&module.id);
        module_map.entry(module_hash).or_insert(module.id);

        if let Some(params) = module.params {
            for key in params.keys() {
                let param_hash = hash_id(key);
                param_map.entry(param_hash).or_insert_with(|| key.clone());
            }
        }
    }

    (module_map, param_map)
}

fn update_graph_param_json(
    graph_json: &str,
    module_id: &str,
    param_id: &str,
    value: f32,
) -> Option<String> {
    let mut root: serde_json::Value = serde_json::from_str(graph_json).ok()?;
    let modules = root.get_mut("modules")?.as_array_mut()?;
    for module in modules.iter_mut() {
        let module_obj = module.as_object_mut()?;
        let id = module_obj.get("id")?.as_str()?;
        if id != module_id {
            continue;
        }
        let params_entry = module_obj
            .entry("params")
            .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()));
        if !params_entry.is_object() {
            *params_entry = serde_json::Value::Object(serde_json::Map::new());
        }
        let params_obj = params_entry.as_object_mut()?;
        let number = serde_json::Number::from_f64(value as f64)?;
        params_obj.insert(param_id.to_string(), serde_json::Value::Number(number));
        return serde_json::to_string(&root).ok();
    }
    None
}

impl Plugin for NoobSynth {
    const NAME: &'static str = "NoobSynth";
    const VENDOR: &'static str = "NoobSynth";
    const URL: &'static str = "https://github.com/warnotte/NoobSynth3";
    const EMAIL: &'static str = "";
    const VERSION: &'static str = env!("CARGO_PKG_VERSION");

    const AUDIO_IO_LAYOUTS: &'static [AudioIOLayout] = &[AudioIOLayout {
        main_input_channels: None,
        main_output_channels: NonZeroU32::new(2),
        aux_input_ports: &[],
        aux_output_ports: &[],
        names: PortNames::const_default(),
    }];

    const MIDI_INPUT: MidiConfig = MidiConfig::Basic;
    const MIDI_OUTPUT: MidiConfig = MidiConfig::None;
    const SAMPLE_ACCURATE_AUTOMATION: bool = true;

    type SysExMessage = ();
    type BackgroundTask = ();

    fn params(&self) -> Arc<dyn Params> {
        self.params.clone()
    }

    fn editor(&mut self, _async_executor: AsyncExecutor<Self>) -> Option<Box<dyn Editor>> {
        let ui_connected = self.ui_connected.clone();
        let ui_requests = self.ui_requests.clone();
        let ui_sample_rate = self.ui_sample_rate.clone();
        let instance_id = self.instance_id.clone();
        create_egui_editor(
            self.params.editor_state.clone(),
            (),
            move |_, _| {},
            move |egui_ctx, _setter, _| {
                egui::CentralPanel::default().show(egui_ctx, |ui| {
                    ui.heading("NoobSynth UI");
                    ui.label("This host window launches the full NoobSynth interface.");
                    if ui.button("Open NoobSynth UI").clicked() {
                        launcher::launch_tauri_if_needed(&instance_id);
                    }
                    if ui.button("Reconnect IPC").clicked() {
                        ui_requests.fetch_or(NoobSynth::UI_REQ_RECONNECT, Ordering::Relaxed);
                    }
                    ui.separator();
                    let connected = ui_connected.load(Ordering::Relaxed);
                    let status = if connected { "connected" } else { "not connected" };
                    ui.label(format!("Tauri UI: {status}"));
                    let sample_rate = ui_sample_rate.load(Ordering::Relaxed);
                    if sample_rate > 0 {
                        ui.label(format!("Sample rate: {sample_rate} Hz"));
                    }
                });
            },
        )
    }

    fn initialize(
        &mut self,
        _audio_io_layout: &AudioIOLayout,
        buffer_config: &BufferConfig,
        _context: &mut impl InitContext<Self>,
    ) -> bool {
        // Initialize the graph engine with the correct sample rate
        self.engine = GraphEngine::new(buffer_config.sample_rate);
        self.ui_sample_rate
            .store(buffer_config.sample_rate as u32, Ordering::Relaxed);

        self.load_graph_from_params();

        // Load the persisted graph (or fallback default)
        if let Err(e) = self.engine.set_graph_json(&self.graph_json) {
            nih_error!("Failed to load graph: {}", e);
            return false;
        }

        self.refresh_hash_maps();
        self.macro_specs = parse_macro_specs(&self.graph_json);

        // Set initial voice count
        self.engine.set_param("ctrl-1", "voices", self.max_voices as f32);
        self.apply_all_macros();

        // Initialize IPC bridge (will also try to launch Tauri)
        self.init_ipc(buffer_config.sample_rate);

        nih_log!("NoobSynth initialized at {} Hz", buffer_config.sample_rate);
        true
    }

    fn reset(&mut self) {
        // Reset all voices
        self.voice_notes = [None; 16];
        self.next_voice = 0;
    }

    fn process(
        &mut self,
        buffer: &mut Buffer,
        _aux: &mut AuxiliaryBuffers,
        context: &mut impl ProcessContext<Self>,
    ) -> ProcessStatus {
        let requests = self.ui_requests.swap(0, Ordering::Relaxed);
        if (requests & Self::UI_REQ_RECONNECT) != 0 {
            self.reconnect_ipc();
        }

        self.sync_macros_from_ui();
        self.sync_graph_from_params();

        // Process IPC commands from Tauri UI
        self.process_ipc_commands();

        let connected = self
            .ipc_bridge
            .as_ref()
            .map(|bridge| bridge.is_ui_connected())
            .unwrap_or(false);
        if connected && !self.last_ui_connected {
            // Force a macro publish on fresh UI connections.
            self.last_published_macros = [-1.0; 8];
        }
        self.last_ui_connected = connected;
        self.ui_connected.store(connected, Ordering::Relaxed);

        // Apply macro updates from DAW (only when changed)
        self.sync_macros_to_engine();
        self.publish_macros_to_ui();

        // Process MIDI events from DAW
        while let Some(event) = context.next_event() {
            match event {
                NoteEvent::NoteOn { note, velocity, .. } => {
                    let voice = self.allocate_voice(note);
                    let cv = (note as f32 - 60.0) / 12.0;

                    self.engine.set_control_voice_cv("ctrl-1", voice, cv);
                    self.engine.set_control_voice_velocity("ctrl-1", voice, velocity, 0.005);
                    self.engine.trigger_control_voice_gate("ctrl-1", voice);
                }
                NoteEvent::NoteOff { note, .. } => {
                    if let Some(voice) = self.release_voice(note) {
                        self.engine.set_control_voice_gate("ctrl-1", voice, 0.0);
                    }
                }
                NoteEvent::PolyPressure { note, pressure, .. } => {
                    // Find the voice playing this note and update velocity
                    for (i, n) in self.voice_notes.iter().enumerate() {
                        if *n == Some(note) {
                            self.engine.set_control_voice_velocity("ctrl-1", i, pressure, 0.01);
                            break;
                        }
                    }
                }
                _ => {}
            }
        }

        // Render audio
        let num_samples = buffer.samples();
        let output = self.engine.render(num_samples);

        // Copy rendered audio to output buffer
        // The engine returns non-interleaved stereo: [L0..Ln, R0..Rn]
        let mut channel_iter = buffer.iter_samples();
        for i in 0..num_samples {
            if let Some(mut sample) = channel_iter.next() {
                let left = output.get(i).copied().unwrap_or(0.0);
                let right = output.get(num_samples + i).copied().unwrap_or(0.0);

                if let Some(l) = sample.get_mut(0) {
                    *l = left;
                }
                if let Some(r) = sample.get_mut(1) {
                    *r = right;
                }
            }
        }

        ProcessStatus::Normal
    }
}

impl ClapPlugin for NoobSynth {
    const CLAP_ID: &'static str = "com.noobsynth.noobsynth";
    const CLAP_DESCRIPTION: Option<&'static str> = Some("Modular synthesizer");
    const CLAP_MANUAL_URL: Option<&'static str> = None;
    const CLAP_SUPPORT_URL: Option<&'static str> = None;
    const CLAP_FEATURES: &'static [ClapFeature] = &[
        ClapFeature::Instrument,
        ClapFeature::Synthesizer,
        ClapFeature::Stereo,
    ];
}

impl Vst3Plugin for NoobSynth {
    const VST3_CLASS_ID: [u8; 16] = *b"NoobSynthVST3..!";
    const VST3_SUBCATEGORIES: &'static [Vst3SubCategory] = &[
        Vst3SubCategory::Instrument,
        Vst3SubCategory::Synth,
        Vst3SubCategory::Stereo,
    ];
}

nih_export_clap!(NoobSynth);
nih_export_vst3!(NoobSynth);
