# NoobSynth3

Modular synth workbench built with React + AudioWorklet. Goal: a powerful, patchable synth with a premium UI and a showcase demo sound.

## Features

- **VCV Rack-inspired UI**: Eurorack-style rails, brushed metal panels, compact module layout with configurable grid sizes (1x1, 2x1, 1x2, 2x2, 1x3, 2x3, 2x6) and auto-placement.
- Modular patching with drag-to-connect cables (double-click near a cable to remove it).
- Module library lets you add/remove modules and start a new empty rack.
- AudioWorklet engine (VCO, LFO, VCF, ADSR, Mixer, VCA, Mod VCA, Chorus, Delay, Reverb, Scope, Control IO).
- Polyphony (1/2/4/8 voices) with voice stealing and per-voice modulation.
- Control IO with mini keyboard, MIDI input (poly), and a simple sequencer for hands-free auditioning.
- MIDI velocity CV output with optional slew to avoid clicks.
- Preset loader with curated demo patches (plus export/import).
- Stereo chorus to add width and character.
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
change patch routing.

## Architecture

```
UI (React) ──► WasmGraphEngine ──► wasm-graph-processor ──► Rust DSP graph ──► Audio Out
                     │
                     └──────────── tap outputs (Scope A/B/C/D)
```

- Graph schema + defaults: `src/shared/graph.ts`, `src/state/defaultGraph.ts`
- Presets: `public/presets/manifest.json`, `public/presets/*.json` (export/import lives in the UI)
- UI + state: `src/App.tsx`, `src/ui/*`
- Main-thread engine wrapper: `src/engine/WasmGraphEngine.ts` (loads the worklet, sends graph/params, manages tap outputs)
- Audio worklet: `src/engine/worklets/wasm-graph-processor.ts`
- Rust DSP: `crates/dsp-core` (DSP building blocks), `crates/dsp-wasm` (WASM bindings + graph engine)
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
- Better filter models and oversampling.
- More effects (reverb, delay) and richer presets.

See `PROJECT_NOTES.md` for current status and TODOs.
