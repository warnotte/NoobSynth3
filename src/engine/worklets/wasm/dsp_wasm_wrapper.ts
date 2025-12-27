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

const WasmOsc = wasm.WasmOsc
const WasmVco = wasm.WasmVco
const WasmGain = (wasm as unknown as { WasmGain?: WasmGainCtor }).WasmGain

export { WasmOsc, WasmVco, WasmGain }
export default init
