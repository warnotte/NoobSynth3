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

- VCO (with unison + detune)
- LFO
- VCF (SVF only, 12/24 dB)
- ADSR
- VCA (CV input)
- Mod VCA (CV multiplier)
- Mixer (A/B)
- Chorus (stereo)
- Delay (stereo)
- Reverb (stereo)
- Scope (DATA-style: oscilloscope/FFT/spectrogram, 4 inputs A/B/C/D, 2 thru outputs, gain 0.5-10x, freeze)
- Control IO (CV/Gate/Sync + mini sequencer + glide)
- Lab Panel (test module, not in audio chain)

## Presets

- Jupiter Pad
- Jupiter Brass
- PWM Strings
- Dream Pad
- Glass Bell
- Moog Bass
- Edge Lead
- 80s Pluck
- Showcase Stack

Presets live in `src/state/presets.ts` and are loaded from the Presets panel. Some presets also adjust routing.

## Known issues / risks

- VCF 24 dB can distort at high resonance. 12 dB sounds more stable.
- Polyphony is implemented; unison remains per-voice.
- MIDI disables the mini sequencer when enabled. Velocity can be toggled in Control IO.
- Rapidly changing voice count while running can cause instability; adjust slowly.

## Decisions

- Chorus sits after VCA in the default chain.
- Mini sequencer is enabled by default in presets.
- Lab Panel is kept out of the signal chain (for testing only).
- VCV Rack-style UI with compact spacing and eurorack aesthetic.
- Scope module uses efficient canvas rendering with mode-specific visualization (only active mode runs).

## TODO (short list)

- Refine VCF 24 dB stability.
- Add macro panel (global knobs driving multiple params).
- Consider drag-and-drop add for modules.
- Optional: expand sequencer (8 steps, per-step toggles).
- MIDI enhancements (pitch bend, CC mapping).

## Recent changes (Dec 2025)

- **VCV Rack-style UI overhaul**: New vcv-style.css with eurorack rails, brushed metal panels, compact spacing.
- **Module sizing system**: Grid-based layout with configurable sizes per module type.
- **Grid auto-placement**: Modules snap to the first available grid slot, with width checks and warnings when the rack is too narrow.
- **VCV CSS cleanup**: Consolidated duplicate styling so VCV-specific selectors live in `src/vcv-style.css` only.
- **VCV UI tweaks**: Waveform buttons are icon-only/white, scope fills its panel, and module badges are consistent across sizes.
- **Scope module rewrite**:
  - 3 visualization modes: oscilloscope, FFT analyzer, spectrogram.
  - 4 input channels (A/B for audio, C/D for CV) with color-coded toggle buttons.
  - 2 thru outputs for non-destructive signal monitoring.
  - Expanded gain range (0.5x, 1x, 2x, 5x, 10x).
  - Efficient rendering (only active mode draws).

## How to update

- Keep this file short and factual.
- Update TODOs when completed.
- Note any breaking changes or new modules.
