# Project Notes (auto-read)

This file is meant to be reread by the coding assistant to keep context, decisions, and TODOs.

## Snapshot

- UI: React + TS + Vite with **VCV Rack-inspired styling** (Eurorack rails, brushed metal panels).
- **Compact grid layout**: Configurable module sizes (1x1, 2x1, 1x2, 2x2, 1x3, 2x3, 2x6).
- Audio: AudioWorklet graph in `src/engine`.
- Patching: drag-to-connect, double-click cable to remove.
- Default demo: Jupiter Pad style patch with chorus and sequencer.
- FX: global delay + reverb after chorus (mix controls for bypass).
- MIDI: Web MIDI input wired to Control IO (poly voice allocation) with velocity CV out + MIDI-only velocity slew.
- Polyphony: 1/2/4/8 voices, per-voice VCO/LFO/VCF/ADSR/VCA/Mod VCA, global chorus/delay/reverb/out.
- Module rack: add/remove modules from the library, plus New Rack to clear the graph.
- Module Library currently enforces single Control IO + Main Out.

## Current modules

**Oscillators:**
- VCO (unison + detune + PWM + sub + sync out + FM lin/exp)
- Supersaw (7 detuned voices, polyBLEP anti-aliasing)
- NES Osc (2A03 emulation: pulse 12.5/25/50/75%, 4-bit triangle, LFSR noise)
- SNES Osc (S-DSP style: 8 wavetables, gaussian filter, 32kHz lo-fi)
- Noise (white/pink/brown)

**Synth Voices:**
- TB-303 (saw/square osc + 18dB diode ladder filter + accent + glide)

**TR-909 Drums:**
- 909 Kick (sine + pitch envelope + click + drive)
- 909 Snare (tone oscillator + noise + snappy envelope)
- 909 HiHat (6 metallic square waves + bandpass filter)
- 909 Clap (filtered noise + multi-stage envelope)
- 909 Tom (sine + pitch envelope)
- 909 Rimshot (dual tone + noise burst)

**Modulation:**
- LFO (sine/triangle/saw/square, bipolar/unipolar)
- ADSR (amp/filter envelopes)
- Sample & Hold (CV sampling with trigger)
- Slew (CV glide/portamento)
- Quantizer (scale + root)
- Mod Router (CV in, 4 CV outs with depth)
- Mod VCA (CV multiplier)
- Step Sequencer (16-step TB-303 style with pitch/gate/velocity/slide per step, 11 built-in patterns)

**Filters:**
- VCF (SVF + ladder models, LP/HP/BP/Notch, 12/24 dB)
- HPF (simple high-pass)

**Effects:**
- Chorus (stereo, Juno-style)
- Ensemble (stereo, string chorus)
- Choir (formant filter bank)
- Delay (stereo, ping-pong option)
- Tape Delay (wow/flutter + drive)
- Granular Delay (grain size + density)
- Spring Reverb (spring tank flavor)
- Reverb (stereo, Freeverb-style)
- Phaser (4-stage stereo allpass with LFO)
- Distortion (soft clip / hard clip / foldback modes)
- Wavefolder (foldback waveshaping)

**Utilities:**
- Ring Mod (audio A x audio B)
- VCA (CV input)
- Mixer 1x1 (A/B)
- Mixer 1x2 (A-F)
- Scope (DATA-style: oscilloscope/FFT/spectrogram, 4 inputs, 2 thru outputs)
- Control IO (CV/Gate/Sync + mini sequencer + glide + MIDI)
- Mario IO (seasonal/fun)
- Lab Panel (test module)

## Presets (50+ total)

**Classic emulations (updates format):**
- Jupiter Pad, Jupiter Brass, Jupiter-8 Demo
- Juno-106 Strings, Minimoog Lead, Prophet-5 Brass
- OB-Xa Pad, CS-80 Vangelis, Moog Taurus
- SH-101 Bass, Moog Bass, ARP Odyssey Sync
- Hard Sync Lead, Ladder Lead, PWM Strings
- Dream Pad, Glass Bell, Edge Lead, 80s Pluck, Showcase Stack

