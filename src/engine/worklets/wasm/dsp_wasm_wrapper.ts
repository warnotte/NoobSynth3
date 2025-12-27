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

type WasmVcfCtor = new (sampleRate: number) => {
  render(
    audio: Float32Array,
    modIn: Float32Array,
    env: Float32Array,
    key: Float32Array,
    cutoff: Float32Array,
    resonance: Float32Array,
    drive: Float32Array,
    envAmount: Float32Array,
    modAmount: Float32Array,
    keyTrack: Float32Array,
    mode: Float32Array,
    slope: Float32Array,
    frames: number,
  ): Float32Array
}

type WasmMixerCtor = new (sampleRate: number) => {
  render(
    inputA: Float32Array,
    inputB: Float32Array,
    levelA: Float32Array,
    levelB: Float32Array,
    frames: number,
  ): Float32Array
}

type WasmDelayCtor = new (sampleRate: number) => {
  render(
    inputL: Float32Array,
    inputR: Float32Array,
    timeMs: Float32Array,
    feedback: Float32Array,
    mix: Float32Array,
    tone: Float32Array,
    pingPong: Float32Array,
    frames: number,
  ): Float32Array
}

type WasmChorusCtor = new (sampleRate: number) => {
  render(
    inputL: Float32Array,
    inputR: Float32Array,
    rate: Float32Array,
    depthMs: Float32Array,
    delayMs: Float32Array,
    mix: Float32Array,
    feedback: Float32Array,
    spread: Float32Array,
    frames: number,
  ): Float32Array
}

type WasmReverbCtor = new (sampleRate: number) => {
  render(
    inputL: Float32Array,
    inputR: Float32Array,
    time: Float32Array,
    damp: Float32Array,
    preDelay: Float32Array,
    mix: Float32Array,
    frames: number,
  ): Float32Array
}

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

const WasmOsc = wasm.WasmOsc
const WasmVco = wasm.WasmVco
const WasmGain = (wasm as unknown as { WasmGain?: WasmGainCtor }).WasmGain
const WasmLfo = (wasm as unknown as { WasmLfo?: WasmLfoCtor }).WasmLfo
const WasmAdsr = (wasm as unknown as { WasmAdsr?: WasmAdsrCtor }).WasmAdsr
const WasmVcf = (wasm as unknown as { WasmVcf?: WasmVcfCtor }).WasmVcf
const WasmMixer = (wasm as unknown as { WasmMixer?: WasmMixerCtor }).WasmMixer
const WasmDelay = (wasm as unknown as { WasmDelay?: WasmDelayCtor }).WasmDelay
const WasmChorus = (wasm as unknown as { WasmChorus?: WasmChorusCtor }).WasmChorus
const WasmReverb = (wasm as unknown as { WasmReverb?: WasmReverbCtor }).WasmReverb
const WasmGraphEngine = (wasm as unknown as { WasmGraphEngine?: WasmGraphEngineCtor })
  .WasmGraphEngine

export {
  WasmOsc,
  WasmVco,
  WasmGain,
  WasmLfo,
  WasmAdsr,
  WasmVcf,
  WasmMixer,
  WasmDelay,
  WasmChorus,
  WasmReverb,
  WasmGraphEngine,
}
export default init
