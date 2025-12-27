import init, { WasmChorus } from './wasm/dsp_wasm_wrapper'
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

class WasmChorusProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'rate',
        defaultValue: 0.3,
        minValue: 0.05,
        maxValue: 6,
        automationRate: 'a-rate',
      },
      {
        name: 'depth',
        defaultValue: 8,
        minValue: 0,
        maxValue: 20,
        automationRate: 'a-rate',
      },
      {
        name: 'delay',
        defaultValue: 18,
        minValue: 4,
        maxValue: 30,
        automationRate: 'a-rate',
      },
      {
        name: 'mix',
        defaultValue: 0.45,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'feedback',
        defaultValue: 0.15,
        minValue: 0,
        maxValue: 0.4,
        automationRate: 'a-rate',
      },
      {
        name: 'spread',
        defaultValue: 0.6,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
    ]
  }

  private chorus: InstanceType<NonNullable<typeof WasmChorus>> | null = null
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
      if (WasmChorus) {
        this.chorus = new WasmChorus(sampleRate)
        this.ready = true
      } else {
        this.ready = false
        console.warn('WASM Chorus missing; falling back to JS.')
      }
    } catch (error) {
      console.error('WASM Chorus init failed', error)
      this.ready = false
    }
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0]
    if (!output || output.length < 2) {
      return true
    }

    const input = inputs[0]
    const inputL = input?.[0] ?? EMPTY_INPUT
    const inputR = input?.[1] ?? input?.[0] ?? EMPTY_INPUT

    const rateParam = parameters.rate ?? EMPTY_INPUT
    const depthParam = parameters.depth ?? EMPTY_INPUT
    const delayParam = parameters.delay ?? EMPTY_INPUT
    const mixParam = parameters.mix ?? EMPTY_INPUT
    const feedbackParam = parameters.feedback ?? EMPTY_INPUT
    const spreadParam = parameters.spread ?? EMPTY_INPUT

    const sampleCount = output[0].length

    if (!this.ready || !this.chorus) {
      if (!this.fallbackWarned) {
        console.warn('WASM Chorus not ready; outputting silence (fallback).')
        this.fallbackWarned = true
      }
      for (let i = 0; i < sampleCount; i += 1) {
        output[0][i] = 0
        output[1][i] = 0
      }
      return true
    }

    const block = this.chorus.render(
      inputL,
      inputR,
      rateParam,
      depthParam,
      delayParam,
      mixParam,
      feedbackParam,
      spreadParam,
      sampleCount,
    )

    if (!block || block.length < sampleCount * 2) {
      if (!this.fallbackWarned) {
        console.warn('WASM Chorus returned invalid data; outputting silence (fallback).')
        this.fallbackWarned = true
      }
      for (let i = 0; i < sampleCount; i += 1) {
        output[0][i] = 0
        output[1][i] = 0
      }
      return true
    }

    for (let i = 0; i < sampleCount; i += 1) {
      const idx = i * 2
      output[0][i] = block[idx] ?? 0
      output[1][i] = block[idx + 1] ?? 0
    }

    return true
  }
}

registerProcessor('wasm-chorus-processor', WasmChorusProcessor)