**New modules (full graph format):**
- Trance Supersaw (Supersaw oscillator)
- Phaser Pad (Phaser effect)
- Dirty Bass (Distortion foldback)
- 8-Bit Mario (NES-style 5-channel with 8 classic tunes)
- Module tests: Sample & Hold, Slew, Quantizer, Ensemble, Tape Delay, Spring Reverb, Wavefolder, Granular Delay, Choir

**TB-303 / Acid (full graph format):**
- Acid Classic, Acid Squelch, Acid Drone (single TB-303)
- Moroder Chase 303 (2x TB-303 + Supersaw, 3-voice Moroder style)
- Acid Trio (3x TB-303: bass/mid/lead)

**TR-909 / Drums (full graph format):**
- 909 Kit Basic (full kit: kick, snare, hihat, clap, 2x tom, rimshot)
- 909 House (4-on-the-floor with LFO trigger + reverb + distortion)

Dev/test presets live in `public/presets/manifest-dev.json`.

Presets support two formats:
- `updates`: patches defaultGraph parameters (existing presets)
- `graph`: full graph replacement (new modules presets)

## Known issues / risks

- VCF 24 dB is tuned but can still distort at extreme resonance.
- VCF ladder model is LP-focused; HP/BP/Notch auto-switch back to SVF.
- Polyphony is implemented; unison remains per-voice.
- MIDI disables the mini sequencer when enabled. Velocity can be toggled in Control IO.
- Rapidly changing voice count while running can cause instability; adjust slowly.
- **VST mode**: Oscilloscope not working yet (scope taps not wired through IPC).
- **VST mode**: Proof of concept; host editor is a launcher for the Tauri UI.
- **VST mode**: UI macro edits do not write back to host automation (DAW remains source of truth).
- **WASM build**: `wasm-opt` disabled due to bulk memory feature mismatch; WASM is unoptimized but functional.

## Decisions

- Chorus sits after VCA in the default chain.
- Mini sequencer is enabled by default in presets.
- Lab Panel is kept out of the signal chain (for testing only).
- VCV Rack-style UI with compact spacing and eurorack aesthetic.
- Unified CSS in `src/styles.css` (single source of truth for all styling).
- Scope module uses efficient canvas rendering with mode-specific visualization (only active mode runs).

## TODO (short list)

- Refine VCF 24 dB stability.
- Add macro panel (global knobs driving multiple params).
- Consider drag-and-drop add for modules.
- Optional: expand sequencer (8 steps, per-step toggles).
- MIDI enhancements (pitch bend, CC mapping).
- Optional: add native MIDI input via `midir` for Tauri (lower latency, more reliable than Web MIDI).
- **VST**: Wire scope taps through IPC for oscilloscope in VST mode.
- **Drum Sequencer Module**: 8-track step sequencer for TR-909 drums (future).

## Recent changes (Jan 2026)

### TR-909 Drum Modules

- **6 analog drum modules** with authentic TR-909 synthesis algorithms
- **909 Kick**: Sine oscillator + pitch envelope + click transient + drive saturation
- **909 Snare**: Tone oscillator + noise generator + snappy envelope
- **909 HiHat**: 6 metallic square waves at classic ratios + bandpass filter
- **909 Clap**: Filtered noise + multi-stage envelope for realistic clap spread
- **909 Tom**: Sine + pitch envelope with tunable frequency
- **909 Rimshot**: Dual tone generators + noise burst
- **Trigger/Accent inputs**: All drums support gate trigger and accent CV
- **2 preset files**: 909-kit-basic (full kit), 909-house (4-on-the-floor)

### TB-303 Module

- **Dedicated TB-303 synth voice** with integrated oscillator, filter, and envelope
- **Saw/Square oscillator** with polyBLEP anti-aliasing
- **18dB/oct diode ladder filter** (3-pole, authentic 303 character)
- **Accent system**: velocity > 70% triggers accent boost on filter + amplitude
- **Glide/portamento** with exponential smoothing
- **7 parameters**: Cutoff, Resonance, Decay, EnvMod, Accent, Glide, Waveform
- **Step Sequencer integration**: CV/Gate/Velocity inputs for acid sequences
- **6 preset files**: acid-classic, acid-squelch, acid-drone, moroder-chase-303, acid-trio

