import './text-decoder-polyfill'
import init, * as wasm from './dsp_wasm.js'

type WasmGainCtor = new (sampleRate: number) => {
  render(
    input: Float32Array,
    cv: Float32Array,
    gain: Float32Array,
    frames: number,
  ): Float32Array
}

type WasmLfoCtor = new (sampleRate: number) => {
  render(
    rateCv: Float32Array,
    sync: Float32Array,
    rate: Float32Array,
    shape: Float32Array,
    depth: Float32Array,
    offset: Float32Array,
    bipolar: Float32Array,
    frames: number,
  ): Float32Array
}

type WasmAdsrCtor = new (sampleRate: number) => {
  render(
    gate: Float32Array,
    attack: Float32Array,
    decay: Float32Array,
    sustain: Float32Array,
    release: Float32Array,
    frames: number,
  ): Float32Array
}

const WasmOsc = wasm.WasmOsc
const WasmVco = wasm.WasmVco
const WasmGain = (wasm as unknown as { WasmGain?: WasmGainCtor }).WasmGain
const WasmLfo = (wasm as unknown as { WasmLfo?: WasmLfoCtor }).WasmLfo
const WasmAdsr = (wasm as unknown as { WasmAdsr?: WasmAdsrCtor }).WasmAdsr

export { WasmOsc, WasmVco, WasmGain, WasmLfo, WasmAdsr }
export default init
