import init, { WasmLfo } from './wasm/dsp_wasm_wrapper'
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

class WasmLfoProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'rate',
        defaultValue: 2,
        minValue: 0.01,
        maxValue: 40,
        automationRate: 'a-rate',
      },
      {
        name: 'shape',
        defaultValue: 0,
        minValue: 0,
        maxValue: 3,
        automationRate: 'k-rate',
      },
      {
        name: 'depth',
        defaultValue: 0.7,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'offset',
        defaultValue: 0,
        minValue: -1,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'bipolar',
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
    ]
  }

  private lfo: InstanceType<NonNullable<typeof WasmLfo>> | null = null
  private ready = false

  constructor() {
    super()
    void this.initWasm()
  }

  private async initWasm() {
    try {
      const bytes = decodeWasmDataUrl(wasmDataUrl)
      await init({ module_or_path: bytes })
      if (WasmLfo) {
        this.lfo = new WasmLfo(sampleRate)
        this.ready = true
      } else {
        this.ready = false
        console.warn('WASM LFO missing; falling back to JS.')
      }
    } catch (error) {
      console.error('WASM LFO init failed', error)
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
    if (!this.ready || !this.lfo) {
      for (let channel = 0; channel < output.length; channel += 1) {
        output[channel].fill(0)
      }
      return true
    }

    const rateInput = inputs[0]?.[0] ?? EMPTY_INPUT
    const syncInput = inputs[1]?.[0] ?? EMPTY_INPUT
    const rateParam = parameters.rate ?? EMPTY_INPUT
    const shapeParam = parameters.shape ?? EMPTY_INPUT
    const depthParam = parameters.depth ?? EMPTY_INPUT
    const offsetParam = parameters.offset ?? EMPTY_INPUT
    const bipolarParam = parameters.bipolar ?? EMPTY_INPUT

    const block = this.lfo.render(
      rateInput,
      syncInput,
      rateParam,
      shapeParam,
      depthParam,
      offsetParam,
      bipolarParam,
      sampleCount,
    )

    for (let channel = 0; channel < output.length; channel += 1) {
      output[channel].set(block)
    }

    return true
  }
}

registerProcessor('wasm-lfo-processor', WasmLfoProcessor)
