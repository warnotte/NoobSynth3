import init, { WasmVco } from './wasm/dsp_wasm_wrapper'
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
const DEBUG_VCO_OFFSET_HZ: number = 0
const DEFAULT_BASE_FREQ = 220

class WasmOscProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'baseFrequency',
        defaultValue: 220,
        minValue: 0,
        maxValue: 20000,
        automationRate: 'a-rate' as const,
      },
      {
        name: 'waveform',
        defaultValue: 2,
        minValue: 0,
        maxValue: 3,
        automationRate: 'k-rate' as const,
      },
      {
        name: 'pwm',
        defaultValue: 0.5,
        minValue: 0.05,
        maxValue: 0.95,
        automationRate: 'a-rate' as const,
      },
      {
        name: 'fmLinDepth',
        defaultValue: 0,
        minValue: 0,
        maxValue: 2000,
        automationRate: 'a-rate' as const,
      },
      {
        name: 'fmExpDepth',
        defaultValue: 0,
        minValue: 0,
        maxValue: 4,
        automationRate: 'a-rate' as const,
      },
      {
        name: 'unison',
        defaultValue: 1,
        minValue: 1,
        maxValue: 4,
        automationRate: 'k-rate' as const,
      },
      {
        name: 'detune',
        defaultValue: 0,
        minValue: 0,
        maxValue: 30,
        automationRate: 'a-rate' as const,
      },
    ]
  }

  private vco: InstanceType<typeof WasmVco> | null = null
  private baseFreqScratch = new Float32Array()
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
      this.vco = new WasmVco(sampleRate)
      this.ready = true
    } catch (error) {
      console.error('WASM osc init failed', error)
      this.ready = false
    }
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ) {
    const output = outputs[0]
    if (!output || output.length === 0) {
      return true
    }
    const channel = output[0]
    const empty = EMPTY_INPUT

    const pitchInput = _inputs[0]?.[0] ?? empty
    const fmLinInput = _inputs[1]?.[0] ?? empty
    const fmExpInput = _inputs[2]?.[0] ?? empty
    const pwmInput = _inputs[3]?.[0] ?? empty
    const syncInput = _inputs[4]?.[0] ?? empty

    const baseFreq = parameters.baseFrequency ?? empty
    const waveform = parameters.waveform ?? empty
    const pwmParam = parameters.pwm ?? empty
    const fmLinDepth = parameters.fmLinDepth ?? empty
    const fmExpDepth = parameters.fmExpDepth ?? empty
    const unisonParam = parameters.unison ?? empty
    const detuneParam = parameters.detune ?? empty

    if (!this.ready || !this.vco) {
      if (!this.fallbackWarned) {
        console.warn('WASM VCO not ready; outputting silence (fallback).')
        this.fallbackWarned = true
      }
      for (let channelIndex = 0; channelIndex < output.length; channelIndex += 1) {
        output[channelIndex].fill(0)
      }
      return true
    }

    const sampleCount = channel.length
    const adjustedBaseFreq = this.applyBaseFreqOffset(baseFreq, sampleCount)
    const block = this.vco.render(
      pitchInput,
      fmLinInput,
      fmExpInput,
      pwmInput,
      syncInput,
      adjustedBaseFreq,
      waveform,
      pwmParam,
      fmLinDepth,
      fmExpDepth,
      unisonParam,
      detuneParam,
      sampleCount,
    )
    if (!block || block.length < sampleCount) {
      if (!this.fallbackWarned) {
        console.warn('WASM VCO returned invalid data; outputting silence (fallback).')
        this.fallbackWarned = true
      }
      for (let channelIndex = 0; channelIndex < output.length; channelIndex += 1) {
        output[channelIndex].fill(0)
      }
      return true
    }
    for (let channelIndex = 0; channelIndex < output.length; channelIndex += 1) {
      output[channelIndex].set(block)
    }
    return true
  }

  private applyBaseFreqOffset(values: Float32Array, frames: number) {
    if (DEBUG_VCO_OFFSET_HZ === 0) {
      return values
    }
    if (values.length <= 1) {
      if (this.baseFreqScratch.length !== 1) {
        this.baseFreqScratch = new Float32Array(1)
      }
      const base = values.length === 0 ? DEFAULT_BASE_FREQ : values[0]
      this.baseFreqScratch[0] = base + DEBUG_VCO_OFFSET_HZ
      return this.baseFreqScratch
    }
    if (this.baseFreqScratch.length !== frames) {
      this.baseFreqScratch = new Float32Array(frames)
    }
    for (let i = 0; i < frames; i += 1) {
      this.baseFreqScratch[i] = values[i] + DEBUG_VCO_OFFSET_HZ
    }
    return this.baseFreqScratch
  }
}

registerProcessor('wasm-osc-processor', WasmOscProcessor)
