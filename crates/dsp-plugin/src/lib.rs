use nih_plug::prelude::*;
use dsp_graph::GraphEngine;
use dsp_ipc::{VstBridge, CommandType, launcher, hash_id};
use std::sync::Arc;

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
    /// IPC bridge for communication with Tauri UI
    ipc_bridge: Option<VstBridge>,
    /// Whether we've tried to launch Tauri
    tauri_launch_attempted: bool,
}

/// Plugin parameters exposed to the DAW
#[derive(Params)]
struct NoobSynthParams {
    /// Master output volume
    #[id = "master"]
    pub master: FloatParam,

    /// VCF Cutoff frequency
    #[id = "cutoff"]
    pub cutoff: FloatParam,

    /// VCF Resonance
    #[id = "resonance"]
    pub resonance: FloatParam,

    /// Filter envelope amount
    #[id = "env_amount"]
    pub env_amount: FloatParam,

    /// Attack time
    #[id = "attack"]
    pub attack: FloatParam,

    /// Decay time
    #[id = "decay"]
    pub decay: FloatParam,

    /// Sustain level
    #[id = "sustain"]
    pub sustain: FloatParam,

    /// Release time
    #[id = "release"]
    pub release: FloatParam,

    /// Chorus mix
    #[id = "chorus_mix"]
    pub chorus_mix: FloatParam,
}

