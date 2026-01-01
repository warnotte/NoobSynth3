# NoobSynth3

Modular synth workbench built with React + AudioWorklet. Goal: a powerful, patchable synth with a premium UI and a showcase demo sound.

## Features

- **VCV Rack-inspired UI**: Eurorack-style rails, brushed metal panels, compact module layout with configurable grid sizes (1x1, 2x1, 1x2, 2x2, 1x3, 2x3, 2x6) and auto-placement.
- Modular patching with drag-to-connect cables (double-click near a cable to remove it).
- Module library lets you add/remove modules and start a new empty rack.
- AudioWorklet engine (VCO with sub osc + PWM + sync out + audio FM in, Supersaw (7-voice), NES Osc (2A03), SNES Osc (S-DSP), Noise, Mod Router, Ring Mod, HPF + VCF with SVF/ladder models; ladder is LP-only, LFO, ADSR, Mixer 1x1/1x2, VCA, Mod VCA, Chorus, Delay, Reverb, Phaser, Distortion, Scope, Control IO, Mario IO).
- Polyphony (1/2/4/8 voices) with voice stealing and per-voice modulation.
- Control IO with mini keyboard, MIDI input (poly), and a simple sequencer for hands-free auditioning.
- MIDI velocity CV output with optional slew to avoid clicks.
- Preset loader with curated demo patches (plus export/import).
- Stereo chorus to add width and character.
- Native audio mode (Tauri) with output device selection and scope taps (FFT/spectrogram computed in UI).
- **Advanced Scope module (DATA-style)**:
  - 3 visualization modes: Oscilloscope, FFT analyzer, Spectrogram
  - 4 input channels (A, B, C, D) with color-coded toggle buttons
  - 2 thru outputs for signal monitoring without breaking the chain
  - Adjustable gain (0.5x, 1x, 2x, 5x, 10x) and time scale
  - Freeze function for waveform analysis

## Quick start

```bash
npm install
npm run dev
```

Open the app, click Power On, then hit Run in Control IO or play the mini keyboard.

## Building (all targets)

Use the included `build.bat` script to build everything at once:

```batch
build.bat
```

This builds:
1. Frontend (Vite)
2. Tauri standalone app (`noobsynth3.exe`)
3. VST3/CLAP plugin (`noobsynth_vst.dll`)

