import init, { WasmAdsr } from './wasm/dsp_wasm_wrapper'
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

class WasmAdsrProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'attack',
        defaultValue: 0.02,
        minValue: 0,
        maxValue: 10,
        automationRate: 'k-rate',
      },
      {
        name: 'decay',
        defaultValue: 0.2,
        minValue: 0,
        maxValue: 10,
        automationRate: 'k-rate',
      },
      {
        name: 'sustain',
        defaultValue: 0.65,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'release',
        defaultValue: 0.4,
        minValue: 0,
        maxValue: 10,
        automationRate: 'k-rate',
      },
    ]
  }

  private adsr: InstanceType<NonNullable<typeof WasmAdsr>> | null = null
  private ready = false

  constructor() {
    super()
    void this.initWasm()
  }

  private async initWasm() {
    try {
      const bytes = decodeWasmDataUrl(wasmDataUrl)
      await init({ module_or_path: bytes })
      if (WasmAdsr) {
        this.adsr = new WasmAdsr(sampleRate)
        this.ready = true
      } else {
        this.ready = false
        console.warn('WASM ADSR missing; falling back to JS.')
      }
    } catch (error) {
      console.error('WASM ADSR init failed', error)
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

    const sampleCount = output[0].length
    if (!this.ready || !this.adsr) {
      for (let channel = 0; channel < output.length; channel += 1) {
        output[channel].fill(0)
      }
      return true
    }

    const gateInput = inputs[0]?.[0] ?? EMPTY_INPUT
    const attackParam = parameters.attack ?? EMPTY_INPUT
    const decayParam = parameters.decay ?? EMPTY_INPUT
    const sustainParam = parameters.sustain ?? EMPTY_INPUT
    const releaseParam = parameters.release ?? EMPTY_INPUT

    const block = this.adsr.render(
      gateInput,
      attackParam,
      decayParam,
      sustainParam,
      releaseParam,
      sampleCount,
    )

    for (let channel = 0; channel < output.length; channel += 1) {
      output[channel].set(block)
    }

    return true
  }
}

registerProcessor('wasm-adsr-processor', WasmAdsrProcessor)
