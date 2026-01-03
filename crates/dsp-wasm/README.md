# dsp-wasm

Bindings WebAssembly pour exécuter le DSP dans un navigateur via AudioWorklet.

## Build

```bash
npm run build:wasm
```

Le script `scripts/build-wasm.ps1` utilise `wasm-bindgen` :
```powershell
cargo build -p dsp-wasm --target wasm32-unknown-unknown --release
wasm-bindgen target/.../dsp_wasm.wasm --out-dir src/engine/worklets/wasm --target web
```

## Artefacts générés

```
src/engine/worklets/wasm/
├── dsp_wasm.js           # Glue code JS
└── dsp_wasm_bg.wasm      # Module WASM compilé
```

## Utilisation côté JS

```javascript
import init, { WasmGraphEngine } from './wasm/dsp_wasm.js';

await init();

const engine = new WasmGraphEngine(44100);
engine.set_graph(graphJson);

// Paramètres
engine.set_param("vco-1", "frequency", 440.0);

// Contrôle des voix
engine.set_control_voice_cv("ctrl-1", 0, 0.5);
engine.set_control_voice_gate("ctrl-1", 0, 1.0);
engine.set_control_voice_velocity("ctrl-1", 0, 0.8, 0.01);

// Rendu audio
const samples = engine.render(128); // L, R puis taps mono si présents
```

## Interface exportée

```rust
#[wasm_bindgen]
impl WasmGraphEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Self;

    pub fn set_graph(&mut self, graph_json: &str) -> Result<(), JsValue>;
    pub fn set_param(&mut self, module_id: &str, param_id: &str, value: f32);

    // Contrôle des voix polyphoniques
    pub fn set_control_voice_cv(&mut self, module_id: &str, voice: usize, value: f32);
    pub fn set_control_voice_gate(&mut self, module_id: &str, voice: usize, value: f32);
    pub fn trigger_control_voice_gate(&mut self, module_id: &str, voice: usize);
    pub fn trigger_control_voice_sync(&mut self, module_id: &str, voice: usize);
    pub fn set_control_voice_velocity(&mut self, module_id: &str, voice: usize, value: f32, slew: f32);

    // Mario IO
    pub fn set_mario_channel_cv(&mut self, module_id: &str, channel: usize, value: f32);
    pub fn set_mario_channel_gate(&mut self, module_id: &str, channel: usize, value: f32);

    // Rendu
    pub fn render(&mut self, frames: usize) -> Float32Array;
}
```

## Optimisations

- Compilé avec `opt-level = 3` et `lto = true`
- Pas d'allocations dans la boucle audio
- SIMD automatique via LLVM
