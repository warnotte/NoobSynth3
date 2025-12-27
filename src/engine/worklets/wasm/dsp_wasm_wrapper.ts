import './text-decoder-polyfill'
import init, * as wasm from './dsp_wasm.js'

type WasmGraphEngineCtor = new (sampleRate: number) => {
  set_graph(graphJson: string): void
  set_param(moduleId: string, paramId: string, value: number): void
  set_control_voice_cv(moduleId: string, voice: number, value: number): void
  set_control_voice_gate(moduleId: string, voice: number, value: number): void
  trigger_control_voice_gate(moduleId: string, voice: number): void
  trigger_control_voice_sync(moduleId: string, voice: number): void
  set_control_voice_velocity(
    moduleId: string,
    voice: number,
    value: number,
    slewSeconds: number,
  ): void
  set_mario_channel_cv(moduleId: string, channel: number, value: number): void
  set_mario_channel_gate(moduleId: string, channel: number, value: number): void
  render(frames: number): Float32Array
}

const WasmGraphEngine = (wasm as unknown as { WasmGraphEngine?: WasmGraphEngineCtor })
  .WasmGraphEngine

export { WasmGraphEngine }
export default init