impl Default for NoobSynthParams {
    fn default() -> Self {
        Self {
            master: FloatParam::new(
                "Master",
                0.7,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_unit(" dB")
            .with_value_to_string(formatters::v2s_f32_rounded(2)),

            cutoff: FloatParam::new(
                "Cutoff",
                1200.0,
                FloatRange::Skewed {
                    min: 20.0,
                    max: 20000.0,
                    factor: FloatRange::skew_factor(-2.0),
                },
            )
            .with_unit(" Hz")
            .with_value_to_string(formatters::v2s_f32_rounded(0)),

            resonance: FloatParam::new(
                "Resonance",
                0.2,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_value_to_string(formatters::v2s_f32_percentage(0)),

            env_amount: FloatParam::new(
                "Env Amount",
                0.4,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_value_to_string(formatters::v2s_f32_percentage(0)),

            attack: FloatParam::new(
                "Attack",
                0.01,
                FloatRange::Skewed {
                    min: 0.001,
                    max: 5.0,
                    factor: FloatRange::skew_factor(-2.0),
                },
            )
            .with_unit(" s")
            .with_value_to_string(formatters::v2s_f32_rounded(3)),

            decay: FloatParam::new(
                "Decay",
                0.3,
                FloatRange::Skewed {
                    min: 0.001,
                    max: 5.0,
                    factor: FloatRange::skew_factor(-2.0),
                },
            )
            .with_unit(" s")
            .with_value_to_string(formatters::v2s_f32_rounded(3)),

            sustain: FloatParam::new(
                "Sustain",
                0.7,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_value_to_string(formatters::v2s_f32_percentage(0)),

            release: FloatParam::new(
                "Release",
                0.5,
                FloatRange::Skewed {
                    min: 0.001,
                    max: 10.0,
                    factor: FloatRange::skew_factor(-2.0),
                },
            )
            .with_unit(" s")
            .with_value_to_string(formatters::v2s_f32_rounded(3)),

            chorus_mix: FloatParam::new(
                "Chorus",
                0.4,
                FloatRange::Linear { min: 0.0, max: 1.0 },
            )
            .with_value_to_string(formatters::v2s_f32_percentage(0)),
        }
    }
}

impl Default for NoobSynth {
    fn default() -> Self {
        Self {
            params: Arc::new(NoobSynthParams::default()),
            engine: GraphEngine::new(44100.0),
            graph_json: DEFAULT_GRAPH_JSON.to_string(),
            voice_notes: [None; 16],
            next_voice: 0,
            max_voices: 8,
            ipc_bridge: None,
            tauri_launch_attempted: false,
        }
    }
}

impl NoobSynth {
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

    /// Sync DAW parameters to the engine
    fn sync_params_to_engine(&mut self) {
        // Master volume
        self.engine.set_param("out-1", "level", self.params.master.value());

        // VCF
        self.engine.set_param("vcf-1", "cutoff", self.params.cutoff.value());
        self.engine.set_param("vcf-1", "resonance", self.params.resonance.value());
        self.engine.set_param("vcf-1", "envAmount", self.params.env_amount.value());

        // Amp ADSR
        self.engine.set_param("adsr-1", "attack", self.params.attack.value());
        self.engine.set_param("adsr-1", "decay", self.params.decay.value());
        self.engine.set_param("adsr-1", "sustain", self.params.sustain.value());
        self.engine.set_param("adsr-1", "release", self.params.release.value());

        // Filter ADSR (linked to amp for simplicity)
        self.engine.set_param("adsr-2", "attack", self.params.attack.value());
        self.engine.set_param("adsr-2", "decay", self.params.decay.value() * 1.5);
        self.engine.set_param("adsr-2", "sustain", self.params.sustain.value() * 0.5);
        self.engine.set_param("adsr-2", "release", self.params.release.value());

        // Chorus
        self.engine.set_param("chorus-1", "mix", self.params.chorus_mix.value());
    }

    /// Initialize IPC bridge and optionally launch Tauri
    fn init_ipc(&mut self, sample_rate: f32) {
        // FIRST: Create the IPC bridge BEFORE launching Tauri
        // This ensures the shared memory exists when Tauri tries to connect
        nih_log!("Initializing IPC bridge...");

        match VstBridge::new() {
            Ok(mut bridge) => {
                bridge.set_sample_rate(sample_rate as u32);
                nih_log!("IPC bridge created successfully (sample rate: {})", sample_rate as u32);
                self.ipc_bridge = Some(bridge);
            }
            Err(e) => {
                nih_log!("VstBridge::new() failed: {:?}, trying open()...", e);
                // Try to open existing (maybe Tauri created it first)
                match VstBridge::open() {
                    Ok(mut bridge) => {
                        bridge.set_sample_rate(sample_rate as u32);
                        nih_log!("IPC bridge opened successfully");
                        self.ipc_bridge = Some(bridge);
                    }
                    Err(e2) => {
                        nih_log!("VstBridge::open() also failed: {:?}", e2);
                        nih_log!("IPC bridge unavailable - UI control will not work");
                    }
                }
            }
        }

        // THEN: Launch Tauri if not already running (after bridge is ready)
        if !self.tauri_launch_attempted {
            self.tauri_launch_attempted = true;
            nih_log!("Launching Tauri UI...");
            launcher::launch_tauri_if_needed();
        }
    }

    /// Process IPC commands from Tauri UI
    fn process_ipc_commands(&mut self) {
        let Some(bridge) = &mut self.ipc_bridge else {
            return;
        };

        // Check for graph changes
        if let Some(graph_json) = bridge.graph_changed() {
            nih_log!("Received new graph from UI ({} bytes)", graph_json.len());
            if let Err(e) = self.engine.set_graph_json(&graph_json) {
                nih_error!("Failed to load graph from UI: {}", e);
            } else {
                self.graph_json = graph_json;
                self.engine.set_param("ctrl-1", "voices", self.max_voices as f32);
            }
        }

        // Process commands from ring buffer
        while let Some(cmd) = bridge.pop_command() {
            let cmd_type = CommandType::from(cmd.cmd_type);
            match cmd_type {
                CommandType::SetParam => {
                    // Read module and param names from string buffer if needed
                    // For now, we use the hash to identify known modules
                    if let Some(name) = hash_to_module_id(cmd.module_id) {
                        if let Some(param) = hash_to_param_id(cmd.param_id) {
                            self.engine.set_param(name, param, cmd.value);
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

    fn initialize(
        &mut self,
        _audio_io_layout: &AudioIOLayout,
        buffer_config: &BufferConfig,
        _context: &mut impl InitContext<Self>,
    ) -> bool {
        // Initialize the graph engine with the correct sample rate
        self.engine = GraphEngine::new(buffer_config.sample_rate);

        // Load the default graph
        if let Err(e) = self.engine.set_graph_json(&self.graph_json) {
            nih_error!("Failed to load graph: {}", e);
            return false;
        }

        // Set initial voice count
        self.engine.set_param("ctrl-1", "voices", self.max_voices as f32);

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
        // Sync parameters from DAW
        self.sync_params_to_engine();

        // Process IPC commands from Tauri UI
        self.process_ipc_commands();

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