### Multi-Voice Acid Presets

- **Moroder Chase 303**: 3-voice Moroder/Midnight Express style
  - TB-303 Bass (saw, heavy accent, octave jumps)
  - TB-303 Lead (square, arpeggiated)
  - Supersaw Stab (VCF + ADSR gated pad)
  - Chorus → Ping-pong Delay → Reverb FX chain
- **Acid Trio**: Pure 3x TB-303 acid jam
  - Bass (saw, 350 Hz, accent 0.9)
  - Mid (square, 800 Hz, arpeggios)
  - Lead (square, 1500 Hz, melodic slides)

### Step Sequencer Module

- **16-step TB-303 style sequencer** with per-step pitch, gate, velocity, and slide
- **11 built-in patterns**: Init, Moroder, Feel Love, Acid, Octaves, Arp Up, Arp Down, Bass, Trance, Kraftwerk, Random
- **4 direction modes**: Forward, Reverse, Ping-pong, Random
- **6 rate divisions**: 1/4, 1/8, 1/16, 1/4T, 1/8T, 1/16T
- **Variable length**: 4, 8, 12, or 16 steps
- **Visual feedback**: LED indicators show current playing step
- **3 preset files**: seq-moroder-chase, seq-feel-love, seq-acid-bass

## Recent changes (Dec 2025)

### VST3/CLAP Plugin (major feature)

- **Full VST3/CLAP plugin** using nih-plug framework
- **Hybrid architecture**: Native audio in DAW + Tauri UI via shared memory IPC
- **On-demand UI**: Host editor is a launcher panel; Tauri opens when requested
- **Real-time sync**: Parameters and MIDI notes sync between VST and UI
- **Preset recall**: Full graph JSON persists in plugin state and restores via DAW
- **Host -> UI sync**: Tauri refreshes when the host loads a new preset (polling)
- **Macro panel**: UI can map 8 DAW macros to module params with bidirectional sync
- **Macro override state**: UI now shows when macros are driven by DAW vs UI override (no host write-back).
- **Multi-instance IPC**: Shared memory is now instance-scoped; each plugin instance launches its own Tauri UI window.
- **UI instance label**: VST instance ID is displayed in the top bar and Tauri Bridge panel.
- **IPC bridge** (`dsp-ipc` crate): Shared memory with ring buffer for commands
- **Robust connection handling**: Auto-cleanup of stale shared memory from crashes
- **Debug logging**: `noobsynth_vst_debug.log` created in plugin folder for troubleshooting
- **Build script**: `build.bat` builds frontend + Tauri + VST in one command
- **Mini editor**: Host UI uses an egui launcher panel to open Tauri on demand (VST PoC).

### Other changes

