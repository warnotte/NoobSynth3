# Project Notes (auto-read)

This file is meant to be reread by the coding assistant to keep context, decisions, and TODOs.

## Snapshot

- UI: React + TS + Vite.
- Audio: AudioWorklet graph in `src/engine`.
- Patching: drag-to-connect, double-click cable to remove.
- Default demo: Jupiter Pad style patch with chorus and sequencer.
- FX: global delay + reverb after chorus (mix controls for bypass).
- MIDI: Web MIDI input wired to Control IO (poly voice allocation) with velocity CV out + MIDI-only velocity slew.
- Polyphony: 1/2/4/8 voices, per-voice VCO/LFO/VCF/ADSR/VCA/Mod VCA, global chorus/delay/reverb/out.

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
- Scope
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

## TODO (short list)

- Refine VCF 24 dB stability.
- Optional: expand sequencer (8 steps, per-step toggles).
- MIDI enhancements (pitch bend, CC mapping).

## How to update

- Keep this file short and factual.
- Update TODOs when completed.
- Note any breaking changes or new modules.
