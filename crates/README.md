# Rust crates

- `dsp-core`: DSP logic shared across targets.
- `dsp-graph`: Shared graph engine (parses/executes patch graphs) used by WASM + Tauri.
- `dsp-wasm`: Web/WASM host glue + single graph engine for AudioWorklet.
- `dsp-standalone`: Native desktop host (cpal + midir scaffold).
- `dsp-plugin`: Plugin host (nih-plug or VST3 target later).
- WASM artifacts are built via `npm run build:wasm` (see `scripts/build-wasm.ps1`).
