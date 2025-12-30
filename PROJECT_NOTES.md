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

**Modulation:**
- LFO (sine/triangle/saw/square, bipolar/unipolar)
- ADSR (amp/filter envelopes)
- Mod Router (CV in, 4 CV outs with depth)
- Mod VCA (CV multiplier)

**Filters:**
- VCF (SVF + ladder models, LP/HP/BP/Notch, 12/24 dB)
- HPF (simple high-pass)

**Effects:**
- Chorus (stereo, Juno-style)
- Delay (stereo, ping-pong option)
- Reverb (stereo, Freeverb-style)
- Phaser (4-stage stereo allpass with LFO)
- Distortion (soft clip / hard clip / foldback modes)

**Utilities:**
- Ring Mod (audio A x audio B)
- VCA (CV input)
- Mixer 1x1 (A/B)
- Mixer 1x2 (A-F)
- Scope (DATA-style: oscilloscope/FFT/spectrogram, 4 inputs, 2 thru outputs)
- Control IO (CV/Gate/Sync + mini sequencer + glide + MIDI)
- Mario IO (seasonal/fun)
- Lab Panel (test module)

## Presets (24 total)

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

## Recent changes (Dec 2025)

- **New DSP modules**: Supersaw (7 detuned voices), Phaser (4-stage stereo), Distortion (soft/hard/fold).
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
- **Rust workspace scaffold**: `crates/dsp-core`, `crates/dsp-wasm`, `crates/dsp-standalone`, `crates/dsp-plugin`.
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
