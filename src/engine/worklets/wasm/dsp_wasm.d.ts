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
