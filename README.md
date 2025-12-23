# NoobSynth3

Modular synth workbench built with React + AudioWorklet. Goal: a powerful, patchable synth with a premium UI and a showcase demo sound.

## Features

- Modular patching with drag-to-connect cables (double-click near a cable to remove it).
- AudioWorklet engine (VCO, LFO, VCF, ADSR, Mixer, VCA, Mod VCA, Chorus, Delay, Reverb, Scope, Control IO).
- Polyphony (1/2/4/8 voices) with voice stealing and per-voice modulation.
- Control IO with mini keyboard, MIDI input (poly), and a simple sequencer for hands-free auditioning.
- MIDI velocity CV output with optional slew to avoid clicks.
- Preset loader with curated demo patches (Jupiter Pad, Jupiter Brass, PWM Strings).
- Stereo chorus to add width and character.

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

## Presets

Use the Presets panel to load curated demo patches.

## Architecture

- Audio graph: `src/state/defaultGraph.ts`
- Presets: `src/state/presets.ts`
- Audio engine: `src/engine/AudioEngine.ts`
- Worklets: `src/engine/worklets/*`
- UI: `src/App.tsx`, `src/ui/*`

## Testing

```bash
npx tsc -p tsconfig.app.json --noEmit
```

## Roadmap

- MIDI enhancements (pitch bend, CC mapping).
- Better filter models and oversampling.
- More effects (reverb, delay) and richer presets.

See `PROJECT_NOTES.md` for current status and TODOs.
