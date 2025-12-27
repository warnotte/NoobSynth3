import init, { WasmMixer } from './wasm/dsp_wasm_wrapper'
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

class WasmMixerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'levelA',
        defaultValue: 0.6,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'levelB',
        defaultValue: 0.6,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
    ]
  }

  private mixer: InstanceType<NonNullable<typeof WasmMixer>> | null = null
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
      if (WasmMixer) {
        this.mixer = new WasmMixer(sampleRate)
        this.ready = true
      } else {
        this.ready = false
        console.warn('WASM Mixer missing; falling back to JS.')
      }
    } catch (error) {
      console.error('WASM Mixer init failed', error)
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

    const inputA = inputs[0]?.[0]
    const inputB = inputs[1]?.[0]
    const levelsA = parameters.levelA ?? EMPTY_INPUT
    const levelsB = parameters.levelB ?? EMPTY_INPUT
    const channelCount = output.length
    const sampleCount = output[0].length

    if (!this.ready || !this.mixer) {
      if (!this.fallbackWarned) {
        console.warn('WASM Mixer not ready; using JS fallback.')
        this.fallbackWarned = true
      }
      this.processFallback(output, inputA, inputB, levelsA, levelsB, channelCount, sampleCount)
      return true
    }

    const block = this.mixer.render(
      inputA ?? EMPTY_INPUT,
      inputB ?? EMPTY_INPUT,
      levelsA,
      levelsB,
      sampleCount,
    )

    if (!block || block.length < sampleCount) {
      if (!this.fallbackWarned) {
        console.warn('WASM Mixer returned invalid data; using JS fallback.')
        this.fallbackWarned = true
      }
      this.processFallback(output, inputA, inputB, levelsA, levelsB, channelCount, sampleCount)
      return true
    }

    for (let channel = 0; channel < channelCount; channel += 1) {
      output[channel].set(block)
    }

    return true
  }

  private processFallback(
    output: Float32Array[],
    inputA: Float32Array | undefined,
    inputB: Float32Array | undefined,
    levelsA: Float32Array,
    levelsB: Float32Array,
    channelCount: number,
    sampleCount: number,
  ) {
    const normalizer = 0.5
    for (let i = 0; i < sampleCount; i += 1) {
      const levelA = levelsA.length > 1 ? levelsA[i] : levelsA[0]
      const levelB = levelsB.length > 1 ? levelsB[i] : levelsB[0]
      const a = inputA ? inputA[i] * levelA : 0
      const b = inputB ? inputB[i] * levelB : 0
      const mixed = (a + b) * normalizer
      for (let channel = 0; channel < channelCount; channel += 1) {
        output[channel][i] = mixed
      }
    }
  }
}

registerProcessor('wasm-mixer-processor', WasmMixerProcessor)