- **New DSP modules**: Supersaw (7 detuned voices), Phaser (4-stage stereo), Distortion (soft/hard/fold).
- **Audio In**: Web mic input + native input device support in Tauri.
- **Vocoder**: 16-band engine with pre-emphasis + unvoiced mix controls.
- **Rack UX**: text selection disabled in the patch rack to keep knobs responsive.
- **Preset format extended**: Full graph replacement via `graph` property (alongside existing `updates` format).
- **23 presets**: Added classic synth emulations (Juno, Minimoog, Prophet, Oberheim, CS-80, etc.) and new module showcases.
- **VCV Rack-style UI overhaul**: Eurorack rails, brushed metal panels, compact spacing.
- **Module sizing system**: Grid-based layout with configurable sizes per module type.
- **Grid auto-placement**: Modules snap to the first available grid slot, with width checks and warnings when the rack is too narrow.
- **CSS unification**: Merged `App.css` and `vcv-style.css` into single `src/styles.css` (~12% reduction, 25 organized sections).
- **VCV UI tweaks**: Waveform buttons are icon-only/white, scope fills its panel, and module badges are consistent across sizes.
- **Module drag**: Drag modules by the header to reposition them on the grid without pushing other modules.
- **Drag helpers**: Ghost preview with invalid highlight, auto-scroll while dragging, and ESC to cancel.
- **UI refactor**: Split `App.tsx` UI into focused components and hooks (`ModuleControls`, `TopBar`, `RackView`, `SidePanel`, `PatchLayer`, `usePatching`, `useModuleDrag`, `useControlVoices`, `useMidi`, `useMarioSequencer`).
- **Tauri wiring**: Updated `src-tauri/tauri.conf.json` to use Vite defaults and added npm `tauri:*` scripts.
- **Auto layout**: Button in Module Library to repack modules into the first available slots.
- **Scope module rewrite**:
  - 3 visualization modes: oscilloscope, FFT analyzer, spectrogram.
  - 4 input channels (A/B for audio, C/D for CV) with color-coded toggle buttons.
  - 2 thru outputs for non-destructive signal monitoring.
  - Expanded gain range (0.5x, 1x, 2x, 5x, 10x).
  - Efficient rendering (only active mode draws).
- **Rust workspace scaffold**: `crates/dsp-core`, `crates/dsp-wasm`, `crates/dsp-standalone`, `crates/dsp-plugin` (VST), `crates/dsp-ipc` (shared memory bridge), `crates/dsp-graph` (shared graph engine).
- **Standalone/Tauri bridge scaffolds**: `dsp-standalone` now lists audio/MIDI devices (cpal/midir) with an optional test tone; Tauri exposes `dsp_ping`, `list_audio_outputs`, and `list_midi_inputs` commands.
- **DSP graph shared crate**: `dsp-graph` now hosts the Rust graph engine (shared by WASM and Tauri).
- **Tauri native audio controls**: UI panel can sync the current graph and start/stop native playback on a selected output device.
- **Native scope bridge**: Tauri can stream scope taps to the UI for oscilloscope/FFT/spectrogram when running native audio.
- **Unified transport**: Top bar Power On/Off now controls native audio in Tauri and Web Audio in browser mode.
- **WASM graph engine**: single worklet now runs the full DSP graph in Rust, including Control IO + Mod VCA; scope inputs are tapped via worklet outputs.
- **WASM cleanup**: removed per-module WASM worklets/toggles; the graph engine is the only DSP path.
- **Jupiter essentials**: added Noise + HPF modules, plus VCO sub output with sub mix, and band-limited VCO waveforms.
- **VCF ladder model**: added ladder option for the VCF (LP-focused) alongside SVF.
- **Preset sync (native)**: loading presets now syncs the native DSP graph in Tauri mode.
- **Graph sync (native/VST)**: debounced UI -> engine sync for module/connection changes (with VST pull suppression).
- **Mario IO (native)**: sequencer now runs when native audio is active.
- **VCO layout**: VCO module resized to 2x3 for extra controls.
- **Hard sync**: VCO now exposes sync output for oscillator hard sync patching.
- **Sequencer pattern**: Control IO uses an 8-step DO-SOL-SIb-SOL-DO-SIb-SOL-FA loop for the demo arp.
- **VCF 24 dB tuning**: reduced resonance/drive gain to improve stability.
- **Preset UX**: Presets are grouped by category with collapsible sections and a compact view toggle.
- **Top bar layout**: Brand block separated from transport/status with engine indicator.
- **8-Bit Mario preset**: NES-authentic 5-channel setup with 8 NES Mario songs + 3 SNES songs (SMW Overworld, Zelda LTTP Intro, Zelda Dark World).
- **NES Osc module**: 2A03 chip emulation with authentic pulse duty cycles (12.5/25/50/75%), 4-bit stepped triangle, 15-bit LFSR noise, and 7-bit DAC quantization.
- **SNES Osc module**: S-DSP inspired with 8 wavetables, gaussian interpolation filter, and 32kHz lo-fi effect.

## How to update

- Keep this file short and factual.
- Update TODOs when completed.
- Note any breaking changes or new modules.
