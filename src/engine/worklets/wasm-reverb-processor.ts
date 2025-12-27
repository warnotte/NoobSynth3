import init, { WasmReverb } from './wasm/dsp_wasm_wrapper'
import wasmDataUrl from './wasm/dsp_wasm_bg.wasm?inline'

const decodeBase64 = (base64: string) => {
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, '')
  if (typeof atob === 'function') {
    const binary = atob(cleaned)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let buffer = 0
  let bits = 0
  const output: number[] = []
  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i]
    if (!char || char === '=') {
      break
    }
    const value = chars.indexOf(char)
    if (value < 0) {
      continue
    }
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      output.push((buffer >> bits) & 0xff)
    }
  }
  return new Uint8Array(output)
}

const decodeWasmDataUrl = (dataUrl: string) => {
  const comma = dataUrl.indexOf(',')
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  return decodeBase64(base64)
}

const EMPTY_INPUT = new Float32Array()

class WasmReverbProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'time',
        defaultValue: 0.62,
        minValue: 0.1,
        maxValue: 0.98,
        automationRate: 'k-rate',
      },
      {
        name: 'damp',
        defaultValue: 0.4,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'preDelay',
        defaultValue: 18,
        minValue: 0,
        maxValue: 80,
        automationRate: 'k-rate',
      },
      {
        name: 'mix',
        defaultValue: 0.25,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
    ]
  }

  private reverb: InstanceType<NonNullable<typeof WasmReverb>> | null = null
  private ready = false
  private fallbackWarned = false

  constructor() {
    super()
    void this.initWasm()
  }

  private async initWasm() {
    try {
      const bytes = decodeWasmDataUrl(wasmDataUrl)
      await init({ module_or_path: bytes })
      if (WasmReverb) {
        this.reverb = new WasmReverb(sampleRate)
        this.ready = true
      } else {
        this.ready = false
        console.warn('WASM Reverb missing; falling back to JS.')
      }
    } catch (error) {
      console.error('WASM Reverb init failed', error)
      this.ready = false
    }
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0]
    if (!output || output.length === 0) {
      return true
    }

    const input = inputs[0]
    const inputL = input?.[0] ?? EMPTY_INPUT
    const inputR = input?.[1] ?? input?.[0] ?? EMPTY_INPUT
    const outL = output[0]
    const outR = output[1] ?? output[0]

    const timeParam = parameters.time ?? EMPTY_INPUT
    const dampParam = parameters.damp ?? EMPTY_INPUT
    const preDelayParam = parameters.preDelay ?? EMPTY_INPUT
    const mixParam = parameters.mix ?? EMPTY_INPUT

    const sampleCount = outL.length

    if (!this.ready || !this.reverb) {
      if (!this.fallbackWarned) {
        console.warn('WASM Reverb not ready; outputting silence (fallback).')
        this.fallbackWarned = true
      }
      for (let i = 0; i < sampleCount; i += 1) {
        outL[i] = 0
        outR[i] = 0
      }
      return true
    }

    const block = this.reverb.render(
      inputL,
      inputR,
      timeParam,
      dampParam,
      preDelayParam,
      mixParam,
      sampleCount,
    )

    if (!block || block.length < sampleCount * 2) {
      if (!this.fallbackWarned) {
        console.warn('WASM Reverb returned invalid data; outputting silence (fallback).')
        this.fallbackWarned = true
      }
      for (let i = 0; i < sampleCount; i += 1) {
        outL[i] = 0
        outR[i] = 0
      }
      return true
    }

    for (let i = 0; i < sampleCount; i += 1) {
      const idx = i * 2
      outL[i] = block[idx] ?? 0
      outR[i] = block[idx + 1] ?? 0
    }

    return true
  }
}

registerProcessor('wasm-reverb-processor', WasmReverbProcessor)
