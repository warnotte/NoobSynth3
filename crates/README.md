# Rust crates

- `dsp-core`: DSP logic shared across targets.
  - VCO (polyBLEP, unison, sub, FM, sync)
  - Supersaw (7 detuned voices)
  - Noise (white/pink/brown)
  - VCF (SVF + ladder models)
  - LFO, ADSR, Mixer
  - Chorus, Delay, Reverb
  - Phaser (4-stage stereo allpass)
  - Distortion (soft/hard/foldback)
  - Ring Mod, VCA
- `dsp-graph`: Shared graph engine (parses/executes patch graphs) used by WASM + Tauri.
- `dsp-wasm`: Web/WASM host glue + single graph engine for AudioWorklet.
- `dsp-standalone`: Native desktop host (cpal + midir scaffold).
- `dsp-plugin`: Plugin host (VST3/CLAP proof-of-concept with NIH-plug).
- WASM artifacts are built via `npm run build:wasm` (see `scripts/build-wasm.ps1`).
