export default function init(
  input?:
    | RequestInfo
    | URL
    | Response
    | BufferSource
    | WebAssembly.Module
    | { module_or_path: RequestInfo | URL | Response | BufferSource | WebAssembly.Module },
): Promise<unknown>

export class WasmOsc {
  constructor(sampleRate: number)
  reset(sampleRate: number): void
  set_frequency(freqHz: number): void
  render(frames: number): Float32Array
}

export class WasmVco {
  constructor(sampleRate: number)
  set_sample_rate(sampleRate: number): void
  render(
    pitch: Float32Array,
    fmLin: Float32Array,
    fmExp: Float32Array,
    pwmIn: Float32Array,
    sync: Float32Array,
    baseFreq: Float32Array,
    waveform: Float32Array,
    pwm: Float32Array,
    fmLinDepth: Float32Array,
    fmExpDepth: Float32Array,
    unison: Float32Array,
    detune: Float32Array,
    frames: number,
  ): Float32Array
}

export class WasmGain {
  constructor(sampleRate: number)
  render(
    input: Float32Array,
    cv: Float32Array,
    gain: Float32Array,
    frames: number,
  ): Float32Array
}

export class WasmLfo {
  constructor(sampleRate: number)
  set_sample_rate(sampleRate: number): void
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

export class WasmAdsr {
  constructor(sampleRate: number)
  set_sample_rate(sampleRate: number): void
  render(
    gate: Float32Array,
    attack: Float32Array,
    decay: Float32Array,
    sustain: Float32Array,
    release: Float32Array,
    frames: number,
  ): Float32Array
}

export class WasmVcf {
  constructor(sampleRate: number)
  set_sample_rate(sampleRate: number): void
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

export class WasmMixer {
  constructor(sampleRate: number)
  render(
    inputA: Float32Array,
    inputB: Float32Array,
    levelA: Float32Array,
    levelB: Float32Array,
    frames: number,
  ): Float32Array
}

export class WasmDelay {
  constructor(sampleRate: number)
  set_sample_rate(sampleRate: number): void
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

export class WasmChorus {
  constructor(sampleRate: number)
  set_sample_rate(sampleRate: number): void
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

export class WasmReverb {
  constructor(sampleRate: number)
  set_sample_rate(sampleRate: number): void
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

export class WasmGraphEngine {
  constructor(sampleRate: number)
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
