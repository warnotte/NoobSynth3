# dsp-wasm

Bindings WebAssembly pour exécuter le DSP dans un navigateur via AudioWorklet.

## Build

```bash
npm run build:wasm
# ou
cd crates/dsp-wasm
wasm-pack build --target web --out-dir ../../src/engine/worklets/wasm
```

## Artefacts générés

```
src/engine/worklets/wasm/
├── dsp_wasm.js       # Glue code JS
├── dsp_wasm_bg.wasm  # Module WASM compilé
└── dsp_wasm.d.ts     # Types TypeScript
```

## Utilisation côté JS

```javascript
import init, { WasmGraphEngine } from './wasm/dsp_wasm.js';

await init();

const engine = new WasmGraphEngine(44100, 128);
engine.set_graph_json(graphJson);

// Dans l'AudioWorklet
const left = new Float32Array(128);
const right = new Float32Array(128);
engine.process(left, right);
```

## Interface exportée

```rust
#[wasm_bindgen]
pub struct WasmGraphEngine {
    // ...
}

#[wasm_bindgen]
impl WasmGraphEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32, block_size: usize) -> Self;

    pub fn set_graph_json(&mut self, json: &str) -> Result<(), JsValue>;
    pub fn set_param(&mut self, module_id: &str, param: &str, value: f32);
    pub fn note_on(&mut self, note: u8, velocity: f32);
    pub fn note_off(&mut self, note: u8);
    pub fn process(&mut self, left: &mut [f32], right: &mut [f32]);
    pub fn get_scope_data(&self) -> Vec<f32>;
}
```

## Optimisations

- Compilé avec `opt-level = 3` et `lto = true`
- Pas d'allocations dans la boucle audio
- SIMD automatique via LLVM
