import './text-decoder-polyfill'
import init, * as wasm from './dsp_wasm.js'

type WasmGraphEngineCtor = new (sampleRate: number) => {
  set_graph(graphJson: string): void
  set_param(moduleId: string, paramId: string, value: number): void
  set_param_string(moduleId: string, paramId: string, value: string): void
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
  set_external_input(input: Float32Array): void
  clear_external_input(): void
  render(frames: number): Float32Array
  get_sequencer_step(moduleId: string): number
  get_midi_total_ticks(moduleId: string): number
  seek_midi_sequencer(moduleId: string, tick: number): void
  drain_midi_events(moduleId: string): Uint8Array
  load_granular_buffer(moduleId: string, data: Float32Array): void
  get_granular_buffer_length(moduleId: string): number
  get_granular_position(moduleId: string): number
  get_granular_waveform(moduleId: string, maxPoints: number): Float32Array
  load_sid_file(moduleId: string, data: Uint8Array): void
  get_sid_voice_states(moduleId: string): Uint16Array
  get_sid_elapsed(moduleId: string): number
  load_ym_file(moduleId: string, data: Uint8Array): void
  get_ay_voice_states(moduleId: string): Uint16Array
  get_ay_elapsed(moduleId: string): number
}

const WasmGraphEngine = (wasm as unknown as { WasmGraphEngine?: WasmGraphEngineCtor })
  .WasmGraphEngine

export { WasmGraphEngine }
export default init
