# Project Notes (auto-read)

This file is meant to be reread by the coding assistant to keep context, decisions, and TODOs.

## Snapshot

- UI: React + TS + Vite.
- Audio: AudioWorklet graph in `src/engine`.
- Patching: drag-to-connect, double-click cable to remove.
- Default demo: Jupiter Pad style patch with chorus and sequencer.
- MIDI: Web MIDI input wired to Control IO (mono, last-note priority) with velocity CV out + MIDI-only velocity slew.

## Current modules

- VCO (with unison + detune)
- LFO
- VCF (SVF only, 12/24 dB)
- ADSR
- VCA (CV input)
- Mod VCA (CV multiplier)
- Mixer (A/B)
- Chorus (stereo)
- Scope
- Control IO (CV/Gate/Sync + mini sequencer + glide)
- Lab Panel (test module, not in audio chain)

## Presets

- Jupiter Pad
- Jupiter Brass
- PWM Strings

Presets live in `src/state/presets.ts` and are loaded from the Presets panel.

## Known issues / risks

- VCF 24 dB can distort at high resonance. 12 dB sounds more stable.
- No polyphony yet (unison is mono stacking only).
- MIDI is mono-only and disables the mini sequencer when enabled. Velocity can be toggled in Control IO.

## Decisions

- Chorus sits after VCA in the default chain.
- Mini sequencer is enabled by default in presets.
- Lab Panel is kept out of the signal chain (for testing only).

## TODO (short list)

- Polyphony + voice allocation.
- Refine VCF 24 dB stability.
- Add reverb for showcase depth.
- Optional: expand sequencer (8 steps, per-step toggles).

## How to update

- Keep this file short and factual.
- Update TODOs when completed.
- Note any breaking changes or new modules.