Output files are in `target\release\`:
- `noobsynth3.exe` - Standalone app with bundled frontend
- `noobsynth_vst.dll` - VST3/CLAP plugin

**Important:** Always use `build.bat` or `npx tauri build` for release builds. Using `cargo build` alone does NOT bundle the frontend and will result in a broken app.

### Clean rebuild

If you encounter issues, do a clean rebuild:

```batch
rmdir /s /q target\release
build.bat
```

## Standalone (Tauri)

Prereqs: Rust toolchain + Tauri system deps installed and `rustc` on PATH.

```bash
npm run tauri:dev
```

In Tauri mode, use the TopBar Power On/Off to start/stop native audio. Use the
Tauri Bridge panel to select the output device and Sync Graph after changes.
MIDI is currently driven by Web MIDI (native MIDI via midir is a TODO).

For a release build:

```bash
npm run tauri:build
```

Release builds use a size-optimized Rust profile (LTO + strip) from the workspace `Cargo.toml`.

## VST3/CLAP Plugin

NoobSynth is available as a VST3/CLAP plugin for use in any DAW (Ableton, FL Studio, Reaper, etc.).
The plugin is currently a **proof of concept** and is still evolving.

### How it works

The VST plugin uses a hybrid architecture:
- **Audio processing**: Runs natively in the DAW via nih-plug
- **UI**: Uses a small host editor that launches the Tauri app on demand
- **IPC**: Shared memory bridge between VST and Tauri for real-time parameter/note sync

### Installation

1. Build using `build.bat` (see above)
2. Copy both files to the same folder:
   - `noobsynth_vst.dll`
   - `noobsynth3.exe`
3. Add the folder to your DAW's VST3 plugin path
4. Scan for new plugins in your DAW

### Usage

1. Load "NoobSynth" as an instrument in your DAW
2. Open the plugin UI in the host and click **Open NoobSynth UI**
3. Play MIDI notes - they're processed by the native VST audio engine
4. Tweak parameters in the UI - changes sync to the VST in real-time
5. Close the UI window when done (plugin keeps running)

### Troubleshooting

**"Waiting for VST plugin..."**: The UI can't connect to the VST. Try:
- Close all instances of NoobSynth and restart your DAW
- Ensure both `.dll` and `.exe` are in the same folder
- Check `noobsynth_vst_debug.log` in the plugin folder for details

**Stale shared memory**: If you get connection errors after a crash:
- Restart your computer to clear the shared memory
- Or just reload the plugin (the VST now auto-cleans stale memory)

### Limitations (current)

- VST support is a proof-of-concept and may evolve rapidly
- Host editor is a launcher (the full UI is a separate Tauri window)
- Oscilloscope not yet working in VST mode
- UI must be in the same folder as the DLL
- One instance at a time recommended

## How to use

- Patch by dragging from a jack to another matching jack.
- Drag from a connected input to empty space to unplug.
- Double-click near a cable to remove it.
- Control IO:
  - Gate button is momentary.
  - Mini keyboard sends CV + Gate.
  - MIDI panel lets you select an input/channel and enables velocity output.
  - Voices selector controls polyphony.
  - Avoid rapidly switching voice counts while the engine is running.
  - Sequencer can Run/Stop and is useful for live tweaking.
- Module Library:
  - Click a module chip to add it.
  - Drag a module by its header to reposition it on the grid (no auto-push).
  - Use Auto Layout to repack modules into the first available slots.
  - Use New Rack to clear all modules.
  - Remove modules from their header.
  - Control IO and Main Out are limited to one instance.

## Presets

Use the Presets panel to load curated demo patches. Presets are listed in
`public/presets/manifest.json` and loaded from `public/presets/*.json`. Some presets also
change patch routing (full graph replacement).

**24 presets available:**
- Classic emulations: Juno-106 Strings, Minimoog Lead, Prophet-5 Brass, OB-Xa Pad, CS-80 Vangelis, Moog Taurus, SH-101 Bass, ARP Odyssey Sync
- New modules showcase: **Trance Supersaw** (7-voice), **Phaser Pad** (stereo phaser), **Dirty Bass** (foldback distortion)
- Notables: Jupiter-8 Demo (sub/noise/HPF), Hard Sync Lead (VCO sync), Ladder Lead (LP ladder drive)
- Fun: **8-Bit Mario** (NES/SNES 5-channel with 11 classic tunes including Zelda)

Dev/test presets (Mod Router Demo, Ring Mod Demo, VCO A/B, VCA A/B) live in `public/presets/manifest-dev.json`.
The Presets panel groups entries by category with collapsible sections and a compact toggle.

## Architecture

Les 3 cibles possibles
```
                          ┌─────────────────────┐
                          │    dsp-core (Rust)  │
                          │   Code DSP partagé  │
                          └──────────┬──────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
     ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
     │  dsp-wasm   │         │dsp-standalone│        │  dsp-plugin │
     │ (crate)     │         │   (crate)    │        │   (crate)   │
     └──────┬──────┘         └──────┬───────┘        └──────┬──────┘
            │                       │                       │
            ▼                       ▼                       ▼
     ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
     │    WEB      │         │  STANDALONE │        │   VST/AU    │
     └─────────────┘         └─────────────┘         └─────────────┘
```

1. Version Web (actuelle)

```
│                      NAVIGATEUR                          │
├────────────────────────┬─────────────────────────────────┤
│      Main Thread       │        Audio Thread             │
│                        │                                 │
│   ┌──────────────┐     │     ┌─────────────────┐        │
│   │  React UI    │     │     │  AudioWorklet   │        │
│   │  (HTML/CSS)  │     │     │  + WASM         │        │
│   └──────────────┘     │     └─────────────────┘        │
│                        │                                 │
└────────────────────────┴─────────────────────────────────┘
```

2. Version Standalone (Tauri)

```
┌──────────────────────────────────────────────────────────┐
│                    NoobSynth.exe                         │
│                    (15-20 MB)                            │
├────────────────────────┬─────────────────────────────────┤
│       WEBVIEW          │         RUST NATIF              │
│    (UI identique)      │      (Audio natif)              │
│                        │                                 │
│   ┌──────────────┐     │     ┌─────────────────┐        │
│   │  React UI    │ ◄───┼───► │  dsp-core       │        │
│   │  (HTML/CSS)  │  IPC│     │  + cpal         │        │
│   └──────────────┘     │     └────────┬────────┘        │
│                        │              │                 │
│                        │              ▼                 │
│                        │     ┌─────────────────┐        │
│                        │     │ WASAPI / ALSA   │        │
│                        │     │ (driver audio)  │        │
│                        │     └─────────────────┘        │
└────────────────────────┴─────────────────────────────────┘
```

3. Version VST/AU (plugin)

```
┌──────────────────────────────────────────────────────────┐
│                       DAW HOST                           │
├──────────────────────────────────────────────────────────┤
│   ┌──────────────────────────────────────────────────┐   │
│   │               NoobSynth Plugin                   │   │
│   │                                                  │   │
│   │  UI (webview/egui)   │   DSP (dsp-core native)    │   │
│   │                      │   + plugin wrapper         │   │
│   └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```



- Graph schema + defaults: `src/shared/graph.ts`, `src/state/defaultGraph.ts`
- Presets: `public/presets/manifest.json`, `public/presets/*.json` (export/import lives in the UI)
- UI layout + controls: `src/App.tsx`, `src/ui/*`
- UI hooks: `src/hooks/usePatching.tsx`, `src/hooks/useModuleDrag.ts`, `src/hooks/useControlVoices.ts`, `src/hooks/useMidi.ts`, `src/hooks/useMarioSequencer.ts`
- Main-thread engine wrapper: `src/engine/WasmGraphEngine.ts` (loads the worklet, sends graph/params, manages tap outputs)
- Audio worklet: `src/engine/worklets/wasm-graph-processor.ts`
- Rust DSP: `crates/dsp-core` (DSP building blocks), `crates/dsp-graph` (shared graph engine), `crates/dsp-wasm` (WASM bindings)
- WASM build: `scripts/build-wasm.ps1` generates `src/engine/worklets/wasm/dsp_wasm.js` + `dsp_wasm_bg.wasm`

## Testing

```bash
npx tsc -p tsconfig.app.json --noEmit
```

## WASM DSP (primary engine)

This repo includes a Rust DSP workspace and a single **WASM graph**
AudioWorklet that runs the full DSP graph in Rust. The app uses this
engine by default.

Build the WASM artifacts:

```bash
npm run build:wasm
```

This generates `src/engine/worklets/wasm/dsp_wasm.js` and `dsp_wasm_bg.wasm`,
used by `wasm-graph-processor` for the full graph.

If you only change UI code, you do not need to rebuild WASM. Rebuild only
after changing Rust DSP code.

### Preset batch export (dev)

With the dev server running, open the browser console and run:

```js
window.noobSynthExportPresets({ durationMs: 5000 })
```

This records each preset for 5 seconds and downloads `.webm` files locally.

## Roadmap

- MIDI enhancements (pitch bend, CC mapping).
- More filter models and oversampling.
- Native MIDI via midir for Tauri (lower latency).

See `PROJECT_NOTES.md` for current status and TODOs.
